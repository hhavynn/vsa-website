import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminNav } from './AdminNav';

/**
 * Shell for all /admin/* pages.
 * Renders AdminNav once in a stable container, then the page via <Outlet />.
 */
const AdminLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b]">
      <div className="max-w-7xl mx-auto px-8 pt-8 pb-12">
        <AdminNav />
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
