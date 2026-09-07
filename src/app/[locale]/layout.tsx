import * as React from 'react';
import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import '../globals.css';

// Self-hosted via next/font (no render-blocking Google CSS import, no FOUT).
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'La Polla',
  description: 'La polla de tu grupo de amigos: Mundial, Champions League y lo que venga.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Applies the saved light/dark choice before first paint (no flash).
// Dark is the default; 'light' is opt-in via the header toggle.
const MODE_SCRIPT = `(function(){try{var m=localStorage.getItem('mode');if(m==='light'||m==='dark'){document.documentElement.dataset.mode=m;document.documentElement.style.colorScheme=m}}catch(e){}})();`;

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
    <html lang={locale} data-mode="dark" style={{ colorScheme: 'dark' }} className={outfit.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />
      </head>
      <body className="antialiased min-h-screen bg-background text-foreground app-bg">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
