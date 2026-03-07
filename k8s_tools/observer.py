"""
Observer layer — read-only Kubernetes operations.

Every function returns a plain-text summary suitable for LLM consumption.
All K8s API calls are wrapped in try-except for graceful error handling.
"""

from kubernetes.client.rest import ApiException
from k8s_tools.client import core_v1_client, apps_v1_client


def list_resources(namespace: str, resource_type: str) -> str:
    """
    List Kubernetes resources of a given type in a namespace.

    Supported resource_types: pods, deployments, services, events,
    configmaps, secrets, replicasets, daemonsets, statefulsets,
    namespaces (namespace param is ignored for this type).

    Returns a formatted table string.
    """
    resource_type = resource_type.lower().strip()

    try:
        if resource_type == "pods":
            items = core_v1_client.list_namespaced_pod(namespace).items
            if not items:
                return f"No pods found in namespace '{namespace}'."
            lines = [f"{'NAME':<50} {'STATUS':<18} {'RESTARTS':<10} {'AGE'}"]
            lines.append("-" * 100)
            for pod in items:
                name = pod.metadata.name
                phase = pod.status.phase or "Unknown"
                restarts = sum(
                    cs.restart_count
                    for cs in (pod.status.container_statuses or [])
                )
                age = pod.metadata.creation_timestamp.strftime("%Y-%m-%d %H:%M:%S")
                # Check for waiting containers (e.g., ImagePullBackOff)
                for cs in pod.status.container_statuses or []:
                    if cs.state and cs.state.waiting:
                        phase = cs.state.waiting.reason or phase
                lines.append(f"{name:<50} {phase:<18} {restarts:<10} {age}")
            return "\n".join(lines)

        elif resource_type == "deployments":
            items = apps_v1_client.list_namespaced_deployment(namespace).items
            if not items:
                return f"No deployments found in namespace '{namespace}'."
            lines = [f"{'NAME':<45} {'READY':<12} {'UP-TO-DATE':<12} {'AVAILABLE':<12} {'AGE'}"]
            lines.append("-" * 110)
            for dep in items:
                name = dep.metadata.name
                ready = f"{dep.status.ready_replicas or 0}/{dep.spec.replicas or 0}"
                up_to_date = dep.status.updated_replicas or 0
                available = dep.status.available_replicas or 0
                age = dep.metadata.creation_timestamp.strftime("%Y-%m-%d %H:%M:%S")
                lines.append(f"{name:<45} {ready:<12} {up_to_date:<12} {available:<12} {age}")
            return "\n".join(lines)

        elif resource_type == "services":
            items = core_v1_client.list_namespaced_service(namespace).items
            if not items:
                return f"No services found in namespace '{namespace}'."
            lines = [f"{'NAME':<40} {'TYPE':<18} {'CLUSTER-IP':<18} {'PORTS'}"]
            lines.append("-" * 100)
            for svc in items:
                name = svc.metadata.name
                svc_type = svc.spec.type
                cluster_ip = svc.spec.cluster_ip or "None"
                ports = ", ".join(
                    f"{p.port}/{p.protocol}" for p in (svc.spec.ports or [])
                )
                lines.append(f"{name:<40} {svc_type:<18} {cluster_ip:<18} {ports}")
            return "\n".join(lines)

        elif resource_type == "events":
            items = core_v1_client.list_namespaced_event(namespace).items
            if not items:
                return f"No events found in namespace '{namespace}'."
            # Show last 30 events, most recent first
            items.sort(
                key=lambda e: e.last_timestamp or e.metadata.creation_timestamp,
                reverse=True,
            )
            lines = [f"{'TYPE':<10} {'REASON':<25} {'OBJECT':<45} {'MESSAGE'}"]
            lines.append("-" * 130)
            for ev in items[:30]:
                ev_type = ev.type or "Normal"
                reason = ev.reason or ""
                obj = f"{ev.involved_object.kind}/{ev.involved_object.name}"
                message = (ev.message or "")[:100]
                lines.append(f"{ev_type:<10} {reason:<25} {obj:<45} {message}")
            return "\n".join(lines)

        elif resource_type == "configmaps":
            items = core_v1_client.list_namespaced_config_map(namespace).items
            if not items:
                return f"No configmaps found in namespace '{namespace}'."
            lines = [f"{'NAME':<50} {'DATA KEYS':<40} {'AGE'}"]
            lines.append("-" * 110)
            for cm in items:
                name = cm.metadata.name
                keys = ", ".join(cm.data.keys()) if cm.data else "(empty)"
                age = cm.metadata.creation_timestamp.strftime("%Y-%m-%d %H:%M:%S")
                lines.append(f"{name:<50} {keys:<40} {age}")
            return "\n".join(lines)

        elif resource_type == "secrets":
            items = core_v1_client.list_namespaced_secret(namespace).items
            if not items:
                return f"No secrets found in namespace '{namespace}'."
            lines = [f"{'NAME':<50} {'TYPE':<35} {'AGE'}"]
            lines.append("-" * 110)
            for sec in items:
                name = sec.metadata.name
                sec_type = sec.type or "Opaque"
                age = sec.metadata.creation_timestamp.strftime("%Y-%m-%d %H:%M:%S")
                lines.append(f"{name:<50} {sec_type:<35} {age}")
            return "\n".join(lines)

        elif resource_type == "replicasets":
            items = apps_v1_client.list_namespaced_replica_set(namespace).items
            if not items:
                return f"No replicasets found in namespace '{namespace}'."
            lines = [f"{'NAME':<55} {'DESIRED':<10} {'CURRENT':<10} {'READY':<10} {'AGE'}"]
            lines.append("-" * 110)
            for rs in items:
                name = rs.metadata.name
                desired = rs.spec.replicas or 0
                current = rs.status.replicas or 0
                ready = rs.status.ready_replicas or 0
                age = rs.metadata.creation_timestamp.strftime("%Y-%m-%d %H:%M:%S")
                lines.append(f"{name:<55} {desired:<10} {current:<10} {ready:<10} {age}")
            return "\n".join(lines)

        elif resource_type in ("daemonsets", "ds"):
            items = apps_v1_client.list_namespaced_daemon_set(namespace).items
            if not items:
                return f"No daemonsets found in namespace '{namespace}'."
            lines = [f"{'NAME':<50} {'DESIRED':<10} {'CURRENT':<10} {'READY':<10} {'AGE'}"]
            lines.append("-" * 110)
            for ds in items:
                name = ds.metadata.name
                desired = ds.status.desired_number_scheduled or 0
                current = ds.status.current_number_scheduled or 0
                ready = ds.status.number_ready or 0
                age = ds.metadata.creation_timestamp.strftime("%Y-%m-%d %H:%M:%S")
                lines.append(f"{name:<50} {desired:<10} {current:<10} {ready:<10} {age}")
            return "\n".join(lines)

        elif resource_type in ("statefulsets", "sts"):
            items = apps_v1_client.list_namespaced_stateful_set(namespace).items
            if not items:
                return f"No statefulsets found in namespace '{namespace}'."
            lines = [f"{'NAME':<50} {'READY':<12} {'AGE'}"]
            lines.append("-" * 80)
            for sts in items:
                name = sts.metadata.name
                ready = f"{sts.status.ready_replicas or 0}/{sts.spec.replicas or 0}"
                age = sts.metadata.creation_timestamp.strftime("%Y-%m-%d %H:%M:%S")
                lines.append(f"{name:<50} {ready:<12} {age}")
            return "\n".join(lines)

        elif resource_type == "namespaces":
            items = core_v1_client.list_namespace().items
            if not items:
                return "No namespaces found."
            lines = [f"{'NAME':<35} {'STATUS':<12} {'AGE'}"]
            lines.append("-" * 70)
            for ns in items:
                name = ns.metadata.name
                status = ns.status.phase
                age = ns.metadata.creation_timestamp.strftime("%Y-%m-%d %H:%M:%S")
                lines.append(f"{name:<35} {status:<12} {age}")
            return "\n".join(lines)

        else:
            return (
                f"Unsupported resource type: '{resource_type}'. "
                "Supported types: pods, deployments, services, events, "
                "configmaps, secrets, replicasets, daemonsets, statefulsets, namespaces."
            )

    except ApiException as e:
        return f"K8s API error ({e.status}): {e.reason} — {e.body}"
    except Exception as e:
        return f"Unexpected error listing {resource_type}: {e}"


