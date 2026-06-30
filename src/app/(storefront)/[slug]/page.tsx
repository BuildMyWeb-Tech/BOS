'use client';
// src/app/(storefront)/[slug]/page.tsx
// Public-facing storefront for a tenant identified by slug.

import { useState, useEffect } from 'react';
import { useParams }           from 'next/navigation';
import Link                    from 'next/link';
import { ShoppingCart, Search, Package } from 'lucide-react';
import toast                   from 'react-hot-toast';

import Badge      from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import type { StorefrontProduct } from '@/types';

// Storefront uses public API — no auth token needed.
// Host header resolved by Next.js middleware from the slug in the URL.

export default function StorefrontPage() {
  const { slug } = useParams<{ slug: string }>();

  const [products,   setProducts]   = useState<StorefrontProduct[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState('');
  const [loading,    setLoading]    = useState(true);
  const [cartCount,  setCartCount]  = useState(0);

  // Build a Host header from the slug so the middleware resolves the tenant
  const headers: Record<string, string> = { 'X-Tenant-Slug': slug };

  useEffect(() => {
    fetch('/api/storefront/products', { headers })
      .then(r => r.json())
      .then(json => {
        if (json.success) setProducts(json.data.products ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch('/api/products/categories', { headers })
      .then(r => r.json())
      .then(json => { if (json.success) setCategories(json.data.categories ?? []); })
      .catch(() => {});
  }, [slug]);

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat    = !catFilter || p.categoryId === catFilter;
    return matchSearch && matchCat;
  });

  async function addToCart(productId: string, variantId?: string) {
    try {
      const res = await fetch('/api/cart/items', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body:    JSON.stringify({ productId, variantId, quantity: 1 }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setCartCount(c => c + 1);
      toast.success('Added to cart');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not add to cart');
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Nav */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 capitalize">{slug.replace(/-/g, ' ')}</h1>
          <p className="text-sm text-gray-500">{products.length} products</p>
        </div>
        <Link href={`/${slug}/cart`}
          className="relative flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <ShoppingCart size={16} />
          Cart
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="form-input pl-8 w-full" />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          <button onClick={() => setCatFilter('')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${!catFilter ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            All
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setCatFilter(c.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${catFilter === c.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-32 bg-gray-100 rounded-lg mb-3" />
              <div className="h-4 bg-gray-100 rounded mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Package size={20} />} title="No products found" description="Try a different search or category." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all group">
              {/* Image placeholder */}
              <Link href={`/${slug}/products/${p.id}`}>
                <div className="h-36 bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center">
                  {p.images?.[0]
                    ? <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                    : <Package size={32} className="text-indigo-300" />
                  }
                </div>
              </Link>
              <div className="p-3">
                <Link href={`/${slug}/products/${p.id}`}>
                  <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                    {p.name}
                  </p>
                </Link>
                <p className="text-sm font-bold text-indigo-600 mt-0.5">₹{p.mrp.toLocaleString('en-IN')}</p>
                <div className="flex items-center justify-between mt-2">
                  <Badge
                    label={p.inStock ? 'In stock' : 'Out of stock'}
                    variant={p.inStock ? 'success' : 'neutral'}
                  />
                  {p.inStock && !p.hasVariants && (
                    <button onClick={() => addToCart(p.id)}
                      className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-md transition-colors">
                      Add
                    </button>
                  )}
                  {p.hasVariants && (
                    <Link href={`/${slug}/products/${p.id}`}
                      className="text-xs text-indigo-600 hover:underline">
                      Options
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
