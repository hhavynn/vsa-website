// Protected domain — House membership. Persisted, admin-only House assignment
// batches (draft -> lock -> publish). Locking never touches house_memberships;
// publishing materializes a locked batch through the existing dated-membership
// writer, so interval behavior is defined in exactly one place.
// Authority: AGENTS.md § "Things to never do"; vsa-change-control § 1.
import { supabase } from '../../lib/supabase';
import {
  HouseAssignmentBatch,
  HouseAssignmentDraft,
  HouseAssignmentDraftInsert,
  HouseProfileLite,
  PreflightResult,
  buildPreflight,
  publishableRows,
} from '../../lib/houseAssignmentDraft';
import type { MemberYearMembership } from '../../lib/houseMembershipIntervals';
import { NotFoundError, ValidationError, withErrorHandling } from '../errors';
import { houseMembershipsWriteRepository } from './houseMembershipWrites';

const INSERT_CHUNK = 200;

export interface CreateHouseBatchInput {
  academicYearStart: number;
  effectiveStartDate: string;
  sourceLabel: string | null;
  userId: string | null;
  rows: Array<Omit<HouseAssignmentDraftInsert, 'batch_id'>>;
}

export type HouseDraftPatch = Partial<Pick<
  HouseAssignmentDraft,
  'member_id' | 'house_profile_id' | 'match_status' | 'match_method' | 'match_score' | 'notes'
>>;

export interface HouseBatchSnapshot {
  batch: HouseAssignmentBatch;
  drafts: HouseAssignmentDraft[];
  profiles: HouseProfileLite[];
  existingMemberships: Map<string, MemberYearMembership[]>;
  preflight: PreflightResult;
}

export interface PublishHouseBatchResult {
  alreadyPublished: boolean;
  applied: number;
  skipped: number;
}

