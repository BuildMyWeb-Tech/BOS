'use client';
// src/app/(dashboard)/dashboard/resources/[id]/page.tsx

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
import type { Resource } from '@/types';

const RESOURCE_TYPES = ['court', 'room', 'table', 'equipment', 'other'] as const;
const TYPE_LABELS: Record<string, string> = {
  court: 'Court', room: 'Room', table: 'Table', equipment: 'Equipment', other: 'Other',
};

export default function ResourceDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const { data, loading, refetch } = useFetch<{ resource: Resource }>(`/api/resources/${id}`);
  const resource = data?.resource;

  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState('');
  const [type,     setType]     = useState<typeof RESOURCE_TYPES[number]>('room');
  const [desc,     setDesc]     = useState('');
  const [saving,   setSaving]   = useState(false);
  const [delOpen,  setDelOpen]  = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!resource) return;
    setName(resource.name);
    setType(resource.type as typeof RESOURCE_TYPES[number]);
    setDesc(resource.description ?? '');
  }, [resource]);

  async function handleSave() {
    if (!name.trim() || name.trim().length < 2) { toast.error('Name must be at least 2 characters'); return; }
    setSaving(true);
    try {
      await apiCall('PATCH', `/api/resources/${id}`, {
        name:        name.trim(),
        type,
        description: desc || undefined,
      });
      toast.success('Resource updated');
      setEditing(false);
      refetch();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleToggle() {
    if (!resource) return;
    try {
      await apiCall('PATCH', `/api/resources/${id}`, { isActive: !resource.isActive });
      toast.success(resource.isActive ? 'Resource deactivated' : 'Resource activated');
      refetch();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiCall('DELETE', `/api/resources/${id}`);
      toast.success('Resource deleted');
      router.push('/dashboard/resources');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
      setDeleting(false);
    }
  }

  if (loading) return (
    <div className="max-w-xl mx-auto space-y-3">
      <Skeleton className="h-6 w-40" /><Skeleton className="h-8 w-56" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
  if (!resource) return <p className="text-sm text-gray-500">Resource not found.</p>;

  return (
    <div className="max-w-xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Resources
      </button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge label={TYPE_LABELS[resource.type] ?? resource.type} variant="brand" />
            <Badge label={resource.isActive ? 'Active' : 'Inactive'} variant={resource.isActive ? 'success' : 'neutral'} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{resource.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{resource.bookingCount ?? 0} total bookings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleToggle}>
            {resource.isActive ? 'Deactivate' : 'Activate'}
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
                <button onClick={() => setEditing(false)} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={14} /></button>
              </div>
          }
        </div>
        <div className="space-y-4">
          <FormField label="Name">
            {editing
              ? <input value={name} onChange={e => setName(e.target.value)} className="form-input" />
              : <p className="text-sm text-gray-800">{resource.name}</p>
            }
          </FormField>
          <FormField label="Type">
            {editing
              ? <select value={type} onChange={e => setType(e.target.value as typeof RESOURCE_TYPES[number])} className="form-input">
                  {RESOURCE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              : <p className="text-sm text-gray-800">{TYPE_LABELS[resource.type]}</p>
            }
          </FormField>
          <FormField label="Description">
            {editing
              ? <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="form-input resize-none" />
              : <p className="text-sm text-gray-800">{resource.description || '—'}</p>
            }
          </FormField>
        </div>
      </div>

      <ConfirmDialog
        open={delOpen}
        onClose={() => setDelOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete resource?"
        description={`"${resource.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete resource"
        variant="danger"
      />
    </div>
  );
}
