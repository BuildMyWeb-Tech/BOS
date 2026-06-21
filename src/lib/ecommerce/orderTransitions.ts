// src/lib/ecommerce/orderTransitions.ts
//
// Explicit allowed-transitions map for OrderStatus, mirroring the same
// pattern used for BookingStatus in Phase 4. Prevents nonsensical jumps
// (e.g. ORDER_PLACED -> DELIVERED skipping shipment) and resurrecting
// terminal states (CANCELLED/RETURNED/REFUNDED).

import type { OrderStatus } from '@/types';

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  ORDER_PLACED:      ['CONFIRMED', 'PROCESSING', 'CANCELLED'],
  CONFIRMED:         ['PROCESSING', 'CANCELLED'],
  PROCESSING:        ['SHIPPED', 'CANCELLED'],
  SHIPPED:           ['DELIVERED', 'RETURN_REQUESTED'],
  DELIVERED:         ['RETURN_REQUESTED'],
  RETURN_REQUESTED:  ['RETURNED', 'DELIVERED'],
  RETURNED:          ['REFUNDED'],
  CANCELLED:         [],
  REFUNDED:          [],
};

export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedNextStatuses(from: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[from] ?? [];
}
