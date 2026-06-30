'use client';
// src/app/(dashboard)/dashboard/inventory/products/[id]/page.tsx

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Edit2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

import Badge        from '@/components/ui/Badge';
import Button       from '@/components/ui/Button';
import FormField    from '@/components/ui/FormField';
import Modal        from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/SkeletonTable';
import { useFetch } from '@/hooks/useFetch';
import { apiCall }  from '@/lib/apiClient';
import type { ProductDetail, StockStatus } from '@/types';

const ADJUSTMENT_REASONS = ['damaged', 'lost', 'correction', 'returned', 'other'] as const;

function stockVariant(s: StockStatus) {
  return s === 'in_stock' ? 'success' : s === 'low_stock' ? 'warning' : 'danger';
}
function stockLabel(s: StockStatus) {
  return s === 'in_stock' ? 'In stock' : s === 'low_stock' ? 'Low stock' : 'Out of stock';
}

export default function ProductDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const { data, loading, refetch } = useFetch<{ product: ProductDetail }>(`/api/products/${id}`);
  const product = data?.product;

  // Inline edit
  const [editing, setEditing]  = useState(false);
  const [eName,   setEName]    = useState('');
  const [eMrp,    setEMrp]     = useState('');
  const [saving,  setSaving]   = useState(false);

  // Stock adjustment modal
  const [adjOpen,   setAdjOpen]   = useState(false);
  const [adjDelta,  setAdjDelta]  = useState('');
  const [adjSign,   setAdjSign]   = useState<1|-1>(1);
  const [adjReason, setAdjReason] = useState<typeof ADJUSTMENT_REASONS[number]>('correction');
  const [adjNote,   setAdjNote]   = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Add batch modal
  const [batchOpen,     setBatchOpen]     = useState(false);
  const [batchQty,      setBatchQty]      = useState('');
  const [batchNum,      setBatchNum]      = useState('');
  const [batchExpiry,   setBatchExpiry]   = useState('');
  const [addingBatch,   setAddingBatch]   = useState(false);

  useEffect(() => {
    if (!product) return;
    setEName(product.name);
    setEMrp(String(product.mrp));
  }, [product]);

  async function handleSave() {
    setSaving(true);
    try {
      await apiCall('PATCH', `/api/products/${id}`, { name: eName.trim(), mrp: parseFloat(eMrp) });
      toast.success('Product updated');
      setEditing(false); refetch();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleAdjust() {
    const delta = adjSign * parseInt(adjDelta);
    if (!adjDelta || isNaN(delta) || delta === 0) { toast.error('Enter a valid quantity'); return; }
    setAdjusting(true);
    try {
      await apiCall('PATCH', `/api/inventory/${id}/adjust`, { delta, reason: adjReason, note: adjNote || undefined });
      toast.success('Stock adjusted');
      setAdjOpen(false); setAdjDelta(''); setAdjNote('');
      refetch();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setAdjusting(false); }
  }

  async function handleAddBatch() {
    if (!batchQty || parseInt(batchQty) <= 0) { toast.error('Enter valid quantity'); return; }
    setAddingBatch(true);
    try {
      await apiCall('POST', `/api/products/${id}/batches`, {
        quantity:    parseInt(batchQty),
        batchNumber: batchNum || undefined,
        expiryDate:  batchExpiry || undefined,
      });
      toast.success('Stock added');
      setBatchOpen(false); setBatchQty(''); setBatchNum(''); setBatchExpiry('');
      refetch();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setAddingBatch(false); }
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Skeleton className="h-6 w-40" /><Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-4 mt-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  );
  if (!product) return <p className="text-sm text-gray-500">Product not found.</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Inventory
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge label={stockLabel(product.stockStatus)} variant={stockVariant(product.stockStatus)} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
          {product.sku && <p className="text-sm text-gray-400 mt-0.5 font-mono">{product.sku}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setBatchOpen(true)}>
            <Plus size={13} /> Add stock
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAdjOpen(true)}>
            Adjust stock
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Product info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Details</h2>
            {!editing
              ? <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-indigo-600"><Edit2 size={12} /> Edit</button>
              : <div className="flex gap-1">
                  <button onClick={handleSave} disabled={saving} className="p-1 rounded text-emerald-600 hover:bg-emerald-50"><Check size={14} /></button>
                  <button onClick={() => setEditing(false)} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={14} /></button>
                </div>
            }
          </div>
          <div className="space-y-3">
            <FormField label="Name">
              {editing ? <input value={eName} onChange={e => setEName(e.target.value)} className="form-input" />
                : <p className="text-sm text-gray-800">{product.name}</p>}
            </FormField>
            <FormField label="MRP">
              {editing ? <input type="number" value={eMrp} onChange={e => setEMrp(e.target.value)} className="form-input" />
                : <p className="text-sm text-gray-800">₹{product.mrp}</p>}
            </FormField>
            <FormField label="Category">
              <p className="text-sm text-gray-800">{product.categoryName ?? '—'}</p>
            </FormField>
            <FormField label="Total stock">
              <p className="text-sm font-semibold text-gray-900">{product.totalStock} units</p>
            </FormField>
          </div>
        </div>

        {/* Variants or stock */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            {product.hasVariants ? `Variants (${product.variants.length})` : 'Stock batches'}
          </h2>
          {product.hasVariants ? (
            <div className="space-y-2">
              {product.variants.map(v => (
                <div key={v.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{v.size}</p>
                    <p className="text-xs text-gray-400">₹{v.price}</p>
                  </div>
                  <Badge
                    label={`${v.stock} units`}
                    variant={v.stock === 0 ? 'danger' : v.stock <= 5 ? 'warning' : 'success'}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {product.batches.length === 0
                ? <p className="text-sm text-gray-400">No stock batches yet.</p>
                : product.batches.map(b => (
                    <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        {b.batchNumber && <p className="text-xs font-mono text-gray-500">{b.batchNumber}</p>}
                        {b.expiryDate && <p className="text-xs text-gray-400">Expires {b.expiryDate.slice(0,10)}</p>}
                        {!b.batchNumber && !b.expiryDate && <p className="text-xs text-gray-400">Batch</p>}
                      </div>
                      <span className="text-sm font-medium text-gray-800">{b.remainingQty}/{b.quantity}</span>
                    </div>
                  ))
              }
            </div>
          )}
        </div>
      </div>

      {/* Adjust stock modal */}
      <Modal open={adjOpen} onClose={() => setAdjOpen(false)} title="Adjust stock" maxWidth="sm">
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setAdjSign(1)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${adjSign === 1 ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-300 text-gray-600'}`}>
              + Add stock
            </button>
            <button onClick={() => setAdjSign(-1)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${adjSign === -1 ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-600'}`}>
              − Remove stock
            </button>
          </div>
          <FormField label="Quantity" required>
            <input type="number" min="1" value={adjDelta} onChange={e => setAdjDelta(e.target.value)}
              placeholder="Enter quantity" className="form-input" />
          </FormField>
          <FormField label="Reason" required>
            <select value={adjReason} onChange={e => setAdjReason(e.target.value as typeof ADJUSTMENT_REASONS[number])} className="form-input">
              {ADJUSTMENT_REASONS.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
          </FormField>
          <FormField label="Note" hint="Optional — for your records.">
            <input value={adjNote} onChange={e => setAdjNote(e.target.value)} className="form-input" placeholder="e.g. 3 bottles broken in transit" />
          </FormField>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setAdjOpen(false)}>Cancel</Button>
            <Button size="sm" loading={adjusting} onClick={handleAdjust}>Apply adjustment</Button>
          </div>
        </div>
      </Modal>

      {/* Add batch modal */}
      <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title="Add stock batch" maxWidth="sm">
        <div className="space-y-4">
          <FormField label="Quantity received" required>
            <input type="number" min="1" value={batchQty} onChange={e => setBatchQty(e.target.value)}
              placeholder="e.g. 50" className="form-input" />
          </FormField>
          <FormField label="Batch number" hint="Optional — from supplier.">
            <input value={batchNum} onChange={e => setBatchNum(e.target.value)} placeholder="B-2026-001" className="form-input" />
          </FormField>
          <FormField label="Expiry date" hint="Optional — for FEFO stock rotation.">
            <input type="date" value={batchExpiry} onChange={e => setBatchExpiry(e.target.value)}
              min={new Date().toISOString().slice(0,10)} className="form-input" />
          </FormField>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setBatchOpen(false)}>Cancel</Button>
            <Button size="sm" loading={addingBatch} onClick={handleAddBatch}>Add stock</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
