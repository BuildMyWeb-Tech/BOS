'use client';
// src/components/layout/DashboardShell.tsx
//
// The outer shell of the dashboard: sidebar + topbar + content area.
// Manages collapse + mobile open state.

import { useState } from 'react';
import Sidebar  from './Sidebar';
import TopBar   from './TopBar';

interface Props {
  children:  React.ReactNode;
  pageTitle?: string;
}

export default function DashboardShell({ children, pageTitle }: Props) {
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);

  return (
    <div className="dashboard-shell">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapse={() => setCollapsed(c => !c)}
        onMobileClose={() => setMobileOpen(false)}
      />

      <main className={`dashboard-main ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <TopBar
          onMenuClick={() => setMobileOpen(o => !o)}
          title={pageTitle}
        />
        <div className="flex-1 p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
