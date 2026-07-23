'use client';
// src/app/(storefront)/[slug]/my-bookings/page.tsx
// FIX: Page now works with just /buildmyweb/my-bookings (no phone in URL).
// Customer enters phone number → sees appointments.
// Razorpay sandbox payment for PENDING_PAYMENT bookings.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Search, Calendar, Clock, CreditCard,
  CheckCircle, XCircle, RefreshCw, Scissors, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────

interface Booking {
  id:          string;
  date:        string;
  startTime:   string;
  endTime:     string;
  status:      string;
  totalAmount: number;
  paidAmount:  number;
  staffName:   string | null;
  services:    { name: string; price: number }[];
  notes:       string | null;
  createdAt:   string;
}

// ─── Status config ────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  PENDING_PAYMENT: { label: 'Upcoming-Pending', bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  CONFIRMED:       { label: 'Confirmed',         bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  COMPLETED:       { label: 'Completed-Paid',    bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  CANCELLED:       { label: 'Cancelled',         bg: 'bg-red-100',     text: 'text-red-600',     dot: 'bg-red-500'     },
  RESCHEDULED:     { label: 'Rescheduled',       bg: 'bg-purple-100',  text: 'text-purple-700',  dot: 'bg-purple-500'  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status.replace(/_/g, ' '),
    bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Razorpay loader ─────────────────────────────────────────────

declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof window !== 'undefined' && window.Razorpay) { resolve(true); return; }
    const s   = document.createElement('script');
    s.src     = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// ─── Main ────────────────────────────────────────────────────────

const TABS = ['All', 'Upcoming', 'Completed', 'Cancelled'] as const;

