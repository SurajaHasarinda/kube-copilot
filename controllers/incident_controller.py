"""
Incident controller — incident history endpoints.

GET /api/v1/incidents — List past incident records
"""

from fastapi import APIRouter, Depends, Query

from config.auth import verify_jwt_token
from config.schemas import IncidentListResponse, IncidentRecord
from services.incident_service import incident_service

router = APIRouter(prefix="/api/v1/incidents", tags=["Incidents"])


@router.get("", response_model=IncidentListResponse)
async def list_incidents(
    namespace: str = Query(default="", description="Filter by namespace. Empty = all."),
    limit: int = Query(default=20, ge=1, le=100, description="Max records to return."),
    token_payload: dict = Depends(verify_jwt_token),
):
    """Retrieve recent incident / diagnosis history."""
    ns = namespace or None
    rows = incident_service.get_recent(namespace=ns, limit=limit)
    return IncidentListResponse(
        incidents=[IncidentRecord(**row) for row in rows]
    )
