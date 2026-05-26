import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

type Role = 'user' | 'assistant';
type AssistantStatus = 'answered' | 'fallback' | 'rate_limited' | 'error';

interface SourceChip {
  title: string;
  source_url: string | null;
  category: string;
}

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  sources?: SourceChip[];
  status?: AssistantStatus;
}

interface AssistantResponse {
  answer: string;
  sources?: SourceChip[];
  status: AssistantStatus;
}

const STARTER_QUESTIONS = [
  'How do I earn points?',
  'What is House?',
  'What is ACE?',
  'How do I go to externals?',
  'When is the next event?',
  'How do I join VSA?',
];

const MAX_MESSAGES = 12;
const MAX_INPUT_LENGTH = 500;
const SESSION_STORAGE_KEY = 'vsa-ai-assistant-session';

function createMessageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getSessionId() {
  if (typeof window === 'undefined') return createMessageId();

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;

  const next = createMessageId();
  window.localStorage.setItem(SESSION_STORAGE_KEY, next);
  return next;
}

function ChatSparkIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.5 7.25A4.25 4.25 0 0 1 9.75 3h4.5a4.25 4.25 0 0 1 4.25 4.25v4.1a4.25 4.25 0 0 1-4.25 4.25h-3.8l-4.1 3.15a.7.7 0 0 1-1.12-.56V15.1a4.23 4.23 0 0 1-1.48-3.2V7.25Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M17.8 3.25l.52 1.2 1.18.52-1.18.52-.52 1.18-.52-1.18-1.2-.52 1.2-.52.52-1.2ZM9.1 8.15h5.2M9.1 11.1h3.65"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3.25 10h12.2M10.4 4.95 15.45 10l-5.05 5.05"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m5.25 5.25 9.5 9.5M14.75 5.25l-9.5 9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function VsaAiAssistant() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, isOpen]);

  const recentTurns = useMemo(
    () =>
      messages
        .slice(-4)
        .map((message) => ({ role: message.role, content: message.content })),
    [messages],
  );

  if (isAdminRoute) return null;

  async function sendMessage(rawMessage: string) {
    const nextMessage = rawMessage.trim().slice(0, MAX_INPUT_LENGTH);
    if (!nextMessage || loading || !sessionId) return;

    setErrorText(null);
    setInput('');

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: nextMessage,
    };

    setMessages((current) => [...current, userMessage].slice(-MAX_MESSAGES));
    setLoading(true);

    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase configuration');
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
          currentPage: location.pathname,
        }),
      });

      const data = (await response.json().catch(() => null)) as AssistantResponse | null;

      if (!response.ok && response.status !== 429) {
        throw new Error(data?.answer || 'Ask VSA is having trouble right now.');
      }

      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        content:
          data?.answer ||
          (response.status === 429
            ? "You've reached today's Ask VSA limit. Try again later!"
            : 'Ask VSA is having trouble right now. Try again later.'),
        sources: data?.sources ?? [],
        status: data?.status ?? (response.status === 429 ? 'rate_limited' : 'error'),
      };

      setMessages((current) => [...current, assistantMessage].slice(-MAX_MESSAGES));
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 'Ask VSA is having trouble right now.';
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: 'Ask VSA is having trouble right now. Try again later or use the Feedback page.',
        status: 'error',
      };
      setErrorText(fallback);
      setMessages((current) => [...current, assistantMessage].slice(-MAX_MESSAGES));
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="fixed bottom-5 left-4 z-50 sm:left-5">
      {isOpen && (
        <section
          id="vsa-ai-assistant-panel"
          className="fixed inset-x-3 bottom-[82px] flex max-h-[75dvh] flex-col overflow-hidden rounded-lg border bg-[var(--color-surface)] shadow-2xl sm:inset-x-auto sm:left-5 sm:w-[380px] sm:max-h-[560px]"
          style={{ borderColor: 'var(--color-border)' }}
          aria-label="VSA AI Assistant chat panel"
        >
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white dark:bg-brand-400 dark:text-zinc-950">
                    <ChatSparkIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="font-sans text-sm font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
                      VSA AI Assistant
                    </h2>
                    <p className="font-sans text-[11px] leading-tight" style={{ color: 'var(--color-text3)' }}>
                      Answers from approved VSA website info
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border text-[var(--color-text2)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                style={{ borderColor: 'var(--color-border)' }}
                aria-label="Close VSA AI Assistant"
              >
                <CloseIcon />
              </button>
            </div>
            <p className="mt-3 rounded border px-3 py-2 font-sans text-[11px] leading-5" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
              AI answers use approved public VSA info. For official updates, check VSA channels.
            </p>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-dashed p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
                  <p className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Ask about VSA programs, events, points, House, ACE, VCN, WNC, or externals.
                  </p>
                  <p className="mt-1 font-sans text-xs leading-5" style={{ color: 'var(--color-text3)' }}>
                    If I do not have approved info, I will say so.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {STARTER_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => sendMessage(question)}
                      disabled={loading}
                      className="rounded-full border px-3 py-1.5 text-left font-sans text-[12px] font-medium transition-colors hover:border-brand-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-brand-400"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[88%] ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <div
                        className={`rounded-lg px-3 py-2 font-sans text-sm leading-6 ${
                          message.role === 'user'
                            ? 'bg-brand-600 text-white dark:bg-brand-400 dark:text-zinc-950'
                            : 'border bg-[var(--color-bg)] text-[var(--color-text2)]'
                        }`}
                        style={message.role === 'assistant' ? { borderColor: 'var(--color-border)' } : undefined}
                      >
                        {message.content}
                      </div>
                      {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {message.sources.slice(0, 4).map((source) => {
                            const label = source.title.length > 28 ? `${source.title.slice(0, 25)}...` : source.title;
                            return source.source_url ? (
                              <a
                                key={`${message.id}-${source.title}`}
                                href={source.source_url}
                                className="rounded-full border px-2 py-0.5 font-sans text-[10px] font-semibold transition-colors hover:border-brand-600 hover:text-brand-600"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}
                              >
                                {label}
                              </a>
                            ) : (
                              <span
                                key={`${message.id}-${source.title}`}
                                className="rounded-full border px-2 py-0.5 font-sans text-[10px] font-semibold"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border px-3 py-2 font-sans text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
                      Checking approved VSA info...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {errorText && (
            <div className="border-t px-4 py-2 font-sans text-xs text-red-700 dark:text-red-300" style={{ borderColor: 'var(--color-border)' }}>
              {errorText}
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t p-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor="vsa-ai-message">
                Ask VSA a question
              </label>
              <textarea
                id="vsa-ai-message"
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, MAX_INPUT_LENGTH))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Ask about VSA..."
                rows={2}
                maxLength={MAX_INPUT_LENGTH}
                className="min-h-[44px] flex-1 resize-none rounded border bg-[var(--color-input)] px-3 py-2 font-sans text-sm leading-5 text-[var(--color-text)] placeholder:text-[var(--color-text3)] outline-none transition-colors focus:border-brand-600 dark:focus:border-brand-400"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <button
                type="submit"
                disabled={loading || input.trim().length === 0}
                className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded bg-brand-600 text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-400 dark:text-zinc-950 dark:hover:bg-brand-300"
                aria-label="Send Ask VSA message"
              >
                <SendIcon />
              </button>
            </div>
            <div className="mt-1 text-right font-mono text-[10px]" style={{ color: 'var(--color-text3)' }}>
              {input.length}/{MAX_INPUT_LENGTH}
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex items-center gap-2 rounded-full border bg-brand-600 px-4 py-3 font-sans text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] dark:bg-brand-400 dark:text-zinc-950 dark:hover:bg-brand-300"
        style={{ borderColor: 'var(--color-border)' }}
        aria-expanded={isOpen}
        aria-controls="vsa-ai-assistant-panel"
      >
        <ChatSparkIcon />
        <span>Ask VSA</span>
      </button>
    </div>
  );
}
