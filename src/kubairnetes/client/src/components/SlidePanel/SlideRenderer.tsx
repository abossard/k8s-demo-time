import ReactMarkdown from 'react-markdown';
import React from 'react';
import remarkGfm from 'remark-gfm';
import { CommandBlock } from './CommandBlock';
import { ConceptVisual } from './ConceptVisual';
import { MermaidBlock } from './MermaidBlock';
import { DynamicVisual } from './DynamicVisual';
import type { AISlide, SlideVisual, BuildStep } from '../../lib/types';
import { useState } from 'react';
import {
  ChevronDown, ChevronUp, ChevronRight, Lightbulb, RefreshCw,
  Info, Code, Terminal as TermIcon, Zap,
} from 'lucide-react';

interface SlideRendererProps {
  slide: AISlide;
  onRunCommand: (cmd: string) => void;
  onAskAbout: (text: string) => void;
  dryRunEnabled: boolean;
  onRegenerateSlide?: () => void;
  isRegenerating?: boolean;
  autoRunCommands?: boolean;
}

function VisualBlock({ visual }: { visual: SlideVisual }) {
  if (visual.type === 'none') return null;

  const conceptTypes = ['hpa', 'probes', 'resources', 'qos', 'vpa', 'rollout'] as const;
  if (conceptTypes.includes(visual.type as any)) {
    return (
      <div>
        {visual.description && (
          <p className="text-[10px] text-kube-muted mb-1 italic">{visual.description}</p>
        )}
        <ConceptVisual type={visual.type as any} />
      </div>
    );
  }

  if (visual.type === 'mermaid' && visual.mermaidCode) {
    return <MermaidBlock code={visual.mermaidCode} description={visual.description} />;
  }

  // AI-generated custom visual
  if (visual.type === 'custom' && visual.customCode) {
    return <DynamicVisual code={visual.customCode} description={visual.description} />;
  }

  return null;
}

// Build step icons
const stepIcons: Record<string, typeof Code> = {
  text: ChevronRight,
  code: Code,
  command: TermIcon,
  visual_highlight: Zap,
  reveal: Lightbulb,
};

const stepStyles: Record<string, string> = {
  text: 'border-kube-border bg-kube-surface/30',
  code: 'border-kube-info/30 bg-kube-info/5 font-mono',
  command: 'border-emerald-500/30 bg-emerald-500/5',
  visual_highlight: 'border-kube-warning/30 bg-kube-warning/5',
  reveal: 'border-purple-500/30 bg-purple-500/5',
};

