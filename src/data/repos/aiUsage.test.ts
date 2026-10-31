import { aiUsageRepository } from './aiUsage';
import { DatabaseError, ValidationError } from '../errors';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

describe('admin-only aggregate AI usage repository (#291)', () => {
  const day = {
    day: '2026-10-30', answered: 3, fallback: 1,
    rate_limited: 2, errors: 0, other: 0,
  };

  it.each([7, 30, 90] as const)('reads only the aggregate admin RPC for %i days', async (period) => {
    supabaseMock.setDefault('rpc:admin_ai_usage_daily', { data: [day], error: null });
    await expect(aiUsageRepository.getDaily(period)).resolves.toEqual([day]);
    const calls = supabaseMock.queriesFor('rpc:admin_ai_usage_daily');
    expect(calls).toHaveLength(1);
    expect(calls[0].calls).toEqual([{ method: 'rpc', args: [{ p_days: period }] }]);
    expect(supabaseMock.queriesFor('ai_usage_logs')).toHaveLength(0);
    expect(supabaseMock.queriesFor('chat_messages')).toHaveLength(0);
    expect(JSON.stringify(day)).not.toMatch(/session|member|email|prompt/);
  });

  it('returns an actual empty array when the aggregate RPC returns no days', async () => {
    supabaseMock.setDefault('rpc:admin_ai_usage_daily', { data: [], error: null });
    await expect(aiUsageRepository.getDaily(30)).resolves.toEqual([]);
  });

  it('rejects a missing or malformed result instead of claiming zero activity', async () => {
    supabaseMock.queueResult('rpc:admin_ai_usage_daily', { data: null, error: null });
    await expect(aiUsageRepository.getDaily(7)).rejects.toThrow('Unexpected usage report response');
    supabaseMock.queueResult('rpc:admin_ai_usage_daily', { data: { answer: 100 }, error: null });
    await expect(aiUsageRepository.getDaily(7)).rejects.toBeInstanceOf(DatabaseError);
  });

  it('preserves PostgREST denial code without another query or fallback', async () => {
    supabaseMock.queueResult('rpc:admin_ai_usage_daily', {
      data: null, error: postgrestError('Permission denied', '42501'),
    });
    await expect(aiUsageRepository.getDaily(90)).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
    expect(supabaseMock.queriesFor('rpc:admin_ai_usage_daily')).toHaveLength(1);
  });

  it('rejects unapproved periods before any RPC is sent', async () => {
    await expect(aiUsageRepository.getDaily(0 as 7)).rejects.toBeInstanceOf(ValidationError);
    await expect(aiUsageRepository.getDaily(365 as 7)).rejects.toThrow('Invalid report period');
    expect(supabaseMock.queries()).toHaveLength(0);
  });
});
