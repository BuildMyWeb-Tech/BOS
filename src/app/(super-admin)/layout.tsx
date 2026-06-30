// src/app/(super-admin)/layout.tsx
//
// Layout for all /super-admin/* routes.
// Wraps with AuthProvider + DashboardShell.
// The Sidebar auto-detects SUPER_ADMIN role and shows super-admin nav items.

import AuthProvider   from '@/context/AuthProvider';
import DashboardShell from '@/components/layout/DashboardShell';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>
        {children}
      </DashboardShell>
    </AuthProvider>
  );
}