function BuildStepList({
  steps,
  onRunCommand,
  onAskAbout,
  dryRunEnabled,
  revealedCount,
  onRevealNext,
  onRevealAll,
  onHideLast,
  autoRanCommands,
}: {
  steps: BuildStep[];
  onRunCommand: (cmd: string) => void;
  onAskAbout: (text: string) => void;
  dryRunEnabled: boolean;
  revealedCount: number;
  onRevealNext: () => void;
  onRevealAll: () => void;
  onHideLast: () => void;
  autoRanCommands: Set<number>;
}) {
  return (
    <div className="space-y-2">
      {/* Steps */}
      {steps.map((step, i) => {
        const isRevealed = i < revealedCount;
        const Icon = stepIcons[step.type] ?? ChevronRight;

        if (!isRevealed) {
          return (
            <div key={i} className="h-1.5 rounded bg-kube-surface-light/20" />
          );
        }

        if (step.type === 'command') {
          const wasAutoRun = autoRanCommands.has(i);
          return (
            <div key={i} className="build-step-enter">
              {step.label && (
                <p className="text-[10px] text-kube-muted mb-0.5 flex items-center gap-1">
                  <TermIcon size={10} className="text-emerald-400" /> {step.label}
                  {wasAutoRun && (
                    <span className="text-[9px] text-emerald-400 ml-auto">▶ executed</span>
                  )}
                </p>
              )}
              <CommandBlock
                command={step.content}
                onRun={onRunCommand}
                onExplain={() => onAskAbout(`Explain: \`${step.content}\``)}
                dryRunEnabled={dryRunEnabled}
              />
            </div>
          );
        }

        return (
          <div
            key={i}
            className={`build-step-enter rounded-lg border px-3 py-2.5 ${stepStyles[step.type] ?? stepStyles.text}`}
          >
            <div className="flex items-start gap-2">
              <Icon size={13} className="text-kube-muted mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                {step.label && (
                  <span className="text-[10px] text-kube-muted uppercase tracking-wider block mb-0.5">{step.label}</span>
                )}
                {step.type === 'code' ? (
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap overflow-x-auto">{step.content}</pre>
                ) : (
                  <div className="text-sm text-slate-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Reveal progress indicator */}
      {steps.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex gap-0.5 flex-1">
            {steps.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < revealedCount ? 'bg-kube-glow' : 'bg-kube-surface-light/30'}`} />
            ))}
          </div>
          <span className="text-[10px] text-kube-muted shrink-0">
            {revealedCount}/{steps.length}
          </span>
        </div>
      )}
    </div>
  );
}

export function SlideRenderer({
  slide,
  onRunCommand,
  onAskAbout,
  dryRunEnabled,
  onRegenerateSlide,
  isRegenerating,
  autoRunCommands = true,
}: SlideRendererProps) {
  const [showTransition, setShowTransition] = useState(false);
  const steps = slide.buildSteps ?? [];
  const [revealedCount, setRevealedCount] = useState(0);
  const [autoRanCommands, setAutoRanCommands] = useState<Set<number>>(new Set());

  // Reset revealed count when slide changes
  const [prevSlideId, setPrevSlideId] = useState(slide.id);
  if (slide.id !== prevSlideId) {
    setPrevSlideId(slide.id);
    setRevealedCount(0);
    setAutoRanCommands(new Set());
  }

  // Auto-run command when a command step is newly revealed
  React.useEffect(() => {
    if (!autoRunCommands || revealedCount === 0) return;
    const lastRevealedIdx = revealedCount - 1;
    const step = steps[lastRevealedIdx];
    if (step?.type === 'command' && !autoRanCommands.has(lastRevealedIdx)) {
      setAutoRanCommands(prev => new Set(prev).add(lastRevealedIdx));
      onRunCommand(step.content);
    }
  }, [revealedCount, autoRunCommands, steps, onRunCommand, autoRanCommands]);

  const hasUnrevealedSteps = steps.length > 0 && revealedCount < steps.length;
  const allRevealed = steps.length === 0 || revealedCount >= steps.length;

  // Expose reveal control for keyboard navigation
  // This is called by the parent via a ref or callback
  const revealNext = () => {
    if (hasUnrevealedSteps) {
      setRevealedCount(c => Math.min(c + 1, steps.length));
      return true; // consumed the keypress
    }
    return false; // let parent handle (advance slide)
  };

  // Attach to window for keyboard control
  // Space or → : reveal next step, or advance slide if all revealed
  // Backspace or ← : hide last step, or go to prev slide if none revealed
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (hasUnrevealedSteps) {
          e.preventDefault();
          e.stopPropagation();
          setRevealedCount(c => Math.min(c + 1, steps.length));
        }
        // If all revealed, let the event bubble to useSlides for slide advance
      } else if (e.key === 'Backspace' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (revealedCount > 0) {
          e.preventDefault();
          e.stopPropagation();
          setRevealedCount(c => Math.max(c - 1, 0));
        }
        // If at 0, let event bubble for prev slide
      }
    }

    // Use capture phase so we intercept before useSlides
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [hasUnrevealedSteps, revealedCount, steps.length]);

  const hasContent = slide.headline || slide.explanation || steps.length > 0 ||
    slide.commands.length > 0 || slide.keyTakeaways.length > 0;

  return (
    <div className="p-6 space-y-5">
      {/* Headline — the one phrase to remember */}
      {slide.headline ? (
        <div className="py-3">
          <p className="text-3xl font-black text-white leading-tight tracking-tight">
            {slide.headline}
          </p>
        </div>
      ) : (
        <div className="py-3">
          <p className="text-2xl font-bold text-white leading-tight">
            {slide.title}
          </p>
        </div>
      )}

      {/* Title + subtitle (smaller, below headline) */}
      <div className="flex items-start justify-between">
        <div>
          {slide.headline && slide.title !== slide.headline && (
            <h2 className="text-lg font-semibold text-slate-300">{slide.title}</h2>
          )}
          {slide.subtitle && (
            <p className="text-sm text-kube-muted mt-0.5">{slide.subtitle}</p>
          )}
        </div>
        {onRegenerateSlide && (
          <button
            onClick={onRegenerateSlide}
            disabled={isRegenerating}
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-kube-surface-light text-kube-muted hover:text-kube-warning border border-kube-border transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={10} className={isRegenerating ? 'animate-spin' : ''} />
            Regenerate
          </button>
        )}
      </div>

      {/* Short explanation */}
      {slide.explanation && (
        <div className="slide-content text-slate-400">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {slide.explanation}
          </ReactMarkdown>
        </div>
      )}

      {/* Interactive visuals */}
      {slide.visuals.filter(v => v.type !== 'none').map((v, i) => (
        <VisualBlock key={i} visual={v} />
      ))}

      {/* Progressive build steps */}
      {steps.length > 0 && (
        <BuildStepList
          steps={steps}
          onRunCommand={onRunCommand}
          onAskAbout={onAskAbout}
          dryRunEnabled={dryRunEnabled}
          revealedCount={revealedCount}
          onRevealNext={() => setRevealedCount(c => Math.min(c + 1, steps.length))}
          onRevealAll={() => setRevealedCount(steps.length)}
          onHideLast={() => setRevealedCount(c => Math.max(c - 1, 0))}
          autoRanCommands={autoRanCommands}
        />
      )}

      {/* Commands (fallback if no build steps) */}
      {slide.commands.length > 0 && steps.length === 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-kube-muted uppercase tracking-wider">Commands</span>
          {slide.commands.map((cmd, i) => (
            <div key={i} className="space-y-1">
              {cmd.explanation && (
                <p className="text-xs text-slate-400 flex items-start gap-1.5">
                  <Info size={11} className="text-kube-info shrink-0 mt-0.5" />
                  {cmd.explanation}
                </p>
              )}
              <CommandBlock
                command={cmd.raw}
                onRun={onRunCommand}
                onExplain={() => onAskAbout(`Explain: \`${cmd.raw}\``)}
                dryRunEnabled={dryRunEnabled}
              />
            </div>
          ))}
        </div>
      )}

      {/* Key takeaways — only show when all steps revealed */}
      {slide.keyTakeaways.length > 0 && allRevealed && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 build-step-enter">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={14} className="text-amber-400" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Remember</span>
          </div>
          <ul className="space-y-1.5">
            {slide.keyTakeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty slide hint */}
      {!hasContent && (
        <div className="text-center py-12 text-kube-muted">
          <p className="text-sm">This slide has no content yet.</p>
          <p className="text-xs mt-1">Click "Regenerate" to generate it with AI.</p>
        </div>
      )}

      {/* Navigation hint */}
      {steps.length > 0 && (
        <div className="text-center text-[10px] text-kube-muted/40 pt-2">
          <kbd className="px-1 py-0.5 rounded bg-kube-surface-light border border-kube-border font-mono">Space</kbd> / <kbd className="px-1 py-0.5 rounded bg-kube-surface-light border border-kube-border font-mono">→</kbd> reveal &amp; auto-run commands • <kbd className="px-1 py-0.5 rounded bg-kube-surface-light border border-kube-border font-mono">←</kbd> hide
        </div>
      )}

      {/* Transition */}
      {slide.transition && allRevealed && (
        <>
          <button
            onClick={() => setShowTransition(!showTransition)}
            className="flex items-center gap-1 text-[10px] text-kube-muted hover:text-slate-300 transition-colors"
          >
            {showTransition ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            Transition
          </button>
          {showTransition && (
            <p className="text-xs text-kube-muted italic bg-kube-surface/30 rounded p-2 border-l-2 border-kube-info/30">
              {slide.transition}
            </p>
          )}
        </>
      )}
    </div>
  );
}
