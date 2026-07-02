import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';

interface AvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Render this image directly without querying user_profiles. Preferred for
   * list surfaces (leaderboard, member cards) so each row does not issue its
   * own profile query. */
  avatarUrl?: string | null;
  /** Fetch the avatar for this auth user id. RLS only permits reading your
   * own profile (or any profile as admin); other rows fall back to the
   * placeholder silently. */
  userId?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-24 h-24'
};

export function Avatar({ size = 'md', className = '', avatarUrl: avatarUrlProp, userId }: AvatarProps) {
  const { user } = useAuth();
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const skipFetch = avatarUrlProp !== undefined;

  const fetchAvatar = useCallback(async () => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('avatar_url')
      .eq('id', targetUserId)
      .single();

    // RLS blocks reading other users' profiles; treat as "no avatar".
    if (!error && profile?.avatar_url) {
      setFetchedUrl(profile.avatar_url);
    }
  }, [userId, user?.id]);

  useEffect(() => {
    if (skipFetch) return;
    fetchAvatar();
  }, [skipFetch, fetchAvatar]);

  const avatarUrl = skipFetch ? avatarUrlProp : fetchedUrl;

  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface2)]`}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <svg
            className="h-1/2 w-1/2 text-[var(--color-text3)]"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
