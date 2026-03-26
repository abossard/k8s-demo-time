import { useState } from 'react';
import { Play, AlertTriangle, HelpCircle, ShieldCheck } from 'lucide-react';

interface CommandBlockProps {
  command: string;
  onRun: (cmd: string) => void;
  onExplain: () => void;
  dryRunEnabled: boolean;
}

function detectDangerous(cmd: string): boolean {
  return /\b(delete|drain|taint|cordon|rm\s+-rf|prune)\b/.test(cmd);
}

export function CommandBlock({ command, onRun, onExplain, dryRunEnabled }: CommandBlockProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isDangerous = detectDangerous(command);

  const handleRun = () => {
    if (isDangerous && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    setShowConfirm(false);
    onRun(command);
  };

  return (
    <div className={`group relative rounded-lg border transition-all ${
      isDangerous
        ? 'border-kube-danger/30 bg-kube-danger/5 hover:border-kube-danger/50'
        : 'border-kube-border bg-kube-dark hover:border-kube-glow/30'
    }`}>
      <div className="flex items-start gap-2 px-3 py-2">
        <code className="flex-1 text-sm font-mono text-slate-300 whitespace-pre-wrap break-all pt-0.5">
          <span className="text-kube-muted select-none">$ </span>
          {command}
        </code>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onExplain}
            className="p-1.5 rounded hover:bg-kube-surface-light text-kube-muted hover:text-kube-info transition-colors"
            title="Explain this command"
          >
            <HelpCircle size={14} />
          </button>

          <button
            onClick={handleRun}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              isDangerous
                ? 'bg-kube-danger/20 text-kube-danger hover:bg-kube-danger/30 border border-kube-danger/30'
                : 'bg-kube-success/20 text-kube-success hover:bg-kube-success/30 border border-kube-success/30'
            }`}
            title={dryRunEnabled ? 'Run (dry-run)' : 'Run'}
          >
            {isDangerous && <AlertTriangle size={12} />}
            {dryRunEnabled && <ShieldCheck size={12} />}
            <Play size={12} />
            Run
          </button>
        </div>
      </div>

      {/* Confirmation dialog for dangerous commands */}
      {showConfirm && (
        <div className="px-3 py-2 bg-kube-danger/10 border-t border-kube-danger/20 flex items-center gap-3">
          <AlertTriangle size={16} className="text-kube-danger shrink-0" />
          <span className="text-xs text-kube-danger">
            This command may be destructive. Are you sure?
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-2 py-1 text-xs rounded bg-kube-surface-light text-kube-muted hover:text-white border border-kube-border"
            >
              Cancel
            </button>
            <button
              onClick={handleRun}
              className="px-2 py-1 text-xs rounded bg-kube-danger text-white hover:bg-kube-danger/80"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
