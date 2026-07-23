'use client';
// src/app/(storefront)/[slug]/customer-login/page.tsx
// Lightweight customer login/register for the ecommerce storefront.
// Stores token in sessionStorage so cart/checkout APIs work.
// Separate from the vendor dashboard login at /login.

import { useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ShoppingCart, User, Phone, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CustomerLoginPage() {
  const { slug }     = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const returnUrl    = searchParams.get('return') ?? `/${slug}`;
  const headers      = { 'X-Tenant-Slug': slug };

  const [mode,     setMode]     = useState<'login' | 'register'>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { toast.error('Enter email and password'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Login failed');
      // Store token for this slug's storefront session
      sessionStorage.setItem(`bos_customer_${slug}`, json.data.token);
      toast.success('Logged in!');
      router.push(returnUrl);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Login failed');
    } finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) { toast.error('Fill all required fields'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      // Register as a CUSTOMER user under this tenant
      const res  = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ name, email, password, phone: phone || undefined }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Registration failed');
      sessionStorage.setItem(`bos_customer_${slug}`, json.data.token);
      toast.success('Account created!');
      router.push(returnUrl);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Registration failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md">
        {/* Icon */}
        <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <ShoppingCart size={26} className="text-indigo-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 text-center mb-1">
          {mode === 'login' ? 'Sign in to continue' : 'Create an account'}
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          {mode === 'login' ? 'Sign in to add items to cart and place orders.' : 'Create an account to shop and track your orders.'}
        </p>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {m === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={name} onChange={e => setName(e.target.value)} required
                  placeholder="Full name" type="text"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div className="relative">
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="Phone (optional)" type="tel"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
            </>
          )}
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="Email address" type="email"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="Password" type="password"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            {loading
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Please wait…</>
              : mode === 'login' ? 'Sign in' : 'Create account'
            }
          </button>
        </form>

        <button onClick={() => router.push(`/${slug}`)}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4">
          ← Back to store
        </button>
      </div>
    </div>
  );
}
