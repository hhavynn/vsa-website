import { PageTitle } from '../../components/PageTitle';
import { AdminNav } from '../../components/Admin/AdminNav';
import { ChatTest } from '../../components/Chat/ChatTest';

export default function AdminChat() {
  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <PageTitle title="Chat Assistant" />
      <AdminNav />
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Chat Assistant Test</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Test the AI chat assistant functionality. This tool can help answer questions about VSA events, 
          membership, and general information.
        </p>
        
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
          <ChatTest />
        </div>
      </div>
    </div>
  );
}
