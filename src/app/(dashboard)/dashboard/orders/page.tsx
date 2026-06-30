'use client';
// src/app/(dashboard)/dashboard/orders/page.tsx

import { useState } from 'react';
import Link         from 'next/link';
import { ShoppingBag, ChevronRight } from 'lucide-react';

import PageHeader    from '@/components/ui/PageHeader';
import Badge         from '@/components/ui/Badge';
import SearchInput   from '@/components/ui/SearchInput';
import EmptyState    from '@/components/ui/EmptyState';
import SkeletonTable from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import type { OrderListItem, OrderStatus } from '@/types';

const STATUS_TABS = ['ALL','ORDER_PLACED','PROCESSING','SHIPPED','DELIVERED','CANCELLED'] as const;

function orderStatusVariant(s: OrderStatus): 'warning'|'info'|'brand'|'success'|'danger'|'neutral' {
  return s === 'ORDER_PLACED' ? 'warning'
       : s === 'PROCESSING'   ? 'info'
       : s === 'SHIPPED'      ? 'brand'
       : s === 'DELIVERED'    ? 'success'
       : s === 'CANCELLED'    ? 'danger'
       : 'neutral';
}

function orderStatusLabel(s: OrderStatus): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

export default function OrdersPage() {
  const [status, setStatus] = useState<typeof STATUS_TABS[number]>('ALL');
  const [search, setSearch] = useState('');
  const [from,   setFrom]   = useState('');
  const [to,     setTo]     = useState('');

  const query = [
    status !== 'ALL' ? `status=${status}` : '',
    from ? `from=${from}` : '',
    to   ? `to=${to}`     : '',
  ].filter(Boolean).join('&');

  const { data, loading, error } = useFetch<{ orders: OrderListItem[]; total: number }>(
    `/api/orders${query ? `?${query}` : ''}`,
    { deps: [status, from, to] }
  );

  const orders   = data?.orders ?? [];
  const filtered = search
    ? orders.filter(o => o.customerName.toLowerCase().includes(search.toLowerCase()))
    : orders;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Orders" subtitle={`${data?.total ?? 0} total`} />

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button key={tab} onClick={() => setStatus(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                status === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tab === 'ALL' ? 'All' : orderStatusLabel(tab as OrderStatus)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="w-full sm:max-w-xs">
            <SearchInput value={search} onChange={setSearch} placeholder="Search customer…" />
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="form-input text-sm" style={{ width: 140 }} />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="form-input text-sm" style={{ width: 140 }} />
            {(from || to) && (
              <button onClick={() => { setFrom(''); setTo(''); }}
                className="text-xs text-gray-400 hover:text-gray-700 underline">Clear</button>
            )}
          </div>
        </div>
      </div>

      {loading ? <SkeletonTable rows={6} columns={5} />
      : error   ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      : filtered.length === 0 ? (
        <EmptyState icon={<ShoppingBag size={20} />} title="No orders found"
          description="Orders will appear here once customers place them." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Customer', 'Items', 'Total', 'Payment', 'Status', 'Date', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 font-medium text-gray-900">{o.customerName}</td>
                    <td className="px-5 py-4 text-gray-600">{o.itemCount} item{o.itemCount !== 1 ? 's' : ''}</td>
                    <td className="px-5 py-4 font-semibold text-gray-900">₹{o.total.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4">
                      <Badge label={o.isPaid ? 'Paid' : 'Unpaid'} variant={o.isPaid ? 'success' : 'warning'} />
                    </td>
                    <td className="px-5 py-4">
                      <Badge label={orderStatusLabel(o.status)} variant={orderStatusVariant(o.status)} />
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {new Date(o.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/orders/${o.id}`}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors inline-flex">
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
