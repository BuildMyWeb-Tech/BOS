'use client';
// src/app/(dashboard)/dashboard/staff/page.tsx
// FIX: API returns { items: [], pagination: {} } — was reading data?.staff (undefined).
// Now reads data?.items with fallback to data?.staff.

import { useState, useCallback } from 'react';
import Link  from 'next/link';
import toast from 'react-hot-toast';
import { Users, Plus, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';

import PageHeader    from '@/components/ui/PageHeader';
import Badge         from '@/components/ui/Badge';
import Button        from '@/components/ui/Button';
import SearchInput   from '@/components/ui/SearchInput';
import EmptyState    from '@/components/ui/EmptyState';
import SkeletonTable from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import { apiCall }   from '@/lib/apiClient';
import type { StaffListItem } from '@/types';

export default function StaffPage() {
  const [search, setSearch] = useState('');

  // FIX: use any to handle both { items, pagination } and { staff, total } shapes
  const { data, loading, error, refetch } = useFetch<any>('/api/staff');

  const staffList: StaffListItem[] = data?.items ?? data?.staff ?? [];
  const total: number = data?.pagination?.total ?? data?.total ?? staffList.length;

  const filtered = search
    ? staffList.filter((s: StaffListItem) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
      )
    : staffList;

  const handleDeactivate = useCallback(async (staff: StaffListItem) => {
    try {
      await apiCall('PATCH', `/api/staff/${staff.id}/deactivate`, {
        isActive: !staff.isActive,
      });
      toast.success(`${staff.name} ${staff.isActive ? 'deactivated' : 'activated'}`);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  }, [refetch]);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Staff"
        subtitle={`${total} team member${total !== 1 ? 's' : ''}`}
        action={
          <Link href="/dashboard/staff/new">
            <Button size="sm"><Plus size={14} /> Add staff</Button>
          </Link>
        }
      />

      <div className="flex gap-3 mb-5">
        <div className="w-full sm:max-w-xs">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email…" />
        </div>
      </div>

      {loading ? <SkeletonTable rows={5} columns={5} />
      : error   ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={20} />}
          title="No staff members yet"
          description="Add your first team member to start managing bookings."
          action={<Link href="/dashboard/staff/new"><Button size="sm"><Plus size={13} /> Add staff</Button></Link>}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Name', 'Email', 'Phone', 'Role', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s: StaffListItem) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-indigo-600">
                            {s.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{s.email}</td>
                    <td className="px-5 py-4 text-gray-600">{s.phone ?? '—'}</td>
                    <td className="px-5 py-4">
                      <Badge label={s.role ?? 'Staff'} variant="brand" />
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => handleDeactivate(s)} className="flex items-center gap-1.5 group">
                        {s.isActive
                          ? <ToggleRight size={20} className="text-emerald-500 group-hover:text-emerald-600 transition-colors" />
                          : <ToggleLeft  size={20} className="text-gray-300 group-hover:text-gray-400 transition-colors"   />
                        }
                        <Badge label={s.isActive ? 'Active' : 'Inactive'} variant={s.isActive ? 'success' : 'neutral'} />
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/staff/${s.id}`}
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
