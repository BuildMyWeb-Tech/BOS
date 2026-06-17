// src/app/(dashboard)/layout.tsx
//
// Layout for all /dashboard/* routes.
// Wraps children with AuthProvider (client) + DashboardShell.

import AuthProvider from '@/context/AuthProvider';
import DashboardShell from '@/components/layout/DashboardShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>
        {children}
      </DashboardShell>
    </AuthProvider>
  );
}
