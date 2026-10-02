import { useCallback, useEffect, useRef } from 'react';
import { UNSAVED_MESSAGE, isLeavingNavigation, shouldWarnOnLeave } from '../lib/adminDirty';

// Every mounted guard that currently has unsaved work. Programmatic navigation
// (Quick Search, a button that calls navigate()) never produces a link click,
// so it asks this registry instead.
const dirtyGuards = new Set<symbol>();

export function hasUnsavedChanges(): boolean {
  return dirtyGuards.size > 0;
}

/** Prompts when any guard has unsaved work; true means it is fine to leave. */
export function confirmLeaveIfUnsaved(message: string = UNSAVED_MESSAGE): boolean {
  return !hasUnsavedChanges() || window.confirm(message);
}

/**
 * Warns before an admin loses unsaved edits: closing or reloading the tab, and
 * clicking an in-app link to another page. (The app uses a plain
 * BrowserRouter, so there is no router-level blocker; this watches the link
 * click instead.) Programmatic navigation should call `confirmLeaveIfUnsaved`.
 * Returns `confirmDiscard` for in-page transitions such as switching to
 * another record or cancelling a form.
 */
export function useUnsavedChangesGuard(dirty: boolean, saving = false, message: string = UNSAVED_MESSAGE) {
  const warn = shouldWarnOnLeave(dirty, saving);
  const warnRef = useRef(warn);
  warnRef.current = warn;

  useEffect(() => {
    if (!warn) return undefined;

    const token = Symbol('unsaved-changes');
    dirtyGuards.add(token);

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Some browsers require a returnValue to show the prompt.
      event.returnValue = '';
    };

    const onClick = (event: MouseEvent) => {
      if (!warnRef.current) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (!isLeavingNavigation(event, anchor, window.location.href)) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    // Capture phase, so this runs before the router's own link handler.
    document.addEventListener('click', onClick, true);
    return () => {
      dirtyGuards.delete(token);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [warn, message]);

  return useCallback(() => !warnRef.current || window.confirm(message), [message]);
}
