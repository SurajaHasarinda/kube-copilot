from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

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
    result = await agent_service.send_message(
        message=request.message,
        session_id=request.session_id,
        namespace=request.namespace,
    )
    return _to_chat_response(result)


@router.get("/stream")
async def stream_message(
    message: str,
    session_id: str = "",
    namespace: str = "",
    token_payload: dict = Depends(verify_jwt_token),
):
    """
    Send a message to the agent using Server-Sent Events (SSE).
    Returns real-time updates as the agent executes tools and reasons.
    """
    return StreamingResponse(
        agent_service.stream_message(message, session_id, namespace),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

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
    result = await agent_service.approve_action(
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
