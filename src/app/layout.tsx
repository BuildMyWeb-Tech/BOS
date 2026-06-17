// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import StoreProvider from '@/context/StoreProvider';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'BOS — Business Operating System', template: '%s | BOS' },
  description: 'Multi-Tenant Business Operating System',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'BOS' },
};

export const viewport: Viewport = {
  themeColor: '#1e1b4b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <StoreProvider>
          {children}
        </StoreProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#1e1b4b', color: '#c7d2fe', border: '1px solid #4f46e5', borderRadius: '8px', fontSize: '14px' },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  );
}
