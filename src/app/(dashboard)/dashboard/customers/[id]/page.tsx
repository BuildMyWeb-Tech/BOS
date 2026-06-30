'use client';
// src/app/(dashboard)/dashboard/customers/[id]/page.tsx
// Customer detail — shows all orders and bookings for a customer identified by name.
// Note: uses name-based lookup (URL param) since there is no /api/customers/[id] endpoint yet.
// When a dedicated customer API is added, update the fetch to use userId.

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingBag, CalendarDays } from 'lucide-react';
import Link from 'next/link';

import Badge        from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/SkeletonTable';
import { useFetch } from '@/hooks/useFetch';
import type { OrderListItem, BookingListItem, OrderStatus, BookingStatus } from '@/types';

function orderStatusVariant(s: OrderStatus): 'warning'|'info'|'brand'|'success'|'danger'|'neutral' {
  return s === 'ORDER_PLACED' ? 'warning' : s === 'PROCESSING' ? 'info'
       : s === 'SHIPPED'      ? 'brand'   : s === 'DELIVERED'  ? 'success'
       : s === 'CANCELLED'    ? 'danger'  : 'neutral';
}
function bookingStatusVariant(s: BookingStatus) {
  return s === 'CONFIRMED' ? 'success' : s === 'COMPLETED' ? 'info'
       : s === 'CANCELLED' ? 'danger'  : s === 'PENDING_PAYMENT' ? 'warning' : 'neutral';
}
function orderStatusLabel(s: OrderStatus) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/(?:^|\s)\w/g, c => c.toUpperCase());
}

export default function CustomerDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const name     = decodeURIComponent(id);

  const { data: orderData,   loading: oLoad } = useFetch<{ orders: OrderListItem[] }>('/api/orders?limit=500');
  const { data: bookingData, loading: bLoad } = useFetch<{ bookings: BookingListItem[] }>('/api/bookings?limit=500');

  const loading  = oLoad || bLoad;
  const orders   = (orderData?.orders   ?? []).filter(o => o.customerName === name);
  const bookings = (bookingData?.bookings ?? []).filter(b => b.customerName === name);

  const totalSpend = orders.reduce((s, o) => s + o.total, 0);

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-3">
      <Skeleton className="h-6 w-40" /><Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-3 gap-3 mt-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Customers
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
          <span className="text-xl font-bold text-indigo-600">{name.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{name}</h1>
          <p className="text-sm text-gray-400">Customer profile</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total orders',   value: String(orders.length)   },
          { label: 'Total bookings', value: String(bookings.length) },
          { label: 'Total spend',    value: totalSpend > 0 ? `₹${totalSpend.toLocaleString('en-IN')}` : '₹0' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className="text-xl font-bold text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Orders */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ShoppingBag size={15} className="text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-800">Orders ({orders.length})</h2>
        </div>
        {orders.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">No orders placed.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {orders.map(o => (
              <div key={o.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{o.itemCount} item{o.itemCount !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge label={orderStatusLabel(o.status)} variant={orderStatusVariant(o.status)} />
                  <span className="text-sm font-semibold text-gray-900">₹{o.total.toLocaleString('en-IN')}</span>
                  <Link href={`/dashboard/orders/${o.id}`}
                    className="text-xs text-indigo-600 hover:underline">View</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bookings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <CalendarDays size={15} className="text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-800">Bookings ({bookings.length})</h2>
        </div>
        {bookings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">No bookings made.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {bookings.map(b => (
              <div key={b.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
                    {b.serviceNames.join(', ')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(b.date + 'T00:00:00').toLocaleDateString('en-IN', { dateStyle: 'medium' })} · {b.startTime}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    label={b.status === 'PENDING_PAYMENT' ? 'Pending' : b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                    variant={bookingStatusVariant(b.status)}
                  />
                  <span className="text-sm font-semibold text-gray-900">₹{b.totalAmount.toLocaleString('en-IN')}</span>
                  <Link href={`/dashboard/bookings/${b.id}`}
                    className="text-xs text-indigo-600 hover:underline">View</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
