'use client';
// src/app/(dashboard)/dashboard/reports/staff/page.tsx

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
import type { StaffPerformanceReport } from '@/types';

function defaultRange() {
  const to = new Date(), from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) };
}

export default function StaffReportPage() {
  const router = useRouter();
  const token  = useAppSelector(s => s.auth.token);
  const range  = defaultRange();
  const [from, setFrom] = useState(range.from);
  const [to,   setTo]   = useState(range.to);
  const [exporting, setExporting] = useState(false);

  const { data, loading } = useFetch<{ report: StaffPerformanceReport }>(
    `/api/reports/staff-performance?from=${from}&to=${to}`,
    { deps: [from, to] }
  );
  const report = data?.report;

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportType: 'staff-performance', from, to }),
      });
      const blob = await res.blob();
      Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob), download: `staff-${from}-to-${to}.csv`,
      }).click();
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
          <h1 className="text-xl font-bold text-gray-900">Staff Performance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Revenue and bookings handled per staff member.</p>
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

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Revenue by staff member</h2>
        {loading ? <Skeleton className="h-56" />
        : !report?.staff?.length ? (
          <p className="text-xs text-gray-400 text-center py-16">No booking data in this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={report.staff} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false}
                tickFormatter={(v: string) => v.split(' ')[0]} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#4f46e5" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Table */}
      {!loading && !!report?.staff?.length && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Staff member', 'Total bookings', 'Completed', 'Completion rate', 'Revenue'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {report.staff.map(s => {
                const rate = s.bookingCount > 0 ? Math.round((s.completedCount / s.bookingCount) * 100) : 0;
                return (
                  <tr key={s.staffId} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-5 py-3 text-gray-600">{s.bookingCount}</td>
                    <td className="px-5 py-3 text-gray-600">{s.completedCount}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5" style={{ maxWidth: 80 }}>
                          <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{rate}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-semibold text-indigo-600">₹{s.revenue.toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
