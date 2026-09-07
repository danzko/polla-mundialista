'use client';

import * as React from 'react';
import { Goal, Star } from 'lucide-react';
import { TrophyMark } from '@/components/shared/brand';
import { Flag } from '@/components/shared/Flag';
import { cn } from '@/lib/utils';
import type { StatsData, Locale } from '@/lib/types';

function Pills({ names, es }: { names: string[]; es: boolean }) {
  if (!names.length) return <span className="text-[11px] italic text-muted-foreground/70">{es ? 'nadie todavía' : 'nobody yet'}</span>;
  const shown = names.slice(0, 10);
  const extra = names.length - shown.length;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {shown.map((n, i) => (
        <span key={i} className="rounded-full bg-secondary/70 px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">{n}</span>
      ))}
      {extra > 0 && <span className="px-1 py-0.5 text-[11px] text-muted-foreground">+{extra}</span>}
    </div>
  );
}

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
      <span className={cn('block h-full rounded-full', className)} style={{ width: `${Math.min(100, pct)}%` }} />
    </span>
  );
}

function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="mb-2 mt-5 flex items-baseline gap-2 first:mt-0">
      <span className="flex items-center gap-1.5 text-sm font-extrabold">{icon}{title}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function StatsSections({ data, locale, kind = 'world_cup' }: { data: StatsData; locale: Locale; kind?: 'world_cup' | 'ucl' }) {
  const es = locale === 'es';
  const ucl = kind === 'ucl';
  const bootTitle = ucl ? (es ? 'Máximo goleador' : 'Top scorer') : (es ? 'Bota de Oro' : 'Golden Boot');
  const ballTitle = ucl ? (es ? 'Jugador de la temporada' : 'Player of the Season') : (es ? 'Balón de Oro' : 'Golden Ball');

  if (data.memberCount === 0) {
    return <div className="rounded-xl border border-border/40 bg-card/50 p-6 text-center text-sm text-muted-foreground">{es ? 'Sin datos todavía' : 'No data yet'}</div>;
  }

  return (
    <div className="pb-24">
      {/* ① TITLE RACE — Vegas vs the league */}
      <SectionTitle icon={<TrophyMark className="h-4 w-4" />} title={es ? 'Carrera al título' : 'Title race'}
        sub={data.snapshotLoaded ? (es ? 'Vegas vs tu liga' : 'Vegas vs your league') : (es ? 'elección de tu liga' : "your league's picks")} />
      <div className="space-y-1.5">
        {data.titleRace.length === 0 && <Empty es={es} />}
        {data.titleRace.map((r) => (
          <div key={r.teamCode} className="rounded-xl border border-border/45 bg-card/50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              {(r.flagEmoji || r.logoUrl) && <span className={cn(r.eliminated && 'opacity-40 grayscale')}><Flag code={r.teamCode} emoji={r.flagEmoji ?? ''} logoUrl={r.logoUrl} className="inline-block h-4 w-auto rounded-[2px] shadow-sm" /></span>}
              <span className={cn('flex-1 truncate text-sm font-bold', r.eliminated && 'line-through text-muted-foreground')}>{r.teamName}</span>
              {r.vegasOdds && (
                <span className="shrink-0 rounded-md bg-secondary/70 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                  {r.vegasOdds}{r.vegasImpliedPct != null && <span className="ml-1 text-muted-foreground">{r.vegasImpliedPct}%</span>}
                </span>
              )}
              <span className="shrink-0 w-14 text-right text-xs font-extrabold tabular-nums text-primary">{r.leaguePct}%</span>
            </div>
            <div className="mt-1.5"><Bar pct={r.leaguePct} className="bg-gradient-to-r from-primary to-[hsl(var(--brand-2))]" /></div>
            <Pills names={r.pickedBy} es={es} />
          </div>
        ))}
      </div>

      {/* ② GOLDEN BOOT */}
      <SectionTitle icon={<Goal className="h-4 w-4 text-emerald-400" />} title={bootTitle}
        sub={data.snapshotLoaded ? (es ? 'goleadores + quién los eligió' : 'scorers + who picked them') : (es ? 'elección de tu liga' : "your league's picks")} />
      <div className="space-y-1.5">
        {data.goldenBoot.length === 0 && <Empty es={es} />}
        {data.goldenBoot.map((b, i) => (
          <div key={`${b.playerName}-${i}`} className="rounded-xl border border-border/45 bg-card/50 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              {b.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full bg-secondary object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
                  {b.flagEmoji && b.teamCode ? <Flag code={b.teamCode} emoji={b.flagEmoji} className="h-4 w-auto rounded-[2px]" /> : b.playerName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {b.rank != null && <span className="text-[11px] font-bold text-muted-foreground">#{b.rank}</span>}
                  <span className="truncate text-sm font-bold">{b.playerName}</span>
                  {b.flagEmoji && b.teamCode && b.photoUrl && <Flag code={b.teamCode} emoji={b.flagEmoji} className="inline-block h-3 w-auto rounded-[1px]" />}
                  {b.goals != null && <span className="ml-auto shrink-0 text-xs font-extrabold tabular-nums text-emerald-400">{b.goals} {es ? 'goles' : 'goals'}</span>}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Bar pct={b.leaguePct} className="bg-gradient-to-r from-emerald-500 to-emerald-300" />
                  <span className="shrink-0 text-xs font-bold tabular-nums text-primary">{b.leaguePct}%</span>
                </div>
              </div>
            </div>
            <Pills names={b.pickedBy} es={es} />
          </div>
        ))}
      </div>

      {/* ③ GOLDEN BALL */}
      <SectionTitle icon={<Star className="h-4 w-4 text-amber-400" />} title={ballTitle}
        sub={es ? 'elección de tu liga' : "your league's picks"} />
      <div className="space-y-1.5">
        {data.goldenBall.length === 0 && <Empty es={es} />}
        {data.goldenBall.map((p, i) => (
          <div key={`${p.label}-${i}`} className="rounded-xl border border-border/45 bg-card/50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm font-bold">{p.label}</span>
              <span className="shrink-0 text-xs font-extrabold tabular-nums text-primary">{p.pct}%</span>
            </div>
            <div className="mt-1.5"><Bar pct={p.pct} className="bg-gradient-to-r from-amber-500 to-amber-300" /></div>
            <Pills names={p.pickedBy} es={es} />
          </div>
        ))}
      </div>

      {!data.snapshotLoaded && (
        <p className="mt-5 text-center text-[11.5px] text-muted-foreground">
          {es ? 'Goleadores y cuotas en vivo aún no cargados.' : 'Live scorers & odds not loaded yet.'}
        </p>
      )}
    </div>
  );
}

function Empty({ es }: { es: boolean }) {
  return <div className="rounded-xl border border-border/30 bg-card/40 px-3 py-4 text-center text-xs text-muted-foreground">{es ? 'Nadie ha elegido todavía' : 'No picks yet'}</div>;
}
