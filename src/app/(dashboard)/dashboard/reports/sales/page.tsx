'use client';
// src/app/(dashboard)/dashboard/reports/sales/page.tsx

import { useState }  from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';

import Button       from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/SkeletonTable';
import { useFetch } from '@/hooks/useFetch';
import { useAppSelector } from '@/hooks/store';
import type { SalesSummaryReport } from '@/types';

function defaultRange() {
  const to = new Date(), from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) };
}

export default function SalesReportPage() {
  const router = useRouter();
  const token  = useAppSelector(s => s.auth.token);
  const range  = defaultRange();
  const [from, setFrom]       = useState(range.from);
  const [to,   setTo]         = useState(range.to);
  const [exporting, setExporting] = useState(false);

  const { data, loading } = useFetch<{ report: SalesSummaryReport }>(
    `/api/reports/sales-summary?from=${from}&to=${to}&limit=10`,
    { deps: [from, to] }
  );
  const report = data?.report;

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportType: 'sales-summary', from, to }),
      });
      const blob = await res.blob();
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob), download: `sales-${from}-to-${to}.csv`,
      });
      a.click();
      toast.success('CSV downloaded');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Reports
      </button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales Summary</h1>
          <p className="text-sm text-gray-500 mt-0.5">Top products, top services, transaction overview.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport} loading={exporting}>
          <Download size={13} /> Export CSV
        </Button>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-2 mb-5">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="form-input text-sm" style={{ width: 140 }} />
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="form-input text-sm" style={{ width: 140 }} />
      </div>

      {/* Summary stats */}
      {loading ? <div className="grid grid-cols-2 gap-3 mb-5"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div>
      : report && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">Total transactions</p>
            <p className="text-2xl font-bold text-gray-900">{report.totalTransactions.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">Avg. order value</p>
            <p className="text-2xl font-bold text-gray-900">₹{report.averageOrderValue.toLocaleString('en-IN')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top products */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top products by revenue</h2>
          {loading ? <Skeleton className="h-48" />
          : !report?.topProducts?.length ? <p className="text-xs text-gray-400">No product sales in this period.</p>
          : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={report.topProducts} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false}
                  tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90}
                  tickLine={false} axisLine={false}
                  tickFormatter={(v: string) => v.length > 12 ? v.slice(0,12)+'…' : v} />
                <Tooltip formatter={(v) => [`₹${Number(v ?? 0).toLocaleString('en-IN')}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top services */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top services by revenue</h2>
          {loading ? <Skeleton className="h-48" />
          : !report?.topServices?.length ? <p className="text-xs text-gray-400">No service bookings in this period.</p>
          : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={report.topServices} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false}
                  tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90}
                  tickLine={false} axisLine={false}
                  tickFormatter={(v: string) => v.length > 12 ? v.slice(0,12)+'…' : v} />
                <Tooltip formatter={(v) => [`₹${Number(v ?? 0).toLocaleString('en-IN')}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#10b981" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}