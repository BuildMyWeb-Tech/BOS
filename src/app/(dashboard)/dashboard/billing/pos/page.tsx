'use client';
// src/app/(dashboard)/dashboard/billing/pos/page.tsx
// POS — Point of Sale checkout screen.

import { useState, useMemo } from 'react';
import { useRouter }         from 'next/navigation';
import { Search, Plus, Minus, Trash2, ShoppingCart, ArrowLeft } from 'lucide-react';
import toast                 from 'react-hot-toast';

import Button       from '@/components/ui/Button';
import FormField    from '@/components/ui/FormField';
import { useFetch } from '@/hooks/useFetch';
import { apiCall }  from '@/lib/apiClient';
import type { ProductListItem } from '@/types';

interface CartLine {
  productId: string;
  variantId?: string | null;
  name:       string;
  size?:      string | null;
  unitPrice:  number;
  quantity:   number;
  discount:   number; // flat, per line
}

const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'SPLIT'] as const;
type PaymentMode = typeof PAYMENT_MODES[number];

function calcLine(line: CartLine): number {
  return Math.max(0, (line.unitPrice * line.quantity) - line.discount);
}

export default function POSPage() {
  const router = useRouter();
  const { data: productData } = useFetch<{ products: ProductListItem[] }>('/api/products?stockStatus=in_stock&limit=200');
  const products = productData?.products ?? [];

  const [search,       setSearch]       = useState('');
  const [cart,         setCart]         = useState<CartLine[]>([]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [paymentMode,  setPaymentMode]  = useState<PaymentMode>('CASH');
  const [paidAmount,   setPaidAmount]   = useState('');
  const [taxPercent,   setTaxPercent]   = useState(18); // pulled from settings ideally
  const [saving,       setSaving]       = useState(false);

  const filteredProducts = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase()))
    : products.slice(0, 24);

  function addToCart(product: ProductListItem) {
    setCart(prev => {
      const existing = prev.findIndex(l => l.productId === product.id && !l.variantId);
      if (existing >= 0) {
        return prev.map((l, i) => i === existing ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...prev, { productId: product.id, name: product.name, unitPrice: product.mrp, quantity: 1, discount: 0 }];
    });
    setSearch('');
  }

  function updateLine(i: number, field: keyof CartLine, value: number | string) {
    setCart(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }
  function removeLine(i: number) { setCart(prev => prev.filter((_, idx) => idx !== i)); }

  // Totals
  const subtotal = useMemo(() => cart.reduce((sum, l) => sum + calcLine(l), 0), [cart]);
  const taxableAmount = Math.max(0, subtotal - billDiscount);
  const taxAmount     = Math.round(taxableAmount * (taxPercent / 100) * 100) / 100;
  const total         = Math.round((taxableAmount + taxAmount) * 100) / 100;
  const change        = paidAmount ? Math.max(0, parseFloat(paidAmount) - total) : 0;

  async function handleCheckout() {
    if (cart.length === 0) { toast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      const bill = await apiCall<{ bill: { id: string; billNumber: string } }>('POST', '/api/bills', {
        items: cart.map(l => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity:  l.quantity,
          discount:  l.discount,
        })),
        billDiscount,
        paymentMode,
        paidAmount: paidAmount ? parseFloat(paidAmount) : undefined,
      });
      toast.success(`Bill ${bill.bill.billNumber} created`);
      router.push(`/dashboard/billing/${bill.bill.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create bill');
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-5">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft size={15} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Point of Sale</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: product picker */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search product by name or SKU…"
              className="form-input pl-8" />
          </div>

          {/* Product grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {filteredProducts.map(p => (
              <button key={p.id} onClick={() => addToCart(p)}
                className="bg-white rounded-xl border border-gray-200 p-3 text-left hover:border-indigo-300 hover:shadow-md transition-all group">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center mb-2 group-hover:bg-indigo-100 transition-colors">
                  <ShoppingCart size={14} className="text-indigo-600" />
                </div>
                <p className="text-xs font-semibold text-gray-900 truncate">{p.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">₹{p.mrp}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right: cart + checkout */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col" style={{ maxHeight: '85vh' }}>
          {/* Cart header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Cart ({cart.length})</h2>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700">Clear</button>
            )}
          </div>

          {/* Cart lines */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-300">
                <ShoppingCart size={28} />
                <p className="text-xs mt-2">Cart is empty</p>
              </div>
            ) : cart.map((line, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-medium text-gray-800 flex-1 min-w-0 truncate">{line.name}</p>
                  <button onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {/* Qty */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateLine(i, 'quantity', Math.max(1, line.quantity - 1))}
                      className="w-6 h-6 rounded-md bg-gray-200 flex items-center justify-center hover:bg-gray-300">
                      <Minus size={10} />
                    </button>
                    <span className="text-sm font-semibold w-6 text-center">{line.quantity}</span>
                    <button onClick={() => updateLine(i, 'quantity', line.quantity + 1)}
                      className="w-6 h-6 rounded-md bg-gray-200 flex items-center justify-center hover:bg-gray-300">
                      <Plus size={10} />
                    </button>
                  </div>
                  <span className="text-xs text-gray-400 flex-1">@ ₹{line.unitPrice}</span>
                  <span className="text-sm font-semibold text-gray-900">₹{calcLine(line).toLocaleString('en-IN')}</span>
                </div>
                {/* Line discount */}
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-xs text-gray-400">Discount ₹</span>
                  <input type="number" min="0" value={line.discount || ''}
                    onChange={e => updateLine(i, 'discount', parseFloat(e.target.value) || 0)}
                    className="form-input py-0.5 text-xs w-16 text-right" placeholder="0" />
                </div>
              </div>
            ))}
          </div>

          {/* Totals + checkout */}
          {cart.length > 0 && (
            <div className="border-t border-gray-100 p-4 space-y-3">
              {/* Bill discount */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">Bill discount (₹)</span>
                <input type="number" min="0" value={billDiscount || ''}
                  onChange={e => setBillDiscount(parseFloat(e.target.value) || 0)}
                  className="form-input py-1 text-xs w-24 text-right" placeholder="0" />
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {billDiscount > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Discount</span><span>-₹{billDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-500">
                  <span>Tax ({taxPercent}%)</span><span>₹{taxAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-1">
                  <span>Total</span><span>₹{total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Payment mode */}
              <div className="grid grid-cols-4 gap-1">
                {PAYMENT_MODES.map(m => (
                  <button key={m} onClick={() => setPaymentMode(m)}
                    className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      paymentMode === m ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 text-gray-600 hover:border-indigo-300'
                    }`}>{m}</button>
                ))}
              </div>

              {/* Paid amount (cash) */}
              {paymentMode === 'CASH' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Paid ₹</span>
                  <input type="number" min="0" value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                    className="form-input py-1 text-sm flex-1" placeholder={String(total)} />
                  {parseFloat(paidAmount) >= total && paidAmount && (
                    <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">
                      Change ₹{change.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              )}

              <Button className="w-full" onClick={handleCheckout} loading={saving}>
                Create bill · ₹{total.toLocaleString('en-IN')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
