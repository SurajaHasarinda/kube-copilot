from fastapi import APIRouter

from config.schemas import HealthResponse
from services.health_service import health_service
from services.email_service import send_critical_anomaly_email
from datetime import datetime, timezone

router = APIRouter(prefix="/api/v1", tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Returns server health and Kubernetes connectivity status.
    This endpoint does NOT require authentication so load balancers
    and monitoring tools can hit it freely.
    """
    result = health_service.check()
    return HealthResponse(**result)
