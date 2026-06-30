'use client';
// src/app/(dashboard)/dashboard/reports/customers/page.tsx

import { useState }  from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

import Button       from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/SkeletonTable';
import { useFetch } from '@/hooks/useFetch';
import { useAppSelector } from '@/hooks/store';
import type { CustomerReport } from '@/types';

function defaultRange() {
  const to = new Date(), from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) };
}

export default function CustomersReportPage() {
  const router = useRouter();
  const token  = useAppSelector(s => s.auth.token);
  const range  = defaultRange();
  const [from, setFrom] = useState(range.from);
  const [to,   setTo]   = useState(range.to);
  const [exporting, setExporting] = useState(false);

  const { data, loading } = useFetch<{ report: CustomerReport }>(
    `/api/reports/customers?from=${from}&to=${to}`,
    { deps: [from, to] }
  );
  const report = data?.report;

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportType: 'customers', from, to }),
      });
      const blob = await res.blob();
      Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob), download: `customers-${from}-to-${to}.csv`,
      }).click();
      toast.success('CSV downloaded');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  }

  const pieData = report ? [
    { name: 'New',       value: report.newCustomers,       color: '#4f46e5' },
    { name: 'Returning', value: report.returningCustomers, color: '#10b981' },
  ] : [];

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Reports
      </button>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">New vs returning customers and top spenders.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport} loading={exporting}>
          <Download size={13} /> Export CSV
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="form-input text-sm" style={{ width: 140 }} />
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="form-input text-sm" style={{ width: 140 }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">New vs Returning</h2>
          {loading ? <Skeleton className="h-52" />
          : !report ? null
          : (report.newCustomers === 0 && report.returningCustomers === 0) ? (
            <p className="text-xs text-gray-400 text-center py-16">No customer activity in this period.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="text-center p-3 bg-indigo-50 rounded-xl">
                  <p className="text-2xl font-bold text-indigo-700">{report.newCustomers}</p>
                  <p className="text-xs text-indigo-500">New customers</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-xl">
                  <p className="text-2xl font-bold text-emerald-700">{report.returningCustomers}</p>
                  <p className="text-xs text-emerald-500">Returning</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Top customers */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top customers by spend</h2>
          {loading ? <Skeleton className="h-52" />
          : !report?.topCustomers?.length ? (
            <p className="text-xs text-gray-400">No customer spend data in this period.</p>
          ) : (
            <div className="space-y-3">
              {report.topCustomers.map((c, i) => (
                <div key={c.userId} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-indigo-600">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 truncate">{c.email} · {c.orderCount} orders</p>
                  </div>
                  <span className="text-sm font-bold text-indigo-600 flex-shrink-0">
                    ₹{c.totalSpend.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
