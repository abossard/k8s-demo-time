import { useState, useEffect } from 'react';
import { listDecks, deleteDeck as apiDeleteDeck } from '../lib/api';
import { Trash2, Play, Clock, FileText, Plus } from 'lucide-react';

interface DeckManagerProps {
  onLoadDeck: (deckId: string) => void;
  onCreateNew: () => void;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  curriculum_draft: { label: 'Draft', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  curriculum_approved: { label: 'Approved', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  generating: { label: 'Generating...', color: 'text-kube-warning bg-kube-warning/10 border-kube-warning/30' },
  ready: { label: 'Ready', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  error: { label: 'Error', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
};

export function DeckManager({ onLoadDeck, onCreateNew }: DeckManagerProps) {
  const [decks, setDecks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = () => {
    setIsLoading(true);
    listDecks().then(setDecks).catch(() => {}).finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await apiDeleteDeck(id);
    setDecks(d => d.filter(x => x.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col items-center p-8 overflow-y-auto">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Your Decks</h2>
            <p className="text-sm text-kube-muted">Load a previous presentation or create a new one</p>
          </div>
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kube-blue text-white text-sm font-medium hover:bg-kube-blue/80 transition-colors"
          >
            <Plus size={16} />
            New Deck
          </button>
        </div>

        {isLoading && (
          <div className="text-center text-kube-muted py-12">Loading decks...</div>
        )}

        {!isLoading && decks.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-kube-border rounded-xl">
            <FileText size={40} className="mx-auto text-kube-muted/30 mb-3" />
            <p className="text-kube-muted mb-4">No decks yet. Create your first presentation!</p>
            <button
              onClick={onCreateNew}
              className="px-4 py-2 rounded-lg bg-kube-blue text-white text-sm hover:bg-kube-blue/80"
            >
              Create Deck
            </button>
          </div>
        )}

        <div className="space-y-3">
          {decks.map((deck) => {
            const status = statusLabels[deck.status] ?? statusLabels.error!;

            return (
              <div
                key={deck.id}
                className="group rounded-xl border border-kube-border bg-kube-surface hover:border-kube-glow/30 transition-all p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-white truncate">{deck.title}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-kube-muted font-mono truncate">{deck.readme_path}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-kube-muted">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(deck.updated_at).toLocaleDateString()} {new Date(deck.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onLoadDeck(deck.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-kube-blue text-white hover:bg-kube-blue/80 transition-colors"
                    >
                      <Play size={12} />
                      {deck.status === 'ready' ? 'Present' : deck.status === 'curriculum_draft' ? 'Edit' : 'Open'}
                    </button>
                    <button
                      onClick={() => handleDelete(deck.id)}
                      className="p-1.5 rounded text-kube-muted hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete deck"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
