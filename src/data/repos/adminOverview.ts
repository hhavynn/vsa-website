// Read-only data access for the Admin Overview page.
//
// One narrow read per table, all in a single parallel stage (~16 requests),
// instead of the ~45 count probes + sequential waterfalls the page used to
// issue. Every number is derived in `lib/adminOverviewStats.ts`. Nothing here
// writes, and a source that fails (or is truncated by the API row cap) is
// reported as unavailable rather than counted as zero.
import { supabase } from '../../lib/supabase';
import { getAcademicTermMeta } from '../../lib/academicTerms';
import {
  OverviewAiRow,
  OverviewApplicationRow,
  OverviewCabinetRow,
  OverviewCabinetYearRow,
  OverviewEventRow,
  OverviewFeedbackRow,
  OverviewGalleryRow,
  OverviewHouseAssetRow,
  OverviewImageRow,
  OverviewProgramContentRow,
  OverviewSnapshot,
  OverviewSources,
  OverviewVcnRow,
  buildOverviewSnapshot,
} from '../../lib/adminOverviewStats';
import { academicTermsRepository } from './academicTerms';

interface RowsResult<T> {
  data: T[] | null;
  error: unknown;
  count: number | null;
}

interface CountResult {
  count: number | null;
  error: unknown;
}

// The ai_knowledge_base table is not in the generated Database types.
interface UntypedClient {
  from: (table: string) => { select: (columns: string, options?: object) => PromiseLike<RowsResult<OverviewAiRow>> };
}

async function readRows<T>(label: string, query: PromiseLike<unknown>): Promise<T[] | null> {
  try {
    const { data, error, count } = (await query) as RowsResult<T>;
    if (error || !data) {
      if (error) console.error(`Admin overview: failed to load ${label}`, error);
      return null;
    }
    // The API caps rows per response. A silent cap would under-count, so treat it as a failed read.
    if (count !== null && count > data.length) {
      console.error(`Admin overview: ${label} was truncated (${data.length} of ${count} rows)`);
      return null;
    }
    return data;
  } catch (error) {
    console.error(`Admin overview: failed to load ${label}`, error);
    return null;
  }
}

async function readCount(label: string, query: PromiseLike<unknown>): Promise<number | null> {
  try {
    const { count, error } = (await query) as CountResult;
    if (error) {
      console.error(`Admin overview: failed to count ${label}`, error);
      return null;
    }
    return count ?? 0;
  } catch (error) {
    console.error(`Admin overview: failed to count ${label}`, error);
    return null;
  }
}

const EXACT = { count: 'exact' } as const;

export class AdminOverviewRepository {
  async load(now: Date = new Date()): Promise<OverviewSnapshot> {
    const untyped = supabase as unknown as UntypedClient;

    const [
      members,
      academicTermCount,
      mergeExclusions,
      events,
      gallery,
      cabinetMembers,
      cabinetYears,
      houseAssets,
      houseEventImages,
      siteSettings,
      vcn,
      programContent,
      feedback,
      ai,
      applications,
      activeTerm,
    ] = await Promise.all([
      readCount('members', supabase.from('members').select('*', { count: 'exact', head: true })),
      readCount('academic terms', supabase.from('academic_terms').select('*', { count: 'exact', head: true })),
      readCount('merge exclusions', supabase.from('merge_exclusions').select('*', { count: 'exact', head: true })),
      readRows<OverviewEventRow>('events', supabase.from('events').select('date, is_published, image_url, location, check_in_form_url, academic_term_id', EXACT)),
      readRows<OverviewGalleryRow>('gallery', supabase.from('gallery_events').select('cover_image_url, google_photos_url', EXACT)),
      readRows<OverviewCabinetRow>('cabinet members', supabase.from('cabinet_members').select('cabinet_year_id, image_url, role', EXACT)),
      readRows<OverviewCabinetYearRow>('cabinet years', supabase.from('cabinet_years').select('id, label, is_active', EXACT)),
      readRows<OverviewHouseAssetRow>('house profiles', supabase.from('house_page_assets').select('academic_year_start, image_url, house_parent_heading, house_parent_image_url', EXACT)),
      readRows<OverviewImageRow>('house events', supabase.from('house_events').select('image_url', EXACT)),
      readRows<OverviewImageRow>('site settings', supabase.from('site_settings').select('logo_url', EXACT)),
      readRows<OverviewVcnRow>('VCN archives', supabase.from('vcn_archives').select('is_current, is_published, cover_image_url', EXACT)),
      readRows<OverviewProgramContentRow>('program content', supabase.from('program_content').select('is_published, status', EXACT)),
      readRows<OverviewFeedbackRow>('feedback', supabase.from('feedback').select('status', EXACT)),
      readRows<OverviewAiRow>('AI knowledge', untyped.from('ai_knowledge_base').select('is_public, is_active, last_verified_at', EXACT)),
      readRows<OverviewApplicationRow>('application windows', supabase.from('application_links').select('open_at, due_at, is_enabled', EXACT)),
      academicTermsRepository
        .getActiveTerm()
        .then((term) => ({ loaded: true, academicYearStart: term?.academic_year_start ?? null }))
        .catch((error: unknown) => {
          console.error(error);
          return { loaded: false, academicYearStart: null };
        }),
    ]);

    const sources: OverviewSources = {
      members,
      academicTermCount,
      mergeExclusions,
      events,
      gallery,
      cabinetMembers,
      cabinetYears,
      houseAssets,
      houseEventImages,
      siteSettings,
      vcn,
      programContent,
      feedback,
      ai,
      applications,
      activeTerm,
    };
    return buildOverviewSnapshot(sources, now, getAcademicTermMeta(now)?.academicYearStart ?? null);
  }
}

export const adminOverviewRepository = new AdminOverviewRepository();
