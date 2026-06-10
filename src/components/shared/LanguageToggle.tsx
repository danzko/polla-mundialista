'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function LanguageToggle() {
  const pathname = usePathname();
  const router = useRouter();

  // Extract the current locale from path segment (e.g., /es/dashboard -> 'es')
  const currentLocale = pathname.split('/')[1] || 'es';

  const toggleLanguage = () => {
    const newLocale = currentLocale === 'es' ? 'en' : 'es';
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      className="text-xs uppercase border-primary/20 bg-card hover:bg-primary/10 transition-colors"
      aria-label={currentLocale === 'es' ? 'Switch to English' : 'Cambiar a Español'}
    >
      {currentLocale === 'es' ? '🇺🇸 EN' : '🇨🇴 ES'}
    </Button>
  );
}
