'use client';
// src/app/(dashboard)/dashboard/bookings/[id]/page.tsx

import { useState }         from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, X, RotateCcw } from 'lucide-react';
import toast                from 'react-hot-toast';

import Badge         from '@/components/ui/Badge';
import Button        from '@/components/ui/Button';
import Modal         from '@/components/ui/Modal';
import FormField     from '@/components/ui/FormField';
import { Skeleton }  from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import { apiCall }   from '@/lib/apiClient';
import type { BookingDetail, BookingStatus } from '@/types';

function statusVariant(s: BookingStatus) {
  return s === 'CONFIRMED' ? 'success' : s === 'COMPLETED' ? 'info'
       : s === 'CANCELLED' ? 'danger' : s === 'PENDING_PAYMENT' ? 'warning' : 'neutral';
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, loading, refetch } = useFetch<{ booking: BookingDetail }>(`/api/bookings/${id}`);
  const booking = data?.booking;

  // Payment modal
  const [payOpen,    setPayOpen]    = useState(false);
  const [payAmount,  setPayAmount]  = useState('');
  const [payMethod,  setPayMethod]  = useState<'cash' | 'upi' | 'card'>('cash');
  const [paying,     setPaying]     = useState(false);

  // Cancel modal
  const [cancelOpen,   setCancelOpen]   = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling,   setCancelling]   = useState(false);

  // Reschedule modal
  const [reschedOpen,  setReschedOpen]  = useState(false);
  const [reschedDate,  setReschedDate]  = useState('');
  const [reschedTime,  setReschedTime]  = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  async function handlePayment() {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setPaying(true);
    try {
      await apiCall('POST', `/api/bookings/${id}/payment`, { amount, method: payMethod });
      toast.success('Payment recorded');
      setPayOpen(false); setPayAmount('');
      refetch();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setPaying(false); }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await apiCall('PATCH', `/api/bookings/${id}/cancel`, { reason: cancelReason || undefined });
      toast.success('Booking cancelled');
      setCancelOpen(false);
      refetch();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setCancelling(false); }
  }

  async function handleReschedule() {
    if (!reschedDate || !reschedTime) { toast.error('Select date and time'); return; }
    setRescheduling(true);
    try {
      await apiCall('PATCH', `/api/bookings/${id}/reschedule`, { date: reschedDate, startTime: reschedTime });
      toast.success('Booking rescheduled');
      setReschedOpen(false);
      refetch();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setRescheduling(false); }
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 mt-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  );
  if (!booking) return <p className="text-sm text-gray-500">Booking not found.</p>;

  const isPending   = booking.status === 'PENDING_PAYMENT';
  const isConfirmed = booking.status === 'CONFIRMED';
  const isActive    = isPending || isConfirmed;
  const remaining   = booking.totalAmount - booking.paidAmount;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to bookings
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge label={booking.status.replace('_', ' ')} variant={statusVariant(booking.status)} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{booking.customerName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(booking.date + 'T00:00:00').toLocaleDateString('en-IN', { dateStyle: 'long' })}
            {' '}·{' '}{booking.startTime} – {booking.endTime}
          </p>
        </div>
        {isActive && (
          <div className="flex gap-2">
            {remaining > 0 && (
              <Button size="sm" onClick={() => { setPayAmount(String(remaining)); setPayOpen(true); }}>
                <CreditCard size={13} /> Record payment
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setReschedOpen(true)}>
              <RotateCcw size={13} /> Reschedule
            </Button>
            <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
              <X size={13} /> Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Services */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Services</h2>
          <div className="space-y-2">
            {booking.services.map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-800">{s.name}</span>
                <span className="text-sm font-medium text-gray-900">₹{s.price.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between">
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <span className="text-sm font-bold text-gray-900">₹{booking.totalAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Payment</h2>
          <div className="space-y-2 mb-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="text-gray-900">₹{booking.totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Paid</span>
              <span className="text-emerald-600 font-medium">₹{booking.paidAmount.toLocaleString('en-IN')}</span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Remaining</span>
                <span className="text-amber-600 font-medium">₹{remaining.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
          {booking.payments.length > 0 && (
            <div className="border-t border-gray-100 pt-3 space-y-1.5">
              {booking.payments.map(p => (
                <div key={p.id} className="flex justify-between text-xs text-gray-500">
                  <span className="capitalize">{p.method} · {p.status}</span>
                  <span>₹{p.amount.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Details</h2>
          <div className="space-y-2 text-sm">
            {booking.staffName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Staff</span>
                <span className="text-gray-800">{booking.staffName}</span>
              </div>
            )}
            {booking.resourceName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Resource</span>
                <span className="text-gray-800">{booking.resourceName}</span>
              </div>
            )}
            {booking.notes && (
              <div>
                <span className="text-gray-500 block mb-1">Notes</span>
                <span className="text-gray-800">{booking.notes}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment modal */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record payment" maxWidth="sm">
        <div className="space-y-4">
          <FormField label="Amount (₹)" required>
            <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
              placeholder="0.00" min="0" step="0.01" className="form-input" />
          </FormField>
          <FormField label="Payment method">
            <div className="flex gap-3">
              {(['cash', 'upi', 'card'] as const).map(m => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={payMethod === m} onChange={() => setPayMethod(m)}
                    className="text-indigo-600" />
                  <span className="text-sm capitalize">{m}</span>
                </label>
              ))}
            </div>
          </FormField>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button size="sm" loading={paying} onClick={handlePayment}>Record payment</Button>
          </div>
        </div>
      </Modal>

      {/* Cancel modal */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel booking" maxWidth="sm">
        <p className="text-sm text-gray-600 mb-3">Cancellation reason (optional).</p>
        <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
          rows={3} placeholder="e.g. Customer requested cancellation"
          className="form-input resize-none mb-4 w-full" />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setCancelOpen(false)}>Keep booking</Button>
          <Button variant="danger" size="sm" loading={cancelling} onClick={handleCancel}>Cancel booking</Button>
        </div>
      </Modal>

      {/* Reschedule modal */}
      <Modal open={reschedOpen} onClose={() => setReschedOpen(false)} title="Reschedule booking" maxWidth="sm">
        <div className="space-y-4">
          <FormField label="New date" required>
            <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)} className="form-input" />
          </FormField>
          <FormField label="New start time" required>
            <input type="time" value={reschedTime} onChange={e => setReschedTime(e.target.value)}
              className="form-input" />
          </FormField>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setReschedOpen(false)}>Cancel</Button>
            <Button size="sm" loading={rescheduling} onClick={handleReschedule}>Reschedule</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
