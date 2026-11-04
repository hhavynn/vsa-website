import { OptimizedImage } from '../../common/OptimizedImage';

interface AdminCabinetAvatarProps {
  name: string;
  imageUrl: string | null | undefined;
  thumbnailUrl?: string | null;
  alt?: string;
  size?: 48 | 80;
}

/** Display-only portrait for the admin Cabinet roster/editor.
 * Uses the uploaded smaller portrait when present, preserving the existing
 * initials placeholder if a photo is missing or fails to load.
 */
export function AdminCabinetAvatar({
  name,
  imageUrl,
  thumbnailUrl,
  alt = name,
  size = 48,
}: AdminCabinetAvatarProps) {
  const boxClass = size === 80 ? 'h-20 w-20' : 'h-12 w-12';
  const fallback = (
    <div
      className={`flex ${boxClass} shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] font-semibold text-[var(--color-text2)] ${size === 80 ? 'text-lg' : 'text-[13px]'}`}
      aria-label={`${name} portrait unavailable`}
    >
      {name.charAt(0)}
    </div>
  );

  return (
    <OptimizedImage
      src={thumbnailUrl || imageUrl}
      alt={alt}
      width={size}
      height={size}
      widths={[size, size * 2]}
      sizes={`${size}px`}
      resize="cover"
      className={`${boxClass} shrink-0 rounded-full border border-[var(--color-border)] object-cover shadow-sm`}
      fallback={fallback}
    />
  );
}
