'use client';
// src/app/(dashboard)/dashboard/reports/page.tsx

import Link from 'next/link';
import { TrendingUp, ShoppingBag, Users, UserCog, Package, ChevronRight } from 'lucide-react';

const REPORT_LINKS = [
  { href: '/dashboard/reports/revenue',  icon: <TrendingUp size={20} className="text-indigo-600" />,  title: 'Revenue',          desc: 'Daily/weekly/monthly revenue by source with growth %'   },
  { href: '/dashboard/reports/sales',    icon: <ShoppingBag size={20} className="text-indigo-600" />, title: 'Sales Summary',    desc: 'Top products, top services, average transaction value'   },
  { href: '/dashboard/reports/customers',icon: <Users size={20} className="text-indigo-600" />,       title: 'Customers',        desc: 'New vs returning customers, top spenders'                },
  { href: '/dashboard/reports/staff',    icon: <UserCog size={20} className="text-indigo-600" />,     title: 'Staff Performance',desc: 'Bookings handled and revenue per staff member'           },
  { href: '/dashboard/reports/inventory',icon: <Package size={20} className="text-indigo-600" />,     title: 'Inventory',        desc: 'Stock valuation, low stock count, dead stock detection'  },
];

export default function ReportsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Insights across all your business modules.</p>
      </div>
      <div className="space-y-3">
        {REPORT_LINKS.map(r => (
          <Link key={r.href} href={r.href}
            className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 hover:border-indigo-200 hover:shadow-md transition-all group">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
              {r.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{r.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
