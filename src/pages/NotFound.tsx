import { Link, useLocation } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { RelatedLinks } from '../components/common/RelatedLinks';
import { PublicSearchPanel } from '../components/features/search/PublicSearchPanel';
import { legacyDestinationFor, likelyDestinations, primaryRecoveryLinks } from '../lib/notFoundRecovery';

// A recovery surface, not a dead end: a search box, the page the visitor most
// likely meant (derived from the URL's own words and the public nav metadata),
// and the main entry points. It is still a 404 -- there is no redirect and no
// guessing at unknown URLs.
export function NotFound() {
  const { pathname } = useLocation();
  const legacy = legacyDestinationFor(pathname);
  const likely = likelyDestinations(pathname).filter((entry) => entry.to !== legacy?.to);

  return (
    <>
      <PageTitle title="Page not found" />
      <div className="vsa-container flex justify-center py-12 text-center sm:py-16">
        <div className="scrapbook-paper relative mx-auto w-full max-w-2xl p-6 sm:p-10">
          <span className="scrapbook-pin" aria-hidden />
          <p className="font-serif text-[80px] leading-none tracking-[-0.04em] text-brand-600 dark:text-brand-400 sm:text-[120px]">
            404
          </p>
          <span className="scrapbook-sticker scrapbook-sticker-gold mt-3 inline-flex">Page not found</span>
          <h1 className="mt-5 font-serif text-3xl leading-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
            This page wandered off from the VSA family.
          </h1>
          <p className="mx-auto mt-4 max-w-md font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            The link may be outdated, private, or moved. Search for what you need, or jump back in below.
          </p>

          {legacy && (
            <div className="mx-auto mt-6 max-w-md rounded-lg border border-brand-600 p-4 text-left dark:border-brand-400">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text3)]">
                Looking for this?
              </p>
              <p className="mt-1 font-sans text-sm leading-snug text-[var(--color-text2)]">{legacy.description}</p>
              <Link to={legacy.to} className="vsa-btn-primary mt-3 inline-flex font-sans text-sm">
                {legacy.label}
              </Link>
            </div>
          )}

          <PublicSearchPanel variant="inline" className="mx-auto mt-6 max-w-md" />

          {likely.length > 0 && (
            <RelatedLinks
              heading="You might have meant"
              className="mx-auto mt-6 max-w-md text-left"
              links={likely.map((entry) => ({ to: entry.to, label: entry.title, description: entry.detail }))}
            />
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {primaryRecoveryLinks().map((link, index) => (
              <Link
                key={link.to}
                to={link.to}
                className={index === 0 ? 'vsa-btn-primary font-sans text-sm' : 'vsa-btn-ghost font-sans text-sm'}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
