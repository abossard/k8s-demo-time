import { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';

interface TerminalViewProps {
  output: string;
  isRunning: boolean;
  currentCommand: string | null;
  onClear: () => void;
}

export function TerminalView({ output, isRunning, currentCommand, onClear }: TerminalViewProps) {
  const outputRef = useRef<HTMLPreElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="flex flex-col h-full bg-kube-dark">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-kube-surface/30 border-b border-kube-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-kube-danger/60" />
            <div className="w-3 h-3 rounded-full bg-kube-warning/60" />
            <div className="w-3 h-3 rounded-full bg-kube-success/60" />
          </div>
          {currentCommand && (
            <span className="text-xs font-mono text-kube-muted ml-2 truncate max-w-[300px]">
              {isRunning ? '⏳ ' : '✓ '}{currentCommand}
            </span>
          )}
        </div>

        <button
          onClick={onClear}
          className="p-1 rounded hover:bg-kube-surface-light text-kube-muted hover:text-white transition-colors"
          title="Clear terminal"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Terminal output */}
      <pre
        ref={outputRef}
        className="flex-1 overflow-auto p-4 font-mono text-sm text-slate-300 whitespace-pre-wrap"
      >
        {!output && !isRunning && (
          <span className="text-kube-muted">
            {`# KubAIrnetes Terminal\n# Click "Run" on any command to execute it here\n# Output will stream in real-time\n\n`}
            <span className="text-kube-glow">$</span> <span className="animate-pulse">▌</span>
          </span>
        )}
        {output}
        {isRunning && <span className="animate-pulse text-kube-glow">▌</span>}
      </pre>
    </div>
  );
}
