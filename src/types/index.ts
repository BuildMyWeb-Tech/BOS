// src/types/index.ts
//
// Core TypeScript types for BOS.
// These are application-level types. Prisma-generated types live in @prisma/client.

// ─── Re-exports from auth lib ─────────────────────────────────────
export type { JwtPayload, UserRole } from '@/lib/auth';

// ─── API response shape ───────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ─── Tenant ───────────────────────────────────────────────────────

export type ModuleFlag = 'booking' | 'inventory' | 'billing' | 'ecommerce';

export interface TenantModules {
  booking:   boolean;
  inventory: boolean;
  billing:   boolean;
  ecommerce: boolean;
}

export interface TenantContext {
  id:       string;
  slug:     string;
  name:     string;
  isActive: boolean;
  status:   string;
  modules:  TenantModules;
}

export type TenantStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface VendorListItem {
  id:           string;
  name:         string;
  slug:         string;
  businessType: string;
  email:        string;
  phone:        string;
  address:      string;
  logo:         string;
  status:       TenantStatus;
  isActive:     boolean;
  modules:      TenantModules;
  createdAt:    string;
  ownerEmail:   string | null;
}

export interface VendorRegistrationRequest {
  businessName:  string;
  businessType:  string;
  description?:  string;
  address:       string;
  phone:         string;
  website?:      string;
  modules: {
    booking:   boolean;
    inventory: boolean;
    billing:   boolean;
    ecommerce: boolean;
  };
  ownerName:     string;
  ownerEmail:    string;
  ownerPassword: string;
  ownerPhone?:   string;
}

// ─── Staff ────────────────────────────────────────────────────────

// Summary row used in list endpoint
export interface StaffListItem {
  id:        string; // Staff.id
  userId:    string;
  name:      string;
  email:     string;
  phone:     string | null;
  image:     string;
  bio:       string | null;
  isActive:  boolean;
  permissions: string[];
  leaveCount:  number; // number of leave dates
  createdAt:   string;
}

// Full staff profile returned by GET /api/staff/[id]
export interface StaffProfile extends StaffListItem {
  leaveDates:   string[];
  bookingCount: number;
}

// ─── Permissions ─────────────────────────────────────────────────

export type PermissionCode =
  | 'booking.view'   | 'booking.create'   | 'booking.edit'   | 'booking.delete'
  | 'inventory.view' | 'inventory.manage'
  | 'product.view'   | 'product.create'   | 'product.edit'   | 'product.delete'
  | 'billing.view'   | 'billing.create'   | 'billing.refund'
  | 'sales.view'
  | 'orders.view'    | 'orders.manage'
  | 'customer.view'  | 'customer.edit'
  | 'report.view'    | 'report.export'
  | 'staff.view'     | 'staff.manage'
  | 'settings.view'  | 'settings.manage';

// Permissions grouped by module — used in the permissions UI
export interface PermissionGroup {
  module:      string;
  label:       string;
  permissions: Array<{
    code:        PermissionCode;
    description: string;
    action:      string;
  }>;
}

// ─── Auth ─────────────────────────────────────────────────────────

export interface LoginRequest {
  email:    string;
  password: string;
}

export interface LoginResponse {
  token:        string;
  refreshToken: string;
  user: {
    id:          string;
    name:        string;
    email:       string;
    role:        string;
    tenantId:    string | null;
    permissions: string[];
    image:       string;
  };
}

export interface RegisterRequest {
  name:     string;
  email:    string;
  password: string;
  phone?:   string;
}

// ─── Pagination ───────────────────────────────────────────────────

export interface PaginationParams {
  page:     number;
  limit:    number;
  search?:  string;
  sortBy?:  string;
  sortDir?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items:      T[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

// ─── Booking ─────────────────────────────────────────────────────

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESCHEDULED';

export interface TimeSlot {
  date:      string;
  startTime: string;
  endTime:   string;
  available: boolean;
}

// ─── Notifications ────────────────────────────────────────────────

export type NotificationType =
  | 'NEW_BOOKING'
  | 'NEW_ORDER'
  | 'LOW_STOCK'
  | 'VENDOR_APPROVED'
  | 'SYSTEM';

// ─── Utility ─────────────────────────────────────────────────────

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
