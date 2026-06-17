'use client';
// src/components/layout/Sidebar.tsx

import { useState, useCallback } from 'react';
import Link       from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Calendar, Package, Receipt, ShoppingBag,
  Users, BarChart2, Settings, ChevronLeft, LogOut,
  UserCog, Store, Bell, Menu,
} from 'lucide-react';
import { useAuth }        from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useModules }     from '@/hooks/useModules';
import type { NavItem }   from '@/types';

// ─── Nav definition ───────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href:  '/dashboard',
    icon:  'dashboard',
    // Always visible
  },
  {
    label:   'Bookings',
    href:    '/dashboard/bookings',
    icon:    'calendar',
    module:  'booking',
    permissions: ['booking.view'],
  },
  {
    label:   'Customers',
    href:    '/dashboard/customers',
    icon:    'users',
    permissions: ['customer.view'],
  },
  {
    label:   'Products',
    href:    '/dashboard/products',
    icon:    'package',
    module:  'inventory',
    permissions: ['product.view'],
  },
  {
    label:   'Inventory',
    href:    '/dashboard/inventory',
    icon:    'package',
    module:  'inventory',
    permissions: ['inventory.view'],
  },
  {
    label:   'Billing / POS',
    href:    '/dashboard/billing',
    icon:    'receipt',
    module:  'billing',
    permissions: ['billing.view'],
  },
  {
    label:   'Orders',
    href:    '/dashboard/orders',
    icon:    'shopping',
    module:  'ecommerce',
    permissions: ['orders.view'],
  },
  {
    label:   'Reports',
    href:    '/dashboard/reports',
    icon:    'chart',
    permissions: ['report.view'],
  },
  {
    label:   'Staff',
    href:    '/dashboard/staff',
    icon:    'usercog',
    permissions: ['staff.view'],
  },
  {
    label:   'Settings',
    href:    '/dashboard/settings',
    icon:    'settings',
    permissions: ['settings.view'],
  },
];

const SUPER_ADMIN_ITEMS: NavItem[] = [
  { label: 'Overview',  href: '/super-admin',         icon: 'dashboard' },
  { label: 'Vendors',   href: '/super-admin/vendors',  icon: 'store'     },
  { label: 'Settings',  href: '/super-admin/settings', icon: 'settings'  },
];

// ─── Icon map ─────────────────────────────────────────────────────

function NavIcon({ name, className }: { name: string; className?: string }) {
  const cls = `nav-icon ${className ?? ''}`;
  switch (name) {
    case 'dashboard': return <LayoutDashboard className={cls} />;
    case 'calendar':  return <Calendar        className={cls} />;
    case 'package':   return <Package         className={cls} />;
    case 'receipt':   return <Receipt         className={cls} />;
    case 'shopping':  return <ShoppingBag     className={cls} />;
    case 'users':     return <Users           className={cls} />;
    case 'chart':     return <BarChart2       className={cls} />;
    case 'settings':  return <Settings        className={cls} />;
    case 'usercog':   return <UserCog         className={cls} />;
    case 'store':     return <Store           className={cls} />;
    default:          return <LayoutDashboard className={cls} />;
  }
}

// ─── Sidebar component ────────────────────────────────────────────

interface SidebarProps {
  collapsed:     boolean;
  mobileOpen:    boolean;
  onCollapse:    () => void;
  onMobileClose: () => void;
}

export default function Sidebar({ collapsed, mobileOpen, onCollapse, onMobileClose }: SidebarProps) {
  const pathname         = usePathname();
  const { user, logout } = useAuth();
  const { can, canAny }  = usePermissions();
  const { isEnabled }    = useModules();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Filter nav items by module + permission
  const visibleItems = (isSuperAdmin ? SUPER_ADMIN_ITEMS : NAV_ITEMS).filter(item => {
    if (item.module && !isEnabled(item.module)) return false;
    if (item.permissions?.length && !canAny(item.permissions)) return false;
    if (item.roles?.length && !item.roles.includes(user?.role!)) return false;
    return true;
  });

  const isActive = useCallback(
    (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href)),
    [pathname]
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} />
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>

        {/* Logo + collapse toggle */}
        <div className="flex items-center justify-between px-4 py-5 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">B</span>
              </div>
              <span className="text-white font-semibold text-sm tracking-wide">BOS</span>
            </div>
          )}
          {collapsed && (
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-xs">B</span>
            </div>
          )}
          <button
            onClick={onCollapse}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-md hover:bg-white/10 transition-colors text-indigo-300"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              size={16}
              className="transition-transform duration-300"
              style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onMobileClose()}
              className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <NavIcon name={item.icon} />
              <span className="nav-label">{item.label}</span>
              {item.badge ? (
                <span className="ml-auto bg-indigo-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 pb-4 border-t pt-3 space-y-1" style={{ borderColor: 'var(--sidebar-border)' }}>
          <button
            onClick={logout}
            className="nav-item w-full"
            title={collapsed ? 'Logout' : undefined}
          >
            <LogOut size={18} className="nav-icon flex-shrink-0" />
            <span className="nav-label">Logout</span>
          </button>
          {!collapsed && user && (
            <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user.name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--sidebar-text)' }}>
                  {user.role.replace('_', ' ')}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
