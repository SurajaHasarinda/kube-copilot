from k8s_tools.client import core_v1_client, apps_v1_client, ApiException


class ClusterService:
    def get_cluster_structure(self):
        """
        Fetch the entire cluster structure including namespaces, deployments,
        pods, services, etc. Returns a hierarchical structure suitable for visualization.
        """
        structure = {
            "name": "Cluster",
            "type": "cluster",
            "children": []
        }
        
        try:
            # Get all namespaces
            namespaces = core_v1_client.list_namespace().items
            
            for ns in namespaces:
                ns_name = ns.metadata.name
                ns_node = {
                    "name": ns_name,
                    "type": "namespace",
                    "status": ns.status.phase,
                    "created_at": ns.metadata.creation_timestamp.isoformat() if ns.metadata.creation_timestamp else None,
                    "children": []
                }
                
                # Get deployments in this namespace
                try:
                    deployments = apps_v1_client.list_namespaced_deployment(ns_name).items
                    if deployments:
                        deployments_node = {
                            "name": "Deployments",
                            "type": "resource-group",
                            "count": len(deployments),
                            "children": []
                        }
                        
                        for dep in deployments:
                            dep_node = {
                                "name": dep.metadata.name,
                                "type": "deployment",
                                "replicas": f"{dep.status.ready_replicas or 0}/{dep.spec.replicas or 0}",
                                "available": dep.status.available_replicas or 0,
                                "created_at": dep.metadata.creation_timestamp.isoformat() if dep.metadata.creation_timestamp else None,
                                "children": []
                            }
                            
                            # Get pods for this deployment
                            try:
                                label_selector = f"app={dep.metadata.name}" if dep.spec.selector.match_labels.get('app') else None
                                if not label_selector and dep.spec.selector.match_labels:
                                    # Use first label as selector
                                    key, value = list(dep.spec.selector.match_labels.items())[0]
                                    label_selector = f"{key}={value}"
                                
                                if label_selector:
                                    pods = core_v1_client.list_namespaced_pod(
                                        ns_name, 
                                        label_selector=label_selector
                                    ).items
                                    
                                    for pod in pods:
                                        pod_node = {
                                            "name": pod.metadata.name,
                                            "type": "pod",
                                            "status": pod.status.phase,
                                            "ip": pod.status.pod_ip,
                                            "node": pod.spec.node_name,
                                            "restarts": sum(cs.restart_count for cs in (pod.status.container_statuses or [])),
                                            "created_at": pod.metadata.creation_timestamp.isoformat() if pod.metadata.creation_timestamp else None,
                                        }
                                        # Check for issues
                                        for cs in pod.status.container_statuses or []:
                                            if cs.state and cs.state.waiting:
                                                pod_node["status"] = cs.state.waiting.reason or pod_node["status"]
                                        
                                        dep_node["children"].append(pod_node)
                            except ApiException:
                                pass
                            
                            deployments_node["children"].append(dep_node)
                        
                        ns_node["children"].append(deployments_node)
                except ApiException:
                    pass
                
                # Get standalone pods (not managed by deployments)
                try:
                    all_pods = core_v1_client.list_namespaced_pod(ns_name).items
                    # Filter out pods that belong to deployments (have owner references)
                    standalone_pods = [
                        pod for pod in all_pods 
                        if not pod.metadata.owner_references or 
                        not any(ref.kind in ['ReplicaSet', 'StatefulSet', 'DaemonSet'] for ref in pod.metadata.owner_references)
                    ]
                    
                    if standalone_pods:
                        pods_node = {
                            "name": "Standalone Pods",
                            "type": "resource-group",
                            "count": len(standalone_pods),
                            "children": []
                        }
                        
                        for pod in standalone_pods:
                            pod_node = {
                                "name": pod.metadata.name,
                                "type": "pod",
                                "status": pod.status.phase,
                                "ip": pod.status.pod_ip,
                                "node": pod.spec.node_name,
                                "restarts": sum(cs.restart_count for cs in (pod.status.container_statuses or [])),
                                "created_at": pod.metadata.creation_timestamp.isoformat() if pod.metadata.creation_timestamp else None,
                            }
                            for cs in pod.status.container_statuses or []:
                                if cs.state and cs.state.waiting:
                                    pod_node["status"] = cs.state.waiting.reason or pod_node["status"]
                            
                            pods_node["children"].append(pod_node)
                        
                        ns_node["children"].append(pods_node)
                except ApiException:
                    pass
                
                # Get services
                try:
                    services = core_v1_client.list_namespaced_service(ns_name).items
                    if services:
                        services_node = {
                            "name": "Services",
                            "type": "resource-group",
                            "count": len(services),
                            "children": []
                        }
                        
                        for svc in services:
                            svc_node = {
                                "name": svc.metadata.name,
                                "type": "service",
                                "cluster_ip": svc.spec.cluster_ip,
                                "service_type": svc.spec.type,
                                "ports": [f"{p.port}/{p.protocol}" for p in (svc.spec.ports or [])],
                                "created_at": svc.metadata.creation_timestamp.isoformat() if svc.metadata.creation_timestamp else None,
                            }
                            services_node["children"].append(svc_node)
                        
                        ns_node["children"].append(services_node)
                except ApiException:
                    pass
                
                # Get ConfigMaps
                try:
                    configmaps = core_v1_client.list_namespaced_config_map(ns_name).items
                    if configmaps:
                        cm_node = {
                            "name": "ConfigMaps",
                            "type": "resource-group",
                            "count": len(configmaps),
                            "children": []
                        }
                        
                        for cm in configmaps:
                            cm_node["children"].append({
                                "name": cm.metadata.name,
                                "type": "configmap",
                                "data_keys": list(cm.data.keys()) if cm.data else [],
                                "created_at": cm.metadata.creation_timestamp.isoformat() if cm.metadata.creation_timestamp else None,
                            })
                        
                        ns_node["children"].append(cm_node)
                except ApiException:
                    pass
                
                # Get Secrets
                try:
                    secrets = core_v1_client.list_namespaced_secret(ns_name).items
                    if secrets:
                        secrets_node = {
                            "name": "Secrets",
                            "type": "resource-group",
                            "count": len(secrets),
                            "children": []
                        }
                        
                        for secret in secrets:
                            secrets_node["children"].append({
                                "name": secret.metadata.name,
                                "type": "secret",
                                "secret_type": secret.type,
                                "created_at": secret.metadata.creation_timestamp.isoformat() if secret.metadata.creation_timestamp else None,
                            })
                        
                        ns_node["children"].append(secrets_node)
                except ApiException:
                    pass
                
                structure["children"].append(ns_node)
                
        except ApiException as e:
            return {"error": f"Failed to fetch cluster structure: {str(e)}"}
        
        return structure


cluster_service = ClusterService()
