import { PageTitle } from '../../components/common/PageTitle';
import { AdminNav } from '../../components/features/admin/AdminNav';
import FeedbackTab from '../../components/features/admin/FeedbackTab';

export default function AdminFeedback() {
  return (
    <div className="py-6">
      <PageTitle title="Feedback Management" />
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Feedback</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage and respond to user feedback, bug reports, and feature requests.
          </p>
        </div>
        
        <div className="p-6">
          <FeedbackTab />
        </div>
      </div>
    </div>
  );
}
