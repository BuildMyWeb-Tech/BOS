'use client';
// src/app/(dashboard)/dashboard/bookings/calendar/page.tsx

import { useState } from 'react';
import Link         from 'next/link';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

import Badge        from '@/components/ui/Badge';
import { useFetch } from '@/hooks/useFetch';
import type { BookingListItem, BookingStatus, RangeSlotAvailability } from '@/types';

const DAYS_LABEL = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function statusVariant(s: BookingStatus) {
  return s === 'CONFIRMED' ? 'success' : s === 'COMPLETED' ? 'info'
       : s === 'CANCELLED' ? 'danger' : s === 'PENDING_PAYMENT' ? 'warning' : 'neutral';
}

export default function BookingCalendarPage() {
  const router = useRouter();
  const today  = new Date();
  const [year,     setYear]     = useState(today.getFullYear());
  const [month,    setMonth]    = useState(today.getMonth() + 1);
  const [selected, setSelected] = useState<string>(today.toISOString().slice(0, 10));

  // Build from/to for the month
  const from = `${year}-${String(month).padStart(2,'0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to   = `${year}-${String(month).padStart(2,'0')}-${lastDay}`;

  // Fetch bookings for selected day
  const { data: dayData, loading: dayLoading } = useFetch<{ bookings: BookingListItem[] }>(
    `/api/bookings?from=${selected}&to=${selected}`,
    { deps: [selected] }
  );

  // Fetch all bookings for the month to show counts
  const { data: monthData, loading: monthLoading } = useFetch<{ bookings: BookingListItem[] }>(
    `/api/bookings?from=${from}&to=${to}`,
    { deps: [year, month] }
  );

  // Count bookings per date
  const countByDate = (monthData?.bookings ?? []).reduce<Record<string, number>>((acc, b) => {
    acc[b.date] = (acc[b.date] ?? 0) + 1;
    return acc;
  }, {});

  const firstDayOffset = (() => {
    const d = new Date(year, month - 1, 1).getDay();
    return d === 0 ? 6 : d - 1;
  })();
  const totalDays = new Date(year, month, 0).getDate();

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const todayStr   = today.toISOString().slice(0, 10);

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Bookings
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          {/* Nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold text-gray-900">{monthLabel}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={16} /></button>
          </div>
          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_LABEL.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>
          {/* Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day  = i + 1;
              const date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const count = countByDate[date] ?? 0;
              const isToday    = date === todayStr;
              const isSelected = date === selected;

              return (
                <button key={date} onClick={() => setSelected(date)}
                  className={`relative h-12 rounded-lg flex flex-col items-center justify-center text-sm font-medium transition-colors ${
                    isSelected ? 'bg-indigo-600 text-white'
                    : isToday  ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300'
                    : 'text-gray-700 hover:bg-gray-100'
                  }`}>
                  <span>{day}</span>
                  {count > 0 && (
                    <span className={`text-xs font-semibold mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-indigo-600'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day bookings */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            {new Date(selected + 'T00:00:00').toLocaleDateString('en-IN', { dateStyle: 'medium' })}
          </h2>
          {dayLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}
            </div>
          ) : (dayData?.bookings ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">No bookings on this day.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(dayData?.bookings ?? []).map(b => (
                <Link key={b.id} href={`/dashboard/bookings/${b.id}`}
                  className="block p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-indigo-600">{b.startTime}</span>
                    <Badge label={b.status.replace('_',' ')} variant={statusVariant(b.status)} />
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{b.customerName}</p>
                  <p className="text-xs text-gray-500 truncate">{b.serviceNames.join(', ')}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
