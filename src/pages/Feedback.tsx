import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { FeedbackForm } from '../components/features/feedback/FeedbackForm';
import { PageTitle } from '../components/common/PageTitle';

const feedbackTypes = ['bug', 'feature', 'improvement', 'event', 'other'] as const;
type FeedbackType = typeof feedbackTypes[number];

function getFeedbackType(type: string | null): FeedbackType {
  return feedbackTypes.includes(type as FeedbackType) ? (type as FeedbackType) : 'feature';
}

export const FeedbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const defaultType = getFeedbackType(searchParams.get('type'));
  const defaultTitle = searchParams.get('title') ?? '';

  return (
    <>
      <PageTitle title="Feedback" />

      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '48px 52px 36px' }}>
        <div className="vsa-container">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="scrapbook-sticker scrapbook-sticker-teal">Feedback System</span>
            <span className="font-mono text-[11px]" style={{ color: 'var(--color-text3)' }}>Est. 2024</span>
          </div>
          <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>
            Help us <span className="italic" style={{ color: 'var(--brand)' }}>improve</span>
          </h1>
          <p className="font-sans text-sm mt-3 max-w-xl leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            Found a bug? Have a feature request? Or just want to share your thoughts on a recent event? We'd love to hear from you.
          </p>
        </div>
      </div>

      <div className="vsa-container" style={{ padding: '48px 0' }}>
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <div className="scrapbook-paper p-8 relative">
            <span className="scrapbook-pin" aria-hidden />
            <div className="mb-6">
              <h2 className="font-serif text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Submit Feedback</h2>
              <div className="mt-2 h-1 w-12 bg-[var(--brand)] opacity-30" />
            </div>
            <FeedbackForm defaultType={defaultType} defaultTitle={defaultTitle} />
          </div>

          <div className="space-y-8">
            <section className="scrapbook-paper p-6 rotate-1">
              <h3 className="font-serif text-lg font-bold mb-3" style={{ color: 'var(--color-text)' }}>Bug Reports</h3>
              <p className="font-sans text-[13px] leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                Please be as specific as possible. If you can, include the steps to reproduce the issue and what browser/device you're using.
              </p>
            </section>

            <section className="scrapbook-paper p-6 -rotate-1" style={{ background: 'var(--color-surface2)' }}>
              <h3 className="font-serif text-lg font-bold mb-3" style={{ color: 'var(--color-text)' }}>Feature Requests</h3>
              <p className="font-sans text-[13px] leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                Tell us about your idea! How would it help the VSA community? We're always looking for ways to make the site more useful.
              </p>
            </section>

            <section className="p-6">
              <h3 className="font-sans text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text3)' }}>Response Time</h3>
              <p className="font-sans text-[13px] leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                Our tech team reviews all feedback. While we can't respond to everything individually, we prioritize critical bugs and popular feature requests.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};
