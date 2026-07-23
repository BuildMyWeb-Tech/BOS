'use client';
// src/app/(storefront)/[slug]/checkout/page.tsx
// Uses customer sessionStorage token for address + order APIs.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, CreditCard, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import Button    from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import type { AddressDetail } from '@/types';

const PAYMENT_METHODS = [
  { value: 'COD',  label: 'Cash on Delivery' },
  { value: 'UPI',  label: 'UPI'               },
  { value: 'CARD', label: 'Card'               },
] as const;

type PaymentMethod = typeof PAYMENT_METHODS[number]['value'];

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const router   = useRouter();

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = sessionStorage.getItem(`bos_customer_${slug}`);
    return { 'X-Tenant-Slug': slug, ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
  }, [slug]);

  const [addresses,     setAddresses]     = useState<AddressDetail[]>([]);
  const [selectedAddr,  setSelectedAddr]  = useState('');
  const [showAddrForm,  setShowAddrForm]  = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [placingOrder,  setPlacingOrder]  = useState(false);
  const [ordered,       setOrdered]       = useState(false);
  const [orderId,       setOrderId]       = useState('');

  const [aName, setAName]     = useState('');
  const [aEmail, setAEmail]   = useState('');
  const [aStreet, setAStreet] = useState('');
  const [aCity, setACity]     = useState('');
  const [aState, setAState]   = useState('');
  const [aZip, setAZip]       = useState('');
  const [aPhone, setAPhone]   = useState('');
  const [savingAddr, setSavingAddr] = useState(false);

  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) {
      router.push(`/${slug}/customer-login?return=${encodeURIComponent(`/${slug}/checkout`)}`);
      return;
    }
    fetch('/api/addresses', { headers })
      .then(r => r.json())
      .then(json => {
        const list = json.data?.addresses ?? [];
        setAddresses(list);
        if (list.length > 0) setSelectedAddr(list[0].id);
        else setShowAddrForm(true);
      })
      .catch(() => setShowAddrForm(true));
  }, [slug]);

  async function saveAddress() {
    setSavingAddr(true);
    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name: aName, email: aEmail, street: aStreet, city: aCity, state: aState, zip: aZip, country: 'India', phone: aPhone }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const newAddr: AddressDetail = json.data.address;
      setAddresses(prev => [...prev, newAddr]);
      setSelectedAddr(newAddr.id);
      setShowAddrForm(false);
      toast.success('Address saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save address');
    } finally { setSavingAddr(false); }
  }

  async function placeOrder() {
    if (!selectedAddr) { toast.error('Select a delivery address'); return; }
    setPlacingOrder(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ addressId: selectedAddr, paymentMethod }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setOrderId(json.data.order.id);
      setOrdered(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to place order');
    } finally { setPlacingOrder(false); }
  }

  if (ordered) return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
        <CheckCircle size={32} className="text-emerald-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Order placed!</h1>
      <p className="text-gray-500 mb-3">Your order has been received. We'll get it ready soon.</p>
      <p className="font-mono text-xs text-gray-400 mb-6">Order # {orderId.slice(-8).toUpperCase()}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={() => router.push(`/${slug}/orders/${orderId}`)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Track order
        </button>
        <button onClick={() => router.push(`/${slug}`)}
          className="border border-gray-200 text-gray-600 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
          Continue shopping
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to cart
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <div className="space-y-4">
        {/* Address */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MapPin size={16} className="text-indigo-600" /> Delivery address
            </h2>
            {addresses.length > 0 && (
              <button onClick={() => setShowAddrForm(v => !v)} className="text-xs text-indigo-600 hover:underline">
                {showAddrForm ? 'Use saved' : 'Add new'}
              </button>
            )}
          </div>

          {!showAddrForm && addresses.length > 0 ? (
            <div className="space-y-2">
              {addresses.map(a => (
                <label key={a.id} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:border-indigo-300">
                  <input type="radio" value={a.id} checked={selectedAddr === a.id} onChange={() => setSelectedAddr(a.id)} className="mt-0.5 text-indigo-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{a.name}</p>
                    <p className="text-xs text-gray-500">{a.street}, {a.city}, {a.state} {a.zip}</p>
                    <p className="text-xs text-gray-400">{a.phone}</p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Full name" required><input value={aName} onChange={e => setAName(e.target.value)} className="form-input" placeholder="Kavya Nair" /></FormField>
                <FormField label="Email" required><input value={aEmail} onChange={e => setAEmail(e.target.value)} type="email" className="form-input" placeholder="kavya@example.com" /></FormField>
              </div>
              <FormField label="Street address" required><input value={aStreet} onChange={e => setAStreet(e.target.value)} className="form-input" placeholder="45 Anna Salai" /></FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="City" required><input value={aCity} onChange={e => setACity(e.target.value)} className="form-input" placeholder="Chennai" /></FormField>
                <FormField label="State" required><input value={aState} onChange={e => setAState(e.target.value)} className="form-input" placeholder="Tamil Nadu" /></FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="ZIP / Pincode" required><input value={aZip} onChange={e => setAZip(e.target.value)} className="form-input" placeholder="600034" /></FormField>
                <FormField label="Phone" required><input value={aPhone} onChange={e => setAPhone(e.target.value)} className="form-input" placeholder="+91 9500000001" /></FormField>
              </div>
              <Button size="sm" onClick={saveAddress} loading={savingAddr}>Save address</Button>
            </div>
          )}
        </div>

        {/* Payment */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <CreditCard size={16} className="text-indigo-600" /> Payment method
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map(m => (
              <label key={m.value} className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-gray-200 hover:border-indigo-300">
                <input type="radio" value={m.value} checked={paymentMethod === m.value} onChange={() => setPaymentMethod(m.value)} className="text-indigo-600" />
                <span className="text-sm text-gray-700">{m.label}</span>
              </label>
            ))}
          </div>
        </div>

        <Button className="w-full" size="lg" loading={placingOrder} onClick={placeOrder}>
          Place order
        </Button>
      </div>
    </div>
  );
}
