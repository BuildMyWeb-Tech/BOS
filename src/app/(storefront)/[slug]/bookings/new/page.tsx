'use client';
// src/app/(storefront)/[slug]/bookings/new/page.tsx
// Customer-facing booking wizard — 3 steps:
//   Step 1: Service info + optional staff pick
//   Step 2: Date picker + time slot grid
//   Step 3: Your details (name, phone, email) + confirm
// No login required — guest booking.

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────
interface ServiceInfo {
  id: string; name: string; duration: number; price: number;
  description: string | null; image: string | null;
  category: { name: string } | null;
}
interface StaffMember { id: string; name: string }
interface TimeSlot    { startTime: string; endTime: string; available: boolean }

// ─── Helpers ──────────────────────────────────────────────────────
function addDays(date: Date, n: number): Date {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function displayDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── Step indicator ───────────────────────────────────────────────
function Steps({ current }: { current: number }) {
  const steps = ['Service', 'Date & Time', 'Your Details'];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            i < current ? 'bg-indigo-600 text-white' :
            i === current ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
            'bg-gray-200 text-gray-400'
          }`}>
            {i < current ? <Check size={13} /> : i + 1}
          </div>
          <span className={`text-xs font-medium hidden sm:block ${i === current ? 'text-indigo-600' : 'text-gray-400'}`}>
            {label}
          </span>
          {i < steps.length - 1 && <div className="w-8 h-px bg-gray-200 mx-1" />}
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────
export default function BookingNewPage() {
  const { slug }        = useParams<{ slug: string }>();
  const searchParams    = useSearchParams();
  const router          = useRouter();
  const serviceId       = searchParams.get('serviceId') ?? '';
  const headers         = { 'X-Tenant-Slug': slug };

  // Data
  const [service,  setService]  = useState<ServiceInfo | null>(null);
  const [staffList,setStaffList]= useState<StaffMember[]>([]);
  const [slots,    setSlots]    = useState<TimeSlot[]>([]);

  // Selections
  const [step,      setStep]      = useState(0);
  const [staffId,   setStaffId]   = useState<string>('');
  const [date,      setDate]      = useState<string>(fmtDate(new Date()));
  const [startTime, setStartTime] = useState<string>('');
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Customer info
  const [custName,  setCustName]  = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [done,      setDone]      = useState<{ id: string; date: string; startTime: string; name: string } | null>(null);

  // Date carousel — 14 days starting today
  const today = new Date();
  const dateOptions = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  // ── Load service + staff ───────────────────────────────────────
  useEffect(() => {
    if (!serviceId) return;
    fetch(`/api/storefront/services/${serviceId}`, { headers })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setService(json.data.service);
          setStaffList(json.data.staff ?? []);
        } else {
          toast.error('Service not found');
          router.back();
        }
      })
      .catch(() => { toast.error('Failed to load service'); router.back(); });
  }, [serviceId]);

  // ── Load slots when date/staffId changes ───────────────────────
  useEffect(() => {
    if (step !== 1 || !serviceId) return;
    setSlotsLoading(true);
    setStartTime('');
    const q = new URLSearchParams({ slug, serviceId, date });
    if (staffId) q.set('staffId', staffId);
    fetch(`/api/storefront/availability?${q}`, { headers })
      .then(r => r.json())
      .then(json => {
        if (json.success) setSlots(json.data.availability?.slots ?? []);
        else setSlots([]);
      })
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [date, staffId, step]);

  // ── Create booking ─────────────────────────────────────────────
  async function handleConfirm() {
    if (!custName.trim() || custName.trim().length < 2) { toast.error('Enter your full name'); return; }
    if (!/^[0-9+\-\s()]{7,15}$/.test(custPhone)) { toast.error('Enter a valid phone number'); return; }
    setSaving(true);
    try {
      const res  = await fetch('/api/storefront/bookings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body:    JSON.stringify({
          serviceId, date, startTime,
          staffId:       staffId || null,
          customerName:  custName.trim(),
          customerPhone: custPhone.trim(),
          customerEmail: custEmail.trim() || null,
          notes:         notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Booking failed');
      setDone({
        id:        json.data.booking.id,
        date:      json.data.booking.date,
        startTime: json.data.booking.startTime,
        name:      custName.trim(),
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setSaving(false);
    }
  }

  // ── Success screen ─────────────────────────────────────────────
  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check size={28} className="text-emerald-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Booking confirmed!</h1>
        <p className="text-gray-500 text-sm mb-4">
          {done.name}, your appointment is booked for{' '}
          <strong>{displayDate(done.date)}</strong> at <strong>{done.startTime}</strong>.
        </p>
        <div className="bg-indigo-50 rounded-xl p-4 mb-5 text-left space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Service</span>
            <span className="font-medium">{service?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Duration</span>
            <span className="font-medium">{service?.duration} min</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Amount</span>
            <span className="font-semibold text-indigo-600">₹{service?.price.toLocaleString('en-IN')}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/${slug}/my-bookings?phone=${encodeURIComponent(custPhone)}`)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            My Appointments
          </button>
          <button
            onClick={() => router.push(`/${slug}`)}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Back to store
          </button>
        </div>
      </div>
    </div>
  );

  if (!service) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-bold text-gray-900">Book Appointment</h1>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8">
        <Steps current={step} />

        {/* ── STEP 0: Service + Staff ── */}
        {step === 0 && (
          <div className="space-y-4">
            {/* Service card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start gap-4">
                {service.image
                  ? <img src={service.image} alt={service.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                  : <div className="w-20 h-20 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Calendar size={28} className="text-indigo-400" />
                    </div>
                }
                <div>
                  <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">
                    {service.category?.name ?? 'Service'}
                  </p>
                  <h2 className="text-lg font-bold text-gray-900 mt-0.5">{service.name}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={12} /> {service.duration} min
                    </span>
                    <span className="text-sm font-bold text-indigo-600">
                      ₹{service.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                  {service.description && (
                    <p className="text-xs text-gray-400 mt-1">{service.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Staff picker (optional) */}
            {staffList.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">Preferred staff (optional)</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setStaffId('')}
                    className={`px-3 py-2 rounded-xl text-sm border font-medium transition-colors ${
                      staffId === '' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                    }`}>
                    Any available
                  </button>
                  {staffList.map(s => (
                    <button key={s.id} onClick={() => setStaffId(s.id)}
                      className={`px-3 py-2 rounded-xl text-sm border font-medium transition-colors ${
                        staffId === s.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setStep(1)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-xl transition-colors">
              Continue — Pick a date
            </button>
          </div>
        )}

        {/* ── STEP 1: Date + Time ── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Date carousel */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Calendar size={15} className="text-indigo-600" /> Select date
              </p>
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="flex gap-2 pb-1" style={{ width: 'max-content' }}>
                  {dateOptions.map(d => {
                    const ds = fmtDate(d);
                    const selected = ds === date;
                    return (
                      <button key={ds} onClick={() => setDate(ds)}
                        className={`flex flex-col items-center px-3 py-2.5 rounded-xl border min-w-[60px] transition-colors ${
                          selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                        }`}>
                        <span className="text-xs font-medium">{DAY_LABELS[d.getDay()]}</span>
                        <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
                        <span className={`text-xs ${selected ? 'text-indigo-200' : 'text-gray-400'}`}>
                          {d.toLocaleDateString('en-IN', { month: 'short' })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time slots */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Clock size={15} className="text-indigo-600" /> Select time
              </p>
              {slotsLoading ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 12 }).map((_, i) =>
                    <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}
                </div>
              ) : slots.filter(s => s.available).length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  No available slots on this day. Try another date.
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {slots.filter(s => s.available).map(slot => (
                    <button key={slot.startTime} onClick={() => setStartTime(slot.startTime)}
                      className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                        startTime === slot.startTime
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-gray-200 text-gray-700 hover:border-indigo-400 hover:text-indigo-600'
                      }`}>
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            {startTime && (
              <div className="bg-indigo-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-indigo-500 font-medium">Selected</p>
                  <p className="text-sm font-bold text-indigo-800">
                    {displayDate(date)} · {startTime}
                  </p>
                </div>
                <span className="text-sm font-bold text-indigo-600">
                  ₹{service.price.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            <button onClick={() => setStep(2)} disabled={!startTime}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors">
              Continue — Your details
            </button>
          </div>
        )}

        {/* ── STEP 2: Customer info ── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Booking summary */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Service</span>
                <span className="font-medium text-gray-900">{service.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="font-medium text-gray-900">{displayDate(date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Time</span>
                <span className="font-medium text-gray-900">{startTime}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-indigo-100 pt-1.5">
                <span className="font-semibold text-gray-700">Total</span>
                <span className="font-bold text-indigo-600">₹{service.price.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Customer form */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-700">Your details</p>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Full name *</label>
                <input value={custName} onChange={e => setCustName(e.target.value)}
                  placeholder="Priya Kumar"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Phone number *</label>
                <input value={custPhone} onChange={e => setCustPhone(e.target.value)}
                  placeholder="+91 9876543210" type="tel"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
                <p className="text-xs text-gray-400 mt-1">Used to view your booking history</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Email (optional)</label>
                <input value={custEmail} onChange={e => setCustEmail(e.target.value)}
                  placeholder="priya@example.com" type="email"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Any special requests…" rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
              </div>
            </div>

            <button onClick={handleConfirm} disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
              {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Confirming…</> : 'Confirm booking'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
