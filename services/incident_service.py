"""
Incident service — queries the PostgreSQL incident memory.
"""

from persistence.memory import get_recent_incidents, get_incident_count_today


class IncidentService:
    """Read-only access to incident history."""

    def get_recent(
        self, namespace: str | None = None, limit: int = 20
    ) -> list[dict]:
        """
        Retrieve recent incidents, optionally filtered by namespace.

        Returns a list of dicts with keys: id, timestamp, namespace, query, diagnosis.
        """
        return get_recent_incidents(namespace=namespace, limit=limit)

    def count_today(self, namespace: str) -> int:
        """Count incidents recorded today for a given namespace."""
        return get_incident_count_today(namespace)


# Module-level singleton
incident_service = IncidentService()
