import { PageTitle } from '../../components/common/PageTitle';
import FeedbackTab from '../../components/features/admin/FeedbackTab';

export default function AdminFeedback() {
  return (
    <div className="py-6">
      <PageTitle title="Feedback" />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Feedback</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Bug reports, feature requests, and suggestions.</p>
        </div>
      </div>

      <FeedbackTab />
    </div>
  );
}
