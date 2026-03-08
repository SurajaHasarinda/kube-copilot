"""
LangChain tool wrappers around the K8s observer and executor functions.

Read-only tools are available to the LLM at all times.
Write tools are also available, but the graph enforces a human-approval
gate before their results are committed.
"""

from langchain_core.tools import tool

from k8s_tools.observer import (
    list_resources as _list_resources,
    get_pod_logs as _get_pod_logs,
    describe_resource as _describe_resource,
)
from k8s_tools.executor import (
    restart_deployment as _restart_deployment,
    scale_deployment as _scale_deployment,
)
import json
from services.cluster_monitor_service import ClusterMonitorService

cluster_monitor = ClusterMonitorService()


# ── Read-Only Tools ──────────────────────────────────────────────────────────


@tool
def list_resources(namespace: str, resource_type: str) -> str:
    """
    List Kubernetes resources in a namespace.

    Args:
        namespace: The Kubernetes namespace to query.
        resource_type: One of: pods, deployments, services, events,
            configmaps, secrets, replicasets, daemonsets, statefulsets, namespaces.

    Returns:
        A formatted table of resources.
    """
    return _list_resources(namespace, resource_type)


@tool
def get_pod_logs(namespace: str, pod_name: str) -> str:
    """
    Get the last 50 lines of logs from a pod.

    Args:
        namespace: The Kubernetes namespace.
        pod_name: Exact name of the pod.

    Returns:
        The log output from all containers in the pod.
    """
    return _get_pod_logs(namespace, pod_name)


@tool
def describe_resource(namespace: str, resource_type: str, name: str) -> str:
    """
    Describe a Kubernetes resource with its status, conditions, and events.

    Args:
        namespace: The Kubernetes namespace.
        resource_type: One of: pod, deployment, service, node.
        name: Exact name of the resource.

    Returns:
        A detailed description including conditions and recent events.
    """
    return _describe_resource(namespace, resource_type, name)


# ── Write Tools (require human approval) ─────────────────────────────────────

@tool
def get_cluster_anomaly(anomaly_id: int) -> str:
    """
    Retrieve full details and logs for a specific cluster anomaly.

    Args:
        anomaly_id: The numeric ID of the anomaly (e.g. from an @anomaly/X mention).

    Returns:
        JSON string containing the anomaly details and associated pod logs, or an error message.
    """
    anomaly = cluster_monitor.get_anomaly_by_id(anomaly_id)
    if not anomaly:
        return f"Anomaly ID {anomaly_id} not found."
    return json.dumps(anomaly, default=str)


WRITE_TOOL_NAMES = {"restart_deployment", "scale_deployment"}


@tool
def restart_deployment(namespace: str, deployment_name: str) -> str:
    """
    Perform a rolling restart of a deployment. ⚠️ This is a WRITE action that
    modifies the cluster. The system will ask for human approval before executing.

    Args:
        namespace: The Kubernetes namespace.
        deployment_name: Name of the deployment to restart.

    Returns:
        Confirmation message or error.
    """
    return _restart_deployment(namespace, deployment_name)


@tool
def scale_deployment(
    namespace: str, deployment_name: str, replicas: int
) -> str:
    """
    Scale a deployment to a target number of replicas. ⚠️ This is a WRITE action
    that modifies the cluster. The system will ask for human approval before executing.

    Args:
        namespace: The Kubernetes namespace.
        deployment_name: Name of the deployment to scale.
        replicas: Target replica count.

    Returns:
        Confirmation message or error.
    """
    return _scale_deployment(namespace, deployment_name, replicas)


# All tools that the LLM can call
ALL_TOOLS = [list_resources, get_pod_logs, describe_resource, get_cluster_anomaly, restart_deployment, scale_deployment]
