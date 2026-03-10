from dataclasses import dataclass

from langchain_core.messages import HumanMessage
from langgraph.types import Command

from services.session_service import session_service, Session
from config.settings import DEFAULT_NAMESPACE


@dataclass
class AgentResult:
    """
    Unified result from the agent service.

    Attributes:
        session_id:   The session this result belongs to.
        type:         One of 'response', 'approval_required', 'error'.
        content:      The agent's text response or error message.
        approval_info: Details of the pending write action (if type == 'approval_required').
    """

    session_id: str
    type: str  # 'response' | 'approval_required' | 'error'
    content: str = ""
    approval_info: dict | None = None


class AgentService:
    """Manages agent graph invocations and the approval lifecycle."""

    def __init__(self):
        self._graph = None

    @property
    def graph(self):
        """Lazy-load the compiled graph from the server module."""
        if self._graph is None:
            from main import agent_graph
            self._graph = agent_graph
        return self._graph

    def send_message(
        self,
        message: str,
        session_id: str = "",
        namespace: str = "",
    ) -> AgentResult:
        """
        Send a user message to the agent and return the result.

        If the agent needs approval for a write action, the result will
        have type='approval_required' with the plan in approval_info.
        """
        ns = namespace or DEFAULT_NAMESPACE
        session = session_service.get_or_create_session(session_id, ns)
        session.message_count += 1

        config = {"configurable": {"thread_id": session.thread_id}}
        initial_state = {
            "messages": [HumanMessage(content=message)],
            "human_approval": None,
            "pending_action": None,
            "current_namespace": session.namespace,
        }

        try:
            result = self._run_and_log_graph(initial_state, config, session.session_id)
            res = self._process_graph_result(result, session, config)
            session_service.save_session(session)
            return res
        except Exception as e:
            return AgentResult(
                session_id=session.session_id,
                type="error",
                content=f"Agent error: {e}",
            )

    def approve_action(self, session_id: str, approved: bool) -> AgentResult:
        """
        Approve or deny a pending write action and resume the agent.

        Args:
            session_id: The session with the pending approval.
            approved:   True to approve, False to deny.

        Returns:
            AgentResult with the agent's follow-up response.
        """
        session = session_service.get_session(session_id)
        if session is None:
            return AgentResult(
                session_id=session_id,
                type="error",
                content="Session not found. Start a new conversation.",
            )

        if not session.has_pending_approval:
            return AgentResult(
                session_id=session.session_id,
                type="error",
                content="No pending approval for this session.",
            )

        config = {"configurable": {"thread_id": session.thread_id}}

        try:
            result = self._run_and_log_graph(Command(resume=approved), config, session.session_id)
            session.has_pending_approval = False
            res = self._process_graph_result(result, session, config)
            session_service.save_session(session)
            return res
        except Exception as e:
            session.has_pending_approval = False
            session_service.save_session(session)
            return AgentResult(
                session_id=session.session_id,
                type="error",
                content=f"Agent error: {e}",
            )

    def _run_and_log_graph(self, inputs, config: dict, session_id: str) -> dict:
        """
        Runs the graph using streaming to intercept and log node execution and tool calls.
        Returns the final state values.
        """
        print(f"\n--- [{session_id}] Starting Graph Execution ---")
        for event in self.graph.stream(inputs, config, stream_mode="updates"):
            for node, state in event.items():
                print(f"[{session_id}] 🔄 Node executed: {node}")
                if isinstance(state, dict) and "messages" in state:
                    messages = state["messages"] if isinstance(state["messages"], list) else [state["messages"]]
                    for msg in messages:
                        if hasattr(msg, "tool_calls") and msg.tool_calls:
                            tool_names = [t["name"] for t in msg.tool_calls]
                            print(f"[{session_id}] 🛠️ Agent called tools: {tool_names}")
                        elif getattr(msg, "type", None) == "tool":
                            tool_name = getattr(msg, "name", "unknown")
                            print(f"[{session_id}] ✅ Tool completed: {tool_name}")
        print(f"--- [{session_id}] Graph Execution Paused/Completed ---\n")
        return self.graph.get_state(config).values

    def _process_graph_result(
        self, result: dict, session: Session, config: dict
    ) -> AgentResult:
        """
        Inspect the graph state after invocation.

        If the graph paused at an interrupt (approval gate), return an
        approval_required result. Otherwise return the final response.
        """
        graph_state = self.graph.get_state(config)

        if graph_state.next:
            # Graph is paused — extract the interrupt payload
            interrupt_value = graph_state.tasks[0].interrupts[0].value
            session.has_pending_approval = True
            return AgentResult(
                session_id=session.session_id,
                type="approval_required",
                content=interrupt_value.get("message", "Approval required."),
                approval_info=interrupt_value,
            )

        # Graph completed — return final answer
        session.has_pending_approval = False
        response_content = (
            result["messages"][-1].content if result.get("messages") else ""
        )
        if isinstance(response_content, list):
            response_content = " ".join(str(x.get("text", x)) if isinstance(x, dict) else str(x) for x in response_content)
        elif not isinstance(response_content, str):
            response_content = str(response_content)
            
        return AgentResult(
            session_id=session.session_id,
            type="response",
            content=response_content,
        )


    def get_session_history(self, session_id: str) -> list[dict]:
        """
        Get the message history for a session from the LangGraph checkpointer.
        Returns a list of dicts with role and content.
        """
        session = session_service.get_session(session_id)
        if not session:
            return []

        config = {"configurable": {"thread_id": session.thread_id}}
        state_snap = self.graph.get_state(config)
        
        if not hasattr(state_snap, "values") or not state_snap.values:
            return []

        messages = state_snap.values.get("messages", [])
        history = []

        for msg in messages:
            if hasattr(msg, "type"):
                if msg.type == "human":
                    content = msg.content
                    if isinstance(content, list):
                        content = " ".join(str(x.get("text", x)) if isinstance(x, dict) else str(x) for x in content)
                    content_str = str(content).strip()
                    if content_str:
                        history.append({"role": "human", "content": content_str})
                elif msg.type == "ai":
                    content = msg.content
                    if isinstance(content, list):
                        content = " ".join(str(x.get("text", x)) if isinstance(x, dict) else str(x) for x in content)
                    
                    content_str = str(content).strip()
                    if content_str:
                        history.append({"role": "agent", "content": content_str})
                    
        return history


# Module-level singleton
agent_service = AgentService()
