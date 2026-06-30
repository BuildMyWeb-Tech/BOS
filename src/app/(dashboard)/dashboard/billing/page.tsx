'use client';
// src/app/(dashboard)/dashboard/billing/page.tsx

import { useState } from 'react';
import Link         from 'next/link';
import { Receipt, Plus, ChevronRight, ShoppingCart } from 'lucide-react';

import PageHeader    from '@/components/ui/PageHeader';
import Badge         from '@/components/ui/Badge';
import Button        from '@/components/ui/Button';
import SearchInput   from '@/components/ui/SearchInput';
import EmptyState    from '@/components/ui/EmptyState';
import SkeletonTable from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import type { BillListItem } from '@/types';

const MODE_LABELS: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', CARD: 'Card', SPLIT: 'Split'
};

export default function BillingPage() {
  const [search, setSearch] = useState('');
  const [from,   setFrom]   = useState('');
  const [to,     setTo]     = useState('');

  const query = [from ? `from=${from}` : '', to ? `to=${to}` : ''].filter(Boolean).join('&');
  const { data, loading, error } = useFetch<{ bills: BillListItem[]; total: number }>(
    `/api/bills${query ? `?${query}` : ''}`,
    { deps: [from, to] }
  );

  const bills = data?.bills ?? [];
  const filtered = search
    ? bills.filter(b => b.billNumber.toLowerCase().includes(search.toLowerCase()))
    : bills;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Billing"
        subtitle={`${data?.total ?? 0} bills`}
        action={
          <Link href="/dashboard/billing/pos">
            <Button size="sm"><ShoppingCart size={14} /> Open POS</Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="w-full sm:max-w-xs">
          <SearchInput value={search} onChange={setSearch} placeholder="Search bill number…" />
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

      {loading ? <SkeletonTable rows={6} columns={5} />
      : error   ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      : filtered.length === 0 ? (
        <EmptyState icon={<Receipt size={20} />} title="No bills found"
          description="Open the POS to create your first bill."
          action={<Link href="/dashboard/billing/pos"><Button size="sm"><ShoppingCart size={13} /> Open POS</Button></Link>} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Bill #', 'Date', 'Items', 'Payment', 'Total', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-gray-700">{b.billNumber}</td>
                    <td className="px-5 py-4 text-gray-600">
                      {new Date(b.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-5 py-4 text-gray-600">{b.itemCount} item{b.itemCount !== 1 ? 's' : ''}</td>
                    <td className="px-5 py-4">
                      <Badge label={MODE_LABELS[b.paymentMode] ?? b.paymentMode} variant="neutral" />
                    </td>
                    <td className="px-5 py-4 font-semibold text-gray-900">₹{b.total.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/billing/${b.id}`}
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
