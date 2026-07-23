'use client';
// src/app/(storefront)/[slug]/orders/[orderId]/page.tsx
// Customer-facing order tracking page — no dashboard sidebar.
// FIX: Now calls /api/storefront/orders/[orderId] (public, no JWT needed)

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, MapPin, Clock, CheckCircle } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import type { OrderStatus } from '@/types';

interface OrderDetail {
  id: string; total: number; status: OrderStatus; isPaid: boolean;
  paymentMethod: string; createdAt: string; customerName: string;
  address: { name: string; street: string; city: string; state: string; zip: string; country: string; phone: string } | null;
  items: { productId: string; productName: string; quantity: number; price: number; lineTotal: number }[];
  timeline: { id: string; status: OrderStatus; changedBy: string; note: string | null; createdAt: string }[];
}

function statusVariant(s: OrderStatus) {
  if (s === 'DELIVERED')  return 'success' as const;
  if (s === 'CANCELLED')  return 'danger'  as const;
  if (s === 'SHIPPED')    return 'brand'   as const;
  if (s === 'PROCESSING') return 'info'    as const;
  return 'warning' as const;
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/(?:^|\s)\w/g, c => c.toUpperCase());
}

const JOURNEY: OrderStatus[] = ['ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

function JourneyBar({ current }: { current: OrderStatus }) {
  const isCancelled = ['CANCELLED','RETURN_REQUESTED','RETURNED','REFUNDED'].includes(current);
  const idx = JOURNEY.indexOf(current);

  if (isCancelled) return (
    <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
      <p className="text-sm font-semibold text-red-600">{statusLabel(current)}</p>
    </div>
  );

  return (
    <div className="flex items-center">
      {JOURNEY.map((step, i) => {
        const done   = idx >= i;
        const active = idx === i;
        const labels = ['Placed','Packing','Shipped','Delivered'];
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${done ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-200'}`}>
                {done ? <CheckCircle size={16} className="text-white" /> : <div className="w-2 h-2 rounded-full bg-gray-200" />}
              </div>
              <p className={`text-xs mt-1.5 font-medium whitespace-nowrap ${active ? 'text-indigo-600' : done ? 'text-gray-700' : 'text-gray-400'}`} style={{ fontSize: 10 }}>
                {labels[i]}
              </p>
            </div>
            {i < JOURNEY.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 rounded-full ${done && idx > i ? 'bg-indigo-600' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderTrackingPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const router = useRouter();
  const [order, setOrder]     = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/storefront/orders/${orderId}`, { headers: { 'X-Tenant-Slug': slug } })
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.error ?? 'Order not found');
        setOrder(json.data.order);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId, slug]);

  if (loading) return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse" />)}
    </div>
  );

  if (error || !order) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <Package size={48} className="text-gray-300 mx-auto mb-4" />
      <p className="text-gray-500 mb-4">{error ?? 'Order not found.'}</p>
      <button onClick={() => router.push(`/${slug}`)} className="text-sm text-indigo-600 hover:underline">Back to store</button>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <button onClick={() => router.push(`/${slug}`)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to store
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <Badge label={statusLabel(order.status)} variant={statusVariant(order.status)} />
          <Badge label={order.isPaid ? 'Paid' : 'Pay on delivery'} variant={order.isPaid ? 'success' : 'warning'} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Order tracking</h1>
        <p className="text-xs text-gray-400 font-mono mt-0.5">#{order.id.slice(-10).toUpperCase()}</p>
        <p className="text-sm text-gray-400 mt-0.5">
          {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <JourneyBar current={order.status} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Package size={12} /> Items
        </h2>
        <div className="divide-y divide-gray-50">
          {order.items.map(item => (
            <div key={item.productId} className="flex justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.productName}</p>
                <p className="text-xs text-gray-400">×{item.quantity} · ₹{item.price.toLocaleString('en-IN')}</p>
              </div>
              <p className="text-sm font-semibold text-gray-900">₹{item.lineTotal.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-bold text-gray-900 pt-3 border-t border-gray-100 mt-1">
          <span>Total</span><span>₹{order.total.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {order.address && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <MapPin size={12} /> Delivery address
          </h2>
          <div className="text-sm text-gray-700 space-y-0.5">
            <p className="font-semibold">{order.address.name}</p>
            <p className="text-gray-500">{order.address.street}</p>
            <p className="text-gray-500">{order.address.city}, {order.address.state} {order.address.zip}</p>
            <p className="text-gray-400 text-xs">{order.address.phone}</p>
          </div>
        </div>
      )}

      {order.timeline.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Clock size={12} /> Updates
          </h2>
          <div className="space-y-4">
            {[...order.timeline].reverse().map((entry, i) => (
              <div key={entry.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${i === 0 ? 'bg-indigo-600' : 'bg-gray-300'}`} />
                  {i < order.timeline.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                </div>
                <div className="pb-3">
                  <p className="text-sm font-semibold text-gray-800">{statusLabel(entry.status)}</p>
                  <p className="text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  {entry.note && <p className="text-xs text-gray-500 mt-1">{entry.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => router.push(`/${slug}/my-orders`)}
          className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
          All orders
        </button>
        <button onClick={() => router.push(`/${slug}`)}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
          Continue shopping
        </button>
      </div>
    </div>
  );
}