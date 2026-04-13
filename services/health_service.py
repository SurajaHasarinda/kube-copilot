import logging

logger = logging.getLogger(__name__)


class HealthService:
    """Performs readiness and liveness checks."""

    def check_alive(self) -> dict:
        """Lightweight liveness check — no external calls.

        Used by the Kubernetes startup and liveness probes.
        Returns immediately so the port-open check always passes.
        """
        return {
            "status": "healthy",
            "k8s_connected": True,
            "active_sessions": 0,
        }

    def check_ready(self) -> dict:
        """Full readiness check — verifies K8s and DB connectivity.

        Used by the readiness probe to determine if the pod
        should receive traffic.
        """
        k8s_ok = self._check_k8s()
        db_ok = self._check_db()

        if k8s_ok and db_ok:
            status = "healthy"
        else:
            status = "degraded"

        sessions = 0
        if db_ok:
            try:
                from services.session_service import session_service
                sessions = session_service.count
            except Exception:
                pass

        return {
            "status": status,
            "k8s_connected": k8s_ok,
            "active_sessions": sessions,
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

    @staticmethod
    def _check_db() -> bool:
        """Quick Postgres connectivity check."""
        try:
            from config.database import get_pool
            with get_pool().connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
            return True
        except Exception:
            return False


# Module-level singleton
health_service = HealthService()