export default function MyBookingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const router   = useRouter();
  const headers  = { 'X-Tenant-Slug': slug };

  // Phone lookup state
  const [phoneInput, setPhoneInput] = useState('');
  const [submittedPhone, setSubmittedPhone] = useState('');
  const [custName, setCustName] = useState('');

  // Data state
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [activeTab,  setActiveTab]  = useState<typeof TABS[number]>('All');
  const [paying,     setPaying]     = useState<string | null>(null);

  // Fetch bookings by phone
  const fetchBookings = useCallback((phone: string) => {
    if (!phone.trim()) return;
    setLoading(true);
    setSearched(true);
    const q = new URLSearchParams({ slug, phone: phone.trim() });
    fetch(`/api/storefront/bookings?${q}`, { headers })
      .then(r => r.json())
      .then(json => {
        if (json.success) setBookings(json.data.bookings ?? []);
        else setBookings([]);
      })
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [slug]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneInput.trim()) { toast.error('Enter your phone number'); return; }
    setSubmittedPhone(phoneInput.trim());
    fetchBookings(phoneInput.trim());
  }

  // Tab filtered bookings
  const filtered = bookings.filter(b => {
    if (activeTab === 'All')       return true;
    if (activeTab === 'Upcoming')  return ['PENDING_PAYMENT', 'CONFIRMED'].includes(b.status);
    if (activeTab === 'Completed') return b.status === 'COMPLETED';
    if (activeTab === 'Cancelled') return b.status === 'CANCELLED';
    return true;
  });

  const counts = {
    All:       bookings.length,
    Upcoming:  bookings.filter(b => ['PENDING_PAYMENT','CONFIRMED'].includes(b.status)).length,
    Completed: bookings.filter(b => b.status === 'COMPLETED').length,
    Cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
  };

  // Format date
  function fmtDate(ds: string) {
    return new Date(ds + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  // Razorpay payment
  async function handlePayNow(booking: Booking) {
    setPaying(booking.id);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error('Razorpay script failed to load'); return; }

      const res  = await fetch('/api/storefront/payments/create-order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bookingId: booking.id, slug }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Failed to create payment');

      const { orderId, amount, keyId, serviceName, tenantName } = json.data;

      new window.Razorpay({
        key:         keyId,
        amount,
        currency:    'INR',
        name:        tenantName,
        description: serviceName,
        order_id:    orderId,
        prefill:     { name: custName || 'Customer', contact: submittedPhone },
        theme:       { color: '#4f46e5' },
        handler: async (response: Record<string, string>) => {
          try {
            const vRes  = await fetch('/api/storefront/payments/verify', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                bookingId:           booking.id,
                slug,
              }),
            });
            const vJson = await vRes.json();
            if (!vJson.success) throw new Error(vJson.error);
            toast.success('Payment successful! Booking confirmed ✅');
            fetchBookings(submittedPhone);
          } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Verification failed');
          }
        },
      }).open();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPaying(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/${slug}`)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">My Appointments</h1>
              <p className="text-xs text-gray-400">Manage your bookings and payments</p>
            </div>
          </div>
          {searched && bookings.length > 0 && (
            <button onClick={() => fetchBookings(submittedPhone)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
              <RefreshCw size={12} /> Refresh
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Phone lookup — always visible */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-medium text-gray-700 mb-1">Find your appointments</p>
          <p className="text-xs text-gray-400 mb-4">
            Enter the phone number you used when booking.
          </p>
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  type="tel"
                  placeholder="+91 9876543210"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
              <button type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors">
                <Search size={14} /> Find
              </button>
            </div>
            {/* Optional name field to personalise */}
            <input
              value={custName}
              onChange={e => setCustName(e.target.value)}
              placeholder="Your name (optional — for payment)"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 text-gray-700"
            />
          </form>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-40" />
                    <div className="h-3 bg-gray-200 rounded w-56" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Not searched yet */}
        {!loading && !searched && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Calendar size={40} className="text-indigo-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Enter your phone number above</p>
            <p className="text-sm text-gray-400 mt-1">We'll show all your appointment history</p>
          </div>
        )}

        {/* No results */}
        {!loading && searched && bookings.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <Calendar size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-semibold">No appointments found</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              No bookings found for <strong>{submittedPhone}</strong>.
            </p>
            <button onClick={() => router.push(`/${slug}`)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
              Book a service
            </button>
          </div>
        )}

        {/* Results */}
        {!loading && bookings.length > 0 && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 bg-white rounded-xl border border-gray-200 shadow-sm p-1 overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-1 justify-center ${
                    activeTab === tab
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}>
                  {tab}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center ${
                    activeTab === tab ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {counts[tab]}
                  </span>
                </button>
              ))}
            </div>

            {/* Appointments table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

              {/* Desktop table header */}
              <div className="hidden sm:grid gap-4 px-6 py-3.5 bg-gray-50 border-b border-gray-100"
                style={{ gridTemplateColumns: '1.8fr 1.8fr 1.5fr 1.2fr 1fr 1.4fr' }}>
                {['CUSTOMER DETAILS','STYLIST & SERVICE','DATE & TIME','STATUS','PRICE','ACTIONS'].map(h => (
                  <span key={h} className="text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</span>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-gray-400 text-sm">No {activeTab.toLowerCase()} appointments.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filtered.map(b => {
                    const svcName   = b.services.map(s => s.name).join(', ');
                    const remaining = b.totalAmount - b.paidAmount;
                    const canPay    = b.status === 'PENDING_PAYMENT' && remaining > 0;

                    return (
                      <div key={b.id} className="px-4 sm:px-6 py-4 hover:bg-gray-50/50 transition-colors">

                        {/* Mobile card */}
                        <div className="sm:hidden space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{svcName}</p>
                              {b.staffName && (
                                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                  <Scissors size={10} /> with {b.staffName}
                                </p>
                              )}
                            </div>
                            <StatusBadge status={b.status} />
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Calendar size={11} /> {fmtDate(b.date)}</span>
                            <span className="flex items-center gap-1"><Clock size={11} /> {b.startTime} – {b.endTime}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div>
                              <span className="text-sm font-bold text-gray-900">₹{b.totalAmount.toLocaleString('en-IN')}</span>
                              {remaining > 0 && b.status !== 'CANCELLED' && (
                                <span className="text-xs text-amber-600 ml-2">₹{remaining} pending</span>
                              )}
                            </div>
                            {canPay && (
                              <button onClick={() => handlePayNow(b)} disabled={paying === b.id}
                                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                                <CreditCard size={12} />
                                {paying === b.id ? 'Processing…' : `Pay ₹${remaining.toLocaleString('en-IN')}`}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Desktop row */}
                        <div className="hidden sm:grid gap-4 items-center"
                          style={{ gridTemplateColumns: '1.8fr 1.8fr 1.5fr 1.2fr 1fr 1.4fr' }}>

                          {/* Customer */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs font-bold">
                                {(custName || submittedPhone || 'C')[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {custName || 'Customer'}
                              </p>
                              <p className="text-xs text-gray-400 truncate font-mono">{submittedPhone}</p>
                            </div>
                          </div>

                          {/* Stylist & Service */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                              <Scissors size={14} className="text-white" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {b.staffName ?? 'Any Stylist'}
                              </p>
                              <p className="text-xs text-gray-400 truncate">{svcName}</p>
                            </div>
                          </div>

                          {/* Date & Time */}
                          <div>
                            <p className="text-sm font-medium text-gray-800">{fmtDate(b.date)}</p>
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <Clock size={10} /> {b.startTime} – {b.endTime}
                            </p>
                          </div>

                          {/* Status */}
                          <div><StatusBadge status={b.status} /></div>

                          {/* Price */}
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              ₹{b.totalAmount.toLocaleString('en-IN')}
                            </p>
                            {remaining > 0 && b.status !== 'CANCELLED' && (
                              <p className="text-xs text-amber-600 mt-0.5">₹{remaining} due</p>
                            )}
                            {remaining === 0 && !['CANCELLED','PENDING_PAYMENT'].includes(b.status) && (
                              <p className="text-xs text-emerald-600 mt-0.5">Paid ✓</p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {canPay && (
                              <button onClick={() => handlePayNow(b)} disabled={paying === b.id}
                                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                                <CreditCard size={12} />
                                {paying === b.id ? '…' : 'Pay Now'}
                              </button>
                            )}
                            {b.status === 'CONFIRMED' && (
                              <div className="flex items-center gap-1 text-blue-600">
                                <CheckCircle size={15} />
                                <span className="text-xs font-medium">Confirmed</span>
                              </div>
                            )}
                            {b.status === 'COMPLETED' && (
                              <div className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle size={15} />
                                <span className="text-xs font-medium">Done</span>
                              </div>
                            )}
                            {b.status === 'CANCELLED' && (
                              <div className="flex items-center gap-1 text-red-400">
                                <XCircle size={15} />
                                <span className="text-xs font-medium">Cancelled</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer summary */}
              {filtered.length > 0 && (
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-gray-400">
                    Showing {filtered.length} of {bookings.length} appointments
                  </p>
                  <div className="flex gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Upcoming: {counts.Upcoming}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Completed: {counts.Completed}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Cancelled: {counts.Cancelled}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Razorpay test mode info */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-indigo-700 mb-1">
                    Test Mode — Razorpay Sandbox
                  </p>
                  <div className="space-y-0.5 text-xs text-indigo-600 font-mono">
                    <p>Card: <strong>4111 1111 1111 1111</strong> · Any expiry · Any CVV</p>
                    <p>UPI:  <strong>success@razorpay</strong></p>
                    <p>Net banking: Select any bank → use test credentials shown</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
