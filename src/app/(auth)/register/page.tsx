'use client';
// src/app/(auth)/register/page.tsx
// Public vendor self-registration page — submits to /api/tenants/register.
// After submission the application is PENDING until a Super Admin approves it.

import { useState } from 'react';
import Link         from 'next/link';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import FormField from '@/components/ui/FormField';
import Button    from '@/components/ui/Button';

const MODULE_OPTIONS = [
  { key: 'booking',   label: 'Booking',   desc: 'Appointment & slot booking system'    },
  { key: 'inventory', label: 'Inventory', desc: 'Product & stock management'            },
  { key: 'billing',   label: 'Billing',   desc: 'POS and invoicing'                     },
  { key: 'ecommerce', label: 'Ecommerce', desc: 'Online store & order management'       },
] as const;

type ModuleKey = typeof MODULE_OPTIONS[number]['key'];

interface FormErrors { [k: string]: string }

export default function RegisterPage() {
  // Business
  const [bizName,  setBizName]  = useState('');
  const [bizType,  setBizType]  = useState('');
  const [bizDesc,  setBizDesc]  = useState('');
  const [address,  setAddress]  = useState('');
  const [phone,    setPhone]    = useState('');
  const [website,  setWebsite]  = useState('');

  // Modules
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    booking: false, inventory: false, billing: false, ecommerce: false,
  });

  // Owner
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPwd,   setOwnerPwd]   = useState('');
  const [showPwd,    setShowPwd]    = useState(false);

  const [errors,    setErrors]    = useState<FormErrors>({});
  const [saving,    setSaving]    = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function toggleModule(key: ModuleKey) {
    setModules(m => ({ ...m, [key]: !m[key] }));
  }

  function validate(): boolean {
    const e: FormErrors = {};
    if (!bizName.trim() || bizName.trim().length < 2) e.bizName = 'Business name must be at least 2 characters';
    if (!bizType.trim())                               e.bizType = 'Business type is required';
    if (!address.trim() || address.trim().length < 5)  e.address = 'Please enter a valid address';
    if (!/^[0-9+\-\s()]{7,20}$/.test(phone))          e.phone   = 'Invalid phone number';
    if (!Object.values(modules).some(Boolean))         e.modules = 'Select at least one module';
    if (!ownerName.trim() || ownerName.trim().length < 2) e.ownerName = 'Owner name required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail))  e.ownerEmail = 'Valid email required';
    if (ownerPwd.length < 8)                           e.ownerPwd  = 'Password must be at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const res  = await fetch('/api/tenants/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          businessName:  bizName.trim(),
          businessType:  bizType.trim(),
          description:   bizDesc || undefined,
          address:       address.trim(),
          phone,
          website:       website || undefined,
          modules,
          ownerName:     ownerName.trim(),
          ownerEmail:    ownerEmail.trim().toLowerCase(),
          ownerPassword: ownerPwd,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Registration failed');
      setSubmitted(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    } finally { setSaving(false); }
  }

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={32} className="text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Application submitted!</h1>
        <p className="text-gray-500 mb-6">
          Your application for <strong className="text-gray-800">{bizName}</strong> has been received.
          Our team will review it and notify you at <strong className="text-gray-800">{ownerEmail}</strong>.
          This typically takes 1–2 business days.
        </p>
        <Link href="/login" className="text-sm text-indigo-600 hover:underline">
          Back to login
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Register your business</h1>
          <p className="text-sm text-gray-500 mt-1">Set up your BOS account — free to apply, approved by our team.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Business info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Business information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Business name" required error={errors.bizName}>
                <input value={bizName} onChange={e => setBizName(e.target.value)}
                  placeholder="Acme Salon" className={`form-input ${errors.bizName ? 'error' : ''}`} />
              </FormField>
              <FormField label="Business type" required error={errors.bizType}
                hint="e.g. salon, clinic, gym, restaurant">
                <input value={bizType} onChange={e => setBizType(e.target.value)}
                  placeholder="salon" className={`form-input ${errors.bizType ? 'error' : ''}`} />
              </FormField>
            </div>
            <FormField label="Description" hint="Tell customers what you do.">
              <textarea value={bizDesc} onChange={e => setBizDesc(e.target.value)} rows={2}
                placeholder="Premium hair care salon in Chennai…" className="form-input resize-none" />
            </FormField>
            <FormField label="Business address" required error={errors.address}>
              <input value={address} onChange={e => setAddress(e.target.value)}
                placeholder="12 Anna Salai, Chennai, Tamil Nadu 600001"
                className={`form-input ${errors.address ? 'error' : ''}`} />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Phone" required error={errors.phone}>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+91 9876543210" className={`form-input ${errors.phone ? 'error' : ''}`} />
              </FormField>
              <FormField label="Website" hint="Optional.">
                <input value={website} onChange={e => setWebsite(e.target.value)}
                  placeholder="https://acmesalon.in" className="form-input" />
              </FormField>
            </div>
          </div>

          {/* Module selection */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Modules</h2>
            <p className="text-xs text-gray-400 mb-3">Select the features you need. You can change this later.</p>
            {errors.modules && <p className="form-error mb-3">{errors.modules}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MODULE_OPTIONS.map(m => (
                <label key={m.key}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    modules[m.key] ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                  }`}>
                  <input type="checkbox" checked={modules[m.key]} onChange={() => toggleModule(m.key)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{m.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Owner account */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Owner account</h2>
            <p className="text-xs text-gray-400 -mt-2">These credentials will be used to log in to your BOS dashboard.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Your name" required error={errors.ownerName}>
                <input value={ownerName} onChange={e => setOwnerName(e.target.value)}
                  placeholder="Priya Kumar" className={`form-input ${errors.ownerName ? 'error' : ''}`} />
              </FormField>
              <FormField label="Email" required error={errors.ownerEmail}>
                <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}
                  placeholder="priya@acmesalon.in" className={`form-input ${errors.ownerEmail ? 'error' : ''}`} />
              </FormField>
            </div>
            <FormField label="Password" required error={errors.ownerPwd} hint="Minimum 8 characters.">
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={ownerPwd}
                  onChange={e => setOwnerPwd(e.target.value)}
                  placeholder="••••••••" className={`form-input pr-10 ${errors.ownerPwd ? 'error' : ''}`} />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </FormField>
          </div>

          <Button type="submit" loading={saving} className="w-full" size="lg">
            Submit application
          </Button>

          <p className="text-center text-sm text-gray-500">
            Already registered?{' '}
            <Link href="/login" className="text-indigo-600 hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
