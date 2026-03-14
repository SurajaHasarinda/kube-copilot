import asyncio

from fastapi import APIRouter, Depends, Query, Path

from config.auth import verify_jwt_token
from config.schemas import AnomalyRecord, AnomalyListResponse, AnomalyStatsResponse
from services.cluster_service import cluster_service
from services.cluster_monitor_service import cluster_monitor_service

router = APIRouter(prefix="/api/v1/cluster", tags=["Cluster"])


@router.get("/structure")
async def get_cluster_structure(token_payload: dict = Depends(verify_jwt_token)):
    """
    Get the full cluster structure including namespaces, deployments, pods,
    services, configmaps, and secrets in a hierarchical format.
    """
    structure = await asyncio.to_thread(cluster_service.get_cluster_structure)
    return structure


@router.post("/scan")
async def scan_cluster(token_payload: dict = Depends(verify_jwt_token)):
    """
    Trigger a full cluster scan for abnormal behaviors.
    Returns newly detected anomalies.
    """
    new_anomalies = await asyncio.to_thread(cluster_monitor_service.scan_cluster)
    return {
        "scanned": True,
        "new_anomalies": len(new_anomalies),
        "anomalies": new_anomalies,
    }


@router.get("/anomalies", response_model=AnomalyListResponse)
async def list_anomalies(
    namespace: str = Query(default="", description="Filter by namespace. Empty = all."),
    severity: str = Query(default="", description="Filter by severity: critical, error, warning."),
    limit: int = Query(default=50, ge=1, le=200, description="Max records to return."),
    token_payload: dict = Depends(verify_jwt_token),
):
    """Retrieve detected cluster anomalies, newest first."""
    ns = namespace or None
    sev = severity or None
    rows = await asyncio.to_thread(cluster_monitor_service.get_anomalies, namespace=ns, severity=sev, limit=limit)
    stats = await asyncio.to_thread(cluster_monitor_service.get_anomaly_stats)
    return AnomalyListResponse(
        anomalies=[AnomalyRecord(**row) for row in rows],
        stats=stats,
    )


@router.get("/anomalies/stats", response_model=AnomalyStatsResponse)
async def anomaly_stats(token_payload: dict = Depends(verify_jwt_token)):
    """Get anomaly counts by severity."""
    stats = await asyncio.to_thread(cluster_monitor_service.get_anomaly_stats)
    return AnomalyStatsResponse(**stats)


@router.get("/anomalies/{anomaly_id}")
async def get_anomaly(
    anomaly_id: int = Path(..., description="Anomaly record ID"),
    token_payload: dict = Depends(verify_jwt_token),
):
    """Retrieve a single anomaly record including full logs."""
    record = await asyncio.to_thread(cluster_monitor_service.get_anomaly_by_id, anomaly_id)
    if not record:
        return {"error": "Anomaly not found"}
    return record


@router.post("/anomalies/{anomaly_id}/resolve")
async def resolve_anomaly(
    anomaly_id: int = Path(..., description="Anomaly record ID"),
    token_payload: dict = Depends(verify_jwt_token),
):
    """Mark an anomaly as resolved."""
    success = await asyncio.to_thread(cluster_monitor_service.resolve_anomaly, anomaly_id)
    return {"resolved": success}
