import { execSync } from 'child_process';

export interface ClusterState {
  nodes: ClusterNode[];
  pods: ClusterPod[];
  services: ClusterService[];
  deployments: ClusterDeployment[];
  fetchedAt: string;
  error?: string;
}

export interface ClusterNode {
  name: string;
  status: string;
  roles: string[];
  cpu: { capacity: string; allocatable: string };
  memory: { capacity: string; allocatable: string };
  conditions: { type: string; status: string }[];
}

export interface ClusterPod {
  name: string;
  namespace: string;
  nodeName: string;
  status: string;
  phase: string;
  containers: {
    name: string;
    image: string;
    ready: boolean;
    restartCount: number;
    state: string;
  }[];
  labels: Record<string, string>;
  createdAt: string;
}

export interface ClusterService {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: { port: number; targetPort: number | string; protocol: string }[];
  selector: Record<string, string>;
}

export interface ClusterDeployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  selector: Record<string, string>;
}

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 30_000, maxBuffer: 10 * 1024 * 1024 });
  } catch {
    return '';
  }
}

function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export async function fetchClusterState(namespace?: string): Promise<ClusterState> {
  const nsFlag = namespace ? `-n ${namespace}` : '-A';

  const [nodesJson, podsJson, servicesJson, deploymentsJson] = await Promise.all([
    Promise.resolve(safeExec('kubectl get nodes -o json')),
    Promise.resolve(safeExec(`kubectl get pods ${nsFlag} -o json`)),
    Promise.resolve(safeExec(`kubectl get services ${nsFlag} -o json`)),
    Promise.resolve(safeExec(`kubectl get deployments ${nsFlag} -o json`)),
  ]);

  const nodesData = safeJsonParse<any>(nodesJson);
  const podsData = safeJsonParse<any>(podsJson);
  const servicesData = safeJsonParse<any>(servicesJson);
  const deploymentsData = safeJsonParse<any>(deploymentsJson);

  const nodes: ClusterNode[] = (nodesData?.items ?? []).map((n: any) => ({
    name: n.metadata?.name ?? '',
    status: n.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
    roles: Object.keys(n.metadata?.labels ?? {})
      .filter(k => k.startsWith('node-role.kubernetes.io/'))
      .map(k => k.replace('node-role.kubernetes.io/', '')),
    cpu: {
      capacity: n.status?.capacity?.cpu ?? '0',
      allocatable: n.status?.allocatable?.cpu ?? '0',
    },
    memory: {
      capacity: n.status?.capacity?.memory ?? '0',
      allocatable: n.status?.allocatable?.memory ?? '0',
    },
    conditions: (n.status?.conditions ?? []).map((c: any) => ({
      type: c.type,
      status: c.status,
    })),
  }));

  const pods: ClusterPod[] = (podsData?.items ?? []).map((p: any) => ({
    name: p.metadata?.name ?? '',
    namespace: p.metadata?.namespace ?? '',
    nodeName: p.spec?.nodeName ?? '',
    status: p.status?.containerStatuses?.[0]?.state
      ? Object.keys(p.status.containerStatuses[0].state)[0] ?? 'unknown'
      : p.status?.phase ?? 'unknown',
    phase: p.status?.phase ?? 'Unknown',
    containers: (p.spec?.containers ?? []).map((c: any, idx: number) => ({
      name: c.name,
      image: c.image,
      ready: p.status?.containerStatuses?.[idx]?.ready ?? false,
      restartCount: p.status?.containerStatuses?.[idx]?.restartCount ?? 0,
      state: p.status?.containerStatuses?.[idx]?.state
        ? Object.keys(p.status.containerStatuses[idx].state)[0] ?? 'unknown'
        : 'unknown',
    })),
    labels: p.metadata?.labels ?? {},
    createdAt: p.metadata?.creationTimestamp ?? '',
  }));

  const services: ClusterService[] = (servicesData?.items ?? []).map((s: any) => ({
    name: s.metadata?.name ?? '',
    namespace: s.metadata?.namespace ?? '',
    type: s.spec?.type ?? 'ClusterIP',
    clusterIP: s.spec?.clusterIP ?? '',
    ports: (s.spec?.ports ?? []).map((p: any) => ({
      port: p.port,
      targetPort: p.targetPort,
      protocol: p.protocol ?? 'TCP',
    })),
    selector: s.spec?.selector ?? {},
  }));

  const deployments: ClusterDeployment[] = (deploymentsData?.items ?? []).map((d: any) => ({
    name: d.metadata?.name ?? '',
    namespace: d.metadata?.namespace ?? '',
    replicas: d.spec?.replicas ?? 0,
    readyReplicas: d.status?.readyReplicas ?? 0,
    selector: d.spec?.selector?.matchLabels ?? {},
  }));

  return {
    nodes,
    pods,
    services,
    deployments,
    fetchedAt: new Date().toISOString(),
  };
}
