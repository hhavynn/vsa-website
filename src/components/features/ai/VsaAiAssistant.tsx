import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { FALLBACK_ASK_VSA } from '../../../config/publicFallbackContent';

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
  'How do I get involved?',
  'What is ACE?',
  'How do House points work?',
  'Where can I find upcoming events?',
  'How do I join the Intern Program?',
  'What is VCN?',
  'What is WNC?',
  'How do I check my points?'
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

function InfoDotIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 17.25a7.25 7.25 0 1 0 0-14.5 7.25 7.25 0 0 0 0 14.5ZM10 9.25v4M10 6.55v.05"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SourceIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M6.3 10.55 4.95 11.9a3.1 3.1 0 0 0 4.38 4.38l2.1-2.1a3.1 3.1 0 0 0 0-4.38M13.7 9.45l1.35-1.35a3.1 3.1 0 0 0-4.38-4.38l-2.1 2.1a3.1 3.1 0 0 0 0 4.38"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function isFallbackMessage(message: ChatMessage) {
  return (
    message.status === 'fallback' ||
    message.content.toLowerCase().includes("i don't have a confirmed approved answer") ||
    message.content.toLowerCase().includes("i'm not sure from the approved vsa info i have")
  );
}

function assistantToneClasses(status?: AssistantStatus) {
  if (status === 'rate_limited') {
    return 'border-amber-300/70 bg-amber-50 text-amber-950 shadow-[0_6px_20px_rgba(217,119,6,0.08)] dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100';
  }
  if (status === 'error') {
    return 'border-rose-300/70 bg-rose-50 text-rose-950 shadow-[0_6px_20px_rgba(225,29,72,0.08)] dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-100';
  }
  if (status === 'fallback') {
    return 'border-sky-200 bg-sky-50 text-sky-950 shadow-[0_6px_20px_rgba(14,165,233,0.08)] dark:border-sky-500/40 dark:bg-sky-950/30 dark:text-sky-100';
  }
  return 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text2)] shadow-[0_6px_20px_rgba(15,23,42,0.06)]';
}

