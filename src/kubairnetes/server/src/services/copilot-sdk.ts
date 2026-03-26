import { CopilotClient, approveAll, type ModelInfo } from '@github/copilot-sdk';

let client: CopilotClient | null = null;
let currentModel = 'gpt-4o';

async function getClient(): Promise<CopilotClient> {
  if (!client) {
    client = new CopilotClient({ logLevel: 'warning' });
    await client.start();
  }
  return client;
}

// ---- Model Management ----

export async function listModels(): Promise<{ id: string; label: string; description: string }[]> {
  const c = await getClient();
  const models = await c.listModels();
  return models.map((m: ModelInfo) => ({
    id: m.id,
    label: m.name ?? m.id,
    description: m.capabilities?.limits ? `ctx: ${m.capabilities.limits.max_context_window_tokens}` : '',
  }));
}

export function setModel(model: string) { currentModel = model; }
export function getModel(): string { return currentModel; }

// ---- Chat (non-streaming, optimized for speed) ----

export async function chat(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const c = await getClient();

  await using session = await c.createSession({
    model: currentModel,
    onPermissionRequest: approveAll,
    systemMessage: { mode: 'replace', content: systemPrompt },
    streaming: false,
    availableTools: [], // no tools needed — pure text generation
  });

  const result = await session.sendAndWait(
    { prompt: userMessage },
    120_000,
  );

  return result?.data?.content ?? '';
}

// ---- Chat (streaming tokens) ----

export async function chatStream(
  systemPrompt: string,
  userMessage: string,
  onToken: (token: string) => void,
): Promise<string> {
  const c = await getClient();

  await using session = await c.createSession({
    model: currentModel,
    onPermissionRequest: approveAll,
    systemMessage: { mode: 'replace', content: systemPrompt },
  });

  // Listen for streaming deltas
  session.on('assistant.message_delta', (event) => {
    const delta = (event as any).data?.content ?? '';
    if (delta) onToken(delta);
  });

  const result = await session.sendAndWait(
    { prompt: userMessage },
    120_000,
  );

  return result?.data?.content ?? '';
}

// ---- Cleanup ----

export async function stopClient(): Promise<void> {
  if (client) {
    await client.stop();
    client = null;
  }
}

