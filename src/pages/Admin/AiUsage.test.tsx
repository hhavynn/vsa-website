import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminAiUsage, { summarizeAiUsage } from './AiUsage';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
const rpc = supabase.rpc as jest.Mock;
const rows = [
  { day: '2026-10-26', answered: 5, fallback: 2, rate_limited: 3, errors: 1, other: 0 },
  { day: '2026-10-25', answered: 4, fallback: 1, rate_limited: 0, errors: 0, other: 1 },
];

beforeEach(() => { rpc.mockReset().mockResolvedValue({ data: rows, error: null }); });

describe('Ask VSA admin aggregate usage report (#240)', () => {
  it('loads only daily counts from the privileged RPC and renders no identities', async () => {
    render(<AdminAiUsage />);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('admin_ai_usage_daily', { p_days: 30 }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Estimated AI spend')).toBeInTheDocument();
    expect(screen.getByText(/Not available from existing data/)).toBeInTheDocument();
    expect(screen.queryByText(/session_id_hash/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Reporting period'), { target: { value: '7' } });
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('admin_ai_usage_daily', { p_days: 7 }));
  });

  it('fails closed if the migration is missing or permission is denied', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    render(<AdminAiUsage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Usage report unavailable');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('keeps incomplete status samples visible in totals rather than hiding them', () => {
    expect(summarizeAiUsage(rows)).toEqual({
      requests: 17, answered: 9, fallback: 3, rate_limited: 3, errors: 1, other: 1,
    });
  });

  it('keeps the SQL RPC strictly admin-gated and count-only (static migration contract)', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261028080000_admin_ai_usage_aggregates.sql'), 'utf8');
    expect(sql).toMatch(/security definer set search_path = ''/i);
    expect(sql).toMatch(/public\.is_admin_user\(auth\.uid\(\)\)/);
    expect(sql).toMatch(/auth\.role\(\) is distinct from 'authenticated'/);
    expect(sql).toMatch(/revoke all on function public\.admin_ai_usage_daily\(integer\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.admin_ai_usage_daily\(integer\) to authenticated/i);
    expect(sql).toMatch(/from public\.ai_chat_usage_logs l/i);
    expect(sql).toContain('where l.created_at >=');
    expect(sql).toContain('and l.created_at <');
    expect(sql).not.toMatch(/grant\s+(select|all)\s+on\s+public\.ai_chat_usage_logs/i);
    expect(sql).not.toMatch(/return\s+query\s+select\s+\*/i);
  });
});
