"""
Executor layer — write operations on the Kubernetes cluster.

Every write action returns a status string.
These functions do NOT include the human-approval gate — that is
handled at the agent/graph layer so the LLM never bypasses it.
"""

from datetime import datetime, timezone

from kubernetes.client.rest import ApiException
from k8s_tools.client import apps_v1_client


def restart_deployment(namespace: str, deployment_name: str) -> str:
    """
    Perform a rolling restart of a deployment by patching its pod template
    annotation with the current timestamp (identical to `kubectl rollout restart`).
    """
    try:
        patch_body = {
            "spec": {
                "template": {
                    "metadata": {
                        "annotations": {
                            "kubectl.kubernetes.io/restartedAt": datetime.now(
                                timezone.utc
                            ).isoformat()
                        }
                    }
                }
            }
        }
        apps_v1_client.patch_namespaced_deployment(
            name=deployment_name,
            namespace=namespace,
            body=patch_body,
        )
        return (
            f"Successfully initiated rolling restart of "
            f"deployment '{deployment_name}' in namespace '{namespace}'."
        )

    except ApiException as e:
        if e.status == 404:
            return f"Deployment '{deployment_name}' not found in namespace '{namespace}'."
        if e.status == 403:
            return f"Forbidden: insufficient permissions to restart deployment '{deployment_name}'."
        return f"K8s API error ({e.status}): {e.reason}"
    except Exception as e:
        return f"Unexpected error restarting deployment: {e}"


def scale_deployment(namespace: str, deployment_name: str, replicas: int) -> str:
    """
    Scale a deployment to a target replica count.
    """
    try:
        patch_body = {"spec": {"replicas": replicas}}
        apps_v1_client.patch_namespaced_deployment(
            name=deployment_name,
            namespace=namespace,
            body=patch_body,
        )
        return (
            f"Successfully scaled deployment '{deployment_name}' "
            f"in namespace '{namespace}' to {replicas} replica(s)."
        )

    except ApiException as e:
        if e.status == 404:
            return f"Deployment '{deployment_name}' not found in namespace '{namespace}'."
        if e.status == 403:
            return f"Forbidden: insufficient permissions to scale deployment '{deployment_name}'."
        return f"K8s API error ({e.status}): {e.reason}"
    except Exception as e:
        return f"Unexpected error scaling deployment: {e}"
