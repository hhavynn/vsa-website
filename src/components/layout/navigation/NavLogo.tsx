import { Link } from 'react-router-dom';
import { memo } from 'react';
import { useSiteSettings } from '../../../context/SiteSettingsContext';

export const NavLogo = memo(function NavLogo() {
  const { settings } = useSiteSettings();

  return (
    <Link
      to="/"
      className="flex items-center gap-2 hover:opacity-85 transition-opacity duration-150 shrink-0"
      aria-label="VSA at UCSD — Home"
    >
      {settings.logoUrl ? (
        <img
          src={settings.logoUrl}
          alt={settings.logoAlt}
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold font-sans tracking-wide"
          style={{ background: 'var(--color-brand)', color: '#fff' }}
        >
          VSA
        </span>
      )}
      <span
        className="font-serif text-[17px] tracking-[-0.01em]"
        style={{ color: 'var(--color-text)' }}
      >
        <em className="not-italic italic" style={{ color: 'var(--color-brand)' }}>VSA</em>
        {' '}at UCSD
      </span>
    </Link>
  );
});