export class HouseAssignmentsRepository {
  async listBatches(academicYearStart: number): Promise<HouseAssignmentBatch[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_assignment_batches')
        .select('*')
        .eq('academic_year_start', academicYearStart)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }, 'Failed to load House assignment batches');
  }

  async getBatch(batchId: string): Promise<HouseAssignmentBatch> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_assignment_batches')
        .select('*')
        .eq('id', batchId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new NotFoundError('House assignment batch not found', 'house_assignment_batches', batchId);
      return data;
    }, 'Failed to load House assignment batch');
  }

  async getDrafts(batchId: string): Promise<HouseAssignmentDraft[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_assignment_drafts')
        .select('*')
        .eq('batch_id', batchId)
        .order('source_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    }, 'Failed to load House assignment drafts');
  }

  private async getProfiles(academicYearStart: number): Promise<HouseProfileLite[]> {
    const { data, error } = await supabase
      .from('house_page_assets')
      .select('id, house_key, display_name, is_active')
      .eq('academic_year_start', academicYearStart)
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async createBatch(input: CreateHouseBatchInput): Promise<HouseAssignmentBatch> {
    return withErrorHandling(async () => {
      if (input.rows.length === 0) {
        throw new ValidationError('A draft needs at least one row.', 'rows');
      }
      const { data: batch, error } = await supabase
        .from('house_assignment_batches')
        .insert({
          academic_year_start: input.academicYearStart,
          academic_year_end: input.academicYearStart + 1,
          effective_start_date: input.effectiveStartDate,
          source_label: input.sourceLabel,
          created_by: input.userId,
        })
        .select('*')
        .single();
      if (error) throw error;

      try {
        for (let i = 0; i < input.rows.length; i += INSERT_CHUNK) {
          const chunk = input.rows.slice(i, i + INSERT_CHUNK).map((row) => ({ ...row, batch_id: batch.id }));
          const { error: rowsError } = await supabase.from('house_assignment_drafts').insert(chunk);
          if (rowsError) throw rowsError;
        }
      } catch (rowsFailure) {
        // Do not leave a half-saved draft behind.
        await supabase.from('house_assignment_batches').delete().eq('id', batch.id);
        throw rowsFailure;
      }
      return batch;
    }, 'Failed to save House assignment draft');
  }

  /**
   * A draft batch with no rows, for New Year Setup. It assigns and reveals
   * nothing: rows arrive later through the normal paste/import flow.
   */
  async createEmptyBatch(input: Omit<CreateHouseBatchInput, 'rows'>): Promise<HouseAssignmentBatch> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('house_assignment_batches')
        .insert({
          academic_year_start: input.academicYearStart,
          academic_year_end: input.academicYearStart + 1,
          effective_start_date: input.effectiveStartDate,
          source_label: input.sourceLabel,
          created_by: input.userId,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }, 'Failed to create the House assignment batch');
  }

  /** Only a draft batch can change; the database enforces this too. */
  private async assertDraft(batchId: string): Promise<HouseAssignmentBatch> {
    const batch = await this.getBatch(batchId);
    if (batch.status !== 'draft') {
      throw new ValidationError(`This batch is ${batch.status}. Reopen it before editing.`, 'status', batch.status);
    }
    return batch;
  }

  async updateDraft(batchId: string, draftId: string, patch: HouseDraftPatch): Promise<void> {
    return withErrorHandling(async () => {
      await this.assertDraft(batchId);
      const { error } = await supabase
        .from('house_assignment_drafts')
        .update(patch)
        .eq('id', draftId)
        .eq('batch_id', batchId);
      if (error) throw error;
    }, 'Failed to update House assignment row');
  }

  async addDraft(batchId: string, row: Omit<HouseAssignmentDraftInsert, 'batch_id'>): Promise<HouseAssignmentDraft> {
    return withErrorHandling(async () => {
      await this.assertDraft(batchId);
      const { data, error } = await supabase
        .from('house_assignment_drafts')
        .insert({ ...row, batch_id: batchId })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }, 'Failed to add House assignment row');
  }

  async removeDraft(batchId: string, draftId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.assertDraft(batchId);
      const { error } = await supabase
        .from('house_assignment_drafts')
        .delete()
        .eq('id', draftId)
        .eq('batch_id', batchId);
      if (error) throw error;
    }, 'Failed to remove House assignment row');
  }

  async deleteBatch(batchId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.assertDraft(batchId);
      const { error } = await supabase.from('house_assignment_batches').delete().eq('id', batchId);
      if (error) throw error;
    }, 'Failed to delete House assignment draft');
  }

  /** Loads the batch with fresh preflight results. Reads only. */
  async loadSnapshot(batchId: string, memberNames?: Map<string, string>): Promise<HouseBatchSnapshot> {
    return withErrorHandling(async () => {
      const batch = await this.getBatch(batchId);
      const [drafts, profiles, existingMemberships] = await Promise.all([
        this.getDrafts(batchId),
        this.getProfiles(batch.academic_year_start),
        houseMembershipsWriteRepository.listMembershipsForYear(batch.academic_year_start),
      ]);
      const preflight = buildPreflight(drafts, profiles, {
        effectiveStartDate: batch.effective_start_date,
        existingMemberships,
        memberNames,
      });
      return { batch, drafts, profiles, existingMemberships, preflight };
    }, 'Failed to run House assignment preflight');
  }

  private async setStatus(
    batchId: string,
    from: HouseAssignmentBatch['status'],
    to: HouseAssignmentBatch['status'],
  ): Promise<void> {
    const { data, error } = await supabase
      .from('house_assignment_batches')
      .update({ status: to })
      .eq('id', batchId)
      .eq('status', from)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new ValidationError(`The batch was not ${from}; refresh and try again.`, 'status', from);
    }
  }

  /** Locks a draft. Locking never writes to house_memberships. */
  async lockBatch(batchId: string, memberNames?: Map<string, string>): Promise<PreflightResult> {
    return withErrorHandling(async () => {
      const snapshot = await this.loadSnapshot(batchId, memberNames);
      if (snapshot.batch.status !== 'draft') {
        throw new ValidationError(`This batch is ${snapshot.batch.status}, not a draft.`, 'status', snapshot.batch.status);
      }
      if (!snapshot.preflight.canLock) {
        throw new ValidationError(
          `Resolve ${snapshot.preflight.blockers.length} blocker${snapshot.preflight.blockers.length === 1 ? '' : 's'} before locking: ${snapshot.preflight.blockers[0].message}`,
          'preflight',
        );
      }
      await this.setStatus(batchId, 'draft', 'locked');
      return snapshot.preflight;
    }, 'Failed to lock House assignments');
  }

  async reopenBatch(batchId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.setStatus(batchId, 'locked', 'draft');
    }, 'Failed to reopen House assignments');
  }

  /**
   * Reveals a locked batch: writes each confirmed assignment as a dated
   * house_memberships row through the shared writer, then marks the batch
   * published. Re-running is safe — members already placed in the same House
   * from the same date are skipped, and a published batch is a no-op.
   */
  async publishBatch(batchId: string, userId: string | null): Promise<PublishHouseBatchResult> {
    return withErrorHandling(async () => {
      const batch = await this.getBatch(batchId);
      if (batch.status === 'published') return { alreadyPublished: true, applied: 0, skipped: 0 };
      if (batch.status !== 'locked') {
        throw new ValidationError(`Only a locked batch can be published (this one is ${batch.status}).`, 'status', batch.status);
      }

      const snapshot = await this.loadSnapshot(batchId);
      if (snapshot.preflight.blockers.length > 0) {
        throw new ValidationError(
          `Cannot publish: ${snapshot.preflight.blockers[0].message}`,
          'preflight',
        );
      }

      const existingByMember = snapshot.existingMemberships;
      const profileById = new Map(snapshot.profiles.map((profile) => [profile.id, profile]));
      let applied = 0;
      let skipped = 0;

      for (const row of publishableRows(snapshot.drafts, snapshot.profiles)) {
        const profile = profileById.get(row.house_profile_id as string) as HouseProfileLite;
        const result = await houseMembershipsWriteRepository.applyMembership({
          memberId: row.member_id as string,
          houseProfileId: profile.id,
          houseCacheLabel: profile.house_key,
          academicYearStart: batch.academic_year_start,
          effectiveStartDate: batch.effective_start_date,
          source: 'house_assignment_batch',
          sourceImportId: batch.id,
          notes: `Published from House assignment batch${batch.source_label ? ` "${batch.source_label}"` : ''}, row ${row.source_order + 1}.`,
          userId,
          memberLabel: row.source_name || row.member_id as string,
          existingMemberships: existingByMember.get(row.member_id as string) ?? [],
        });
        if (result === 'applied') applied += 1;
        else skipped += 1;
      }

      await this.setStatus(batchId, 'locked', 'published');
      return { alreadyPublished: false, applied, skipped };
    }, 'Failed to publish House assignments');
  }
}

export const houseAssignmentsRepository = new HouseAssignmentsRepository();
