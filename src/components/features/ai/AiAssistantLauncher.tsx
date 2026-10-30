import { Ref } from 'react';
import { motion } from 'framer-motion';
import { ChatSparkIcon, CloseIcon } from './AiAssistantIcons';

interface AiAssistantLauncherProps {
  isMinimized: boolean;
  isOpen: boolean;
  shouldReduceMotion: boolean | null;
  launcherRef: Ref<HTMLButtonElement>;
  minimizedButtonRef: Ref<HTMLButtonElement>;
  onRestore: () => void;
  onToggle: () => void;
  onMinimize: () => void;
}

/** Launcher-only rendering; the parent owns focus restoration and panel state. */
export function AiAssistantLauncher({
  isMinimized, isOpen, shouldReduceMotion, launcherRef, minimizedButtonRef,
  onRestore, onToggle, onMinimize,
}: AiAssistantLauncherProps) {
  return (
    <>
      {isMinimized ? (
        <motion.button
          ref={minimizedButtonRef}
          whileHover={shouldReduceMotion ? undefined : { y: -2 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
          type="button"
          onClick={onRestore}
          className="inline-flex h-10 w-10 touch:h-11 touch:w-11 items-center justify-center rounded-full border bg-brand-600 text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] dark:bg-brand-400 dark:text-zinc-950"
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
            onClick={onToggle}
            className="group relative inline-flex h-14 items-center gap-2 rounded-full border bg-brand-600 px-4 font-sans text-sm font-bold text-white shadow-[0_12px_30px_rgba(79,70,229,0.35)] transition-colors active:scale-[0.97] hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] dark:bg-brand-400 dark:text-zinc-950 dark:hover:bg-brand-300"
            style={{ borderColor: 'var(--color-border)' }}
            aria-expanded={isOpen}
            aria-controls="vsa-ai-assistant-panel"
            aria-label={isOpen ? 'Ask VSA (close assistant)' : 'Ask VSA (open assistant)'}
          >
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--color-bg)] bg-amber-300 shadow-sm" />
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 dark:bg-brand-950/10">
              <ChatSparkIcon className="h-5 w-5" />
            </span>
            <span className="hidden sm:inline">Ask VSA</span>
            <span className="sm:hidden">Ask</span>
          </motion.button>
          <button
            type="button"
            onClick={onMinimize}
            className="touch-hit absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border bg-[var(--color-surface)] text-[var(--color-text2)] shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:hidden"
            style={{ borderColor: 'var(--color-border)' }}
            aria-label="Minimize Ask VSA"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

    </>
  );
}
