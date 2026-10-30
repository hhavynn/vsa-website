import { Link } from 'react-router-dom';
import { memo } from 'react';
import { useSiteSettings } from '../../../context/SiteSettingsContext';
import { getSupabaseImageUrl } from '../../../lib/supabaseImages';
import { OFFICIAL_LOGO } from '../../../config/brandAssets';

export const NavLogo = memo(function NavLogo() {
  const { settings } = useSiteSettings();
  const logoSrc = settings.logoUrl || OFFICIAL_LOGO.small.src;

  // Figma .brand: bare official mark + Instrument Serif "VSA at UCSD".
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-3 transition-opacity duration-150 hover:opacity-85 touch:min-h-11 touch:min-w-11"
      aria-label="VSA at UCSD Home"
    >
      <img
        src={getSupabaseImageUrl(logoSrc, { width: 96, height: 96, resize: 'contain', quality: 80 })}
        alt=""
        className="h-10 w-10 object-contain"
        decoding="async"
      />
      <span className="font-display text-[19px] leading-none text-ed-ink min-[420px]:text-[22px]">
        VSA <i className="font-normal text-[var(--ed-wordmark)]">at</i> UCSD
      </span>
    </Link>
  );
});
