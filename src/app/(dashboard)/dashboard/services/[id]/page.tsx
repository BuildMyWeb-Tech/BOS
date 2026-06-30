'use client';
// src/app/(dashboard)/dashboard/services/[id]/page.tsx

import { useState, useEffect }  from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Check, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import Badge         from '@/components/ui/Badge';
import Button        from '@/components/ui/Button';
import FormField     from '@/components/ui/FormField';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Skeleton }  from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import { apiCall }   from '@/lib/apiClient';
import type { Service, ServiceCategory } from '@/types';

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export default function ServiceDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const { data, loading, refetch } = useFetch<{ service: Service }>(`/api/services/${id}`);
  const { data: catData }          = useFetch<{ categories: ServiceCategory[] }>('/api/services/categories');
  const service    = data?.service;
  const categories = catData?.categories ?? [];

  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState('');
  const [desc,     setDesc]     = useState('');
  const [duration, setDuration] = useState(60);
  const [price,    setPrice]    = useState('');
  const [catId,    setCatId]    = useState('');
  const [image,    setImage]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [delOpen,  setDelOpen]  = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!service) return;
    setName(service.name);
    setDesc(service.description ?? '');
    setDuration(service.duration);
    setPrice(String(service.price));
    setCatId(service.categoryId ?? '');
    setImage(service.image ?? '');
  }, [service]);

  async function handleSave() {
    if (!name.trim() || name.trim().length < 2) { toast.error('Name must be at least 2 characters'); return; }
    setSaving(true);
    try {
      await apiCall('PATCH', `/api/services/${id}`, {
        name:        name.trim(),
        description: desc || undefined,
        duration,
        price:       parseFloat(price),
        categoryId:  catId || undefined,
        image:       image  || undefined,
      });
      toast.success('Service updated');
      setEditing(false);
      refetch();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleToggle() {
    if (!service) return;
    try {
      await apiCall('PATCH', `/api/services/${id}`, { isActive: !service.isActive });
      toast.success(service.isActive ? 'Service deactivated' : 'Service activated');
      refetch();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiCall('DELETE', `/api/services/${id}`);
      toast.success('Service deleted');
      router.push('/dashboard/services');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
      setDeleting(false);
    }
  }

  if (loading) return (
    <div className="max-w-xl mx-auto space-y-3">
      <Skeleton className="h-6 w-40" /><Skeleton className="h-8 w-56" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
  if (!service) return <p className="text-sm text-gray-500">Service not found.</p>;

  return (
    <div className="max-w-xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Services
      </button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge label={service.isActive ? 'Active' : 'Inactive'} variant={service.isActive ? 'success' : 'neutral'} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{service.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{service.duration} min · ₹{service.price}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleToggle}>
            {service.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDelOpen(true)}>
            <Trash2 size={13} /> Delete
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Details</h2>
          {!editing
            ? <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-indigo-600"><Edit2 size={12} /> Edit</button>
            : <div className="flex gap-1">
                <button onClick={handleSave} disabled={saving} className="p-1 rounded text-emerald-600 hover:bg-emerald-50"><Check size={14} /></button>
                <button onClick={() => { setEditing(false); }} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={14} /></button>
              </div>
          }
        </div>

        <div className="space-y-4">
          <FormField label="Name" required>
            {editing
              ? <input value={name} onChange={e => setName(e.target.value)} className="form-input" />
              : <p className="text-sm text-gray-800">{service.name}</p>
            }
          </FormField>
          <FormField label="Description">
            {editing
              ? <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="form-input resize-none" />
              : <p className="text-sm text-gray-800">{service.description || '—'}</p>
            }
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Price (₹)">
              {editing
                ? <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} className="form-input" />
                : <p className="text-sm text-gray-800">₹{service.price}</p>
              }
            </FormField>
            <FormField label="Category">
              {editing
                ? <select value={catId} onChange={e => setCatId(e.target.value)} className="form-input">
                    <option value="">No category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                : <p className="text-sm text-gray-800">{service.category?.name ?? '—'}</p>
              }
            </FormField>
          </div>
          <FormField label="Duration">
            {editing
              ? <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map(d => (
                    <button key={d} type="button" onClick={() => setDuration(d)}
                      className={`px-3 py-1.5 rounded-lg text-sm border font-medium transition-colors ${
                        duration === d ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 text-gray-600'
                      }`}>{d} min</button>
                  ))}
                </div>
              : <p className="text-sm text-gray-800">{service.duration} minutes</p>
            }
          </FormField>
          <FormField label="Image URL">
            {editing
              ? <input value={image} onChange={e => setImage(e.target.value)} className="form-input" placeholder="https://…" />
              : <p className="text-sm text-gray-800 break-all">{service.image || '—'}</p>
            }
          </FormField>
        </div>
      </div>

      <ConfirmDialog
        open={delOpen}
        onClose={() => setDelOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete service?"
        description={`"${service.name}" will be permanently deleted. Existing bookings referencing this service are preserved.`}
        confirmLabel="Delete service"
        variant="danger"
      />
    </div>
  );
}
