'use client';
// src/app/(dashboard)/dashboard/customers/page.tsx
// Aggregates customer data from orders + bookings.
// No dedicated /api/customers endpoint exists yet — we derive the list
// from the orders list grouped by userId, then enrich with booking counts.

import { useState } from 'react';
import Link         from 'next/link';
import { Users, ChevronRight } from 'lucide-react';

import PageHeader    from '@/components/ui/PageHeader';
import SearchInput   from '@/components/ui/SearchInput';
import EmptyState    from '@/components/ui/EmptyState';
import SkeletonTable from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import type { OrderListItem, BookingListItem } from '@/types';

interface CustomerSummary {
  userId:      string;
  name:        string;
  orderCount:  number;
  totalSpend:  number;
  bookingCount: number;
  lastActivity: string;
}

function buildCustomerList(orders: OrderListItem[], bookings: BookingListItem[]): CustomerSummary[] {
  const map = new Map<string, CustomerSummary>();

  // Derive unique customers from orders (orders carry customerName)
  for (const o of orders) {
    const existing = map.get(o.customerName) ?? {
      userId:       o.id, // placeholder — no userId exposed in OrderListItem
      name:         o.customerName,
      orderCount:   0,
      totalSpend:   0,
      bookingCount: 0,
      lastActivity: o.createdAt,
    };
    existing.orderCount += 1;
    existing.totalSpend  = Math.round((existing.totalSpend + o.total) * 100) / 100;
    if (o.createdAt > existing.lastActivity) existing.lastActivity = o.createdAt;
    map.set(o.customerName, existing);
  }

  // Add booking customers
  for (const b of bookings) {
    const key      = b.customerName;
    const existing = map.get(key) ?? {
      userId: b.id, name: b.customerName, orderCount: 0, totalSpend: 0, bookingCount: 0, lastActivity: b.createdAt,
    };
    existing.bookingCount += 1;
    if (b.createdAt > existing.lastActivity) existing.lastActivity = b.createdAt;
    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');

  const { data: orderData,   loading: oLoad } = useFetch<{ orders: OrderListItem[];   total: number }>('/api/orders?limit=500');
  const { data: bookingData, loading: bLoad } = useFetch<{ bookings: BookingListItem[]; total: number }>('/api/bookings?limit=500');

  const loading   = oLoad || bLoad;
  const orders    = orderData?.orders   ?? [];
  const bookings  = bookingData?.bookings ?? [];
  const customers = buildCustomerList(orders, bookings);

  const filtered = search
    ? customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : customers;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} unique customers`}
      />

      <div className="flex gap-3 mb-5">
        <div className="w-full sm:max-w-xs">
          <SearchInput value={search} onChange={setSearch} placeholder="Search customers…" />
        </div>
      </div>

      {loading ? <SkeletonTable rows={6} columns={5} />
      : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={20} />}
          title="No customers yet"
          description="Customers will appear here once they place orders or make bookings."
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Customer', 'Orders', 'Bookings', 'Total spend', 'Last activity', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-indigo-600">
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{c.orderCount}</td>
                    <td className="px-5 py-4 text-gray-600">{c.bookingCount}</td>
                    <td className="px-5 py-4 font-medium text-gray-900">
                      {c.totalSpend > 0 ? `₹${c.totalSpend.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {new Date(c.lastActivity).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/customers/${encodeURIComponent(c.name)}`}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 inline-flex">
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
