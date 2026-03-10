from datetime import datetime, timezone, timedelta
from typing import Optional

from psycopg.rows import dict_row

from config.database import get_pool
from k8s_tools.client import core_v1_client, apps_v1_client, ApiException

from services.email_service import send_critical_anomaly_email
from services.auth_service import auth_service


# ── Database helpers ─────────────────────────────────────────────────────────

def _ensure_anomalies_table():
    """Create the anomalies table if it does not exist."""
    with get_pool().connection() as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS cluster_anomalies (
                    id              SERIAL PRIMARY KEY,
                    timestamp       TEXT NOT NULL,
                    severity        TEXT NOT NULL,
                    category        TEXT NOT NULL,
                    namespace       TEXT NOT NULL,
                    resource_type   TEXT NOT NULL,
                    resource_name   TEXT NOT NULL,
                    message         TEXT NOT NULL,
                    details         TEXT DEFAULT '',
                    logs            TEXT DEFAULT '',
                    node_name       TEXT DEFAULT '',
                    resolved        BOOLEAN DEFAULT FALSE
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_anomalies_lookup
                ON cluster_anomalies (namespace, resource_name, category, timestamp)
            """)
            conn.commit()


def _save_anomaly(cur, anomaly: dict) -> int:
    """Insert an anomaly record using an existing cursor. Returns the new ID."""
    cur.execute(
        """
        INSERT INTO cluster_anomalies
            (timestamp, severity, category, namespace, resource_type,
             resource_name, message, details, logs, node_name)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            anomaly["timestamp"],
            anomaly["severity"],
            anomaly["category"],
            anomaly["namespace"],
            anomaly["resource_type"],
            anomaly["resource_name"],
            anomaly["message"],
            anomaly.get("details", ""),
            anomaly.get("logs", ""),
            anomaly.get("node_name", ""),
        ),
    )
    row = cur.fetchone()
    anomaly_id = row["id"] if row else 0

    if anomaly.get("severity") == "critical":
        emails = auth_service.get_all_alert_emails()
        if emails:
            print(f"📢 Critical anomaly detected! Sending alert emails to: {', '.join(emails)}")
        for email in emails:
            try:
                send_critical_anomaly_email(email, anomaly)
            except Exception as e:
                print(f"Error sending alert email to {email}: {e}")

    return anomaly_id


def _check_duplicate(cur, namespace: str, resource_name: str, category: str) -> bool:
    """Check if an unresolved anomaly already exists for this resource and category (reuses cursor)."""
    cur.execute(
        """
        SELECT COUNT(*) AS cnt FROM cluster_anomalies
        WHERE namespace = %s AND resource_name = %s AND category = %s
        AND resolved = FALSE
        """,
        (namespace, resource_name, category),
    )
    row = cur.fetchone()
    return (row["cnt"] if row else 0) > 0


# ── Pod log fetcher ──────────────────────────────────────────────────────────

def _fetch_pod_logs(namespace: str, pod_name: str, tail_lines: int = 20) -> str:
    """Fetch the last N lines of logs from a pod."""
    try:
        logs = core_v1_client.read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            tail_lines=tail_lines,
            _request_timeout=2,  # 2s timeout to avoid hanging
        )
        return logs or ""
    except ApiException:
        return "(Unable to fetch logs)"
    except Exception:
        return "(Log fetch error)"


# ── Main scan logic ──────────────────────────────────────────────────────────

# Abnormal pod statuses to flag
ABNORMAL_WAITING_REASONS = {
    "CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull",
    "CreateContainerConfigError", "InvalidImageName",
    "CreateContainerError", "RunContainerError",
}

ABNORMAL_TERMINATED_REASONS = {
    "OOMKilled", "Error", "ContainerCannotRun", "DeadlineExceeded",
}

RESTART_THRESHOLD = 5


