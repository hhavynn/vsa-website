// Admin Quick Search data. Read-only and admin-only: it loads after an admin
// opens the palette (never at page load, never on a public route), reads only
// the safe member projection plus draft/roster/event names, and keeps nothing
// outside React Query's short-lived cache. Each source loads independently, so
// one failing table narrows the results instead of breaking search.
import { supabase } from '../../lib/supabase';
import {
  AdminSearchRecord,
  aceRecord,
  cabinetRecord,
  eventRecord,
  houseDraftRecord,
  internDraftRecord,
  memberOptionRecord,
  pageRecords,
} from '../../lib/adminSearch';
import { formatYearSpan } from '../../lib/operationalStatus';
import { cabinetYearsRepository } from './cabinetYears';
import { houseAssignmentsRepository } from './houseAssignments';
import { memberLookupRepository } from './memberLookup';
import { adminOperationsRepository } from './adminOperations';

const PAGE = 1000;

async function pageAll<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function settled<T>(label: string, load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch (error) {
    console.warn(`Admin search: could not load ${label}`, error);
    return [];
  }
}

const compact = (records: Array<AdminSearchRecord | null>): AdminSearchRecord[] => records.filter((record): record is AdminSearchRecord => !!record);

export class AdminSearchRepository {
  async loadRecords(): Promise<AdminSearchRecord[]> {
    const [members, ace, cabinet, interns, events, houses] = await Promise.all([
      settled('members', () => this.members()),
      settled('ACE', () => this.ace()),
      settled('Cabinet', () => this.cabinet()),
      settled('Interns', () => this.interns()),
      settled('Events', () => this.events()),
      settled('Houses', () => this.houses()),
    ]);
    return [...pageRecords(), ...members, ...ace, ...cabinet, ...interns, ...houses, ...events];
  }

  private async members() {
    return compact((await memberLookupRepository.listMemberDirectory()).map(memberOptionRecord));
  }

  private async ace() {
    const [nodes, families] = await Promise.all([
      pageAll<{ id: string; name: string; role_label: string | null; family_id: string; member_id: string | null }>((from, to) =>
        supabase.from('ace_family_members').select('id, name, role_label, family_id, member_id').order('id').range(from, to),
      ),
      pageAll<{ id: string; name: string; academic_year_start: number | null }>((from, to) =>
        supabase.from('ace_families').select('id, name, academic_year_start').order('id').range(from, to),
      ),
    ]);
    const familyById = new Map(families.map((family) => [family.id, family]));
    return compact(nodes.map((node) => aceRecord(node, familyById.get(node.family_id))));
  }

  private async cabinet() {
    const [rows, years] = await Promise.all([
      pageAll<{ id: string; name: string | null; role: string; category: string | null; cabinet_year_id: string | null }>((from, to) =>
        supabase.from('cabinet_members').select('id, name, role, category, cabinet_year_id').order('id').range(from, to),
      ),
      cabinetYearsRepository.getYears(),
    ]);
    const labelById = new Map(years.map((year) => [year.id, formatYearSpan(year.start_year)]));
    return compact(rows.map((row) => cabinetRecord(row, row.cabinet_year_id ? labelById.get(row.cabinet_year_id) : null)));
  }

  private async interns() {
    const [drafts, cycles] = await Promise.all([
      pageAll<{ id: string; name: string; cycle_id: string }>((from, to) => supabase.from('intern_cohort_drafts').select('id, name, cycle_id').order('id').range(from, to)),
      pageAll<{ id: string; academic_year_start: number; status: string }>((from, to) =>
        supabase.from('intern_cohort_cycles').select('id, academic_year_start, status').neq('status', 'archived').order('id').range(from, to),
      ),
    ]);
    const cycleById = new Map(cycles.map((cycle) => [cycle.id, cycle]));
    // Drafts of published or archived cycles are already on Cabinet; search the live ones.
    return compact(
      drafts
        .filter((draft) => cycleById.has(draft.cycle_id) && cycleById.get(draft.cycle_id)?.status !== 'published')
        .map((draft) => internDraftRecord(draft, formatYearSpan(cycleById.get(draft.cycle_id)!.academic_year_start))),
    );
  }

  private async events() {
    const rows = await pageAll<{ id: string; name: string; date: string | null; is_published: boolean | null }>((from, to) =>
      supabase.from('events').select('id, name, date, is_published').order('date', { ascending: false }).range(from, to),
    );
    return compact(rows.map(eventRecord));
  }

  private async houses() {
    const yearStart = await adminOperationsRepository.resolveYearStart();
    const batch = (await houseAssignmentsRepository.listBatches(yearStart))[0];
    if (!batch) return [];
    const [drafts, profiles, members] = await Promise.all([
      houseAssignmentsRepository.getDrafts(batch.id),
      supabase.from('house_page_assets').select('id, house_key, display_name').eq('academic_year_start', yearStart),
      memberLookupRepository.listMemberDirectory(),
    ]);
    if (profiles.error) throw new Error(profiles.error.message);
    const houseNames = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.display_name || profile.house_key]));
    const memberNames = new Map(members.map((member) => [member.id, member.fullName]));
    return compact(
      drafts.map((draft) =>
        houseDraftRecord(draft, {
          memberName: draft.member_id ? memberNames.get(draft.member_id) : null,
          houseLabel: draft.house_profile_id ? houseNames.get(draft.house_profile_id) : null,
          yearLabel: formatYearSpan(yearStart),
        }),
      ),
    );
  }
}

export const adminSearchRepository = new AdminSearchRepository();
