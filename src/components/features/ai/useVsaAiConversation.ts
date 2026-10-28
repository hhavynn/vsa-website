import { FormEvent, useEffect, useState } from 'react';
import { FALLBACK_ASK_VSA } from '../../../config/publicFallbackContent';

// Conversation lifecycle only. Panel focus, open/minimized state, feedback
// and all live regions remain in VsaAiAssistant; this preserves their behavior.
export type Role = 'user' | 'assistant';
export type AssistantStatus = 'answered' | 'fallback' | 'rate_limited' | 'error' | 'unavailable';

export interface SourceChip {
  title: string;
  source_url: string | null;
  category: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  sources?: SourceChip[];
  status?: AssistantStatus;
  feedbackSubmitted?: boolean;
}

interface AssistantResponse {
  answer: string;
  sources?: SourceChip[];
  status: AssistantStatus;
}

const MAX_MESSAGES = 12;
export const MAX_INPUT_LENGTH = 500;
const SESSION_STORAGE_KEY = 'vsa-ai-assistant-session';

function createMessageId() {
  if (typeof crypto !== 'undefined') {
    if ('randomUUID' in crypto) return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    (crypto as Crypto).getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now()}-${String(Math.random()).slice(2)}`;
}

function getSessionId() {
  if (typeof window === 'undefined') return createMessageId();

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;

  const next = createMessageId();
  window.localStorage.setItem(SESSION_STORAGE_KEY, next);
  return next;
}

export function useVsaAiConversation(currentPage: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  async function sendMessage(rawMessage: string, history: ChatMessage[] = messages) {
    const nextMessage = rawMessage.trim().slice(0, MAX_INPUT_LENGTH);
    if (!nextMessage || loading || !sessionId) return;

    setInput('');

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: nextMessage,
    };

    const recentTurns = history
      .filter((message) => message.status !== 'error' && message.status !== 'rate_limited')
      .slice(-4)
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, MAX_INPUT_LENGTH),
      }));

    setMessages([...history, userMessage].slice(-MAX_MESSAGES));
    setLoading(true);

    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(FALLBACK_ASK_VSA.message);
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/vsa-ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          message: nextMessage,
          sessionId,
          recentTurns,
          currentPage: currentPage,
        }),
      });

      const data = (await response.json().catch(() => null)) as AssistantResponse | null;

      if (!response.ok && response.status !== 429) {
        throw new Error(`Ask VSA request failed (HTTP ${response.status})`);
      }

      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        content:
          data?.answer ||
          (response.status === 429
            ? "You've reached today's Ask VSA limit. Try again later!"
            : FALLBACK_ASK_VSA.message),
        sources: data?.sources ?? [],
        status: data?.status ?? (response.status === 429 ? 'rate_limited' : 'error'),
      };

      setMessages((current) => [...current, assistantMessage].slice(-MAX_MESSAGES));
    } catch (error) {
      console.error('Ask VSA request failed:', error);
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: FALLBACK_ASK_VSA.message,
        status: 'error',
      };
      setMessages((current) => [...current, assistantMessage].slice(-MAX_MESSAGES));
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(messageIndex: number) {
    const userMessageIndex = messages
      .slice(0, messageIndex)
      .map((message) => message.role)
      .lastIndexOf('user');
    if (userMessageIndex < 0) return;

    await sendMessage(messages[userMessageIndex].content, messages.slice(0, userMessageIndex));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  return { messages, setMessages, input, setInput, loading, sendMessage, handleRetry, handleSubmit };
}
