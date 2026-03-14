import asyncio
import json
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

    async def send_message(
        self,
        message: str,
        session_id: str = "",
        namespace: str = "",
    ) -> AgentResult:
        """
        Send a user message to the agent and return the result.

        Runs the synchronous graph in a thread pool to avoid blocking the
        event loop (which would starve health probes and other requests).
        """
        return await asyncio.to_thread(
            self._send_message_sync, message, session_id, namespace
        )

    def _send_message_sync(
        self,
        message: str,
        session_id: str = "",
        namespace: str = "",
    ) -> AgentResult:
        """Synchronous implementation of send_message."""
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

    async def approve_action(self, session_id: str, approved: bool) -> AgentResult:
        """
        Approve or deny a pending write action and resume the agent.

        Runs in a thread pool to avoid blocking the event loop.
        """
        return await asyncio.to_thread(
            self._approve_action_sync, session_id, approved
        )

    def _approve_action_sync(self, session_id: str, approved: bool) -> AgentResult:
        """Synchronous implementation of approve_action."""
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


    async def stream_message(
        self,
        message: str,
        session_id: str = "",
        namespace: str = "",
    ):
        """
        Async generator for Server-Sent Events (SSE).

        The synchronous graph.stream() runs in a background thread.
        An asyncio.Queue bridges SSE frames back to this async generator
        so the event loop is never blocked.

            background thread                    async generator
            ─────────────────                    ───────────────
            graph.stream()                       await queue.get()
              ↓ each event                         ↓
            queue.put_nowait(sse_frame)  ──→     yield sse_frame
              ...                                  ...
            queue.put_nowait(None)       ──→     break
        """
        ns = namespace or DEFAULT_NAMESPACE
        session = session_service.get_or_create_session(session_id, ns)
        session.message_count += 1

        # Send initial metadata immediately (no blocking work yet).
        yield f"data: {json.dumps({'type': 'metadata', 'session_id': session.session_id})}\n\n"

        config = {"configurable": {"thread_id": session.thread_id}}
        initial_state = {
            "messages": [HumanMessage(content=message)],
            "human_approval": None,
            "pending_action": None,
            "current_namespace": session.namespace,
        }

        queue: asyncio.Queue[str | None] = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def _run_graph():
            """Runs in a background thread — safe to block here."""

            def _put(item: str | None):
                loop.call_soon_threadsafe(queue.put_nowait, item)

            try:
                print(f"\n--- [{session.session_id}] Starting Graph SSE Stream ---")
                for event in self.graph.stream(initial_state, config, stream_mode="updates"):
                    for node, state in event.items():
                        print(f"[{session.session_id}] 🔄 Node executed: {node}")
                        if isinstance(state, dict) and "messages" in state:
                            msgs = state["messages"] if isinstance(state["messages"], list) else [state["messages"]]
                            for msg in msgs:
                                if hasattr(msg, "tool_calls") and msg.tool_calls:
                                    tool_names = [t["name"] for t in msg.tool_calls]
                                    _put(f"data: {json.dumps({'type': 'thought', 'content': f'Agent calling tools: {tool_names}'})}\n\n")
                                elif getattr(msg, "type", None) == "tool":
                                    tool_name = getattr(msg, "name", "unknown")
                                    _put(f"data: {json.dumps({'type': 'thought', 'content': f'Tool completed: {tool_name}'})}\n\n")

                # Graph done — build the final response frame.
                final_state = self.graph.get_state(config).values
                res = self._process_graph_result(final_state, session, config)
                session_service.save_session(session)

                final_data: dict = {
                    "session_id": res.session_id,
                    "type": res.type,
                    "content": res.content,
                    "approval_info": None,
                }
                if res.approval_info:
                    final_data["approval_info"] = {
                        "message": res.approval_info.get("message", ""),
                        "actions": res.approval_info.get("actions", []),
                    }
                _put(f"data: {json.dumps(final_data)}\n\n")

            except Exception as e:
                _put(f"data: {json.dumps({'session_id': session.session_id, 'type': 'error', 'content': f'Agent error: {e}'})}\n\n")
            finally:
                _put(None)  # sentinel — tells the async side we're done

        # Kick off the blocking work on a thread-pool thread.
        thread_future = loop.run_in_executor(None, _run_graph)

        try:
            while True:
                item = await queue.get()   # event loop is FREE while waiting
                if item is None:
                    break
                yield item
        finally:
            await thread_future

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
