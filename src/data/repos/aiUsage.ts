import { supabase } from '../../lib/supabase';
import { DatabaseError, ValidationError, withErrorHandling } from '../errors';

/** Aggregate-only contract: no messages, identifiers, sessions or raw logs. */
export interface AiUsageDay {
  day: string;
  answered: number;
  fallback: number;
  rate_limited: number;
  errors: number;
  other: number;
}

export type ReportDays = 7 | 30 | 90;
type UsageReportResult = {
  data: AiUsageDay[] | null;
  error: { message: string; code?: string } | null;
};

// This RPC is not in generated Database types until staging migration is verified.
type UsageReportClient = {
  rpc: (name: 'admin_ai_usage_daily', args: { p_days: ReportDays }) => PromiseLike<UsageReportResult>;
};

export const aiUsageRepository = {
  async getDaily(period: ReportDays): Promise<AiUsageDay[]> {
    return withErrorHandling(async () => {
      if (![7, 30, 90].includes(period)) throw new ValidationError('Invalid report period');
      const client = supabase as unknown as UsageReportClient;
      const { data, error } = await client.rpc('admin_ai_usage_daily', { p_days: period });
      if (error) throw new DatabaseError(error.message, error.code);
      if (!Array.isArray(data)) throw new DatabaseError('Unexpected usage report response');
      return data;
    }, 'Failed to read AI usage');
  },
};
