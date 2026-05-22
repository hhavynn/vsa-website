import { PageTitle } from '../../components/common/PageTitle';
import FeedbackTab from '../../components/features/admin/FeedbackTab';

export default function AdminFeedback() {
  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Feedback" />

      <div className="border-b" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>Feedback</h1>
        <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text2)' }}>Bug reports, feature requests, and suggestions.</p>
      </div>

      <div style={{ padding: '24px 28px' }}>
        <FeedbackTab />
      </div>
    </div>
  );
}
