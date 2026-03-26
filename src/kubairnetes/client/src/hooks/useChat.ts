import { useState, useCallback, useRef } from 'react';
import { sendChatMessage } from '../lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
}

let msgCounter = 0;

export function useChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isStreaming: false,
  });
  const cancelRef = useRef<(() => void) | null>(null);

  const sendMessage = useCallback((content: string, context?: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${++msgCounter}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    const assistantMsg: ChatMessage = {
      id: `msg-${++msgCounter}`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    setState(s => ({
      messages: [...s.messages, userMsg, assistantMsg],
      isStreaming: true,
    }));

    const allMessages = [...state.messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    const cancel = sendChatMessage(allMessages, context, {
      onToken(token) {
        setState(s => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, content: last.content + token };
          }
          return { ...s, messages: msgs };
        });
      },
      onDone() {
        setState(s => ({ ...s, isStreaming: false }));
      },
      onError(message) {
        setState(s => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = {
              ...last,
              content: last.content || `Error: ${message}`,
            };
          }
          return { messages: msgs, isStreaming: false };
        });
      },
    });

    cancelRef.current = cancel;
  }, [state.messages]);

  const clearChat = useCallback(() => {
    cancelRef.current?.();
    setState({ messages: [], isStreaming: false });
  }, []);

  return {
    ...state,
    sendMessage,
    clearChat,
  };
}
