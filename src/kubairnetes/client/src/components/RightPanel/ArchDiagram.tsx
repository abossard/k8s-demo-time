import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import type { K8sResource } from '../../lib/types';
import { GitBranch } from 'lucide-react';

interface ArchDiagramProps {
  mermaidDiagram: string | null;
  yamlFiles: K8sResource[];
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#326CE5',
    primaryBorderColor: '#60a5fa',
    primaryTextColor: '#e2e8f0',
    lineColor: '#475569',
    secondaryColor: '#1e293b',
    tertiaryColor: '#334155',
  },
});

export function ArchDiagram({ mermaidDiagram, yamlFiles }: ArchDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build a simple diagram from YAML resources if no mermaid diagram provided
  const diagram = mermaidDiagram ?? buildDiagramFromResources(yamlFiles);

  useEffect(() => {
    if (!diagram || !diagramRef.current) return;

    setError(null);
    setRendered(false);

    const id = `mermaid-${Date.now()}`;
    mermaid.render(id, diagram)
      .then(({ svg }) => {
        if (diagramRef.current) {
          diagramRef.current.innerHTML = svg;
          setRendered(true);
        }
      })
      .catch((err) => {
        setError(err.message ?? 'Failed to render diagram');
      });
  }, [diagram]);

  if (!diagram && yamlFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-kube-muted gap-3">
        <GitBranch size={32} className="opacity-30" />
        <span className="text-sm">No YAML files found to generate architecture diagram</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      {error && (
        <div className="mb-4 p-3 rounded bg-kube-danger/10 border border-kube-danger/20 text-kube-danger text-xs">
          Diagram render error: {error}
        </div>
      )}

      <div ref={diagramRef} className="flex justify-center" />

      {/* Resource summary */}
      {yamlFiles.length > 0 && (
        <div className="mt-6 border-t border-kube-border pt-4">
          <h4 className="text-xs font-semibold text-kube-muted uppercase tracking-wider mb-3">
            Resources from YAML ({yamlFiles.length})
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {yamlFiles.map((r, i) => (
              <div key={i} className="rounded border border-kube-border bg-kube-surface px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">{r.name}</span>
                  <span className="text-xs text-kube-info">{r.kind}</span>
                </div>
                <span className="text-xs text-kube-muted truncate block">{r.filePath.split('/').pop()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function buildDiagramFromResources(resources: K8sResource[]): string | null {
  if (resources.length === 0) return null;

  const lines: string[] = ['graph LR'];
  const ids = new Map<string, string>();
  let counter = 0;

  function getId(kind: string, name: string): string {
    const key = `${kind}/${name}`;
    if (!ids.has(key)) ids.set(key, `r${counter++}`);
    return ids.get(key)!;
  }

  for (const r of resources) {
    const id = getId(r.kind, r.name);
    lines.push(`  ${id}["${r.kind}<br/>${r.name}"]`);
  }

  for (const r of resources) {
    const srcId = getId(r.kind, r.name);
    for (const rel of r.relationships) {
      const tgtId = getId(rel.targetKind, rel.targetName);
      lines.push(`  ${srcId} -->|${rel.type}| ${tgtId}`);
    }
  }

  return lines.join('\n');
}
