import { SetStateAction, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Local draft state for a hand-written admin form that is seeded from a server
 * record.
 *
 * The usual pattern, `useEffect(() => setForm(fromServer(row)), [row])`, wipes
 * what the admin has typed whenever a background refetch hands back a changed
 * row (another admin saved, a related mutation invalidated the list, the
 * session was re-verified). This hook seeds the draft from the server in the
 * same situations, but never over unsaved edits:
 *
 * - `recordKey` changes (a different record was opened): the draft is replaced.
 * - Server data changes while the draft is untouched: the draft follows it.
 * - Server data changes while the draft has unsaved edits: the draft is kept.
 *   The held-back copy is dropped by `markSaved` and shown by `discard`.
 *
 * `serverDraft` may be a fresh object every render; only its JSON matters.
 */
export function useServerSeededDraft<D>(recordKey: string, serverDraft: D) {
  const [draft, setDraftState] = useState<D>(serverDraft);
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);
  const keyRef = useRef(recordKey);
  const latestRef = useRef(serverDraft);
  latestRef.current = serverDraft;
  const signature = JSON.stringify(serverDraft);
  const adoptedSignature = useRef(signature);

  useEffect(() => {
    const recordChanged = keyRef.current !== recordKey;
    keyRef.current = recordKey;
    if (!recordChanged && dirtyRef.current) return;
    dirtyRef.current = false;
    adoptedSignature.current = signature;
    setIsDirty(false);
    setDraftState(latestRef.current);
  }, [recordKey, signature]);

  /** Same signature as `useState`'s setter; any call marks the draft as edited. */
  const setDraft = useCallback((next: SetStateAction<D>) => {
    dirtyRef.current = true;
    setIsDirty(true);
    setDraftState(next);
  }, []);

  /**
   * The draft was saved. It stays on screen as the baseline: whatever server
   * copy was held back predates the save and is dropped, and only data that
   * arrives afterwards (the refetch of the row just written) seeds it again.
   * If that refetch fails, the saved draft is still what is shown.
   */
  const markSaved = useCallback(() => {
    dirtyRef.current = false;
    setIsDirty(false);
    adoptedSignature.current = JSON.stringify(latestRef.current);
  }, []);

  /** Throw the edits away and show the server's current copy. */
  const discard = useCallback(() => {
    dirtyRef.current = false;
    adoptedSignature.current = JSON.stringify(latestRef.current);
    setIsDirty(false);
    setDraftState(latestRef.current);
  }, []);

  return { draft, setDraft, isDirty, markSaved, discard };
}
