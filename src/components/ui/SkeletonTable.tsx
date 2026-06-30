'use client';
// src/components/ui/SkeletonTable.tsx

interface SkeletonTableProps {
  rows?:    number;
  columns?: number;
}

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-gray-200 rounded animate-pulse ${className}`} />
  );
}

export { Skeleton };

export default function SkeletonTable({ rows = 5, columns = 5 }: SkeletonTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="grid gap-4 px-5 py-3.5 bg-gray-50 border-b border-gray-100"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-24" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r}
          className="grid gap-4 px-5 py-4 border-b border-gray-50 last:border-0"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? 'w-32' : 'w-20'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
