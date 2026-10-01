import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';
import {
  ExactMemberMatch,
  MemberOption,
  buildMemberNameIndex,
  findExactMemberMatch,
  toMemberOption,
} from '../../lib/memberLinkMatching';

export type { ExactMemberMatch, MemberOption } from '../../lib/memberLinkMatching';

/**
 * Admin member lookup for linking ACE, Cabinet, and photo requests to
 * canonical `members.id`. Reads only the `public_members` safe projection,
 * so no email, auth, or import metadata ever reaches these screens.
 */
const LOOKUP_SELECT = 'id, first_name, last_name, college, year' as const;
const DIRECTORY_PAGE_SIZE = 1000;

/** Strips PostgREST filter metacharacters so a term cannot malform `.or()`. */
function searchTokens(query: string): string[] {
  return query
    .replace(/[,()%.*\\]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export class MemberLookupRepository {
  /**
   * One word matches either name; several words match first name on the
   * first word and last name on the last ("havyn nguyen").
   */
  async searchMembers(query: string, limit = 10): Promise<MemberOption[]> {
    return withErrorHandling(async () => {
      const tokens = searchTokens(query);
      if (tokens.join('').length < 2) return [];
      let request = supabase.from('public_members').select(LOOKUP_SELECT);
      if (tokens.length === 1) {
        request = request.or(`first_name.ilike.%${tokens[0]}%,last_name.ilike.%${tokens[0]}%`);
      } else {
        request = request
          .ilike('first_name', `%${tokens[0]}%`)
          .ilike('last_name', `%${tokens[tokens.length - 1]}%`);
      }
      const { data, error } = await request
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map(toMemberOption);
    }, 'Failed to search members');
  }

  async findMemberById(memberId: string | null | undefined): Promise<MemberOption | null> {
    if (!memberId) return null;
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('public_members')
        .select(LOOKUP_SELECT)
        .eq('id', memberId)
        .maybeSingle();
      if (error) throw error;
      return data ? toMemberOption(data) : null;
    }, 'Failed to look up member');
  }

  /** Every member, paged past PostgREST's row cap, for exact-name matching. */
  async listMemberDirectory(): Promise<MemberOption[]> {
    return withErrorHandling(async () => {
      const members: MemberOption[] = [];
      for (let from = 0; ; from += DIRECTORY_PAGE_SIZE) {
        const { data, error } = await supabase
          .from('public_members')
          .select(LOOKUP_SELECT)
          .order('id', { ascending: true })
          .range(from, from + DIRECTORY_PAGE_SIZE - 1);
        if (error) throw error;
        members.push(...(data ?? []).map(toMemberOption));
        if (!data || data.length < DIRECTORY_PAGE_SIZE) return members;
      }
    }, 'Failed to load member directory');
  }

  /** Exact normalized-name match; never guesses between same-name members. */
  async suggestExactMemberMatch(name: string): Promise<ExactMemberMatch> {
    const directory = await this.listMemberDirectory();
    return findExactMemberMatch(name, buildMemberNameIndex(directory));
  }
}

export const memberLookupRepository = new MemberLookupRepository();
