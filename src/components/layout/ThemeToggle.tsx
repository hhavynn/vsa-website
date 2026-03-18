import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';

interface ThemeToggleProps {
  className?: string;
}

/** Sun icon — shown in dark mode to switch to light */
function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364-.707-.707M6.343 6.343l-.707-.707m12.728 0-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
    </svg>
  );
}

/** Moon icon — shown in light mode to switch to dark */
function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9.003 9.003 0 0 0 8.354-5.646z" />
    </svg>
  );
}

/**
 * Refined theme toggle button.
 * - Fixed bottom-right on all pages
 * - 1px solid border, no shadow, no blur — matches editorial design system
 * - zinc-950 dark / zinc-50 light palette
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={cn(
        'fixed bottom-6 right-5 z-40',
        'flex items-center justify-center w-9 h-9',
        'rounded-md border transition-colors duration-150',
        // Light mode: zinc-50 bg, zinc-900 border, zinc-600 icon
        'bg-zinc-50 border-zinc-200 text-zinc-500',
        'hover:bg-zinc-100 hover:text-zinc-900',
        // Dark mode: zinc-900 bg, zinc-700 border, zinc-400 icon
        'dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400',
        'dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        'dark:focus-visible:ring-offset-zinc-950',
        className
      )}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
