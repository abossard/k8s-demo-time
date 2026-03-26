import type {
  ClusterState, CommandExecution,
  FileEntry, AIPresentation, AISlide, K8sResource,
} from './types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ---- Files ----

export async function browseFiles(dirPath?: string): Promise<{ root: string; entries: FileEntry[] }> {
  const params = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
  return request(`/files/browse${params}`);
}

export async function getProjectRoot(): Promise<{ root: string }> {
  return request('/files/root');
}

// ---- Commands ----

export function executeCommand(
  command: string,
  dryRun: boolean,
  callbacks: {
    onOutput: (chunk: string) => void;
    onComplete: (result: { id: string; exitCode: number; status: string }) => void;
    onError: (message: string) => void;
  },
  cwd?: string,
): () => void {
  const controller = new AbortController();

  fetch(`${BASE}/commands/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, dryRun, cwd }),
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'output') callbacks.onOutput(data.chunk);
          else if (data.type === 'complete') callbacks.onComplete(data);
          else if (data.type === 'error') callbacks.onError(data.message);
        } catch { /* skip */ }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      callbacks.onError(err.message);
    }
  });

  return () => controller.abort();
}

export async function getCommandHistory(): Promise<CommandExecution[]> {
  return request('/commands/history');
}

export async function clearCommandHistory(): Promise<void> {
  await request('/commands/history', { method: 'DELETE' });
}

// ---- Chat ----

export function sendChatMessage(
  messages: { role: 'user' | 'assistant'; content: string }[],
  context: string | undefined,
  callbacks: {
    onToken: (token: string) => void;
    onDone: () => void;
    onError: (message: string) => void;
  },
): () => void {
  const controller = new AbortController();

  fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'token') callbacks.onToken(data.content);
          else if (data.type === 'done') callbacks.onDone();
          else if (data.type === 'error') callbacks.onError(data.message);
        } catch { /* skip */ }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      callbacks.onError(err.message);
    }
  });

  return () => controller.abort();
}

export async function explainCommand(command: string): Promise<{ explanation: string }> {
  return request('/chat/explain', {
    method: 'POST',
    body: JSON.stringify({ command }),
  });
}

export async function generateSpeakerNotes(
  slideTitle: string,
  slideContent: string,
): Promise<{ notes: string }> {
  return request('/chat/notes', {
    method: 'POST',
    body: JSON.stringify({ slideTitle, slideContent }),
  });
}

// ---- Decks ----

export async function listDecks(): Promise<any[]> {
  return request('/decks');
}

export function createDeck(
  readmePath: string,
  audienceLevel: 'beginner' | 'intermediate' | 'expert',
  callbacks: {
    onProgress: (step: string, detail: string) => void;
    onComplete: (data: { deck: any; curriculum: any[]; description: string }) => void;
    onError: (message: string) => void;
  },
): () => void {
  const controller = new AbortController();

  fetch(`${BASE}/decks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ readmePath, audienceLevel }),
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split('\n').filter(l => l.startsWith('data: '))) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'progress') callbacks.onProgress(data.step, data.detail);
          else if (data.type === 'complete') callbacks.onComplete(data);
          else if (data.type === 'error') callbacks.onError(data.message);
        } catch {}
      }
    }
  }).catch(err => { if (err.name !== 'AbortError') callbacks.onError(err.message); });

  return () => controller.abort();
}

export async function getDeck(id: string): Promise<any> {
  return request(`/decks/${id}`);
}

export async function deleteDeck(id: string): Promise<void> {
  await request(`/decks/${id}`, { method: 'DELETE' });
}

export async function updateCurriculum(deckId: string, items: any[]): Promise<{ curriculum: any[] }> {
  return request(`/decks/${deckId}/curriculum`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export function generateDeckSlides(
  deckId: string,
  callbacks: {
    onProgress: (detail: string) => void;
    onSlideReady: (index: number, slide: any) => void;
    onSlideError: (index: number, error: string) => void;
    onDone: () => void;
    onError: (message: string) => void;
    onRawEvent?: (data: any) => void;
  },
): () => void {
  const controller = new AbortController();

  fetch(`${BASE}/decks/${deckId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split('\n').filter(l => l.startsWith('data: '))) {
        try {
          const data = JSON.parse(line.slice(6));
          callbacks.onRawEvent?.(data);
          if (data.type === 'progress') callbacks.onProgress(data.detail ?? data.title);
          else if (data.type === 'slide_complete') callbacks.onSlideReady(data.index, data.slide);
          else if (data.type === 'slide_error') callbacks.onSlideError(data.index, data.error);
          else if (data.type === 'done') callbacks.onDone();
          else if (data.type === 'error') callbacks.onError(data.message);
        } catch {}
      }
    }
  }).catch(err => { if (err.name !== 'AbortError') callbacks.onError(err.message); });

  return () => controller.abort();
}

export async function regenerateDeckSlide(deckId: string, slideId: string, feedback?: string): Promise<{ slide: any }> {
  return request(`/decks/${deckId}/slides/${slideId}/regenerate`, {
    method: 'POST',
    body: JSON.stringify({ feedback }),
  });
}

// ---- Models ----

export async function getModels(): Promise<{ models: { id: string; label: string; description: string }[]; current: string }> {
  return request('/models');
}

export async function setModel(model: string): Promise<{ model: string }> {
  return request('/models', { method: 'PUT', body: JSON.stringify({ model }) });
}

// ---- Cluster ----

export async function getClusterState(namespace?: string): Promise<ClusterState> {
  const params = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
  return request(`/cluster/state${params}`);
}
