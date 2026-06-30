'use client';
// src/app/(dashboard)/dashboard/inventory/products/page.tsx

import { useState } from 'react';
import Link         from 'next/link';
import { Package, Plus, ChevronRight } from 'lucide-react';

import PageHeader    from '@/components/ui/PageHeader';
import Badge         from '@/components/ui/Badge';
import Button        from '@/components/ui/Button';
import SearchInput   from '@/components/ui/SearchInput';
import EmptyState    from '@/components/ui/EmptyState';
import SkeletonTable from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import type { ProductListItem, ProductCategoryItem, StockStatus } from '@/types';

const STOCK_FILTERS: { label: string; value: StockStatus | 'all' }[] = [
  { label: 'All',          value: 'all'          },
  { label: 'In stock',     value: 'in_stock'     },
  { label: 'Low stock',    value: 'low_stock'    },
  { label: 'Out of stock', value: 'out_of_stock' },
];

function stockVariant(s: StockStatus) {
  return s === 'in_stock' ? 'success' : s === 'low_stock' ? 'warning' : 'danger';
}
function stockLabel(s: StockStatus) {
  return s === 'in_stock' ? 'In stock' : s === 'low_stock' ? 'Low stock' : 'Out of stock';
}

export default function ProductListPage() {
  const [search,      setSearch]      = useState('');
  const [stockFilter, setStockFilter] = useState<StockStatus | 'all'>('all');
  const [catFilter,   setCatFilter]   = useState('');

  const { data: catData } = useFetch<{ categories: ProductCategoryItem[] }>('/api/products/categories');
  const categories = catData?.categories ?? [];

  const query = [
    stockFilter !== 'all' ? `stockStatus=${stockFilter}` : '',
    catFilter ? `categoryId=${catFilter}` : '',
  ].filter(Boolean).join('&');

  const { data, loading, error } = useFetch<{ products: ProductListItem[]; total: number }>(
    `/api/products?limit=100${query ? `&${query}` : ''}`,
    { deps: [stockFilter, catFilter] }
  );

  const products = data?.products ?? [];
  const filtered = search
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : products;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Products"
        subtitle={`${data?.total ?? 0} total products`}
        action={
          <Link href="/dashboard/inventory/products/new">
            <Button size="sm"><Plus size={14} /> Add product</Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-5">
        {/* Stock status tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {STOCK_FILTERS.map(f => (
            <button key={f.value} onClick={() => setStockFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                stockFilter === f.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>{f.label}</button>
          ))}
        </div>
        {/* Category filter */}
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="form-input text-sm" style={{ width: 160 }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {/* Search */}
        <div className="w-full sm:max-w-xs">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or SKU…" />
        </div>
      </div>

      {loading ? <SkeletonTable rows={6} columns={6} />
      : error   ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      : filtered.length === 0 ? (
        <EmptyState
          icon={<Package size={20} />}
          title="No products found"
          description="Try a different filter or add your first product."
          action={<Link href="/dashboard/inventory/products/new"><Button size="sm"><Plus size={13} /> Add product</Button></Link>}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Product', 'SKU', 'Category', 'MRP', 'Stock', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      {p.hasVariants && <p className="text-xs text-indigo-500 mt-0.5">Has variants</p>}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-400">{p.sku ?? '—'}</td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{p.categoryName ?? '—'}</td>
                    <td className="px-5 py-4 font-medium text-gray-900">₹{p.mrp.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-semibold ${
                        p.totalStock === 0 ? 'text-red-600' : p.totalStock <= p.lowStock ? 'text-amber-600' : 'text-gray-900'
                      }`}>{p.totalStock}</span>
                    </td>
                    <td className="px-5 py-4">
                      <Badge label={stockLabel(p.stockStatus)} variant={stockVariant(p.stockStatus)} />
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/inventory/products/${p.id}`}
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
