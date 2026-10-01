// New Year Setup wizard data access. Reads what exists for a target year, then
// creates only what is missing by delegating to the owning repositories, so
// there is exactly one write path per domain. Never activates a term or a
// cabinet year, never touches House memberships, never writes an application
// URL. Authority: AGENTS.md § "Domain-critical facts"; vsa-seasonal-operations § 4.
import { supabase } from '../../lib/supabase';
import {
  ApplicationResetRow,
  YearSetupGateway,
  YearSetupOptions,
  YearSetupPlan,
  YearSetupReport,
  YearSetupSnapshot,
  applicationResetPatch,
  buildYearSetupPlan,
  runYearSetup,
} from '../../lib/yearSetup';
import { academicTermsRepository } from './academicTerms';
import { aceAssignmentsRepository } from './aceAssignments';
import { applicationLinksRepository } from './applicationLinks';
import { cabinetRosterRepository } from './cabinetRoster';
import { cabinetYearsRepository } from './cabinetYears';
import { houseAssignmentsRepository } from './houseAssignments';
import { internCohortRepository } from './internCohort';
import { withErrorHandling } from '../errors';
import type { ApplicationKey } from '../../types';

export interface YearSetupRun {
  plan: YearSetupPlan;
  report: YearSetupReport;
}

export interface ApplicationResetResult {
  updated: number;
  failed: Array<{ key: ApplicationKey; message: string }>;
}

export function buildYearSetupGateway(userId: string | null): YearSetupGateway {
  return {
    async createTerm(input) {
      // Always inactive: a future term must never become the active term here.
      const term = await academicTermsRepository.createTerm({
        code: input.code,
        label: input.label,
        academic_year_start: input.academic_year_start,
        academic_year_end: input.academic_year_end,
        quarter: input.quarter,
        starts_on: input.starts_on || null,
        ends_on: input.ends_on || null,
        display_order: input.display_order,
        is_active: false,
      });
      return { id: term.id };
    },
    async createCabinetYear(input) {
      // Always inactive: activation is its own explicit action on the rollover page.
      const year = await cabinetYearsRepository.createYear({
        label: input.label,
        slug: input.slug,
        start_year: input.startYear,
        end_year: input.startYear + 1,
        theme_name: null,
        is_active: false,
        display_order: input.startYear,
      });
      return { id: year.id };
    },
    async createRosterDraft(input) {
      const result = await cabinetRosterRepository.createCycle({
        cabinetYearId: input.cabinetYearId,
        sourceCabinetYearId: input.sourceCabinetYearId,
        userId,
      });
      return { created: result.created, positionsCopied: result.positionsCopied };
    },
    async createAceCycle(startYear) {
      const cycle = await aceAssignmentsRepository.createCycle(startYear);
      return { id: cycle.id };
    },
    async createInternCycle(input) {
      const cycle = await internCohortRepository.createCycle({
        academicYearStart: input.startYear,
        cabinetYearId: input.cabinetYearId,
        userId,
      });
      return { id: cycle.id };
    },
    async createEmptyHouseBatch(input) {
      const batch = await houseAssignmentsRepository.createEmptyBatch({
        academicYearStart: input.startYear,
        effectiveStartDate: input.effectiveStartDate,
        sourceLabel: 'New Year Setup',
        userId,
      });
      return { id: batch.id };
    },
  };
}

export class YearSetupRepository {
  /** Reads only; nothing is written. */
  async loadSnapshot(startYear: number): Promise<YearSetupSnapshot> {
    return withErrorHandling(async () => {
      const [terms, cabinetYears, rosterCycles, aceCycles, internCycles, houseProfiles, houseBatches, applications] = await Promise.all([
        supabase.from('academic_terms').select('id, code, academic_year_start, quarter, is_active'),
        supabase.from('cabinet_years').select('id, slug, label, start_year, is_active'),
        supabase.from('cabinet_roster_cycles').select('id, cabinet_year_id, status'),
        supabase.from('ace_assignment_cycles').select('id, academic_year_start, status'),
        supabase.from('intern_cohort_cycles').select('id, academic_year_start, cabinet_year_id, status'),
        supabase.from('house_page_assets').select('id', { count: 'exact', head: true }).eq('academic_year_start', startYear),
        supabase.from('house_assignment_batches').select('id, status').eq('academic_year_start', startYear),
        supabase.from('application_links').select('id, application_key, open_at, due_at, is_enabled').order('sort_order', { ascending: true }),
      ]);
      for (const result of [terms, cabinetYears, rosterCycles, aceCycles, internCycles, houseProfiles, houseBatches, applications]) {
        if (result.error) throw result.error;
      }
      return {
        terms: terms.data ?? [],
        cabinetYears: cabinetYears.data ?? [],
        rosterCycles: rosterCycles.data ?? [],
        aceCycles: aceCycles.data ?? [],
        internCycles: internCycles.data ?? [],
        houseProfileCount: houseProfiles.count ?? 0,
        houseBatches: houseBatches.data ?? [],
        applications: (applications.data ?? []) as YearSetupSnapshot['applications'],
      };
    }, 'Failed to look up the new year');
  }

  /**
   * Re-reads what exists immediately before writing, so a stale preview (or a
   * second admin) can never cause a duplicate: whatever now exists is
   * reported as existing and skipped.
   */
  async runSetup(startYear: number, options: YearSetupOptions, userId: string | null): Promise<YearSetupRun> {
    const snapshot = await this.loadSnapshot(startYear);
    const plan = buildYearSetupPlan(startYear, snapshot, options);
    const report = await runYearSetup(plan, options, buildYearSetupGateway(userId));
    return { plan, report };
  }

  /**
   * The separate next-year application reset. Disables the chosen windows and
   * replaces outdated timing with a disabled placeholder. Never enables a
   * window and never touches target_url.
   */
  async resetApplications(rows: readonly ApplicationResetRow[], targetStartYear: number): Promise<ApplicationResetResult> {
    const failed: ApplicationResetResult['failed'] = [];
    let updated = 0;
    for (const row of rows) {
      const patch = applicationResetPatch(row, targetStartYear);
      if (!patch) continue;
      try {
        await applicationLinksRepository.updateApplicationLink(row.id, patch);
        updated += 1;
      } catch (error) {
        failed.push({ key: row.key, message: error instanceof Error ? error.message : 'Update failed' });
      }
    }
    return { updated, failed };
  }
}

export const yearSetupRepository = new YearSetupRepository();
