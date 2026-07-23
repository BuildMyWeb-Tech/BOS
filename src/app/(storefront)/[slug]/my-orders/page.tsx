'use client';
// src/app/(storefront)/[slug]/my-orders/page.tsx
// Customer's order history — requires customer login (sessionStorage token).

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, ChevronRight } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  ORDER_PLACED:     'bg-amber-100 text-amber-700',
  PROCESSING:       'bg-blue-100 text-blue-700',
  SHIPPED:          'bg-indigo-100 text-indigo-700',
  DELIVERED:        'bg-emerald-100 text-emerald-700',
  CANCELLED:        'bg-red-100 text-red-700',
  RETURN_REQUESTED: 'bg-orange-100 text-orange-700',
  RETURNED:         'bg-gray-100 text-gray-600',
};

interface OrderListItem {
  id: string; customerName: string; total: number;
  status: string; isPaid: boolean; itemCount: number; createdAt: string;
}

export default function MyOrdersPage() {
  const { slug }   = useParams<{ slug: string }>();
  const router     = useRouter();

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = sessionStorage.getItem(`bos_customer_${slug}`);
    return { 'X-Tenant-Slug': slug, ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
  }, [slug]);

  const [orders,  setOrders]  = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) {
      router.push(`/${slug}/customer-login?return=${encodeURIComponent(`/${slug}/my-orders`)}`);
      return;
    }
    fetch('/api/orders', { headers })
      .then(r => r.json())
      .then(json => setOrders(json.success ? (json.data.items ?? []) : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push(`/${slug}`)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-bold text-gray-900">My Orders</h1>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <Package size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No orders yet</p>
            <p className="text-sm text-gray-400 mt-1">Your order history will appear here.</p>
            <button onClick={() => router.push(`/${slug}`)} className="mt-4 text-sm text-indigo-600 hover:underline">
              Start shopping
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
            {orders.map(o => (
              <button key={o.id} onClick={() => router.push(`/${slug}/orders/${o.id}`)}
                className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4 hover:border-indigo-200 transition-colors text-left">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Package size={18} className="text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {o.status.replace(/_/g, ' ')}
                    </span>
                    {o.isPaid && <span className="text-xs text-emerald-600 font-medium">Paid</span>}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {o.itemCount} item{o.itemCount !== 1 ? 's' : ''} · ₹{o.total.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(o.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
