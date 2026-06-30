'use client';
// src/app/(dashboard)/dashboard/staff/[id]/page.tsx
//
// Staff profile — view and edit basic info, manage leave dates.

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link  from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit2, Check, X, Trash2, Plus, ShieldCheck } from 'lucide-react';

import Badge         from '@/components/ui/Badge';
import Button        from '@/components/ui/Button';
import FormField     from '@/components/ui/FormField';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Skeleton }  from '@/components/ui/SkeletonTable';
import { useFetch }  from '@/hooks/useFetch';
import { apiCall, ApiError } from '@/lib/apiClient';
import type { StaffProfile } from '@/types';

export default function StaffDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();

  const { data, loading, refetch } = useFetch<{ staff: StaffProfile }>(`/api/staff/${id}`);
  const staff = data?.staff;

  // Edit state
  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [bio,      setBio]      = useState('');
  const [saving,   setSaving]   = useState(false);

  // Leave dates
  const [leaveDates,   setLeaveDates]   = useState<string[]>([]);
  const [newLeaveDate, setNewLeaveDate] = useState('');
  const [savingLeave,  setSavingLeave]  = useState(false);

  // Deactivate
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating,   setDeactivating]   = useState(false);

  // Sync staff data into edit fields when loaded
  useEffect(() => {
    if (!staff) return;
    setName(staff.name);
    setPhone(staff.phone ?? '');
    setBio(staff.bio ?? '');
    setLeaveDates(staff.leaveDates ?? []);
  }, [staff]);

  async function handleSave() {
    if (name.trim().length < 2) { toast.error('Name must be at least 2 characters'); return; }
    setSaving(true);
    try {
      await apiCall('PATCH', `/api/staff/${id}`, {
        name:  name.trim(),
        phone: phone || undefined,
        bio:   bio   || undefined,
      });
      toast.success('Profile updated');
      setEditing(false);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally { setSaving(false); }
  }

  async function saveLeave(dates: string[]) {
    setSavingLeave(true);
    try {
      await apiCall('PATCH', `/api/staff/${id}/leave-dates`, { leaveDates: dates });
      setLeaveDates(dates);
      toast.success('Leave dates updated');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally { setSavingLeave(false); }
  }

  function addLeaveDate() {
    if (!newLeaveDate || leaveDates.includes(newLeaveDate)) {
      toast.error(leaveDates.includes(newLeaveDate) ? 'Date already added' : 'Select a date');
      return;
    }
    const updated = [...leaveDates, newLeaveDate].sort();
    saveLeave(updated);
    setNewLeaveDate('');
  }

  function removeLeaveDate(date: string) {
    saveLeave(leaveDates.filter(d => d !== date));
  }

  async function handleDeactivate() {
    if (!staff) return;
    setDeactivating(true);
    try {
      await apiCall('PATCH', `/api/staff/${id}/deactivate`, { active: !staff.isActive });
      toast.success(staff.isActive ? 'Staff deactivated' : 'Staff reactivated');
      setDeactivateOpen(false);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally { setDeactivating(false); }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 mt-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!staff) return <p className="text-sm text-gray-500">Staff member not found.</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to staff
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
            <span className="text-xl font-bold text-indigo-600">{staff.name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{staff.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge label={staff.isActive ? 'Active' : 'Inactive'} variant={staff.isActive ? 'success' : 'neutral'} />
              <span className="text-sm text-gray-400">{staff.bookingCount ?? 0} bookings</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/staff/${id}/permissions`}>
            <Button variant="secondary" size="sm"><ShieldCheck size={13} /> Permissions</Button>
          </Link>
          <Button variant={staff.isActive ? 'danger' : 'primary'} size="sm"
            onClick={() => setDeactivateOpen(true)}>
            {staff.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Profile info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Profile</h2>
            {!editing ? (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
                <Edit2 size={12} /> Edit
              </button>
            ) : (
              <div className="flex gap-1">
                <button onClick={handleSave} disabled={saving}
                  className="p-1 rounded text-emerald-600 hover:bg-emerald-50"><Check size={14} /></button>
                <button onClick={() => { setEditing(false); setName(staff.name); setPhone(staff.phone ?? ''); setBio(staff.bio ?? ''); }}
                  className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={14} /></button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <FormField label="Full name">
              {editing
                ? <input value={name} onChange={e => setName(e.target.value)} className="form-input" />
                : <p className="text-sm text-gray-800">{staff.name}</p>
              }
            </FormField>
            <FormField label="Email">
              <p className="text-sm text-gray-800">{staff.email}</p>
            </FormField>
            <FormField label="Phone">
              {editing
                ? <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9000000000" className="form-input" />
                : <p className="text-sm text-gray-800">{staff.phone ?? '—'}</p>
              }
            </FormField>
            <FormField label="Bio">
              {editing
                ? <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} className="form-input resize-none" />
                : <p className="text-sm text-gray-800">{staff.bio || '—'}</p>
              }
            </FormField>
          </div>
        </div>

        {/* Leave dates */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Leave dates ({leaveDates.length})
          </h2>

          <div className="flex gap-2 mb-3">
            <input type="date" value={newLeaveDate} onChange={e => setNewLeaveDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="form-input flex-1" />
            <Button size="sm" onClick={addLeaveDate} loading={savingLeave}>
              <Plus size={13} />
            </Button>
          </div>

          {leaveDates.length === 0 ? (
            <p className="text-sm text-gray-400">No leave dates set.</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {leaveDates.map(date => (
                <div key={date} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-700">
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </span>
                  <button onClick={() => removeLeaveDate(date)}
                    className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={handleDeactivate}
        loading={deactivating}
        title={staff.isActive ? 'Deactivate staff member' : 'Reactivate staff member'}
        description={
          staff.isActive
            ? `${staff.name} will lose all system access immediately. Their booking history is preserved.`
            : `${staff.name} will regain access to the system.`
        }
        confirmLabel={staff.isActive ? 'Deactivate' : 'Reactivate'}
        variant={staff.isActive ? 'danger' : 'primary'}
      />
    </div>
  );
}
