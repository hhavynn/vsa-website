// Practical undo for recent, simple admin edits where the previous value is
// known: a House, an ACE Big, an ACE member link, an intern mentor. It is a
// compare-and-set, not a database rollback: the change is only reversed while
// its recorded result is still current and the record is still editable.
//
// Publication, reveal, year setup, deletions, and bulk edits never come here;
// isUndoable() (lib/adminActivity.ts) refuses them, and this module checks
// again before touching anything.
import { supabase } from '../../lib/supabase';
import {
  ActivityDraft,
  ActivityEntry,
  UndoPlan,
  UndoSpec,
  isUndoable,
  planUndo,
  readUndoSpec,
  undoEntryDraft,
} from '../../lib/adminActivity';
import { aceAssignmentsRepository } from './aceAssignments';
import { aceFamiliesRepository } from './aceFamilies';
import { adminActivityRepository } from './adminActivity';
import { houseAssignmentsRepository } from './houseAssignments';
import { internCohortRepository } from './internCohort';

export interface UndoState {
  found: boolean;
  value: string | null;
  editable: boolean;
}

export interface UndoDeps {
  readState: (spec: UndoSpec) => Promise<UndoState>;
  apply: (spec: UndoSpec, restore: string | null) => Promise<void>;
  record: (draft: ActivityDraft) => Promise<unknown>;
  now: () => number;
}

export type UndoResult = { ok: true } | { ok: false; reason: string };

async function readSingle<T>(request: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T | null> {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data;
}

const defaultDeps: UndoDeps = {
  now: () => Date.now(),
  record: (draft) => adminActivityRepository.record(draft),

  async readState(spec) {
    switch (spec.kind) {
      case 'house_draft_house': {
        const row = await readSingle<{ house_profile_id: string | null }>(
          supabase.from('house_assignment_drafts').select('house_profile_id').eq('id', spec.target.draftId).eq('batch_id', spec.target.batchId).maybeSingle(),
        );
        const batch = await readSingle<{ status: string }>(supabase.from('house_assignment_batches').select('status').eq('id', spec.target.batchId).maybeSingle());
        return { found: !!row && !!batch, value: row?.house_profile_id ?? null, editable: batch?.status === 'draft' };
      }
      case 'ace_draft_big': {
        const row = await readSingle<{ big_ace_member_id: string | null; cycle_id: string }>(
          supabase.from('ace_assignment_drafts').select('big_ace_member_id, cycle_id').eq('id', spec.target.draftId).maybeSingle(),
        );
        const cycle = row ? await readSingle<{ status: string }>(supabase.from('ace_assignment_cycles').select('status').eq('id', row.cycle_id).maybeSingle()) : null;
        return { found: !!row && !!cycle, value: row?.big_ace_member_id ?? null, editable: cycle?.status === 'draft' };
      }
      case 'ace_node_link': {
        const row = await readSingle<{ member_id: string | null }>(supabase.from('ace_family_members').select('member_id').eq('id', spec.target.nodeId).maybeSingle());
        return { found: !!row, value: row?.member_id ?? null, editable: true };
      }
      case 'intern_mentor': {
        const row = await readSingle<{ mentor_cabinet_member_id: string | null }>(
          supabase.from('intern_cohort_drafts').select('mentor_cabinet_member_id').eq('id', spec.target.draftId).eq('cycle_id', spec.target.cycleId).maybeSingle(),
        );
        const cycle = await readSingle<{ status: string }>(supabase.from('intern_cohort_cycles').select('status').eq('id', spec.target.cycleId).maybeSingle());
        return { found: !!row && !!cycle, value: row?.mentor_cabinet_member_id ?? null, editable: cycle?.status === 'draft' };
      }
    }
  },

  async apply(spec, restore) {
    switch (spec.kind) {
      case 'house_draft_house':
        await houseAssignmentsRepository.updateDraft(spec.target.batchId, spec.target.draftId, { house_profile_id: restore });
        return;
      case 'ace_draft_big':
        await aceAssignmentsRepository.updateDraft(spec.target.draftId, { big_ace_member_id: restore });
        return;
      case 'ace_node_link':
        await aceFamiliesRepository.setMemberLink(spec.target.nodeId, restore);
        return;
      case 'intern_mentor':
        await internCohortRepository.updateDraft(spec.target.cycleId, spec.target.draftId, { mentor_cabinet_member_id: restore });
        return;
    }
  },
};

/**
 * Reverses one logged change. Re-checks everything at click time, because the
 * entry may be old and the row may have moved on since it was shown.
 */
export async function undoActivity(
  entry: ActivityEntry,
  options: { undoneIds?: ReadonlySet<string>; deps?: UndoDeps } = {},
): Promise<UndoResult> {
  const deps = options.deps ?? defaultDeps;
  if (!isUndoable(entry, { now: deps.now(), undoneIds: options.undoneIds })) {
    return { ok: false, reason: 'This change can no longer be undone from here. Use the workflow that made it to correct it.' };
  }
  const spec = readUndoSpec(entry.metadata);
  if (!spec) return { ok: false, reason: 'This change has no undo information.' };

  let plan: UndoPlan;
  try {
    plan = planUndo(spec, await deps.readState(spec));
  } catch (error) {
    console.error(error);
    return { ok: false, reason: 'Could not check the current value. Nothing was changed.' };
  }
  if (!plan.ok) return { ok: false, reason: plan.reason };

  try {
    await deps.apply(spec, plan.restore);
  } catch (error) {
    console.error(error);
    return { ok: false, reason: 'The undo failed. Nothing was changed.' };
  }
  await deps.record(undoEntryDraft(entry));
  return { ok: true };
}
