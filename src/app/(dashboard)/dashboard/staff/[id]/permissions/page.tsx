'use client';
// src/app/(dashboard)/dashboard/staff/[id]/permissions/page.tsx
//
// Full-page permission editor for a staff member.
// Loads current permissions, renders grouped checkbox grid,
// supports select-all per module, reset to system defaults.

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, RotateCcw } from 'lucide-react';

import Button        from '@/components/ui/Button';
import { Skeleton }  from '@/components/ui/SkeletonTable';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useFetch }  from '@/hooks/useFetch';
import { apiCall }   from '@/lib/apiClient';

// All 24 permission codes grouped by module
const PERMISSION_GROUPS = [
  { module: 'Booking',   label: 'Booking',   codes: ['booking.view', 'booking.create', 'booking.edit', 'booking.delete'] },
  { module: 'Inventory', label: 'Inventory',  codes: ['inventory.view', 'inventory.manage'] },
  { module: 'Products',  label: 'Products',   codes: ['product.view', 'product.create', 'product.edit', 'product.delete'] },
  { module: 'Billing',   label: 'Billing',    codes: ['billing.view', 'billing.create', 'billing.refund'] },
  { module: 'Sales',     label: 'Sales',      codes: ['sales.view'] },
  { module: 'Orders',    label: 'Orders',     codes: ['orders.view', 'orders.manage'] },
  { module: 'Customers', label: 'Customers',  codes: ['customer.view', 'customer.edit'] },
  { module: 'Reports',   label: 'Reports',    codes: ['report.view', 'report.export'] },
  { module: 'Staff',     label: 'Staff',      codes: ['staff.view', 'staff.manage'] },
  { module: 'Settings',  label: 'Settings',   codes: ['settings.view', 'settings.manage'] },
];

interface PermissionData {
  permissions: string[];
  staffName:   string;
}

export default function StaffPermissionsPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  // Load current permissions via grouped permissions endpoint
  const { data, loading } = useFetch<{ groups: Array<{ module: string; permissions: Array<{ code: string }> }> }>(
    `/api/staff/${id}/permissions`
  );

  // Also need the staff name
  const { data: staffData } = useFetch<{ staff: { name: string } }>(`/api/staff/${id}`);
  const staffName = staffData?.staff?.name ?? 'Staff member';

  const [selected,      setSelected]      = useState<string[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [resetOpen,     setResetOpen]     = useState(false);
  const [resetting,     setResetting]     = useState(false);
  const [dirty,         setDirty]         = useState(false);

  // When data loads, initialise selected from the grouped response
  useEffect(() => {
    if (!data?.groups) return;
    const codes = data.groups.flatMap(g => g.permissions.map(p => p.code));
    setSelected(codes);
    setDirty(false);
  }, [data]);

  function togglePermission(code: string) {
    setDirty(true);
    setSelected(prev =>
      prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]
    );
  }

  function toggleModule(codes: string[]) {
    const allSelected = codes.every(c => selected.includes(c));
    setDirty(true);
    if (allSelected) {
      setSelected(prev => prev.filter(p => !codes.includes(p)));
    } else {
      setSelected(prev => [...new Set([...prev, ...codes])]);
    }
  }

  async function handleSave() {
    if (selected.length === 0) { toast.error('At least one permission is required'); return; }
    setSaving(true);
    try {
      await apiCall('PATCH', `/api/staff/${id}/permissions`, { permissions: selected });
      toast.success('Permissions saved');
      setDirty(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await apiCall('DELETE', `/api/staff/${id}/permissions`);
      toast.success('Reset to default STAFF permissions');
      setResetOpen(false);
      // Reload permissions
      window.location.reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset');
    } finally { setResetting(false); }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to {staffName}
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Permissions</h1>
          <p className="text-sm text-gray-500 mt-0.5">{staffName} — {selected.length} of 24 permissions granted</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setResetOpen(true)}>
            <RotateCcw size={13} /> Reset defaults
          </Button>
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-50">
          {PERMISSION_GROUPS.map(group => {
            const allSelected  = group.codes.every(c => selected.includes(c));
            const someSelected = group.codes.some(c => selected.includes(c));
            const grantedCount = group.codes.filter(c => selected.includes(c)).length;

            return (
              <div key={group.module} className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id={`group-${group.module}`}
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={() => toggleModule(group.codes)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor={`group-${group.module}`}
                      className="text-sm font-semibold text-gray-700 cursor-pointer">
                      {group.label}
                    </label>
                  </div>
                  <span className="text-xs text-gray-400">
                    {grantedCount}/{group.codes.length}
                  </span>
                </div>

                <div className="ml-7 flex flex-wrap gap-x-6 gap-y-2">
                  {group.codes.map(code => {
                    const action = code.split('.')[1];
                    return (
                      <label key={code} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={selected.includes(code)}
                          onChange={() => togglePermission(code)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-600 group-hover:text-gray-900 capitalize">
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
      )}

      {/* Sticky save bar when dirty */}
      {dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm rounded-xl px-5 py-3 shadow-xl flex items-center gap-4 z-40">
          <span>You have unsaved changes</span>
          <Button size="sm" onClick={handleSave} loading={saving}>Save</Button>
          <button onClick={() => { setDirty(false); window.location.reload(); }}
            className="text-gray-400 hover:text-white text-xs">Discard</button>
        </div>
      )}

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleReset}
        loading={resetting}
        title="Reset to default permissions"
        description={`This will replace ${staffName}'s custom permissions with the standard STAFF role set (booking view/create, customer view, sales view).`}
        confirmLabel="Reset permissions"
        variant="danger"
      />
    </div>
  );
}
