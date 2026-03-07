"""
Session controller — session management endpoints.

GET    /api/v1/sessions           — List active sessions
DELETE /api/v1/sessions/{id}      — Delete a session
"""

from fastapi import APIRouter, Depends, HTTPException, status

from config.auth import verify_jwt_token
from config.schemas import SessionInfo, SessionListResponse
from services.session_service import session_service

router = APIRouter(prefix="/api/v1/sessions", tags=["Sessions"])


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    token_payload: dict = Depends(verify_jwt_token),
):
    """List all active agent sessions."""
    sessions = session_service.list_sessions()
    return SessionListResponse(
        sessions=[
            SessionInfo(
                session_id=s.session_id,
                namespace=s.namespace,
                created_at=s.created_at,
                message_count=s.message_count,
                has_pending_approval=s.has_pending_approval,
            )
            for s in sessions
        ]
    )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    token_payload: dict = Depends(verify_jwt_token),
):
    """Delete an active session."""
    if not session_service.delete_session(session_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )
