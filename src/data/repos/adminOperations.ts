// Read-only data access for the Admin Operations dashboard. Every domain loads
// independently: one failing query yields a null domain (shown as "could not
// load"), never a wrong zero. Nothing here writes.
import { supabase } from '../../lib/supabase';
import { getAcademicTermMeta } from '../../lib/academicTerms';
import { buildRosterPreflight, ROSTER_EXCLUDED_CATEGORY } from '../../lib/cabinetRoster';
import { HouseProfileLite, computeHouseCounts } from '../../lib/houseAssignmentDraft';
import {
  AceOperationsInput,
  CabinetOperationsInput,
  EventsOperationsInput,
  HouseOperationsInput,
  InternOperationsInput,
  OperationsInputs,
  rolloverSummary,
  summarizeUpcomingEvents,
} from '../../lib/adminOperations';
import { formatRosterYears } from '../../lib/cabinetRoster';
import { academicTermsRepository } from './academicTerms';
import { aceAssignmentsRepository } from './aceAssignments';
import { cabinetRosterRepository } from './cabinetRoster';
import { cabinetYearsRepository } from './cabinetYears';
import { houseAssignmentsRepository } from './houseAssignments';
import { internCohortRepository } from './internCohort';

const DAY_MS = 24 * 60 * 60 * 1000;

async function settled<T>(label: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    console.error(`Operations: failed to load ${label}`, error);
    return null;
  }
}

export class AdminOperationsRepository {
  /** The academic year the dashboard reports on: the active term's, else the calendar's. */
  async resolveYearStart(): Promise<number> {
    const active = await academicTermsRepository.getActiveTerm().catch(() => null);
    return active?.academic_year_start ?? getAcademicTermMeta(new Date())?.academicYearStart ?? new Date().getFullYear();
  }

  async loadInputs(): Promise<OperationsInputs> {
    const yearStart = await this.resolveYearStart();
    const [members, ace, houses, cabinet, interns, events] = await Promise.all([
      settled('members', () => this.loadMembers()),
      settled('ACE', () => this.loadAce(yearStart)),
      settled('Houses', () => this.loadHouses(yearStart)),
      settled('Cabinet', () => this.loadCabinet()),
      settled('Interns', () => this.loadInterns(yearStart)),
      settled('Events', () => this.loadEvents()),
    ]);
    return { yearStart, members, ace, houses, cabinet, interns, events };
  }

  private async loadMembers(): Promise<number> {
    const { count, error } = await supabase.from('members').select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count ?? 0;
  }

  private async loadAce(yearStart: number): Promise<AceOperationsInput> {
    const cycles = await aceAssignmentsRepository.listCycles();
    const cycle = cycles.find((item) => item.academic_year_start === yearStart && item.status !== 'archived') ?? null;
    const drafts = cycle ? await aceAssignmentsRepository.listDrafts(cycle.id) : [];

    const { data: families, error: familiesError } = await supabase
      .from('ace_families')
      .select('id')
      .eq('academic_year_start', yearStart);
    if (familiesError) throw familiesError;
    const familyIds = (families ?? []).map((family) => family.id);

    let nodesTotal = 0;
    let nodesLinked = 0;
    if (familyIds.length > 0) {
      const [total, linked] = await Promise.all([
        supabase.from('ace_family_members').select('id', { count: 'exact', head: true }).in('family_id', familyIds),
        supabase.from('ace_family_members').select('id', { count: 'exact', head: true }).in('family_id', familyIds).not('member_id', 'is', null),
      ]);
      if (total.error) throw total.error;
      if (linked.error) throw linked.error;
      nodesTotal = total.count ?? 0;
      nodesLinked = linked.count ?? 0;
    }

    return {
      cycleStatus: cycle?.status ?? null,
      littles: drafts.length,
      assigned: drafts.filter((draft) => !!draft.big_ace_member_id).length,
      nodesTotal,
      nodesLinked,
    };
  }

  private async loadHouses(yearStart: number): Promise<HouseOperationsInput> {
    const batches = await houseAssignmentsRepository.listBatches(yearStart);
    const batch = batches[0] ?? null;
    if (!batch) return { batchStatus: null, assigned: 0, unresolved: 0, balance: [] };

    const [drafts, profilesResult] = await Promise.all([
      houseAssignmentsRepository.getDrafts(batch.id),
      supabase
        .from('house_page_assets')
        .select('id, house_key, display_name, is_active')
        .eq('academic_year_start', yearStart)
        .order('display_order', { ascending: true }),
    ]);
    if (profilesResult.error) throw profilesResult.error;
    const profiles = (profilesResult.data ?? []) as HouseProfileLite[];
    const counts = computeHouseCounts(drafts, profiles);
    return {
      batchStatus: batch.status,
      assigned: counts.perHouse.reduce((sum, house) => sum + house.count, 0),
      unresolved: counts.unassigned + counts.needsMember,
      balance: counts.perHouse.map((house) => house.count),
    };
  }

  private async loadCabinet(): Promise<CabinetOperationsInput> {
    const [years, cycles] = await Promise.all([cabinetYearsRepository.getYears(), cabinetRosterRepository.listCycles()]);
    const active = years.find((year) => year.is_active) ?? null;

    let positions = 0;
    let filled = 0;
    let linked = 0;
    if (active) {
      const { data, error } = await supabase
        .from('cabinet_members')
        .select('name, member_id')
        .eq('cabinet_year_id', active.id)
        .neq('category', ROSTER_EXCLUDED_CATEGORY);
      if (error) throw error;
      const rows = data ?? [];
      positions = rows.length;
      filled = rows.filter((row) => !!row.name?.trim()).length;
      linked = rows.filter((row) => !!row.member_id).length;
    }

    const inProgress = cycles
      .filter((cycle) => cycle.cabinet_year_id !== active?.id)
      .map((cycle) => ({ cycle, year: years.find((year) => year.id === cycle.cabinet_year_id) }))
      .filter((entry): entry is { cycle: typeof cycles[number]; year: NonNullable<typeof entry.year> } => !!entry.year)
      .sort((a, b) => b.year.start_year - a.year.start_year)[0];

    let rollover: CabinetOperationsInput['rollover'] = null;
    if (inProgress) {
      const drafts = await cabinetRosterRepository.getDrafts(inProgress.cycle.id);
      rollover = rolloverSummary(formatRosterYears(inProgress.year), inProgress.cycle.status, buildRosterPreflight(drafts));
    }

    return { yearLabel: active ? formatRosterYears(active) : null, positions, filled, linked, rollover };
  }

  private async loadInterns(yearStart: number): Promise<InternOperationsInput> {
    const cycles = await internCohortRepository.listCycles();
    const cycle = cycles.find((item) => item.academic_year_start === yearStart) ?? null;
    if (cycle) {
      const drafts = await internCohortRepository.getDrafts(cycle.id);
      return { cycleStatus: cycle.status, accepted: drafts.length, linked: drafts.filter((draft) => !!draft.member_id).length };
    }

    // No cohort cycle: report whatever interns are already live on the active Cabinet year.
    const active = (await cabinetYearsRepository.getYears()).find((year) => year.is_active);
    if (!active) return { cycleStatus: null, accepted: 0, linked: 0 };
    const { data, error } = await supabase
      .from('cabinet_members')
      .select('member_id')
      .eq('cabinet_year_id', active.id)
      .eq('category', 'Interns');
    if (error) throw error;
    const rows = data ?? [];
    return { cycleStatus: null, accepted: rows.length, linked: rows.filter((row) => !!row.member_id).length };
  }

  private async loadEvents(): Promise<EventsOperationsInput> {
    // Same one-day grace as Admin Overview so an event today still counts as upcoming.
    // One read of the (few) upcoming published events answers all four numbers.
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const { data, error } = await supabase
      .from('events')
      .select('name, date, location, check_in_form_url, image_url')
      .eq('is_published', true)
      .gte('date', since)
      .order('date', { ascending: true });
    if (error) throw error;
    return summarizeUpcomingEvents(data ?? []);
  }
}

export const adminOperationsRepository = new AdminOperationsRepository();
