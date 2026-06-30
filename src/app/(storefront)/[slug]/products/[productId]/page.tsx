'use client';
// src/app/(storefront)/[slug]/products/[productId]/page.tsx

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Package } from 'lucide-react';
import toast from 'react-hot-toast';

import Badge  from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import type { StorefrontProduct } from '@/types';

export default function ProductDetailPage() {
  const { slug, productId } = useParams<{ slug: string; productId: string }>();
  const router               = useRouter();

  const [product,    setProduct]    = useState<StorefrontProduct | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [variantId,  setVariantId]  = useState<string>('');
  const [quantity,   setQuantity]   = useState(1);
  const [adding,     setAdding]     = useState(false);

  const headers: Record<string, string> = { 'X-Tenant-Slug': slug };

  useEffect(() => {
    fetch(`/api/storefront/products`, { headers })
      .then(r => r.json())
      .then(json => {
        const found = (json.data?.products ?? []).find((p: StorefrontProduct) => p.id === productId);
        setProduct(found ?? null);
        if (found?.hasVariants && found.variants.length > 0) {
          setVariantId(found.variants[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [productId, slug]);

  const selectedVariant = product?.variants.find(v => v.id === variantId);
  const displayPrice    = selectedVariant?.price ?? product?.mrp ?? 0;
  const isInStock       = selectedVariant ? selectedVariant.inStock : (product?.inStock ?? false);

  async function handleAddToCart() {
    if (!product) return;
    setAdding(true);
    try {
      const res = await fetch('/api/cart/items', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body:    JSON.stringify({
          productId: product.id,
          variantId: variantId || undefined,
          quantity,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success('Added to cart');
      router.push(`/${slug}/cart`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add to cart');
    } finally { setAdding(false); }
  }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
        <div className="h-72 bg-gray-200 rounded-2xl" />
        <div className="space-y-3">
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      </div>
    </div>
  );

  if (!product) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <p className="text-gray-500">Product not found.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to store
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="h-72 md:h-96 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl flex items-center justify-center overflow-hidden">
          {product.images?.[0]
            ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover rounded-2xl" />
            : <Package size={64} className="text-indigo-200" />
          }
        </div>

        {/* Info */}
        <div className="flex flex-col">
          {product.categoryName && (
            <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wider mb-2">{product.categoryName}</p>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
          <p className="text-3xl font-bold text-indigo-600 mb-4">₹{displayPrice.toLocaleString('en-IN')}</p>

          <Badge label={isInStock ? 'In stock' : 'Out of stock'} variant={isInStock ? 'success' : 'neutral'} />

          {product.description && (
            <p className="text-sm text-gray-600 mt-4 leading-relaxed">{product.description}</p>
          )}

          {/* Variant selector */}
          {product.hasVariants && product.variants.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Size / Option</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map(v => (
                  <button key={v.id} onClick={() => setVariantId(v.id)}
                    disabled={!v.inStock}
                    className={`px-3 py-1.5 rounded-lg text-sm border font-medium transition-colors ${
                      variantId === v.id
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : v.inStock
                        ? 'border-gray-300 text-gray-700 hover:border-indigo-400'
                        : 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                    }`}>
                    {v.size}
                    {v.price !== product.mrp && ` · ₹${v.price}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center gap-3 mt-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold transition-colors">−</button>
              <span className="text-sm font-semibold w-6 text-center">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold transition-colors">+</button>
            </div>
          </div>

          {/* Add to cart */}
          <Button
            className="mt-6 w-full"
            disabled={!isInStock || (product.hasVariants && !variantId)}
            loading={adding}
            onClick={handleAddToCart}
          >
            <ShoppingCart size={16} />
            {isInStock ? 'Add to cart' : 'Out of stock'}
          </Button>
        </div>
      </div>
    </div>
  );
}
