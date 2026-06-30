'use client';
// src/app/(dashboard)/dashboard/reports/revenue/page.tsx

import { useState }  from 'react';
import { ArrowLeft, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';

import Button       from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/SkeletonTable';
import { useFetch } from '@/hooks/useFetch';
import { useAppSelector } from '@/hooks/store';
import type { RevenueReport, ReportBucket } from '@/types';

function defaultRange() {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };
}

const BUCKETS: { value: ReportBucket; label: string }[] = [
  { value: 'day',   label: 'Daily'   },
  { value: 'week',  label: 'Weekly'  },
  { value: 'month', label: 'Monthly' },
];

export default function RevenueReportPage() {
  const router = useRouter();
  const token  = useAppSelector(s => s.auth.token);
  const range  = defaultRange();

  const [from,       setFrom]       = useState(range.from);
  const [to,         setTo]         = useState(range.to);
  const [bucket,     setBucket]     = useState<ReportBucket>('day');
  const [exporting,  setExporting]  = useState(false);

  const { data, loading } = useFetch<{ report: RevenueReport }>(
    `/api/reports/revenue?from=${from}&to=${to}&bucket=${bucket}`,
    { deps: [from, to, bucket] }
  );

  const report  = data?.report;
  const summary = report?.summary;

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/reports/export', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ reportType: 'revenue', from, to }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `revenue-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  }

  const growth = summary?.growthPercent;
  const growthPositive = growth != null && growth >= 0;

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Reports
      </button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Revenue</h1>
          <p className="text-sm text-gray-500 mt-0.5">Booking + Billing + Order revenue combined.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport} loading={exporting}>
          <Download size={13} /> Export CSV
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="form-input text-sm" style={{ width: 140 }} />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="form-input text-sm" style={{ width: 140 }} />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {BUCKETS.map(b => (
            <button key={b.value} onClick={() => setBucket(b.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                bucket === b.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>{b.label}</button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Revenue',   value: summary.totalRevenue,    color: 'indigo' },
            { label: 'Booking Revenue', value: summary.bookingRevenue,  color: 'emerald' },
            { label: 'Billing Revenue', value: summary.billingRevenue,  color: 'blue' },
            { label: 'Order Revenue',   value: summary.orderRevenue,    color: 'amber' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">{c.label}</p>
              <p className="text-lg font-bold text-gray-900">₹{c.value.toLocaleString('en-IN')}</p>
              {c.label === 'Total Revenue' && growth != null && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${growthPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                  {growthPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {growthPositive ? '+' : ''}{growth}% vs prior period
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        {loading ? <Skeleton className="h-64" />
        : !report?.points?.length ? (
          <p className="text-sm text-gray-400 text-center py-16">No revenue data in this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={report.points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="bucketLabel" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => [`₹${value.toLocaleString('en-IN')}`, name]}
                labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="total"          stroke="#4f46e5" strokeWidth={2} dot={false} name="Total"   />
              <Line type="monotone" dataKey="bookingRevenue" stroke="#10b981" strokeWidth={1.5} dot={false} name="Booking" />
              <Line type="monotone" dataKey="billingRevenue" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Billing" />
              <Line type="monotone" dataKey="orderRevenue"   stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Orders"  />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
