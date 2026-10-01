// Private Cabinet roster cycles (draft -> lock -> publish). Admin only.
// Publishing runs as ONE database transaction (publish_cabinet_roster_cycle):
// it locks the cycle, writes cabinet_members for the cycle's cabinet year — the
// one source the public Cabinet page reads — stamps each draft, and marks the
// cycle published, so a failure never leaves a partial Cabinet public and two
// admins cannot both publish. It never activates the cabinet year; activation
// is its own explicit action.
import { supabase } from '../../lib/supabase';
import {
  CabinetRosterCycle,
  CabinetRosterDraft,
  CabinetRosterDraftInsert,
  ROSTER_EXCLUDED_CATEGORY,
  RosterDraftPatch,
  buildRosterPreflight,
  buildStructureRows,
  sortRosterDrafts,
} from '../../lib/cabinetRoster';
import { NotFoundError, ValidationError, withErrorHandling } from '../errors';

const INSERT_CHUNK = 200;

export interface CreateRosterCycleInput {
  cabinetYearId: string;
  /** When set, the position structure (never people) is copied from this year. */
  sourceCabinetYearId: string | null;
  userId: string | null;
}

export interface CreateRosterCycleResult {
  cycle: CabinetRosterCycle;
  /** False when a live cycle already existed for the year (nothing was written). */
  created: boolean;
  positionsCopied: number;
}

export interface PublishRosterResult {
  alreadyPublished: boolean;
  created: number;
  updated: number;
}

function parsePublishResult(data: unknown): PublishRosterResult {
  const row = (data ?? {}) as Record<string, unknown>;
  if (typeof row.created !== 'number' || typeof row.updated !== 'number') {
    throw new ValidationError('Publish returned an unexpected response');
  }
  return { alreadyPublished: row.already_published === true, created: row.created, updated: row.updated };
}

