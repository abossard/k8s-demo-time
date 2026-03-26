import { chat, chatStream } from './copilot-sdk.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `You are KubAIrnetes, an expert Kubernetes instructor and guide. You help users understand Kubernetes concepts, tutorials, and YAML manifests.

Your role:
- Explain Kubernetes concepts clearly and concisely
- Help users understand kubectl commands and their effects
- Explain YAML manifests and their purpose
- Answer questions about the tutorial content being presented
- Provide additional context and best practices

Style:
- Be concise but thorough
- Use code blocks for commands and YAML
- Reference specific Kubernetes documentation when helpful
- If a command could be dangerous, warn the user
- Use analogies to explain complex concepts`;

export async function chatWithCopilot(
  messages: ChatMessage[],
  context?: string,
  onToken?: (token: string) => void,
): Promise<string> {
  const systemContent = context
    ? `${SYSTEM_PROMPT}\n\nCurrent context:\n${context}`
    : SYSTEM_PROMPT;

  const userContent = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n\n');

  if (onToken) {
    return chatStream(systemContent, userContent, onToken);
  }
  return chat(systemContent, userContent);
}

export async function generateSpeakerNotes(slideTitle: string, slideContent: string): Promise<string> {
  return chat(
    `You are writing speaker notes for a Kubernetes tutorial presentation. Generate concise presenter notes that:
- Summarize the key points to emphasize
- Suggest what to demo or show live
- Note any gotchas or common questions from the audience
- Include transition phrases to the next topic
- Keep it to 3-5 bullet points, each 1-2 sentences
Format as a bulleted list using "•" characters. Be practical and actionable.`,
    `Generate speaker notes for this slide:\n\n# ${slideTitle}\n\n${slideContent}`,
  );
}

export async function explainCommand(command: string): Promise<string> {
  return chat(
    'You are a Kubernetes expert. Explain the given kubectl/k8s command concisely. Include: what it does, key flags, expected output, and any risks. Keep it under 200 words.',
    `Explain this command:\n\`\`\`\n${command}\n\`\`\``,
  );
}
