import { useState } from 'react';
import {
  GripVertical, Eye, EyeOff, ChevronDown, ChevronUp,
  Check, Pencil, Sparkles, Play,
} from 'lucide-react';

interface CurriculumItem {
  id: string;
  order_num: number;
  title: string;
  subtitle: string | null;
  covered_section: string | null;
  visual_types: string[];
  command_count: number;
  user_notes: string | null;
  approved: boolean;
}

interface CurriculumEditorProps {
  deckTitle: string;
  description: string;
  items: CurriculumItem[];
  onUpdate: (items: CurriculumItem[]) => void;
  onApproveAndGenerate: () => void;
  onBack: () => void;
  isGenerating: boolean;
}

const visualLabels: Record<string, { emoji: string; label: string }> = {
  hpa: { emoji: '⚡', label: 'HPA Scaler' },
  probes: { emoji: '🚦', label: 'Probe Status' },
  resources: { emoji: '📊', label: 'Resource Bars' },
  qos: { emoji: '🏔', label: 'QoS Pyramid' },
  vpa: { emoji: '📐', label: 'VPA Resize' },
  rollout: { emoji: '🔄', label: 'Rolling Update' },
  mermaid: { emoji: '📐', label: 'Diagram' },
  architecture: { emoji: '🏗', label: 'Architecture' },
  none: { emoji: '📝', label: 'Text Only' },
};

const visualTypes = Object.keys(visualLabels);

