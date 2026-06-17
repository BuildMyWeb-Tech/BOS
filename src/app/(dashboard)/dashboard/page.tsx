'use client';
// src/app/(dashboard)/dashboard/page.tsx
//
// Dashboard overview — stat cards filtered by enabled modules.

import { useEffect, useState } from 'react';
import {
  CalendarDays, Package, ShoppingBag, Users, ReceiptText, TrendingUp,
} from 'lucide-react';
import StatCard          from '@/components/ui/StatCard';
import { ModuleGuard }   from '@/components/shared/PermissionGuard';
import { useAuth }       from '@/hooks/useAuth';
import type { DashboardStats } from '@/types';

export default function DashboardPage() {
  const { token, user }     = useAuth();
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/dashboard/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(json => { if (json.success) setStats(json.data.stats); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL ?? '₹';

  return (
    <div>
      {/* Page header */}
      <div className="page-header mb-8">
        <h1>
          Good {getGreeting()}, {user?.name.split(' ')[0]} 👋
        </h1>
        <p>Here's what's happening in your business today.</p>
      </div>

      {/* Revenue — always shown */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-muted)' }}>Revenue</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Today's Revenue"
            value={stats?.revenue.today ?? 0}
            prefix={currency}
            trend={undefined}
            accent="var(--color-brand)"
            icon={<TrendingUp size={16} className="text-indigo-600" />}
            isLoading={loading}
          />
          <StatCard
            title="This Month"
            value={stats?.revenue.thisMonth ?? 0}
            prefix={currency}
            trend={stats?.revenue.trend}
            accent="var(--color-success)"
            icon={<TrendingUp size={16} className="text-emerald-600" />}
            isLoading={loading}
          />
          <StatCard
            title="Total Customers"
            value={stats?.customers.total ?? 0}
            subtitle={`+${stats?.customers.newThisMonth ?? 0} this month`}
            accent="var(--color-info)"
            icon={<Users size={16} className="text-blue-600" />}
            isLoading={loading}
          />
        </div>
      </section>

      {/* Bookings — only if booking module enabled */}
      <ModuleGuard module="booking">
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--color-text-muted)' }}>Bookings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Today"
              value={stats?.bookings.today ?? 0}
              accent="var(--color-brand)"
              icon={<CalendarDays size={16} className="text-indigo-600" />}
              isLoading={loading}
            />
            <StatCard
              title="This Month"
              value={stats?.bookings.thisMonth ?? 0}
              accent="var(--color-brand-light)"
              isLoading={loading}
            />
            <StatCard
              title="Pending Payment"
              value={stats?.bookings.pending ?? 0}
              accent="var(--color-warning)"
              isLoading={loading}
            />
            <StatCard
              title="Confirmed"
              value={stats?.bookings.confirmed ?? 0}
              accent="var(--color-success)"
              isLoading={loading}
            />
          </div>
        </section>
      </ModuleGuard>

      {/* Inventory — only if inventory module enabled */}
      <ModuleGuard module="inventory">
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--color-text-muted)' }}>Inventory</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Products"
              value={stats?.products.total ?? 0}
              accent="var(--color-info)"
              icon={<Package size={16} className="text-blue-600" />}
              isLoading={loading}
            />
            <StatCard
              title="Low Stock"
              value={stats?.products.lowStock ?? 0}
              accent="var(--color-warning)"
              isLoading={loading}
            />
            <StatCard
              title="Out of Stock"
              value={stats?.products.outOfStock ?? 0}
              accent="var(--color-danger)"
              isLoading={loading}
            />
          </div>
        </section>
      </ModuleGuard>

      {/* Orders — only if ecommerce module enabled */}
      <ModuleGuard module="ecommerce">
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--color-text-muted)' }}>Orders</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Today"
              value={stats?.orders.today ?? 0}
              accent="var(--color-brand)"
              icon={<ShoppingBag size={16} className="text-indigo-600" />}
              isLoading={loading}
            />
            <StatCard
              title="This Month"
              value={stats?.orders.thisMonth ?? 0}
              accent="var(--color-brand-light)"
              isLoading={loading}
            />
            <StatCard
              title="Pending"
              value={stats?.orders.pending ?? 0}
              accent="var(--color-warning)"
              isLoading={loading}
            />
          </div>
        </section>
      </ModuleGuard>

      {/* Billing placeholder */}
      <ModuleGuard module="billing">
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--color-text-muted)' }}>Billing</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              title="Today's Billing Revenue"
              value={stats?.revenue.today ?? 0}
              prefix={currency}
              accent="var(--color-success)"
              icon={<ReceiptText size={16} className="text-emerald-600" />}
              isLoading={loading}
            />
            <StatCard
              title="This Month (Billing)"
              value={stats?.revenue.thisMonth ?? 0}
              prefix={currency}
              accent="var(--color-success)"
              isLoading={loading}
            />
          </div>
        </section>
      </ModuleGuard>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
