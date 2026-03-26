import { useState, useMemo } from 'react';
import {
  RefreshCw, Eye, EyeOff, ChevronDown, ChevronRight,
  Server, Box, Layers, Filter, RotateCcw,
} from 'lucide-react';
import type { ClusterState, ClusterPod } from '../../lib/types';

interface ClusterVizProps {
  state: ClusterState | null;
  onRefresh: () => void;
  isLoading: boolean;
  isWatching: boolean;
  onStartWatching: (namespace?: string) => void;
  onStopWatching: () => void;
  error: string | null;
}

type GroupBy = 'namespace' | 'node';

const phaseColor: Record<string, string> = {
  Running: 'bg-emerald-500',
  Succeeded: 'bg-sky-500',
  Pending: 'bg-amber-500',
  Failed: 'bg-red-500',
  Unknown: 'bg-slate-500',
  CrashLoopBackOff: 'bg-red-500',
  ImagePullBackOff: 'bg-orange-500',
  Terminating: 'bg-slate-400',
};

const phaseRing: Record<string, string> = {
  Running: 'ring-emerald-500/30',
  Succeeded: 'ring-sky-500/30',
  Pending: 'ring-amber-500/30',
  Failed: 'ring-red-500/30',
  Unknown: 'ring-slate-500/30',
};

