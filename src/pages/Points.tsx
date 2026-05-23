import { PageTitle } from '../components/common/PageTitle';
import { FindMyPoints } from '../components/features/points/FindMyPoints';
import { PointsExplainer } from '../components/features/points/PointsExplainer';

export default function Points() {
  return (
    <>
      <PageTitle title="Points Lookup" />

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
        <PointsExplainer />
      </div>
    </>
  );
}
