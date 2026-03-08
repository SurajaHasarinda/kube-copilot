import { api } from '../api';

export interface MentionItem {
    type: string;
    name: string;
    namespace?: string;
    text: string;
}

// In-memory caching variables
let clusterStructureCache: MentionItem[] | null = null;
let structureFetchPromise: Promise<MentionItem[]> | null = null;
let lastStructureTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute TTL for cluster structure

/**
 * Flattens the hierarchical API cluster structure into a flat array of mentionable items
 */
const flattenClusterStructure = (node: any, currentNamespace = ''): MentionItem[] => {
    const items: MentionItem[] = [];
    let ns = currentNamespace;

    if (node.type === 'namespace') {
        ns = node.name;
        items.push({ type: node.type, name: node.name, text: `@namespace/${node.name}` });
    } else if (node.type !== 'cluster' && node.type !== 'resource-group') {
        items.push({ type: node.type, name: node.name, namespace: ns, text: `@${node.type}/${node.name}` });
    }

    if (node.children) {
        for (const child of node.children) {
            items.push(...flattenClusterStructure(child, ns));
        }
    }
    return items;
};

/**
 * Fetches cluster structure. Uses memory cache to avoid thrashing the Kubernetes API.
 */
export const fetchClusterStructureMentions = async (forceRefresh = false): Promise<MentionItem[]> => {
    const now = Date.now();

    // Return cache if it is valid
    if (!forceRefresh && clusterStructureCache && (now - lastStructureTime < CACHE_TTL_MS)) {
        return clusterStructureCache;
    }

    // Return the ongoing promise if we are already fetching it
    if (structureFetchPromise && !forceRefresh) {
        return structureFetchPromise;
    }

    // Otherwise, spawn a new fetch request
    structureFetchPromise = api.getClusterStructure().then(res => {
        if (!res.error) {
            const items = flattenClusterStructure(res);
            clusterStructureCache = items;
            lastStructureTime = Date.now();
            return items;
        }
        return clusterStructureCache || [];
    }).catch(err => {
        console.error('Failed to fetch structure mentions context', err);
        return clusterStructureCache || [];
    }).finally(() => {
        structureFetchPromise = null;
    });

    return structureFetchPromise;
};

/**
 * Fetches fresh anomalies from the database
 */
export const fetchAnomalyMentions = async (): Promise<MentionItem[]> => {
    try {
        const res = await api.getAnomalies(undefined, undefined, 50);
        if (res && res.anomalies) {
            return res.anomalies.map((a: any) => ({
                type: 'anomaly',
                name: `[${a.severity.toUpperCase()}] ${a.resource_name} - ${a.category}`,
                namespace: a.namespace,
                text: `@anomaly/${a.id}`
            }));
        }
    } catch (err) {
        console.error('Failed to fetch anomalies context', err);
    }
    return [];
};
