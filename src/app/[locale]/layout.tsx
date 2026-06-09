import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Polla Mundialista 2026',
  description: 'World Cup 2026 prediction pool for friend groups',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  // Validate supported locales
  if (!['es', 'en'].includes(locale)) {
    notFound();
  }

  // Load locale messages
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark" style={{ colorScheme: 'dark' }}>
      <body className="antialiased min-h-screen bg-background text-foreground bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
