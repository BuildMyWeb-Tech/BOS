'use client';
// src/app/(dashboard)/dashboard/services/new/page.tsx
// Fixed: resources are fetched and shown in the "Assign resource" section
// (separate from service categories which are for grouping services).

import { useState }     from 'react';
import { useRouter }    from 'next/navigation';
import { ArrowLeft }    from 'lucide-react';
import toast            from 'react-hot-toast';

import PageHeader from '@/components/ui/PageHeader';
import FormField  from '@/components/ui/FormField';
import Button     from '@/components/ui/Button';
import { useFetch }          from '@/hooks/useFetch';
import { apiCall, ApiError } from '@/lib/apiClient';
import type { ServiceCategory, Resource } from '@/types';

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export default function NewServicePage() {
  const router = useRouter();

  const { data: catData }      = useFetch<{ categories: ServiceCategory[] }>('/api/services/categories');
  // FIX: fetch resources so vendor can assign one to this service
  const { data: resourceData } = useFetch<{ resources: Resource[] }>('/api/resources?includeInactive=false');

  const categories = catData?.categories ?? [];
  const resources  = resourceData?.resources ?? [];

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [duration,    setDuration]    = useState(60);
  const [price,       setPrice]       = useState('');
  const [categoryId,  setCategoryId]  = useState('');
  const [resourceId,  setResourceId]  = useState('');   // NEW
  const [image,       setImage]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState<Record<string,string>>({});

  function validate() {
    const e: Record<string,string> = {};
    if (!name.trim() || name.trim().length < 2) e.name  = 'Name must be at least 2 characters';
    if (!price || parseFloat(price) < 0)        e.price = 'Enter a valid price (0 or more)';
    if (image && !/^https?:\/\//.test(image))   e.image = 'Image must be a valid URL';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await apiCall('POST', '/api/services', {
        name:        name.trim(),
        description: description || undefined,
        duration,
        price:       parseFloat(price),
        categoryId:  categoryId  || undefined,
        resourceId:  resourceId  || undefined,   // NEW — link a resource
        image:       image       || undefined,
      });
      toast.success(`${name.trim()} added`);
      router.push('/dashboard/services');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create service');
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Services
      </button>
      <PageHeader title="Add service" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Details</h2>

          <FormField label="Service name" required error={errors.name}>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Hair Cut & Styling"
              className={`form-input ${errors.name ? 'error' : ''}`} />
          </FormField>

          <FormField label="Description" hint="Shown to customers during booking.">
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="Full haircut with blow dry and styling…"
              className="form-input resize-none" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Price (₹)" required error={errors.price}>
              <input type="number" min="0" step="0.01" value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="599"
                className={`form-input ${errors.price ? 'error' : ''}`} />
            </FormField>
            <FormField label="Category" hint="Group services for filtering.">
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="form-input">
                <option value="">No category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          </div>

          {/* FIX — Resource assignment */}
          <FormField
            label="Assign resource"
            hint={
              resources.length === 0
                ? 'No resources yet — create courts, rooms, or tables in Resources first.'
                : 'Optional — the court, room, or equipment used for this service.'
            }
          >
            <select
              value={resourceId}
              onChange={e => setResourceId(e.target.value)}
              className="form-input"
              disabled={resources.length === 0}
            >
              <option value="">No resource assigned</option>
              {resources.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.type})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Duration" required>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map(d => (
                <button key={d} type="button" onClick={() => setDuration(d)}
                  className={`px-3 py-1.5 rounded-lg text-sm border font-medium transition-colors ${
                    duration === d
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-300 text-gray-600 hover:border-indigo-300'
                  }`}>
                  {d} min
                </button>
              ))}
              <div className="flex items-center gap-2">
                <input type="number" min="5" max="480" value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="form-input w-20 text-center" />
                <span className="text-sm text-gray-400">min</span>
              </div>
            </div>
          </FormField>

          <FormField label="Image URL" error={errors.image} hint="Optional — shown in booking flow.">
            <input value={image} onChange={e => setImage(e.target.value)}
              placeholder="https://ik.imagekit.io/…"
              className={`form-input ${errors.image ? 'error' : ''}`} />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pb-6">
          <Button variant="secondary" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={saving}>Add service</Button>
        </div>
      </form>
    </div>
  );
}
