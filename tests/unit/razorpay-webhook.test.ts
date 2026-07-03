// tests/unit/razorpay-webhook.test.ts
// Unit tests for src/lib/razorpay.ts — pure crypto functions, no HTTP or DB.

import {
  verifyRazorpaySignature,
  parseWebhookPayload,
  isHandledEvent,
  HANDLED_EVENTS,
} from '@/lib/razorpay';
import { createHmac } from 'crypto';

// ── verifyRazorpaySignature ───────────────────────────────────────

function makeSignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

const SECRET  = 'test_webhook_secret_abc123';
const BODY    = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_123' } } } });
const VALID_SIG = makeSignature(BODY, SECRET);

describe('verifyRazorpaySignature', () => {
  test('returns true for a valid signature', () =>
    expect(verifyRazorpaySignature(BODY, VALID_SIG, SECRET)).toBe(true));

  test('returns false for a tampered body', () => {
    const tampered = BODY + ' '; // extra space changes the hash
    expect(verifyRazorpaySignature(tampered, VALID_SIG, SECRET)).toBe(false);
  });

  test('returns false for a wrong secret', () =>
    expect(verifyRazorpaySignature(BODY, VALID_SIG, 'wrong_secret')).toBe(false));

  test('returns false for an empty signature', () =>
    expect(verifyRazorpaySignature(BODY, '', SECRET)).toBe(false));

  test('returns false for an empty secret', () =>
    expect(verifyRazorpaySignature(BODY, VALID_SIG, '')).toBe(false));

  test('returns false for a completely wrong signature string', () =>
    expect(verifyRazorpaySignature(BODY, 'aabbccdd', SECRET)).toBe(false));

  test('hex decoding is case-insensitive (Buffer.from hex behaviour)', () => {
    // Buffer.from(hex, 'hex') treats uppercase and lowercase identically,
    // so 'aAbBcC' and 'aabbcc' decode to the same bytes. This is correct
    // behaviour — the HMAC value itself is what matters, not hex casing.
    const upperSig = VALID_SIG.toUpperCase();
    expect(verifyRazorpaySignature(BODY, upperSig, SECRET)).toBe(true);
  });

  test('different body same secret produces different valid signature', () => {
    const body2 = JSON.stringify({ event: 'payment.failed' });
    const sig2  = makeSignature(body2, SECRET);
    expect(verifyRazorpaySignature(body2, sig2, SECRET)).toBe(true);
    expect(verifyRazorpaySignature(BODY, sig2, SECRET)).toBe(false);
  });
});

// ── parseWebhookPayload ───────────────────────────────────────────

describe('parseWebhookPayload', () => {
  const validPayload = {
    event:   'payment.captured',
    payload: {
      payment: {
        entity: {
          id:       'pay_ABC123',
          order_id: 'order_XYZ',
          status:   'captured',
          amount:   59900,
          currency: 'INR',
        },
      },
    },
  };

  test('parses a valid JSON payload', () => {
    const result = parseWebhookPayload(JSON.stringify(validPayload));
    expect(result).not.toBeNull();
    expect(result?.event).toBe('payment.captured');
  });

  test('returns the payment entity correctly', () => {
    const result = parseWebhookPayload(JSON.stringify(validPayload));
    expect(result?.payload.payment.entity.id).toBe('pay_ABC123');
    expect(result?.payload.payment.entity.amount).toBe(59900);
  });

  test('returns null for invalid JSON', () =>
    expect(parseWebhookPayload('not json at all {')).toBeNull());

  test('returns null for empty string', () =>
    expect(parseWebhookPayload('')).toBeNull());

  test('returns null for a JSON number (not an object)', () =>
    expect(parseWebhookPayload('42')).not.toBeNull()); // JSON.parse(42) = 42, valid but wrong shape

  test('handles payment.failed event payload', () => {
    const failedPayload = {
      event:   'payment.failed',
      payload: {
        payment: {
          entity: {
            id:                'pay_FAIL',
            order_id:          'order_ERR',
            status:            'failed',
            amount:            10000,
            currency:          'INR',
            error_code:        'BAD_REQUEST_ERROR',
            error_description: 'Card declined',
          },
        },
      },
    };
    const result = parseWebhookPayload(JSON.stringify(failedPayload));
    expect(result?.payload.payment.entity.error_code).toBe('BAD_REQUEST_ERROR');
  });
});

// ── isHandledEvent ────────────────────────────────────────────────

describe('isHandledEvent', () => {
  test('payment.captured is handled',       () => expect(isHandledEvent('payment.captured')).toBe(true));
  test('payment.failed is handled',         () => expect(isHandledEvent('payment.failed')).toBe(true));
  test('payment.refunded is NOT handled',   () => expect(isHandledEvent('payment.refunded')).toBe(false));
  test('dispute.created is NOT handled',    () => expect(isHandledEvent('dispute.created')).toBe(false));
  test('empty string is NOT handled',       () => expect(isHandledEvent('')).toBe(false));
  test('PAYMENT.CAPTURED (caps) NOT handled', () => expect(isHandledEvent('PAYMENT.CAPTURED')).toBe(false));
});

// ── HANDLED_EVENTS constant ───────────────────────────────────────

describe('HANDLED_EVENTS', () => {
  test('contains exactly 2 events', () => expect(HANDLED_EVENTS).toHaveLength(2));
  test('includes payment.captured',  () => expect(HANDLED_EVENTS).toContain('payment.captured'));
  test('includes payment.failed',    () => expect(HANDLED_EVENTS).toContain('payment.failed'));
});
