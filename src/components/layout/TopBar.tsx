'use client';
// src/components/layout/TopBar.tsx

import { Menu, Bell } from 'lucide-react';
import { useAuth }    from '@/hooks/useAuth';

interface TopBarProps {
  onMenuClick: () => void;
  title?:      string;
}

export default function TopBar({ onMenuClick, title }: TopBarProps) {
  const { user } = useAuth();

  return (
    <header className="h-14 border-b bg-white flex items-center gap-3 px-4 sticky top-0 z-30"
      style={{ borderColor: 'var(--color-border)' }}>

      {/* Mobile menu toggle */}
      <button
        onClick={onMenuClick}
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
      >
        <Menu size={20} />
      </button>

      {/* Title */}
      {title && (
        <h2 className="text-sm font-semibold text-gray-700 hidden md:block">{title}</h2>
      )}

      <div className="flex-1" />

      {/* Notification bell */}
      <button className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
        <Bell size={18} />
        {/* Future: show badge when unread notifications > 0 */}
      </button>

      {/* User avatar */}
      {user && (
        <div className="flex items-center gap-2.5 pl-2 border-l" style={{ borderColor: 'var(--color-border)' }}>
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-gray-800 leading-tight">{user.name}</p>
            <p className="text-xs text-gray-500 leading-tight">{user.role.replace('_', ' ')}</p>
          </div>
        </div>
      )}
    </header>
  );
}
