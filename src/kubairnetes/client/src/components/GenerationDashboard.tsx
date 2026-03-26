import { Check, Circle, Loader2, AlertTriangle, Clock, Zap } from 'lucide-react';
import type { GenerationStep, SlideProgress } from '../hooks/useGenerationProgress';

interface GenerationDashboardProps {
  steps: GenerationStep[];
  slides: SlideProgress[];
  currentSlideIndex: number;
  liveTokens: string;
  totalSlides: number;
  completedSlides: number;
  elapsed: number;
  totalDuration: string | null;
  error: string | null;
  isDone: boolean;
  mode: 'curriculum' | 'slides';
  onRetrySlide?: (index: number) => void;
}

const visualEmoji: Record<string, string> = {
  hpa: '⚡', probes: '🚦', resources: '📊', qos: '🏔',
  vpa: '📐', rollout: '🔄', mermaid: '📐', architecture: '🏗', none: '📝',
};

function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  return mins > 0 ? `${mins}m ${s}s` : `${s}s`;
}

function StepTimeline({ steps }: { steps: GenerationStep[] }) {
  return (
    <div className="space-y-1">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-2.5">
          <div className="shrink-0 w-5 h-5 flex items-center justify-center">
            {step.status === 'done' && <Check size={14} className="text-emerald-400" />}
            {step.status === 'active' && <Loader2 size={14} className="text-kube-glow animate-spin" />}
            {step.status === 'pending' && <Circle size={12} className="text-kube-border" />}
            {step.status === 'error' && <AlertTriangle size={14} className="text-red-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-sm ${
              step.status === 'done' ? 'text-slate-400' :
              step.status === 'active' ? 'text-white font-medium' :
              'text-kube-muted'
            }`}>
              {step.label}
            </span>
            {step.detail && step.status === 'active' && (
              <span className="text-xs text-kube-muted ml-2">{step.detail}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SlideCards({ slides, currentIndex, onRetry }: {
  slides: SlideProgress[];
  currentIndex: number;
  onRetry?: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {slides.map((slide) => (
        <div
          key={slide.index}
          className={`rounded-lg border p-2.5 transition-all ${
            slide.status === 'ready' ? 'border-emerald-500/30 bg-emerald-500/5' :
            slide.status === 'generating' ? 'border-kube-glow/40 bg-kube-blue/5 ring-1 ring-kube-glow/20' :
            slide.status === 'error' ? 'border-red-500/30 bg-red-500/5' :
            'border-kube-border/30 bg-kube-surface/20'
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="shrink-0 mt-0.5">
              {slide.status === 'ready' && <Check size={12} className="text-emerald-400" />}
              {slide.status === 'generating' && <Loader2 size={12} className="text-kube-glow animate-spin" />}
              {slide.status === 'error' && <AlertTriangle size={12} className="text-red-400" />}
              {slide.status === 'pending' && <Circle size={10} className="text-kube-border" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-300 truncate">
                {slide.index + 1}. {slide.title}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {slide.visualType && (
                  <span className="text-[9px] text-kube-muted">
                    {visualEmoji[slide.visualType] ?? '📝'} {slide.visualType}
                  </span>
                )}
                {slide.duration && (
                  <span className="text-[9px] text-kube-muted">{slide.duration}s</span>
                )}
                {slide.tokenCount > 0 && (
                  <span className="text-[9px] text-kube-muted">{slide.tokenCount} tokens</span>
                )}
              </div>
              {slide.status === 'error' && (
                <div className="mt-1">
                  <span className="text-[9px] text-red-400">{slide.error?.slice(0, 60)}</span>
                  {onRetry && (
                    <button
                      onClick={() => onRetry(slide.index)}
                      className="ml-1 text-[9px] text-kube-glow hover:underline"
                    >
                      retry
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function GenerationDashboard({
  steps, slides, currentSlideIndex, liveTokens,
  totalSlides, completedSlides, elapsed, totalDuration,
  error, isDone, mode, onRetrySlide,
}: GenerationDashboardProps) {
  return (
    <div className="flex-1 flex flex-col items-center p-8 overflow-y-auto">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-kube-blue/20 border-2 border-kube-blue/40 flex items-center justify-center mx-auto glow-blue mb-4">
            {isDone ? (
              <Check size={28} className="text-emerald-400" />
            ) : (
              <Zap size={28} className="text-kube-glow animate-pulse" />
            )}
          </div>
          <h2 className="text-lg font-bold text-white">
            {isDone ? (mode === 'curriculum' ? 'Curriculum Ready!' : 'Slides Generated!') :
             mode === 'curriculum' ? 'Analyzing Content' : 'Generating Slides'}
          </h2>
          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-center gap-6 text-xs text-kube-muted">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {totalDuration ? `${totalDuration}s total` : formatElapsed(elapsed)}
          </span>
          {totalSlides > 0 && (
            <>
              <span className="flex items-center gap-1">
                <Check size={12} className="text-emerald-400" />
                {completedSlides}/{totalSlides} slides
              </span>
              {/* Progress bar */}
              <div className="w-32 h-1.5 bg-kube-surface-light rounded-full overflow-hidden">
                <div
                  className="h-full bg-kube-glow rounded-full transition-all duration-500"
                  style={{ width: `${(completedSlides / totalSlides) * 100}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* Step timeline (curriculum mode) */}
        {mode === 'curriculum' && steps.length > 0 && (
          <div className="bg-kube-surface rounded-xl border border-kube-border p-4">
            <StepTimeline steps={steps} />
          </div>
        )}

        {/* Slide cards (slides mode) */}
        {mode === 'slides' && slides.length > 0 && (
          <SlideCards slides={slides} currentIndex={currentSlideIndex} onRetry={onRetrySlide} />
        )}

        {/* Live AI output */}
        {liveTokens && (
          <div className="bg-kube-dark rounded-xl border border-kube-border p-4 max-h-48 overflow-y-auto">
            <div className="text-[10px] font-semibold text-kube-info uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Loader2 size={10} className="animate-spin" />
              AI writing...
            </div>
            <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap break-words">
              {liveTokens.slice(-800)}
              <span className="text-kube-glow animate-pulse">▌</span>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
