import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';
import { Database, ImportRowDecision, Json } from '../../types/database';

type ImportJobRow = Database['public']['Tables']['import_job_rows']['Row'];
type ImportJob = Database['public']['Tables']['import_jobs']['Row'];
type ImportJobInsert = Database['public']['Tables']['import_jobs']['Insert'];
type ImportJobRowInsert = Database['public']['Tables']['import_job_rows']['Insert'];

export interface ImportJobEventSummary {
  id: string;
  name: string;
  date: string;
  points: number;
}

export type ImportJobWithEvent = ImportJob & {
  event?: ImportJobEventSummary | null;
};

export interface CreateImportJobInput extends Omit<ImportJobInsert, 'id' | 'created_at'> {
  rows: Omit<ImportJobRowInsert, 'id' | 'import_job_id' | 'created_at'>[];
}

type ImportJobRecord = ImportJob & {
  events?: ImportJobEventSummary | ImportJobEventSummary[] | null;
};

function normalizeEvent(events: ImportJobRecord['events']): ImportJobEventSummary | null {
  if (!events) return null;
  return Array.isArray(events) ? events[0] ?? null : events;
}

export function decisionFromRowStatus(status: string): ImportRowDecision {
  if (status === 'match') return 'matched';
  if (status === 'new') return 'created';
  if (status === 'already') return 'skipped_duplicate';
  if (status === 'review') return 'review';
  return 'error';
}

export class ImportJobsRepository {
  async getRecentJobs(limit = 8): Promise<ImportJobWithEvent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*, events(id, name, date, points)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return ((data ?? []) as ImportJobRecord[]).map(({ events, ...job }) => ({
        ...job,
        event: normalizeEvent(events),
      }));
    }, 'Failed to fetch import jobs');
  }

  async getJobRows(importJobId: string): Promise<ImportJobRow[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('import_job_rows')
        .select('*')
        .eq('import_job_id', importJobId)
        .order('source_row_index', { ascending: true });

      if (error) throw error;
      return data ?? [];
    }, 'Failed to fetch import job rows');
  }

  async createJob(input: CreateImportJobInput): Promise<ImportJobWithEvent> {
    return withErrorHandling(async () => {
      const { rows, ...jobInput } = input;
      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert(jobInput)
        .select()
        .single();

      if (jobError) throw jobError;
      if (!job) throw new Error('Import job was not created');

      if (rows.length) {
        const rowInserts = rows.map(row => ({
          ...row,
          import_job_id: job.id,
        }));

        const { error: rowsError } = await supabase
          .from('import_job_rows')
          .insert(rowInserts);

        if (rowsError) throw rowsError;
      }

      return { ...job, event: null };
    }, 'Failed to create import job');
  }
}

export function asJson(value: Record<string, unknown>): Json {
  return value as Json;
}

export const importJobsRepository = new ImportJobsRepository();
