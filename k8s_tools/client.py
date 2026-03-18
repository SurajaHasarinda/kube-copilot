from kubernetes import client, config as k8s_config
from kubernetes.client.rest import ApiException

from config.settings import KUBECONFIG_PATH


def get_k8s_clients() -> tuple[client.CoreV1Api, client.AppsV1Api]:
    """
    Initialise and return the K8s API clients.

    Tries in-cluster config first (for when the agent runs as a pod),
    then falls back to the local kubeconfig file.
    """
    try:
        k8s_config.load_incluster_config()
    except k8s_config.ConfigException:
        if KUBECONFIG_PATH:
            k8s_config.load_kube_config(config_file=KUBECONFIG_PATH)
        else:
            k8s_config.load_kube_config()

    core_v1 = client.CoreV1Api()
    apps_v1 = client.AppsV1Api()
    return core_v1, apps_v1


core_v1_client, apps_v1_client = get_k8s_clients()


__all__ = ["core_v1_client", "apps_v1_client", "ApiException"]
