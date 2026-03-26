import {
  FolderOpen, MessageCircle, History, ShieldCheck, ShieldOff,
  Presentation, Keyboard, RefreshCw, Zap, Cpu,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import type { AIPresentation } from '../lib/types';
import { getModels, setModel as apiSetModel } from '../lib/api';

interface HeaderProps {
  presentation: AIPresentation | null;
  onToggleFilePicker: () => void;
  onToggleChat: () => void;
  onToggleHistory: () => void;
  onTogglePresenter: () => void;
  onToggleHelp: () => void;
  showChat: boolean;
  showHistory: boolean;
  dryRunEnabled: boolean;
  onToggleDryRun: () => void;
  fromCache?: boolean;
  onRegenerate?: () => void;
}

export function Header({
  presentation,
  onToggleFilePicker,
  onToggleChat,
  onToggleHistory,
  onTogglePresenter,
  onToggleHelp,
  showChat,
  showHistory,
  dryRunEnabled,
  onToggleDryRun,
  fromCache,
  onRegenerate,
}: HeaderProps) {
  const [models, setModels] = useState<{ id: string; label: string; description: string }[]>([]);
  const [currentModel, setCurrentModel] = useState('gpt-4o');

  useEffect(() => {
    getModels().then(data => {
      setModels(data.models);
      setCurrentModel(data.current);
    }).catch(() => {});
  }, []);

  const handleModelChange = (model: string) => {
    setCurrentModel(model);
    apiSetModel(model).catch(() => {});
  };

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-kube-surface border-b border-kube-border shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-kube-glow">☸️ Kub</span>
          <span className="text-kube-warning">AI</span>
          <span className="text-kube-glow">rnetes</span>
        </h1>
        {presentation && (
          <span className="text-sm text-kube-muted border-l border-kube-border pl-3 flex items-center gap-2">
            {presentation.title}
            <span className="text-xs opacity-60">
              ({presentation.slides.length} slides)
            </span>
            {fromCache && (
              <span className="text-[10px] text-kube-muted px-1.5 py-0.5 rounded bg-kube-surface-light border border-kube-border">cached</span>
            )}
            {fromCache && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="text-[10px] text-kube-muted hover:text-kube-warning flex items-center gap-0.5 transition-colors"
                title="Regenerate with AI"
              >
                <RefreshCw size={10} /> regen
              </button>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Model selector */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-kube-surface-light border border-kube-border">
          <Cpu size={12} className="text-kube-muted" />
          <select
            value={currentModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="text-[10px] bg-transparent text-slate-300 cursor-pointer focus:outline-none appearance-none pr-3"
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onToggleDryRun}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            dryRunEnabled
              ? 'bg-kube-warning/20 text-kube-warning border border-kube-warning/40'
              : 'bg-kube-surface-light text-kube-muted hover:text-white border border-kube-border'
          }`}
          title={dryRunEnabled ? 'Dry run ON — commands will use --dry-run=client' : 'Dry run OFF'}
        >
          {dryRunEnabled ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
          Dry Run
        </button>

        <button
          onClick={onToggleChat}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            showChat
              ? 'bg-kube-blue/20 text-kube-glow border border-kube-blue/40'
              : 'bg-kube-surface-light text-kube-muted hover:text-white border border-kube-border'
          }`}
        >
          <MessageCircle size={14} />
          Chat
        </button>

        <button
          onClick={onToggleHistory}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            showHistory
              ? 'bg-kube-blue/20 text-kube-glow border border-kube-blue/40'
              : 'bg-kube-surface-light text-kube-muted hover:text-white border border-kube-border'
          }`}
        >
          <History size={14} />
          History
        </button>

        {presentation && (
          <button
            onClick={onTogglePresenter}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-kube-surface-light text-kube-muted hover:text-white border border-kube-border transition-colors"
            title="Open presenter mode (P)"
          >
            <Presentation size={14} />
            Present
          </button>
        )}

        <button
          onClick={onToggleHelp}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-kube-surface-light text-kube-muted hover:text-white border border-kube-border transition-colors"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard size={14} />
        </button>

        <button
          onClick={onToggleFilePicker}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-kube-surface-light text-kube-muted hover:text-white border border-kube-border transition-colors"
        >
          <FolderOpen size={14} />
          Open
        </button>
      </div>
    </header>
  );
}
