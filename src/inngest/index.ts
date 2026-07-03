// src/inngest/index.ts
// Barrel — export every Inngest function so the API route handler
// can register them all in one import.

export { bookingReminderFunction }                        from './functions/bookingReminder';
export { lowStockAlertFunction }                          from './functions/lowStockAlert';
export { vendorApprovedFunction, vendorRejectedFunction } from './functions/vendorOnboarding';
