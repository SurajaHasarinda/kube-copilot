from fastapi import APIRouter

from config.schemas import HealthResponse
from services.health_service import health_service

router = APIRouter(prefix="/api/v1", tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Lightweight liveness/startup probe endpoint.

    Returns immediately with status 200 — no external calls to Postgres
    or the K8s API, so it can never be blocked by downstream services.
    Used by Kubernetes startup and liveness probes.
    """
    result = health_service.check_alive()
    return HealthResponse(**result)


@router.get("/ready", response_model=HealthResponse)
async def readiness_check():
    """
    Full readiness probe endpoint.

    Verifies Postgres and Kubernetes connectivity. Returns 200 with
    ``status: 'degraded'`` if either is down. Kubernetes readiness
    probes should use this endpoint.
    """
    result = health_service.check_ready()
    return HealthResponse(**result)
