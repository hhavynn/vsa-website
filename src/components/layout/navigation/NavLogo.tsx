import { Link } from 'react-router-dom';
import { memo } from 'react';
import { useSiteSettings } from '../../../context/SiteSettingsContext';
import { getSupabaseImageUrl } from '../../../lib/supabaseImages';
import { usePublicEditorialRoute } from '../publicEditorialTheme';
import { OFFICIAL_LOGO } from '../../../config/brandAssets';

export const NavLogo = memo(function NavLogo() {
  const { settings } = useSiteSettings();
  const editorial = usePublicEditorialRoute();
  const fallbackLogo = editorial ? OFFICIAL_LOGO.small.src : `${process.env.PUBLIC_URL || ''}/images/vsa-logo.jpg`;
  const logoSrc = settings.logoUrl || fallbackLogo;

  if (editorial) {
    // Figma .brand: bare official mark + Instrument Serif "VSA at UCSD".
    return (
      <Link
        to="/"
        className="flex shrink-0 items-center gap-3 transition-opacity duration-150 hover:opacity-85 touch:min-h-11 touch:min-w-11"
        aria-label="VSA at UCSD Home"
      >
        <img
          src={getSupabaseImageUrl(logoSrc, { width: 96, height: 96, resize: 'contain', quality: 80 })}
          alt={settings.logoAlt || 'VSA logo'}
          className="h-10 w-10 object-contain"
          decoding="async"
        />
        <span className="font-display text-[19px] leading-none text-ed-ink min-[420px]:text-[22px]">
          VSA <i className="font-normal text-[var(--ed-wordmark)]">at</i> UCSD
        </span>
      </Link>
    );
  }

  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2.5 transition-opacity duration-150 hover:opacity-85 touch:min-h-11 touch:min-w-11"
      aria-label="VSA at UCSD Home"
    >
      <img
        src={getSupabaseImageUrl(logoSrc, { width: 96, height: 96, resize: 'cover', quality: 78 })}
        alt={settings.logoAlt || 'VSA logo'}
        className="h-9 w-9 rotate-[-2deg] rounded-lg border object-cover shadow-[0_2px_8px_rgba(20,32,40,0.12)]"
        style={{ borderColor: 'var(--border2)', background: 'var(--surface)' }}
        decoding="async"
      />
      <span
        className="hidden font-serif text-[17px] tracking-[-0.01em] min-[420px]:inline"
        style={{ color: 'var(--text)' }}
      >
        VSA <span className="font-light italic" style={{ color: 'var(--brand)' }}>at UCSD</span>
      </span>
    </Link>
  );
});
