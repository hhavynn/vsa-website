import { supabase } from '../clients/supabase';
import { withErrorHandling, AuthenticationError, ValidationError } from '../errors';
import { UserProfileFormData, SignInFormData, SignUpFormData } from '../../schemas';
import { AuthUser } from '@supabase/supabase-js';

export interface UserProfile extends AuthUser {
  first_name: string;
  last_name: string;
  is_admin: boolean;
  avatar_url?: string;
}

export class AuthRepository {
  /**
   * Sign in a user with email and password
   */
  async signIn(credentials: SignInFormData): Promise<{ user: UserProfile; session: any }> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) throw error;
      if (!data.user || !data.session) {
        throw new AuthenticationError('Invalid credentials');
      }

      // Get user profile
      const profile = await this.getUserProfile(data.user.id);
      
      return {
        user: { ...data.user, ...profile },
        session: data.session,
      };
    }, 'Failed to sign in');
  }

  /**
   * Sign up a new user
   */
  async signUp(userData: SignUpFormData): Promise<{ user: UserProfile; session: any }> {
    return withErrorHandling(async () => {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) {
        throw new AuthenticationError('Failed to create user account');
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert([{
          id: authData.user.id,
          email: userData.email,
          first_name: userData.firstName,
          last_name: userData.lastName,
          is_admin: false,
        }]);

      if (profileError) throw profileError;

      // Get the complete user profile
      const profile = await this.getUserProfile(authData.user.id);

      return {
        user: { ...authData.user, ...profile },
        session: authData.session,
      };
    }, 'Failed to sign up');
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }, 'Failed to sign out');
  }

  /**
   * Get current user session
   */
  async getCurrentSession(): Promise<any> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    }, 'Failed to get current session');
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<UserProfile | null> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      if (!data.user) return null;
      
      const profile = await this.getUserProfile(data.user.id);
      return { ...data.user, ...profile };
    }, 'Failed to get current user');
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<Omit<UserProfile, keyof AuthUser>> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (!data) {
        throw new ValidationError('User profile not found');
      }

      return {
        first_name: data.first_name,
        last_name: data.last_name,
        is_admin: data.is_admin,
        avatar_url: data.avatar_url,
      };
    }, 'Failed to fetch user profile');
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, profileData: UserProfileFormData): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          ...profileData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;
    }, 'Failed to update user profile');
  }

  /**
   * Check if user is admin
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    return withErrorHandling(async () => {
      const profile = await this.getUserProfile(userId);
      return profile.is_admin;
    }, 'Failed to check admin status');
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
    }, 'Failed to send password reset email');
  }

  /**
   * Update password
   */
  async updatePassword(newPassword: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
    }, 'Failed to update password');
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

// Export a singleton instance
export const authRepository = new AuthRepository();
