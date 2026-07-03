// src/app/api/inngest/route.ts
//
// Inngest handler endpoint — Inngest dev server (local) and Inngest cloud
// (production) both POST to this URL to discover registered functions and
// to invoke them with event payloads.
//
// Local dev:  npx inngest-cli@latest dev  (runs the Inngest dev UI on port 8288)
// Production: Inngest cloud calls this after receiving an event from our code

import { serve }   from 'inngest/next';
import { inngest } from '@/inngest/client';
import {
  bookingReminderFunction,
  lowStockAlertFunction,
  vendorApprovedFunction,
  vendorRejectedFunction,
} from '@/inngest/index';

export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [
    bookingReminderFunction,
    lowStockAlertFunction,
    vendorApprovedFunction,
    vendorRejectedFunction,
  ],
});
