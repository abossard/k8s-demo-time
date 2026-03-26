import React, { useState, useEffect, useMemo, Component, type ReactNode } from 'react';
import { Code, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface DynamicVisualProps {
  code: string;
  description?: string;
}

// Error boundary to catch rendering errors in AI-generated code
class VisualErrorBoundary extends Component<
  { children: ReactNode; onError: (error: string) => void },
  { error: string | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertTriangle size={14} />
            <span>Visual render error: {this.state.error}</span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function DynamicVisual({ code, description }: DynamicVisualProps) {
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compile the code into a React component
  const RenderedComponent = useMemo(() => {
    if (!code) return null;
    try {
      // The AI writes a function body that receives { React, useState, useEffect }
      // and returns a React element
      const fn = new Function('React', 'useState', 'useEffect', code);

      // Create a wrapper component
      function AIVisual() {
        try {
          return fn(React, useState, useEffect);
        } catch (err: any) {
          return React.createElement('div', {
            style: { color: '#ef4444', fontSize: 12, padding: 8 }
          }, `Runtime error: ${err.message}`);
        }
      }

      return AIVisual;
    } catch (err: any) {
      setError(`Syntax error: ${err.message}`);
      return null;
    }
  }, [code]);

  return (
    <div className="concept-visual">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold text-kube-info uppercase tracking-wider flex items-center gap-1.5">
          ✨ AI-Generated Visual
        </div>
        <button
          onClick={() => setShowCode(!showCode)}
          className="flex items-center gap-1 text-[10px] text-kube-muted hover:text-white transition-colors"
        >
          <Code size={10} />
          {showCode ? 'Hide' : 'View'} code
          {showCode ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>

      {description && (
        <p className="text-xs text-kube-muted mb-3 italic">{description}</p>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 mb-3">
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {RenderedComponent && (
        <VisualErrorBoundary onError={setError}>
          <div className="rounded-lg overflow-hidden">
            <RenderedComponent />
          </div>
        </VisualErrorBoundary>
      )}

      {showCode && (
        <pre className="mt-3 bg-kube-dark rounded-lg border border-kube-border p-3 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-48 overflow-y-auto">
          {code}
        </pre>
      )}
    </div>
  );
}
