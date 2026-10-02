// "Reviewed" marks for yearly-operations draft rows (admin_review_marks). They
// are advisory: marking a row reviewed only removes it from the Needs Review
// filter. It never gates lock, publish, or reveal.
import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';

export type ReviewEntityType =
  | 'ace_assignment_draft'
  | 'house_assignment_draft'
  | 'intern_cohort_draft'
  | 'cabinet_roster_draft';

const CHUNK = 100;

export class AdminReviewRepository {
  async listReviewed(entityType: ReviewEntityType, ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    return withErrorHandling(async () => {
      const reviewed = new Set<string>();
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data, error } = await supabase
          .from('admin_review_marks')
          .select('entity_id')
          .eq('entity_type', entityType)
          .in('entity_id', ids.slice(i, i + CHUNK));
        if (error) throw error;
        (data ?? []).forEach((row) => reviewed.add((row as { entity_id: string }).entity_id));
      }
      return reviewed;
    }, 'Failed to load reviewed marks');
  }

  async mark(entityType: ReviewEntityType, ids: readonly string[], academicYearStart: number | null): Promise<number> {
    if (ids.length === 0) return 0;
    return withErrorHandling(async () => {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { error } = await supabase.from('admin_review_marks').upsert(
          ids.slice(i, i + CHUNK).map((entityId) => ({ entity_type: entityType, entity_id: entityId, academic_year_start: academicYearStart })),
          { onConflict: 'entity_type,entity_id', ignoreDuplicates: true },
        );
        if (error) throw error;
      }
      return ids.length;
    }, 'Failed to mark rows reviewed');
  }

  async unmark(entityType: ReviewEntityType, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    return withErrorHandling(async () => {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { error } = await supabase
          .from('admin_review_marks')
          .delete()
          .eq('entity_type', entityType)
          .in('entity_id', ids.slice(i, i + CHUNK));
        if (error) throw error;
      }
    }, 'Failed to clear reviewed marks');
  }
}

export const adminReviewRepository = new AdminReviewRepository();
