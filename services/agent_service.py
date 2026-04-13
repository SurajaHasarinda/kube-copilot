import asyncio
import json
import logging
import threading
from dataclasses import dataclass

from langchain_core.messages import HumanMessage
from langgraph.types import Command

from services.session_service import session_service, Session
from config.settings import DEFAULT_NAMESPACE

logger = logging.getLogger(__name__)

# Cloudflare and similar reverse proxies drop idle SSE connections.
# Sending a comment every 15 seconds prevents that.
_HEARTBEAT_SECONDS = 15
_SSE_HEARTBEAT = ": keepalive\n\n"


@dataclass
class AgentResult:
    """Unified result from the agent service."""

    session_id: str
    type: str  # 'response' | 'approval_required' | 'error'
    content: str = ""
    approval_info: dict | None = None


def _extract_text(content) -> str:
    """Safely extract a plain-text string from LLM message content."""
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
        """Send a user message and return the result (non-streaming)."""
        return await asyncio.to_thread(
            self._send_message_sync, message, session_id, namespace
        )

    async def approve_action(self, session_id: str, approved: bool) -> AgentResult:
        """Approve or deny a pending write action."""
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
        Async generator that yields SSE frames.

        The synchronous graph runs in a background thread. An asyncio.Event
        plus a thread-safe list bridge events back to the async generator.
        A heartbeat keeps the connection alive through Cloudflare.
        """
        ns = namespace or DEFAULT_NAMESPACE
        session = session_service.get_or_create_session(session_id, ns)
        session.message_count += 1

        # Send metadata immediately so the frontend gets the session ID.
        yield self._sse_frame({"type": "metadata", "session_id": session.session_id})

        config = {"configurable": {"thread_id": session.thread_id}}
        initial_state = {
            "messages": [HumanMessage(content=message)],
            "human_approval": None,
            "pending_action": None,
            "current_namespace": session.namespace,
        }

        # Shared mutable state between the graph thread and the async generator.
        # Using a list + lock + event avoids the asyncio.Queue item-loss bug
        # that occurs when asyncio.wait_for cancels queue.get().
        pending: list[str] = []
        lock = threading.Lock()
        new_event = asyncio.Event()
        finished = False
        loop = asyncio.get_running_loop()

        def _push(frame: str):
            """Thread-safe push: add a frame and wake the async consumer."""
            with lock:
                pending.append(frame)
            loop.call_soon_threadsafe(new_event.set)

        def _run_graph():
            nonlocal finished
            try:
                logger.info("[%s] Starting graph stream", session.session_id)

                for event in self.graph.stream(initial_state, config, stream_mode="updates"):
                    for node, state in event.items():
                        logger.info("[%s] Node: %s", session.session_id, node)

                        # Emit thought steps for the UI.
                        if node == "agent":
                            _push(self._sse_frame({
                                "type": "thought", "step": "thinking",
                                "content": "Analyzing your request…",
                            }))

                        if isinstance(state, dict) and "messages" in state:
                            msgs = state["messages"] if isinstance(state["messages"], list) else [state["messages"]]
                            for msg in msgs:
                                if hasattr(msg, "tool_calls") and msg.tool_calls:
                                    for tc in msg.tool_calls:
                                        _push(self._sse_frame({
                                            "type": "thought", "step": "tool_call",
                                            "tool": tc["name"],
                                            "args": tc.get("args", {}),
                                            "content": f"Calling {tc['name']}",
                                        }))
                                elif getattr(msg, "type", None) == "tool":
                                    tool_name = getattr(msg, "name", "unknown")
                                    preview = _extract_text(msg.content)[:200]
                                    _push(self._sse_frame({
                                        "type": "thought", "step": "tool_result",
                                        "tool": tool_name, "content": preview,
                                    }))

                        if node == "save_memory":
                            _push(self._sse_frame({
                                "type": "thought", "step": "done",
                                "content": "Preparing response…",
                            }))

                # Graph completed — build the final response.
                result = self._build_result_from_state(session, config)
                session_service.save_session(session)

                final: dict = {
                    "session_id": result.session_id,
                    "type": result.type,
                    "content": result.content,
                    "approval_info": None,
                }
                if result.approval_info:
                    final["approval_info"] = {
                        "message": result.approval_info.get("message", ""),
                        "actions": result.approval_info.get("actions", []),
                    }
                _push(self._sse_frame(final))

            except Exception as exc:
                logger.exception("[%s] Graph stream error", session.session_id)
                _push(self._sse_frame({
                    "session_id": session.session_id,
                    "type": "error",
                    "content": f"Agent error: {exc}",
                }))
            finally:
                finished = True
                loop.call_soon_threadsafe(new_event.set)

        # Start the graph in a background thread.
        thread = threading.Thread(target=_run_graph, daemon=True)
        thread.start()

        # Async consumer: drain pending frames and send heartbeats.
        try:
            while True:
                # Wait for the background thread to push something,
                # or time out and send a heartbeat.
                try:
                    await asyncio.wait_for(
                        new_event.wait(), timeout=_HEARTBEAT_SECONDS
                    )
                except asyncio.TimeoutError:
                    # No events within the heartbeat window — send keepalive.
                    yield _SSE_HEARTBEAT
                    continue

                # Drain all available frames.
                new_event.clear()
                with lock:
                    frames = list(pending)
                    pending.clear()

                for frame in frames:
                    yield frame

                if finished:
                    break
        finally:
            thread.join(timeout=5)

    def get_session_history(self, session_id: str) -> list[dict]:
        """Get the message history for a session from the LangGraph checkpointer."""
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
        """Run the graph to completion, logging along the way."""
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
        """Inspect the graph state and return an AgentResult."""
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
