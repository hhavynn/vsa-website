import { Link } from 'react-router-dom';
import { memo } from 'react';
import { useSiteSettings } from '../../../context/SiteSettingsContext';

export const NavLogo = memo(function NavLogo() {
  const { settings } = useSiteSettings();
  const logoSrc = settings.logoUrl || `${process.env.PUBLIC_URL || ''}/images/vsa-logo.jpg`;

  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2.5 transition-opacity duration-150 hover:opacity-85"
      aria-label="VSA at UCSD Home"
    >
      <img
        src={logoSrc}
        alt={settings.logoAlt || 'VSA logo'}
        className="h-9 w-9 rounded-full border object-cover"
        style={{ borderColor: 'var(--border2)' }}
      />
      <span
        className="hidden font-serif text-[17px] tracking-[-0.01em] min-[420px]:inline"
        style={{ color: 'var(--text)' }}
      >
        VSA <span className="font-light" style={{ color: 'var(--text3)' }}>at UCSD</span>
      </span>
    </Link>
  );
});
