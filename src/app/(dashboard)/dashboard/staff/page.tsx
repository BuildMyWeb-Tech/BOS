'use client';
// src/app/(dashboard)/dashboard/staff/page.tsx

import { useState, useCallback } from 'react';
import Link  from 'next/link';
import toast from 'react-hot-toast';
import { UserCog, Plus, ChevronRight, UserCheck, UserX } from 'lucide-react';

import PageHeader    from '@/components/ui/PageHeader';
import Badge         from '@/components/ui/Badge';
import Button        from '@/components/ui/Button';
import SearchInput   from '@/components/ui/SearchInput';
import EmptyState    from '@/components/ui/EmptyState';
import SkeletonTable from '@/components/ui/SkeletonTable';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useFetch }  from '@/hooks/useFetch';
import { apiCall }   from '@/lib/apiClient';
import type { StaffListItem } from '@/types';

export default function StaffPage() {
  const [search,        setSearch]        = useState('');
  const [activeFilter,  setActiveFilter]  = useState<'all' | 'active' | 'inactive'>('all');
  const [deactivateTarget, setDeactivateTarget] = useState<StaffListItem | null>(null);
  const [deactivating,  setDeactivating]  = useState(false);

  const query = [
    search ? `search=${encodeURIComponent(search)}` : '',
    activeFilter === 'inactive' ? 'active=false' : '',
  ].filter(Boolean).join('&');

  const { data, loading, error, refetch } = useFetch<{ staff: StaffListItem[]; total: number }>(
    `/api/staff${query ? `?${query}` : ''}`,
    { deps: [search, activeFilter] }
  );

  const staff = data?.staff ?? [];

  const handleDeactivate = useCallback(async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await apiCall('PATCH', `/api/staff/${deactivateTarget.id}/deactivate`, {
        active: !deactivateTarget.isActive,
      });
      toast.success(`${deactivateTarget.name} ${deactivateTarget.isActive ? 'deactivated' : 'reactivated'}`);
      setDeactivateTarget(null);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setDeactivating(false);
    }
  }, [deactivateTarget, refetch]);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Staff"
        subtitle={`${data?.total ?? 0} team members`}
        action={
          <Link href="/dashboard/staff/new">
            <Button size="sm"><Plus size={14} /> Add staff</Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                activeFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>{f}</button>
          ))}
        </div>
        <div className="w-full sm:max-w-xs">
          <SearchInput value={search} onChange={setSearch} placeholder="Search staff…" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      ) : staff.length === 0 ? (
        <EmptyState
          icon={<UserCog size={20} />}
          title="No staff found"
          description="Add your first team member to get started."
          action={
            <Link href="/dashboard/staff/new">
              <Button size="sm"><Plus size={13} /> Add staff</Button>
            </Link>
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Name', 'Contact', 'Permissions', 'Bookings', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {staff.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Name + avatar */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-indigo-600">{s.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-400">Staff member</p>
                        </div>
                      </div>
                    </td>
                    {/* Contact */}
                    <td className="px-5 py-4">
                      <p className="text-gray-700">{s.email}</p>
                      {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                    </td>
                    {/* Permissions count */}
                    <td className="px-5 py-4">
                      <span className="text-gray-600">{s.permissions.length} permission{s.permissions.length !== 1 ? 's' : ''}</span>
                    </td>
                    {/* Booking count */}
                    <td className="px-5 py-4 text-gray-600">
                      {s.bookingCount ?? 0}
                    </td>
                    {/* Status */}
                    <td className="px-5 py-4">
                      <Badge label={s.isActive ? 'Active' : 'Inactive'} variant={s.isActive ? 'success' : 'neutral'} />
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDeactivateTarget(s)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          title={s.isActive ? 'Deactivate' : 'Reactivate'}
                        >
                          {s.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                        </button>
                        <Link href={`/dashboard/staff/${s.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                          <ChevronRight size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        loading={deactivating}
        title={deactivateTarget?.isActive ? 'Deactivate staff member' : 'Reactivate staff member'}
        description={
          deactivateTarget?.isActive
            ? `${deactivateTarget?.name} will lose access immediately. Their booking history is preserved.`
            : `${deactivateTarget?.name} will regain access to the system.`
        }
        confirmLabel={deactivateTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        variant={deactivateTarget?.isActive ? 'danger' : 'primary'}
      />
    </div>
  );
}
