"""
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
from k8s_tools.config_manager import (
    read_resource_yaml as _read_resource_yaml,
    edit_resource_yaml as _edit_resource_yaml,
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


@tool
def read_resource_yaml(namespace: str, resource_type: str, name: str) -> str:
    """
    Read the full YAML configuration of a Kubernetes resource.

    Use this tool when you need to inspect the actual spec/config of a resource,
    such as container images, environment variables, resource limits, ConfigMap
    data, etc.

    Args:
        namespace: The Kubernetes namespace (ignored for cluster-scoped
            resources like 'namespace').
        resource_type: One of: pod, deployment, service, configmap, secret,
            replicaset, daemonset, statefulset, namespace.
        name: Exact name of the resource.

    Returns:
        The resource configuration as a YAML string.
    """
    return _read_resource_yaml(namespace, resource_type, name)


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


@tool
def edit_resource_yaml(
    namespace: str, resource_type: str, name: str, patch_yaml: str
) -> str:
    """
    Edit a Kubernetes resource by applying a YAML patch. ⚠️ This is a WRITE
    action that modifies the cluster. The system will ask for human approval
    before executing.

    The patch_yaml should contain ONLY the fields you want to change.
    For example, to update a ConfigMap's data:

        data:
          MY_KEY: "new-value"

    Or to change a Deployment's image:

        spec:
          template:
            spec:
              containers:
              - name: my-container
                image: my-image:v2

    Args:
        namespace: The Kubernetes namespace.
        resource_type: One of: deployment, service, configmap, secret,
            daemonset, statefulset.
        name: Exact name of the resource.
        patch_yaml: A YAML string with the fields to patch.

    Returns:
        Confirmation message or error.
    """
    return _edit_resource_yaml(namespace, resource_type, name, patch_yaml)


WRITE_TOOL_NAMES = {"restart_deployment", "scale_deployment", "edit_resource_yaml"}


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
ALL_TOOLS = [
    list_resources, get_pod_logs, describe_resource, read_resource_yaml,
    get_cluster_anomaly, restart_deployment, scale_deployment, edit_resource_yaml,
]
