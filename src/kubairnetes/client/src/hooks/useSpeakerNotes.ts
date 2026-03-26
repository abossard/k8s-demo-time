import { useState, useCallback } from 'react';
import { generateSpeakerNotes } from '../lib/api';

interface NotesCache {
  [slideId: string]: {
    notes: string;
    status: 'loading' | 'ready' | 'error';
  };
}

export function useSpeakerNotes() {
  const [cache, setCache] = useState<NotesCache>({});

  const getNotes = useCallback(
    async (slideId: string, slideTitle: string, slideContent: string) => {
      // Return cached notes if available
      if (cache[slideId]?.status === 'ready' || cache[slideId]?.status === 'loading') {
        return;
      }

      setCache(prev => ({
        ...prev,
        [slideId]: { notes: '', status: 'loading' },
      }));

      try {
        const { notes } = await generateSpeakerNotes(slideTitle, slideContent);
        setCache(prev => ({
          ...prev,
          [slideId]: { notes, status: 'ready' },
        }));
      } catch (err: any) {
        setCache(prev => ({
          ...prev,
          [slideId]: { notes: `Error: ${err.message}`, status: 'error' },
        }));
      }
    },
    [cache],
  );

  const getNotesForSlide = useCallback(
    (slideId: string) => cache[slideId] ?? null,
    [cache],
  );

  const clearNotes = useCallback(() => setCache({}), []);

  return { getNotes, getNotesForSlide, clearNotes };
}
