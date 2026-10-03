import { supabase } from '../../lib/supabase';
import { withErrorHandling } from '../errors';

/**
 * Admin-status lookup behind `useAdmin` and the sign-in flow.
 *
 * Member accounts are retired, so this repository deliberately has no sign-up,
 * profile, or password methods: admin accounts are provisioned by invitation and
 * sign in through `AuthContext`. Only the admin-status check remains.
 */
export class AuthRepository {
  /**
   * Whether the user's profile is flagged admin. Reads only `is_admin`.
   *
   * This drives what the browser renders (the admin shell, the user menu); it
   * is not authorization -- RLS on the underlying tables is. Anything other
   * than an explicit `true` (no profile row, a null flag) is "not admin", and a
   * query failure rejects so callers can fail closed.
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      return data?.is_admin === true;
    }, 'Failed to check admin status');
  }
}

// Export a singleton instance
export const authRepository = new AuthRepository();
