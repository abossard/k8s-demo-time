import type { K8sResource } from '../utils/k8s-yaml.js';
import { extractJson, tryParseJson } from '../utils/json.js';
import {
  listModels as sdkListModels,
  chat as sdkChat,
  chatStream as sdkChatStream,
  setModel as sdkSetModel,
  getModel as sdkGetModel,
} from './copilot-sdk.js';

// ---- Types for AI-generated presentations ----

export interface AIPresentation {
  title: string;
  description: string;
  audienceLevel: 'beginner' | 'intermediate' | 'expert';
  slides: AISlide[];
  generatedAt: string;
  sourceHash: string;
}

export interface AISlide {
  id: string;
  title: string;
  subtitle?: string;
  headline: string;
  explanation: string;
  buildSteps: BuildStep[];
  keyTakeaways: string[];
  visuals: SlideVisual[];
  commands: AICommand[];
  speakerNotes: string;
  transition?: string;
  rawSection?: string;
  order: number;
}

export interface BuildStep {
  type: 'text' | 'code' | 'command' | 'visual_highlight' | 'reveal';
  content: string;
  label?: string;
}

export interface SlideVisual {
  type: 'hpa' | 'probes' | 'resources' | 'qos' | 'vpa' | 'rollout' | 'mermaid' | 'architecture' | 'custom' | 'none';
  mermaidCode?: string;
  customCode?: string;
  description?: string;
  config?: Record<string, unknown>;
}

export interface AICommand {
  raw: string;
  explanation: string;
  expectedOutcome: string;
  isDangerous: boolean;
  order: number;
}

// ---- Model management — delegates to Copilot SDK ----

export function setModel(model: string) { sdkSetModel(model); }
export function getModel(): string { return sdkGetModel(); }

export async function fetchAvailableModels(): Promise<{ id: string; label: string; description: string }[]> {
  return sdkListModels();
}

// ---- AI call via Copilot SDK ----

async function callModel(
  messages: { role: string; content: string }[],
  _maxTokens = 4096,
  onToken?: (token: string) => void,
): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? '';
  const userMsg = messages.filter(m => m.role === 'user').map(m => m.content).join('\n\n');

  if (onToken) {
    return sdkChatStream(systemMsg, userMsg, onToken);
  }
  return sdkChat(systemMsg, userMsg);
}

// ---- Presentation generation ----

const VISUAL_TYPES = `Available visual types:
PRESET VISUALS (use these when they match the concept):
- "hpa": Interactive pod autoscaler — user drags CPU load, pods scale up/down.
- "probes": Traffic-light probe simulator — user toggles probes, sees pod health effect.
- "resources": CPU/Memory bar chart — user drags usage slider, sees throttling and OOMKill.
- "qos": Eviction priority pyramid — user drags memory pressure, sees eviction order.
- "vpa": VPA resource resize animation — shows observe → recommend → apply cycle.
- "rollout": Rolling update animation — user clicks play, sees pods update one by one.
- "mermaid": Custom Mermaid diagram — you write the Mermaid code in "mermaidCode".
- "architecture": Show the K8s YAML architecture diagram.

CUSTOM VISUAL (use when no preset fits — you write the code!):
- "custom": You write a React component as a JavaScript function body in "customCode".
  The code receives { React, useState, useEffect } as arguments and must return a React element.
  Example customCode:
  "const [count, setCount] = useState(3);\\nreturn React.createElement('div', {style:{padding:16,border:'1px solid #475569',borderRadius:12,background:'#0f172a'}},\\n  React.createElement('h3', {style:{color:'#60a5fa',fontSize:14,marginBottom:8}}, 'Pod Replicas: ' + count),\\n  React.createElement('input', {type:'range',min:1,max:10,value:count,onChange:e=>setCount(Number(e.target.value)),style:{width:'100%'}}),\\n  React.createElement('div', {style:{display:'flex',gap:4,marginTop:8,flexWrap:'wrap'}}, Array.from({length:count},(_,i)=>React.createElement('div',{key:i,style:{width:32,height:32,borderRadius:8,background:'#22c55e',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'white'}}, '⬡')))\\n);"
  Rules for customCode:
  - Use React.createElement(), NOT JSX (it won't be compiled)
  - Use inline styles with camelCase (no CSS classes)
  - Dark theme: background #0f172a, text #e2e8f0, accent #60a5fa, success #22c55e, warning #f59e0b, danger #ef4444
  - Keep it interactive: use useState for user-controlled values (sliders, buttons, toggles)
  - Must be self-contained: no imports, no external dependencies
  - Stick to: div, span, input, button, svg, circle, rect, text, h3, p, table, tr, td, th

- "none": No visual for this slide.

PREFER "custom" over "none" — always try to create a visual that helps explain the concept!`;

