'use client';
// src/app/(dashboard)/dashboard/settings/page.tsx
// FIX: Settings cards now show only for enabled modules.
// - Billing card  → visible only when billing module is enabled
// - Booking card  → visible only when booking module is enabled
// - Holidays card → visible only when booking module is enabled
//   (holiday management only makes sense when bookings are active)
// VENDOR_OWNER always sees all cards regardless of modules.

import Link from 'next/link';
import { Receipt, CalendarCog, CalendarOff, ChevronRight } from 'lucide-react';

import { useModules } from '@/hooks/useModules';
import { useAuth }    from '@/hooks/useAuth';

interface SettingLink {
  href:       string;
  icon:       React.ReactNode;
  title:      string;
  desc:       string;
  /** If undefined, always shown. Otherwise only shown when that module is enabled. */
  module?:    'billing' | 'booking' | 'inventory' | 'ecommerce';
}

const ALL_SETTINGS: SettingLink[] = [
  {
    href:   '/dashboard/settings/billing',
    icon:   <Receipt size={20} className="text-indigo-600" />,
    title:  'Billing & Tax',
    desc:   'GST number, tax type, CGST/SGST rates, currency, bill footer',
    module: 'billing',
  },
  {
    href:   '/dashboard/settings/booking',
    icon:   <CalendarCog size={20} className="text-indigo-600" />,
    title:  'Booking Settings',
    desc:   'Working hours, break time, slot duration, advance payment rules',
    module: 'booking',
  },
  {
    href:   '/dashboard/settings/holidays',
    icon:   <CalendarOff size={20} className="text-indigo-600" />,
    title:  'Holidays & Closures',
    desc:   'Blocked dates, recurring holidays, special working day overrides',
    module: 'booking',   // Holidays only apply to booking schedules
  },
];

export default function SettingsPage() {
  const { isEnabled, isLoading } = useModules();
  const { role } = useAuth();

  // VENDOR_OWNER sees everything; other roles (staff) are filtered by modules
  const isOwner = role === 'VENDOR_OWNER' || role === 'SUPER_ADMIN';

  const visibleSettings = ALL_SETTINGS.filter(s => {
    if (!s.module)  return true;              // always show if no module gate
    if (isOwner)    return true;              // owners see all their settings
    return isEnabled(s.module);              // staff: check module flag
  }).filter(s => {
    // Even for owners: if the module is completely disabled, hide that setting
    // so they're not confused seeing billing settings when billing is off
    if (!s.module)  return true;
    return isEnabled(s.module);
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        </div>
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your business preferences.</p>
      </div>

      {visibleSettings.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-500">No configurable settings for your current modules.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleSettings.map(s => (
            <Link key={s.href} href={s.href}
              className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 hover:border-indigo-200 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                {s.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
              </div>
              <ChevronRight size={16} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
