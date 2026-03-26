import type { K8sResource } from '../utils/k8s-yaml.js';
import { extractJson } from '../utils/json.js';
import { chat } from './copilot-sdk.js';
import type { CurriculumItem } from './deck-manager.js';

const VISUAL_TYPES = `Available visual types:
- "hpa": Interactive pod autoscaler (HPA, scaling, replicas)
- "probes": Traffic-light probe simulator (probes, health checks)
- "resources": CPU/Memory bar chart (requests, limits, throttling, OOM)
- "qos": Eviction priority pyramid (QoS, Guaranteed/Burstable/BestEffort)
- "vpa": VPA resource resize animation (VPA, right-sizing)
- "rollout": Rolling update animation (deployment strategy, rollout)
- "mermaid": Custom Mermaid diagram (architecture, flows)
- "architecture": K8s YAML architecture diagram
- "none": No visual`;

export interface CurriculumOutline {
  title: string;
  description: string;
  items: {
    title: string;
    subtitle?: string;
    coveredSection: string;
    visualTypes: string[];
    commandCount: number;
  }[];
}

export async function generateCurriculum(
  readmeContent: string,
  yamlResources: K8sResource[],
  audienceLevel: 'beginner' | 'intermediate' | 'expert',
): Promise<CurriculumOutline> {
  const yamlSummary = yamlResources.length > 0
    ? `\n\nK8s YAML resources found:\n${yamlResources.slice(0, 30).map(r => `- ${r.kind}/${r.name} (${r.filePath.split('/').pop()})`).join('\n')}`
    : '';

  const prompt = `You are KubAIrnetes, an expert Kubernetes instructor. Analyze this README and create a curriculum outline for a ${audienceLevel}-level presentation.

README:
---
${readmeContent.slice(0, 12000)}
---
${yamlSummary}

${VISUAL_TYPES}

Return a JSON object:
{
  "title": "Presentation title",
  "description": "One-sentence description",
  "items": [
    {
      "title": "Slide title",
      "subtitle": "Optional subtitle",
      "coveredSection": "Which ## heading this covers",
      "visualTypes": ["hpa", "mermaid"],
      "commandCount": 3
    }
  ]
}

Rules:
- Create 4-8 slides (not more!) — each slide is a scrollable interactive chapter
- Group related content aggressively — one slide can cover an entire section
- Start with an overview, end with summary/next-steps
- Each slide teaches ONE concept but can have many build steps, commands, and visuals
- Respond ONLY with JSON, nothing else.`;

  const raw = await chat(
    'You are KubAIrnetes, an expert Kubernetes instructor. Respond only with valid JSON.',
    prompt,
  );
  return JSON.parse(extractJson(raw)) as CurriculumOutline;
}