function buildSlidePrompt(
  slideInfo: any,
  readmeContent: string,
  audienceLevel: string,
  slideIndex: number,
  totalSlides: number,
): string {
  // Find the relevant section in the README — pass as much as possible
  const sectionHeading = slideInfo.coveredSection ?? '';
  let relevantContent = '';
  if (sectionHeading && sectionHeading !== 'introduction' && sectionHeading !== 'summary') {
    const headingPattern = new RegExp(`^##\\s+.*${escapeRegex(sectionHeading)}.*$`, 'mi');
    const match = readmeContent.match(headingPattern);
    if (match?.index !== undefined) {
      const start = match.index;
      const nextHeading = readmeContent.indexOf('\n## ', start + 1);
      relevantContent = readmeContent.slice(start, nextHeading > 0 ? nextHeading : undefined).slice(0, 6000);
    }
  }
  if (!relevantContent) {
    relevantContent = readmeContent.slice(0, 4000);
  }

  const visualTypesStr = (slideInfo.visualTypes ?? []).join(', ') || 'your choice';

  return `Create slide ${slideIndex + 1} of ${totalSlides} for a ${audienceLevel}-level audience.

Slide title: "${slideInfo.title}"
${slideInfo.subtitle ? `Subtitle: "${slideInfo.subtitle}"` : ''}
Suggested visual types: ${visualTypesStr}

SOURCE CONTENT (from the README — this is your primary material):
---
${relevantContent}
---

CRITICAL RULES:
1. The README IS the content. Get your information from it. Do NOT make things up or add generic filler.
2. The "explanation" should use the README's own information and phrasing — keep it to 1-2 sentences that set context.
3. "buildSteps" should contain actual code blocks, YAML snippets, and commands FROM the README above.
4. Copy commands exactly as they appear in the source. Do not invent commands.
5. Your CREATIVE job is "visuals" — build interactive visualizations that help explain the concepts.
6. A slide can have MULTIPLE visuals if it covers multiple concepts. Don't limit to one.
7. If the README already explains something well, use that. Don't rewrite it worse.

Respond with JSON:
{
  "title": "Slide title",
  "subtitle": "Optional subtitle",
  "headline": "Key phrase from the content (≤10 words)",
  "explanation": "1-2 sentences of context from the README content. No filler.",
  "buildSteps": [
    { "type": "text", "content": "Key point from the README" },
    { "type": "code", "content": "actual YAML or code from the README", "label": "filename" },
    { "type": "command", "content": "actual kubectl command from the README", "label": "what it does" },
    { "type": "reveal", "content": "important detail or gotcha from the README" }
  ],
  "keyTakeaways": ["From the README content"],
  "visuals": [
    {
      "type": "one of the visual types",
      "description": "What this visual demonstrates"
    }
  ],
  "commands": [
    {
      "raw": "exact command from the README",
      "explanation": "One sentence from the README about what this does",
      "expectedOutcome": "What to expect",
      "isDangerous": false
    }
  ],
  "speakerNotes": "• Key point to emphasize\\n• What to demo live",
  "transition": "Bridge to next topic"
}

Guidelines:
- buildSteps: 3-8 items. Use actual code/YAML/commands from the source, not invented examples.
- commands: ONLY commands that appear in the README. Copy them exactly.
- visuals: Add 1-3 visuals that illustrate the concepts on this slide. This is where you add value.
  For "mermaid" type, include "mermaidCode". For "custom" type, include "customCode" (React.createElement with useState).
- Respond ONLY with the JSON object.`;
}

