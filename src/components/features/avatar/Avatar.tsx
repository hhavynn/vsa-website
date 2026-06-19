import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { motion, useReducedMotion } from 'framer-motion';
import { getUploadExtension, prepareImageForUpload } from '../../../lib/imageUpload';

interface AvatarProps {
  size?: 'sm' | 'md' | 'lg';
  showUploadButton?: boolean;
  className?: string;
  userId?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-24 h-24'
};

export function Avatar({ size = 'md', showUploadButton = false, className = '', userId }: AvatarProps) {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const fetchAvatar = useCallback(async () => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('avatar_url')
        .eq('id', targetUserId)
        .single();

      if (error) throw error;
      if (profile?.avatar_url) {
        setAvatarUrl(profile.avatar_url);
      }
    } catch (error) {
      console.error('Error fetching avatar:', error);
    }
  }, [userId, user?.id]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const { file } = await prepareImageForUpload(event.target.files[0], 'avatar');
      const fileExt = getUploadExtension(file);
      const filePath = `${user.id}/${Math.random()}.${fileExt}`;

      // Upload image to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '31536000',
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update user profile with new avatar URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Error uploading avatar!');
    } finally {
      setUploading(false);
    }
  };

  // Fetch avatar on component mount and when user changes
  useEffect(() => {
    fetchAvatar();
  }, [user, userId, fetchAvatar]);

  const handleClick = () => {
    if (showUploadButton && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const avatarVisual = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={showUploadButton ? '' : 'Profile photo'}
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
  );

  return (
    <div className={`relative ${className}`}>
      {showUploadButton ? (
        <motion.button
          type="button"
          whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
          onClick={handleClick}
          disabled={uploading}
          aria-label={avatarUrl ? 'Change profile photo' : 'Upload profile photo'}
          className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:cursor-wait`}
        >
          {avatarVisual}
        </motion.button>
      ) : (
        <div className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface2)]`}>
          {avatarVisual}
        </div>
      )}

      {showUploadButton && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            accept="image/*"
            className="hidden"
          />
          {uploading && (
            <>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/50" aria-hidden="true">
                <div className="h-6 w-6 rounded-full border-b-2 border-white motion-safe:animate-spin" />
              </div>
              <span className="sr-only" role="status" aria-live="polite">Uploading profile photo</span>
            </>
          )}
        </>
      )}
    </div>
  );
} 
