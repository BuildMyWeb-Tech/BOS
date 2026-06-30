'use client';
// src/app/(dashboard)/dashboard/settings/booking/page.tsx

import { useState, useEffect } from 'react';
import { useRouter }           from 'next/navigation';
import { ArrowLeft }           from 'lucide-react';
import toast                   from 'react-hot-toast';

import PageHeader from '@/components/ui/PageHeader';
import FormField  from '@/components/ui/FormField';
import Button     from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import { apiCall }   from '@/lib/apiClient';
import type { SlotConfig, DayOfWeek } from '@/types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOT_DURATIONS = [15, 30, 45, 60, 90, 120];
const ADVANCE_PERCENTS = [10, 20, 25, 50, 75, 100];

export default function BookingSettingsPage() {
  const router = useRouter();
  const { data, loading } = useFetch<{ config: SlotConfig; isDefault: boolean }>('/api/slot-config');

  const [startTime,    setStartTime]    = useState('09:00');
  const [endTime,      setEndTime]      = useState('17:00');
  const [slotDuration, setSlotDuration] = useState(30);
  const [breakEnabled, setBreakEnabled] = useState(false);
  const [breakStart,   setBreakStart]   = useState('13:00');
  const [breakEnd,     setBreakEnd]     = useState('14:00');
  const [daysOpen,     setDaysOpen]     = useState<DayOfWeek[]>(['Monday','Tuesday','Wednesday','Thursday','Friday']);
  const [maxAdvance,   setMaxAdvance]   = useState(30);
  const [minHoursBefore, setMinHoursBefore] = useState(2);
  const [allowReschedule, setAllowReschedule] = useState(true);
  const [rescheduleHours, setRescheduleHours] = useState(24);
  const [advancePayment,  setAdvancePayment]  = useState(true);
  const [advancePercent,  setAdvancePercent]  = useState(100);
  const [saving,       setSaving]       = useState(false);
  const [dirty,        setDirty]        = useState(false);

  useEffect(() => {
    const c = data?.config;
    if (!c) return;
    setStartTime(c.slotStartTime);
    setEndTime(c.slotEndTime);
    setSlotDuration(c.slotDuration);
    setBreakEnabled(c.breakEnabled);
    setBreakStart(c.breakStartTime ?? '13:00');
    setBreakEnd(c.breakEndTime   ?? '14:00');
    setDaysOpen((c.daysOpen as DayOfWeek[]) ?? []);
    setMaxAdvance(c.maxAdvanceBookingDays);
    setMinHoursBefore(c.minBookingHoursBefore);
    setAllowReschedule(c.allowRescheduling);
    setRescheduleHours(c.rescheduleHoursBefore);
    setAdvancePayment(c.advancePaymentRequired);
    setAdvancePercent(c.advancePaymentPercent);
  }, [data]);

  function mark() { setDirty(true); }

  function toggleDay(day: DayOfWeek) {
    mark();
    setDaysOpen(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  async function handleSave() {
    if (daysOpen.length === 0) { toast.error('Select at least one working day'); return; }
    if (endTime <= startTime)  { toast.error('End time must be after start time'); return; }
    if (breakEnabled && (!breakStart || !breakEnd)) { toast.error('Set break start and end times'); return; }

    setSaving(true);
    try {
      await apiCall('PUT', '/api/slot-config', {
        slotStartTime:          startTime,
        slotEndTime:            endTime,
        slotDuration,
        breakEnabled,
        breakStartTime:         breakEnabled ? breakStart : null,
        breakEndTime:           breakEnabled ? breakEnd   : null,
        daysOpen,
        maxAdvanceBookingDays:  maxAdvance,
        minBookingHoursBefore:  minHoursBefore,
        allowRescheduling:      allowReschedule,
        rescheduleHoursBefore:  rescheduleHours,
        advancePaymentRequired: advancePayment,
        advancePaymentPercent:  advancePercent,
      });
      toast.success('Booking settings saved');
      setDirty(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Settings
      </button>
      <PageHeader title="Booking Settings" subtitle="Controls how customers can book appointments." />

      <div className="space-y-4">
        {/* Working hours */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Working Hours</h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Opens at">
              <input type="time" value={startTime} onChange={e => { setStartTime(e.target.value); mark(); }} className="form-input" />
            </FormField>
            <FormField label="Closes at">
              <input type="time" value={endTime} onChange={e => { setEndTime(e.target.value); mark(); }} className="form-input" />
            </FormField>
          </div>
          <FormField label="Slot duration">
            <div className="flex flex-wrap gap-2">
              {SLOT_DURATIONS.map(d => (
                <button key={d} type="button"
                  onClick={() => { setSlotDuration(d); mark(); }}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    slotDuration === d
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-300 text-gray-600 hover:border-indigo-300'
                  }`}>
                  {d} min
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Working days">
            <div className="flex flex-wrap gap-2 mt-1">
              {DAYS.map(day => (
                <button key={day} type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    daysOpen.includes(day)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-300 text-gray-600 hover:border-indigo-300'
                  }`}>
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </FormField>
        </div>

        {/* Break time */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Break Time</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-600">Enable break</span>
              <input type="checkbox" checked={breakEnabled} onChange={e => { setBreakEnabled(e.target.checked); mark(); }}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            </label>
          </div>
          {breakEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Break starts">
                <input type="time" value={breakStart} onChange={e => { setBreakStart(e.target.value); mark(); }} className="form-input" />
              </FormField>
              <FormField label="Break ends">
                <input type="time" value={breakEnd} onChange={e => { setBreakEnd(e.target.value); mark(); }} className="form-input" />
              </FormField>
            </div>
          )}
        </div>

        {/* Booking window */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Booking Window</h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Max days ahead" hint="How far in advance customers can book.">
              <input type="number" min="1" max="365" value={maxAdvance}
                onChange={e => { setMaxAdvance(Number(e.target.value)); mark(); }} className="form-input" />
            </FormField>
            <FormField label="Min hours before" hint="How many hours before a slot closes for booking.">
              <input type="number" min="0" max="72" value={minHoursBefore}
                onChange={e => { setMinHoursBefore(Number(e.target.value)); mark(); }} className="form-input" />
            </FormField>
          </div>
        </div>

        {/* Reschedule + Payment */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Rescheduling & Payment</h2>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={allowReschedule} onChange={e => { setAllowReschedule(e.target.checked); mark(); }}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-gray-700">Allow customers to reschedule bookings</span>
          </label>
          {allowReschedule && (
            <FormField label="Reschedule cutoff (hours)" hint="Cannot reschedule within this many hours of the slot.">
              <input type="number" min="0" value={rescheduleHours}
                onChange={e => { setRescheduleHours(Number(e.target.value)); mark(); }} className="form-input w-32" />
            </FormField>
          )}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={advancePayment} onChange={e => { setAdvancePayment(e.target.checked); mark(); }}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-gray-700">Require advance payment to confirm bookings</span>
          </label>
          {advancePayment && (
            <FormField label="Advance payment %">
              <div className="flex flex-wrap gap-2">
                {ADVANCE_PERCENTS.map(p => (
                  <button key={p} type="button"
                    onClick={() => { setAdvancePercent(p); mark(); }}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      advancePercent === p
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-gray-300 text-gray-600 hover:border-indigo-300'
                    }`}>
                    {p}%
                  </button>
                ))}
              </div>
            </FormField>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-5 pb-6">
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} disabled={!dirty}>Save settings</Button>
      </div>
    </div>
  );
}
