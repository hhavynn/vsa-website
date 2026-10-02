// Unsaved-changes detection for admin forms and draft editors. Pure so the
// rules (what counts as a change, when to warn) are testable without a DOM.

/**
 * Forms treat "", whitespace, null and undefined as the same empty value, so
 * tabbing through an optional field never marks a form dirty.
 */
export function normalizeForCompare(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, normalizeForCompare(entry)]),
    );
  }
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    // A key missing on one side is blank, so it only differs when the other side has a value.
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return Array.from(keys).every((key) => sameValue(normalizeForCompare(left[key]), normalizeForCompare(right[key])));
  }
  return a === b;
}

export function isDirty(initial: unknown, current: unknown): boolean {
  return !sameValue(normalizeForCompare(initial), normalizeForCompare(current));
}

/** Keys whose value differs, so a Save bar can say what changed. */
export function changedFields<T extends object>(initial: T, current: T): Array<keyof T> {
  const keys = new Set<keyof T>([...(Object.keys(initial) as Array<keyof T>), ...(Object.keys(current) as Array<keyof T>)]);
  return Array.from(keys).filter((key) => isDirty(initial[key], current[key]));
}

export type SaveStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

/**
 * The status the Save bar shows. A failed save stays "error" (and keeps the
 * form's values) until the admin edits again or retries; success is "saved"
 * only while nothing has changed since.
 */
export function saveStatus(options: { dirty: boolean; saving: boolean; failed: boolean; justSaved: boolean }): SaveStatus {
  if (options.saving) return 'saving';
  if (options.failed && options.dirty) return 'error';
  if (options.dirty) return 'dirty';
  return options.justSaved ? 'saved' : 'clean';
}

export function canSave(status: SaveStatus): boolean {
  return status === 'dirty' || status === 'error';
}

export const UNSAVED_MESSAGE = 'You have unsaved changes. Leave without saving?';

/** Whether leaving the page (reload, close, navigate) should prompt. */
export function shouldWarnOnLeave(dirty: boolean, saving: boolean): boolean {
  return dirty || saving;
}

export interface ClickLike {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface AnchorLike {
  href: string;
  target?: string | null;
  hasAttribute?: (name: string) => boolean;
}

/**
 * True when a click on `anchor` would leave the current admin page for another
 * in-app location, so an unsaved-changes prompt applies. New-tab clicks,
 * downloads, external links, and same-page hash jumps never prompt.
 */
export function isLeavingNavigation(click: ClickLike, anchor: AnchorLike, currentHref: string): boolean {
  if (click.defaultPrevented || click.button !== 0) return false;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute?.('download')) return false;
  let to: URL;
  let from: URL;
  try {
    from = new URL(currentHref);
    to = new URL(anchor.href, currentHref);
  } catch {
    return false;
  }
  if (to.origin !== from.origin) return false;
  // Same path and query with only a hash change stays on this page.
  return !(to.pathname === from.pathname && to.search === from.search);
}
