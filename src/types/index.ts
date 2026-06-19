// src/types/index.ts

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
  id:           string;
  slug:         string;
  name:         string;
  logo:         string;
  businessType: string;
  isActive:     boolean;
  status:       string;
  modules:      TenantModules;
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
  modules:       TenantModules;
  ownerName:     string;
  ownerEmail:    string;
  ownerPassword: string;
  ownerPhone?:   string;
}

// ─── Auth state (client-side) ─────────────────────────────────────

import type { UserRole } from '@/lib/auth';

export interface AuthUser {
  id:          string;
  name:        string;
  email:       string;
  image:       string;
  role:        UserRole;
  tenantId:    string | null;
  permissions: string[];
}

export interface AuthState {
  user:         AuthUser | null;
  token:        string | null;
  refreshToken: string | null;
  isLoading:    boolean;
  isHydrated:   boolean; // true after localStorage read + /me call complete
}

// ─── Staff ────────────────────────────────────────────────────────

export interface StaffListItem {
  id:          string;
  userId:      string;
  name:        string;
  email:       string;
  phone:       string | null;
  image:       string;
  bio:         string | null;
  isActive:    boolean;
  permissions: string[];
  leaveCount:  number;
  createdAt:   string;
}

export interface StaffProfile extends StaffListItem {
  leaveDates:   string[];
  bookingCount: number;
}

// ─── Dashboard ────────────────────────────────────────────────────

export interface DashboardStats {
  revenue: {
    today:       number;
    thisMonth:   number;
    lastMonth:   number;
    trend:       number; // % change vs last month
  };
  bookings: {
    today:       number;
    thisMonth:   number;
    pending:     number;
    confirmed:   number;
  };
  orders: {
    today:       number;
    thisMonth:   number;
    pending:     number;
  };
  customers: {
    total:       number;
    newThisMonth: number;
  };
  products: {
    total:       number;
    lowStock:    number;
    outOfStock:  number;
  };
}

// ─── Navigation ───────────────────────────────────────────────────

export interface NavItem {
  label:       string;
  href:        string;
  icon:        string; // lucide icon name
  // If set, item only shows when this module is enabled
  module?:     ModuleFlag;
  // If set, item only shows when user has one of these permissions
  permissions?: string[];
  // If set, item only shows for these roles
  roles?:      UserRole[];
  badge?:      number; // notification count
  children?:   NavItem[];
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

export interface LoginRequest  { email: string; password: string; }
export interface RegisterRequest { name: string; email: string; password: string; phone?: string; }

export interface LoginResponse {
  token:        string;
  refreshToken: string;
  user:         AuthUser & { tenantName?: string; tenantSlug?: string; modules?: TenantModules };
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

export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

export interface TimeSlot {
  date:      string;
  startTime: string;
  endTime:   string;
  available: boolean;
}

// ─── Notifications ────────────────────────────────────────────────

export type NotificationType = 'NEW_BOOKING' | 'NEW_ORDER' | 'LOW_STOCK' | 'VENDOR_APPROVED' | 'SYSTEM';

// ─── Utility ─────────────────────────────────────────────────────

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// ─── Booking Engine Types ─────────────────────────────────────────

export interface ServiceCategory {
  id:          string;
  tenantId:    string;
  name:        string;
  description: string;
  isActive:    boolean;
  serviceCount: number;
  createdAt:   string;
}

export interface Service {
  id:          string;
  tenantId:    string;
  categoryId:  string | null;
  category:    Pick<ServiceCategory, 'id' | 'name'> | null;
  name:        string;
  description: string;
  duration:    number; // minutes
  price:       number;
  isActive:    boolean;
  image:       string;
  createdAt:   string;
  updatedAt:   string;
}

export type ResourceType = 'court' | 'room' | 'table' | 'equipment' | 'other';

export interface Resource {
  id:          string;
  tenantId:    string;
  name:        string;
  type:        ResourceType;
  description: string | null;
  isActive:    boolean;
  bookingCount: number;
  createdAt:   string;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface SlotConfig {
  id:                     string;
  tenantId:               string;
  slotStartTime:          string; // "HH:MM"
  slotEndTime:            string;
  slotDuration:           number; // minutes
  breakEnabled:           boolean;
  breakStartTime:         string | null;
  breakEndTime:           string | null;
  daysOpen:               DayOfWeek[];
  maxAdvanceBookingDays:  number;
  minBookingHoursBefore:  number;
  allowRescheduling:      boolean;
  rescheduleHoursBefore:  number;
  advancePaymentRequired: boolean;
  advancePaymentPercent:  number;
  createdAt:              string;
  updatedAt:              string;
}

// Staff summary used in service/booking contexts (not full StaffProfile)
export interface StaffSummary {
  id:       string; // Staff.id
  userId:   string;
  name:     string;
  email:    string;
  image:    string;
  isActive: boolean;
}

// ─── Holiday Management Types ─────────────────────────────────────

export interface BlockedDate {
  id:        string;
  tenantId:  string;
  date:      string; // "YYYY-MM-DD"
  reason:    string | null;
  createdAt: string;
}

export type RecurringHolidayType = 'weekly' | 'monthly';

export interface RecurringHoliday {
  id:        string;
  tenantId:  string;
  name:      string;
  type:      RecurringHolidayType;
  value:     string; // "Sunday" for weekly, "25" for monthly
  createdAt: string;
}

export interface SpecialWorkingDay {
  id:        string;
  tenantId:  string;
  date:      string; // "YYYY-MM-DD"
  createdAt: string;
}

// A single day in the calendar month view — used by booking calendar UI
export interface CalendarDay {
  date:        string;  // "YYYY-MM-DD"
  dayOfWeek:   DayOfWeek;
  isOpen:      boolean; // final resolved status
  reason?:     string;  // why closed, e.g. "Weekly holiday: Sunday" or blocked-date reason
  source?:     'blocked' | 'recurring-weekly' | 'recurring-monthly' | 'not-in-days-open' | 'special-override';
}

export interface CalendarMonthView {
  year:  number;
  month: number; // 1-indexed
  days:  CalendarDay[];
}

// ─── Slot Engine Types ─────────────────────────────────────────────

export interface AvailableSlot {
  startTime: string; // "HH:MM"
  endTime:   string; // "HH:MM"
  available: boolean;
  staffId?:  string | null;
}

export interface DaySlotAvailability {
  date:           string; // "YYYY-MM-DD"
  isOpen:          boolean; // from calendar engine
  closedReason?:   string;
  slots:           AvailableSlot[];
  availableCount:  number;
}

export interface RangeSlotAvailability {
  date:           string;
  isOpen:          boolean;
  availableCount: number;
}
