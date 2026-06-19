// src/lib/booking/bookingMath.ts
//
// Pure functions for booking payment math. No DB, no side effects.
// Kept separate from route handlers so the money logic can be unit
// tested in isolation from Prisma transactions.

/**
 * Calculate the amount due upfront for a booking based on tenant's
 * advance payment configuration.
 *
 * If advance payment is not required, the full amount is due immediately
 * (since there's no "advance" — payment captures the whole thing at booking time
 * in the cash/walk-in flow), modelled as requiredAmount === totalAmount.
 * If advance payment IS required, requiredAmount is the percentage cut.
 */
export function calculateRequiredAdvance(
  totalAmount: number,
  advancePaymentRequired: boolean,
  advancePaymentPercent: number
): number {
  if (!advancePaymentRequired) return totalAmount;
  const raw = (totalAmount * advancePaymentPercent) / 100;
  // Round to 2 decimal places to avoid floating point cents drift
  return Math.round(raw * 100) / 100;
}

export interface PaymentApplication {
  newPaidAmount:      number;
  newRemainingAmount: number;
  newStatus:          'PENDING_PAYMENT' | 'CONFIRMED';
}

/**
 * Apply a completed payment to a booking and determine the resulting
 * paidAmount / remainingAmount / status.
 *
 * Rule: booking moves to CONFIRMED once paidAmount >= the required
 * advance threshold (not necessarily the full totalAmount — partial
 * advance payment is enough to confirm, per advancePaymentPercent).
 * Remaining balance can be settled later (e.g. in person) without
 * blocking confirmation.
 */
export function applyPayment(params: {
  currentPaidAmount:  number;
  totalAmount:        number;
  requiredAdvance:    number;
  paymentAmount:      number;
}): PaymentApplication {
  const { currentPaidAmount, totalAmount, requiredAdvance, paymentAmount } = params;

  const newPaidAmount = Math.round((currentPaidAmount + paymentAmount) * 100) / 100;
  const cappedPaid    = Math.min(newPaidAmount, totalAmount); // never exceed total
  const newRemainingAmount = Math.round((totalAmount - cappedPaid) * 100) / 100;

  const newStatus: PaymentApplication['newStatus'] =
    cappedPaid >= requiredAdvance ? 'CONFIRMED' : 'PENDING_PAYMENT';

  return {
    newPaidAmount: cappedPaid,
    newRemainingAmount,
    newStatus,
  };
}

/**
 * Determine whether a booking can still be cancelled, based on the
 * configured cancellation/reschedule window. Re-uses rescheduleHoursBefore
 * as the cancellation window too (one configurable buffer for both).
 *
 * Returns { allowed: true } or { allowed: false, reason }.
 */
export function canModifyBooking(params: {
  date:                  string; // "YYYY-MM-DD"
  startTime:             string; // "HH:MM"
  now:                   Date;
  rescheduleHoursBefore: number;
  allowRescheduling:     boolean;
  isReschedule:          boolean; // true for reschedule check, false for cancel check
}): { allowed: boolean; reason?: string } {
  const { date, startTime, now, rescheduleHoursBefore, allowRescheduling, isReschedule } = params;

  if (isReschedule && !allowRescheduling) {
    return { allowed: false, reason: 'Rescheduling is not enabled for this business' };
  }

  const [y, m, d] = date.split('-').map(Number);
  const [h, min]  = startTime.split(':').map(Number);
  const bookingDateTime = new Date(y, m - 1, d, h, min);

  const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilBooking < rescheduleHoursBefore) {
    return {
      allowed: false,
      reason: `Must be done at least ${rescheduleHoursBefore} hour(s) before the appointment`,
    };
  }

  return { allowed: true };
}
