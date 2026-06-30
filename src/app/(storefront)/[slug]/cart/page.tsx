'use client';
// src/app/(storefront)/[slug]/cart/page.tsx

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, ShoppingCart, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

import Button     from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import type { CartDetail, CouponValidationResult } from '@/types';

export default function CartPage() {
  const { slug } = useParams<{ slug: string }>();
  const router   = useRouter();

  const [cart,        setCart]        = useState<CartDetail | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [couponCode,  setCouponCode]  = useState('');
  const [coupon,      setCoupon]      = useState<CouponValidationResult | null>(null);
  const [validating,  setValidating]  = useState(false);
  const [updatingId,  setUpdatingId]  = useState<string | null>(null);

  const headers: Record<string, string> = { 'X-Tenant-Slug': slug };

  const loadCart = useCallback(() => {
    setLoading(true);
    fetch('/api/cart', { headers })
      .then(r => r.json())
      .then(json => { if (json.success) setCart(json.data.cart); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => { loadCart(); }, [loadCart]);

  async function updateQty(itemId: string, qty: number) {
    setUpdatingId(itemId);
    try {
      const res = await fetch(`/api/cart/items/${itemId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body:    JSON.stringify({ quantity: qty }),
      });
      if (!(await res.json()).success) throw new Error();
      loadCart();
    } catch { toast.error('Failed to update quantity'); }
    finally { setUpdatingId(null); }
  }

  async function removeItem(itemId: string) {
    setUpdatingId(itemId);
    try {
      await fetch(`/api/cart/items/${itemId}`, { method: 'DELETE', headers });
      loadCart();
    } catch { toast.error('Failed to remove item'); }
    finally { setUpdatingId(null); }
  }

  async function validateCoupon() {
    if (!couponCode.trim()) { toast.error('Enter a coupon code'); return; }
    setValidating(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body:    JSON.stringify({ code: couponCode.trim(), cartTotal: cart?.subtotal ?? 0 }),
      });
      const json = await res.json();
      const result: CouponValidationResult = json.data ?? json;
      setCoupon(result);
      if (result.valid) toast.success(`Coupon applied — ₹${result.discount} off`);
      else toast.error(result.reason ?? 'Invalid coupon');
    } catch { toast.error('Failed to validate coupon'); }
    finally { setValidating(false); }
  }

  const subtotal       = cart?.subtotal ?? 0;
  const couponDiscount = coupon?.valid ? (coupon.discount ?? 0) : 0;
  const orderTotal     = Math.max(0, subtotal - couponDiscount);

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft size={15} /> Continue shopping
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Cart ({cart?.itemCount ?? 0})
      </h1>

      {!cart || cart.items.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart size={24} />}
          title="Your cart is empty"
          description="Add products to your cart to get started."
          action={
            <button onClick={() => router.back()}
              className="text-sm text-indigo-600 hover:underline">
              Browse products
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {/* Cart items */}
          {cart.items.map(item => (
            <div key={item.id}
              className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4 transition-opacity ${updatingId === item.id ? 'opacity-50' : ''}`}>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <ShoppingCart size={18} className="text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
                {item.variantSize && (
                  <p className="text-xs text-gray-400">{item.variantSize}</p>
                )}
                <p className="text-sm font-bold text-indigo-600 mt-0.5">
                  ₹{item.lineTotal.toLocaleString('en-IN')}
                </p>
                {!item.available && (
                  <p className="text-xs text-red-500 mt-0.5">Insufficient stock</p>
                )}
              </div>
              {/* Qty controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => item.quantity > 1 ? updateQty(item.id, item.quantity - 1) : removeItem(item.id)}
                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600 transition-colors">−</button>
                <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                <button onClick={() => updateQty(item.id, item.quantity + 1)}
                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600 transition-colors">+</button>
              </div>
              <button onClick={() => removeItem(item.id)}
                className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          {/* Coupon */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="COUPON CODE"
                  className="form-input pl-8 text-sm uppercase tracking-widest" />
              </div>
              <Button variant="secondary" size="sm" onClick={validateCoupon} loading={validating}>
                Apply
              </Button>
            </div>
            {coupon?.valid && (
              <div className="flex items-center justify-between mt-2 text-sm text-emerald-600">
                <span>Coupon <strong>{coupon.code}</strong> applied</span>
                <span>-₹{coupon.discount}</span>
              </div>
            )}
          </div>

          {/* Order summary */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Coupon discount</span>
                <span>-₹{couponDiscount}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2">
              <span>Order total</span>
              <span>₹{orderTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <Button className="w-full" size="lg"
            onClick={() => router.push(`/${slug}/checkout`)}>
            Proceed to checkout
          </Button>
        </div>
      )}
    </div>
  );
}
