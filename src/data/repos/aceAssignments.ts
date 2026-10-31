import { supabase } from '../../lib/supabase';
import { runBulkWrites } from '../../lib/bulkWrites';
import { AceAssignmentCycle, AceAssignmentDraft, AceAssignmentStatus } from '../../types';
import { ValidationError, withErrorHandling } from '../errors';
import { DraftSeed, canTransitionCycle } from '../../lib/aceAssignments';
import { isTermConsistentWithYear } from '../../lib/acePickupYear';

/** Admin-private published-cycle Little roster; deliberately excludes draft notes/contacts. */
export interface PublishedAceLittle {
  id: string;
  little_name: string;
  little_member_id: string | null;
  big_ace_member_id: string | null;
  published_ace_member_id: string | null;
}

export interface PublishResult {
  cycleId: string;
  /** Nodes this call created; 0 when the cycle was already published. */
  created: number;
  total: number;
  alreadyPublished: boolean;
}

export interface AceEligibilityPolicyInput {
  littleMin: number;
  bigMin: number;
  eventIds: readonly string[];
}

export interface SavedEligibilityPolicy {
  cycleId: string;
  eventCount: number;
  added: number;
  removed: number;
}

export const ACE_ELIGIBILITY_UNAVAILABLE =
  'The ACE eligibility check is not available yet. Ask a site administrator to apply database migration 20261030184936.';

/** Missing table, column or function: the eligibility migration is not applied yet. */
function missingEligibilitySchema(code: string | undefined) {
  return code === 'PGRST202' || code === 'PGRST205' || code === '42883' || code === '42P01' || code === '42703';
}

const isMinimum = (value: number) => Number.isInteger(value) && value >= 1 && value <= 20;

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

  async createCycle(academicYearStart: number, pickupTerm: string): Promise<AceAssignmentCycle> {
    if (!isTermConsistentWithYear(pickupTerm, academicYearStart)) {
      throw new ValidationError('Choose an exact pickup term for the selected academic year.', 'pickup_term', pickupTerm);
    }
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_assignment_cycles')
        .insert({
          academic_year_start: academicYearStart,
          academic_year_end: academicYearStart + 1, pickup_term: pickupTerm,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as AceAssignmentCycle;
    }, 'Failed to create assignment cycle');
  }

  /** Draft-only CAS: older screens cannot overwrite a reviewed term. */
  async setCycleTerm(
    cycleId: string, academicYearStart: number,
    expectedTerm: string | null, pickupTerm: string,
  ): Promise<AceAssignmentCycle> {
    if (!isTermConsistentWithYear(pickupTerm, academicYearStart)) {
      throw new ValidationError('The selected term does not belong to this academic year.', 'pickup_term', pickupTerm);
    }
    return withErrorHandling(async () => {
      let query = supabase
        .from('ace_assignment_cycles')
        .update({ pickup_term: pickupTerm, updated_at: new Date().toISOString() })
        .eq('id', cycleId).eq('academic_year_start', academicYearStart).eq('status', 'draft');
      query = expectedTerm == null ? query.is('pickup_term', null) : query.eq('pickup_term', expectedTerm);
      const { data, error } = await query.select('*').maybeSingle();
      if (error) throw error;
      if (!data) throw new ValidationError('This cycle or pickup term changed. Refresh and review it again.');
      return data as AceAssignmentCycle;
    }, 'Failed to update ACE pickup term');
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

  /**
   * Read-only reviewed participation roster for one PUBLISHED ACE cycle.
   * All draft pages are read, but notes and imported application fields are excluded.
   * A missing/locked cycle, row read error or later-page failure blocks evaluation.
   */
  async listPublishedCycleLittles(cycleId: string, year: number): Promise<PublishedAceLittle[]> {
    return withErrorHandling(async () => {
      const { data: cycle, error: cycleError } = await supabase
        .from('ace_assignment_cycles').select('id,status,academic_year_start')
        .eq('id', cycleId).single();
      if (cycleError) throw cycleError;
      if (!cycle || cycle.status !== 'published' || cycle.academic_year_start !== year) {
        throw new ValidationError('ACE cycle is not published for the chosen year.');
      }
      const roster: PublishedAceLittle[] = [];
      for (let from=0;;from+=500) {
        const {data,error} = await supabase.from('ace_assignment_drafts')
          .select('id,little_name,little_member_id,big_ace_member_id,published_ace_member_id')
          .eq('cycle_id',cycleId).order('id',{ascending:true}).range(from,from+499);
        if (error) throw error;
        const page=(data??[]) as PublishedAceLittle[];
        roster.push(...page);
        if (page.length<500) break;
      }
      return roster;
    }, 'Failed to load complete published ACE participation roster');
  }

  /** The cycle's saved qualifying events (at most 100). */
  async listEligibilityEventIds(cycleId: string): Promise<string[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_assignment_cycle_events')
        .select('event_id')
        .eq('cycle_id', cycleId)
        .order('event_id', { ascending: true });
      if (error) {
        if (missingEligibilitySchema(error.code)) throw new ValidationError(ACE_ELIGIBILITY_UNAVAILABLE);
        throw error;
      }
      return ((data ?? []) as Array<{ event_id: string }>).map((row) => row.event_id);
    }, 'Failed to load the eligibility policy');
  }

  /**
   * Saves both minimums and the qualifying event set in one transaction. The
   * database refuses it once the cycle has left draft, and refuses any event
   * that is not completed, dated, published and in the cycle's year.
   */
  async saveEligibilityPolicy(cycleId: string, policy: AceEligibilityPolicyInput): Promise<SavedEligibilityPolicy> {
    if (!isMinimum(policy.littleMin) || !isMinimum(policy.bigMin)) {
      throw new ValidationError('Minimums must be whole numbers from 1 to 20', 'minimum');
    }
    const eventIds = Array.from(new Set(policy.eventIds)).sort();
    if (eventIds.length > 100) throw new ValidationError('Choose at most 100 qualifying events', 'events');
    return withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('save_ace_eligibility_policy', {
        p_cycle_id: cycleId,
        p_little_min_events: policy.littleMin,
        p_big_min_events: policy.bigMin,
        p_event_ids: eventIds,
      });
      if (error) {
        if (missingEligibilitySchema(error.code)) throw new ValidationError(ACE_ELIGIBILITY_UNAVAILABLE);
        throw error;
      }
      const row = (data ?? {}) as Record<string, unknown>;
      if (row.cycle_id !== cycleId || typeof row.event_count !== 'number') {
        throw new ValidationError('Saving the eligibility policy returned an unexpected response');
      }
      return {
        cycleId,
        eventCount: row.event_count,
        added: typeof row.added === 'number' ? row.added : 0,
        removed: typeof row.removed === 'number' ? row.removed : 0,
      };
    }, 'Failed to save the eligibility policy');
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
