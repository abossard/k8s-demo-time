import yaml from 'js-yaml';

export interface K8sResource {
  filePath: string;
  kind: string;
  name: string;
  namespace?: string;
  apiVersion: string;
  raw: string;
  labels?: Record<string, string>;
  relationships: ResourceRelationship[];
}

export interface ResourceRelationship {
  type: 'targets' | 'selects' | 'owns' | 'references';
  targetKind: string;
  targetName: string;
}

export function parseK8sYaml(content: string, filePath: string): K8sResource[] {
  const resources: K8sResource[] = [];
  const documents = content.split(/^---$/m).filter(d => d.trim());

  for (const doc of documents) {
    try {
      const parsed = yaml.load(doc) as any;
      if (!parsed || !parsed.kind || !parsed.apiVersion) continue;

      const resource: K8sResource = {
        filePath,
        kind: parsed.kind,
        name: parsed.metadata?.name ?? 'unknown',
        namespace: parsed.metadata?.namespace,
        apiVersion: parsed.apiVersion,
        raw: doc.trim(),
        labels: parsed.metadata?.labels,
        relationships: [],
      };

      // Detect relationships
      resource.relationships = detectRelationships(parsed);
      resources.push(resource);
    } catch {
      // Skip unparseable documents
    }
  }

  return resources;
}

function detectRelationships(obj: any): ResourceRelationship[] {
  const rels: ResourceRelationship[] = [];
  const kind = obj.kind as string;

  // Service → Pod (via selector)
  if (kind === 'Service' && obj.spec?.selector) {
    rels.push({
      type: 'selects',
      targetKind: 'Pod',
      targetName: `selector:${JSON.stringify(obj.spec.selector)}`,
    });
  }

  // HPA → Deployment/StatefulSet
  if (kind === 'HorizontalPodAutoscaler' && obj.spec?.scaleTargetRef) {
    rels.push({
      type: 'targets',
      targetKind: obj.spec.scaleTargetRef.kind,
      targetName: obj.spec.scaleTargetRef.name,
    });
  }

  // VPA → Deployment
  if (kind === 'VerticalPodAutoscaler' && obj.spec?.targetRef) {
    rels.push({
      type: 'targets',
      targetKind: obj.spec.targetRef.kind,
      targetName: obj.spec.targetRef.name,
    });
  }

  // Deployment → Pod (owns)
  if (kind === 'Deployment' || kind === 'StatefulSet' || kind === 'DaemonSet') {
    rels.push({
      type: 'owns',
      targetKind: 'Pod',
      targetName: obj.metadata?.name ?? 'unknown',
    });
  }

  // Ingress → Service
  if (kind === 'Ingress') {
    const rules = obj.spec?.rules ?? [];
    for (const rule of rules) {
      for (const path of rule.http?.paths ?? []) {
        const svcName = path.backend?.service?.name ?? path.backend?.serviceName;
        if (svcName) {
          rels.push({ type: 'references', targetKind: 'Service', targetName: svcName });
        }
      }
    }
  }

  // NetworkPolicy → Pod
  if (kind === 'NetworkPolicy' && obj.spec?.podSelector?.matchLabels) {
    rels.push({
      type: 'selects',
      targetKind: 'Pod',
      targetName: `selector:${JSON.stringify(obj.spec.podSelector.matchLabels)}`,
    });
  }

  return rels;
}

export function generateMermaidDiagram(resources: K8sResource[]): string {
  const lines: string[] = ['graph LR'];
  const nodeIds = new Map<string, string>();

  let counter = 0;
  function getId(kind: string, name: string): string {
    const key = `${kind}/${name}`;
    if (!nodeIds.has(key)) {
      nodeIds.set(key, `n${counter++}`);
    }
    return nodeIds.get(key)!;
  }

  function getShape(kind: string): [string, string] {
    switch (kind) {
      case 'Service': return ['((', '))'];
      case 'Deployment': case 'StatefulSet': return ['[/', '/]'];
      case 'Pod': return ['([', '])'];
      case 'HorizontalPodAutoscaler': case 'VerticalPodAutoscaler': return ['{{', '}}'];
      case 'ConfigMap': case 'Secret': return ['[/', '\\]'];
      case 'Namespace': return ['[', ']'];
      default: return ['[', ']'];
    }
  }

  // Add resource nodes
  for (const r of resources) {
    const id = getId(r.kind, r.name);
    const [open, close] = getShape(r.kind);
    const label = `${r.kind}\\n${r.name}`;
    lines.push(`  ${id}${open}"${label}"${close}`);
  }

  // Add relationships
  for (const r of resources) {
    const sourceId = getId(r.kind, r.name);
    for (const rel of r.relationships) {
      const targetId = getId(rel.targetKind, rel.targetName);
      const arrow = rel.type === 'owns' ? '-->' : rel.type === 'targets' ? '-.->': '-->';
      const label = rel.type;
      lines.push(`  ${sourceId} ${arrow}|${label}| ${targetId}`);
    }
  }

  return lines.join('\n');
}
