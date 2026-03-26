import { useEffect, useCallback, useState } from 'react';

export interface KeyboardShortcut {
  key: string;
  label: string;
  description: string;
  modifiers?: ('ctrl' | 'meta' | 'shift' | 'alt')[];
}

export const SHORTCUTS: KeyboardShortcut[] = [
  { key: '→', label: '→ / ↓', description: 'Next slide' },
  { key: '←', label: '← / ↑', description: 'Previous slide' },
  { key: 'c', label: 'C', description: 'Toggle chat panel' },
  { key: 'h', label: 'H', description: 'Toggle command history' },
  { key: 'p', label: 'P', description: 'Open presenter mode' },
  { key: 'd', label: 'D', description: 'Toggle dry-run mode' },
  { key: 'o', label: 'O', description: 'Open file picker' },
  { key: 'n', label: 'N', description: 'Generate speaker notes' },
  { key: '?', label: '?', description: 'Show keyboard shortcuts' },
  { key: 'Escape', label: 'Esc', description: 'Close panels / dialogs' },
];

interface KeyboardActions {
  onToggleChat: () => void;
  onToggleHistory: () => void;
  onTogglePresenter: () => void;
  onToggleDryRun: () => void;
  onOpenFilePicker: () => void;
  onGenerateNotes: () => void;
  onEscape: () => void;
}

export function useKeyboardShortcuts(actions: KeyboardActions) {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture if typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        // But still handle Escape
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
          actions.onEscape();
        }
        return;
      }

      switch (e.key) {
        case 'c':
        case 'C':
          e.preventDefault();
          actions.onToggleChat();
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          actions.onToggleHistory();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          actions.onTogglePresenter();
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          actions.onToggleDryRun();
          break;
        case 'o':
        case 'O':
          e.preventDefault();
          actions.onOpenFilePicker();
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          actions.onGenerateNotes();
          break;
        case '?':
          e.preventDefault();
          setShowHelp(prev => !prev);
          break;
        case 'Escape':
          e.preventDefault();
          setShowHelp(false);
          actions.onEscape();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);

  return { showHelp, setShowHelp };
}
