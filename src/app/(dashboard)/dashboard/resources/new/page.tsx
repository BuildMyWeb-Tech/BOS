'use client';
// src/app/(dashboard)/dashboard/resources/new/page.tsx

import { useState }     from 'react';
import { useRouter }    from 'next/navigation';
import { ArrowLeft }    from 'lucide-react';
import toast            from 'react-hot-toast';

import PageHeader from '@/components/ui/PageHeader';
import FormField  from '@/components/ui/FormField';
import Button     from '@/components/ui/Button';
import { apiCall, ApiError } from '@/lib/apiClient';

const RESOURCE_TYPES = [
  { value: 'court',     label: '🏸 Court',     desc: 'Sports or activity court' },
  { value: 'room',      label: '🚪 Room',       desc: 'Treatment or meeting room' },
  { value: 'table',     label: '🪑 Table',      desc: 'Dining or work table' },
  { value: 'equipment', label: '🔧 Equipment',  desc: 'Shared equipment or tool' },
  { value: 'other',     label: '📦 Other',      desc: 'Any other bookable resource' },
] as const;

type ResourceType = typeof RESOURCE_TYPES[number]['value'];

export default function NewResourcePage() {
  const router = useRouter();

  const [name,        setName]        = useState('');
  const [type,        setType]        = useState<ResourceType>('room');
  const [description, setDescription] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await apiCall('POST', '/api/resources', {
        name:        name.trim(),
        type,
        description: description || undefined,
      });
      toast.success(`${name.trim()} added`);
      router.push('/dashboard/resources');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create resource');
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Resources
      </button>
      <PageHeader title="Add resource" subtitle="Resources can be assigned to bookings alongside staff." />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <FormField label="Resource name" required error={errors.name}>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Court 1 / Room A / Table 3"
              className={`form-input ${errors.name ? 'error' : ''}`} />
          </FormField>

          <FormField label="Type" required>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {RESOURCE_TYPES.map(rt => (
                <label key={rt.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    type === rt.value
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                  }`}>
                  <input type="radio" value={rt.value} checked={type === rt.value}
                    onChange={() => setType(rt.value)}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{rt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{rt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </FormField>

          <FormField label="Description" hint="Optional — visible to staff when assigning to a booking.">
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="e.g. Main hall court with air conditioning"
              className="form-input resize-none" />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pb-6">
          <Button variant="secondary" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={saving}>Add resource</Button>
        </div>
      </form>
    </div>
  );
}
