import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';

const helpfulLinks = [
  { to: '/', label: 'Home' },
  { to: '/events', label: 'Events' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/cabinet', label: 'Cabinet' },
  { to: '/get-involved', label: 'Get Involved' },
];

export function NotFound() {
  return (
    <>
      <PageTitle title="404" />
      <div className="vsa-container flex min-h-[70vh] items-center justify-center py-16 text-center">
        <div className="scrapbook-paper relative mx-auto max-w-2xl p-6 sm:p-10">
          <span className="scrapbook-pin" aria-hidden />
          <p className="font-serif text-[80px] leading-none tracking-[-0.04em] text-brand-600 dark:text-brand-400 sm:text-[120px]">
            404
          </p>
          <span className="scrapbook-sticker scrapbook-sticker-gold mt-3 inline-flex">Page not found</span>
          <h1 className="mt-5 font-serif text-3xl leading-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
            This page wandered off from the VSA family.
          </h1>
          <p className="mx-auto mt-4 max-w-md font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            The link may be outdated, private, or moved. Try one of these public pages to get back into the site.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {helpfulLinks.map((link, index) => (
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