export function CurriculumEditor({
  deckTitle,
  description,
  items: initialItems,
  onUpdate,
  onApproveAndGenerate,
  onBack,
  isGenerating,
}: CurriculumEditorProps) {
  const [items, setItems] = useState(initialItems);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [expandedVisuals, setExpandedVisuals] = useState<Set<string>>(new Set());

  const updateItem = (id: string, updates: Partial<CurriculumItem>) => {
    const updated = items.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    setItems(updated);
    onUpdate(updated);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const newItems = [...items];
    const target = index + direction;
    if (target < 0 || target >= newItems.length) return;
    [newItems[index], newItems[target]] = [newItems[target]!, newItems[index]!];
    // Update order_num
    const reordered = newItems.map((item, i) => ({ ...item, order_num: i + 1 }));
    setItems(reordered);
    onUpdate(reordered);
  };

  const approvedCount = items.filter(i => i.approved).length;

  return (
    <div className="flex-1 flex flex-col items-center p-8 overflow-y-auto">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <button onClick={onBack} className="text-xs text-kube-muted hover:text-white mb-2 transition-colors">
            ← Back to Deck Manager
          </button>
          <h2 className="text-xl font-bold text-white">{deckTitle}</h2>
          <p className="text-sm text-kube-muted mt-1">{description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-kube-muted">
              {approvedCount} of {items.length} slides included
            </span>
          </div>
        </div>

        {/* Curriculum items */}
        <div className="space-y-2 mb-6">
          {items.map((item, index) => {
            const itemVisualTypes = item.visual_types ?? [];
            const isEditing = editingNotes === item.id;
            const showVisuals = expandedVisuals.has(item.id);
            const setShowVisuals = (show: boolean) => {
              setExpandedVisuals(prev => {
                const next = new Set(prev);
                show ? next.add(item.id) : next.delete(item.id);
                return next;
              });
            };

            const toggleVisualType = (vt: string) => {
              const current = new Set(itemVisualTypes);
              if (current.has(vt)) {
                current.delete(vt);
              } else {
                current.add(vt);
                current.delete('none');
              }
              if (current.size === 0) current.add('none');
              updateItem(item.id, { visual_types: [...current] } as any);
            };

            return (
              <div
                key={item.id}
                className={`rounded-lg border transition-all ${
                  item.approved
                    ? 'border-kube-border bg-kube-surface'
                    : 'border-kube-border/30 bg-kube-surface/30 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  {/* Drag handle / order */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveItem(index, -1)} disabled={index === 0}
                      className="text-kube-muted hover:text-white disabled:opacity-20 transition-colors">
                      <ChevronUp size={12} />
                    </button>
                    <button onClick={() => moveItem(index, 1)} disabled={index === items.length - 1}
                      className="text-kube-muted hover:text-white disabled:opacity-20 transition-colors">
                      <ChevronDown size={12} />
                    </button>
                  </div>

                  {/* Order number */}
                  <span className="text-xs font-mono text-kube-muted w-6 text-center shrink-0">
                    {index + 1}
                  </span>

                  {/* Title + section */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-300">{item.title}</div>
                    {item.subtitle && (
                      <div className="text-xs text-kube-muted">{item.subtitle}</div>
                    )}
                    {item.covered_section && (
                      <div className="text-[10px] text-kube-muted/60 font-mono mt-0.5">
                        § {item.covered_section}
                      </div>
                    )}
                  </div>

                  {/* Visual types toggle */}
                  <button
                    onClick={() => setShowVisuals(!showVisuals)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-kube-dark border border-kube-border rounded text-slate-300 cursor-pointer shrink-0 hover:border-kube-glow/30 transition-colors"
                  >
                    {itemVisualTypes.filter(v => v !== 'none').map(vt => visualLabels[vt]?.emoji ?? '📝').join('') || '📝'}
                    <span className="text-kube-muted">{itemVisualTypes.filter(v => v !== 'none').length || 0}</span>
                    <ChevronDown size={10} className="text-kube-muted" />
                  </button>

                  {/* Notes button */}
                  <button
                    onClick={() => {
                      if (isEditing) {
                        updateItem(item.id, { user_notes: notesDraft || null });
                        setEditingNotes(null);
                      } else {
                        setEditingNotes(item.id);
                        setNotesDraft(item.user_notes ?? '');
                      }
                    }}
                    className={`p-1.5 rounded transition-colors ${
                      item.user_notes ? 'text-kube-warning bg-kube-warning/10' : 'text-kube-muted hover:text-white'
                    }`}
                    title="Add instructions for AI"
                  >
                    <Pencil size={12} />
                  </button>

                  {/* Toggle include */}
                  <button
                    onClick={() => updateItem(item.id, { approved: !item.approved })}
                    className={`p-1.5 rounded transition-colors ${
                      item.approved ? 'text-emerald-400 bg-emerald-500/10' : 'text-kube-muted hover:text-white'
                    }`}
                    title={item.approved ? 'Included — click to exclude' : 'Excluded — click to include'}
                  >
                    {item.approved ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>

                {/* Visual type multi-select */}
                {showVisuals && (
                  <div className="px-3 pb-2 border-t border-kube-border/30 pt-2">
                    <div className="text-[10px] text-kube-muted uppercase tracking-wider mb-1.5">Visuals for this slide</div>
                    <div className="flex flex-wrap gap-1.5">
                      {visualTypes.filter(vt => vt !== 'none').map(vt => {
                        const active = itemVisualTypes.includes(vt);
                        const vl = visualLabels[vt]!;
                        return (
                          <button
                            key={vt}
                            onClick={() => toggleVisualType(vt)}
                            className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded border transition-colors ${
                              active
                                ? 'bg-kube-blue/20 text-kube-glow border-kube-blue/40'
                                : 'bg-kube-dark text-kube-muted border-kube-border hover:text-white'
                            }`}
                          >
                            <span>{vl.emoji}</span>
                            <span>{vl.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Expandable notes editor */}
                {isEditing && (
                  <div className="px-3 pb-3 border-t border-kube-border/30 pt-2">
                    <label className="text-[10px] text-kube-muted uppercase tracking-wider mb-1 block">
                      Instructions for AI (optional)
                    </label>
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="e.g. 'Focus on the comparison between HPA and KEDA', 'Include a real-world analogy', 'Show the YAML diff'"
                      className="w-full bg-kube-dark border border-kube-border rounded px-3 py-2 text-xs text-slate-300 placeholder-kube-muted resize-none h-16 focus:outline-none focus:border-kube-glow"
                    />
                    <button
                      onClick={() => {
                        updateItem(item.id, { user_notes: notesDraft || null });
                        setEditingNotes(null);
                      }}
                      className="mt-1 px-2 py-1 text-[10px] rounded bg-kube-blue text-white hover:bg-kube-blue/80"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-kube-muted">
            <Sparkles size={12} className="inline mr-1" />
            AI will generate {approvedCount} slides from this curriculum
          </span>
          <button
            onClick={onApproveAndGenerate}
            disabled={approvedCount === 0 || isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-kube-blue text-white text-sm font-medium hover:bg-kube-blue/80 disabled:opacity-50 transition-colors"
          >
            {isGenerating ? (
              <>Generating...</>
            ) : (
              <>
                <Play size={16} />
                Generate {approvedCount} Slides
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
