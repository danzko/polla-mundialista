'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import { Button } from '@/components/ui/button';
import { Trophy, Calendar, Users, Star } from 'lucide-react';

export default function LandingPage() {
  const t = useTranslations();
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1] || 'es';

  return (
    <AppShell user={null}>
      <div className="flex flex-col items-center justify-center space-y-16 py-12 md:py-20">
        
        {/* HERO SECTION */}
        <section className="text-center max-w-3xl space-y-6 flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider animate-pulse">
            <Star className="h-3.5 w-3.5 fill-primary" />
            FIFA World Cup 2026
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
            {t('landing.heroTitle')}
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl font-light">
            {t('landing.heroSubtitle')}
          </p>

          <div className="pt-4">
            <Button asChild size="lg" className="rounded-xl font-bold shadow-lg shadow-primary/20 scale-105 hover:scale-108 transition-all">
              <Link href={`/${currentLocale}/login`}>
                🚀 {t('landing.ctaSignIn')}
              </Link>
            </Button>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section className="w-full max-w-5xl space-y-8">
          <h2 className="text-2xl font-bold text-center text-foreground tracking-tight select-none">
            {t('landing.featuresTitle')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="glass-card p-6 rounded-2xl flex flex-col space-y-3 shadow-md hover:border-primary/30 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {t('landing.feature1')}
              </h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">
                {t('landing.feature1Desc')}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-card p-6 rounded-2xl flex flex-col space-y-3 shadow-md hover:border-primary/30 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {t('landing.feature2')}
              </h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">
                {t('landing.feature2Desc')}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-card p-6 rounded-2xl flex flex-col space-y-3 shadow-md hover:border-primary/30 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                <Trophy className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {t('landing.feature3')}
              </h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">
                {t('landing.feature3Desc')}
              </p>
            </div>

          </div>
        </section>

      </div>
    </AppShell>
  );
}