function parseVisuals(data: any, fallbackType: string): SlideVisual[] {
  // Handle array of visuals
  if (Array.isArray(data)) {
    return data
      .map((v: any) => parseSingleVisual(v))
      .filter((v): v is SlideVisual => v !== null);
  }
  // Handle single visual object
  const single = parseSingleVisual(data, fallbackType);
  return single ? [single] : [];
}

function parseSingleVisual(visualData: any, fallbackType?: string): SlideVisual | null {
  if (!visualData && (!fallbackType || fallbackType === 'none')) return null;

  const type = visualData?.type ?? fallbackType ?? 'none';
  if (type === 'none') return null;

  return {
    type,
    mermaidCode: visualData?.mermaidCode,
    customCode: visualData?.customCode,
    description: visualData?.description,
    config: visualData?.config,
  };
}

function parseBuildSteps(steps: any): BuildStep[] {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((s: any) => s && typeof s === 'object' && s.content)
    .map((s: any) => ({
      type: ['text', 'code', 'command', 'visual_highlight', 'reveal'].includes(s.type) ? s.type : 'text',
      content: String(s.content),
      label: s.label ?? undefined,
    }));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---- Single slide regeneration ----

export async function regenerateSlide(
  slide: AISlide,
  readmeContent: string,
  audienceLevel: string,
  feedback?: string,
): Promise<AISlide> {
  const prompt = `Regenerate this presentation slide for a ${audienceLevel} audience.

Current slide:
Title: ${slide.title}
Current explanation: ${slide.explanation.slice(0, 500)}

${feedback ? `User feedback: "${feedback}"` : 'Make it better: clearer explanation, better visuals, more engaging.'}

Source content:
${slide.rawSection ? `Section: ${slide.rawSection}` : ''}
${readmeContent.slice(0, 2000)}

Respond with the same JSON structure as before:
{
  "title": "...",
  "subtitle": "...",
  "explanation": "...",
  "keyTakeaways": [...],
  "visual": { "type": "...", "description": "..." },
  "commands": [...],
  "speakerNotes": "...",
  "transition": "..."
}

Respond ONLY with JSON.`;

  const raw = await callModel([{ role: 'user', content: prompt }], 2048);
  const parsed = JSON.parse(extractJson(raw));

  return {
    ...slide,
    title: parsed.title ?? slide.title,
    subtitle: parsed.subtitle ?? slide.subtitle,
    headline: parsed.headline ?? parsed.title ?? slide.headline,
    explanation: parsed.explanation ?? slide.explanation,
    buildSteps: parseBuildSteps(parsed.buildSteps) ?? slide.buildSteps,
    keyTakeaways: parsed.keyTakeaways ?? slide.keyTakeaways,
    visuals: parseVisuals(parsed.visuals ?? parsed.visual, slide.visuals?.[0]?.type ?? 'none'),
    commands: (parsed.commands ?? slide.commands).map((c: any, ci: number) => ({
      raw: c.raw ?? c.command ?? '',
      explanation: c.explanation ?? '',
      expectedOutcome: c.expectedOutcome ?? '',
      isDangerous: c.isDangerous ?? false,
      order: ci,
    })),
    speakerNotes: parsed.speakerNotes ?? slide.speakerNotes,
    transition: parsed.transition ?? slide.transition,
  };
}

// ---- Generate single slide from a curriculum item ----

export async function generateSlideFromCurriculum(
  item: { title: string; subtitle?: string | null; covered_section?: string | null; visual_types: string[]; user_notes?: string | null },
  readmeContent: string,
  audienceLevel: string,
  slideIndex: number,
  totalSlides: number,
  onToken?: (token: string) => void,
): Promise<AISlide> {
  const slideInfo = {
    title: item.title,
    subtitle: item.subtitle,
    coveredSection: item.covered_section ?? '',
    visualTypes: item.visual_types,
  };

  const slidePrompt = buildSlidePrompt(slideInfo, readmeContent, audienceLevel, slideIndex, totalSlides);
  const finalPrompt = item.user_notes
    ? `${slidePrompt}\n\nAdditional instructions from the presenter: "${item.user_notes}"`
    : slidePrompt;

  const raw = await callModel([{ role: 'user', content: finalPrompt }], 2048, onToken);

  try {
    const parsed = JSON.parse(extractJson(raw));
    return {
      id: `slide-${slideIndex + 1}`,
      title: parsed.title ?? item.title,
      subtitle: parsed.subtitle ?? item.subtitle ?? undefined,
      headline: parsed.headline ?? parsed.title ?? item.title,
      explanation: parsed.explanation ?? '',
      buildSteps: parseBuildSteps(parsed.buildSteps),
      keyTakeaways: parsed.keyTakeaways ?? [],
      visuals: parseVisuals(parsed.visuals ?? parsed.visual, item.visual_types[0] ?? 'none'),
      commands: (parsed.commands ?? []).map((c: any, ci: number) => ({
        raw: c.raw ?? c.command ?? '',
        explanation: c.explanation ?? '',
        expectedOutcome: c.expectedOutcome ?? '',
        isDangerous: c.isDangerous ?? /delete|drain|taint|cordon/.test(c.raw ?? ''),
        order: ci,
      })),
      speakerNotes: parsed.speakerNotes ?? '',
      transition: parsed.transition,
      rawSection: item.covered_section ?? undefined,
      order: slideIndex + 1,
    };
  } catch {
    // Fallback: the raw text might be valid JSON that extractJson missed
    return tryParseSlideFromRaw(raw, item, slideIndex);
  }
}

function tryParseSlideFromRaw(raw: string, item: any, slideIndex: number): AISlide {
  // Try multiple extraction strategies
  const strategies = [
    () => JSON.parse(raw),
    () => JSON.parse(raw.trim()),
    () => JSON.parse(raw.replace(/^[^{]*/, '').replace(/[^}]*$/, '')),
    () => {
      // Find first { and last } and try to parse that
      const first = raw.indexOf('{');
      const last = raw.lastIndexOf('}');
      if (first >= 0 && last > first) return JSON.parse(raw.slice(first, last + 1));
      throw new Error('no braces');
    },
  ];

  for (const strategy of strategies) {
    try {
      const parsed = strategy();
      if (parsed && typeof parsed.explanation === 'string') {
        return {
          id: `slide-${slideIndex + 1}`,
          title: parsed.title ?? item.title,
          subtitle: parsed.subtitle ?? item.subtitle ?? undefined,
          headline: parsed.headline ?? parsed.title ?? item.title,
          explanation: parsed.explanation,
          buildSteps: parseBuildSteps(parsed.buildSteps),
          keyTakeaways: parsed.keyTakeaways ?? [],
          visuals: parseVisuals(parsed.visuals ?? parsed.visual, 'none'),
          commands: (parsed.commands ?? []).map((c: any, ci: number) => ({
            raw: c.raw ?? c.command ?? '',
            explanation: c.explanation ?? '',
            expectedOutcome: c.expectedOutcome ?? '',
            isDangerous: c.isDangerous ?? false,
            order: ci,
          })),
          speakerNotes: parsed.speakerNotes ?? '',
          transition: parsed.transition,
          rawSection: item.covered_section ?? undefined,
          order: slideIndex + 1,
        };
      }
    } catch {}
  }

  // True fallback: strip any JSON structure and use as explanation text
  const cleaned = raw
    .replace(/```json\s*/g, '').replace(/```\s*/g, '')
    .replace(/^\s*\{[\s\S]*"explanation"\s*:\s*"/, '')
    .replace(/",?\s*"keyTakeaways[\s\S]*$/, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"');

  return {
    id: `slide-${slideIndex + 1}`,
    title: item.title,
    subtitle: item.subtitle ?? undefined,
    headline: item.title,
    explanation: cleaned || 'Failed to generate this slide. Click "Regenerate" to try again.',
    buildSteps: [],
    visuals: [],
    keyTakeaways: [],
    commands: [],
    speakerNotes: '',
    order: slideIndex + 1,
  };
}
