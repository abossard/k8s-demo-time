import { SlideRenderer } from './SlideRenderer';
import { SlideProgress } from './SlideProgress';
import { ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import type { AIPresentation, AISlide } from '../../lib/types';

interface SlidePanelProps {
  presentation: AIPresentation;
  currentIndex: number;
  currentSlide: AISlide | null;
  totalSlides: number;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (index: number) => void;
  onRunCommand: (cmd: string) => void;
  onAskAbout: (text: string) => void;
  dryRunEnabled: boolean;
  speakerNotes: { notes: string; status: string } | null;
  onGenerateNotes: () => void;
  onRegenerateSlide?: () => void;
  isRegenerating?: boolean;
}

export function SlidePanel({
  presentation,
  currentIndex,
  currentSlide,
  totalSlides,
  onNext,
  onPrev,
  onGoTo,
  onRunCommand,
  onAskAbout,
  dryRunEnabled,
  speakerNotes,
  onGenerateNotes,
  onRegenerateSlide,
  isRegenerating,
}: SlidePanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Slide progress */}
      <SlideProgress
        slides={presentation.slides}
        currentIndex={currentIndex}
        onGoTo={onGoTo}
      />

      {/* Slide content */}
      <div className="flex-1 overflow-y-auto">
        {currentSlide && (
          <div className="slide-enter" key={currentSlide.id}>
            <SlideRenderer
              slide={currentSlide}
              onRunCommand={onRunCommand}
              onAskAbout={onAskAbout}
              dryRunEnabled={dryRunEnabled}
              onRegenerateSlide={onRegenerateSlide}
              isRegenerating={isRegenerating}
            />
          </div>
        )}
      </div>

      {/* Speaker notes (collapsible) */}
      {speakerNotes && (
        <div className="border-t border-kube-border bg-kube-surface/30 px-4 py-3 shrink-0 max-h-[200px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={12} className="text-kube-warning" />
            <span className="text-xs font-medium text-kube-warning uppercase tracking-wider">Speaker Notes</span>
          </div>
          {speakerNotes.status === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-kube-muted">
              <Loader2 size={12} className="animate-spin" />
              Generating...
            </div>
          )}
          {speakerNotes.status === 'ready' && (
            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
              {speakerNotes.notes}
            </p>
          )}
          {speakerNotes.status === 'error' && (
            <p className="text-xs text-kube-danger">{speakerNotes.notes}</p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-kube-border bg-kube-surface/50">
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium bg-kube-surface-light border border-kube-border text-kube-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        <span className="text-sm text-kube-muted flex items-center gap-3">
          <button
            onClick={onGenerateNotes}
            disabled={speakerNotes?.status === 'loading'}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-kube-surface-light text-kube-muted hover:text-kube-warning border border-kube-border transition-colors disabled:opacity-50"
            title="Generate AI speaker notes (N)"
          >
            {speakerNotes?.status === 'loading' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Sparkles size={11} />
            )}
            Notes
          </button>
          <span>
            <span className="text-white font-medium">{currentIndex + 1}</span>
            {' / '}
            {totalSlides}
          </span>
        </span>

        <button
          onClick={onNext}
          disabled={currentIndex >= totalSlides - 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium bg-kube-blue text-white hover:bg-kube-blue/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
