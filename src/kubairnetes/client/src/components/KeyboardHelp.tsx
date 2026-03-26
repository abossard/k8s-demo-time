import { X, Keyboard } from 'lucide-react';
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts';

interface KeyboardHelpProps {
  onClose: () => void;
}

export function KeyboardHelp({ onClose }: KeyboardHelpProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-kube-surface border border-kube-border rounded-xl shadow-2xl glow-blue w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-kube-border">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-kube-glow" />
            <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-kube-surface-light text-kube-muted hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-1">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between py-2 px-3 rounded hover:bg-kube-surface-light/50 transition-colors"
            >
              <span className="text-sm text-slate-300">{shortcut.description}</span>
              <kbd className="px-2 py-1 rounded bg-kube-dark border border-kube-border text-xs font-mono text-kube-glow min-w-[32px] text-center">
                {shortcut.label}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-kube-border">
          <p className="text-xs text-kube-muted text-center">
            Press <kbd className="px-1.5 py-0.5 rounded bg-kube-dark border border-kube-border font-mono text-kube-glow">?</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-kube-dark border border-kube-border font-mono text-kube-glow">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
