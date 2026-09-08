import * as React from 'react';
import Link from 'next/link';
import { Calendar, GitBranch, Lock, ChevronRight } from 'lucide-react';
import { TrophyMark } from '@/components/shared/brand';
import type { Locale } from '@/lib/types';

/**
 * The Bracket before it exists (Champions League, until the play-off draw):
 * what it is, when each round arrives, and what each correct call pays.
 * Replaces an empty tree with a screen worth opening.
 */
export function BracketPreview({ locale }: { locale: Locale }) {
  const es = locale === 'es';
  const rounds = [
    { es: 'Play-off', en: 'Play-off', when: es ? 'febrero' : 'February', pts: 4, note: es ? 'ida y vuelta' : 'two legs' },
    { es: 'Octavos', en: 'Round of 16', when: es ? 'marzo' : 'March', pts: 8, note: es ? 'ida y vuelta' : 'two legs' },
    { es: 'Cuartos', en: 'Quarterfinals', when: es ? 'abril' : 'April', pts: 16, note: es ? 'ida y vuelta' : 'two legs' },
    { es: 'Semifinales', en: 'Semifinals', when: es ? 'abril – mayo' : 'April – May', pts: 30, note: es ? 'ida y vuelta' : 'two legs' },
    { es: 'Final', en: 'Final', when: es ? 'mayo – junio' : 'May – June', pts: 55, note: es ? 'partido único' : 'single game' },
  ];

  return (
    <div className="pb-24 max-w-2xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrophyMark className="h-6 w-6" />
            {es ? 'La Llave' : 'The Bracket'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {es
              ? 'Se arma después del sorteo de los play-offs, a finales de enero. Aquí eliges quién avanza en cada eliminatoria; los puntos grandes de la temporada.'
              : 'It opens after the play-off draw in late January. This is where you pick who advances in every tie; the big points of the season.'}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300">
          <Lock className="h-3.5 w-3.5" />
          {es ? 'Abre en enero' : 'Opens in January'}
        </span>
      </div>

      {/* Road to the final: one row per round, points growing */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
          <GitBranch className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">{es ? 'El camino a la final' : 'The road to the final'}</h2>
          <span className="ml-auto text-xs text-muted-foreground">{es ? 'puntos por equipo acertado' : 'points per correct team'}</span>
        </header>
        <ol>
          {rounds.map((r, i) => (
            <li key={r.en} className="flex items-center gap-3 border-t border-border/40 px-4 py-3 first:border-t-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold whitespace-nowrap">{es ? r.es : r.en}</div>
                <div className="truncate text-xs text-muted-foreground">
                  <Calendar className="mr-1 inline h-3 w-3 -translate-y-px" aria-hidden />{r.when} · {r.note}
                </div>
              </div>
              <div className="w-14 shrink-0 sm:w-24">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--brand-2))]" style={{ width: `${(r.pts / 55) * 100}%` }} />
                </div>
              </div>
              <span className="w-10 shrink-0 text-right text-sm font-extrabold tabular-nums text-primary">+{r.pts}</span>
            </li>
          ))}
        </ol>
        <footer className="border-t border-border/50 px-4 py-3 text-xs text-muted-foreground">
          {es
            ? 'Se acumula: un equipo que pones campeón y gana vale 4+8+16+30+55 = 113 pts él solo. Cada eliminatoria se cierra 15 min antes de su partido de ida.'
            : 'It stacks: a team you call champion that wins is worth 4+8+16+30+55 = 113 pts on its own. Each tie locks 15 min before its first leg.'}
        </footer>
      </section>

      <Link
        href={`/${locale}/matches`}
        className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3.5 text-sm hover:border-primary/60"
      >
        <span>
          <span className="block font-bold">{es ? 'Mientras tanto: la fase de liga' : 'Meanwhile: the league phase'}</span>
          <span className="block text-xs text-muted-foreground">{es ? 'Ocho jornadas de marcadores, La Fija™️ y el Rey de la jornada.' : 'Eight matchdays of scorelines, La Fija™️ and the matchday king.'}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
      </Link>

      <p className="text-center text-xs text-muted-foreground">
        <Link href={`/${locale}/rules`} className="font-semibold text-primary">{es ? 'Cómo se puntúa' : 'How scoring works'}</Link>
      </p>
    </div>
  );
}
