import { useReducer, useEffect, useCallback } from 'react';

// ---- Typed App State (finite state machine) ----

export type AppState =
  | { screen: 'deck_manager' }
  | { screen: 'file_picker' }
  | { screen: 'curriculum_editor'; deckId: string }
  | { screen: 'generating'; deckId: string; mode: 'curriculum' | 'slides' }
  | { screen: 'presenting'; deckId: string; slideIndex: number };

export type AppAction =
  | { type: 'GO_DECK_MANAGER' }
  | { type: 'GO_FILE_PICKER' }
  | { type: 'DECK_CREATED'; deckId: string }
  | { type: 'LOAD_DECK'; deckId: string; status: string; hasSlides: boolean }
  | { type: 'START_GENERATING'; mode: 'curriculum' | 'slides' }
  | { type: 'GENERATION_DONE' }
  | { type: 'GO_CURRICULUM'; deckId: string }
  | { type: 'GO_PRESENTING'; deckId: string; slideIndex?: number }
  | { type: 'SET_SLIDE'; slideIndex: number }
  | { type: 'FROM_URL'; state: AppState };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'GO_DECK_MANAGER':
      return { screen: 'deck_manager' };

    case 'GO_FILE_PICKER':
      return { screen: 'file_picker' };

    case 'DECK_CREATED':
      return { screen: 'curriculum_editor', deckId: action.deckId };

    case 'LOAD_DECK': {
      const id = action.deckId;
      if (action.status === 'generating')
        return { screen: 'generating', deckId: id, mode: 'slides' };
      if (action.status === 'ready' && action.hasSlides)
        return { screen: 'presenting', deckId: id, slideIndex: 0 };
      return { screen: 'curriculum_editor', deckId: id };
    }

    case 'START_GENERATING':
      if ('deckId' in state || state.screen === 'file_picker')
        return { screen: 'generating', deckId: (state as any).deckId ?? '', mode: action.mode };
      return state;

    case 'GENERATION_DONE':
      if (state.screen === 'generating')
        return { screen: 'presenting', deckId: state.deckId, slideIndex: 0 };
      return state;

    case 'GO_CURRICULUM':
      return { screen: 'curriculum_editor', deckId: action.deckId };

    case 'GO_PRESENTING':
      return { screen: 'presenting', deckId: action.deckId, slideIndex: action.slideIndex ?? 0 };

    case 'SET_SLIDE':
      if (state.screen === 'presenting')
        return { ...state, slideIndex: action.slideIndex };
      return state;

    case 'FROM_URL':
      return action.state;

    default:
      return state;
  }
}

// ---- URL ↔ State sync ----

function stateToHash(state: AppState): string {
  switch (state.screen) {
    case 'deck_manager': return '#/';
    case 'file_picker': return '#/new';
    case 'curriculum_editor': return `#/deck/${state.deckId}/curriculum`;
    case 'generating': return `#/deck/${state.deckId}/generating`;
    case 'presenting': return `#/deck/${state.deckId}/present/${state.slideIndex}`;
  }
}

function hashToState(hash: string): AppState | null {
  const h = hash.replace(/^#/, '') || '/';

  if (h === '/' || h === '') return { screen: 'deck_manager' };
  if (h === '/new') return { screen: 'file_picker' };

  const deckCurriculum = h.match(/^\/deck\/([^/]+)\/curriculum$/);
  if (deckCurriculum) return { screen: 'curriculum_editor', deckId: deckCurriculum[1]! };

  const deckGenerating = h.match(/^\/deck\/([^/]+)\/generating$/);
  if (deckGenerating) return { screen: 'generating', deckId: deckGenerating[1]!, mode: 'slides' };

  const deckPresent = h.match(/^\/deck\/([^/]+)\/present(?:\/(\d+))?$/);
  if (deckPresent) return { screen: 'presenting', deckId: deckPresent[1]!, slideIndex: parseInt(deckPresent[2] ?? '0') };

  return null;
}

// ---- Hook ----

export function useAppRouter() {
  const initial = hashToState(window.location.hash) ?? { screen: 'deck_manager' as const };
  const [state, dispatch] = useReducer(reducer, initial);

  // Sync state → URL (push hash without triggering hashchange handler)
  useEffect(() => {
    const newHash = stateToHash(state);
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash);
    }
  }, [state]);

  // Sync URL → state (on popstate / hashchange)
  useEffect(() => {
    function onHashChange() {
      const parsed = hashToState(window.location.hash);
      if (parsed) {
        dispatch({ type: 'FROM_URL', state: parsed });
      }
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return { state, dispatch };
}
