// Keeps an admin's staged recovery decisions across navigation within one
// browser tab. Privacy: sessionStorage only (gone when the tab closes), one key
// per admin, a short TTL, other admins' keys removed on load, and never put in
// URLs or logs. Holds row and member ids, enums, notes and new-member inputs;
// no member snapshots. Every access is guarded: storage can be unavailable.
import type { StagedDecision, StagedKind } from './recoveryWorkspace';

const PREFIX = 'vsa.recovery-staging.v1.';
export const STAGING_TTL_MS = 4 * 60 * 60 * 1000;

const KINDS: ReadonlySet<StagedKind> = new Set<StagedKind>(['restore', 'create_member', 'reassign', 'dismiss', 'needs_info']);

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function isDecision(value: unknown): value is StagedDecision {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  const payload = d.payload as Record<string, unknown> | undefined;
  return typeof d.rowId === 'string' && typeof d.requestId === 'string' && KINDS.has(d.kind as StagedKind)
    && !!payload && payload.requestId === d.requestId && payload.rowId === d.rowId && payload.action === d.kind;
}

/** Removes every other admin's staged work and anything expired. */
function sweep(store: Storage, keepKey: string, now: number) {
  for (let i = store.length - 1; i >= 0; i -= 1) {
    const key = store.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    if (key !== keepKey) { store.removeItem(key); continue; }
    try {
      const saved = JSON.parse(store.getItem(key) ?? 'null') as { savedAt?: number } | null;
      if (!saved || typeof saved.savedAt !== 'number' || now - saved.savedAt > STAGING_TTL_MS) store.removeItem(key);
    } catch {
      store.removeItem(key);
    }
  }
}

export function loadStaged(userId: string, now = Date.now()): StagedDecision[] {
  const store = storage();
  if (!store) return [];
  try {
    sweep(store, PREFIX + userId, now);
    const saved = JSON.parse(store.getItem(PREFIX + userId) ?? 'null') as { decisions?: unknown } | null;
    return Array.isArray(saved?.decisions) ? saved!.decisions.filter(isDecision) : [];
  } catch {
    return [];
  }
}

export function saveStaged(userId: string, decisions: readonly StagedDecision[], now = Date.now()): void {
  const store = storage();
  if (!store) return;
  try {
    if (decisions.length === 0) store.removeItem(PREFIX + userId);
    else store.setItem(PREFIX + userId, JSON.stringify({ savedAt: now, decisions }));
  } catch {
    // Quota or privacy mode: staged work then lives only in memory.
  }
}

/** Clears one admin's staged work, or everyone's when no id is given. */
export function clearStaged(userId?: string): void {
  const store = storage();
  if (!store) return;
  try {
    if (userId) { store.removeItem(PREFIX + userId); return; }
    for (let i = store.length - 1; i >= 0; i -= 1) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX)) store.removeItem(key);
    }
  } catch {
    // Nothing to clear.
  }
}
