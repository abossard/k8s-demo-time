import { X, RotateCcw, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { CommandExecution } from '../lib/types';

interface CommandHistoryProps {
  history: CommandExecution[];
  onClose: () => void;
  onRerun: (command: string) => void;
}

const statusIcons = {
  completed: <CheckCircle size={14} className="text-kube-success" />,
  failed: <XCircle size={14} className="text-kube-danger" />,
  running: <Clock size={14} className="text-kube-warning animate-spin" />,
  cancelled: <XCircle size={14} className="text-kube-muted" />,
};

export function CommandHistory({ history, onClose, onRerun }: CommandHistoryProps) {
  return (
    <div className="border-t border-kube-border bg-kube-surface flex flex-col" style={{ height: '280px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-kube-border shrink-0">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-kube-glow" />
          <span className="text-xs font-medium text-slate-300">
            Command History ({history.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-kube-surface-light text-kube-muted hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 && (
          <div className="text-center text-kube-muted text-sm py-8">
            No commands executed yet
          </div>
        )}

        {history.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-2 px-4 py-2.5 border-b border-kube-border/50 hover:bg-kube-surface-light/30 transition-colors group"
          >
            <div className="mt-0.5 shrink-0">
              {statusIcons[entry.status]}
            </div>

            <div className="flex-1 min-w-0">
              <code className="text-xs font-mono text-slate-300 break-all">
                $ {entry.command}
              </code>
              <div className="flex items-center gap-3 mt-1 text-xs text-kube-muted">
                <span>{new Date(entry.startedAt).toLocaleTimeString()}</span>
                {entry.exitCode !== null && (
                  <span className={entry.exitCode === 0 ? 'text-kube-success' : 'text-kube-danger'}>
                    exit: {entry.exitCode}
                  </span>
                )}
                {entry.dryRun && (
                  <span className="text-kube-warning">dry-run</span>
                )}
              </div>
              {entry.output && (
                <pre className="mt-1 text-xs font-mono text-kube-muted max-h-16 overflow-hidden">
                  {entry.output.slice(0, 200)}{entry.output.length > 200 ? '...' : ''}
                </pre>
              )}
            </div>

            <button
              onClick={() => onRerun(entry.command)}
              className="shrink-0 p-1 rounded hover:bg-kube-surface-light text-kube-muted hover:text-white opacity-0 group-hover:opacity-100 transition-all"
              title="Re-run"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
