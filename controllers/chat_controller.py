from fastapi import APIRouter, Depends

from config.auth import verify_jwt_token
from config.schemas import ChatRequest, ChatResponse, ApprovalRequest, ApprovalInfo
from services.agent_service import agent_service

router = APIRouter(prefix="/api/v1/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    token_payload: dict = Depends(verify_jwt_token),
):
    """
    Send a message to the agent.

    If the agent needs to perform a write action, the response will have
    `type: "approval_required"` with details in `approval_info`.
    Call `/api/v1/chat/approve` to continue.
    """
    result = agent_service.send_message(
        message=request.message,
        session_id=request.session_id,
        namespace=request.namespace,
    )
    return _to_chat_response(result)


@router.post("/approve", response_model=ChatResponse)
async def approve_action(
    request: ApprovalRequest,
    token_payload: dict = Depends(verify_jwt_token),
):
    """
    Approve or deny a pending write action.

    Must be called after a `send_message` response with
    `type: "approval_required"`.
    """
    result = agent_service.approve_action(
        session_id=request.session_id,
        approved=request.approved,
    )
    return _to_chat_response(result)


def _to_chat_response(result) -> ChatResponse:
    """Map an AgentResult to the ChatResponse schema."""
    approval_info = None
    if result.approval_info:
        approval_info = ApprovalInfo(
            message=result.approval_info.get("message", ""),
            actions=result.approval_info.get("actions", []),
        )

    return ChatResponse(
        session_id=result.session_id,
        type=result.type,
        content=result.content,
        approval_info=approval_info,
    )
