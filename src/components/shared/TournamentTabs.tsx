'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, ArrowLeft } from 'lucide-react';
import { setCurrentTournament } from '@/lib/api';
import type { Tournament, Locale } from '@/lib/types';

/**
 * The present tournament IS the app: nothing is shown while you're on it.
 * Only when someone has stepped into an archived tournament (via the Hall of
 * Fame) does a slim bar appear, with one tap back to the current season.
 */
export function TournamentTabs({ tournaments, current, locale }: {
  tournaments: Tournament[];
  current: Tournament;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const es = locale === 'es';
  if (current.status !== 'archived') return null;
  const live = tournaments.find((t) => t.status === 'active') ?? tournaments.find((t) => t.status === 'upcoming') ?? null;

  const back = () => {
    if (!live) return;
    startTransition(async () => {
      await setCurrentTournament(live.slug);
      router.push(`/${locale}/dashboard`);
      router.refresh();
    });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/90">
      <span className="inline-flex items-center gap-1.5">
        <Archive className="h-3.5 w-3.5" />
        {es ? 'Torneo anterior' : 'Previous tournament'}: <b>{es ? current.nameEs : current.nameEn}</b> · {es ? 'solo lectura' : 'read-only'}
        {' · '}
        <Link href={`/${locale}/hall`} className="font-bold underline-offset-2 hover:underline">{es ? 'Salón de la Fama' : 'Hall of Fame'}</Link>
      </span>
      {live && (
        <button
          type="button"
          onClick={back}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-60"
        >
          <ArrowLeft className="h-3 w-3" />
          {es ? `Volver a ${live.nameEs}` : `Back to ${live.nameEn}`}
        </button>
      )}
    </div>
  );
}
