"""
LangGraph graph definition for the agent.

Flow:
  ┌───────────┐
  │  agent    │◄──────────────────────┐
  │  (LLM)   │                       │
  └─────┬─────┘                       │
        │                             │
        ▼                             │
  ┌───────────┐   read-only     ┌─────┴─────┐
  │  router   │ ──────────────► │  execute   │
  │           │                 │  tool      │
  └─────┬─────┘                 └────────────┘
        │ write action
        ▼
  ┌───────────┐   approved      ┌────────────┐
  │  approval │ ──────────────► │  execute   │
  │  gate     │                 │  tool      │
  └─────┬─────┘                 └────────────┘
        │ denied
        ▼
  ┌───────────┐
  │  cancel   │ ──► back to agent
  └───────────┘

The approval gate uses LangGraph's ``interrupt()`` to pause execution.
Both the CLI and the API resume execution by passing a boolean via
``Command(resume=True/False)``.
"""

import json
import logging
import traceback

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import AIMessage, ToolMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.types import interrupt
from langgraph.checkpoint.postgres import PostgresSaver
from config.database import get_pool

from config.settings import GOOGLE_API_KEY, GEMINI_MODEL
from agent.state import AgentState
from agent.tools import ALL_TOOLS, WRITE_TOOL_NAMES
from agent.prompts import SYSTEM_PROMPT
from persistence.memory import save_incident
from persistence.settings import get_setting

logger = logging.getLogger(__name__)

# Build a lookup: tool_name → callable
tool_map = {t.name: t for t in ALL_TOOLS}


# ── Graph Nodes ──────────────────────────────────────────────────────────────


def agent_node(state: AgentState) -> dict:
    """
    Call the LLM with the current message history.
    The LLM may respond with text, tool calls, or both.
    """
    sys_msg = SystemMessage(
        content=SYSTEM_PROMPT.format(namespace=state["current_namespace"])
    )
    messages = [sys_msg] + state["messages"]

    api_key = get_setting("GOOGLE_API_KEY", GOOGLE_API_KEY)
    model_name = get_setting("GEMINI_MODEL", GEMINI_MODEL)

    if not api_key or api_key == "setup-in-ui":
        return {
            "messages": [
                AIMessage(
                    content="Hello! It seems the Gemini API key is not configured. "
                    "Please configure it in the Settings page to start chatting."
                )
            ]
        }

    llm = ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=api_key,
        temperature=0.1,
        convert_system_message_to_human=True,
    )
    llm_with_tools = llm.bind_tools(ALL_TOOLS)

    try:
        response = llm_with_tools.invoke(messages)
    except Exception as exc:
        logger.exception("LLM invocation failed")
        return {
            "messages": [
                AIMessage(content=f"Error connecting to AI Provider: {exc}")
            ]
        }

    return {"messages": [response]}


def route_after_agent(state: AgentState) -> str:
    """
    Conditional edge: inspect the last message.
    - If no tool calls → END (final answer).
    - If tool calls contain a write action → go to approval gate.
    - Otherwise → execute read-only tools.
    """
    last_message = state["messages"][-1]

    # Only AIMessages can have tool_calls; guard against other types.
    tool_calls = getattr(last_message, "tool_calls", None)
    if not tool_calls:
        return "end"

    for tc in tool_calls:
        if tc["name"] in WRITE_TOOL_NAMES:
            return "approval_gate"

    return "execute_tools"


def execute_tools_node(state: AgentState) -> dict:
    """
    Execute all tool calls from the last AI message and return ToolMessages.

    Each tool invocation is wrapped in a try/except so that a single
    failing tool does not crash the entire graph — the error is returned
    as a ToolMessage and the LLM can decide how to proceed.
    """
    last_message: AIMessage = state["messages"][-1]
    tool_messages = []

    for tc in last_message.tool_calls:
        tool_name = tc["name"]
        tool_fn = tool_map.get(tool_name)

        if tool_fn is None:
            result = f"Error: unknown tool '{tool_name}'."
        else:
            try:
                result = tool_fn.invoke(tc["args"])
            except Exception as exc:
                logger.exception("Tool '%s' raised an exception", tool_name)
                result = (
                    f"Error executing tool '{tool_name}': {exc}\n"
                    f"{traceback.format_exc()}"
                )

        tool_messages.append(
            ToolMessage(content=str(result), tool_call_id=tc["id"])
        )

    return {"messages": tool_messages}


def approval_gate_node(state: AgentState) -> dict:
    """
    Human-in-the-loop gate for write actions.

    Uses LangGraph's ``interrupt()`` to pause graph execution and surface
    the proposed plan to the caller (CLI or API).  The caller resumes by
    passing a boolean (True = approved, False = denied) via
    ``Command(resume=<bool>)``.
    """
    last_message: AIMessage = state["messages"][-1]
    write_calls = [
        tc for tc in last_message.tool_calls if tc["name"] in WRITE_TOOL_NAMES
    ]

    # Build the proposal payload that gets surfaced to the caller.
    actions = [{"tool": tc["name"], "args": tc["args"]} for tc in write_calls]

    plan = {
        "type": "approval_required",
        "message": "The agent wants to perform a write action on the cluster.",
        "actions": actions,
    }

    # ``interrupt()`` halts the graph and returns ``plan`` to the caller.
    # When the caller resumes with ``Command(resume=True/False)``, the
    # return value of ``interrupt()`` is that boolean.
    approved = interrupt(plan)

    return {
        "human_approval": approved,
        "pending_action": json.dumps(plan) if not approved else None,
    }


