// Executing a bulk admin action: per-item results (a half-succeeded action
// must say so, not report generic success), progress, and the summary copy.
// Pairs with planBulk (adminBulk.ts), which decides what is eligible and
// previews it; nothing here decides *what* to change.
import { pluralize } from './operationalStatus';

export interface BulkFailure<T> {
  item: T;
  error: string;
}

export interface BulkRunResult<T> {
  /** The primary write committed (including items that also carry a warning). */
  succeeded: T[];
  failed: Array<BulkFailure<T>>;
  /** Committed, but a follow-up step did not finish; the item is NOT unchanged and retrying would not help. */
  warnings?: Array<BulkFailure<T>>;
}

/**
 * Throw from a bulk op once its main write has committed but a follow-up step
 * failed (e.g. a mirrored listing did not sync). The item counts as changed,
 * is reported as needing attention, and is not offered for retry — repeating
 * the main write would not repair the follow-up.
 */
export class BulkPartialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkPartialError';
    // ES5 targets break `instanceof` for Error subclasses.
    Object.setPrototypeOf(this, BulkPartialError.prototype);
  }
}

export function isBulkPartialError(error: unknown): error is BulkPartialError {
  return error instanceof Error && error.name === 'BulkPartialError';
}

export interface RunBulkOptions {
  /** How many writes may be in flight. Small by default: these are admin clicks, not a batch job. */
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return 'Unknown error';
}

/**
 * Runs `op` for each item, never throwing: every failure is recorded against
 * its item so the admin sees exactly which ones did not change.
 */
export async function runBulk<T>(items: readonly T[], op: (item: T) => Promise<unknown>, options: RunBulkOptions = {}): Promise<BulkRunResult<T>> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 8));
  const succeeded: T[] = [];
  const failed: Array<BulkFailure<T>> = [];
  const warnings: Array<BulkFailure<T>> = [];
  let cursor = 0;
  let done = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        await op(item);
        succeeded.push(item);
      } catch (error) {
        if (isBulkPartialError(error)) {
          succeeded.push(item);
          warnings.push({ item, error: error.message });
        } else {
          failed.push({ item, error: errorText(error) });
        }
      }
      done += 1;
      options.onProgress?.(done, items.length);
    }
  };

  options.onProgress?.(0, items.length);
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return { succeeded, failed, warnings };
}

export type BulkOutcomeTone = 'success' | 'partial' | 'failure' | 'empty';

export interface BulkOutcome {
  tone: BulkOutcomeTone;
  headline: string;
}

/** "Archived 9 of 12 resources. 3 failed." — never a bare "Done". */
export function summarizeBulkResult<T>(
  result: BulkRunResult<T>,
  words: { past: string; verb: string; noun: string; nounPlural?: string },
): BulkOutcome {
  const { past, verb, noun } = words;
  const nounPlural = words.nounPlural ?? `${noun}s`;
  const ok = result.succeeded.length;
  const bad = result.failed.length;
  const warned = result.warnings?.length ?? 0;
  const total = ok + bad;
  if (total === 0) return { tone: 'empty', headline: `Nothing to ${verb}.` };
  const attention = warned > 0 ? ` ${warned} saved but need${warned === 1 ? 's' : ''} attention.` : '';
  if (bad === 0) {
    return { tone: warned > 0 ? 'partial' : 'success', headline: `${past} ${pluralize(ok, noun, nounPlural)}.${attention}` };
  }
  if (ok === 0) return { tone: 'failure', headline: `Could not ${verb} any of the ${pluralize(total, noun, nounPlural)}. Nothing changed.` };
  return { tone: 'partial', headline: `${past} ${ok} of ${pluralize(total, noun, nounPlural)}. ${bad} failed and were left unchanged.${attention}` };
}
