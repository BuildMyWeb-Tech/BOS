'use client';
// src/app/(dashboard)/dashboard/orders/[id]/page.tsx

import { useState }         from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock }  from 'lucide-react';
import toast                from 'react-hot-toast';

import Badge         from '@/components/ui/Badge';
import Button        from '@/components/ui/Button';
import Modal         from '@/components/ui/Modal';
import FormField     from '@/components/ui/FormField';
import { Skeleton }  from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import { apiCall }   from '@/lib/apiClient';
import type { OrderDetail, OrderStatus } from '@/types';

// Valid forward transitions for each status
const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  ORDER_PLACED: ['PROCESSING', 'CONFIRMED', 'CANCELLED'],
  PROCESSING:   ['SHIPPED', 'CANCELLED'],
  SHIPPED:      ['DELIVERED', 'RETURN_REQUESTED'],
  DELIVERED:    ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED'],
  RETURNED:     ['REFUNDED'],
};

function statusVariant(s: OrderStatus): 'warning'|'info'|'brand'|'success'|'danger'|'neutral' {
  return s === 'ORDER_PLACED' ? 'warning'
       : s === 'PROCESSING'   ? 'info'
       : s === 'SHIPPED'      ? 'brand'
       : s === 'DELIVERED'    ? 'success'
       : s === 'CANCELLED'    ? 'danger'
       : 'neutral';
}

function statusLabel(s: OrderStatus): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/(?:^|\s)\w/g, c => c.toUpperCase());
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, loading, refetch } = useFetch<{ order: OrderDetail }>(`/api/orders/${id}`);
  const order = data?.order;

  const [statusOpen,   setStatusOpen]   = useState(false);
  const [nextStatus,   setNextStatus]   = useState<OrderStatus | ''>('');
  const [note,         setNote]         = useState('');
  const [updating,     setUpdating]     = useState(false);

  const allowedNext = order ? (NEXT_STATUSES[order.status] ?? []) : [];

  async function handleStatusUpdate() {
    if (!nextStatus) { toast.error('Select a status'); return; }
    setUpdating(true);
    try {
      await apiCall('PATCH', `/api/orders/${id}/status`, { status: nextStatus, note: note || undefined });
      toast.success(`Order updated to ${statusLabel(nextStatus as OrderStatus)}`);
      setStatusOpen(false);
      setNote('');
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally { setUpdating(false); }
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-4 mt-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  );
  if (!order) return <p className="text-sm text-gray-500">Order not found.</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Orders
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge label={statusLabel(order.status)} variant={statusVariant(order.status)} />
            <Badge label={order.isPaid ? 'Paid' : 'Unpaid'} variant={order.isPaid ? 'success' : 'warning'} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {order.customerName ?? 'Customer'}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            {' '}· {order.paymentMethod}
          </p>
        </div>
        {allowedNext.length > 0 && (
          <Button size="sm" onClick={() => { setNextStatus(allowedNext[0]); setStatusOpen(true); }}>
            Update status
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Order items */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Items</h2>
          <div className="space-y-2">
            {order.items.map(item => (
              <div key={item.productId} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.productName}</p>
                  <p className="text-xs text-gray-400">×{item.quantity} @ ₹{item.price}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">₹{item.lineTotal.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-3 mt-2 flex justify-between font-bold text-gray-900">
            <span>Total</span>
            <span>₹{order.total.toLocaleString('en-IN')}</span>
          </div>
          {order.isCouponUsed && order.couponCode && (
            <p className="text-xs text-emerald-600 mt-1">Coupon applied: {order.couponCode}</p>
          )}
        </div>

        {/* Delivery address */}
        {order.address && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Delivery address</h2>
            <div className="text-sm text-gray-700 space-y-0.5">
              <p className="font-semibold">{order.address.name}</p>
              <p>{order.address.street}</p>
              <p>{order.address.city}, {order.address.state} {order.address.zip}</p>
              <p>{order.address.country}</p>
              <p className="text-gray-500">{order.address.phone}</p>
              <p className="text-gray-500">{order.address.email}</p>
            </div>
          </div>
        )}

        {/* Status timeline */}
        {order.timeline && order.timeline.length > 0 && (
          <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
              <Clock size={13} /> Timeline
            </h2>
            <div className="space-y-3">
              {[...order.timeline].reverse().map((entry, i) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${i === 0 ? 'bg-indigo-600' : 'bg-gray-300'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge label={statusLabel(entry.status)} variant={statusVariant(entry.status)} />
                      <span className="text-xs text-gray-400">
                        {new Date(entry.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    {entry.note && <p className="text-xs text-gray-500 mt-0.5">{entry.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status update modal */}
      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Update order status" maxWidth="sm">
        <div className="space-y-4">
          <FormField label="New status" required>
            <select value={nextStatus} onChange={e => setNextStatus(e.target.value as OrderStatus)}
              className="form-input">
              <option value="">Select…</option>
              {allowedNext.map(s => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Note" hint="Optional — visible in the timeline.">
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="e.g. Packed and dispatched via Blue Dart" className="form-input resize-none w-full" />
          </FormField>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button size="sm" loading={updating} onClick={handleStatusUpdate}>Update status</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
