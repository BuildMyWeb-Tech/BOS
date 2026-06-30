// src/app/(storefront)/layout.tsx
// Public storefront — no auth, no sidebar. Tenant resolved from [slug] param.

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
