import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminNav } from './AdminNav';

const AdminLayout: React.FC = () => (
  <div className="flex" style={{ minHeight: 'calc(100vh - 58px)', background: 'var(--color-bg)' }}>
    <AdminNav />
    <div className="flex-1 flex flex-col overflow-hidden">
      <Outlet />
    </div>
  </div>
);

export default AdminLayout;
