// src/lib/razorpay.ts
//
// Razorpay signature verification — pure Node crypto, no SDK needed.
//
// Razorpay signs webhook payloads with HMAC-SHA256 using the webhook
// secret as the key. We verify by computing the expected signature
// and comparing it to the one Razorpay sends in the X-Razorpay-Signature
// header. Constant-time comparison prevents timing attacks.

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify a Razorpay webhook signature.
 *
 * @param rawBody   The raw request body as a UTF-8 string (must NOT be JSON.parsed first)
 * @param signature The value of the X-Razorpay-Signature header
 * @param secret    RAZORPAY_WEBHOOK_SECRET from env
 */
export function verifyRazorpaySignature(
  rawBody:   string,
  signature: string,
  secret:    string
): boolean {
  try {
    const expected = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf  = Buffer.from(expected,  'hex');
    const signatureBuf = Buffer.from(signature, 'hex');

    // Length check before timingSafeEqual (it throws if lengths differ)
    if (expectedBuf.length !== signatureBuf.length) return false;

    return timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

/**
 * Extract the booking payment ID from a Razorpay webhook payload.
 * Razorpay sends the payment entity inside event.payload.payment.entity.
 */
export interface RazorpayWebhookPayload {
  event:   string; // e.g. "payment.captured" | "payment.failed"
  payload: {
    payment: {
      entity: {
        id:           string; // razorpay_payment_id
        order_id:     string; // razorpay_order_id
        status:       string; // "captured" | "failed" | "refunded"
        amount:       number; // in paise (divide by 100 for INR)
        currency:     string;
        description?: string;
        error_code?:  string;
        error_description?: string;
      };
    };
  };
}

export function parseWebhookPayload(body: string): RazorpayWebhookPayload | null {
  try {
    return JSON.parse(body) as RazorpayWebhookPayload;
  } catch {
    return null;
  }
}

/** Events we handle — all others are acknowledged but ignored. */
export const HANDLED_EVENTS = ['payment.captured', 'payment.failed'] as const;
export type HandledEvent = typeof HANDLED_EVENTS[number];

export function isHandledEvent(event: string): event is HandledEvent {
  return HANDLED_EVENTS.includes(event as HandledEvent);
}
