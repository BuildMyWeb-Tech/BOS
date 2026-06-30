'use client';
// src/app/(storefront)/[slug]/orders/[orderId]/page.tsx
// Customer-facing order tracking page — no dashboard sidebar.

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, MapPin, Clock } from 'lucide-react';

import Badge from '@/components/ui/Badge';
import type { OrderDetail, OrderStatus } from '@/types';

function statusVariant(s: OrderStatus): 'warning'|'info'|'brand'|'success'|'danger'|'neutral' {
  return s === 'ORDER_PLACED' ? 'warning' : s === 'PROCESSING' ? 'info'
       : s === 'SHIPPED'      ? 'brand'   : s === 'DELIVERED'  ? 'success'
       : s === 'CANCELLED'    ? 'danger'  : 'neutral';
}

function statusLabel(s: OrderStatus): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/(?:^|\s)\w/g, c => c.toUpperCase());
}

// Progress steps for the order journey
const JOURNEY_STEPS: OrderStatus[] = ['ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

function JourneyBar({ current }: { current: OrderStatus }) {
  const isCancelled = current === 'CANCELLED' || current === 'RETURN_REQUESTED' || current === 'RETURNED' || current === 'REFUNDED';
  const currentIdx  = JOURNEY_STEPS.indexOf(current);

  if (isCancelled) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
        <Badge label={statusLabel(current)} variant="danger" />
        <p className="text-xs text-red-500 mt-1">This order has been {statusLabel(current).toLowerCase()}.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2">
      {JOURNEY_STEPS.map((step, i) => {
        const done    = currentIdx >= i;
        const active  = currentIdx === i;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                done
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'bg-white border-gray-200'
              }`}>
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-200" />
                )}
              </div>
              <p className={`text-xs mt-1.5 font-medium text-center whitespace-nowrap ${
                active ? 'text-indigo-600' : done ? 'text-gray-700' : 'text-gray-400'
              }`} style={{ fontSize: 10 }}>
                {step === 'ORDER_PLACED' ? 'Placed' : step === 'PROCESSING' ? 'Packing' : step === 'SHIPPED' ? 'Shipped' : 'Delivered'}
              </p>
            </div>
            {i < JOURNEY_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 transition-colors ${currentIdx > i ? 'bg-indigo-600' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderTrackingPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const router            = useRouter();
  const headers: Record<string, string> = { 'X-Tenant-Slug': slug };

  const [order,   setOrder]   = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orders/${orderId}`, { headers })
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.error ?? 'Order not found');
        setOrder(json.data.order);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-4 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-40" />
      <div className="h-32 bg-gray-200 rounded-xl" />
      <div className="h-48 bg-gray-200 rounded-xl" />
    </div>
  );

  if (error || !order) return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center">
      <Package size={40} className="text-gray-300 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-gray-700 mb-2">Order not found</h2>
      <p className="text-sm text-gray-400 mb-6">{error ?? 'We could not find this order. Please check the order ID.'}</p>
      <button onClick={() => router.push(`/${slug}`)} className="text-sm text-indigo-600 hover:underline">
        Back to store
      </button>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <button onClick={() => router.push(`/${slug}`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to store
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Badge label={statusLabel(order.status)} variant={statusVariant(order.status)} />
          <Badge label={order.isPaid ? 'Paid' : 'Payment pending'} variant={order.isPaid ? 'success' : 'warning'} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Your order</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Placed {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
        </p>
      </div>

      {/* Journey bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <JourneyBar current={order.status} />
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
          <Package size={13} /> Items ordered
        </h2>
        <div className="space-y-2">
          {order.items.map(item => (
            <div key={item.productId} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.productName}</p>
                <p className="text-xs text-gray-400">×{item.quantity} @ ₹{item.price.toLocaleString('en-IN')}</p>
              </div>
              <p className="text-sm font-semibold text-gray-900">₹{item.lineTotal.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-bold text-gray-900 pt-3 border-t border-gray-100 mt-2">
          <span>Total</span>
          <span>₹{order.total.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Delivery address */}
      {order.address && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
            <MapPin size={13} /> Delivery address
          </h2>
          <div className="text-sm text-gray-700 space-y-0.5">
            <p className="font-semibold">{order.address.name}</p>
            <p>{order.address.street}</p>
            <p>{order.address.city}, {order.address.state} {order.address.zip}</p>
            <p className="text-gray-400">{order.address.phone}</p>
          </div>
        </div>
      )}

      {/* Timeline */}
      {order.timeline && order.timeline.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
            <Clock size={13} /> Updates
          </h2>
          <div className="space-y-3">
            {[...order.timeline].reverse().map((entry, i) => (
              <div key={entry.id} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${i === 0 ? 'bg-indigo-600' : 'bg-gray-300'}`} />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
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
  );
}
