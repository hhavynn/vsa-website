import { useCallback, useEffect, useRef } from 'react';
import { UNSAVED_MESSAGE, isLeavingNavigation, shouldWarnOnLeave } from '../lib/adminDirty';

/**
 * Warns before an admin loses unsaved edits: closing or reloading the tab, and
 * clicking an in-app link to another page. (The app uses a plain
 * BrowserRouter, so there is no router-level blocker; this watches the link
 * click instead.) Returns `confirmDiscard` for in-page transitions such as
 * switching to another record or cancelling a form.
 */
export function useUnsavedChangesGuard(dirty: boolean, saving = false, message: string = UNSAVED_MESSAGE) {
  const warn = shouldWarnOnLeave(dirty, saving);
  const warnRef = useRef(warn);
  warnRef.current = warn;

  useEffect(() => {
    if (!warn) return undefined;

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
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [warn, message]);

  return useCallback(() => !warnRef.current || window.confirm(message), [message]);
}
