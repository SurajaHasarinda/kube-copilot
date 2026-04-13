import asyncio
import json
import logging
from dataclasses import dataclass

from langchain_core.messages import HumanMessage
from langgraph.types import Command

from services.session_service import session_service, Session
from config.settings import DEFAULT_NAMESPACE

logger = logging.getLogger(__name__)


@dataclass
class AgentResult:
    """
    Unified result from the agent service.

    Attributes:
        session_id:    The session this result belongs to.
        type:          One of 'response', 'approval_required', 'error'.
        content:       The agent's text response or error message.
        approval_info: Details of the pending write action (if type == 'approval_required').
    """

    session_id: str
    type: str  # 'response' | 'approval_required' | 'error'
    content: str = ""
    approval_info: dict | None = None


def _extract_text(content) -> str:
    """Safely extract a plain-text string from LLM message content.

    Gemini may return content as a string, a list of content blocks
    (dicts with a ``text`` key), or occasionally another type.
    This helper normalises all variants to a single string.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                parts.append(str(item.get("text", "")))
            else:
                parts.append(str(item))
        return " ".join(parts)
    return str(content) if content else ""


class AgentService:
    """Manages agent graph invocations and the approval lifecycle."""

    def __init__(self):
        self._graph = None

    @property
    def graph(self):
        """Lazy-load the compiled graph from the server module."""
        if self._graph is None:
            from main import agent_graph
            if agent_graph is None:
                raise RuntimeError(
                    "The agent is still starting up. Please try again in a few seconds."
                )
            self._graph = agent_graph
        return self._graph

    # ── Public API ────────────────────────────────────────────────────────

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

    async def approve_action(self, session_id: str, approved: bool) -> AgentResult:
        """
        Approve or deny a pending write action and resume the agent.

        Runs in a thread pool to avoid blocking the event loop.
        """
        return await asyncio.to_thread(
            self._approve_action_sync, session_id, approved
        )

    async def stream_message(
        self,
        message: str,
        session_id: str = "",
        namespace: str = "",
    ):
        """
        Async generator for Server-Sent Events (SSE).

        The synchronous ``graph.stream()`` runs in a background thread.
        An ``asyncio.Queue`` bridges SSE frames back to this async generator
        so the event loop is never blocked.
        """
        ns = namespace or DEFAULT_NAMESPACE
        session = session_service.get_or_create_session(session_id, ns)
        session.message_count += 1

        # Send initial metadata immediately.
        yield self._sse_frame({"type": "metadata", "session_id": session.session_id})

        config = {"configurable": {"thread_id": session.thread_id}}
        initial_state = {
            "messages": [HumanMessage(content=message)],
            "human_approval": None,
            "pending_action": None,
            "current_namespace": session.namespace,
        }

        queue: asyncio.Queue[str | None] = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def _run_graph():
            """Runs in a background thread — safe to block here."""

            def _put(item: str | None):
                loop.call_soon_threadsafe(queue.put_nowait, item)

            try:
                logger.info("[%s] Starting graph SSE stream", session.session_id)
                for event in self.graph.stream(initial_state, config, stream_mode="updates"):
                    for node, state in event.items():
                        logger.info("[%s] Node executed: %s", session.session_id, node)

                        # Emit a step event for each node so the UI shows progress.
                        if node == "agent":
                            _put(self._sse_frame({
                                "type": "thought",
                                "step": "thinking",
                                "content": "Analyzing your request…",
                            }))

                        if isinstance(state, dict) and "messages" in state:
                            msgs = state["messages"] if isinstance(state["messages"], list) else [state["messages"]]
                            for msg in msgs:
                                if hasattr(msg, "tool_calls") and msg.tool_calls:
                                    for tc in msg.tool_calls:
                                        _put(self._sse_frame({
                                            "type": "thought",
                                            "step": "tool_call",
                                            "tool": tc["name"],
                                            "args": tc.get("args", {}),
                                            "content": f"Calling {tc['name']}",
                                        }))
                                elif getattr(msg, "type", None) == "tool":
                                    tool_name = getattr(msg, "name", "unknown")
                                    content_preview = _extract_text(msg.content)[:200]
                                    _put(self._sse_frame({
                                        "type": "thought",
                                        "step": "tool_result",
                                        "tool": tool_name,
                                        "content": content_preview,
                                    }))

                        if node == "save_memory":
                            _put(self._sse_frame({
                                "type": "thought",
                                "step": "done",
                                "content": "Preparing response…",
                            }))

                # Graph finished — build the final response.
                result = self._build_result_from_state(session, config)
                session_service.save_session(session)

                final_data: dict = {
                    "session_id": result.session_id,
                    "type": result.type,
                    "content": result.content,
                    "approval_info": None,
                }
                if result.approval_info:
                    final_data["approval_info"] = {
                        "message": result.approval_info.get("message", ""),
                        "actions": result.approval_info.get("actions", []),
                    }
                _put(self._sse_frame(final_data))

            except Exception as exc:
                logger.exception("[%s] Graph SSE stream error", session.session_id)
                _put(self._sse_frame({
                    "session_id": session.session_id,
                    "type": "error",
                    "content": f"Agent error: {exc}",
                }))
            finally:
                _put(None)  # sentinel — tells the async side we're done

        # Kick off the blocking work on a thread-pool thread.
        thread_future = loop.run_in_executor(None, _run_graph)

        # Cloudflare (and similar proxies) drop idle connections after ~100s.
        # Sending a SSE comment every 15s keeps the connection alive.
        HEARTBEAT_INTERVAL = 15  # seconds
        SSE_HEARTBEAT = ": keepalive\n\n"

        try:
            while True:
                try:
                    item = await asyncio.wait_for(
                        queue.get(), timeout=HEARTBEAT_INTERVAL
                    )
                    if item is None:
                        break
                    yield item
                except asyncio.TimeoutError:
                    # No real event within the heartbeat window — send a
                    # SSE comment to keep Cloudflare from closing the connection.
                    yield SSE_HEARTBEAT
        finally:
            await thread_future

    def get_session_history(self, session_id: str) -> list[dict]:
        """
        Get the message history for a session from the LangGraph checkpointer.
        Returns a list of dicts with role and content.
        """
        session = session_service.get_session(session_id)
        if not session:
            return []

        config = {"configurable": {"thread_id": session.thread_id}}
        try:
            state_snap = self.graph.get_state(config)
        except Exception:
            logger.exception("Failed to get state for session %s", session_id)
            return []

        if not hasattr(state_snap, "values") or not state_snap.values:
            return []

        messages = state_snap.values.get("messages", [])
        history = []

        for msg in messages:
            msg_type = getattr(msg, "type", None)
            if msg_type == "human":
                text = _extract_text(msg.content).strip()
                if text:
                    history.append({"role": "human", "content": text})
            elif msg_type == "ai":
                text = _extract_text(msg.content).strip()
                if text:
                    history.append({"role": "agent", "content": text})

        return history

    # ── Private helpers ───────────────────────────────────────────────────

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
            self._stream_graph(initial_state, config, session.session_id)
            result = self._build_result_from_state(session, config)
            session_service.save_session(session)
            return result
        except Exception as exc:
            logger.exception("[%s] send_message failed", session.session_id)
            return AgentResult(
                session_id=session.session_id,
                type="error",
                content=f"Agent error: {exc}",
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
            self._stream_graph(Command(resume=approved), config, session.session_id)
            session.has_pending_approval = False
            result = self._build_result_from_state(session, config)
            session_service.save_session(session)
            return result
        except Exception as exc:
            logger.exception("[%s] approve_action failed", session.session_id)
            session.has_pending_approval = False
            session_service.save_session(session)
            return AgentResult(
                session_id=session.session_id,
                type="error",
                content=f"Agent error: {exc}",
            )

    def _stream_graph(self, inputs, config: dict, session_id: str) -> None:
        """
        Run the graph to completion (or until an interrupt) using streaming,
        logging node execution and tool calls along the way.

        Raises on unrecoverable graph errors so callers can handle them.
        """
        logger.info("[%s] Starting graph execution", session_id)
        for event in self.graph.stream(inputs, config, stream_mode="updates"):
            for node, state in event.items():
                logger.info("[%s] Node executed: %s", session_id, node)
                if isinstance(state, dict) and "messages" in state:
                    messages = state["messages"] if isinstance(state["messages"], list) else [state["messages"]]
                    for msg in messages:
                        if hasattr(msg, "tool_calls") and msg.tool_calls:
                            tool_names = [t["name"] for t in msg.tool_calls]
                            logger.info("[%s] Agent called tools: %s", session_id, tool_names)
                        elif getattr(msg, "type", None) == "tool":
                            tool_name = getattr(msg, "name", "unknown")
                            logger.info("[%s] Tool completed: %s", session_id, tool_name)
        logger.info("[%s] Graph execution paused/completed", session_id)

    def _build_result_from_state(
        self,
        session: Session,
        config: dict,
    ) -> AgentResult:
        """
        Inspect the graph state after invocation and return an ``AgentResult``.

        If the graph paused at an interrupt (approval gate), return an
        ``approval_required`` result.  Otherwise return the final response.
        """
        graph_state = self.graph.get_state(config)
        values = graph_state.values

        # ── Interrupted (approval gate) ──────────────────────────────────
        if graph_state.next:
            try:
                interrupt_value = graph_state.tasks[0].interrupts[0].value
            except (IndexError, AttributeError):
                logger.error("[%s] Graph interrupted but no interrupt payload found", session.session_id)
                return AgentResult(
                    session_id=session.session_id,
                    type="error",
                    content="Internal error: graph interrupted without payload.",
                )

            session.has_pending_approval = True
            return AgentResult(
                session_id=session.session_id,
                type="approval_required",
                content=interrupt_value.get("message", "Approval required."),
                approval_info=interrupt_value,
            )

        # ── Completed — extract the final AI answer ──────────────────────
        session.has_pending_approval = False
        messages = values.get("messages", [])

        # Walk backwards to find the last AI message with actual content.
        response_content = ""
        for msg in reversed(messages):
            if getattr(msg, "type", None) == "ai":
                text = _extract_text(msg.content).strip()
                if text:
                    response_content = text
                    break

        if not response_content:
            logger.warning("[%s] No AI response found in final state", session.session_id)
            response_content = "I processed your request but could not generate a response."

        return AgentResult(
            session_id=session.session_id,
            type="response",
            content=response_content,
        )

    @staticmethod
    def _sse_frame(data: dict) -> str:
        """Format a dict as an SSE ``data:`` frame."""
        return f"data: {json.dumps(data)}\n\n"


# Module-level singleton
agent_service = AgentService()
