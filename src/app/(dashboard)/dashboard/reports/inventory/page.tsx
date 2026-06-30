'use client';
// src/app/(dashboard)/dashboard/reports/inventory/page.tsx

import { useState }  from 'react';
import { ArrowLeft, Download, AlertTriangle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast         from 'react-hot-toast';

import Button       from '@/components/ui/Button';
import Badge        from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/SkeletonTable';
import { useFetch } from '@/hooks/useFetch';
import { useAppSelector } from '@/hooks/store';
import type { InventoryReport } from '@/types';

export default function InventoryReportPage() {
  const router = useRouter();
  const token  = useAppSelector(s => s.auth.token);
  const [deadStockDays, setDeadStockDays] = useState(90);
  const [exporting,     setExporting]     = useState(false);

  const { data, loading } = useFetch<{ report: InventoryReport }>(
    `/api/reports/inventory?deadStockDays=${deadStockDays}`,
    { deps: [deadStockDays] }
  );
  const report = data?.report;

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportType: 'inventory' }),
      });
      const blob = await res.blob();
      Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob), download: 'inventory-export.csv',
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
          <h1 className="text-xl font-bold text-gray-900">Inventory Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Stock valuation, alerts, and dead stock detection.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport} loading={exporting}>
          <Download size={13} /> Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : report && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs text-gray-400 mb-1">Total stock value</p>
            <p className="text-2xl font-bold text-gray-900">₹{report.totalStockValue.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-400 mt-1">At current MRP / variant price</p>
          </div>
          <div className={`bg-white rounded-xl border shadow-sm p-5 ${report.lowStockCount > 0 ? 'border-amber-200' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              {report.lowStockCount > 0 && <AlertTriangle size={14} className="text-amber-500" />}
              <p className="text-xs text-gray-400">Low stock products</p>
            </div>
            <p className={`text-2xl font-bold ${report.lowStockCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {report.lowStockCount}
            </p>
          </div>
          <div className={`bg-white rounded-xl border shadow-sm p-5 ${report.outOfStockCount > 0 ? 'border-red-200' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              {report.outOfStockCount > 0 && <XCircle size={14} className="text-red-500" />}
              <p className="text-xs text-gray-400">Out of stock products</p>
            </div>
            <p className={`text-2xl font-bold ${report.outOfStockCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {report.outOfStockCount}
            </p>
          </div>
        </div>
      )}

      {/* Dead stock section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Dead stock</h2>
            <p className="text-xs text-gray-400 mt-0.5">Products in stock with no sales in the last N days.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">No sale in</span>
            <select value={deadStockDays} onChange={e => setDeadStockDays(Number(e.target.value))}
              className="form-input text-xs py-1" style={{ width: 80 }}>
              {[30, 60, 90, 180, 365].map(d => (
                <option key={d} value={d}>{d} days</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? <Skeleton className="h-40" />
        : !report?.deadStock?.length ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No dead stock — all in-stock products have sold in the last {deadStockDays} days. 🎉
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Product', 'Quantity on hand', 'Last sale date', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {report.deadStock.map(item => (
                  <tr key={item.productId} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                    <td className="px-4 py-3 text-gray-600">{item.quantity} units</td>
                    <td className="px-4 py-3 text-gray-500">
                      {item.lastSaleDate
                        ? new Date(item.lastSaleDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                        : <span className="text-red-500 font-medium">Never sold</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={item.lastSaleDate ? `No sale ${deadStockDays}+ days` : 'Never sold'}
                        variant={item.lastSaleDate ? 'warning' : 'danger'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
