'use client';
// src/components/ui/Badge.tsx

interface BadgeProps {
  label:   string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';
  size?:   'sm' | 'md';
}

const VARIANT_STYLES: Record<BadgeProps['variant'], string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50  text-amber-700  ring-amber-200',
  danger:  'bg-red-50    text-red-700    ring-red-200',
  info:    'bg-blue-50   text-blue-700   ring-blue-200',
  neutral: 'bg-gray-100  text-gray-600   ring-gray-200',
  brand:   'bg-indigo-50 text-indigo-700 ring-indigo-200',
};

export default function Badge({ label, variant, size = 'sm' }: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center rounded-full font-medium ring-1 ring-inset
      ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}
      ${VARIANT_STYLES[variant]}
    `}>
      {label}
    </span>
  );
}
