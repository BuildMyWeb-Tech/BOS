'use client';
// src/app/(dashboard)/dashboard/bookings/page.tsx

import { useState }  from 'react';
import Link          from 'next/link';
import { CalendarDays, Plus, ChevronRight, LayoutGrid } from 'lucide-react';

import PageHeader    from '@/components/ui/PageHeader';
import Badge         from '@/components/ui/Badge';
import Button        from '@/components/ui/Button';
import SearchInput   from '@/components/ui/SearchInput';
import EmptyState    from '@/components/ui/EmptyState';
import SkeletonTable from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import type { BookingListItem, BookingStatus } from '@/types';

const STATUS_TABS = ['ALL', 'PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'] as const;

function statusVariant(s: BookingStatus) {
  return s === 'CONFIRMED'      ? 'success'
       : s === 'COMPLETED'      ? 'info'
       : s === 'CANCELLED'      ? 'danger'
       : s === 'PENDING_PAYMENT'? 'warning'
       : 'neutral';
}

function statusLabel(s: BookingStatus) {
  return s === 'PENDING_PAYMENT' ? 'Pending' : s.charAt(0) + s.slice(1).toLowerCase();
}

export default function BookingsPage() {
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState<typeof STATUS_TABS[number]>('ALL');
  const [from,      setFrom]      = useState('');
  const [to,        setTo]        = useState('');

  const query = [
    status !== 'ALL' ? `status=${status}` : '',
    from ? `from=${from}` : '',
    to   ? `to=${to}`     : '',
  ].filter(Boolean).join('&');

  const { data, loading, error } = useFetch<{ bookings: BookingListItem[]; total: number }>(
    `/api/bookings${query ? `?${query}` : ''}`,
    { deps: [status, from, to] }
  );

  const bookings = data?.bookings ?? [];
  const filtered = search
    ? bookings.filter(b =>
        b.customerName.toLowerCase().includes(search.toLowerCase()) ||
        b.serviceNames.some(s => s.toLowerCase().includes(search.toLowerCase()))
      )
    : bookings;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Bookings"
        subtitle={`${data?.total ?? 0} total`}
        action={
          <div className="flex gap-2">
            <Link href="/dashboard/bookings/calendar">
              <Button variant="secondary" size="sm"><LayoutGrid size={14} /> Calendar view</Button>
            </Link>
            <Link href="/dashboard/bookings/new">
              <Button size="sm"><Plus size={14} /> New booking</Button>
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        {/* Status tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button key={tab} onClick={() => setStatus(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                status === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tab === 'ALL' ? 'All' : statusLabel(tab as BookingStatus)}
            </button>
          ))}
        </div>
        {/* Search + date range */}
        <div className="flex flex-wrap gap-3">
          <div className="w-full sm:max-w-xs">
            <SearchInput value={search} onChange={setSearch} placeholder="Search customer or service…" />
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

      {loading ? <SkeletonTable rows={6} columns={6} />
      : error   ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      : filtered.length === 0 ? (
        <EmptyState icon={<CalendarDays size={20} />} title="No bookings found"
          description="Create your first booking to get started."
          action={<Link href="/dashboard/bookings/new"><Button size="sm"><Plus size={13} /> New booking</Button></Link>} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Customer', 'Services', 'Date & Time', 'Staff', 'Amount', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 font-medium text-gray-900">{b.customerName}</td>
                    <td className="px-5 py-4 text-gray-600 max-w-[160px]">
                      <p className="truncate">{b.serviceNames.join(', ')}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-gray-800">{new Date(b.date + 'T00:00:00').toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                      <p className="text-xs text-gray-400">{b.startTime} – {b.endTime}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{b.staffName ?? '—'}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">₹{b.totalAmount.toLocaleString('en-IN')}</p>
                      {b.paidAmount < b.totalAmount && (
                        <p className="text-xs text-amber-600">₹{b.paidAmount} paid</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge label={statusLabel(b.status)} variant={statusVariant(b.status)} />
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/bookings/${b.id}`}
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
