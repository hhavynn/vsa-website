import { PageTitle } from '../components/common/PageTitle';
import { FindMyPoints } from '../components/features/points/FindMyPoints';
import { PointsExplainer } from '../components/features/points/PointsExplainer';
import { useFindMyPoints } from '../hooks/useFindMyPoints';
import { isSupabaseUnavailable } from '../utils/isSupabaseUnavailable';
import { DegradedModeBanner } from '../components/common/DegradedModeBanner';
import { Link } from 'react-router-dom';

export default function Points() {
  const { error } = useFindMyPoints('all'); // Check all-time to see if service is up
  const isDegraded = isSupabaseUnavailable(error);

  return (
    <>
      <PageTitle title="Points Lookup" />
      {isDegraded && <DegradedModeBanner sourceName="points" />}

      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <div className="scrapbook-paper relative overflow-hidden p-6 sm:p-10">
            <span className="scrapbook-pin" aria-hidden />

            <div className="relative z-10">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span
                  className="scrapbook-sticker scrapbook-sticker-coral"
                  style={{ transform: 'rotate(-2deg)' }}
                >
                  POINTS LOOKUP
                </span>
              </div>

              <h1 className="vsa-page-title mb-4">Find My Points</h1>
              <p
                className="max-w-2xl font-sans text-[15px] leading-[1.8]"
                style={{ color: 'var(--text2)' }}
              >
                Search your name to see your VSA points, events attended, and rank for the academic
                year.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="vsa-container space-y-10 py-10">
        <FindMyPoints variant="page" />
        <div className="scrapbook-note flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--text)' }}>
              Need help with your points?
            </h2>
            <p className="mt-1 max-w-2xl font-sans text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
              If an event or point total looks wrong, send cabinet a correction request with the details.
            </p>
          </div>
          <Link
            to="/feedback?type=event&title=Points%20correction"
            className="vsa-btn-primary w-full shrink-0 text-center sm:w-auto"
          >
            Request a correction
          </Link>
        </div>
        <PointsExplainer showCorrectionCta={false} />
      </div>
    </>
  );
}
