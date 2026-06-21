import { supabase } from '../../lib/supabase';
import { withErrorHandling, DatabaseError } from '../errors';

export interface AiFeedback {
  id: string;
  rating: 'helpful' | 'not_helpful';
  category: string | null;
  page_path: string | null;
  feedback_text: string | null;
  answer_excerpt: string | null;
  created_at: string;
  resolved_at: string | null;
  admin_notes: string | null;
}

export interface SubmitAiFeedbackInput {
  rating: 'helpful' | 'not_helpful';
  category?: string | null;
  page_path?: string | null;
  feedback_text?: string | null;
  answer_excerpt?: string | null;
}

export interface AiFeedbackFilters {
  status?: 'resolved' | 'unresolved' | 'all';
  rating?: 'helpful' | 'not_helpful' | 'all';
}

export class AiFeedbackRepository {
  async submitFeedback(input: SubmitAiFeedbackInput): Promise<void> {
    return withErrorHandling(async () => {
      if (!input.rating || !['helpful', 'not_helpful'].includes(input.rating)) {
        throw new Error('Valid rating is required.');
      }

      const feedbackText = input.feedback_text?.trim();
      if (feedbackText && feedbackText.length > 1000) {
        throw new Error('Feedback text is too long (max 1000 characters).');
      }

      // Keep excerpt very short for context, but do not store full raw logs here
      const excerpt = input.answer_excerpt?.trim().slice(0, 150) || null;

      const { error } = await supabase.from('ai_feedback').insert({
        rating: input.rating,
        category: input.category || null,
        page_path: input.page_path || null,
        feedback_text: feedbackText || null,
        answer_excerpt: excerpt,
      });

      if (error) {
        throw new DatabaseError(`Failed to submit AI feedback: ${error.message}`);
      }
    }, 'Failed to submit feedback');
  }

  async listAdminFeedback(filters: AiFeedbackFilters = {}): Promise<AiFeedback[]> {
    return withErrorHandling(async () => {
      let query = supabase
        .from('ai_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.status === 'resolved') {
        query = query.not('resolved_at', 'is', null);
      } else if (filters.status === 'unresolved') {
        query = query.is('resolved_at', null);
      }

      if (filters.rating && filters.rating !== 'all') {
        query = query.eq('rating', filters.rating);
      }

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError(`Failed to fetch AI feedback: ${error.message}`);
      }

      return data as AiFeedback[];
    }, 'Failed to fetch AI feedback');
  }

  async markResolved(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase
        .from('ai_feedback')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        throw new DatabaseError(`Failed to resolve AI feedback: ${error.message}`);
      }
    }, 'Failed to resolve feedback');
  }

  async updateAdminNotes(id: string, notes: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase
        .from('ai_feedback')
        .update({ admin_notes: notes.trim() || null })
        .eq('id', id);

      if (error) {
        throw new DatabaseError(`Failed to update admin notes: ${error.message}`);
      }
    }, 'Failed to update admin notes');
  }
}

export const aiFeedbackRepository = new AiFeedbackRepository();
