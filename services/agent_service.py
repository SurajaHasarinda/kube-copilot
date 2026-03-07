"""
Agent service — core business logic for interacting with the LangGraph agent.

Encapsulates graph invocation, interrupt detection, and approval handling
so that controllers remain thin HTTP adapters.
"""

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
            result = self.graph.invoke(initial_state, config)
            return self._process_graph_result(result, session, config)
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
            result = self.graph.invoke(Command(resume=approved), config)
            session.has_pending_approval = False
            return self._process_graph_result(result, session, config)
        except Exception as e:
            session.has_pending_approval = False
            return AgentResult(
                session_id=session.session_id,
                type="error",
                content=f"Agent error: {e}",
            )

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


# Module-level singleton
agent_service = AgentService()
