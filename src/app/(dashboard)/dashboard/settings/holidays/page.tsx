'use client';
// src/app/(dashboard)/dashboard/settings/holidays/page.tsx
//
// Holiday management — interactive calendar + lists.

import { useState, useMemo } from 'react';
import { useRouter }         from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Trash2, CalendarCheck } from 'lucide-react';
import toast                 from 'react-hot-toast';

import Button        from '@/components/ui/Button';
import Badge         from '@/components/ui/Badge';
import Modal         from '@/components/ui/Modal';
import FormField     from '@/components/ui/FormField';
import { useFetch }  from '@/hooks/useFetch';
import { apiCall }   from '@/lib/apiClient';
import type { CalendarMonthView, BlockedDate, RecurringHoliday } from '@/types';

// ─── Mini calendar ────────────────────────────────────────────────

function CalendarHeader({ year, month, onPrev, onNext }: {
  year: number; month: number; onPrev: () => void; onNext: () => void;
}) {
  const label = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  return (
    <div className="flex items-center justify-between mb-4">
      <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={16} /></button>
      <span className="text-sm font-semibold text-gray-900">{label}</span>
      <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={16} /></button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────

export default function HolidaysPage() {
  const router = useRouter();
  const today  = new Date();

  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const { data: calData, loading: calLoading, refetch: refetchCal } =
    useFetch<CalendarMonthView>(`/api/holidays/calendar?year=${year}&month=${month}`, { deps: [year, month] });

  const { data: blockedData, refetch: refetchBlocked } =
    useFetch<{ blockedDates: BlockedDate[] }>('/api/holidays/blocked-dates');

  const { data: recurringData, refetch: refetchRecurring } =
    useFetch<{ holidays: RecurringHoliday[] }>('/api/holidays/recurring');

  const blockedDates   = blockedData?.blockedDates   ?? [];
  const recurringHols  = recurringData?.holidays     ?? [];
  const calDays        = calData?.days               ?? [];

  // Add blocked date modal
  const [blockOpen,  setBlockOpen]  = useState(false);
  const [blockDate,  setBlockDate]  = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blocking,   setBlocking]   = useState(false);

  // Add recurring holiday modal
  const [recurOpen,   setRecurOpen]   = useState(false);
  const [recurName,   setRecurName]   = useState('');
  const [recurType,   setRecurType]   = useState<'weekly' | 'monthly'>('weekly');
  const [recurValue,  setRecurValue]  = useState('Sunday');
  const [addingRecur, setAddingRecur] = useState(false);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  async function handleBlockDate() {
    if (!blockDate) { toast.error('Select a date'); return; }
    setBlocking(true);
    try {
      await apiCall('POST', '/api/holidays/blocked-dates', {
        date:   blockDate,
        reason: blockReason || undefined,
      });
      toast.success('Date blocked');
      setBlockOpen(false); setBlockDate(''); setBlockReason('');
      refetchBlocked(); refetchCal();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setBlocking(false); }
  }

  async function handleRemoveBlocked(id: string) {
    try {
      await apiCall('DELETE', `/api/holidays/blocked-dates/${id}`);
      toast.success('Unblocked');
      refetchBlocked(); refetchCal();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  }

  async function handleAddRecurring() {
    if (!recurName.trim()) { toast.error('Enter a name'); return; }
    setAddingRecur(true);
    try {
      await apiCall('POST', '/api/holidays/recurring', {
        name: recurName.trim(), type: recurType, value: recurValue,
      });
      toast.success('Recurring holiday added');
      setRecurOpen(false); setRecurName(''); setRecurValue('Sunday');
      refetchRecurring(); refetchCal();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setAddingRecur(false); }
  }

  async function handleDeleteRecurring(id: string) {
    try {
      await apiCall('DELETE', `/api/holidays/recurring/${id}`);
      toast.success('Removed');
      refetchRecurring(); refetchCal();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  }

  // Build week-row grid
  const firstDayOfWeek = useMemo(() => {
    const d = new Date(year, month - 1, 1).getDay();
    return d === 0 ? 6 : d - 1; // Mon=0
  }, [year, month]);

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Settings
      </button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Holidays & Closures</h1>
          <p className="text-sm text-gray-500 mt-0.5">Blocked dates prevent bookings on those days.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setRecurOpen(true)}>
            <Plus size={13} /> Recurring holiday
          </Button>
          <Button size="sm" onClick={() => setBlockOpen(true)}>
            <Plus size={13} /> Block a date
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <CalendarHeader year={year} month={month} onPrev={prevMonth} onNext={nextMonth} />
          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>
          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
            {calLoading
              ? Array.from({ length: 30 }).map((_, i) => (
                  <div key={i} className="h-9 rounded-lg bg-gray-100 animate-pulse" />
                ))
              : calDays.map(day => {
                  const dayNum = parseInt(day.date.split('-')[2]);
                  const isToday = day.date === today.toISOString().slice(0, 10);
                  return (
                    <div key={day.date} title={day.reason}
                      className={`h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        !day.isOpen
                          ? day.source === 'blocked'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-400'
                          : isToday
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-700 hover:bg-indigo-50'
                      }`}>
                      {dayNum}
                    </div>
                  );
                })
            }
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-100 inline-block" /> Blocked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gray-100 inline-block" /> Closed (weekend/holiday)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-indigo-600 inline-block" /> Today
            </span>
          </div>
        </div>

        {/* Side panels */}
        <div className="space-y-4">
          {/* Blocked dates */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Blocked dates ({blockedDates.length})
            </h2>
            {blockedDates.length === 0 ? (
              <p className="text-xs text-gray-400">No dates blocked.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {blockedDates.map(b => (
                  <div key={b.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-gray-800">
                        {new Date(b.date + 'T00:00:00').toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </p>
                      {b.reason && <p className="text-xs text-gray-400 truncate max-w-[140px]">{b.reason}</p>}
                    </div>
                    <button onClick={() => handleRemoveBlocked(b.id)}
                      className="text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recurring holidays */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Recurring holidays ({recurringHols.length})
            </h2>
            {recurringHols.length === 0 ? (
              <p className="text-xs text-gray-400">No recurring holidays.</p>
            ) : (
              <div className="space-y-2">
                {recurringHols.map(h => (
                  <div key={h.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-gray-800">{h.name}</p>
                      <div className="flex gap-1 mt-0.5">
                        <Badge label={h.type} variant="neutral" />
                        <Badge label={h.value} variant="info" />
                      </div>
                    </div>
                    <button onClick={() => handleDeleteRecurring(h.id)}
                      className="text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Block date modal */}
      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title="Block a date" maxWidth="sm">
        <div className="space-y-4">
          <FormField label="Date" required>
            <input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)}
              min={today.toISOString().slice(0, 10)} className="form-input" />
          </FormField>
          <FormField label="Reason" hint="Optional — shows on the calendar.">
            <input value={blockReason} onChange={e => setBlockReason(e.target.value)}
              placeholder="e.g. Public holiday" maxLength={200} className="form-input" />
          </FormField>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setBlockOpen(false)}>Cancel</Button>
            <Button size="sm" loading={blocking} onClick={handleBlockDate}>Block date</Button>
          </div>
        </div>
      </Modal>

      {/* Add recurring modal */}
      <Modal open={recurOpen} onClose={() => setRecurOpen(false)} title="Add recurring holiday" maxWidth="sm">
        <div className="space-y-4">
          <FormField label="Name" required>
            <input value={recurName} onChange={e => setRecurName(e.target.value)}
              placeholder="e.g. Weekly off" className="form-input" />
          </FormField>
          <FormField label="Type">
            <div className="flex gap-4">
              {(['weekly', 'monthly'] as const).map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={recurType === t} onChange={() => { setRecurType(t); setRecurValue(t === 'weekly' ? 'Sunday' : '1'); }}
                    className="text-indigo-600" />
                  <span className="text-sm capitalize">{t}</span>
                </label>
              ))}
            </div>
          </FormField>
          <FormField label={recurType === 'weekly' ? 'Day of week' : 'Day of month'}>
            {recurType === 'weekly' ? (
              <select value={recurValue} onChange={e => setRecurValue(e.target.value)} className="form-input">
                {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            ) : (
              <input type="number" min="1" max="31" value={recurValue}
                onChange={e => setRecurValue(e.target.value)} className="form-input w-24" />
            )}
          </FormField>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setRecurOpen(false)}>Cancel</Button>
            <Button size="sm" loading={addingRecur} onClick={handleAddRecurring}>Add holiday</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
