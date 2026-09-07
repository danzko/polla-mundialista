import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { getHallOfFame } from '@/lib/api';
import { Flag } from '@/components/shared/Flag';
import { TrophyMark } from '@/components/shared/brand';
import { ViewTournamentButton } from '@/components/shared/ViewTournamentButton';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MEDAL = ['🥇', '🥈', '🥉'];
const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",ui-serif,serif';

/**
 * Salón de la Fama — every finished tournament's final table inside the
 * viewer's club, with the pool champion on a gold plaque. This is what makes
 * the app annual: titles accumulate here season after season.
 */
export default async function HallPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const es = locale === 'es';
  const honors = await getHallOfFame(locale as Locale);

  return (
    <div className="pb-24 max-w-2xl mx-auto">
      <Link href={`/${locale}/dashboard`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-3">
        <ArrowLeft className="h-3.5 w-3.5" />
        {es ? 'Volver' : 'Back'}
      </Link>

      <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
        <TrophyMark className="h-6 w-6" />
        {es ? 'Salón de la Fama' : 'Hall of Fame'}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        {es ? 'Los campeones de la polla, torneo a torneo.' : 'The pool champions, tournament by tournament.'}
      </p>

      {honors.length === 0 && (
        <div className="mt-6 rounded-2xl border border-border/50 bg-card/50 p-8 text-center text-sm text-muted-foreground">
          {es ? 'Todavía no hay torneos terminados.' : 'No finished tournaments yet.'}
        </div>
      )}

      {honors.map((h) => (
        <section key={h.tournament.id} className="mt-6 overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0C111C]">
          {/* Gold plaque */}
          <div
            className="relative px-5 pt-7 pb-6 text-center"
            style={{ background: 'radial-gradient(700px 260px at 50% -20%, rgba(242,196,82,.22), transparent 65%), linear-gradient(180deg,#121A2B,#0C111C)' }}
          >
            <div className="text-xs font-semibold uppercase tracking-[.35em] text-amber-200/80">
              {es ? h.tournament.nameEs : h.tournament.nameEn}
              {h.leagueName ? ` · ${h.leagueName}` : ''}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[.25em] text-muted-foreground">
              {es ? 'Campeón de la polla' : 'Pool champion'}
            </div>
            <div
              className="mt-2 font-bold leading-[.95] text-[clamp(34px,8vw,64px)]"
              style={{
                fontFamily: SERIF,
                background: 'linear-gradient(180deg,#FBE7B6 0%,#F2C452 46%,#A9863A 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                textWrap: 'balance',
              }}
            >
              {h.podium[0]?.displayName ?? '—'}
            </div>
            <div className="mt-2 text-sm font-semibold text-amber-100/90 tabular-nums">
              {h.podium[0] ? `${h.podium[0].points} pts` : ''}
              {h.championName && (
                <span className="text-muted-foreground font-medium">
                  {' '}· {es ? 'Campeón real' : 'Real champion'}:{' '}
                  {h.championCode && (
                    <Flag code={h.championCode} emoji={h.championFlagEmoji ?? ''} logoUrl={h.championLogoUrl} className="inline-block h-3.5 w-auto rounded-[2px] align-[-2px]" />
                  )}{' '}
                  {h.championName}
                </span>
              )}
            </div>
            {/* Podium */}
            <div className="mt-5 grid grid-cols-3 gap-2 max-w-md mx-auto">
              {[1, 0, 2].map((i) => {
                const p = h.podium[i];
                if (!p) return <div key={i} />;
                return (
                  <div
                    key={p.userId}
                    className={cn(
                      'rounded-xl border px-2 py-2.5 text-center',
                      i === 0 ? 'border-amber-400/50 bg-amber-400/10 -translate-y-1.5' : 'border-border/50 bg-card/40',
                      p.isMe && 'ring-1 ring-primary/60'
                    )}
                  >
                    <div className="text-lg leading-none">{MEDAL[i]}</div>
                    <div className="mt-1 truncate text-[13px] font-bold">{p.displayName}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{p.points} pts</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Final table */}
          <div className="border-t border-border/40">
            <div className="flex items-center justify-between gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>{es ? 'Tabla final' : 'Final table'}</span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{h.participants}</span>
                <ViewTournamentButton
                  slug={h.tournament.slug}
                  locale={locale as Locale}
                  label={es ? 'Explorar el torneo' : 'Explore the tournament'}
                />
              </span>
            </div>
            {(h.standings ?? []).map((r) => (
              <div
                key={r.userId}
                className={cn(
                  'flex items-center gap-3 border-t border-border/25 px-4 py-2 text-sm',
                  r.isMe && 'bg-primary/[0.07]'
                )}
              >
                <span className={cn('w-6 text-right tabular-nums font-bold', r.rank <= 3 ? 'text-amber-300' : 'text-muted-foreground')}>{r.rank}</span>
                <span className={cn('flex-1 truncate', r.isMe && 'font-bold text-primary')}>{r.displayName}{r.isMe ? (es ? ' (tú)' : ' (you)') : ''}</span>
                <span className="tabular-nums font-semibold">{r.points}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
