import { importJobsRepository, decisionFromRowStatus, type CreateImportJobInput } from './importJobs';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const job = {
  id: 'synthetic-job', created_at: '2026-10-01T00:00:00Z',
  event_id: 'synthetic-event', status: 'completed',
  events: { id: 'synthetic-event', name: 'Fictional event', date: '2026-10-01', points: 1 },
};
const row = {
  id: 'synthetic-row', import_job_id: 'synthetic-job',
  source_row_index: 1, decision: 'matched',
};
const input = {
  event_id: 'synthetic-event',
  rows: [{ source_row_index: 1, decision: 'matched' }],
} as unknown as CreateImportJobInput;

describe('import job repository data boundary (#291)', () => {
  it('lists recent jobs with the exact event projection, newest first, and object association', async () => {
    supabaseMock.setDefault('import_jobs', { data: [job], error: null });
    await expect(importJobsRepository.getRecentJobs(12)).resolves.toEqual([{
      id: job.id, created_at: job.created_at, event_id: job.event_id,
      status: job.status, event: job.events,
    }]);
    const q = supabaseMock.queriesFor('import_jobs');
    expect(q).toHaveLength(1);
    expect(q[0].calls).toContainEqual({
      method: 'select', args: ['*, events(id, name, date, points)'],
    });
    expect(q[0].calls).toContainEqual({
      method: 'order', args: ['created_at', { ascending: false }],
    });
    expect(q[0].calls).toContainEqual({ method: 'limit', args: [12] });
    expect(supabaseMock.queriesFor('member_event_attendance')).toHaveLength(0);
    expect(supabaseMock.queriesFor('members')).toHaveLength(0);
  });

  it('normalizes missing and array-shaped event embeddings without inventing an event', async () => {
    supabaseMock.setDefault('import_jobs', {
      data: [{ ...job, id: 'first', events: [job.events] },
        { ...job, id: 'second', events: [] }, { ...job, id: 'third', events: null }],
      error: null,
    });
    const jobs = await importJobsRepository.getRecentJobs();
    expect(jobs.map((j) => j.event)).toEqual([job.events, null, null]);
    expect(jobs.every((j) => !('events' in j))).toBe(true);
  });

  it('returns real empty results, without a fake last import or event', async () => {
    supabaseMock.setDefault('import_jobs', { data: [], error: null });
    await expect(importJobsRepository.getRecentJobs()).resolves.toEqual([]);
    supabaseMock.setDefault('import_job_rows', { data: [], error: null });
    await expect(importJobsRepository.getJobRows('missing-job')).resolves.toEqual([]);
  });

  it('lists rows only for one import job in original source order', async () => {
    supabaseMock.setDefault('import_job_rows', { data: [row], error: null });
    await expect(importJobsRepository.getJobRows('synthetic-job')).resolves.toEqual([row]);
    const q = supabaseMock.queriesFor('import_job_rows');
    expect(q).toHaveLength(1);
    expect(q[0].calls).toContainEqual({ method: 'select', args: ['*'] });
    expect(q[0].calls).toContainEqual({
      method: 'eq', args: ['import_job_id', 'synthetic-job'],
    });
    expect(q[0].calls).toContainEqual({
      method: 'order', args: ['source_row_index', { ascending: true }],
    });
  });

  it('creates header then attaches rows under the returned job ID only', async () => {
    supabaseMock.setDefault('import_jobs', { data: job, error: null });
    supabaseMock.setDefault('import_job_rows', { data: null, error: null });
    const result = await importJobsRepository.createJob(input);
    expect(result.id).toBe('synthetic-job');
    expect(result.event).toBeNull();
    const header = supabaseMock.queriesFor('import_jobs')[0];
    const payload = header.calls.find((c) => c.method === 'insert')?.args[0] as Record<string, unknown>;
    expect(payload).toEqual({ event_id: 'synthetic-event' });
    expect(payload).not.toHaveProperty('rows');
    expect(header.calls.map((c) => c.method)).toEqual(['insert', 'select', 'single']);
    const rowInsert = supabaseMock.queriesFor('import_job_rows')[0].calls
      .find((c) => c.method === 'insert')?.args[0] as Record<string, unknown>[];
    expect(rowInsert).toEqual([{
      source_row_index: 1, decision: 'matched', import_job_id: 'synthetic-job',
    }]);
    expect(supabaseMock.queriesFor('member_event_attendance')).toHaveLength(0);
  });

  it('skips the import-row insert entirely for an empty job', async () => {
    supabaseMock.setDefault('import_jobs', { data: job, error: null });
    await expect(importJobsRepository.createJob({ ...input, rows: [] })).resolves.toMatchObject({
      id: 'synthetic-job', event: null,
    });
    expect(supabaseMock.queriesFor('import_job_rows')).toHaveLength(0);
  });

  it('fails on a job write error or missing returned job rather than claiming success', async () => {
    supabaseMock.queueResult('import_jobs', {
      data: null, error: postgrestError('synthetic denied', '42501'),
    });
    await expect(importJobsRepository.createJob(input))
      .rejects.toMatchObject({ name: 'DatabaseError', code: '42501' });
    expect(supabaseMock.queriesFor('import_job_rows')).toHaveLength(0);
    supabaseMock.queueResult('import_jobs', { data: null, error: null });
    await expect(importJobsRepository.createJob(input)).rejects.toThrow('Import job was not created');
  });

  it('propagates row-insert error even if the job header already exists', async () => {
    supabaseMock.setDefault('import_jobs', { data: job, error: null });
    supabaseMock.setDefault('import_job_rows', {
      data: null, error: postgrestError('row rejected', '42501'),
    });
    await expect(importJobsRepository.createJob(input)).rejects.toMatchObject({ code: '42501' });
    expect(supabaseMock.queriesFor('import_jobs')).toHaveLength(1);
    // This repository does not promise a DB transaction or rollback on row failure.
  });

  it('does not turn denied list requests into an empty result', async () => {
    supabaseMock.setDefault('import_jobs', {
      data: null, error: postgrestError('synthetic permission denied', '42501'),
    });
    await expect(importJobsRepository.getRecentJobs()).rejects.toMatchObject({ code: '42501' });
    supabaseMock.setDefault('import_job_rows', {
      data: null, error: postgrestError('synthetic permission denied', '42501'),
    });
    await expect(importJobsRepository.getJobRows('synthetic-job')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('import row decision classification (#291)', () => {
  it.each([
    ['match', 'matched'], ['new', 'created'],
    ['already', 'skipped_duplicate'], ['duplicate', 'skipped_duplicate'],
    ['review', 'review'], ['skipped', 'review'], ['invalid', 'review'],
    ['unknown', 'error'], ['', 'error'],
  ])('maps %s to %s', (status, expected) => {
    expect(decisionFromRowStatus(status)).toBe(expected);
  });
});
