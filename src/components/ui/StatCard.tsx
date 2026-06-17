'use client';
// src/components/ui/StatCard.tsx

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title:       string;
  value:       string | number;
  subtitle?:   string;
  trend?:      number;    // % change, positive/negative/zero
  icon?:       React.ReactNode;
  accent?:     string;    // CSS color for left border
  prefix?:     string;    // e.g. "₹"
  isLoading?:  boolean;
}

export default function StatCard({
  title, value, subtitle, trend, icon, accent, prefix, isLoading,
}: StatCardProps) {
  const trendColor = trend === undefined ? '' : trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-gray-400';
  const TrendIcon  = trend === undefined ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

  if (isLoading) {
    return (
      <div className="stat-card animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
        <div className="h-8 bg-gray-200 rounded w-32 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-20" />
      </div>
    );
  }

  return (
    <div
      className="stat-card"
      style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {title}
        </p>
        {icon && (
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--color-surface-raised)' }}>
            {icon}
          </div>
        )}
      </div>

      <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
        {prefix}{typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </p>

      <div className="flex items-center gap-2 mt-2">
        {subtitle && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>
        )}
        {trend !== undefined && TrendIcon && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
            <TrendIcon size={12} />
            {Math.abs(trend)}% vs last month
          </span>
        )}
      </div>
    </div>
  );
}
