import React from 'react';
import { Link } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// ICONS (SVG implementations to avoid react-icons type issues)
// ─────────────────────────────────────────────────────────────────────────────

const StarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 576 512" fill="currentColor"><path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.5 7-28.8 18L195 150.3 47.7 171.5c-12.1 1.7-22.1 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.8 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 546.2 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.6-19.9-25.7-21.7L381.2 150.3 316.9 18z"/></svg>
);

const BoltIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 512 512" fill="currentColor"><path d="M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"/></svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 448 512" fill="currentColor"><path d="M128 0c17.7 0 32 14.3 32 32V64H288V32c0-17.7 14.3-32 32-32s32 14.3 32 32V64h48c26.5 0 48 21.5 48 48v48H0V112C0 85.5 21.5 64 48 64H96V32c0-17.7 14.3-32 32-32s32 14.3 32 32V64h48c26.5 0 48 21.5 48 48v48H0V112C0 85.5 21.5 64 48 64H96V32c0-17.7 14.3-32 32-32zM0 192H448V464c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V192zm64 80v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H80c-8.8 0-16 7.2-16 16zm128 0v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H208c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H336zM64 400v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H80c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H208z"/></svg>
);

const QuestionIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL REUSABLE COMPONENTS (Scrapbook Elements)
// ─────────────────────────────────────────────────────────────────────────────

function StickerBadge({ children, rotation = 0, color = 'primary' }: { children: React.ReactNode; rotation?: number; color?: 'primary' | 'accent' | 'gold' }) {
  const colorClass = color === 'primary' ? 'scrapbook-sticker-teal' : color === 'accent' ? 'scrapbook-sticker-coral' : 'scrapbook-sticker-gold';
  return (
    <span 
      className={`scrapbook-sticker ${colorClass}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const PointsExplainer: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Main Explainer Card */}
      <div className="scrapbook-paper relative overflow-hidden p-6 sm:p-10">
        <span className="scrapbook-pin" aria-hidden />
        
        <div className="absolute right-6 top-6 pointer-events-none opacity-5 sm:right-10 sm:top-10">
          <StarIcon className="h-24 w-24 text-[var(--brand)]" />
        </div>

        <div className="relative z-10">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <StickerBadge rotation={-2} color="accent">HOW POINTS WORK</StickerBadge>
            <StickerBadge rotation={1} color="primary">VSA GUIDE</StickerBadge>
          </div>
          
          <h2 className="vsa-section-title mb-8">Earn Points, Show Up</h2>
          
          <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            {/* Participation */}
            <div className="flex gap-4">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] shadow-sm">
                <BoltIcon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-serif text-[18px] font-bold leading-tight" style={{ color: 'var(--text)' }}>
                  Earn by Participating
                </h4>
                <p className="mt-2 font-sans text-sm leading-relaxed opacity-80" style={{ color: 'var(--text2)' }}>
                  Attend GBMs, socials, fundraisers, and community events to earn points. Just make sure to check in with a cabinet member or use our check-in system!
                </p>
              </div>
            </div>

            {/* House Points */}
            <div className="flex gap-4">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm">
                <StarIcon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-serif text-[18px] font-bold leading-tight" style={{ color: 'var(--text)' }}>
                  House Competition
                </h4>
                <p className="mt-2 font-sans text-sm leading-relaxed opacity-80" style={{ color: 'var(--text2)' }}>
                  If you are actively in a House when you attend a qualifying event, your points can also help your House climb the leaderboard.
                </p>
              </div>
            </div>

            {/* Academic Terms */}
            <div className="flex gap-4">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-t)]/10 text-[var(--gold-t)] shadow-sm">
                <CalendarIcon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-serif text-[18px] font-bold leading-tight" style={{ color: 'var(--text)' }}>
                  Academic Terms
                </h4>
                <p className="mt-2 font-sans text-sm leading-relaxed opacity-80" style={{ color: 'var(--text2)' }}>
                  Yearly leaderboards are based on events assigned to the academic year. House standings have extra rules: points only count while you are an active House member, and they are not added retroactively.
                </p>
              </div>
            </div>

            {/* Syncing */}
            <div className="flex gap-4">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--text2)]/10 text-[var(--text2)] shadow-sm">
                <ClockIcon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-serif text-[18px] font-bold leading-tight" style={{ color: 'var(--text)' }}>
                  Syncing & Verification
                </h4>
                <p className="mt-2 font-sans text-sm leading-relaxed opacity-80" style={{ color: 'var(--text2)' }}>
                  Points are manually verified and synced by our cabinet team. It may take 24-48 hours after an event for your points to reflect on the public leaderboard.
                  Cabinet and interns do not earn points for required duties like staffing, setup, cleanup, or assigned shifts. They can still earn points when they attend as regular members.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Correction CTA Note */}
      <div className="scrapbook-note relative p-6 sm:p-8" style={{ background: 'var(--surface2)' }}>
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex gap-4">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--accent)] text-[var(--accent)] shadow-inner">
              <QuestionIcon className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-serif text-[17px] font-bold" style={{ color: 'var(--text)' }}>
                Points look wrong?
              </h4>
              <p className="mt-1 font-sans text-sm opacity-80" style={{ color: 'var(--text2)' }}>
                If you believe your points haven't been recorded correctly, please let us know so we can fix it!
              </p>
            </div>
          </div>
          <Link 
            to="/feedback?type=event&title=Points%20correction" 
            className="vsa-btn-primary w-full whitespace-nowrap text-center md:w-auto"
          >
            Submit Correction
          </Link>
        </div>
      </div>
    </div>
  );
};
