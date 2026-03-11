from services.session_service import session_service


class HealthService:
    """Performs readiness and liveness checks."""

    def check(self) -> dict:
        """
        Returns a dict with:
          - status: 'healthy' | 'degraded'
          - k8s_connected: bool
          - active_sessions: int
        """
        k8s_ok = self._check_k8s()
        return {
            "status": "healthy" if k8s_ok else "degraded",
            "k8s_connected": k8s_ok,
            "active_sessions": session_service.count,
        }

    @staticmethod
    def _check_k8s() -> bool:
        """Attempt a lightweight K8s API call with a strict timeout."""
        try:
            from k8s_tools.client import core_v1_client
            core_v1_client.list_namespace(limit=1, _request_timeout=5)
            return True
        except Exception:
            return False


# Module-level singleton
health_service = HealthService()
