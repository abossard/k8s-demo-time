import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X, ChevronLeft, ChevronRight, Clock, Sparkles, Loader2,
} from 'lucide-react';
import type { AIPresentation, AISlide } from '../lib/types';

interface PresenterModeProps {
  presentation: AIPresentation;
  currentIndex: number;
  currentSlide: AISlide | null;
  totalSlides: number;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (index: number) => void;
  onClose: () => void;
  speakerNotes: { notes: string; status: string } | null;
  onGenerateNotes: () => void;
}

function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const toggle = () => setIsRunning(r => !r);
  const reset = () => { setSeconds(0); setIsRunning(true); };

  const formatted = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  return { formatted, isRunning, toggle, reset };
}

export function PresenterMode({
  presentation,
  currentIndex,
  currentSlide,
  totalSlides,
  onNext,
  onPrev,
  onGoTo,
  onClose,
  speakerNotes,
  onGenerateNotes,
}: PresenterModeProps) {
  const timer = useTimer();
  const nextSlide = presentation.slides[currentIndex + 1] ?? null;

  // Keyboard nav within presenter mode
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onNext, onPrev, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-kube-dark flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-kube-surface border-b border-kube-border shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold text-kube-glow">☸️ Presenter Mode</h2>
          <span className="text-xs text-kube-muted">
            {presentation.title}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-kube-muted" />
            <button
              onClick={timer.toggle}
              className="font-mono text-lg text-white tabular-nums"
              title={timer.isRunning ? 'Pause timer' : 'Resume timer'}
            >
              {timer.formatted}
            </button>
            <button
              onClick={timer.reset}
              className="text-xs text-kube-muted hover:text-white transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Slide counter */}
          <span className="text-sm text-kube-muted">
            <span className="text-white font-medium">{currentIndex + 1}</span>
            {' / '}
            {totalSlides}
          </span>

          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-kube-surface-light text-kube-muted hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Current slide (large) */}
        <div className="flex-1 flex flex-col border-r border-kube-border">
          <div className="px-4 py-2 bg-kube-surface/30 border-b border-kube-border">
            <span className="text-xs font-medium text-kube-muted uppercase tracking-wider">
              Current Slide
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-8">
            {currentSlide && (
              <div className="slide-content max-w-3xl mx-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {currentSlide.explanation}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Right column: next slide + notes */}
        <div className="w-[400px] flex flex-col shrink-0">
          {/* Next slide preview */}
          <div className="flex-1 flex flex-col border-b border-kube-border">
            <div className="px-4 py-2 bg-kube-surface/30 border-b border-kube-border">
              <span className="text-xs font-medium text-kube-muted uppercase tracking-wider">
                Next Slide
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {nextSlide ? (
                <div className="slide-content text-sm opacity-70 scale-90 origin-top-left">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {nextSlide.explanation}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-kube-muted text-sm">
                  Last slide — end of presentation
                </div>
              )}
            </div>
          </div>

          {/* Speaker notes */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-2 bg-kube-surface/30 border-b border-kube-border flex items-center justify-between">
              <span className="text-xs font-medium text-kube-muted uppercase tracking-wider">
                Speaker Notes
              </span>
              <button
                onClick={onGenerateNotes}
                disabled={speakerNotes?.status === 'loading'}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-kube-surface-light text-kube-muted hover:text-kube-warning border border-kube-border transition-colors disabled:opacity-50"
              >
                {speakerNotes?.status === 'loading' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                {speakerNotes?.status === 'ready' ? 'Regenerate' : 'Generate'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!speakerNotes && (
                <div className="flex flex-col items-center justify-center h-full text-kube-muted text-sm gap-2">
                  <Sparkles size={20} className="opacity-30" />
                  <span>Press <kbd className="px-1.5 py-0.5 rounded bg-kube-surface-light border border-kube-border text-xs font-mono">N</kbd> to generate AI notes</span>
                </div>
              )}
              {speakerNotes?.status === 'loading' && (
                <div className="flex items-center gap-2 text-kube-muted text-sm">
                  <Loader2 size={14} className="animate-spin" />
                  Generating speaker notes...
                </div>
              )}
              {speakerNotes?.status === 'ready' && (
                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {speakerNotes.notes}
                </div>
              )}
              {speakerNotes?.status === 'error' && (
                <div className="text-sm text-kube-danger">
                  {speakerNotes.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between px-6 py-3 bg-kube-surface border-t border-kube-border shrink-0">
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-4 py-2 rounded text-sm font-medium bg-kube-surface-light border border-kube-border text-kube-muted hover:text-white disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        {/* Slide dots */}
        <div className="flex gap-1.5 max-w-[600px] overflow-x-auto">
          {presentation.slides.map((_, i) => (
            <button
              key={i}
              onClick={() => onGoTo(i)}
              className={`w-3 h-3 rounded-full transition-colors shrink-0 ${
                i === currentIndex
                  ? 'bg-kube-glow'
                  : i < currentIndex
                    ? 'bg-kube-blue/50'
                    : 'bg-kube-surface-light'
              }`}
              title={presentation.slides[i]?.title}
            />
          ))}
        </div>

        <button
          onClick={onNext}
          disabled={currentIndex >= totalSlides - 1}
          className="flex items-center gap-1 px-4 py-2 rounded text-sm font-medium bg-kube-blue text-white hover:bg-kube-blue/80 disabled:opacity-30 transition-colors"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
