import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#326CE5',
    primaryBorderColor: '#60a5fa',
    primaryTextColor: '#e2e8f0',
    lineColor: '#475569',
    secondaryColor: '#1e293b',
    tertiaryColor: '#334155',
  },
  securityLevel: 'loose',
});

let renderCounter = 0;

export function MermaidBlock({ code, description }: { code: string; description?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    setError(null);
    setSvg(null);

    const id = `mermaid-inline-${++renderCounter}`;

    mermaid.render(id, code)
      .then(({ svg }) => {
        setSvg(svg);
      })
      .catch((err) => {
        setError(err?.message ?? 'Failed to render diagram');
      });
  }, [code]);

  return (
    <div className="concept-visual">
      <div className="text-[10px] font-semibold text-kube-info uppercase tracking-wider mb-2">📐 Diagram</div>
      {description && (
        <p className="text-xs text-kube-muted mb-3 italic">{description}</p>
      )}

      {error && (
        <div className="mb-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          Render error: {error}
          <pre className="mt-2 text-[10px] font-mono text-slate-400 bg-kube-dark rounded p-2 overflow-x-auto">
            {code}
          </pre>
        </div>
      )}

      {svg && (
        <div
          ref={containerRef}
          className="flex justify-center bg-kube-dark/50 rounded-lg p-4 border border-kube-border overflow-x-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}

      {!svg && !error && (
        <div className="flex items-center justify-center py-8 text-kube-muted text-xs">
          Rendering diagram...
        </div>
      )}
    </div>
  );
}
