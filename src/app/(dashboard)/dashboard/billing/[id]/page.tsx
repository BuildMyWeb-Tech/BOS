'use client';
// src/app/(dashboard)/dashboard/billing/[id]/page.tsx

import { useState }         from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import toast                from 'react-hot-toast';

import Badge         from '@/components/ui/Badge';
import Button        from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Skeleton }  from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import { apiCall }   from '@/lib/apiClient';
import type { BillDetail } from '@/types';

const MODE_LABELS: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', CARD: 'Card', SPLIT: 'Split',
};

export default function BillDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const { data, loading } = useFetch<{ bill: BillDetail }>(`/api/bills/${id}`);
  const bill = data?.bill;

  const [voidOpen,  setVoidOpen]  = useState(false);
  const [voiding,   setVoiding]   = useState(false);

  async function handleVoid() {
    setVoiding(true);
    try {
      await apiCall('POST', `/api/bills/${id}/void`);
      toast.success('Bill voided — stock restored');
      router.push('/dashboard/billing');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to void bill');
    } finally { setVoiding(false); }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
  if (!bill) return <p className="text-sm text-gray-500">Bill not found.</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Billing
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="font-mono text-xs text-gray-400 mb-0.5">{bill.billNumber}</p>
          <h1 className="text-xl font-bold text-gray-900">
            ₹{bill.total.toLocaleString('en-IN')}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge label={MODE_LABELS[bill.paymentMode] ?? bill.paymentMode} variant="neutral" />
            <span className="text-sm text-gray-400">
              {new Date(bill.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={() => setVoidOpen(true)}>
          <Trash2 size={13} /> Void bill
        </Button>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">Product</th>
              <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Qty</th>
              <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Price</th>
              <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Discount</th>
              <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {bill.items.map(item => (
              <tr key={item.id}>
                <td className="px-5 py-3 text-gray-800">
                  {item.name}
                  {item.size && <span className="text-xs text-gray-400 ml-1">({item.size})</span>}
                </td>
                <td className="px-5 py-3 text-right text-gray-600">{item.quantity}</td>
                <td className="px-5 py-3 text-right text-gray-600">₹{item.price.toLocaleString('en-IN')}</td>
                <td className="px-5 py-3 text-right text-gray-400">
                  {item.discount > 0 ? `-₹${item.discount}` : '—'}
                </td>
                <td className="px-5 py-3 text-right font-medium text-gray-900">
                  ₹{item.total.toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>₹{bill.subtotal.toLocaleString('en-IN')}</span>
        </div>
        {bill.discount > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Bill discount</span>
            <span>-₹{bill.discount.toLocaleString('en-IN')}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-600">
          <span>Tax</span>
          <span>₹{bill.taxAmount.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2">
          <span>Total</span>
          <span>₹{bill.total.toLocaleString('en-IN')}</span>
        </div>
        {bill.paidAmount != null && (
          <>
            <div className="flex justify-between text-gray-600">
              <span>Paid</span>
              <span>₹{bill.paidAmount.toLocaleString('en-IN')}</span>
            </div>
            {(bill.changeAmount ?? 0) > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Change</span>
                <span>₹{bill.changeAmount?.toLocaleString('en-IN')}</span>
              </div>
            )}
          </>
        )}
        {bill.note && (
          <p className="text-xs text-gray-400 border-t border-gray-50 pt-2">{bill.note}</p>
        )}
      </div>

      <ConfirmDialog
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        onConfirm={handleVoid}
        loading={voiding}
        title="Void this bill?"
        description={`Bill ${bill.billNumber} will be voided and all stock quantities will be restored. This cannot be undone.`}
        confirmLabel="Void bill"
        variant="danger"
      />
    </div>
  );
}
