from typing import Annotated, Literal
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """
    State that flows through every node in the LangGraph graph.

    Attributes:
        messages:        The conversation history (LLM + tool messages).
        human_approval:  None = not yet asked, True = approved, False = rejected.
        pending_action:  Description of the write action awaiting approval.
        current_namespace: The namespace the agent is currently scoped to.
    """

    messages: Annotated[list, add_messages]
    human_approval: bool | None
    pending_action: str | None
    current_namespace: str
