import { useState, useEffect, useRef } from 'react';
import { TerminalView } from './TerminalView';
import { ClusterViz } from './ClusterViz';
import { ArchDiagram } from './ArchDiagram';
import { StatusGrid } from './StatusGrid';
import { Terminal, Network, LayoutGrid, GitBranch } from 'lucide-react';
import type { ClusterState, K8sResource } from '../../lib/types';

type Tab = 'terminal' | 'cluster' | 'grid' | 'architecture';

interface RightPanelProps {
  commandOutput: string;
  isRunning: boolean;
  currentCommand: string | null;
  onClearOutput: () => void;
  clusterState: ClusterState | null;
  onRefreshCluster: () => void;
  isClusterLoading: boolean;
  isClusterWatching: boolean;
  onStartWatching: (namespace?: string) => void;
  onStopWatching: () => void;
  clusterError: string | null;
  mermaidDiagram: string | null;
  yamlFiles: K8sResource[];
}

const tabs: { id: Tab; label: string; icon: typeof Terminal }[] = [
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'cluster', label: 'Cluster', icon: Network },
  { id: 'grid', label: 'Status', icon: LayoutGrid },
  { id: 'architecture', label: 'Architecture', icon: GitBranch },
];

export function RightPanel({
  commandOutput,
  isRunning,
  currentCommand,
  onClearOutput,
  clusterState,
  onRefreshCluster,
  isClusterLoading,
  isClusterWatching,
  onStartWatching,
  onStopWatching,
  clusterError,
  mermaidDiagram,
  yamlFiles,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('terminal');

  // Auto-switch to terminal when a command starts running
  const prevRunning = useRef(isRunning);
  useEffect(() => {
    if (isRunning && !prevRunning.current) {
      setActiveTab('terminal');
    }
    prevRunning.current = isRunning;
  }, [isRunning]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-kube-border bg-kube-surface/50 shrink-0">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setActiveTab(id);
              // Auto-load cluster on first tab switch
              if ((id === 'cluster' || id === 'grid') && !clusterState && !isClusterLoading) {
                onRefreshCluster();
              }
            }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeTab === id
                ? 'border-kube-glow text-kube-glow bg-kube-dark/30'
                : 'border-transparent text-kube-muted hover:text-white'
            }`}
          >
            <Icon size={14} />
            {label}
            {id === 'terminal' && isRunning && (
              <span className="w-2 h-2 rounded-full bg-kube-success animate-pulse" />
            )}
            {id === 'cluster' && isClusterWatching && (
              <span className="w-2 h-2 rounded-full bg-kube-info animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'terminal' && (
          <TerminalView
            output={commandOutput}
            isRunning={isRunning}
            currentCommand={currentCommand}
            onClear={onClearOutput}
          />
        )}
        {activeTab === 'cluster' && (
          <ClusterViz
            state={clusterState}
            onRefresh={onRefreshCluster}
            isLoading={isClusterLoading}
            isWatching={isClusterWatching}
            onStartWatching={onStartWatching}
            onStopWatching={onStopWatching}
            error={clusterError}
          />
        )}
        {activeTab === 'grid' && (
          <StatusGrid
            state={clusterState}
            onRefresh={onRefreshCluster}
            isLoading={isClusterLoading}
          />
        )}
        {activeTab === 'architecture' && (
          <ArchDiagram
            mermaidDiagram={mermaidDiagram}
            yamlFiles={yamlFiles}
          />
        )}
      </div>
    </div>
  );
}
