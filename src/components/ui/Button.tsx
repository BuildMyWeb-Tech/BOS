'use client';
// src/components/ui/Button.tsx

import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  'primary' | 'secondary' | 'danger' | 'ghost';
  size?:     'sm' | 'md' | 'lg';
  loading?:  boolean;
  children:  React.ReactNode;
}

const VARIANTS = {
  primary:   'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-300 shadow-sm',
  danger:    'bg-red-600 hover:bg-red-500 text-white shadow-sm',
  ghost:     'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
};

export default function Button({
  variant = 'primary', size = 'md', loading = false,
  disabled, children, className = '', ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-medium rounded-lg
        transition-colors focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-indigo-500 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${SIZES[size]} ${className}
      `}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
