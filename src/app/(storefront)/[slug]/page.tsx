'use client';
// src/app/(storefront)/[slug]/page.tsx
// Improved storefront with:
// - Dynamic navbar with store logo, cart count, My Orders, My Bookings links
// - Better service cards with image, duration, price, Book Now
// - Better product grid with category filter
// - All public API calls — no JWT needed

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingCart, Search, Package, Calendar, Store,
  ArrowRight, User, X, Menu, Scissors,
  Clock, MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';

import Badge      from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import type { StorefrontProduct, TenantModules } from '@/types';

// ─── Types ───────────────────────────────────────────────────────

interface PublicTenant {
  id: string; name: string; slug: string;
  businessType: string; description: string | null;
  logo: string | null; modules: TenantModules;
}
interface PublicService {
  id: string; name: string; duration: number; price: number;
  image: string | null; description: string | null;
  category: { id: string; name: string } | null;
}
interface Category { id: string; name: string; productCount: number }

// ─── Skeleton ────────────────────────────────────────────────────

function Skel({ className }: { className: string }) {
  return <div className={`bg-gray-200 animate-pulse rounded-xl ${className}`} />;
}

// ─── Navbar ──────────────────────────────────────────────────────

function Navbar({
  tenant, slug, cartCount, isLoggedIn, onLogout,
}: {
  tenant: PublicTenant;
  slug: string;
  cartCount: number;
  isLoggedIn: boolean;
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasEcommerce = tenant.modules.ecommerce;
  const hasBooking   = tenant.modules.booking;

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Brand */}
          <Link href={`/${slug}`} className="flex items-center gap-3">
            {tenant.logo
              ? <img src={tenant.logo} alt={tenant.name} className="w-8 h-8 rounded-lg object-cover" />
              : <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{tenant.name[0]}</span>
                </div>
            }
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-gray-900 leading-none">{tenant.name}</p>
              <p className="text-xs text-gray-400 capitalize mt-0.5">{tenant.businessType}</p>
            </div>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {hasBooking && (
              <>
                <Link href={`/${slug}`}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-medium">
                  Services
                </Link>
                <Link href={`/${slug}/my-bookings`}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-medium">
                  My Appointments
                </Link>
              </>
            )}
            {hasEcommerce && (
              <>
                <Link href={`/${slug}`}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-medium">
                  Shop
                </Link>
                <Link href={`/${slug}/my-orders`}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-medium">
                  My Orders
                </Link>
              </>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">

            {/* Cart */}
            {hasEcommerce && (
              <Link href={`/${slug}/cart`}
                className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
                <ShoppingCart size={20} className="text-gray-700" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>
            )}

            {/* User */}
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User size={15} className="text-indigo-600" />
                </div>
                <button onClick={onLogout}
                  className="hidden sm:block text-xs text-gray-500 hover:text-red-500 transition-colors">
                  Logout
                </button>
              </div>
            ) : (
              <Link href={`/${slug}/customer-login`}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors">
                <User size={13} /> Sign in
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button onClick={() => setMenuOpen(v => !v)}
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors">
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 space-y-1">
            {hasBooking && (
              <Link href={`/${slug}/my-bookings`} onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors">
                📅 My Appointments
              </Link>
            )}
            {hasEcommerce && (
              <>
                <Link href={`/${slug}/cart`} onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors">
                  🛒 Cart {cartCount > 0 && `(${cartCount})`}
                </Link>
                <Link href={`/${slug}/my-orders`} onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors">
                  📦 My Orders
                </Link>
              </>
            )}
            {!isLoggedIn ? (
              <Link href={`/${slug}/customer-login`} onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                Sign in / Register
              </Link>
            ) : (
              <button onClick={() => { onLogout(); setMenuOpen(false); }}
                className="block w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                Logout
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

// ─── Service card ────────────────────────────────────────────────

function ServiceCard({ s, slug }: { s: PublicService; slug: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-100 transition-all group">
      <div className="h-40 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 relative overflow-hidden">
        {s.image
          ? <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center">
              <Scissors size={36} className="text-indigo-200" />
            </div>
        }
        {s.category && (
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-indigo-600 text-xs font-semibold px-2 py-0.5 rounded-full">
            {s.category.name}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
          {s.name}
        </h3>
        {s.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{s.description}</p>
        )}
        <div className="flex items-center gap-3 mt-3">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock size={12} /> {s.duration} min
          </span>
          <span className="text-base font-bold text-indigo-600">
            ₹{s.price.toLocaleString('en-IN')}
          </span>
        </div>
        <Link href={`/${slug}/bookings/new?serviceId=${s.id}`}
          className="mt-3 flex items-center justify-center gap-1.5 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
          <Calendar size={14} /> Book now
        </Link>
      </div>
    </div>
  );
}

// ─── Product card ────────────────────────────────────────────────

function ProductCard({
  p, slug, onAdd,
}: { p: StorefrontProduct; slug: string; onAdd: (id: string) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-100 transition-all group">
      <Link href={`/${slug}/products/${p.id}`}>
        <div className="h-44 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative overflow-hidden">
          {p.images?.[0]
            ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            : <Package size={40} className="text-gray-300" />
          }
          {!p.inStock && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="bg-white text-gray-700 text-xs font-semibold px-2 py-1 rounded-full">Out of stock</span>
            </div>
          )}
        </div>
      </Link>
      <div className="p-3">
        <Link href={`/${slug}/products/${p.id}`}>
          <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
            {p.name}
          </p>
        </Link>
        {p.categoryName && (
          <p className="text-xs text-gray-400 mt-0.5">{p.categoryName}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <p className="text-base font-bold text-indigo-600">
            ₹{p.mrp.toLocaleString('en-IN')}
          </p>
          {p.inStock && !p.hasVariants && (
            <button onClick={() => onAdd(p.id)}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
              Add
            </button>
          )}
          {p.hasVariants && (
            <Link href={`/${slug}/products/${p.id}`}
              className="text-xs text-indigo-600 hover:underline font-medium">
              Options
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Hero banner ─────────────────────────────────────────────────

function Hero({ tenant, slug, hasBooking }: {
  tenant: PublicTenant; slug: string; hasBooking: boolean;
}) {
  return (
    <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 text-white">
      <div className="max-w-6xl mx-auto px-4 py-12 flex items-center gap-6">
        {tenant.logo
          ? <img src={tenant.logo} alt={tenant.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-white/30 flex-shrink-0 hidden sm:block" />
          : <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 hidden sm:block">
              <Store size={32} className="text-white/80" />
            </div>
        }
        <div>
          <h1 className="text-3xl font-bold">{tenant.name}</h1>
          <p className="text-indigo-200 capitalize mt-1">{tenant.businessType}</p>
          {tenant.description && (
            <p className="text-indigo-100 text-sm mt-2 max-w-lg">{tenant.description}</p>
          )}
          {hasBooking && (
            <div className="flex items-center gap-1.5 text-indigo-200 text-sm mt-3">
              <MapPin size={13} /> Appointments available — book instantly
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────

export default function StorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const headers  = { 'X-Tenant-Slug': slug };

  const [tenant,        setTenant]        = useState<PublicTenant | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [products,      setProducts]      = useState<StorefrontProduct[]>([]);
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [services,      setServices]      = useState<PublicService[]>([]);
  const [prodLoading,   setProdLoading]   = useState(false);
  const [svcLoading,    setSvcLoading]    = useState(false);
  const [search,        setSearch]        = useState('');
  const [catFilter,     setCatFilter]     = useState('');
  const [cartCount,     setCartCount]     = useState(0);
  const [isLoggedIn,    setIsLoggedIn]    = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!sessionStorage.getItem(`bos_customer_${slug}`));
  }, [slug]);

  function handleLogout() {
    sessionStorage.removeItem(`bos_customer_${slug}`);
    setIsLoggedIn(false);
    toast.success('Logged out');
  }

  useEffect(() => {
    fetch(`/api/storefront/tenant?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(json => { if (json.success) setTenant(json.data.tenant); })
      .catch(() => {})
      .finally(() => setTenantLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!tenant) return;

    if (tenant.modules.booking) {
      setSvcLoading(true);
      fetch('/api/storefront/services', { headers })
        .then(r => r.json())
        .then(json => { if (json.success) setServices(json.data.services ?? []); })
        .catch(() => {})
        .finally(() => setSvcLoading(false));
    }

    if (tenant.modules.ecommerce) {
      setProdLoading(true);
      fetch('/api/storefront/products', { headers })
        .then(r => r.json())
        .then(json => { if (json.success) setProducts(json.data.products ?? json.data.items ?? []); })
        .catch(() => {})
        .finally(() => setProdLoading(false));

      fetch('/api/storefront/categories', { headers })
        .then(r => r.json())
        .then(json => { if (json.success) setCategories(json.data.categories ?? []); })
        .catch(() => {});
    }
  }, [tenant]);

  const addToCart = useCallback(async (productId: string) => {
    const token = sessionStorage.getItem(`bos_customer_${slug}`);
    if (!token) {
      window.location.href = `/${slug}/customer-login?return=${encodeURIComponent(`/${slug}`)}`;
      return;
    }
    try {
      const res  = await fetch('/api/cart/items', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers },
        body:    JSON.stringify({ productId, quantity: 1 }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setCartCount(c => c + 1);
      toast.success('Added to cart!');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not add to cart');
    }
  }, [slug]);

  const filtered = products.filter(p => {
    const ms = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const mc = !catFilter || p.categoryId === catFilter;
    return ms && mc;
  });

  const hasBooking   = tenant?.modules.booking   === true;
  const hasEcommerce = tenant?.modules.ecommerce === true;
  const hasAnything  = hasBooking || hasEcommerce;

  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-16 bg-white border-b border-gray-100 animate-pulse" />
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          <Skel className="h-40 rounded-2xl" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skel key={i} className="h-56" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Store size={36} className="text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Store not found</h1>
          <p className="text-gray-400 text-sm">
            The business <strong className="text-gray-600">{slug}</strong> does not exist or is not yet active.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        tenant={tenant} slug={slug}
        cartCount={cartCount} isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
      />

      <Hero tenant={tenant} slug={slug} hasBooking={hasBooking} />

      <div className="max-w-6xl mx-auto px-4 py-8">

        {!hasAnything && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center mt-4">
            <Store size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Coming soon</p>
            <p className="text-sm text-gray-400 mt-1">This business is not taking online bookings or orders yet.</p>
          </div>
        )}

        {/* ══ BOOKING ══════════════════════════════════════════ */}
        {hasBooking && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Calendar size={22} className="text-indigo-600" /> Services
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Book your appointment online — instant confirmation
                </p>
              </div>
              <Link href={`/${slug}/my-bookings`}
                className="hidden sm:flex items-center gap-1.5 text-sm text-indigo-600 hover:underline font-medium">
                My appointments <ArrowRight size={14} />
              </Link>
            </div>

            {svcLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-64" />)}
              </div>
            ) : services.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <Scissors size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No services available at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {services.map(s => <ServiceCard key={s.id} s={s} slug={slug} />)}
              </div>
            )}
          </section>
        )}

        {/* ══ ECOMMERCE ═════════════════════════════════════════ */}
        {hasEcommerce && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingCart size={22} className="text-indigo-600" /> Shop
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {products.length} product{products.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Link href={`/${slug}/my-orders`}
                className="hidden sm:flex items-center gap-1.5 text-sm text-indigo-600 hover:underline font-medium">
                My orders <ArrowRight size={14} />
              </Link>
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="w-full border border-gray-200 bg-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 shadow-sm" />
              </div>
              {categories.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => setCatFilter('')}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${!catFilter ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                    All
                  </button>
                  {categories.map(c => (
                    <button key={c.id} onClick={() => setCatFilter(c.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${catFilter === c.id ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {prodLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <Skel key={i} className="h-60" />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={<Package size={24} />} title="No products found"
                description={search ? 'Try a different search term.' : 'No products available yet.'} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map(p => <ProductCard key={p.id} p={p} slug={slug} onAdd={addToCart} />)}
              </div>
            )}

            {cartCount > 0 && (
              <div className="fixed bottom-6 right-6 z-50">
                <Link href={`/${slug}/cart`}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold transition-all hover:scale-105">
                  <ShoppingCart size={16} />
                  View cart ({cartCount}) <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}