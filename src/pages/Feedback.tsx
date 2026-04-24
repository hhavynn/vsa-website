import React from 'react';
import { FeedbackForm } from '../components/features/feedback/FeedbackForm';
import { PageTitle } from '../components/common/PageTitle';

export const FeedbackPage: React.FC = () => {
  return (
    <>
      <PageTitle title="Feedback" />

      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '36px 52px 28px' }}>
        <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>Feedback</h1>
        <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>Help us improve the experience for everyone</p>
      </div>

      <div style={{ padding: '40px 52px' }}>
        <div style={{ maxWidth: 640 }}>
          <FeedbackForm />
        </div>
      </div>
    </>
  );
};
