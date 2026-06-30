'use client';
// src/app/(auth)/login/page.tsx
//
// Single login page for all roles.
// After login:
//   SUPER_ADMIN       → /super-admin/vendors
//   VENDOR_OWNER/STAFF → /dashboard

import { useState, useEffect } from 'react';
import { useRouter }           from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import toast                   from 'react-hot-toast';
import { saveTokens }          from '@/context/AuthProvider';
import { useAuth }             from '@/hooks/useAuth';

export default function LoginPage() {
  const router          = useRouter();
  const { isLoggedIn, isHydrated, role } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  // If already logged in, redirect
  useEffect(() => {
    if (!isHydrated || !isLoggedIn) return;
    if (role === 'SUPER_ADMIN') router.replace('/super-admin/vendors');
    else router.replace('/dashboard');
  }, [isHydrated, isLoggedIn, role, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { toast.error('Enter your email and password'); return; }

    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Login failed');

      const { token, refreshToken, user } = json.data;
      saveTokens(token, refreshToken);

      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);

      // Redirect based on role
      if (user.role === 'SUPER_ADMIN') router.replace('/super-admin/vendors');
      else router.replace('/dashboard');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sign in to BOS</h1>
          <p className="text-sm text-gray-500 mt-1">Business Operating System</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-7 space-y-4">
          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@business.com"
              autoComplete="email"
              required
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Password</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="form-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          BOS — Multi-Tenant Business Platform
        </p>
      </div>
    </div>
  );
}
