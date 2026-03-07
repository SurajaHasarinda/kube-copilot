"""
Cluster controller — handles cluster visualization requests.

GET /api/v1/cluster/structure
"""

from fastapi import APIRouter, Depends

from config.auth import verify_jwt_token
from services.cluster_service import cluster_service

router = APIRouter(prefix="/api/v1/cluster", tags=["Cluster"])


@router.get("/structure")
async def get_cluster_structure(token_payload: dict = Depends(verify_jwt_token)):
    """
    Get the full cluster structure including namespaces, deployments, pods,
    services, configmaps, and secrets in a hierarchical format.
    """
    structure = cluster_service.get_cluster_structure()
    return structure
