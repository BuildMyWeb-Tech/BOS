'use client';
// src/components/ui/SearchInput.tsx

import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value:       string;
  onChange:    (v: string) => void;
  placeholder?: string;
  debounce?:   number; // ms, default 300
}

export default function SearchInput({ value, onChange, placeholder = 'Search…', debounce = 300 }: SearchInputProps) {
  const [local, setLocal] = useState(value);

  // Sync external value → local (e.g. parent resets)
  useEffect(() => { setLocal(value); }, [value]);

  // Debounce local → parent
  useEffect(() => {
    const t = setTimeout(() => onChange(local), debounce);
    return () => clearTimeout(t);
  }, [local, debounce, onChange]);

  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={local}
        onChange={e => setLocal(e.target.value)}
        placeholder={placeholder}
        className="form-input pl-8 pr-8"
      />
      {local && (
        <button
          type="button"
          onClick={() => { setLocal(''); onChange(''); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
