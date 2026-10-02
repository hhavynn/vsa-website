import { supabase } from '../../lib/supabase';
import { runBulkWrites } from '../../lib/bulkWrites';
import { AceAssignmentCycle, AceAssignmentDraft, AceAssignmentStatus } from '../../types';
import { ValidationError, withErrorHandling } from '../errors';
import { DraftSeed, canTransitionCycle } from '../../lib/aceAssignments';

export interface PublishResult {
  cycleId: string;
  /** Nodes this call created; 0 when the cycle was already published. */
  created: number;
  total: number;
  alreadyPublished: boolean;
}

export type AceAssignmentDraftPatch = Partial<
  Pick<AceAssignmentDraft, 'little_name' | 'little_member_id' | 'big_ace_member_id' | 'notes' | 'display_order'>
>;

function parsePublishResult(data: unknown): PublishResult {
  const row = (data ?? {}) as Record<string, unknown>;
  if (typeof row.cycle_id !== 'string' || typeof row.created !== 'number') {
    throw new ValidationError('Publish returned an unexpected response');
  }
  return {
    cycleId: row.cycle_id,
    created: row.created,
    total: typeof row.total === 'number' ? row.total : row.created,
    alreadyPublished: row.already_published === true,
  };
}

/**
 * Admin-only. Drafts live in their own tables and never touch the public ACE
 * tree until `publishCycle`, which runs as one database transaction.
 */
export class AceAssignmentsRepository {
  async listCycles(): Promise<AceAssignmentCycle[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_assignment_cycles')
        .select('*')
        .order('academic_year_start', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AceAssignmentCycle[];
    }, 'Failed to load assignment cycles');
  }

  async createCycle(academicYearStart: number): Promise<AceAssignmentCycle> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_assignment_cycles')
        .insert({ academic_year_start: academicYearStart, academic_year_end: academicYearStart + 1 })
        .select('*')
        .single();
      if (error) throw error;
      return data as AceAssignmentCycle;
    }, 'Failed to create assignment cycle');
  }

  /**
   * Lock, unlock, or archive. The update only matches while the cycle is still
   * in `from`, so a stale screen cannot overwrite another admin's change.
   */
  async setCycleStatus(
    cycleId: string,
    from: AceAssignmentStatus,
    to: AceAssignmentStatus,
  ): Promise<AceAssignmentCycle> {
    if (to === 'published') {
      throw new ValidationError('Use publishCycle to publish', 'status', to);
    }
    if (!canTransitionCycle(from, to)) {
      throw new ValidationError(`A ${from} cycle cannot become ${to}`, 'status', to);
    }
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_assignment_cycles')
        .update({ status: to, updated_at: new Date().toISOString() })
        .eq('id', cycleId)
        .eq('status', from)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new ValidationError('This cycle changed while you were editing. Refresh and try again.');
      return data as AceAssignmentCycle;
    }, 'Failed to update assignment cycle');
  }

  async listDrafts(cycleId: string): Promise<AceAssignmentDraft[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_assignment_drafts')
        .select('*')
        .eq('cycle_id', cycleId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AceAssignmentDraft[];
    }, 'Failed to load assignments');
  }

  /** Adds draft rows after `startOrder`; imports create drafts only. */
  async addDrafts(cycleId: string, seeds: readonly DraftSeed[], startOrder: number): Promise<AceAssignmentDraft[]> {
    if (seeds.length === 0) return [];
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_assignment_drafts')
        .insert(
          seeds.map((seed, index) => ({
            cycle_id: cycleId,
            little_name: seed.little_name,
            little_member_id: seed.little_member_id,
            big_ace_member_id: seed.big_ace_member_id,
            notes: seed.notes,
            display_order: startOrder + index,
          })),
        )
        .select('*');
      if (error) throw error;
      return (data ?? []) as AceAssignmentDraft[];
    }, 'Failed to add Littles');
  }

  async updateDraft(id: string, patch: AceAssignmentDraftPatch): Promise<AceAssignmentDraft> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_assignment_drafts')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as AceAssignmentDraft;
    }, 'Failed to update assignment');
  }

  async deleteDraft(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.from('ace_assignment_drafts').delete().eq('id', id);
      if (error) throw error;
    }, 'Failed to remove assignment');
  }

  /** Links reviewed matches; each update only applies while the Little is still unlinked. */
  async linkDraftMembers(
    links: ReadonlyArray<{ draftId: string; memberId: string }>,
  ): Promise<{ linked: string[]; skipped: string[] }> {
    return withErrorHandling(async () => {
      const linked: string[] = [];
      const skipped: string[] = [];
      await runBulkWrites(async () => {
        for (const link of links) {
          const { data, error } = await supabase
            .from('ace_assignment_drafts')
            .update({ little_member_id: link.memberId, updated_at: new Date().toISOString() })
            .eq('id', link.draftId)
            .is('little_member_id', null)
            .select('id');
          if (error) throw error;
          (data && data.length > 0 ? linked : skipped).push(link.draftId);
        }
      });
      return { linked, skipped };
    }, 'Failed to link Littles');
  }

  /**
   * Creates the live ACE nodes. The database locks the cycle, re-checks every
   * hard blocker, and does all inserts in one transaction; calling it again
   * for a published cycle returns `created: 0` instead of adding duplicates.
   */
  async publishCycle(cycleId: string): Promise<PublishResult> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('publish_ace_assignment_cycle', { p_cycle_id: cycleId });
      if (error) throw error;
      return parsePublishResult(data);
    }, 'Failed to publish assignments');
  }
}

export const aceAssignmentsRepository = new AceAssignmentsRepository();
