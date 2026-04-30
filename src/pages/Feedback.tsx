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

      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '36px 52px 28px' }}>
        <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>Feedback</h1>
        <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>Help us improve the experience for everyone</p>
      </div>

      <div style={{ padding: '40px 52px' }}>
        <div style={{ maxWidth: 640 }}>
          <FeedbackForm defaultType={defaultType} defaultTitle={defaultTitle} />
        </div>
      </div>
    </>
  );
};
