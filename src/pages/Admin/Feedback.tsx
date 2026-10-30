import { PageTitle } from '../../components/common/PageTitle';
import FeedbackTab from '../../components/features/admin/FeedbackTab';

export default function AdminFeedback() {
  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Feedback" />

      <div className="vsa-admin-field vsa-ribbon-bottom border-[var(--color-border)] border-b px-5 py-6 sm:px-8 sm:py-7">
        <h1 className="font-display text-[2rem] font-normal leading-[1.05] tracking-[-0.02em] text-text-primary sm:text-[2.6rem]">Feedback</h1>
        <p className="mt-2 font-sans text-sm text-text-secondary">Bug reports, feature requests, and suggestions.</p>
      </div>

      <div className="px-5 py-6 sm:px-8">
        <FeedbackTab />
      </div>
    </div>
  );
}
