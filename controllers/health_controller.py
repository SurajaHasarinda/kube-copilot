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


@router.post("/test-email")
async def test_email(email: str):
    """
    Triggers a mock critical anomaly email sent to the provided address.
    """
    mock_anomaly = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "severity": "critical",
        "category": "CrashLoopBackOff",
        "namespace": "mock-system",
        "resource_type": "pod",
        "resource_name": "mock-test-pod-1234",
        "message": "Pod mock-test-pod-1234 is in CrashLoopBackOff state",
        "details": "Mock Error: failed to ping the database during test.",
        "logs": "[TEST LOG] Database connection refused\n[TEST LOG] Exiting with code 1",
        "node_name": "mock-node",
    }
    
    try:
        send_critical_anomaly_email(email, mock_anomaly)
        return {"status": "success", "message": f"Test email dispatched to {email}."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
