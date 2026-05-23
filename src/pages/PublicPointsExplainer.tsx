import { PageTitle } from '../components/common/PageTitle';
import { PointsExplainer } from '../components/features/points/PointsExplainer';
import { Link } from 'react-router-dom';

const TrophyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 576 512" fill="currentColor"><path d="M400 64c0-35.3-28.7-64-64-64H240c-35.3 0-64 28.7-64 64H64C28.7 64 0 92.7 0 128V192c0 88.4 86 160 192 160c5.3 0 10.5-.3 15.6-.8c21.3 27.6 48.3 49.3 79.5 61.2L288 512H192c-17.7 0-32 14.3-32 32s14.3 32 32 32H384c17.7 0 32-14.3 32-32s-14.3-32-32-32H288l1.1-98.7c31.2-11.9 58.2-33.5 79.5-61.2c5.1 .5 10.3 .8 15.6 .8c106 0 192-71.6 192-160V128c0-35.3-28.7-64-64-64H400zM64 128H176V301.9C104.5 282.4 48 238.1 48 192V128H64zm336 173.9V128H512v64c0 46.1-56.5 90.4-128 109.9z"/></svg>
);

export function PublicPointsExplainer() {
  return (
    <>
      <PageTitle title="Points Guide" />

      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <div className="scrapbook-paper relative overflow-hidden p-6 sm:p-10">
            <span className="scrapbook-pin" aria-hidden />
            
            <div className="absolute right-6 top-6 opacity-10 sm:right-10 sm:top-10">
              <TrophyIcon className="h-24 w-24 text-[var(--brand)]" />
            </div>

            <div className="relative z-10">
              <h1 className="vsa-page-title mb-4">Points Guide</h1>
              <p className="max-w-2xl font-sans text-[15px] leading-[1.8]" style={{ color: 'var(--text2)' }}>
                Everything you need to know about earning points, house competition, and tracking your involvement with UCSD VSA.
              </p>
            </div>
          </div>
          
          <div className="mt-8">
            <Link to="/leaderboard" className="vsa-btn-primary font-sans text-sm font-medium">
              View Leaderboard →
            </Link>
          </div>
        </div>
      </div>

      <div className="vsa-container py-12">
        <div className="max-w-4xl mx-auto">
          <PointsExplainer />
        </div>
      </div>
    </>
  );
}
