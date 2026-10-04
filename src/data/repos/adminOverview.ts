// Read-only data access for the Admin Overview page.
//
// One narrow read per table, all in a single parallel stage (~17 requests),
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
import { DATA_RIGHTS_CLOSED_STATUSES } from '../../constants/dataRightsRequests';
import { academicTermsRepository } from './academicTerms';
import { contentHealthRepository } from './contentHealth';

interface RowsResult<T> {
  data: T[] | null;
  error: unknown;
  count: number | null;
}

interface CountResult {
  count: number | null;
  error: unknown;
}

// Columns the Ask VSA freshness rules read. The two entity-link columns arrive with
// migration 20261004000000; until it is applied the read is retried without them.
const AI_COLUMNS_BASE = 'id, title, source_type, is_public, is_active, freshness, academic_year, valid_until, last_verified_at, created_at';
const AI_COLUMNS = `${AI_COLUMNS_BASE}, linked_entity_type, linked_entity_key`;
const UNDEFINED_COLUMN = '42703';

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

/**
 * The AI table may be missing (pre-migration) or lack the entity-link columns
 * (frontend deployed before the migration). Both degrade to "less information",
 * not to "Ask VSA knowledge not found".
 */
async function readAiRows(untyped: UntypedClient): Promise<OverviewAiRow[] | null> {
  try {
    const first = (await untyped.from('ai_knowledge_base').select(AI_COLUMNS, EXACT)) as RowsResult<OverviewAiRow>;
    if ((first.error as { code?: string } | null)?.code !== UNDEFINED_COLUMN) return readRows<OverviewAiRow>('AI knowledge', Promise.resolve(first));
  } catch (error) {
    console.error('Admin overview: failed to load AI knowledge', error);
    return null;
  }
  return readRows<OverviewAiRow>('AI knowledge', untyped.from('ai_knowledge_base').select(AI_COLUMNS_BASE, EXACT));
}

export class AdminOverviewRepository {
  async load(now: Date = new Date()): Promise<OverviewSnapshot> {
    const untyped = supabase as unknown as UntypedClient;

    const [
      members,
      academicTermCount,
      photoRequestsPending,
      dataRightsOpen,
      aiFeedbackUnresolved,
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
      contentHealthState,
      activeTerm,
    ] = await Promise.all([
      readCount('members', supabase.from('members').select('*', { count: 'exact', head: true })),
      readCount('academic terms', supabase.from('academic_terms').select('*', { count: 'exact', head: true })),
      // Head counts for the attention queue: cheap, and only the numbers leave the database.
      readCount('pending photo requests', supabase.from('member_photo_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
      readCount('open data rights requests', supabase.from('data_rights_requests').select('*', { count: 'exact', head: true }).not('status', 'in', `(${DATA_RIGHTS_CLOSED_STATUSES.join(',')})`)),
      readCount('unresolved Ask VSA feedback', supabase.from('ai_feedback').select('*', { count: 'exact', head: true }).is('resolved_at', null)),
      readRows<OverviewEventRow>('events', supabase.from('events').select('id, name, date, end_date, updated_at, is_published, image_url, location, check_in_form_url, academic_term_id', EXACT)),
      readRows<OverviewGalleryRow>('gallery', supabase.from('gallery_events').select('id, name, title, created_at, cover_image_url, google_photos_url', EXACT)),
      readRows<OverviewCabinetRow>('cabinet members', supabase.from('cabinet_members').select('cabinet_year_id, image_url, role', EXACT)),
      readRows<OverviewCabinetYearRow>('cabinet years', supabase.from('cabinet_years').select('id, label, is_active', EXACT)),
      readRows<OverviewHouseAssetRow>('house profiles', supabase.from('house_page_assets').select('academic_year_start, image_url, house_parent_heading, house_parent_image_url', EXACT)),
      readRows<OverviewImageRow>('house events', supabase.from('house_events').select('image_url', EXACT)),
      readRows<OverviewImageRow>('site settings', supabase.from('site_settings').select('logo_url', EXACT)),
      readRows<OverviewVcnRow>('VCN archives', supabase.from('vcn_archives').select('is_current, is_published, cover_image_url', EXACT)),
      readRows<OverviewProgramContentRow>('program content', supabase.from('program_content').select('id, page_key, section_key, title, body, primary_link_label, primary_link_url, secondary_link_label, secondary_link_url, updated_at, is_published, status', EXACT)),
      readRows<OverviewFeedbackRow>('feedback', supabase.from('feedback').select('status', EXACT)),
      readAiRows(untyped),
      readRows<OverviewApplicationRow>('application windows', supabase.from('application_links').select('application_key, open_at, due_at, is_enabled, target_url, updated_at', EXACT)),
      // The one new request for Content Health: failed link checks, the last run, and acknowledgements.
      contentHealthRepository.readState(),
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
      photoRequestsPending,
      dataRightsOpen,
      aiFeedbackUnresolved,
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
      contentHealthState,
      activeTerm,
    };
    return buildOverviewSnapshot(sources, now, getAcademicTermMeta(now)?.academicYearStart ?? null);
  }
}

export const adminOverviewRepository = new AdminOverviewRepository();
