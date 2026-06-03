// src/app/page.tsx
// Root page — redirects to login.
// In a future phase this becomes the public landing page.

import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/login');
}
