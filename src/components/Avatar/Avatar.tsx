import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { motion } from 'framer-motion';

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
      console.log('Upload started');

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      console.log('File selected:', file.name);
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Math.random()}.${fileExt}`;

      // Upload image to Supabase Storage
      console.log('Uploading to Supabase...');
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;
      console.log('Upload successful');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update user profile with new avatar URL
      console.log('Updating profile with new URL...');
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      console.log('Profile updated successfully');

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
    console.log('Avatar clicked, showUploadButton:', showUploadButton);
    if (showUploadButton && fileInputRef.current) {
      console.log('Triggering file input click');
      fileInputRef.current.click();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <motion.div
        whileHover={showUploadButton ? { scale: 1.05 } : {}}
        whileTap={showUploadButton ? { scale: 0.95 } : {}}
        onClick={handleClick}
        className={`${sizeClasses[size]} rounded-full overflow-hidden cursor-pointer bg-gray-200 flex items-center justify-center`}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <svg
            className="w-1/2 h-1/2 text-gray-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </motion.div>

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
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 