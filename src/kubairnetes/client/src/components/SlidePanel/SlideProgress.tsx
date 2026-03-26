import type { AISlide } from '../../lib/types';

interface SlideProgressProps {
  slides: AISlide[];
  currentIndex: number;
  onGoTo: (index: number) => void;
}

export function SlideProgress({ slides, currentIndex, onGoTo }: SlideProgressProps) {
  return (
    <div className="px-4 py-2 border-b border-kube-border bg-kube-surface/50 shrink-0">
      {/* Progress bar */}
      <div className="flex gap-0.5 mb-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => onGoTo(i)}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i === currentIndex
                ? 'bg-kube-glow'
                : i < currentIndex
                  ? 'bg-kube-blue/50'
                  : 'bg-kube-surface-light'
            }`}
            title={slides[i]?.title}
          />
        ))}
      </div>

      {/* Slide list (compact) */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            onClick={() => onGoTo(i)}
            className={`shrink-0 px-2 py-1 rounded text-xs transition-colors ${
              i === currentIndex
                ? 'bg-kube-blue text-white font-medium'
                : 'bg-kube-surface-light text-kube-muted hover:text-white hover:bg-kube-surface-light/80'
            }`}
          >
            {i + 1}. {slide.title.length > 30 ? slide.title.slice(0, 30) + '…' : slide.title}
          </button>
        ))}
      </div>
    </div>
  );
}
