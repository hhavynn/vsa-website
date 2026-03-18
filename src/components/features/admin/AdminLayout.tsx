import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminNav } from './AdminNav';

/**
 * Shared layout for all /admin/* pages.
 * AdminNav is rendered HERE — once, in a stable container — so it never
 * shifts position as the user navigates between tabs.
 */
const AdminLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b]">
      {/* Fixed-width nav bar — identical width/padding on every page */}
      <div className="max-w-7xl mx-auto px-8 pt-8">
        <AdminNav />
      </div>

      {/* Page content rendered below the stable nav */}
      <div className="max-w-7xl mx-auto px-8 pb-12">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
