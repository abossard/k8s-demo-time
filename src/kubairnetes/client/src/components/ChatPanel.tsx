import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Send, Trash2, MessageCircle } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (message: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function ChatPanel({
  messages,
  isStreaming,
  onSendMessage,
  onClear,
  onClose,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSendMessage(trimmed);
    setInput('');
  };

  return (
    <div className="border-t border-kube-border bg-kube-surface flex flex-col" style={{ height: '320px' }}>
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-kube-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle size={14} className="text-kube-glow" />
          <span className="text-xs font-medium text-slate-300">Chat with KubAIrnetes</span>
          <span className="text-xs text-kube-muted">(context: current slide)</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClear}
            className="p-1 rounded hover:bg-kube-surface-light text-kube-muted hover:text-white transition-colors"
            title="Clear chat"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-kube-surface-light text-kube-muted hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-kube-muted text-sm py-8">
            Ask anything about the current slide, Kubernetes concepts, or commands.
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-kube-blue text-white'
                : 'bg-kube-surface-light text-slate-300 border border-kube-border'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content || (isStreaming ? '...' : '')}
                  </ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-kube-border shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about this slide or Kubernetes..."
            className="flex-1 bg-kube-dark border border-kube-border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-kube-muted focus:outline-none focus:border-kube-glow transition-colors"
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="px-3 py-2 rounded-lg bg-kube-blue text-white hover:bg-kube-blue/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
