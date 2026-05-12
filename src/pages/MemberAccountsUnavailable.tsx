import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';

export function MemberAccountsUnavailable() {
  return (
    <>
      <PageTitle title="Member Accounts Unavailable" />
      <div className="min-h-[60vh] px-4 py-20" style={{ background: 'var(--color-bg)' }}>
        <div className="mx-auto max-w-md text-center">
          <p className="font-sans text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text3)' }}>
            Member accounts
          </p>
          <h1 className="mt-3 font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 36, color: 'var(--color-text)' }}>
            Not currently enabled
          </h1>
          <p className="mt-4 font-sans text-sm leading-6" style={{ color: 'var(--color-text2)' }}>
            VSA member account features are paused for this version of the site. Public pages are still available without signing in.
          </p>
          <Link
            to="/"
            className="mt-7 inline-flex rounded-lg bg-[var(--brand)] px-4 py-2.5 font-sans text-[13px] font-semibold text-[#f8fbfb] transition-opacity duration-150 hover:opacity-90"
          >
            Return Home
          </Link>
        </div>
      </div>
    </>
  );
}