def get_pod_logs(namespace: str, pod_name: str) -> str:
    """
    Retrieve the last 50 lines of logs from a pod.

    If the pod has multiple containers, logs from each are concatenated.
    """
    try:
        pod = core_v1_client.read_namespaced_pod(pod_name, namespace)
        containers = [c.name for c in pod.spec.containers]

        all_logs: list[str] = []
        for container in containers:
            header = f"── Container: {container} ──"
            try:
                logs = core_v1_client.read_namespaced_pod_log(
                    pod_name,
                    namespace,
                    container=container,
                    tail_lines=50,
                )
                all_logs.append(f"{header}\n{logs or '(no output)'}")
            except ApiException as e:
                all_logs.append(f"{header}\nError reading logs: {e.reason}")

        return "\n\n".join(all_logs)

    except ApiException as e:
        if e.status == 404:
            return f"Pod '{pod_name}' not found in namespace '{namespace}'."
        return f"K8s API error ({e.status}): {e.reason}"
    except Exception as e:
        return f"Unexpected error getting pod logs: {e}"


def describe_resource(namespace: str, resource_type: str, name: str) -> str:
    """
    Describe a Kubernetes resource — returns status, conditions, and events.

    Supported: pod, deployment, service, node.
    """
    resource_type = resource_type.lower().strip()

    try:
        if resource_type == "pod":
            pod = core_v1_client.read_namespaced_pod(name, namespace)
            sections = [f"Pod: {name}", f"Namespace: {namespace}"]
            sections.append(f"Status: {pod.status.phase}")
            sections.append(f"Node: {pod.spec.node_name}")
            sections.append(f"IP: {pod.status.pod_ip}")

            # Container statuses
            sections.append("\n── Container Statuses ──")
            for cs in pod.status.container_statuses or []:
                sections.append(f"  {cs.name}:")
                sections.append(f"    Ready: {cs.ready}")
                sections.append(f"    Restart count: {cs.restart_count}")
                if cs.state:
                    if cs.state.running:
                        sections.append(f"    State: Running (since {cs.state.running.started_at})")
                    elif cs.state.waiting:
                        sections.append(f"    State: Waiting — {cs.state.waiting.reason}: {cs.state.waiting.message}")
                    elif cs.state.terminated:
                        sections.append(f"    State: Terminated — {cs.state.terminated.reason} (exit {cs.state.terminated.exit_code})")

            # Conditions
            sections.append("\n── Conditions ──")
            for cond in pod.status.conditions or []:
                sections.append(f"  {cond.type}: {cond.status} ({cond.reason})")

            # Related events
            events = _get_events_for(namespace, "Pod", name)
            if events:
                sections.append("\n── Events ──")
                sections.extend(events)

            return "\n".join(sections)

        elif resource_type == "deployment":
            dep = apps_v1_client.read_namespaced_deployment(name, namespace)
            sections = [f"Deployment: {name}", f"Namespace: {namespace}"]
            sections.append(f"Replicas: {dep.status.ready_replicas or 0}/{dep.spec.replicas or 0}")
            sections.append(f"Strategy: {dep.spec.strategy.type}")

            # Conditions
            sections.append("\n── Conditions ──")
            for cond in dep.status.conditions or []:
                sections.append(f"  {cond.type}: {cond.status} — {cond.message}")

            # Container specs
            sections.append("\n── Containers ──")
            for c in dep.spec.template.spec.containers:
                sections.append(f"  {c.name}: {c.image}")
                if c.resources:
                    sections.append(f"    Requests: {c.resources.requests}")
                    sections.append(f"    Limits:   {c.resources.limits}")

            # Related events
            events = _get_events_for(namespace, "Deployment", name)
            if events:
                sections.append("\n── Events ──")
                sections.extend(events)

            return "\n".join(sections)

        elif resource_type == "service":
            svc = core_v1_client.read_namespaced_service(name, namespace)
            sections = [f"Service: {name}", f"Namespace: {namespace}"]
            sections.append(f"Type: {svc.spec.type}")
            sections.append(f"Cluster IP: {svc.spec.cluster_ip}")
            sections.append(f"Ports: {', '.join(f'{p.port}/{p.protocol}' for p in (svc.spec.ports or []))}")
            sections.append(f"Selector: {svc.spec.selector}")

            # Check endpoints
            try:
                endpoints = core_v1_client.read_namespaced_endpoints(name, namespace)
                addr_count = sum(
                    len(subset.addresses or [])
                    for subset in (endpoints.subsets or [])
                )
                sections.append(f"Endpoints: {addr_count} address(es)")
            except ApiException:
                sections.append("Endpoints: unable to retrieve")

            return "\n".join(sections)

        elif resource_type == "node":
            node = core_v1_client.read_node(name)
            sections = [f"Node: {name}"]

            # Conditions
            sections.append("\n── Conditions ──")
            for cond in node.status.conditions or []:
                sections.append(f"  {cond.type}: {cond.status} — {cond.message}")

            # Capacity
            sections.append("\n── Capacity ──")
            for key, val in (node.status.capacity or {}).items():
                sections.append(f"  {key}: {val}")

            sections.append("\n── Allocatable ──")
            for key, val in (node.status.allocatable or {}).items():
                sections.append(f"  {key}: {val}")

            return "\n".join(sections)

        else:
            return (
                f"Unsupported resource type for describe: '{resource_type}'. "
                "Supported: pod, deployment, service, node."
            )

    except ApiException as e:
        if e.status == 404:
            return f"{resource_type.title()} '{name}' not found in namespace '{namespace}'."
        if e.status == 403:
            return f"Forbidden: insufficient permissions to describe {resource_type} '{name}'."
        return f"K8s API error ({e.status}): {e.reason}"
    except Exception as e:
        return f"Unexpected error describing {resource_type}: {e}"


def _get_events_for(namespace: str, kind: str, name: str) -> list[str]:
    """Helper: retrieve events related to a specific resource."""
    try:
        field_selector = f"involvedObject.kind={kind},involvedObject.name={name}"
        events = core_v1_client.list_namespaced_event(
            namespace, field_selector=field_selector
        ).items
        events.sort(
            key=lambda e: e.last_timestamp or e.metadata.creation_timestamp,
            reverse=True,
        )
        lines = []
        for ev in events[:15]:
            ts = (ev.last_timestamp or ev.metadata.creation_timestamp).strftime("%H:%M:%S")
            lines.append(f"  [{ts}] {ev.type} {ev.reason}: {ev.message}")
        return lines
    except Exception:
        return ["  (unable to retrieve events)"]