function PodCard({ pod }: { pod: ClusterPod }) {
  const dotColor = phaseColor[pod.phase] ?? phaseColor[pod.status] ?? 'bg-slate-500';
  const age = pod.createdAt ? timeSince(new Date(pod.createdAt)) : '–';
  const totalRestarts = pod.containers.reduce((s, c) => s + c.restartCount, 0);

  return (
    <div className={`group flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-kube-dark/60 border border-kube-border/50 hover:border-kube-border transition-all ring-1 ${phaseRing[pod.phase] ?? 'ring-transparent'}`}>
      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} title={pod.phase} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-slate-300 truncate" title={pod.name}>
            {pod.name}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {pod.containers.map((c) => (
            <span
              key={c.name}
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                c.ready ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}
              title={`${c.name}: ${c.state}${c.restartCount > 0 ? ` (${c.restartCount} restarts)` : ''}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${c.ready ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {c.name}
            </span>
          ))}
          <span className="text-[10px] text-kube-muted ml-auto shrink-0">{age}</span>
          {totalRestarts > 0 && (
            <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
              <RotateCcw size={8} />{totalRestarts}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupSection({
  title,
  icon,
  count,
  children,
  defaultOpen = true,
  subtitle,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  subtitle?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-kube-border/60 bg-kube-surface/40 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-kube-surface-light/30 transition-colors"
      >
        {open ? <ChevronDown size={14} className="text-kube-muted shrink-0" /> : <ChevronRight size={14} className="text-kube-muted shrink-0" />}
        {icon}
        <span className="text-xs font-medium text-slate-300">{title}</span>
        <span className="text-[10px] text-kube-muted px-1.5 py-0.5 rounded-full bg-kube-dark/50">{count}</span>
        {subtitle && <span className="text-[10px] text-kube-muted ml-auto">{subtitle}</span>}
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-1 animate-in">
          {children}
        </div>
      )}
    </div>
  );
}

function timeSince(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

export function ClusterViz({
  state,
  onRefresh,
  isLoading,
  isWatching,
  onStartWatching,
  onStopWatching,
  error,
}: ClusterVizProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('namespace');
  const [nsFilter, setNsFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  // Get all namespaces from data
  const namespaces = useMemo(() => {
    if (!state) return [];
    const ns = new Set(state.pods.map(p => p.namespace));
    state.services.forEach(s => ns.add(s.namespace));
    return Array.from(ns).sort();
  }, [state]);

  // Filter pods
  const filteredPods = useMemo(() => {
    if (!state) return [];
    let pods = state.pods;
    if (nsFilter) pods = pods.filter(p => p.namespace === nsFilter);
    if (search) {
      const q = search.toLowerCase();
      pods = pods.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.namespace.toLowerCase().includes(q) ||
        p.nodeName.toLowerCase().includes(q)
      );
    }
    return pods;
  }, [state, nsFilter, search]);

  // Group pods
  const groups = useMemo(() => {
    const map = new Map<string, ClusterPod[]>();
    for (const pod of filteredPods) {
      const key = groupBy === 'namespace' ? pod.namespace : (pod.nodeName || 'unscheduled');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pod);
    }
    // Sort groups, sort pods within each group by name
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, pods]) => ({
        key,
        pods: pods.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [filteredPods, groupBy]);

  // Stats
  const stats = useMemo(() => {
    if (!state) return null;
    const running = state.pods.filter(p => p.phase === 'Running').length;
    const pending = state.pods.filter(p => p.phase === 'Pending').length;
    const failed = state.pods.filter(p => p.phase === 'Failed').length;
    return { total: state.pods.length, running, pending, failed, nodes: state.nodes.length };
  }, [state]);

  if (!state && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-kube-muted gap-3">
        <Layers size={32} className="opacity-30" />
        <span className="text-sm">Click to load cluster state</span>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-kube-blue text-white hover:bg-kube-blue/80 transition-colors"
        >
          <RefreshCw size={12} />
          Load Cluster
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-kube-dark">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-kube-border bg-kube-surface/30 shrink-0">
        {/* Stats bar */}
        {stats && (
          <div className="flex items-center gap-2 mr-2">
            <span className="flex items-center gap-1 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-emerald-400">{stats.running}</span>
            </span>
            {stats.pending > 0 && (
              <span className="flex items-center gap-1 text-[10px]">
                <span className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-amber-400">{stats.pending}</span>
              </span>
            )}
            {stats.failed > 0 && (
              <span className="flex items-center gap-1 text-[10px]">
                <span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-red-400">{stats.failed}</span>
              </span>
            )}
            <span className="text-[10px] text-kube-muted">/ {stats.total} pods · {stats.nodes} nodes</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter..."
          className="w-28 px-2 py-1 text-xs bg-kube-dark border border-kube-border rounded text-slate-300 placeholder-kube-muted focus:outline-none focus:border-kube-glow"
        />

        {/* Namespace dropdown */}
        <div className="relative flex items-center gap-1">
          <Filter size={11} className="text-kube-muted" />
          <select
            value={nsFilter}
            onChange={(e) => setNsFilter(e.target.value)}
            className="text-xs bg-kube-dark border border-kube-border rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-kube-glow appearance-none pr-6 cursor-pointer"
          >
            <option value="">All namespaces</option>
            {namespaces.map(ns => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
        </div>

        {/* Group by toggle */}
        <div className="flex rounded border border-kube-border overflow-hidden">
          <button
            onClick={() => setGroupBy('namespace')}
            className={`px-2 py-1 text-[10px] font-medium transition-colors ${
              groupBy === 'namespace' ? 'bg-kube-blue text-white' : 'bg-kube-dark text-kube-muted hover:text-white'
            }`}
          >
            Namespace
          </button>
          <button
            onClick={() => setGroupBy('node')}
            className={`px-2 py-1 text-[10px] font-medium transition-colors ${
              groupBy === 'node' ? 'bg-kube-blue text-white' : 'bg-kube-dark text-kube-muted hover:text-white'
            }`}
          >
            Node
          </button>
        </div>

        {/* Watch / Refresh */}
        <button
          onClick={() => isWatching ? onStopWatching() : onStartWatching(nsFilter || undefined)}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${
            isWatching
              ? 'bg-kube-info/20 text-kube-info border-kube-info/40'
              : 'bg-kube-surface-light text-kube-muted hover:text-white border-kube-border'
          }`}
          title={isWatching ? 'Stop auto-refresh' : 'Start auto-refresh (5s)'}
        >
          {isWatching ? <EyeOff size={11} /> : <Eye size={11} />}
          {isWatching ? 'Stop' : 'Watch'}
        </button>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 rounded bg-kube-surface-light text-kube-muted hover:text-white border border-kube-border transition-colors disabled:opacity-50"
          title="Refresh now"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && !state && (
        <div className="flex-1 flex items-center justify-center text-kube-muted">
          <RefreshCw size={16} className="animate-spin mr-2" />
          Loading cluster state...
        </div>
      )}

      {/* Hierarchical view */}
      {state && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {groups.length === 0 && (
            <div className="text-center text-kube-muted text-sm py-8">
              No pods match the current filter
            </div>
          )}

          {groups.map(({ key, pods }) => (
            <GroupSection
              key={key}
              title={key}
              icon={groupBy === 'namespace'
                ? <Layers size={13} className="text-kube-info shrink-0" />
                : <Server size={13} className="text-amber-400 shrink-0" />
              }
              count={pods.length}
              subtitle={groupBy === 'node'
                ? state.nodes.find(n => n.name === key)?.status ?? ''
                : undefined
              }
              defaultOpen={groups.length <= 8}
            >
              {pods.map(pod => (
                <PodCard key={`${pod.namespace}/${pod.name}`} pod={pod} />
              ))}
            </GroupSection>
          ))}

          {/* Timestamp */}
          {state.fetchedAt && (
            <div className="text-center text-[10px] text-kube-muted/50 pt-2">
              {isWatching && <span className="inline-block w-1.5 h-1.5 rounded-full bg-kube-info animate-pulse mr-1" />}
              Updated {new Date(state.fetchedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