def route_after_approval(state: AgentState) -> str:
    """Conditional edge after approval gate."""
    if state.get("human_approval"):
        return "execute_tools"
    return "cancel_action"


def cancel_action_node(state: AgentState) -> dict:
    """
    If the human denies approval, return a ToolMessage indicating cancellation
    so the LLM can respond accordingly.
    """
    last_message: AIMessage = state["messages"][-1]
    tool_messages = []

    for tc in last_message.tool_calls:
        if tc["name"] in WRITE_TOOL_NAMES:
            tool_messages.append(
                ToolMessage(
                    content=f"Action '{tc['name']}' was DENIED by the operator. "
                    "Do not retry. Suggest alternatives or provide diagnosis only.",
                    tool_call_id=tc["id"],
                )
            )
        else:
            # Execute any read-only tool calls that were bundled with the write.
            tool_fn = tool_map.get(tc["name"])
            if tool_fn:
                try:
                    result = tool_fn.invoke(tc["args"])
                except Exception as exc:
                    logger.exception("Tool '%s' failed during cancel", tc["name"])
                    result = f"Error executing tool '{tc['name']}': {exc}"
                tool_messages.append(
                    ToolMessage(content=str(result), tool_call_id=tc["id"])
                )
            else:
                tool_messages.append(
                    ToolMessage(
                        content=f"Error: unknown tool '{tc['name']}'.",
                        tool_call_id=tc["id"],
                    )
                )

    return {
        "messages": tool_messages,
        "human_approval": None,
        "pending_action": None,
    }


def save_memory_node(state: AgentState) -> dict:
    """
    After the agent produces a final answer, persist the incident
    in the PostgreSQL database for future reference.

    This node is best-effort — failures are logged but never propagated,
    because the user's response has already been determined.
    """
    try:
        messages = state["messages"]
        user_query = ""
        for msg in messages:
            if getattr(msg, "type", None) == "human":
                user_query = msg.content
                if isinstance(user_query, list):
                    user_query = " ".join(
                        str(x.get("text", x)) if isinstance(x, dict) else str(x)
                        for x in user_query
                    )
                elif not isinstance(user_query, str):
                    user_query = str(user_query)
                break

        final_answer = ""
        for msg in reversed(messages):
            if getattr(msg, "type", None) == "ai":
                content = msg.content
                if isinstance(content, list):
                    content = " ".join(
                        str(x.get("text", x)) if isinstance(x, dict) else str(x)
                        for x in content
                    )
                elif not isinstance(content, str):
                    content = str(content)
                text = content.strip()
                if text:
                    final_answer = text
                    break

        if user_query and final_answer:
            save_incident(
                namespace=state["current_namespace"],
                query=user_query,
                diagnosis=final_answer[:2000],
            )
    except Exception:
        logger.exception("Failed to save incident to memory (non-fatal)")

    return {}


# ── Build the Graph ──────────────────────────────────────────────────────────


def build_graph(checkpointer=None):
    """
    Construct and compile the LangGraph agent graph.

    Args:
        checkpointer: A LangGraph checkpointer for persisting graph state
                      across interrupt/resume cycles. If None, a PostgresSaver
                      is created automatically.

    Returns:
        A compiled LangGraph graph.
    """
    if checkpointer is None:
        import psycopg
        from config.settings import POSTGRES_URL

        with psycopg.connect(POSTGRES_URL, autocommit=True) as conn:
            temp_checkpointer = PostgresSaver(conn)
            temp_checkpointer.setup()

        checkpointer = PostgresSaver(get_pool())

    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("agent", agent_node)
    graph.add_node("execute_tools", execute_tools_node)
    graph.add_node("approval_gate", approval_gate_node)
    graph.add_node("cancel_action", cancel_action_node)
    graph.add_node("save_memory", save_memory_node)

    # Set entry point
    graph.set_entry_point("agent")

    # Conditional edge after agent
    graph.add_conditional_edges(
        "agent",
        route_after_agent,
        {
            "end": "save_memory",
            "execute_tools": "execute_tools",
            "approval_gate": "approval_gate",
        },
    )

    # After tool execution → back to agent for further reasoning
    graph.add_edge("execute_tools", "agent")

    # After approval gate → execute or cancel
    graph.add_conditional_edges(
        "approval_gate",
        route_after_approval,
        {
            "execute_tools": "execute_tools",
            "cancel_action": "cancel_action",
        },
    )

    # After cancellation → back to agent
    graph.add_edge("cancel_action", "agent")

    # After saving memory → done
    graph.add_edge("save_memory", END)

    return graph.compile(checkpointer=checkpointer)
