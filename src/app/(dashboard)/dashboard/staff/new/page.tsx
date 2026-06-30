'use client';
// src/app/(dashboard)/dashboard/staff/new/page.tsx

import { useState }      from 'react';
import { useRouter }     from 'next/navigation';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import toast             from 'react-hot-toast';

import PageHeader from '@/components/ui/PageHeader';
import FormField  from '@/components/ui/FormField';
import Button     from '@/components/ui/Button';
import { apiCall, ApiError } from '@/lib/apiClient';

// 24 canonical permission codes grouped by module
const PERMISSION_GROUPS = [
  { module: 'Booking',   codes: ['booking.view', 'booking.create', 'booking.edit', 'booking.delete'] },
  { module: 'Inventory', codes: ['inventory.view', 'inventory.manage'] },
  { module: 'Products',  codes: ['product.view', 'product.create', 'product.edit', 'product.delete'] },
  { module: 'Billing',   codes: ['billing.view', 'billing.create', 'billing.refund'] },
  { module: 'Sales',     codes: ['sales.view'] },
  { module: 'Orders',    codes: ['orders.view', 'orders.manage'] },
  { module: 'Customers', codes: ['customer.view', 'customer.edit'] },
  { module: 'Reports',   codes: ['report.view', 'report.export'] },
  { module: 'Staff',     codes: ['staff.view', 'staff.manage'] },
  { module: 'Settings',  codes: ['settings.view', 'settings.manage'] },
];

interface FormErrors { [k: string]: string }

export default function NewStaffPage() {
  const router = useRouter();

  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [bio,         setBio]         = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [showPwd,     setShowPwd]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState<FormErrors>({});

  function togglePermission(code: string) {
    setPermissions(prev =>
      prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]
    );
  }

  function toggleModule(codes: string[]) {
    const allSelected = codes.every(c => permissions.includes(c));
    if (allSelected) {
      setPermissions(prev => prev.filter(p => !codes.includes(p)));
    } else {
      setPermissions(prev => [...new Set([...prev, ...codes])]);
    }
  }

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!name.trim() || name.trim().length < 2)  errs.name     = 'Name must be at least 2 characters';
    if (!email.trim())                            errs.email    = 'Email is required';
    if (password.length < 8)                      errs.password = 'Password must be at least 8 characters';
    if (phone && !/^[0-9+\-\s()]{7,20}$/.test(phone)) errs.phone = 'Invalid phone number';
    if (bio.length > 300)                         errs.bio      = 'Bio must be under 300 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await apiCall('POST', '/api/staff', {
        name:    name.trim(),
        email:   email.trim().toLowerCase(),
        password,
        phone:   phone || undefined,
        bio:     bio   || undefined,
        permissions: permissions.length > 0 ? permissions : undefined,
      });
      toast.success(`${name.trim()} added to your team`);
      router.push('/dashboard/staff');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to create staff member');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to staff
      </button>

      <PageHeader title="Add staff member" subtitle="They'll receive login credentials at the email provided." />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Basic info</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Full name" required error={errors.name}>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Arun Raj" className={`form-input ${errors.name ? 'error' : ''}`} />
            </FormField>
            <FormField label="Email" required error={errors.email}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="arun@yoursalon.in" className={`form-input ${errors.email ? 'error' : ''}`} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Password" required error={errors.password}
              hint="Minimum 8 characters. Staff can change this after first login.">
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" className={`form-input pr-10 ${errors.password ? 'error' : ''}`} />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </FormField>
            <FormField label="Phone" error={errors.phone} hint="Optional — for internal contact.">
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+91 9000000000" className={`form-input ${errors.phone ? 'error' : ''}`} />
            </FormField>
          </div>

          <FormField label="Bio" error={errors.bio} hint={`${bio.length}/300 characters`}>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2}
              placeholder="Senior stylist with 5 years experience…"
              className={`form-input resize-none ${errors.bio ? 'error' : ''}`} />
          </FormField>
        </div>

        {/* Permissions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Permissions</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Leave all unchecked to use the default STAFF role permissions.
              </p>
            </div>
            {permissions.length > 0 && (
              <button type="button" onClick={() => setPermissions([])}
                className="text-xs text-gray-400 hover:text-gray-600 underline">
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-4">
            {PERMISSION_GROUPS.map(group => {
              const allSelected = group.codes.every(c => permissions.includes(c));
              const someSelected = group.codes.some(c => permissions.includes(c));
              return (
                <div key={group.module}>
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" id={`mod-${group.module}`}
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={() => toggleModule(group.codes)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label htmlFor={`mod-${group.module}`}
                      className="text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer">
                      {group.module}
                    </label>
                  </div>
                  <div className="ml-6 flex flex-wrap gap-2">
                    {group.codes.map(code => {
                      const action = code.split('.')[1];
                      return (
                        <label key={code} className="flex items-center gap-1.5 cursor-pointer group">
                          <input type="checkbox" checked={permissions.includes(code)}
                            onChange={() => togglePermission(code)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-xs text-gray-600 group-hover:text-gray-900 capitalize">
                            {action}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pb-6">
          <Button variant="secondary" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={loading}>Add staff member</Button>
        </div>
      </form>
    </div>
  );
}
