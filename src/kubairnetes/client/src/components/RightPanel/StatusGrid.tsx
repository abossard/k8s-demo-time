import { RefreshCw, Box, Server, Globe, Layers } from 'lucide-react';
import type { ClusterState } from '../../lib/types';

interface StatusGridProps {
  state: ClusterState | null;
  onRefresh: () => void;
  isLoading: boolean;
}

const phaseColors: Record<string, string> = {
  Running: 'text-kube-success border-kube-success/30 bg-kube-success/10',
  Succeeded: 'text-kube-info border-kube-info/30 bg-kube-info/10',
  Pending: 'text-kube-warning border-kube-warning/30 bg-kube-warning/10',
  Failed: 'text-kube-danger border-kube-danger/30 bg-kube-danger/10',
  Unknown: 'text-kube-muted border-kube-border bg-kube-surface-light',
  Ready: 'text-kube-success border-kube-success/30 bg-kube-success/10',
  NotReady: 'text-kube-danger border-kube-danger/30 bg-kube-danger/10',
};

export function StatusGrid({ state, onRefresh, isLoading }: StatusGridProps) {
  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-kube-muted gap-3">
        <Layers size={32} className="opacity-30" />
        <span className="text-sm">Click "Refresh" to load cluster status</span>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-kube-blue text-white hover:bg-kube-blue/80 transition-colors"
        >
          <RefreshCw size={12} />
          Load Cluster State
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Refresh */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-kube-muted">
          Last updated: {new Date(state.fetchedAt).toLocaleTimeString()}
        </span>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-kube-surface-light text-kube-muted hover:text-white border border-kube-border disabled:opacity-50"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Nodes */}
      {state.nodes.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-kube-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Server size={12} /> Nodes ({state.nodes.length})
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {state.nodes.map(node => (
              <div key={node.name} className={`rounded-lg border p-3 ${phaseColors[node.status] ?? phaseColors.Unknown}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{node.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-current/20">{node.status}</span>
                </div>
                <div className="flex gap-4 mt-1.5 text-xs opacity-80">
                  <span>CPU: {node.cpu.allocatable}</span>
                  <span>Memory: {node.memory.allocatable}</span>
                  <span>Roles: {node.roles.join(', ') || 'worker'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pods */}
      {state.pods.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-kube-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Box size={12} /> Pods ({state.pods.length})
          </h3>
          <div className="grid grid-cols-1 gap-1.5">
            {state.pods.map(pod => (
              <div key={`${pod.namespace}/${pod.name}`} className={`rounded border px-3 py-2 ${phaseColors[pod.phase] ?? phaseColors.Unknown}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-current/60 shrink-0">{pod.namespace}</span>
                    <span className="font-mono text-xs font-medium truncate">{pod.name}</span>
                  </div>
                  <span className="text-xs shrink-0">{pod.phase}</span>
                </div>
                <div className="flex gap-3 mt-1 text-xs opacity-70">
                  <span>Node: {pod.nodeName || '–'}</span>
                  {pod.containers.map(c => (
                    <span key={c.name}>
                      {c.name}: {c.restartCount > 0 ? `⟲${c.restartCount}` : '✓'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Services */}
      {state.services.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-kube-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Globe size={12} /> Services ({state.services.length})
          </h3>
          <div className="grid grid-cols-1 gap-1.5">
            {state.services.map(svc => (
              <div key={`${svc.namespace}/${svc.name}`} className="rounded border border-kube-border bg-kube-surface px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-kube-muted">{svc.namespace}</span>
                    <span className="font-mono text-xs text-kube-info font-medium">{svc.name}</span>
                  </div>
                  <span className="text-xs text-kube-muted">{svc.type}</span>
                </div>
                <div className="text-xs text-kube-muted mt-1">
                  {svc.ports.map(p => `${p.port}→${p.targetPort}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