class ClusterMonitorService:
    """Scans the cluster for abnormal behaviors and persists anomalies."""

    def __init__(self):
        _ensure_anomalies_table()

    def scan_cluster(self) -> list[dict]:
        """
        Run a full cluster scan for anomalies.
        Uses a SINGLE db connection for all checks and inserts.
        Returns a list of newly detected anomaly records.
        """
        new_anomalies: list[dict] = []
        active_keys: set = set()

        try:
            namespaces = core_v1_client.list_namespace().items
        except ApiException:
            return new_anomalies

        # Use a single connection for the entire scan
        with get_pool().connection() as conn:
            conn.autocommit = False
            with conn.cursor(row_factory=dict_row) as cur:
                for ns in namespaces:
                    ns_name = ns.metadata.name

                    # Scan pods
                    new_anomalies.extend(self._scan_pods(cur, ns_name, active_keys))

                    # Scan deployments
                    new_anomalies.extend(self._scan_deployments(cur, ns_name, active_keys))

                    # Scan K8s warning events
                    new_anomalies.extend(self._scan_events(cur, ns_name, active_keys))

                # Auto-resolve anomalies that are no longer active
                cur.execute("SELECT id, namespace, resource_name, category FROM cluster_anomalies WHERE resolved = FALSE")
                unresolved_rows = cur.fetchall()
                
                for row in unresolved_rows:
                    anomaly_key = (row["namespace"], row["resource_name"], row["category"])
                    if anomaly_key not in active_keys:
                        cur.execute("UPDATE cluster_anomalies SET resolved = TRUE WHERE id = %s", (row["id"],))

                conn.commit()

        return new_anomalies

    def _scan_pods(self, cur, namespace: str, active_keys: set) -> list[dict]:
        """Detect pod-level anomalies."""
        anomalies = []
        try:
            pods = core_v1_client.list_namespaced_pod(namespace).items
        except ApiException:
            return anomalies

        now = datetime.now(timezone.utc).isoformat()

        for pod in pods:
            pod_name = pod.metadata.name
            node_name = pod.spec.node_name or ""

            # Check container statuses
            for cs in pod.status.container_statuses or []:
                # ── Waiting state anomalies ──────────────────────────────
                if cs.state and cs.state.waiting and cs.state.waiting.reason in ABNORMAL_WAITING_REASONS:
                    reason = cs.state.waiting.reason
                    active_keys.add((namespace, pod_name, reason))
                    if not _check_duplicate(cur, namespace, pod_name, reason):
                        logs = _fetch_pod_logs(namespace, pod_name)
                        anomaly = {
                            "timestamp": now,
                            "severity": "critical" if reason == "CrashLoopBackOff" else "warning",
                            "category": reason,
                            "namespace": namespace,
                            "resource_type": "pod",
                            "resource_name": pod_name,
                            "message": f"Pod {pod_name} is in {reason} state",
                            "details": cs.state.waiting.message or "",
                            "logs": logs,
                            "node_name": node_name,
                        }
                        _save_anomaly(cur, anomaly)
                        anomalies.append(anomaly)

                # ── Terminated state anomalies ───────────────────────────
                if cs.state and cs.state.terminated and cs.state.terminated.reason in ABNORMAL_TERMINATED_REASONS:
                    reason = cs.state.terminated.reason
                    active_keys.add((namespace, pod_name, reason))
                    if not _check_duplicate(cur, namespace, pod_name, reason):
                        logs = _fetch_pod_logs(namespace, pod_name)
                        anomaly = {
                            "timestamp": now,
                            "severity": "critical" if reason == "OOMKilled" else "error",
                            "category": reason,
                            "namespace": namespace,
                            "resource_type": "pod",
                            "resource_name": pod_name,
                            "message": f"Pod {pod_name} terminated: {reason}",
                            "details": f"Exit code: {cs.state.terminated.exit_code}" if cs.state.terminated.exit_code else "",
                            "logs": logs,
                            "node_name": node_name,
                        }
                        _save_anomaly(cur, anomaly)
                        anomalies.append(anomaly)

                # ── High restart count ───────────────────────────────────
                if cs.restart_count >= RESTART_THRESHOLD:
                    active_keys.add((namespace, pod_name, "HighRestarts"))
                    if not _check_duplicate(cur, namespace, pod_name, "HighRestarts"):
                        logs = _fetch_pod_logs(namespace, pod_name)
                        anomaly = {
                            "timestamp": now,
                            "severity": "warning",
                            "category": "HighRestarts",
                            "namespace": namespace,
                            "resource_type": "pod",
                            "resource_name": pod_name,
                            "message": f"Pod {pod_name} has restarted {cs.restart_count} times",
                            "details": f"Container: {cs.name}, Restarts: {cs.restart_count}",
                            "logs": logs,
                            "node_name": node_name,
                        }
                        _save_anomaly(cur, anomaly)
                        anomalies.append(anomaly)

            # ── Pod in Pending/Unknown phase ─────────────────────────────
            if pod.status.phase in ("Pending", "Unknown"):
                category = f"Pod{pod.status.phase}"
                active_keys.add((namespace, pod_name, category))
                if not _check_duplicate(cur, namespace, pod_name, category):
                    anomaly = {
                        "timestamp": now,
                        "severity": "warning",
                        "category": f"Pod{pod.status.phase}",
                        "namespace": namespace,
                        "resource_type": "pod",
                        "resource_name": pod_name,
                        "message": f"Pod {pod_name} is stuck in {pod.status.phase} phase",
                        "details": pod.status.reason or "",
                        "logs": "",
                        "node_name": node_name,
                    }
                    _save_anomaly(cur, anomaly)
                    anomalies.append(anomaly)

        return anomalies

    def _scan_deployments(self, cur, namespace: str, active_keys: set) -> list[dict]:
        """Detect deployment-level anomalies."""
        anomalies = []
        try:
            deployments = apps_v1_client.list_namespaced_deployment(namespace).items
        except ApiException:
            return anomalies

        now = datetime.now(timezone.utc).isoformat()

        for dep in deployments:
            dep_name = dep.metadata.name
            desired = dep.spec.replicas or 0
            available = dep.status.available_replicas or 0

            if desired > 0 and available == 0:
                active_keys.add((namespace, dep_name, "DeploymentUnavailable"))
                if not _check_duplicate(cur, namespace, dep_name, "DeploymentUnavailable"):
                    anomaly = {
                        "timestamp": now,
                        "severity": "critical",
                        "category": "DeploymentUnavailable",
                        "namespace": namespace,
                        "resource_type": "deployment",
                        "resource_name": dep_name,
                        "message": f"Deployment {dep_name} has 0/{desired} available replicas",
                        "details": f"Desired: {desired}, Ready: {dep.status.ready_replicas or 0}, Available: {available}",
                        "logs": "",
                        "node_name": "",
                    }
                    _save_anomaly(cur, anomaly)
                    anomalies.append(anomaly)
            elif desired > 0 and available < desired:
                active_keys.add((namespace, dep_name, "DeploymentDegraded"))
                if not _check_duplicate(cur, namespace, dep_name, "DeploymentDegraded"):
                    anomaly = {
                        "timestamp": now,
                        "severity": "warning",
                        "category": "DeploymentDegraded",
                        "namespace": namespace,
                        "resource_type": "deployment",
                        "resource_name": dep_name,
                        "message": f"Deployment {dep_name} degraded: {available}/{desired} replicas available",
                        "details": f"Desired: {desired}, Ready: {dep.status.ready_replicas or 0}, Available: {available}",
                        "logs": "",
                        "node_name": "",
                    }
                    _save_anomaly(cur, anomaly)
                    anomalies.append(anomaly)

        return anomalies

    def _scan_events(self, cur, namespace: str, active_keys: set) -> list[dict]:
        """Detect abnormal K8s warning events."""
        anomalies = []
        try:
            events = core_v1_client.list_namespaced_event(namespace).items
        except ApiException:
            return anomalies

        now = datetime.now(timezone.utc).isoformat()

        significant_reasons = {
            "FailedScheduling", "FailedMount", "FailedAttachVolume",
            "Unhealthy", "BackOff", "Failed", "FailedCreate",
            "EvictionThresholdMet", "NodeNotReady", "Killing",
            "FailedPulling",
        }

        for event in events:
            if event.type != "Warning":
                continue

            # Skip events that are older than 2 minutes so they don't artificially keep anomalies active
            event_time = event.last_timestamp or event.event_time or event.metadata.creation_timestamp
            if event_time and (datetime.now(timezone.utc) - event_time).total_seconds() > 120:
                continue

            resource_name = event.involved_object.name or "unknown"
            resource_type = (event.involved_object.kind or "unknown").lower()
            reason = event.reason or "Unknown"
            message = event.message or ""

            if reason in significant_reasons:
                category = f"Event:{reason}"
                active_keys.add((namespace, resource_name, category))
                if not _check_duplicate(cur, namespace, resource_name, category):
                    anomaly = {
                        "timestamp": now,
                        "severity": "warning",
                        "category": f"Event:{reason}",
                        "namespace": namespace,
                        "resource_type": resource_type,
                        "resource_name": resource_name,
                        "message": f"[{reason}] {message[:200]}",
                        "details": f"Count: {event.count or 1}, Source: {event.source.component if event.source else 'unknown'}",
                        "logs": "",
                        "node_name": "",
                    }
                    _save_anomaly(cur, anomaly)
                    anomalies.append(anomaly)

        return anomalies

    # ── Query methods ────────────────────────────────────────────────────────

    def get_anomalies(
        self,
        namespace: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        """Retrieve anomaly records, newest first. Excludes full logs for speed."""
        with get_pool().connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Select everything except logs for the list view (much faster)
                query = """SELECT id, timestamp, severity, category, namespace,
                           resource_type, resource_name, message, details,
                           '' AS logs, node_name, resolved
                           FROM cluster_anomalies WHERE 1=1"""
                params: list = []

                if namespace:
                    query += " AND namespace = %s"
                    params.append(namespace)

                if severity == "resolved":
                    query += " AND resolved = TRUE"
                elif severity:
                    query += " AND severity = %s AND resolved = FALSE"
                    params.append(severity)
                else:
                    query += " AND resolved = FALSE"

                query += " ORDER BY id DESC LIMIT %s"
                params.append(limit)

                cur.execute(query, params)
                rows = cur.fetchall()
                return [dict(r) for r in rows]

    def get_anomaly_by_id(self, anomaly_id: int) -> Optional[dict]:
        """Retrieve a single anomaly by ID, including full logs."""
        with get_pool().connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT * FROM cluster_anomalies WHERE id = %s", (anomaly_id,))
                row = cur.fetchone()
                return dict(row) if row else None

    def resolve_anomaly(self, anomaly_id: int) -> bool:
        """Mark an anomaly as resolved."""
        with get_pool().connection() as conn:
            conn.autocommit = False
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE cluster_anomalies SET resolved = TRUE WHERE id = %s",
                    (anomaly_id,),
                )
                conn.commit()
                return cur.rowcount > 0

    def clear_resolved(self) -> int:
        """Delete all resolved anomalies. Returns count deleted."""
        with get_pool().connection() as conn:
            conn.autocommit = False
            with conn.cursor() as cur:
                cur.execute("DELETE FROM cluster_anomalies WHERE resolved = TRUE")
                conn.commit()
                return cur.rowcount

    def get_anomaly_stats(self) -> dict:
        """Get counts by severity and category."""
        with get_pool().connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("""
                    SELECT 
                        COUNT(*) FILTER (WHERE severity = 'critical' AND NOT resolved) AS critical,
                        COUNT(*) FILTER (WHERE severity = 'error' AND NOT resolved) AS errors,
                        COUNT(*) FILTER (WHERE severity = 'warning' AND NOT resolved) AS warnings,
                        COUNT(*) FILTER (WHERE resolved) AS resolved,
                        COUNT(*) AS total
                    FROM cluster_anomalies
                """)
                row = cur.fetchone()
                return dict(row) if row else {
                    "critical": 0, "errors": 0, "warnings": 0, "resolved": 0, "total": 0
                }


# Module-level singleton
cluster_monitor_service = ClusterMonitorService()
