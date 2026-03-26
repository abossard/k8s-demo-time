import { useState, useCallback, useRef } from 'react';

export interface GenerationStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  detail?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface SlideProgress {
  index: number;
  title: string;
  visualType?: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
  tokens: string;
  tokenCount: number;
  duration?: string;
  error?: string;
}

interface ProgressState {
  steps: GenerationStep[];
  slides: SlideProgress[];
  currentSlideIndex: number;
  liveTokens: string;
  totalSlides: number;
  completedSlides: number;
  startTime: number | null;
  elapsed: number;
  totalDuration: string | null;
  error: string | null;
  isDone: boolean;
}

export function useGenerationProgress() {
  const [state, setState] = useState<ProgressState>({
    steps: [],
    slides: [],
    currentSlideIndex: -1,
    liveTokens: '',
    totalSlides: 0,
    completedSlides: 0,
    startTime: null,
    elapsed: 0,
    totalDuration: null,
    error: null,
    isDone: false,
  });
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const reset = useCallback(() => {
    clearInterval(timerRef.current);
    setState({
      steps: [
        { id: 'scan', label: 'Scanning files', status: 'pending' },
        { id: 'yaml', label: 'Parsing YAML', status: 'pending' },
        { id: 'ai', label: 'AI curriculum analysis', status: 'pending' },
        { id: 'save', label: 'Saving curriculum', status: 'pending' },
      ],
      slides: [],
      currentSlideIndex: -1,
      liveTokens: '',
      totalSlides: 0,
      completedSlides: 0,
      startTime: Date.now(),
      elapsed: 0,
      totalDuration: null,
      error: null,
      isDone: false,
    });

    // Elapsed timer
    timerRef.current = setInterval(() => {
      setState(s => s.startTime ? { ...s, elapsed: Date.now() - s.startTime } : s);
    }, 100);
  }, []);

  const resetForSlides = useCallback((total: number) => {
    clearInterval(timerRef.current);
    const slideArr: SlideProgress[] = Array.from({ length: total }, (_, i) => ({
      index: i, title: `Slide ${i + 1}`, status: 'pending' as const,
      tokens: '', tokenCount: 0,
    }));

    setState(s => ({
      ...s,
      steps: [{ id: 'generate', label: 'Generating slides', status: 'active' }],
      slides: slideArr,
      currentSlideIndex: -1,
      liveTokens: '',
      totalSlides: total,
      completedSlides: 0,
      startTime: Date.now(),
      elapsed: 0,
      totalDuration: null,
      isDone: false,
      error: null,
    }));

    timerRef.current = setInterval(() => {
      setState(s => s.startTime ? { ...s, elapsed: Date.now() - s.startTime } : s);
    }, 100);
  }, []);

  const handleEvent = useCallback((data: any) => {
    console.log('[GenProgress] event:', data.type, data.step ?? '', data.detail?.slice(0, 40) ?? '');
    setState(s => {
      switch (data.type) {
        case 'progress': {
          const activeIndex = s.steps.findIndex(st => st.id === data.step);
          console.log('[GenProgress] step:', data.step, 'activeIndex:', activeIndex, 'current steps:', s.steps.map(st => `${st.id}:${st.status}`).join(', '));
          const steps = s.steps.map((step, idx) => {
            if (step.id === data.step) {
              return { ...step, status: 'active' as const, detail: data.detail, startedAt: step.startedAt ?? Date.now() };
            }
            // Only mark steps BEFORE the active one as done; leave later steps as pending
            if (idx < activeIndex && step.status !== 'done') {
              return { ...step, status: 'done' as const, completedAt: Date.now() };
            }
            return step;
          });
          console.log('[GenProgress] result:', steps.map(st => `${st.id}:${st.status}`).join(', '));
          return { ...s, steps };
        }

        case 'slide_start': {
          const slides = [...s.slides];
          if (slides[data.index]) {
            slides[data.index] = {
              ...slides[data.index]!,
              title: data.title,
              visualType: data.visualType,
              status: 'generating',
              tokens: '',
              tokenCount: 0,
            };
          }
          return { ...s, slides, currentSlideIndex: data.index, liveTokens: '', totalSlides: data.total };
        }

        case 'slide_token': {
          const slides = [...s.slides];
          if (slides[data.index]) {
            slides[data.index] = {
              ...slides[data.index]!,
              tokens: slides[data.index]!.tokens + (data.token ?? ''),
              tokenCount: data.tokenCount ?? slides[data.index]!.tokenCount + 1,
            };
          }
          return { ...s, slides, liveTokens: s.liveTokens + (data.token ?? '') };
        }

        case 'slide_complete': {
          const slides = [...s.slides];
          if (slides[data.index]) {
            slides[data.index] = {
              ...slides[data.index]!,
              title: data.title,
              visualType: data.visualType,
              status: 'ready',
              duration: data.duration,
              tokenCount: data.tokenCount,
            };
          }
          return {
            ...s,
            slides,
            completedSlides: data.completed ?? s.completedSlides + 1,
            liveTokens: '',
          };
        }

        case 'slide_error': {
          const slides = [...s.slides];
          if (slides[data.index]) {
            slides[data.index] = {
              ...slides[data.index]!,
              status: 'error',
              error: data.error,
            };
          }
          return { ...s, slides };
        }

        case 'done':
          clearInterval(timerRef.current);
          return { ...s, isDone: true, totalDuration: data.totalDuration ?? null };

        case 'error':
          clearInterval(timerRef.current);
          return { ...s, error: data.message };

        case 'complete':
          // Curriculum complete
          console.log('[GenProgress] COMPLETE — marking all done. Current:', s.steps.map(st => `${st.id}:${st.status}`).join(', '));
          return { ...s, steps: s.steps.map(st => ({ ...st, status: 'done' as const })), isDone: true };

        default:
          return s;
      }
    });
  }, []);

  return { ...state, reset, resetForSlides, handleEvent };
}
