import { PageTitle } from '../../components/PageTitle';
import { AdminNav } from '../../components/Admin/AdminNav';
import FeedbackTab from '../../components/Admin/FeedbackTab';

export default function AdminFeedback() {
  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <PageTitle title="Feedback Management" />
      <AdminNav />
      
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
