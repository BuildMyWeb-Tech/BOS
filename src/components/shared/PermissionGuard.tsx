'use client';
// src/components/shared/PermissionGuard.tsx
//
// Conditionally renders children based on permission / role / module.
//
// Usage:
//   <PermissionGuard permission="booking.create">
//     <CreateBookingButton />
//   </PermissionGuard>
//
//   <PermissionGuard role="VENDOR_OWNER" fallback={<p>Owner only</p>}>
//     <OwnerSettings />
//   </PermissionGuard>
//
//   <ModuleGuard module="booking">
//     <BookingSection />
//   </ModuleGuard>

import { usePermissions }  from '@/hooks/usePermissions';
import { useAuth }         from '@/hooks/useAuth';
import { useModules }      from '@/hooks/useModules';
import type { UserRole, ModuleFlag } from '@/types';

interface PermissionGuardProps {
  permission?:  string;
  permissions?: string[];          // requires ALL
  anyPermission?: string[];        // requires ANY
  role?:        UserRole;
  roles?:       UserRole[];
  fallback?:    React.ReactNode;
  children:     React.ReactNode;
}

export function PermissionGuard({
  permission,
  permissions,
  anyPermission,
  role,
  roles,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { can, canAll, canAny } = usePermissions();
  const { role: userRole }      = useAuth();

  // Role check
  if (role   && userRole !== role)                    return <>{fallback}</>;
  if (roles  && !roles.includes(userRole as UserRole)) return <>{fallback}</>;

  // Permission check
  if (permission   && !can(permission))        return <>{fallback}</>;
  if (permissions  && !canAll(permissions))    return <>{fallback}</>;
  if (anyPermission && !canAny(anyPermission)) return <>{fallback}</>;

  return <>{children}</>;
}

// ─── ModuleGuard ─────────────────────────────────────────────────

interface ModuleGuardProps {
  module:    ModuleFlag;
  fallback?: React.ReactNode;
  children:  React.ReactNode;
}

export function ModuleGuard({ module, fallback = null, children }: ModuleGuardProps) {
  const { isEnabled, isLoading } = useModules();
  if (isLoading)          return null;
  if (!isEnabled(module)) return <>{fallback}</>;
  return <>{children}</>;
}
