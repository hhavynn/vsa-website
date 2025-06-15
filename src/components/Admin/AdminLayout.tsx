import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import FeedbackTab from './FeedbackTab';

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('events');

  const tabs = [
    { id: 'events', label: 'Events', path: '/admin/events' },
    { id: 'feedback', label: 'Feedback', path: '/admin/feedback' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex space-x-4 mb-6">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to={tab.path}
            className={`px-4 py-2 rounded-md ${
              location.pathname === tab.path
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {activeTab === 'feedback' ? <FeedbackTab /> : <Outlet />}
      {activeTab === 'events' && <FeedbackTab />}
    </div>
  );
};

export default AdminLayout; 