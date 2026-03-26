import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { FilePicker } from './components/FilePicker';
import { DeckManager } from './components/DeckManager';
import { CurriculumEditor } from './components/CurriculumEditor';
import { GenerationDashboard } from './components/GenerationDashboard';
import { SlidePanel } from './components/SlidePanel/SlidePanel';
import { RightPanel } from './components/RightPanel/RightPanel';
import { ChatPanel } from './components/ChatPanel';
import { CommandHistory } from './components/CommandHistory';
import { PresenterMode } from './components/PresenterMode';
import { KeyboardHelp } from './components/KeyboardHelp';
import { useAppRouter } from './hooks/useAppRouter';
import { useSlides } from './hooks/useSlides';
import { useCommand } from './hooks/useCommand';
import { useChat } from './hooks/useChat';
import { useClusterState } from './hooks/useClusterState';
import { useSpeakerNotes } from './hooks/useSpeakerNotes';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useGenerationProgress } from './hooks/useGenerationProgress';
import {
  createDeck as apiCreateDeck,
  getDeck as apiGetDeck,
  updateCurriculum as apiUpdateCurriculum,
  generateDeckSlides as apiGenerateSlides,
  regenerateDeckSlide as apiRegenerateSlide,
} from './lib/api';

export function App() {
  const { state: appState, dispatch } = useAppRouter();

  // UI toggles (overlays, not navigation)
  const [showChat, setShowChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPresenter, setShowPresenter] = useState(false);
  const [dryRunEnabled, setDryRunEnabled] = useState(false);

  // Loaded deck data (populated when entering curriculum/generating/presenting)
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [deckTitle, setDeckTitle] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [readmePath, setReadmePath] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const slides = useSlides();
  const command = useCommand();
  const chat = useChat();
  const cluster = useClusterState();
  const speakerNotes = useSpeakerNotes();
  const genProgress = useGenerationProgress();

  // Sync slide index to URL
  useEffect(() => {
    if (appState.screen === 'presenting' && slides.currentIndex !== appState.slideIndex) {
      dispatch({ type: 'SET_SLIDE', slideIndex: slides.currentIndex });
    }
  }, [slides.currentIndex]);

  // Clean up polling when leaving generating screen
  useEffect(() => {
    if (appState.screen !== 'generating') clearInterval(pollRef.current);
    return () => clearInterval(pollRef.current);
  }, [appState.screen]);

  // ---- Actions ----

  const handleCreateDeck = (selectedReadme: string) => {
    setReadmePath(selectedReadme);
    dispatch({ type: 'START_GENERATING', mode: 'curriculum' });
    genProgress.reset();

    apiCreateDeck(selectedReadme, 'intermediate', {
      onProgress(step, detail) {
        genProgress.handleEvent({ type: 'progress', step, detail });
      },
      onComplete(data) {
        genProgress.handleEvent({ type: 'complete' });
        setCurriculum(data.curriculum);
        setDeckTitle(data.deck.title);
        setDeckDescription(data.description);
        setReadmePath(data.deck.readme_path);
        setTimeout(() => dispatch({ type: 'DECK_CREATED', deckId: data.deck.id }), 800);
      },
      onError(message) {
        genProgress.handleEvent({ type: 'error', message });
      },
    });
  };

  const handleLoadDeck = async (deckId: string) => {
    try {
      const full = await apiGetDeck(deckId);
      setDeckTitle(full.deck.title);
      setReadmePath(full.deck.readme_path);
      setCurriculum(full.curriculum);

      dispatch({ type: 'LOAD_DECK', deckId, status: full.deck.status, hasSlides: full.slides.length > 0 });

      if (full.deck.status === 'generating') {
        // Poll for updates
        genProgress.resetForSlides((full.slideRecords ?? []).length);
        seedProgressFromRecords(full);
        startPolling(deckId);
      } else if (full.deck.status === 'ready' && full.slides.length > 0) {
        slides.loadFromDeck(full.deck, full.slides, full.yamlFiles, full.mermaidDiagram);
      }
    } catch (err: any) {
      console.error('Failed to load deck:', err);
    }
  };

  const handleApproveAndGenerate = () => {
    if (appState.screen !== 'curriculum_editor') return;
    const deckId = appState.deckId;

    const items = curriculum.map((c, i) => ({ ...c, order_num: i + 1 }));
    apiUpdateCurriculum(deckId, items);
    dispatch({ type: 'START_GENERATING', mode: 'slides' });

    const approvedCount = items.filter(i => i.approved).length;
    genProgress.resetForSlides(approvedCount);

    apiGenerateSlides(deckId, {
      onProgress() {},
      onSlideReady(index, slide) {
        genProgress.handleEvent({ type: 'slide_complete', index, title: slide.title, completed: index + 1, total: approvedCount });
      },
      onSlideError(index, error) {
        genProgress.handleEvent({ type: 'slide_error', index, error });
      },
      onRawEvent(data) { genProgress.handleEvent(data); },
      async onDone() {
        genProgress.handleEvent({ type: 'done' });
        try {
          const full = await apiGetDeck(deckId);
          slides.loadFromDeck(full.deck, full.slides, full.yamlFiles, full.mermaidDiagram);
          setTimeout(() => dispatch({ type: 'GENERATION_DONE' }), 1000);
        } catch {
          dispatch({ type: 'GO_CURRICULUM', deckId });
        }
      },
      onError(message) { genProgress.handleEvent({ type: 'error', message }); },
    });
  };

  const handleRunCommand = (cmd: string) => {
    const cwd = readmePath ? readmePath.replace(/\/[^/]+$/, '') : undefined;
    command.execute(cmd, dryRunEnabled, cwd);
  };

  const handleAskAbout = (text: string) => {
    chat.sendMessage(text, slides.currentSlide?.explanation);
    setShowChat(true);
  };

  const handleGenerateNotes = useCallback(() => {
    if (slides.currentSlide) {
      speakerNotes.getNotes(slides.currentSlide.id, slides.currentSlide.title, slides.currentSlide.explanation);
    }
  }, [slides.currentSlide, speakerNotes]);

  const handleRegenerateSlide = useCallback(async () => {
    if (!slides.currentSlide || appState.screen !== 'presenting') return;
    const deckId = appState.deckId;
    try {
      const full = await apiGetDeck(deckId);
      setCurriculum(full.curriculum);
      setDeckTitle(full.deck.title);
      dispatch({ type: 'GO_CURRICULUM', deckId });
    } catch {}
  }, [slides.currentSlide, appState, dispatch]);

  // Polling helper for in-progress decks
  function seedProgressFromRecords(full: any) {
    for (const record of full.slideRecords ?? []) {
      if (record.status === 'ready') {
        const slide = full.slides.find((s: any) => s.id === record.id);
        genProgress.handleEvent({
          type: 'slide_complete', index: record.order_num - 1, total: (full.slideRecords ?? []).length,
          title: slide?.title ?? 'Slide', completed: (full.slideRecords ?? []).filter((r: any) => r.status === 'ready').length,
        });
      }
    }
  }

  function startPolling(deckId: string) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const updated = await apiGetDeck(deckId);
        if (updated.deck.status === 'ready') {
          clearInterval(pollRef.current);
          genProgress.handleEvent({ type: 'done' });
          slides.loadFromDeck(updated.deck, updated.slides, updated.yamlFiles, updated.mermaidDiagram);
          setTimeout(() => dispatch({ type: 'GENERATION_DONE' }), 1000);
        } else {
          seedProgressFromRecords(updated);
        }
      } catch {}
    }, 3000);
  }

  const currentNotes = slides.currentSlide ? speakerNotes.getNotesForSlide(slides.currentSlide.id) : null;

  // Keyboard shortcuts
  const keyboardActions = useMemo(() => ({
    onToggleChat: () => setShowChat(s => !s),
    onToggleHistory: () => setShowHistory(s => !s),
    onTogglePresenter: () => setShowPresenter(s => !s),
    onToggleDryRun: () => setDryRunEnabled(s => !s),
    onOpenFilePicker: () => dispatch({ type: 'GO_DECK_MANAGER' }),
    onGenerateNotes: handleGenerateNotes,
    onEscape: () => { setShowChat(false); setShowHistory(false); setShowPresenter(false); },
  }), [handleGenerateNotes, dispatch]);

  const { showHelp, setShowHelp } = useKeyboardShortcuts(keyboardActions);

  // ---- Shared header for non-presenting screens ----
  const minimalHeader = (
    <Header
      presentation={null}
      onToggleFilePicker={() => dispatch({ type: 'GO_DECK_MANAGER' })}
      onToggleChat={() => {}} onToggleHistory={() => {}}
      onTogglePresenter={() => {}} onToggleHelp={() => setShowHelp(s => !s)}
      showChat={false} showHistory={false}
      dryRunEnabled={false} onToggleDryRun={() => {}}
    />
  );

  // ======== RENDER BY STATE ========

  switch (appState.screen) {
    case 'deck_manager':
      return (
        <div className="h-screen bg-kube-dark flex flex-col">
          {minimalHeader}
          <DeckManager onLoadDeck={handleLoadDeck} onCreateNew={() => dispatch({ type: 'GO_FILE_PICKER' })} />
          {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}
        </div>
      );

    case 'file_picker':
      return (
        <div className="h-screen bg-kube-dark flex flex-col">
          {minimalHeader}
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <FilePicker onSelect={handleCreateDeck} />
          </div>
        </div>
      );

    case 'generating':
      return (
        <div className="h-screen bg-kube-dark flex flex-col">
          {minimalHeader}
          <GenerationDashboard
            steps={genProgress.steps} slides={genProgress.slides}
            currentSlideIndex={genProgress.currentSlideIndex} liveTokens={genProgress.liveTokens}
            totalSlides={genProgress.totalSlides} completedSlides={genProgress.completedSlides}
            elapsed={genProgress.elapsed} totalDuration={genProgress.totalDuration}
            error={genProgress.error} isDone={genProgress.isDone}
            mode={appState.mode}
          />
        </div>
      );

    case 'curriculum_editor':
      return (
        <div className="h-screen bg-kube-dark flex flex-col">
          {minimalHeader}
          <CurriculumEditor
            deckTitle={deckTitle} description={deckDescription}
            items={curriculum} onUpdate={setCurriculum}
            onApproveAndGenerate={handleApproveAndGenerate}
            onBack={() => dispatch({ type: 'GO_DECK_MANAGER' })}
            isGenerating={false}
          />
        </div>
      );

    case 'presenting': {
      if (!slides.presentation) {
        // Slides not loaded yet — load from deck
        handleLoadDeck(appState.deckId);
        return <div className="h-screen bg-kube-dark flex items-center justify-center text-kube-muted">Loading deck...</div>;
      }

      return (
        <div className="h-screen bg-kube-dark flex flex-col overflow-hidden">
          <Header
            presentation={slides.presentation}
            onToggleFilePicker={() => dispatch({ type: 'GO_DECK_MANAGER' })}
            onToggleChat={() => setShowChat(s => !s)}
            onToggleHistory={() => setShowHistory(s => !s)}
            onTogglePresenter={() => setShowPresenter(s => !s)}
            onToggleHelp={() => setShowHelp(s => !s)}
            showChat={showChat} showHistory={showHistory}
            dryRunEnabled={dryRunEnabled}
            onToggleDryRun={() => setDryRunEnabled(s => !s)}
            fromCache={false}
            onRegenerate={() => dispatch({ type: 'GO_CURRICULUM', deckId: appState.deckId })}
          />

          <div className="flex-1 flex overflow-hidden">
            <div className="w-1/2 min-w-[400px] flex flex-col border-r border-kube-border">
              <SlidePanel
                presentation={slides.presentation}
                currentIndex={slides.currentIndex}
                currentSlide={slides.currentSlide}
                totalSlides={slides.totalSlides}
                onNext={slides.nextSlide} onPrev={slides.prevSlide} onGoTo={slides.goToSlide}
                onRunCommand={handleRunCommand} onAskAbout={handleAskAbout}
                dryRunEnabled={dryRunEnabled}
                speakerNotes={currentNotes} onGenerateNotes={handleGenerateNotes}
                onRegenerateSlide={handleRegenerateSlide} isRegenerating={false}
              />
            </div>
            <div className="resizer" />
            <div className="flex-1 flex flex-col min-w-[400px]">
              <RightPanel
                commandOutput={command.output} isRunning={command.isRunning}
                currentCommand={command.currentCommand} onClearOutput={command.clearOutput}
                clusterState={cluster.clusterState} onRefreshCluster={() => cluster.refresh()}
                isClusterLoading={cluster.isLoading} isClusterWatching={cluster.isWatching}
                onStartWatching={(ns) => cluster.startWatching(ns)}
                onStopWatching={() => cluster.stopWatching()}
                clusterError={cluster.error}
                mermaidDiagram={slides.mermaidDiagram} yamlFiles={slides.yamlFiles}
              />
            </div>
          </div>

          {showChat && (
            <ChatPanel messages={chat.messages} isStreaming={chat.isStreaming}
              onSendMessage={(msg) => chat.sendMessage(msg, slides.currentSlide?.explanation)}
              onClear={chat.clearChat} onClose={() => setShowChat(false)} />
          )}
          {showHistory && (
            <CommandHistory history={command.history} onClose={() => setShowHistory(false)} onRerun={handleRunCommand} />
          )}
          {showPresenter && slides.presentation && (
            <PresenterMode
              presentation={slides.presentation} currentIndex={slides.currentIndex}
              currentSlide={slides.currentSlide} totalSlides={slides.totalSlides}
              onNext={slides.nextSlide} onPrev={slides.prevSlide} onGoTo={slides.goToSlide}
              onClose={() => setShowPresenter(false)}
              speakerNotes={currentNotes} onGenerateNotes={handleGenerateNotes} />
          )}
          {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}
        </div>
      );
    }
  }
}
