'use client';
// src/app/(dashboard)/dashboard/bookings/new/page.tsx
// 3-step booking wizard.

import { useState, useEffect } from 'react';
import { useRouter }           from 'next/navigation';
import { ArrowLeft, Check }    from 'lucide-react';
import toast                   from 'react-hot-toast';

import Button       from '@/components/ui/Button';
import FormField    from '@/components/ui/FormField';
import { useFetch } from '@/hooks/useFetch';
import { apiCall }  from '@/lib/apiClient';
import type { Service, StaffListItem, DaySlotAvailability } from '@/types';

// ─── Step indicator ────────────────────────────────────────────────
function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            i < current ? 'bg-indigo-600 text-white' : i === current ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {i < current ? <Check size={13} /> : i + 1}
          </div>
          <span className={`text-sm hidden sm:block ${i === current ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{label}</span>
          {i < steps.length - 1 && <div className="w-8 h-px bg-gray-200 mx-1" />}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Service + Staff ───────────────────────────────────────
function Step1({ onNext }: { onNext: (serviceId: string, staffId: string | null) => void }) {
  const { data: svcData }  = useFetch<{ services: Service[] }>('/api/services?limit=100');
  const { data: stfData }  = useFetch<{ staff: StaffListItem[] }>('/api/staff');
  const [serviceId, setServiceId] = useState('');
  const [staffId,   setStaffId]   = useState('');

  const services = svcData?.services ?? [];
  const staff    = stfData?.staff?.filter(s => s.isActive) ?? [];

  return (
    <div className="space-y-5">
      <FormField label="Service" required>
        <select value={serviceId} onChange={e => setServiceId(e.target.value)} className="form-input">
          <option value="">Select a service…</option>
          {services.map(s => (
            <option key={s.id} value={s.id}>{s.name} — ₹{s.price} ({s.duration} min)</option>
          ))}
        </select>
      </FormField>
      <FormField label="Staff member" hint="Optional — leave blank for any available staff.">
        <select value={staffId} onChange={e => setStaffId(e.target.value)} className="form-input">
          <option value="">Any available staff</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </FormField>
      <div className="flex justify-end">
        <Button disabled={!serviceId} onClick={() => onNext(serviceId, staffId || null)}>
          Next — Pick a date
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Date + Slot ──────────────────────────────────────────
function Step2({ serviceId, staffId, onNext, onBack }: {
  serviceId: string; staffId: string | null;
  onNext: (date: string, startTime: string) => void;
  onBack: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date,      setDate]      = useState(today);
  const [startTime, setStartTime] = useState('');

  const query = `serviceId=${serviceId}&date=${date}${staffId ? `&staffId=${staffId}` : ''}`;
  const { data, loading } = useFetch<DaySlotAvailability>(
    `/api/booking/availability?${query}`,
    { deps: [date, serviceId, staffId] }
  );

  const slots = data?.slots?.filter(s => s.available) ?? [];

  return (
    <div className="space-y-5">
      <FormField label="Date" required>
        <input type="date" value={date} onChange={e => { setDate(e.target.value); setStartTime(''); }}
          min={today} className="form-input" style={{ maxWidth: 200 }} />
      </FormField>

      {!data?.isOpen && !loading && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          {data?.closedReason ?? 'This date is not available for bookings.'}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && slots.length > 0 && (
        <FormField label="Available slots" required>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {slots.map(slot => (
              <button key={slot.startTime} type="button"
                onClick={() => setStartTime(slot.startTime)}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                  startTime === slot.startTime
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-gray-300 text-gray-700 hover:border-indigo-400 hover:text-indigo-600'
                }`}>
                {slot.startTime}
              </button>
            ))}
          </div>
        </FormField>
      )}

      {!loading && data?.isOpen && slots.length === 0 && (
        <p className="text-sm text-gray-500">No slots available on this date. Try a different day.</p>
      )}

      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button disabled={!startTime} onClick={() => onNext(date, startTime)}>
          Next — Confirm
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Confirm ──────────────────────────────────────────────
function Step3({ serviceId, staffId, date, startTime, onBack }: {
  serviceId: string; staffId: string | null; date: string; startTime: string; onBack: () => void;
}) {
  const router  = useRouter();
  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);

  const { data: svcData } = useFetch<{ service: Service }>(`/api/services/${serviceId}`);
  const service = svcData?.service;

  async function handleCreate() {
    setLoading(true);
    try {
      await apiCall('POST', '/api/bookings', {
        serviceIds: [serviceId],
        staffId:    staffId || undefined,
        date,
        startTime,
        notes:      notes || undefined,
      });
      toast.success('Booking created');
      router.push('/dashboard/bookings');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create booking');
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-5">
      <div className="bg-gray-50 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Booking summary</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-500">Service</span>
          <span className="text-gray-900 font-medium">{service?.name ?? '…'}</span>
          <span className="text-gray-500">Duration</span>
          <span className="text-gray-900">{service?.duration ?? '—'} min</span>
          <span className="text-gray-500">Date</span>
          <span className="text-gray-900">{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { dateStyle: 'long' })}</span>
          <span className="text-gray-500">Time</span>
          <span className="text-gray-900">{startTime}</span>
          <span className="text-gray-500">Price</span>
          <span className="text-gray-900 font-semibold">₹{service?.price?.toLocaleString('en-IN') ?? '—'}</span>
        </div>
      </div>
      <FormField label="Notes" hint="Optional — visible to staff only.">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Any special requests or notes…" className="form-input resize-none" />
      </FormField>
      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button loading={loading} onClick={handleCreate}>Confirm booking</Button>
      </div>
    </div>
  );
}

// ─── Wizard shell ──────────────────────────────────────────────────
export default function NewBookingPage() {
  const router = useRouter();
  const [step,      setStep]      = useState(0);
  const [serviceId, setServiceId] = useState('');
  const [staffId,   setStaffId]   = useState<string | null>(null);
  const [date,      setDate]      = useState('');
  const [startTime, setStartTime] = useState('');

  const STEPS = ['Select service', 'Pick a slot', 'Confirm'];

  return (
    <div className="max-w-xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to bookings
      </button>
      <h1 className="text-xl font-bold text-gray-900 mb-6">New booking</h1>
      <StepIndicator current={step} steps={STEPS} />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        {step === 0 && (
          <Step1 onNext={(sId, stId) => { setServiceId(sId); setStaffId(stId); setStep(1); }} />
        )}
        {step === 1 && (
          <Step2
            serviceId={serviceId} staffId={staffId}
            onNext={(d, t) => { setDate(d); setStartTime(t); setStep(2); }}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <Step3
            serviceId={serviceId} staffId={staffId}
            date={date} startTime={startTime}
            onBack={() => setStep(1)}
          />
        )}
      </div>
    </div>
  );
}
