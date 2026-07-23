'use client';
// src/app/(dashboard)/dashboard/resources/page.tsx
// FIX: Deactivated resources were disappearing because the API defaults to
// isActive=true filter. Now passes includeInactive=true so all resources
// always show; deactivated ones show an Inactive badge and remain in table.

import { useState, useCallback } from 'react';
import Link  from 'next/link';
import toast from 'react-hot-toast';
import { Armchair, Plus, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';

import PageHeader    from '@/components/ui/PageHeader';
import Badge         from '@/components/ui/Badge';
import Button        from '@/components/ui/Button';
import SearchInput   from '@/components/ui/SearchInput';
import EmptyState    from '@/components/ui/EmptyState';
import SkeletonTable from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import { apiCall }   from '@/lib/apiClient';
import type { Resource } from '@/types';

const TYPE_LABELS: Record<string, string> = {
  court: 'Court', room: 'Room', table: 'Table', equipment: 'Equipment', other: 'Other',
};

export default function ResourcesPage() {
  const [search, setSearch] = useState('');

  // FIX: pass includeInactive=true so deactivated resources stay in the table
  const { data, loading, error, refetch } = useFetch<{ resources: Resource[]; total?: number }>(
    '/api/resources?includeInactive=true'
  );

  const resources = data?.resources ?? [];
  const total     = data?.total ?? resources.length;
  const filtered  = search
    ? resources.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : resources;

  const handleToggle = useCallback(async (resource: Resource) => {
    try {
      await apiCall('PATCH', `/api/resources/${resource.id}`, { isActive: !resource.isActive });
      toast.success(`${resource.name} ${resource.isActive ? 'deactivated' : 'activated'}`);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  }, [refetch]);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Resources"
        subtitle={`${total} resource${total !== 1 ? 's' : ''} — courts, rooms, tables, equipment`}
        action={
          <Link href="/dashboard/resources/new">
            <Button size="sm"><Plus size={14} /> Add resource</Button>
          </Link>
        }
      />

      <div className="flex gap-3 mb-5">
        <div className="w-full sm:max-w-xs">
          <SearchInput value={search} onChange={setSearch} placeholder="Search resources…" />
        </div>
      </div>

      {loading ? <SkeletonTable rows={4} columns={4} />
      : error   ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      : filtered.length === 0 ? (
        <EmptyState
          icon={<Armchair size={20} />}
          title="No resources yet"
          description="Add courts, rooms, or equipment that can be assigned to bookings."
          action={<Link href="/dashboard/resources/new"><Button size="sm"><Plus size={13} /> Add resource</Button></Link>}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Resource', 'Type', 'Description', 'Bookings', 'Status', ''].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(r => (
                <tr key={r.id}
                  className={`hover:bg-gray-50/50 transition-colors ${!r.isActive ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-4 font-medium text-gray-900">{r.name}</td>
                  <td className="px-5 py-4">
                    <Badge label={TYPE_LABELS[r.type] ?? r.type} variant="brand" />
                  </td>
                  <td className="px-5 py-4 text-gray-400 text-xs max-w-[200px]">
                    <span className="truncate block">{r.description ?? '—'}</span>
                  </td>
                  <td className="px-5 py-4 text-gray-500 text-sm">
                    {r.bookingCount ?? 0}
                  </td>
                  <td className="px-5 py-4">
                    {/* FIX: Toggle stays in table; badge flips between Active ↔ Inactive */}
                    <button onClick={() => handleToggle(r)} className="flex items-center gap-1.5 group">
                      {r.isActive
                        ? <ToggleRight size={20} className="text-emerald-500 group-hover:text-emerald-600" />
                        : <ToggleLeft  size={20} className="text-gray-300 group-hover:text-gray-400"   />
                      }
                      <Badge
                        label={r.isActive ? 'Active' : 'Inactive'}
                        variant={r.isActive ? 'success' : 'neutral'}
                      />
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <Link href={`/dashboard/resources/${r.id}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 inline-flex">
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
