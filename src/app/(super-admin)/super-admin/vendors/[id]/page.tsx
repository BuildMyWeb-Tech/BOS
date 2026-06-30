'use client';
// src/app/(super-admin)/super-admin/vendors/[id]/page.tsx
//
// Full vendor detail — registration info, module flags, approve/reject actions.

import { useState }     from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast            from 'react-hot-toast';
import { ArrowLeft, Building2, Mail, Phone, Globe, MapPin, CheckCircle, XCircle } from 'lucide-react';

import Badge       from '@/components/ui/Badge';
import Button      from '@/components/ui/Button';
import Modal       from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/SkeletonTable';
import { useFetch } from '@/hooks/useFetch';
import { useAppSelector } from '@/hooks/store';
import type { VendorListItem, TenantStatus } from '@/types';

function statusVariant(status: TenantStatus): 'warning' | 'success' | 'danger' | 'neutral' {
  return status === 'PENDING' ? 'warning'
       : status === 'APPROVED' ? 'success'
       : status === 'REJECTED' ? 'danger'
       : 'neutral';
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <span className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm text-gray-800">{value}</p>
      </div>
    </div>
  );
}

export default function VendorDetailPage() {
  const { id }        = useParams<{ id: string }>();
  const router        = useRouter();
  const token         = useAppSelector(s => s.auth.token);

  const { data, loading } = useFetch<{ vendor: VendorListItem }>(`/api/super-admin/vendors/${id}`);
  const vendor = data?.vendor;

  const [approving,    setApproving]    = useState(false);
  const [rejectOpen,   setRejectOpen]   = useState(false);
  const [reason,       setReason]       = useState('');
  const [rejecting,    setRejecting]    = useState(false);

  async function handleApprove() {
    setApproving(true);
    try {
      const res = await fetch(`/api/super-admin/vendors/${id}/approve`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success('Vendor approved');
      router.push('/super-admin/vendors');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally { setApproving(false); }
  }

  async function handleReject() {
    if (reason.trim().length < 10) { toast.error('Reason must be at least 10 characters'); return; }
    setRejecting(true);
    try {
      const res = await fetch(`/api/super-admin/vendors/${id}/reject`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success('Vendor rejected');
      router.push('/super-admin/vendors');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally { setRejecting(false); }
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
      >
        <ArrowLeft size={15} /> Back to vendors
      </button>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
          <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        </div>
      ) : !vendor ? (
        <p className="text-sm text-gray-500">Vendor not found.</p>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-indigo-600">{vendor.name.charAt(0)}</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{vendor.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge label={vendor.status} variant={statusVariant(vendor.status)} />
                  <span className="text-sm text-gray-400 capitalize">{vendor.businessType}</span>
                </div>
              </div>
            </div>

            {/* Actions — only for PENDING */}
            {vendor.status === 'PENDING' && (
              <div className="flex gap-2">
                <Button variant="primary" onClick={handleApprove} loading={approving}>
                  <CheckCircle size={15} /> Approve
                </Button>
                <Button variant="danger" onClick={() => setRejectOpen(true)}>
                  <XCircle size={15} /> Reject
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Business info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Business info</h2>
              <InfoRow icon={<Building2 size={14} />} label="Business name" value={vendor.name} />
              <InfoRow icon={<MapPin size={14} />}    label="Address"       value={vendor.address} />
              <InfoRow icon={<Phone size={14} />}     label="Phone"         value={vendor.phone} />
              <InfoRow icon={<Globe size={14} />}     label="Website"       value={(vendor as unknown as { website?: string }).website} />
            </div>

            {/* Owner info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Owner</h2>
              <InfoRow icon={<Mail size={14} />}  label="Email" value={vendor.ownerEmail ?? vendor.email} />
              <InfoRow icon={<Phone size={14} />} label="Phone" value={vendor.phone} />
            </div>

            {/* Modules */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Requested modules</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(vendor.modules ?? {}).map(([mod, enabled]) => (
                  <div key={mod} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${
                    enabled ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-indigo-500' : 'bg-gray-300'}`} />
                    <span className="capitalize font-medium">{mod}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Timeline</h2>
              <InfoRow icon={<Building2 size={14} />} label="Registered on" value={
                vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : undefined
              } />
              <InfoRow icon={<Building2 size={14} />} label="Slug" value={vendor.slug} />
            </div>
          </div>
        </>
      )}

      {/* Reject modal */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject vendor" maxWidth="sm">
        <p className="text-sm text-gray-600 mb-3">
          Provide a clear reason. This will be visible to the applicant.
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={4}
          placeholder="e.g. Incomplete documents. Please reapply with a valid GST certificate."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1 mb-4">Minimum 10 characters</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button variant="danger" size="sm" loading={rejecting} onClick={handleReject}>Reject vendor</Button>
        </div>
      </Modal>
    </div>
  );
}
