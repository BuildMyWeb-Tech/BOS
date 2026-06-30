'use client';
// src/app/(super-admin)/super-admin/vendors/page.tsx
//
// Lists all vendors with status filter tabs and approve/reject quick-actions.
// Full approve/reject flow also available from the detail page.

import { useState, useCallback } from 'react';
import Link         from 'next/link';
import toast        from 'react-hot-toast';
import { Store, Search, ChevronRight, CheckCircle, XCircle } from 'lucide-react';

import PageHeader   from '@/components/ui/PageHeader';
import Badge        from '@/components/ui/Badge';
import Button       from '@/components/ui/Button';
import EmptyState   from '@/components/ui/EmptyState';
import SkeletonTable from '@/components/ui/SkeletonTable';
import Modal        from '@/components/ui/Modal';
import { useFetch } from '@/hooks/useFetch';
import { useAppSelector } from '@/hooks/store';
import type { VendorListItem, TenantStatus } from '@/types';

// ─── Status tabs ─────────────────────────────────────────────────

const TABS: { label: string; value: TenantStatus | 'ALL' }[] = [
  { label: 'All',       value: 'ALL'      },
  { label: 'Pending',   value: 'PENDING'  },
  { label: 'Approved',  value: 'APPROVED' },
  { label: 'Rejected',  value: 'REJECTED' },
  { label: 'Suspended', value: 'SUSPENDED'},
];

function statusVariant(status: TenantStatus): 'warning' | 'success' | 'danger' | 'neutral' {
  return status === 'PENDING' ? 'warning'
       : status === 'APPROVED' ? 'success'
       : status === 'REJECTED' ? 'danger'
       : 'neutral';
}

// ─── Reject dialog ────────────────────────────────────────────────

interface RejectDialogProps {
  vendor:  VendorListItem | null;
  onClose: () => void;
  onDone:  () => void;
}

function RejectDialog({ vendor, onClose, onDone }: RejectDialogProps) {
  const token  = useAppSelector(s => s.auth.token);
  const [reason, setReason]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReject() {
    if (!vendor || reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/vendors/${vendor.id}/reject`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(`${vendor.name} rejected`);
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject vendor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={!!vendor} onClose={onClose} title="Reject vendor registration" maxWidth="sm">
      <p className="text-sm text-gray-600 mb-3">
        Rejecting <span className="font-semibold">{vendor?.name}</span>. Provide a reason that will be visible to the applicant.
      </p>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="e.g. Incomplete business documents. Please reapply with valid GST certificate."
        rows={4}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
      />
      <p className="text-xs text-gray-400 mt-1 mb-4">Minimum 10 characters</p>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="danger"    size="sm" onClick={handleReject} loading={loading}>
          Reject vendor
        </Button>
      </div>
    </Modal>
  );
}

// ─── Main page ────────────────────────────────────────────────────

export default function VendorsPage() {
  const token = useAppSelector(s => s.auth.token);
  const [activeTab,    setActiveTab]    = useState<TenantStatus | 'ALL'>('ALL');
  const [search,       setSearch]       = useState('');
  const [rejectTarget, setRejectTarget] = useState<VendorListItem | null>(null);
  const [approvingId,  setApprovingId]  = useState<string | null>(null);

  const query = [
    activeTab !== 'ALL' ? `status=${activeTab}` : '',
    search ? `search=${encodeURIComponent(search)}` : '',
  ].filter(Boolean).join('&');

  const { data, loading, error, refetch } = useFetch<{ vendors: VendorListItem[]; total: number }>(
    `/api/super-admin/vendors${query ? `?${query}` : ''}`,
    { deps: [activeTab, search] }
  );

  const vendors = data?.vendors ?? [];

  const handleApprove = useCallback(async (vendor: VendorListItem) => {
    setApprovingId(vendor.id);
    try {
      const res = await fetch(`/api/super-admin/vendors/${vendor.id}/approve`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(`${vendor.name} approved`);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve vendor');
    } finally {
      setApprovingId(null);
    }
  }, [token, refetch]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Vendors"
        subtitle={`${data?.total ?? 0} registered businesses`}
      />

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Status tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search vendors…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={6} columns={5} />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={<Store size={20} />}
          title="No vendors found"
          description={search ? 'Try a different search term or clear the filter.' : 'No vendors match the selected status.'}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Business', 'Type', 'Owner', 'Status', 'Modules', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vendors.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Business */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-indigo-600">
                            {v.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{v.name}</p>
                          <p className="text-xs text-gray-400">{v.slug}</p>
                        </div>
                      </div>
                    </td>
                    {/* Type */}
                    <td className="px-5 py-4 text-gray-600 capitalize">{v.businessType}</td>
                    {/* Owner */}
                    <td className="px-5 py-4">
                      <p className="text-gray-900">{v.ownerEmail ?? v.email}</p>
                      <p className="text-xs text-gray-400">{v.phone}</p>
                    </td>
                    {/* Status */}
                    <td className="px-5 py-4">
                      <Badge label={v.status} variant={statusVariant(v.status)} />
                    </td>
                    {/* Modules */}
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(v.modules ?? {})
                          .filter(([, enabled]) => enabled)
                          .map(([mod]) => (
                            <Badge key={mod} label={mod} variant="brand" />
                          ))}
                      </div>
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {v.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm" variant="primary"
                              loading={approvingId === v.id}
                              onClick={() => handleApprove(v)}
                            >
                              <CheckCircle size={13} /> Approve
                            </Button>
                            <Button
                              size="sm" variant="danger"
                              onClick={() => setRejectTarget(v)}
                            >
                              <XCircle size={13} /> Reject
                            </Button>
                          </>
                        )}
                        <Link
                          href={`/super-admin/vendors/${v.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        >
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

      {/* Reject dialog */}
      <RejectDialog
        vendor={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onDone={() => { setRejectTarget(null); refetch(); }}
      />
    </div>
  );
}
