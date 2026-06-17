'use client';
// src/app/(auth)/login/page.tsx

import { useState, useEffect } from 'react';
import { useRouter }  from 'next/navigation';
import toast          from 'react-hot-toast';
import { useAppDispatch }     from '@/hooks/store';
import { setAuth }            from '@/store';
import { saveTokens }         from '@/context/AuthProvider';
import type { AuthUser }      from '@/types';

export default function LoginPage() {
  const router    = useRouter();
  const dispatch  = useAppDispatch();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);

  // Detect tenant from subdomain (client-side)
  useEffect(() => {
    const host = window.location.hostname;
    const parts = host.split('.');
    if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
      setTenantSlug(parts.slice(0, -1).join('.'));
    } else if (parts.length >= 3) {
      setTenantSlug(parts.slice(0, -2).join('.'));
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error ?? 'Login failed');
        return;
      }

      const { token, refreshToken, user } = json.data;

      const authUser: AuthUser = {
        id:          user.id,
        name:        user.name,
        email:       user.email,
        image:       user.image ?? '',
        role:        user.role,
        tenantId:    user.tenantId,
        permissions: user.permissions,
      };

      // Persist tokens
      saveTokens(token, refreshToken);

      // Hydrate Redux store
      dispatch(setAuth({ user: authUser, token, refreshToken }));

      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);

      // Redirect based on role
      if (user.role === 'SUPER_ADMIN') {
        router.replace('/super-admin');
      } else if (user.role === 'CUSTOMER') {
        router.replace('/account');
      } else {
        router.replace('/dashboard');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
            <span className="text-white font-bold text-xl">B</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-1">
          {tenantSlug ? `Sign in` : 'BOS Admin'}
        </h1>
        <p className="text-sm text-gray-400 text-center mb-8">
          {tenantSlug
            ? `Signing into ${tenantSlug}`
            : 'Business Operating System'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors mt-2"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
