import { Link } from 'react-router-dom';
import { ApplicationCTA } from '../../common/ApplicationCTA';
import { APPLICATION_KEYS } from '../../../lib/applicationLinks';

interface OpenOpportunitiesProps {
  /**
   * Compact mode renders a smaller teaser suitable for the homepage.
   * Default (false) renders the full section heading and CTA grid.
   */
  compact?: boolean;
}

/**
 * Shows currently open VSA application windows and interest forms.
 *
 * Full mode: scrapbook-styled section with heading + ApplicationCTA grid.
 * Compact mode: lightweight homepage teaser that only shows when something
 * is actually open; collapses to nothing when all windows are closed.
 */
export function OpenOpportunities({ compact = false }: OpenOpportunitiesProps) {
  if (compact) {
    return (
      <ApplicationCTA
        applicationKeys={APPLICATION_KEYS}
        openOnly
        className="vsa-container py-8 sm:py-10"
        heading="What's Open Now"
        emptyMessage=""
      />
    );
  }

  return (
    <div>
      <div className="mb-1">
        <span className="scrapbook-sticker scrapbook-sticker-coral mb-3 inline-block">
          Apply Now
        </span>
        <h2
          className="vsa-section-title mb-1"
          style={{ color: 'var(--text)' }}
        >
          What's Open <em>Now</em>
        </h2>
        <p
          className="mb-6 font-sans text-[14px] leading-[1.75]"
          style={{ color: 'var(--text2)' }}
        >
          Currently open applications and interest forms
        </p>
      </div>
      <ApplicationCTA
        applicationKeys={APPLICATION_KEYS}
        openOnly
        emptyMessage="No applications or interest forms are open right now. Check back here when ACE, House, Intern, Cabinet, VCN, or WNC forms open."
      />
      <p className="mt-4 font-sans text-[13px]" style={{ color: 'var(--text3)' }}>
        Looking for a specific program?{' '}
        <Link
          to="/get-involved#programs"
          className="underline hover:no-underline"
          style={{ color: 'var(--brand)' }}
        >
          Browse all programs
        </Link>
      </p>
    </div>
  );
}
