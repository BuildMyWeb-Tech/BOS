'use client';
// src/app/(dashboard)/dashboard/services/page.tsx
// Fixed: shows resource name column in table; active toggle works.

import { useState, useCallback } from 'react';
import Link  from 'next/link';
import toast from 'react-hot-toast';
import { Scissors, Plus, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';

import PageHeader    from '@/components/ui/PageHeader';
import Badge         from '@/components/ui/Badge';
import Button        from '@/components/ui/Button';
import SearchInput   from '@/components/ui/SearchInput';
import EmptyState    from '@/components/ui/EmptyState';
import SkeletonTable from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import { apiCall }   from '@/lib/apiClient';
import type { Service } from '@/types';

export default function ServicesPage() {
  const [search, setSearch] = useState('');

  const { data, loading, error, refetch } = useFetch<{ services: Service[]; total: number }>(
    '/api/services?limit=100'
  );

  // FIX: API returns items[] (paginated). Support both shapes.
  const services = (data as any)?.items ?? data?.services ?? [];
  const total    = (data as any)?.pagination?.total ?? data?.total ?? 0;

  const filtered = search
    ? services.filter((s: Service) => s.name.toLowerCase().includes(search.toLowerCase()))
    : services;

  const handleToggle = useCallback(async (service: Service) => {
    try {
      await apiCall('PATCH', `/api/services/${service.id}`, { isActive: !service.isActive });
      toast.success(`${service.name} ${service.isActive ? 'deactivated' : 'activated'}`);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  }, [refetch]);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Services"
        subtitle={`${total} services`}
        action={
          <Link href="/dashboard/services/new">
            <Button size="sm"><Plus size={14} /> Add service</Button>
          </Link>
        }
      />

      <div className="flex gap-3 mb-5">
        <div className="w-full sm:max-w-xs">
          <SearchInput value={search} onChange={setSearch} placeholder="Search services…" />
        </div>
      </div>

      {loading ? <SkeletonTable rows={5} columns={6} />
      : error   ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      : filtered.length === 0 ? (
        <EmptyState
          icon={<Scissors size={20} />}
          title="No services yet"
          description="Add your first service so customers can book appointments."
          action={<Link href="/dashboard/services/new"><Button size="sm"><Plus size={13} /> Add service</Button></Link>}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Service', 'Category', 'Resource', 'Duration', 'Price', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s: Service) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{s.name}</p>
                      {s.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{s.description}</p>}
                    </td>
                    {/* Category */}
                    <td className="px-5 py-4 text-gray-600">
                      {(s as any).category?.name ?? s.categoryName ?? <span className="text-gray-300">—</span>}
                    </td>
                    {/* FIX — Resource column */}
                    <td className="px-5 py-4">
                      {(s as any).resource ? (
                        <Badge label={(s as any).resource.name} variant="brand" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-600">{s.duration} min</td>
                    <td className="px-5 py-4 font-medium text-gray-900">₹{s.price.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4">
                      <button onClick={() => handleToggle(s)} className="flex items-center gap-1.5 group">
                        {s.isActive
                          ? <ToggleRight size={20} className="text-emerald-500 group-hover:text-emerald-600 transition-colors" />
                          : <ToggleLeft  size={20} className="text-gray-300 group-hover:text-gray-400 transition-colors"   />
                        }
                        <Badge label={s.isActive ? 'Active' : 'Inactive'} variant={s.isActive ? 'success' : 'neutral'} />
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/services/${s.id}`}
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
