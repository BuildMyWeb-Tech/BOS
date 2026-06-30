'use client';
// src/app/(dashboard)/dashboard/settings/page.tsx

import Link from 'next/link';
import { Receipt, CalendarCog, CalendarOff, ChevronRight } from 'lucide-react';

const SETTINGS_LINKS = [
  {
    href:  '/dashboard/settings/billing',
    icon:  <Receipt size={20} className="text-indigo-600" />,
    title: 'Billing & Tax',
    desc:  'GST number, tax type, CGST/SGST rates, currency, bill footer',
  },
  {
    href:  '/dashboard/settings/booking',
    icon:  <CalendarCog size={20} className="text-indigo-600" />,
    title: 'Booking Settings',
    desc:  'Working hours, break time, slot duration, advance payment rules',
  },
  {
    href:  '/dashboard/settings/holidays',
    icon:  <CalendarOff size={20} className="text-indigo-600" />,
    title: 'Holidays & Closures',
    desc:  'Blocked dates, recurring holidays, special working day overrides',
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your business preferences.</p>
      </div>

      <div className="space-y-3">
        {SETTINGS_LINKS.map(s => (
          <Link key={s.href} href={s.href}
            className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 hover:border-indigo-200 hover:shadow-md transition-all group">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
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
    </div>
  );
}
