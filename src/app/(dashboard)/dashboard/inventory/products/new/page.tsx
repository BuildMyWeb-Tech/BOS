'use client';
// src/app/(dashboard)/dashboard/inventory/products/new/page.tsx

import { useState }     from 'react';
import { useRouter }    from 'next/navigation';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import toast            from 'react-hot-toast';

import PageHeader from '@/components/ui/PageHeader';
import FormField  from '@/components/ui/FormField';
import Button     from '@/components/ui/Button';
import { useFetch }  from '@/hooks/useFetch';
import { apiCall, ApiError } from '@/lib/apiClient';
import type { ProductCategoryItem } from '@/types';

interface Variant { size: string; price: string }

export default function NewProductPage() {
  const router  = useRouter();
  const { data } = useFetch<{ categories: ProductCategoryItem[] }>('/api/products/categories');
  const categories = data?.categories ?? [];

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [mrp,         setMrp]         = useState('');
  const [sku,         setSku]         = useState('');
  const [categoryId,  setCategoryId]  = useState('');
  const [hasVariants, setHasVariants] = useState(false);
  const [variants,    setVariants]    = useState<Variant[]>([{ size: '', price: '' }]);
  const [initQty,     setInitQty]     = useState('');
  const [lowStock,    setLowStock]    = useState('10');
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  function addVariant() { setVariants(v => [...v, { size: '', price: '' }]); }
  function removeVariant(i: number) { setVariants(v => v.filter((_, idx) => idx !== i)); }
  function updateVariant(i: number, field: keyof Variant, val: string) {
    setVariants(v => v.map((vr, idx) => idx === i ? { ...vr, [field]: val } : vr));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!hasVariants && !mrp) errs.mrp = 'MRP is required for products without variants';
    if (hasVariants) {
      if (variants.some(v => !v.size.trim())) errs.variants = 'Every variant needs a size label';
      if (variants.some(v => !v.price || parseFloat(v.price) < 0)) errs.variants = 'Every variant needs a valid price';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await apiCall('POST', '/api/products', {
        name:    name.trim(),
        description: description || undefined,
        mrp:     !hasVariants ? parseFloat(mrp) : undefined,
        sku:     sku || undefined,
        categoryId: categoryId || undefined,
        variants: hasVariants ? variants.map(v => ({ size: v.size.trim(), price: parseFloat(v.price) })) : undefined,
        initialQuantity: !hasVariants && initQty ? parseInt(initQty) : undefined,
        lowStockThreshold: parseInt(lowStock),
      });
      toast.success(`${name.trim()} added`);
      router.push('/dashboard/inventory');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create product');
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Inventory
      </button>
      <PageHeader title="Add product" />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Product info</h2>
          <FormField label="Product name" required error={errors.name}>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Kerastase Shampoo 250ml" className={`form-input ${errors.name ? 'error' : ''}`} />
          </FormField>
          <FormField label="Description">
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} className="form-input resize-none" placeholder="Optional product description" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="SKU" hint="Optional internal code.">
              <input value={sku} onChange={e => setSku(e.target.value)} placeholder="KER-SHM-250" className="form-input" />
            </FormField>
            <FormField label="Category">
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="form-input">
                <option value="">No category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          </div>
        </div>

        {/* Pricing & variants */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pricing</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-600">Has variants (sizes)</span>
              <input type="checkbox" checked={hasVariants} onChange={e => setHasVariants(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            </label>
          </div>

          {!hasVariants ? (
            <div className="grid grid-cols-2 gap-4">
              <FormField label="MRP (₹)" required error={errors.mrp}>
                <input type="number" min="0" value={mrp} onChange={e => setMrp(e.target.value)}
                  placeholder="0.00" className={`form-input ${errors.mrp ? 'error' : ''}`} />
              </FormField>
              <FormField label="Initial stock" hint="Leave blank to add stock later.">
                <input type="number" min="0" value={initQty} onChange={e => setInitQty(e.target.value)}
                  placeholder="0" className="form-input" />
              </FormField>
            </div>
          ) : (
            <div className="space-y-2">
              {errors.variants && <p className="form-error">{errors.variants}</p>}
              {variants.map((v, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <FormField label={i === 0 ? 'Size / variant' : ''}>
                    <input value={v.size} onChange={e => updateVariant(i, 'size', e.target.value)}
                      placeholder="S / 250ml / Red" className="form-input" />
                  </FormField>
                  <FormField label={i === 0 ? 'Price (₹)' : ''}>
                    <input type="number" min="0" value={v.price} onChange={e => updateVariant(i, 'price', e.target.value)}
                      placeholder="0.00" className="form-input" />
                  </FormField>
                  <button type="button" onClick={() => removeVariant(i)} disabled={variants.length === 1}
                    className={`mt-${i === 0 ? '5' : '0'} p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors flex-shrink-0`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addVariant}
                className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
                <Plus size={13} /> Add variant
              </button>
            </div>
          )}
        </div>

        {/* Stock config */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Stock alerts</h2>
          <FormField label="Low-stock threshold" hint="Alert when quantity falls to or below this number.">
            <input type="number" min="0" value={lowStock} onChange={e => setLowStock(e.target.value)}
              className="form-input w-28" />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pb-6">
          <Button variant="secondary" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={saving}>Add product</Button>
        </div>
      </form>
    </div>
  );
}
