// Pure calculation — extracts JSON from AI text that may contain markdown fences or extra text.
export function extractJson(text: string): string {
  // Try markdown code fence first
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenced) return fenced[1]!;

  // Find matching braces/brackets
  const braceStart = text.indexOf('{');
  const bracketStart = text.indexOf('[');
  const start = braceStart >= 0 && (bracketStart < 0 || braceStart < bracketStart) ? braceStart : bracketStart;

  if (start >= 0) {
    const opener = text[start]!;
    const closer = opener === '{' ? '}' : ']';
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === opener) depth++;
      else if (text[i] === closer) depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return text;
}

// Try to parse JSON with multiple fallback strategies.
export function tryParseJson<T>(text: string): T | null {
  const strategies = [
    () => JSON.parse(text),
    () => JSON.parse(text.trim()),
    () => JSON.parse(extractJson(text)),
    () => {
      const first = text.indexOf('{');
      const last = text.lastIndexOf('}');
      if (first >= 0 && last > first) return JSON.parse(text.slice(first, last + 1));
      throw new Error('no braces');
    },
  ];

  for (const strategy of strategies) {
    try {
      return strategy() as T;
    } catch {}
  }
  return null;
}
