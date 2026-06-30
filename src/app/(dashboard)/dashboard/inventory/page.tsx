'use client';
// src/app/(dashboard)/dashboard/inventory/page.tsx

import Link        from 'next/link';
import { Package, AlertTriangle, XCircle, Plus, ArrowRight } from 'lucide-react';

import PageHeader  from '@/components/ui/PageHeader';
import Button      from '@/components/ui/Button';
import Badge       from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/SkeletonTable';
import { useFetch } from '@/hooks/useFetch';
import type { InventoryListItem } from '@/types';

export default function InventoryPage() {
  const { data, loading } = useFetch<{ inventory: InventoryListItem[]; total: number }>('/api/inventory');
  const items = data?.inventory ?? [];

  const lowStock  = items.filter(i => i.stockStatus === 'low_stock');
  const outOfStock = items.filter(i => i.stockStatus === 'out_of_stock');
  const inStock    = items.filter(i => i.stockStatus === 'in_stock');

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Inventory"
        subtitle="Monitor stock levels across all products."
        action={
          <Link href="/dashboard/inventory/products/new">
            <Button size="sm"><Plus size={14} /> Add product</Button>
          </Link>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'In stock',    count: inStock.length,    icon: <Package size={18} className="text-emerald-600" />, color: 'emerald' },
          { label: 'Low stock',   count: lowStock.length,   icon: <AlertTriangle size={18} className="text-amber-600" />, color: 'amber'  },
          { label: 'Out of stock',count: outOfStock.length, icon: <XCircle size={18} className="text-red-600" />,    color: 'red'    },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl bg-${c.color}-50 flex items-center justify-center flex-shrink-0`}>
              {c.icon}
            </div>
            <div>
              {loading ? <div className="h-6 w-8 bg-gray-200 rounded animate-pulse mb-1" />
                : <p className="text-2xl font-bold text-gray-900">{c.count}</p>}
              <p className="text-xs text-gray-500">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {!loading && (lowStock.length > 0 || outOfStock.length > 0) && (
        <div className="space-y-3 mb-6">
          {outOfStock.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-red-800 flex items-center gap-1.5">
                  <XCircle size={14} /> {outOfStock.length} product{outOfStock.length !== 1 ? 's' : ''} out of stock
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {outOfStock.map(i => (
                  <Link key={i.productId} href={`/dashboard/inventory/products/${i.productId}`}
                    className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                    {i.productName}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
                <AlertTriangle size={14} /> {lowStock.length} product{lowStock.length !== 1 ? 's' : ''} running low
              </h3>
              <div className="flex flex-wrap gap-2">
                {lowStock.map(i => (
                  <Link key={i.productId} href={`/dashboard/inventory/products/${i.productId}`}
                    className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors">
                    {i.productName} ({i.quantity} left)
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* All products table */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">All products ({items.length})</h2>
        <Link href="/dashboard/inventory/products" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
          View all <ArrowRight size={12} />
        </Link>
      </div>

      {loading ? <Skeleton className="h-48 rounded-xl" />
      : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Product', 'SKU', 'Quantity', 'Low-stock threshold', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.slice(0, 20).map(i => (
                  <tr key={i.productId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/inventory/products/${i.productId}`}
                        className="font-medium text-gray-900 hover:text-indigo-600 transition-colors">
                        {i.productName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{i.sku ?? '—'}</td>
                    <td className="px-5 py-3 font-semibold text-gray-900">{i.quantity}</td>
                    <td className="px-5 py-3 text-gray-500">{i.lowStock}</td>
                    <td className="px-5 py-3">
                      <Badge
                        label={i.stockStatus === 'in_stock' ? 'In stock' : i.stockStatus === 'low_stock' ? 'Low stock' : 'Out of stock'}
                        variant={i.stockStatus === 'in_stock' ? 'success' : i.stockStatus === 'low_stock' ? 'warning' : 'danger'}
                      />
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
