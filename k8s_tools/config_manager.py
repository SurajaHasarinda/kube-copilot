import json
import yaml

from kubernetes.client.rest import ApiException
from k8s_tools.client import core_v1_client, apps_v1_client

_TIMEOUT = 10

# ── Supported resource types and their API mappings ──────────────────────────

_READ_MAP = {
    "pod":          lambda ns, name: core_v1_client.read_namespaced_pod(name, ns, _request_timeout=_TIMEOUT),
    "deployment":   lambda ns, name: apps_v1_client.read_namespaced_deployment(name, ns, _request_timeout=_TIMEOUT),
    "service":      lambda ns, name: core_v1_client.read_namespaced_service(name, ns, _request_timeout=_TIMEOUT),
    "configmap":    lambda ns, name: core_v1_client.read_namespaced_config_map(name, ns, _request_timeout=_TIMEOUT),
    "secret":       lambda ns, name: core_v1_client.read_namespaced_secret(name, ns, _request_timeout=_TIMEOUT),
    "replicaset":   lambda ns, name: apps_v1_client.read_namespaced_replica_set(name, ns, _request_timeout=_TIMEOUT),
    "daemonset":    lambda ns, name: apps_v1_client.read_namespaced_daemon_set(name, ns, _request_timeout=_TIMEOUT),
    "statefulset":  lambda ns, name: apps_v1_client.read_namespaced_stateful_set(name, ns, _request_timeout=_TIMEOUT),
    "namespace":    lambda ns, name: core_v1_client.read_namespace(name, _request_timeout=_TIMEOUT),
}

_PATCH_MAP = {
    "deployment":   lambda ns, name, body: apps_v1_client.patch_namespaced_deployment(name, ns, body, _request_timeout=_TIMEOUT),
    "service":      lambda ns, name, body: core_v1_client.patch_namespaced_service(name, ns, body, _request_timeout=_TIMEOUT),
    "configmap":    lambda ns, name, body: core_v1_client.patch_namespaced_config_map(name, ns, body, _request_timeout=_TIMEOUT),
    "secret":       lambda ns, name, body: core_v1_client.patch_namespaced_secret(name, ns, body, _request_timeout=_TIMEOUT),
    "daemonset":    lambda ns, name, body: apps_v1_client.patch_namespaced_daemon_set(name, ns, body, _request_timeout=_TIMEOUT),
    "statefulset":  lambda ns, name, body: apps_v1_client.patch_namespaced_stateful_set(name, ns, body, _request_timeout=_TIMEOUT),
}

_SUPPORTED_READ_TYPES = sorted(_READ_MAP.keys())
_SUPPORTED_EDIT_TYPES = sorted(_PATCH_MAP.keys())


def _resource_to_yaml(resource_obj) -> str:
    """
    Convert a Kubernetes API resource object to a clean YAML string.

    Strips managed fields and other noisy metadata to keep output readable.
    """
    raw = resource_obj.to_dict()

    # Remove noisy metadata fields for readability
    metadata = raw.get("metadata", {})
    for noisy_key in ("managed_fields", "self_link", "resource_version",
                       "uid", "generation", "creation_timestamp"):
        metadata.pop(noisy_key, None)

    # Remove None values recursively for cleaner YAML
    def _strip_nones(obj):
        if isinstance(obj, dict):
            return {k: _strip_nones(v) for k, v in obj.items() if v is not None}
        if isinstance(obj, list):
            return [_strip_nones(item) for item in obj]
        return obj

    cleaned = _strip_nones(raw)
    return yaml.dump(cleaned, default_flow_style=False, sort_keys=False)


# ── Public functions ─────────────────────────────────────────────────────────


def read_resource_yaml(namespace: str, resource_type: str, name: str) -> str:
    """
    Read the full YAML configuration of a Kubernetes resource.

    Args:
        namespace: The Kubernetes namespace (ignored for cluster-scoped resources
                   like 'namespace').
        resource_type: One of: pod, deployment, service, configmap, secret,
                       replicaset, daemonset, statefulset, namespace.
        name: Exact name of the resource.

    Returns:
        The resource configuration as a YAML string.
    """
    resource_type = resource_type.lower().strip()

    if resource_type not in _READ_MAP:
        return (
            f"Unsupported resource type: '{resource_type}'. "
            f"Supported types for reading: {', '.join(_SUPPORTED_READ_TYPES)}."
        )

    try:
        reader = _READ_MAP[resource_type]
        resource_obj = reader(namespace, name)
        yaml_output = _resource_to_yaml(resource_obj)
        return f"# {resource_type.title()}: {name}  (namespace: {namespace})\n---\n{yaml_output}"

    except ApiException as e:
        if e.status == 404:
            return f"{resource_type.title()} '{name}' not found in namespace '{namespace}'."
        if e.status == 403:
            return f"Forbidden: insufficient permissions to read {resource_type} '{name}'."
        return f"K8s API error ({e.status}): {e.reason}"
    except Exception as e:
        return f"Unexpected error reading {resource_type} config: {e}"


def edit_resource_yaml(
    namespace: str,
    resource_type: str,
    name: str,
    patch_yaml: str,
) -> str:
    """
    Edit a Kubernetes resource by applying a YAML patch (strategic-merge).

    The patch_yaml should be a valid YAML string containing ONLY the fields
    you want to change.  For example, to update a ConfigMap's data:

        data:
          MY_KEY: "new-value"

    Or to update a Deployment's replica count:

        spec:
          replicas: 3

    Args:
        namespace: The Kubernetes namespace.
        resource_type: One of: deployment, service, configmap, secret,
                       daemonset, statefulset.
        name: Exact name of the resource.
        patch_yaml: A YAML string with the fields to patch.

    Returns:
        Confirmation message or error.
    """
    resource_type = resource_type.lower().strip()

    if resource_type not in _PATCH_MAP:
        return (
            f"Unsupported resource type for editing: '{resource_type}'. "
            f"Supported types: {', '.join(_SUPPORTED_EDIT_TYPES)}."
        )

    # Parse the YAML patch
    try:
        patch_body = yaml.safe_load(patch_yaml)
    except yaml.YAMLError as e:
        return f"Invalid YAML in patch: {e}"

    if not isinstance(patch_body, dict):
        return "Patch must be a YAML mapping (dict), not a scalar or list."

    try:
        patcher = _PATCH_MAP[resource_type]
        patcher(namespace, name, patch_body)
        return (
            f"Successfully patched {resource_type} '{name}' "
            f"in namespace '{namespace}'.\n"
            f"Applied patch:\n```yaml\n{patch_yaml.strip()}\n```"
        )

    except ApiException as e:
        if e.status == 404:
            return f"{resource_type.title()} '{name}' not found in namespace '{namespace}'."
        if e.status == 403:
            return f"Forbidden: insufficient permissions to edit {resource_type} '{name}'."
        if e.status == 422:
            return f"Unprocessable patch for {resource_type} '{name}': {e.body}"
        return f"K8s API error ({e.status}): {e.reason}"
    except Exception as e:
        return f"Unexpected error editing {resource_type}: {e}"
