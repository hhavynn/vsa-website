import React from 'react';
import { Link } from 'react-router-dom';
import { useAnalyticsConsent } from '../../context/AnalyticsConsentContext';
import { FOOTER_GROUPS, FOOTER_LEGAL_LINKS } from './navigation/footerLinks';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { getSupabaseImageUrl } from '../../lib/supabaseImages';
import { OFFICIAL_LOGO } from '../../config/brandAssets';

const socialLinks = [
  {
    label: 'Instagram',
    href: 'https://instagram.com/vsaatucsd',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>,
  },
  {
    label: 'Discord',
    href: 'https://discord.gg/cSb6Q4gnW8',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" /></svg>,
  },
  {
    label: 'Facebook',
    href: 'https://facebook.com/ucsdvsa',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
  },
];

const editorialLink =
  'block w-fit py-1 text-[13px] text-ed-ink underline-offset-4 transition-opacity duration-150 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ed-ink touch:flex touch:min-h-11 touch:items-center';
const editorialLabel = 'mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ed-muted';

/** Figma footer: periwinkle field, large serif wordmark | mono-labelled link columns. */
function EditorialFooter() {
  const { isConfigured, openPreferences } = useAnalyticsConsent();
  const { settings } = useSiteSettings();
  const logoSrc = settings.logoUrl || OFFICIAL_LOGO.small.src;

  return (
    <footer className="editorial-footer border-t border-ed-line bg-surface2 text-ed-ink">
      <div className="mx-auto grid max-w-[1600px] gap-12 px-5 pb-8 pt-16 sm:px-[6vw] sm:pt-20 lg:grid-cols-2 lg:gap-16">
        <div className="min-w-0">
          <img
            src={getSupabaseImageUrl(logoSrc, { width: 180, height: 180, resize: 'contain', quality: 80 })}
            alt=""
            className="h-[72px] w-[72px] object-contain sm:h-[90px] sm:w-[90px]"
            loading="lazy"
            decoding="async"
          />
          <p className="my-4 font-display text-[3.3rem] leading-none tracking-[-0.035em] sm:text-[4rem]">
            VSA <em className="font-normal text-ed-accent">at</em> UCSD
          </p>
          <p className="max-w-sm text-[13px] leading-[1.7] text-text-secondary">
            Vietnamese Student Association at UC San Diego. Sharing Vietnamese culture, building community, and
            welcoming all students since 1977.
          </p>
          <div className="mt-6 flex gap-2">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                className="inline-flex h-10 w-10 items-center justify-center border border-ed-line text-ed-ink transition-colors duration-150 hover:border-ed-ink touch:h-11 touch:w-11"
              >
                {link.icon}
              </a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:pt-6">
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-labelledby={`footer-nav-${group.title.toLowerCase()}`}>
              <h2 id={`footer-nav-${group.title.toLowerCase()}`} className={editorialLabel}>
                {group.title}
              </h2>
              {group.links.map((link) => (
                <Link key={link.label} to={link.to} className={editorialLink}>
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
          <nav aria-labelledby="footer-nav-connect">
            <h2 id="footer-nav-connect" className={editorialLabel}>
              Connect
            </h2>
            <a className={editorialLink} href="https://instagram.com/vsaatucsd" target="_blank" rel="noopener noreferrer">@vsaatucsd</a>
            <a className={editorialLink} href="https://discord.gg/cSb6Q4gnW8" target="_blank" rel="noopener noreferrer">Discord Server</a>
          </nav>
        </div>

        <div className="flex flex-col gap-3 border-t border-ed-line pt-6 font-mono text-[10px] uppercase tracking-[0.08em] text-ed-muted sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
          <span>© {new Date().getFullYear()} VSA at UCSD · Est. 1977</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {FOOTER_LEGAL_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="inline-flex items-center text-ed-ink underline-offset-4 hover:underline touch:min-h-11">
                {link.label}
              </Link>
            ))}
            {isConfigured && (
              <button
                type="button"
                onClick={openPreferences}
                className="inline-flex items-center uppercase tracking-[0.08em] text-ed-ink underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ed-ink touch:min-h-11"
              >
                Analytics preferences
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Shared chrome on every route: the editorial footer, themed by tokens. */
const Footer: React.FC = () => <EditorialFooter />;

export default Footer;