export function VsaAiAssistant() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const minimizedButtonRef = useRef<HTMLButtonElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
    });
  }, [messages, loading, isOpen, shouldReduceMotion]);

  useEffect(() => {
    if (!isOpen) return;

    const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        window.requestAnimationFrame(() => launcherRef.current?.focus());
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const recentTurns = useMemo(
    () =>
      messages
        .slice(-4)
        .map((message) => ({ role: message.role, content: message.content })),
    [messages],
  );

  const assistantAnnouncement = useMemo(() => {
    if (loading) return 'Ask VSA is checking approved VSA information.';
    const latestMessage = messages[messages.length - 1];
    return latestMessage?.role === 'assistant' ? `Ask VSA says: ${latestMessage.content}` : '';
  }, [loading, messages]);

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
          currentPage: location.pathname,
        }),
      });

      const data = (await response.json().catch(() => null)) as AssistantResponse | null;

      if (!response.ok && response.status !== 429) {
        throw new Error(FALLBACK_ASK_VSA.message);
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
      const fallback = error instanceof Error ? error.message : FALLBACK_ASK_VSA.message;
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: FALLBACK_ASK_VSA.message,
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

  function minimizeAssistant() {
    setIsOpen(false);
    setIsMinimized(true);
    window.requestAnimationFrame(() => minimizedButtonRef.current?.focus());
  }

  function closeAssistant() {
    setIsOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }

  function restoreAssistant() {
    setIsMinimized(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }

  return (
    <div className="fixed bottom-5 left-4 z-50 sm:left-5">
      <AnimatePresence>
        {isOpen && (
          <motion.section
            id="vsa-ai-assistant-panel"
            role="dialog"
            aria-labelledby="vsa-ai-assistant-title"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-x-3 bottom-[86px] flex max-h-[75dvh] flex-col overflow-hidden rounded-[1.35rem] border bg-[var(--color-surface)] shadow-[0_22px_70px_rgba(15,23,42,0.28)] sm:inset-x-auto sm:left-5 sm:w-[380px] sm:max-h-[560px]"
            style={{ borderColor: 'var(--color-border)' }}
          >
          <div
            className="relative overflow-hidden border-b px-4 py-3.5"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
          >
            <div className="pointer-events-none absolute right-5 top-4 h-9 w-9 rounded-full border border-brand-200/70 bg-brand-50/70 dark:border-brand-400/20 dark:bg-brand-400/10" />
            <div className="pointer-events-none absolute right-12 top-10 h-3 w-3 rounded-full bg-amber-300/70 dark:bg-amber-300/40" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md dark:bg-brand-400 dark:text-zinc-950">
                    <ChatSparkIcon className="h-4 w-4" />
                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[var(--color-surface2)] bg-amber-300" />
                  </span>
                  <div>
                    <h2 id="vsa-ai-assistant-title" className="font-sans text-base font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
                      Ask VSA
                    </h2>
                    <p className="font-sans text-[11px] font-medium leading-tight" style={{ color: 'var(--color-text3)' }}>
                      Answers from approved VSA website info.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAssistant}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-[var(--color-surface)] text-[var(--color-text2)] transition-colors hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                style={{ borderColor: 'var(--color-border)' }}
                aria-label="Close VSA AI Assistant"
              >
                <CloseIcon />
              </button>
            </div>
            <div
              className="mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 font-sans text-[11px] leading-5"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'var(--color-surface)' }}
            >
              <InfoDotIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
              <p>Ask VSA uses approved public VSA website info. For official updates, check VSA channels.</p>
            </div>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-label="Ask VSA conversation">
            {messages.length === 0 ? (
              <div className="space-y-4 py-1">
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: shouldReduceMotion ? 0 : 0.1, duration: shouldReduceMotion ? 0 : 0.2 }}
                  className="rounded-2xl border border-dashed p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]" 
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
                >
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600 dark:text-brand-400" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                    Public VSA helper
                  </div>
                  <p className="font-sans text-[15px] font-bold leading-6" style={{ color: 'var(--color-text)' }}>
                    Ask about VSA at UCSD programs, events, points, House, ACE, VCN, WNC, or externals.
                  </p>
                  <p className="mt-1 font-sans text-xs leading-5" style={{ color: 'var(--color-text3)' }}>
                    If I do not have approved info, I will say so.
                  </p>
                </motion.div>
                <div className="flex flex-wrap gap-2">
                  {STARTER_QUESTIONS.map((question, idx) => (
                    <motion.button
                      key={question}
                      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: shouldReduceMotion ? 0 : 0.15 + idx * 0.03, duration: shouldReduceMotion ? 0 : 0.2 }}
                      whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                      type="button"
                      onClick={() => sendMessage(question)}
                      disabled={loading}
                      className="rounded-full border px-3 py-1.5 text-left font-sans text-[12px] font-semibold shadow-sm transition-colors hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-brand-400/10 dark:hover:text-brand-300"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'var(--color-surface)' }}
                    >
                      {question}
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[88%] ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 font-sans text-sm leading-6 ${
                          message.role === 'user'
                            ? 'rounded-br-md bg-brand-600 text-white shadow-[0_8px_22px_rgba(79,70,229,0.22)] dark:bg-brand-400 dark:text-zinc-950'
                            : `rounded-bl-md border ${assistantToneClasses(message.status)}`
                        }`}
                      >
                        {message.role === 'assistant' && message.status === 'rate_limited' && (
                          <p className="mb-1 font-sans text-[11px] font-bold uppercase tracking-[0.08em]">Ask VSA limit</p>
                        )}
                        {message.role === 'assistant' && message.status === 'error' && (
                          <p className="mb-1 font-sans text-[11px] font-bold uppercase tracking-[0.08em]">Quick break</p>
                        )}
                        {message.role === 'assistant' && isFallbackMessage(message) && (
                          <p className="mb-1 font-sans text-[11px] font-bold uppercase tracking-[0.08em]">Not sure yet</p>
                        )}
                        {message.content}
                      </div>
                      {message.role === 'assistant' && isFallbackMessage(message) && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {['Events', 'Get Involved', 'Applications'].map((label) => (
                            <span
                              key={`${message.id}-${label}`}
                              className="rounded-full border px-2.5 py-1 font-sans text-[10px] font-bold"
                              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)', background: 'var(--color-surface)' }}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                      {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {message.sources.slice(0, 4).map((source) => {
                            const label = source.title.length > 28 ? `${source.title.slice(0, 25)}...` : source.title;
                            return source.source_url ? (
                              <a
                                key={`${message.id}-${source.title}`}
                                href={source.source_url}
                                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-sans text-[10px] font-bold transition-colors hover:border-brand-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)', background: 'var(--color-surface)' }}
                                aria-label={`Source: ${source.title}`}
                              >
                                <SourceIcon />
                                {label}
                              </a>
                            ) : (
                              <span
                                key={`${message.id}-${source.title}`}
                                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-sans text-[10px] font-bold"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)', background: 'var(--color-surface)' }}
                              >
                                <SourceIcon />
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div
                      className="rounded-2xl rounded-bl-md border px-3.5 py-2.5 font-sans text-xs shadow-[0_6px_20px_rgba(15,23,42,0.05)]"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)', background: 'var(--color-bg)' }}
                    >
                      <span className="mr-2 inline-flex align-middle" aria-hidden="true">
                        <span className="mx-0.5 h-1.5 w-1.5 rounded-full bg-brand-500 motion-safe:animate-bounce [animation-delay:-0.2s]" />
                        <span className="mx-0.5 h-1.5 w-1.5 rounded-full bg-brand-500 motion-safe:animate-bounce [animation-delay:-0.1s]" />
                        <span className="mx-0.5 h-1.5 w-1.5 rounded-full bg-brand-500 motion-safe:animate-bounce" />
                      </span>
                      Checking VSA info...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {assistantAnnouncement}
          </div>

          {errorText && (
            <div role="alert" className="border-t px-4 py-2 font-sans text-xs text-rose-700 dark:text-rose-300" style={{ borderColor: 'var(--color-border)' }}>
              {errorText}
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor="vsa-ai-message">
                Ask VSA a question
              </label>
              <textarea
                ref={inputRef}
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
                aria-describedby="vsa-ai-character-count"
                className="min-h-[44px] flex-1 resize-none rounded-xl border bg-[var(--color-input)] px-3 py-2 font-sans text-sm leading-5 text-[var(--color-text)] placeholder:text-[var(--color-text3)] outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 dark:focus:border-brand-400"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <motion.button
                whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                type="submit"
                disabled={loading || input.trim().length === 0}
                className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-400 dark:text-zinc-950 dark:hover:bg-brand-300"
                aria-label="Send Ask VSA message"
              >
                <SendIcon />
              </motion.button>
            </div>
            <div id="vsa-ai-character-count" className="mt-1 text-right font-mono text-[10px]" style={{ color: 'var(--color-text3)' }}>
              {input.length}/{MAX_INPUT_LENGTH}
            </div>
          </form>
          </motion.section>
        )}
      </AnimatePresence>

      {isMinimized ? (
        <motion.button
          ref={minimizedButtonRef}
          whileHover={shouldReduceMotion ? undefined : { y: -2 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
          type="button"
          onClick={restoreAssistant}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-brand-600 text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] dark:bg-brand-400 dark:text-zinc-950"
          style={{ borderColor: 'var(--color-border)' }}
          aria-label="Restore Ask VSA"
        >
          <ChatSparkIcon className="h-4 w-4" />
        </motion.button>
      ) : (
        <div className="relative">
          <motion.button
            ref={launcherRef}
            whileHover={shouldReduceMotion ? undefined : { y: -2, scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="group relative inline-flex h-14 items-center gap-2 rounded-full border bg-brand-600 px-4 font-sans text-sm font-bold text-white shadow-[0_12px_30px_rgba(79,70,229,0.35)] transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] dark:bg-brand-400 dark:text-zinc-950 dark:hover:bg-brand-300"
            style={{ borderColor: 'var(--color-border)' }}
            aria-expanded={isOpen}
            aria-controls="vsa-ai-assistant-panel"
            aria-label={isOpen ? 'Close VSA AI Assistant' : 'Open VSA AI Assistant'}
          >
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--color-bg)] bg-amber-300 shadow-sm" />
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 dark:bg-zinc-950/10">
              <ChatSparkIcon className="h-5 w-5" />
            </span>
            <span className="hidden sm:inline">Ask VSA</span>
            <span className="sm:hidden">Ask</span>
          </motion.button>
          <button
            type="button"
            onClick={minimizeAssistant}
            className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border bg-[var(--color-surface)] text-[var(--color-text2)] shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:hidden"
            style={{ borderColor: 'var(--color-border)' }}
            aria-label="Minimize Ask VSA"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
