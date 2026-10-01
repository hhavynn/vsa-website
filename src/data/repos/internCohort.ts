// Private intern cohort cycles (draft -> lock -> publish). Admin only.
// Publishing writes cabinet_members with category = 'Interns' for the cycle's
// cabinet year — the one source the public Internship and Cabinet pages already
// read — and records each resulting id on the draft so a repeat publish updates
// in place instead of creating duplicates.
import { supabase } from '../../lib/supabase';
import {
  InternCohortCycle,
  InternCohortDraft,
  InternCohortDraftInsert,
  InternMemberOption,
  MentorOption,
  INTERN_CATEGORY,
  buildInternPreflight,
  cabinetMemberFromIntern,
  sortDrafts,
} from '../../lib/internCohort';
import { NotFoundError, ValidationError, withErrorHandling } from '../errors';

const INSERT_CHUNK = 200;
const DIRECTORY_PAGE_SIZE = 1000;

export type InternDraftPatch = Partial<Pick<
  InternCohortDraft,
  'name' | 'member_id' | 'mentor_cabinet_member_id' | 'role_or_track' | 'caption' | 'internal_notes' | 'display_order'
>>;

export interface PublishInternCohortResult {
  alreadyPublished: boolean;
  created: number;
  updated: number;
}

export class InternCohortRepository {
  async listCycles(): Promise<InternCohortCycle[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('intern_cohort_cycles')
        .select('*')
        .neq('status', 'archived')
        .order('academic_year_start', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }, 'Failed to load intern cohorts');
  }

  async getCycle(cycleId: string): Promise<InternCohortCycle> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('intern_cohort_cycles')
        .select('*')
        .eq('id', cycleId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new NotFoundError('Intern cohort not found', 'intern_cohort_cycles', cycleId);
      return data;
    }, 'Failed to load intern cohort');
  }

  async getDrafts(cycleId: string): Promise<InternCohortDraft[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('intern_cohort_drafts')
        .select('*')
        .eq('cycle_id', cycleId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    }, 'Failed to load interns');
  }

  async createCycle(input: { academicYearStart: number; cabinetYearId: string; userId: string | null }): Promise<InternCohortCycle> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('intern_cohort_cycles')
        .insert({
          academic_year_start: input.academicYearStart,
          academic_year_end: input.academicYearStart + 1,
          cabinet_year_id: input.cabinetYearId,
          created_by: input.userId,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }, 'Failed to create intern cohort');
  }

  /** Only a draft cycle can change; the database enforces this too. */
  private async assertDraft(cycleId: string): Promise<InternCohortCycle> {
    const cycle = await this.getCycle(cycleId);
    if (cycle.status !== 'draft') {
      throw new ValidationError(`This cohort is ${cycle.status}. Reopen it before editing.`, 'status', cycle.status);
    }
    return cycle;
  }

  async addDrafts(cycleId: string, rows: Array<Omit<InternCohortDraftInsert, 'cycle_id'>>): Promise<InternCohortDraft[]> {
    return withErrorHandling(async () => {
      await this.assertDraft(cycleId);
      const created: InternCohortDraft[] = [];
      for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
        const { data, error } = await supabase
          .from('intern_cohort_drafts')
          .insert(rows.slice(i, i + INSERT_CHUNK).map((row) => ({ ...row, cycle_id: cycleId })))
          .select('*');
        if (error) throw error;
        created.push(...(data ?? []));
      }
      return created;
    }, 'Failed to add interns');
  }

  async updateDraft(cycleId: string, draftId: string, patch: InternDraftPatch): Promise<void> {
    return withErrorHandling(async () => {
      await this.assertDraft(cycleId);
      const { error } = await supabase
        .from('intern_cohort_drafts')
        .update(patch)
        .eq('id', draftId)
        .eq('cycle_id', cycleId);
      if (error) throw error;
    }, 'Failed to update intern');
  }

  async reorder(cycleId: string, order: Array<{ id: string; display_order: number }>): Promise<void> {
    return withErrorHandling(async () => {
      await this.assertDraft(cycleId);
      for (const entry of order) {
        const { error } = await supabase
          .from('intern_cohort_drafts')
          .update({ display_order: entry.display_order })
          .eq('id', entry.id)
          .eq('cycle_id', cycleId);
        if (error) throw error;
      }
    }, 'Failed to reorder interns');
  }

  async removeDraft(cycleId: string, draftId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.assertDraft(cycleId);
      const { error } = await supabase
        .from('intern_cohort_drafts')
        .delete()
        .eq('id', draftId)
        .eq('cycle_id', cycleId);
      if (error) throw error;
    }, 'Failed to remove intern');
  }

  async deleteCycle(cycleId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.assertDraft(cycleId);
      const { error } = await supabase.from('intern_cohort_cycles').delete().eq('id', cycleId);
      if (error) throw error;
    }, 'Failed to delete intern cohort');
  }

  private async setStatus(
    cycleId: string,
    from: InternCohortCycle['status'],
    to: InternCohortCycle['status'],
  ): Promise<void> {
    const { data, error } = await supabase
      .from('intern_cohort_cycles')
      .update({ status: to })
      .eq('id', cycleId)
      .eq('status', from)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new ValidationError(`The cohort was not ${from}; refresh and try again.`, 'status', from);
    }
  }

  /** Locking keeps the cohort private; it writes nothing public. */
  async lockCycle(cycleId: string): Promise<void> {
    return withErrorHandling(async () => {
      const cycle = await this.getCycle(cycleId);
      if (cycle.status !== 'draft') {
        throw new ValidationError(`This cohort is ${cycle.status}, not a draft.`, 'status', cycle.status);
      }
      const preflight = buildInternPreflight(await this.getDrafts(cycleId));
      if (!preflight.canLock) {
        throw new ValidationError(`Resolve before locking: ${preflight.blockers[0].message}`, 'preflight');
      }
      await this.setStatus(cycleId, 'draft', 'locked');
    }, 'Failed to lock intern cohort');
  }

  async reopenCycle(cycleId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.setStatus(cycleId, 'locked', 'draft');
    }, 'Failed to reopen intern cohort');
  }

  /**
   * Publishes a locked cohort to cabinet_members (category Interns). Each
   * intern resolves to an existing row in this order: the row already recorded
   * on the draft, an existing Interns row for the same member (or, if unlinked,
   * the same name) in this cabinet year, otherwise a new row. Re-running
   * therefore updates in place and never duplicates.
   */
  async publishCycle(cycleId: string): Promise<PublishInternCohortResult> {
    return withErrorHandling(async () => {
      const cycle = await this.getCycle(cycleId);
      if (cycle.status === 'published') return { alreadyPublished: true, created: 0, updated: 0 };
      if (cycle.status !== 'locked') {
        throw new ValidationError(`Only a locked cohort can be published (this one is ${cycle.status}).`, 'status', cycle.status);
      }

      const drafts = sortDrafts(await this.getDrafts(cycleId));
      const preflight = buildInternPreflight(drafts);
      if (!preflight.canLock) {
        throw new ValidationError(`Cannot publish: ${preflight.blockers[0].message}`, 'preflight');
      }

      const { data: existingRows, error: existingError } = await supabase
        .from('cabinet_members')
        .select('id, name, member_id')
        .eq('cabinet_year_id', cycle.cabinet_year_id)
        .eq('category', INTERN_CATEGORY);
      if (existingError) throw existingError;
      const existing = existingRows ?? [];
      const claimed = new Set(drafts.map((draft) => draft.published_cabinet_member_id).filter((id): id is string => !!id));

      let created = 0;
      let updated = 0;
      for (const draft of drafts) {
        const payload = cabinetMemberFromIntern(draft, cycle.cabinet_year_id);
        let targetId = draft.published_cabinet_member_id;

        if (!targetId) {
          const match = existing.find((row) => !claimed.has(row.id) && (
            draft.member_id
              ? row.member_id === draft.member_id
              : !row.member_id && row.name.trim().toLowerCase() === draft.name.trim().toLowerCase()
          ));
          if (match) {
            targetId = match.id;
            claimed.add(match.id);
          }
        }

        if (targetId) {
          const { data, error } = await supabase
            .from('cabinet_members')
            .update(payload)
            .eq('id', targetId)
            .select('id');
          if (error) throw error;
          if (data && data.length > 0) {
            updated += 1;
          } else {
            targetId = null;
          }
        }

        if (!targetId) {
          const { data, error } = await supabase
            .from('cabinet_members')
            .insert(payload)
            .select('id')
            .single();
          if (error) throw error;
          targetId = data.id;
          created += 1;
        }

        if (draft.published_cabinet_member_id !== targetId) {
          const { error } = await supabase
            .from('intern_cohort_drafts')
            .update({ published_cabinet_member_id: targetId })
            .eq('id', draft.id);
          if (error) throw error;
        }
      }

      await this.setStatus(cycleId, 'locked', 'published');
      return { alreadyPublished: false, created, updated };
    }, 'Failed to publish intern cohort');
  }

  /** Cabinet members who can mentor, for the cycle's cabinet year. */
  async listMentorOptions(cabinetYearId: string): Promise<MentorOption[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('cabinet_members')
        .select('id, name, role')
        .eq('cabinet_year_id', cabinetYearId)
        .neq('category', INTERN_CATEGORY)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    }, 'Failed to load mentors');
  }

  /**
   * TEMPORARY, isolated: every member's public identity, for name matching and
   * manual linking. Replace with memberLookupRepository.listMemberDirectory()
   * from the shared member-link work when it lands, and delete this method.
   * Reads only the public_members projection (no email).
   */
  async listMemberDirectory(): Promise<InternMemberOption[]> {
    return withErrorHandling(async () => {
      const members: InternMemberOption[] = [];
      for (let from = 0; ; from += DIRECTORY_PAGE_SIZE) {
        const { data, error } = await supabase
          .from('public_members')
          .select('id, first_name, last_name, college, year')
          .order('id', { ascending: true })
          .range(from, from + DIRECTORY_PAGE_SIZE - 1);
        if (error) throw error;
        members.push(...(data ?? []));
        if (!data || data.length < DIRECTORY_PAGE_SIZE) return members;
      }
    }, 'Failed to load member directory');
  }
}

export const internCohortRepository = new InternCohortRepository();