export class CabinetRosterRepository {
  async listCycles(): Promise<CabinetRosterCycle[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('cabinet_roster_cycles')
        .select('*')
        .neq('status', 'archived')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    }, 'Failed to load Cabinet rosters');
  }

  async getCycle(cycleId: string): Promise<CabinetRosterCycle> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('cabinet_roster_cycles')
        .select('*')
        .eq('id', cycleId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new NotFoundError('Cabinet roster not found', 'cabinet_roster_cycles', cycleId);
      return data;
    }, 'Failed to load Cabinet roster');
  }

  async findLiveCycleForYear(cabinetYearId: string): Promise<CabinetRosterCycle | null> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('cabinet_roster_cycles')
        .select('*')
        .eq('cabinet_year_id', cabinetYearId)
        .neq('status', 'archived')
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    }, 'Failed to look up the Cabinet roster');
  }

  async getDrafts(cycleId: string): Promise<CabinetRosterDraft[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('cabinet_roster_drafts')
        .select('*')
        .eq('cycle_id', cycleId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return sortRosterDrafts(data ?? []);
    }, 'Failed to load Cabinet positions');
  }

  /** Role / category / display_order of a year's public rows, for structure copy. */
  async listStructureSource(cabinetYearId: string) {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('cabinet_members')
        .select('role, category, display_order')
        .eq('cabinet_year_id', cabinetYearId)
        .neq('category', ROSTER_EXCLUDED_CATEGORY);
      if (error) throw error;
      return data ?? [];
    }, 'Failed to read the previous Cabinet structure');
  }

  /** Public rows already on a cabinet year, for the publish confirmation. */
  async countPublicRows(cabinetYearId: string): Promise<number> {
    return withErrorHandling(async () => {
      const { count, error } = await supabase
        .from('cabinet_members')
        .select('id', { count: 'exact', head: true })
        .eq('cabinet_year_id', cabinetYearId)
        .neq('category', ROSTER_EXCLUDED_CATEGORY);
      if (error) throw error;
      return count ?? 0;
    }, 'Failed to count Cabinet rows');
  }

  /**
   * Starts a roster draft for a cabinet year. Idempotent: an existing live
   * cycle is returned untouched. Copying structure writes role, category and
   * display_order only — never names, member links, photos, or bios.
   */
  async createCycle(input: CreateRosterCycleInput): Promise<CreateRosterCycleResult> {
    return withErrorHandling(async () => {
      const existing = await this.findLiveCycleForYear(input.cabinetYearId);
      if (existing) return { cycle: existing, created: false, positionsCopied: 0 };

      const structure = input.sourceCabinetYearId
        ? buildStructureRows(await this.listStructureSource(input.sourceCabinetYearId))
        : [];

      const { data: cycle, error } = await supabase
        .from('cabinet_roster_cycles')
        .insert({
          cabinet_year_id: input.cabinetYearId,
          source_cabinet_year_id: input.sourceCabinetYearId,
          created_by: input.userId,
        })
        .select('*')
        .single();
      if (error) throw error;

      try {
        for (let i = 0; i < structure.length; i += INSERT_CHUNK) {
          const { error: rowsError } = await supabase
            .from('cabinet_roster_drafts')
            .insert(structure.slice(i, i + INSERT_CHUNK).map((row) => ({ ...row, cycle_id: cycle.id })));
          if (rowsError) throw rowsError;
        }
      } catch (rowsFailure) {
        // Do not leave a half-copied draft behind.
        await supabase.from('cabinet_roster_cycles').delete().eq('id', cycle.id);
        throw rowsFailure;
      }
      return { cycle, created: true, positionsCopied: structure.length };
    }, 'Failed to start the Cabinet roster');
  }

  /** Only a draft cycle can change; the database enforces this too. */
  private async assertDraft(cycleId: string): Promise<CabinetRosterCycle> {
    const cycle = await this.getCycle(cycleId);
    if (cycle.status !== 'draft') {
      throw new ValidationError(`This roster is ${cycle.status}. Reopen it before editing.`, 'status', cycle.status);
    }
    return cycle;
  }

  async addDrafts(cycleId: string, rows: Array<Omit<CabinetRosterDraftInsert, 'cycle_id'>>): Promise<CabinetRosterDraft[]> {
    return withErrorHandling(async () => {
      await this.assertDraft(cycleId);
      const created: CabinetRosterDraft[] = [];
      for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
        const { data, error } = await supabase
          .from('cabinet_roster_drafts')
          .insert(rows.slice(i, i + INSERT_CHUNK).map((row) => ({ ...row, cycle_id: cycleId })))
          .select('*');
        if (error) throw error;
        created.push(...(data ?? []));
      }
      return created;
    }, 'Failed to add Cabinet positions');
  }

  async updateDraft(cycleId: string, draftId: string, patch: RosterDraftPatch): Promise<void> {
    return withErrorHandling(async () => {
      await this.assertDraft(cycleId);
      const { error } = await supabase
        .from('cabinet_roster_drafts')
        .update(patch)
        .eq('id', draftId)
        .eq('cycle_id', cycleId);
      if (error) throw error;
    }, 'Failed to update the position');
  }

  async removeDraft(cycleId: string, draftId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.assertDraft(cycleId);
      const { error } = await supabase
        .from('cabinet_roster_drafts')
        .delete()
        .eq('id', draftId)
        .eq('cycle_id', cycleId);
      if (error) throw error;
    }, 'Failed to remove the position');
  }

  async deleteCycle(cycleId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.assertDraft(cycleId);
      const { error } = await supabase.from('cabinet_roster_cycles').delete().eq('id', cycleId);
      if (error) throw error;
    }, 'Failed to delete the Cabinet roster');
  }

  private async setStatus(
    cycleId: string,
    from: CabinetRosterCycle['status'],
    to: CabinetRosterCycle['status'],
  ): Promise<void> {
    const { data, error } = await supabase
      .from('cabinet_roster_cycles')
      .update({ status: to })
      .eq('id', cycleId)
      .eq('status', from)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new ValidationError(`The roster was not ${from}; refresh and try again.`, 'status', from);
    }
  }

  /** Locking keeps the roster private; it writes nothing public. */
  async lockCycle(cycleId: string): Promise<void> {
    return withErrorHandling(async () => {
      const cycle = await this.getCycle(cycleId);
      if (cycle.status !== 'draft') {
        throw new ValidationError(`This roster is ${cycle.status}, not a draft.`, 'status', cycle.status);
      }
      const preflight = buildRosterPreflight(await this.getDrafts(cycleId));
      if (!preflight.canLock) {
        throw new ValidationError(`Resolve before locking: ${preflight.blockers[0].message}`, 'preflight');
      }
      await this.setStatus(cycleId, 'draft', 'locked');
    }, 'Failed to lock the Cabinet roster');
  }

  async reopenCycle(cycleId: string): Promise<void> {
    return withErrorHandling(async () => {
      await this.setStatus(cycleId, 'locked', 'draft');
    }, 'Failed to reopen the Cabinet roster');
  }

  /**
   * Publishes a locked roster through the single database function. The
   * database re-checks every blocker, adopts an existing row for the same
   * member (or same name, if unlinked) instead of duplicating it, never deletes
   * or blanks anything, and rolls everything back on any error. Calling it again
   * for a published roster returns `alreadyPublished` with nothing written.
   */
  async publishCycle(cycleId: string): Promise<PublishRosterResult> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('publish_cabinet_roster_cycle', { p_cycle_id: cycleId });
      if (error) throw error;
      return parsePublishResult(data);
    }, 'Failed to publish the Cabinet roster');
  }
}

export const cabinetRosterRepository = new CabinetRosterRepository();
