import { useState, useCallback, useEffect } from 'react';
import type { AIPresentation, AISlide, K8sResource } from '../lib/types';

interface SlidesState {
  presentation: AIPresentation | null;
  yamlFiles: K8sResource[];
  mermaidDiagram: string | null;
  currentIndex: number;
}

export function useSlides() {
  const [state, setState] = useState<SlidesState>({
    presentation: null,
    yamlFiles: [],
    mermaidDiagram: null,
    currentIndex: 0,
  });

  const loadFromDeck = useCallback((
    deck: any,
    slides: AISlide[],
    yamlFiles: K8sResource[],
    mermaidDiagram: string | null,
  ) => {
    setState({
      presentation: {
        title: deck.title,
        description: '',
        audienceLevel: deck.audience_level,
        slides: slides.filter(s => (s as any)._status !== 'error' && (s as any)._status !== 'pending'),
        generatedAt: deck.updated_at,
        sourceHash: deck.content_hash ?? '',
      },
      yamlFiles: yamlFiles ?? [],
      mermaidDiagram,
      currentIndex: 0,
    });
  }, []);

  const currentSlide: AISlide | null =
    state.presentation?.slides[state.currentIndex] ?? null;

  const totalSlides = state.presentation?.slides.length ?? 0;

  const goToSlide = useCallback((index: number) => {
    setState(s => ({
      ...s,
      currentIndex: Math.max(0, Math.min(index, (s.presentation?.slides.length ?? 1) - 1)),
    }));
  }, []);

  const nextSlide = useCallback(() => {
    setState(s => ({
      ...s,
      currentIndex: Math.min(s.currentIndex + 1, (s.presentation?.slides.length ?? 1) - 1),
    }));
  }, []);

  const prevSlide = useCallback(() => {
    setState(s => ({
      ...s,
      currentIndex: Math.max(s.currentIndex - 1, 0),
    }));
  }, []);

  const updateSlide = useCallback((slideId: string, newSlide: AISlide) => {
    setState(s => {
      if (!s.presentation) return s;
      const slides = s.presentation.slides.map(sl => sl.id === slideId ? newSlide : sl);
      return { ...s, presentation: { ...s.presentation, slides } };
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextSlide(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prevSlide(); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  return {
    presentation: state.presentation,
    yamlFiles: state.yamlFiles,
    mermaidDiagram: state.mermaidDiagram,
    currentIndex: state.currentIndex,
    currentSlide,
    totalSlides,
    loadFromDeck,
    goToSlide,
    nextSlide,
    prevSlide,
    updateSlide,
  };
}
