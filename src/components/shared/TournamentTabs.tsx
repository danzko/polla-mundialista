'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, Trophy } from 'lucide-react';
import { setCurrentTournament } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Tournament, Locale } from '@/lib/types';

/**
 * Tournament switcher: one tab per competition (Champions League 2026-27,
 * Mundial 2026 archive, ...). Switching sets the `t` cookie server-side and
 * refreshes, so every page below re-reads scoped to that tournament.
 */
export function TournamentTabs({ tournaments, current, locale }: {
  tournaments: Tournament[];
  current: Tournament;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const es = locale === 'es';
  if (tournaments.length < 2) return null;

  const switchTo = (slug: string) => {
    if (slug === current.slug) return;
    startTransition(async () => {
      await setCurrentTournament(slug);
      router.refresh();
    });
  };

  return (
    <div className="mb-4">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none" role="tablist">
        {tournaments.map((t) => {
          const active = t.slug === current.slug;
          const archived = t.status === 'archived';
          return (
            <button
              key={t.slug}
              role="tab"
              aria-selected={active}
              disabled={pending}
              onClick={() => switchTo(t.slug)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/50 bg-card/60 text-muted-foreground hover:text-foreground',
                pending && 'opacity-60'
              )}
            >
              {archived ? <Archive className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />}
              {es ? t.nameEs : t.nameEn}
            </button>
          );
        })}
      </div>
      {current.status === 'archived' && (
        <p className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-1.5 text-[11px] text-amber-200/90">
          <span>
            {es
              ? 'Torneo terminado: resultados finales, solo lectura.'
              : 'Tournament over: final results, read-only.'}
          </span>
          <Link href={`/${locale}/hall`} className="font-bold text-amber-300 hover:underline">
            {es ? 'Salón de la Fama →' : 'Hall of Fame →'}
          </Link>
        </p>
      )}
    </div>
  );
}
