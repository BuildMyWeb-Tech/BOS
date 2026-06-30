'use client';
// src/app/(super-admin)/super-admin/page.tsx
// Super admin landing — redirects to vendor list.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/super-admin/vendors'); }, [router]);
  return null;
}
