import * as React from 'react';

// Top-level root layout required by Next.js containing fallback html/body tags.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
