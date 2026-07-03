'use client';
// src/components/layout/DashboardShell.tsx
//
// HYDRATION FIX:
// Previously returned a loading div when !isHydrated, which caused:
//   Server: isHydrated=false → renders <div className="min-h-screen..."> (loading)
//   Client: isHydrated=true  → renders <div className="dashboard-shell"> (shell)
//   Result: HTML mismatch → hydration error
//
// Fix: use a mounted state that starts false on both server and client.
// Both server and client render the same "shell skeleton" initially.
// After mount (client-only), if not hydrated we show a spinner INSIDE the shell.
// This keeps server/client HTML identical on first render.

import { useState, useEffect } from 'react';
import { useRouter }           from 'next/navigation';
import Sidebar                 from '@/components/layout/Sidebar';
import { useAuth }             from '@/hooks/useAuth';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const router               = useRouter();
  const { isHydrated, isLoggedIn, role } = useAuth();

  // mounted = false on server AND first client render → HTML always matches
  const [mounted,   setMounted]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen,setMobileOpen]= useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Auth redirect — only after hydration is complete
  useEffect(() => {
    if (!mounted || !isHydrated) return;
    if (!isLoggedIn) {
      router.replace('/login');
    }
  }, [mounted, isHydrated, isLoggedIn, router]);

  // PHASE 1: Not mounted yet (SSR + first client paint)
  // Render the shell skeleton so server and client HTML match exactly.
  if (!mounted) {
    return (
      <div className="dashboard-shell">
        <aside className="sidebar" />
        <div className="dashboard-main">
          <main className="dashboard-content" />
        </div>
      </div>
    );
  }

  // PHASE 2: Mounted, but auth not yet hydrated from localStorage.
  // Render shell with spinner inside — same root structure as phase 1.
  if (!isHydrated) {
    return (
      <div className="dashboard-shell">
        <aside className="sidebar" />
        <div className="dashboard-main">
          <main className="dashboard-content flex items-center justify-center">
            <div className="animate-spin w-6 h-6 rounded-full border-2 border-indigo-600 border-t-transparent" />
          </main>
        </div>
      </div>
    );
  }

  // PHASE 3: Hydrated and logged in — render the full dashboard.
  // (If not logged in, useEffect above will redirect to /login on next tick.)
  return (
    <div className="dashboard-shell">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapse={() => setCollapsed(c => !c)}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="dashboard-main">
        <main className="dashboard-content">
          {children}
        </main>
      </div>
    </div>
  );
}
