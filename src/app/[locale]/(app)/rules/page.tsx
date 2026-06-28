import * as React from 'react';
import Link from 'next/link';
import { Trophy, GitBranch, Calendar, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface RulesPageProps {
  params: Promise<{ locale: string }>;
}

// Bilingual, self-contained rules screen. Round names match the app's labels
// exactly (32avos / Octavos / Cuartos / Semifinal / Final / 3er Puesto).
export default async function RulesPage({ params }: RulesPageProps) {
  const { locale } = await params;
  const es = locale === 'es';
  const base = `/${locale}`;

  const advancement = [
    { en: 'Reaches Round of 16', es: 'Llega a Octavos', pts: 4 },
    { en: 'Quarterfinals', es: 'Cuartos', pts: 8 },
    { en: 'Semifinals', es: 'Semifinal', pts: 16 },
    { en: 'Final', es: 'Final', pts: 30 },
    { en: 'Champion', es: 'Campeón', pts: 55 },
  ];

  return (
    <div className="pb-24 max-w-2xl mx-auto">
      <Link
        href={`${base}/bracket`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {es ? 'Volver a la Llave' : 'Back to the Bracket'}
      </Link>

      <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
        <Trophy className="h-6 w-6 text-amber-500" />
        {es ? 'Cómo se puntúa' : 'How scoring works'}
      </h1>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
        {es
          ? 'En eliminatorias sumas de dos formas, y se acumulan: la Llave (los puntos grandes, por quién avanza) y el marcador de cada partido (6/2/0, igual que en grupos).'
          : 'In the knockouts you score two ways, and they stack: the Bracket (the big points, for who advances) and each match scoreline (6/2/0, same as the group stage).'}
      </p>

      {/* 1 — THE BRACKET */}
      <section className="mt-5 rounded-2xl border border-border/50 bg-card/50 p-4">
        <h2 className="font-bold flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          {es ? '1. La Llave — los puntos grandes' : '1. The Bracket — the big points'}
        </h2>
        <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
          {es
            ? 'Eliges quién avanza: qué equipos llegan a cada ronda. Ganas los puntos de la ronda por cada equipo que aciertes, y se acumula ronda a ronda.'
            : 'You pick who advances: which teams reach each round. You earn that round’s points for every team you get right, and it stacks round by round.'}
        </p>
        {/* Bar graph: points escalate sharply by round (per correct team). */}
        <div className="mt-3 space-y-1.5">
          {advancement.map((r) => (
            <div key={r.en} className="flex items-center gap-2 text-[12px]">
              <span className="w-24 shrink-0 text-muted-foreground">{es ? r.es : r.en}</span>
              <div className="flex-1 h-5 rounded bg-secondary/40 overflow-hidden">
                <div
                  className="h-full rounded bg-gradient-to-r from-primary to-emerald-400"
                  style={{ width: `${(r.pts / 55) * 100}%` }}
                />
              </div>
              <span className="w-16 text-right font-extrabold text-primary">
                +{r.pts}{' '}
                <span className="text-[10px] font-medium text-muted-foreground">
                  {es ? '/equipo' : '/team'}
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.08] p-3 text-[13px] leading-relaxed">
          {es ? (
            <>Un equipo que pones campeón y gana suma <strong>4+8+16+30+55 = 113 pts</strong> él solo. Solo importan los equipos, no el camino que dibujes.</>
          ) : (
            <>A team you call champion that wins is worth <strong>4+8+16+30+55 = 113 pts</strong> on its own. Only the teams matter, not the path you draw.</>
          )}
        </div>
        <p className="text-[12px] text-amber-500 font-semibold mt-2">
          ⏰ {es
            ? 'Tienes hasta el cierre de hoy (11:59pm ET) para toda la Llave; un partido que empiece antes se cierra a su hora de inicio (el primero, Sudáfrica–Canadá, a las 2:45pm ET).'
            : 'You have until tonight (11:59pm ET) for the whole Bracket; a game that kicks off sooner closes at its start (the first, South Africa–Canada, at 2:45pm ET).'}
        </p>
      </section>

      {/* 2 — MATCH SCORES */}
      <section className="mt-4 rounded-2xl border border-border/50 bg-card/50 p-4">
        <h2 className="font-bold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          {es ? '2. Marcadores — igual que en grupos' : '2. Match scores — same as the group stage'}
        </h2>
        <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
          {es
            ? 'En la pestaña Partidos predices el marcador de cada partido eliminatorio, ronda por ronda, a medida que se conocen los equipos. Cada partido se cierra 15 min antes del pitazo. Puntúa exactamente igual que la fase de grupos:'
            : 'In the Matches tab you predict each knockout game’s scoreline, round by round, as the teams become known. Each game locks 15 min before kickoff. It scores exactly like the group stage:'}
        </p>
        <ul className="mt-3 space-y-2 text-[13px]">
          <li className="flex gap-2">
            <span className="font-bold text-emerald-400 shrink-0">+6</span>
            <span className="text-muted-foreground">
              {es ? 'Marcador exacto.' : 'Exact score.'}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-emerald-400 shrink-0">+2</span>
            <span className="text-muted-foreground">
              {es ? 'Resultado correcto (ganador/empate, marcador equivocado).' : 'Correct result (right winner/draw, wrong score).'}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-muted-foreground shrink-0">0</span>
            <span className="text-muted-foreground">
              {es ? 'Resultado equivocado.' : 'Wrong result.'}
            </span>
          </li>
        </ul>
        <p className="text-[12px] text-muted-foreground/70 mt-2">
          {es
            ? 'Quién avanza por penales no afecta este marcador — eso se premia en la Llave.'
            : 'Who advances on penalties doesn’t affect this scoreline — that’s rewarded in the Bracket.'}
        </p>
        {/* Worked example: you predicted Brazil 2–1. */}
        <div className="mt-3 rounded-xl border border-border/40 overflow-hidden text-[12px]">
          <div className="bg-secondary/40 px-3 py-1.5 font-semibold">
            {es ? 'Ejemplo: predijiste 🇧🇷 Brasil 2–1' : 'Example: you predicted 🇧🇷 Brazil 2–1'}
          </div>
          {[
            { r: es ? 'Termina 2–1' : 'Ends 2–1', n: '+6', c: 'text-emerald-400', why: es ? 'marcador exacto' : 'exact score' },
            { r: es ? 'Termina 3–1' : 'Ends 3–1', n: '+2', c: 'text-emerald-400', why: es ? 'ganó Brasil, marcador distinto' : 'Brazil still won, wrong score' },
            { r: es ? 'Termina 1–2' : 'Ends 1–2', n: '0', c: 'text-muted-foreground', why: es ? 'Brasil perdió' : 'Brazil lost' },
          ].map((row) => (
            <div key={row.r} className="flex items-center justify-between gap-2 border-t border-border/30 px-3 py-1.5">
              <span className="w-24 shrink-0">{row.r}</span>
              <span className="flex-1 text-muted-foreground">{row.why}</span>
              <span className={`font-extrabold ${row.c}`}>{row.n}</span>
            </div>
          ))}
        </div>
      </section>

      {/* BONUS PICKS (pre-tournament) */}
      <section className="mt-4 rounded-2xl border border-border/50 bg-card/50 p-4">
        <h2 className="font-bold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          {es ? 'Picks de bonos (pre-torneo)' : 'Bonus picks (pre-tournament)'}
        </h2>
        <ul className="mt-3 space-y-2 text-[13px]">
          <li className="flex gap-2">
            <span className="font-bold text-amber-400 shrink-0">+50</span>
            <span className="text-muted-foreground">
              {es
                ? 'Campeón: tu pick de campeón pre-torneo paga 50. El campeón también paga 55 en la Llave — así que acertarlo suma en los dos lados.'
                : 'Champion: your pre-tournament champion pick pays 50. The champion also pays 55 in the Bracket — so nailing it scores on both sides.'}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-amber-400 shrink-0">+25</span>
            <span className="text-muted-foreground">
              {es ? 'Bota de Oro (goleador del torneo).' : 'Golden Boot (tournament top scorer).'}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-amber-400 shrink-0">+25</span>
            <span className="text-muted-foreground">
              {es ? 'Balón de Oro (mejor jugador).' : 'Golden Ball (best player).'}
            </span>
          </li>
        </ul>
      </section>

      {/* WORKED EXAMPLE */}
      <section className="mt-4 rounded-2xl border border-primary/30 bg-primary/[0.05] p-4">
        <h2 className="font-bold flex items-center gap-2">
          🧮 {es ? 'Ejemplo completo: cómo suma Carlos' : 'Full example: how Carlos adds up'}
        </h2>
        <div className="mt-3 rounded-xl border border-border/40 overflow-hidden text-[12px]">
          {[
            { what: es ? '🇫🇷 Francia → Campeón (y gana)' : '🇫🇷 France → Champion (and wins)', detail: '4+8+16+30+55', pts: 113 },
            { what: es ? '🇫🇷 Francia, su pick de Campeón pre-torneo' : '🇫🇷 France, his pre-tournament Champion pick', detail: '', pts: 50 },
            { what: es ? '🇧🇷 Brasil → Final (pierde la final)' : '🇧🇷 Brazil → Final (loses the final)', detail: '4+8+16+30', pts: 58 },
            { what: es ? '3 marcadores exactos en eliminatorias' : '3 knockout scorelines exact', detail: '3 × 6', pts: 18 },
            { what: es ? 'Bota de Oro acertada' : 'Golden Boot correct', detail: '', pts: 25 },
          ].map((row) => (
            <div key={row.what} className="flex items-center justify-between gap-2 border-b border-border/30 px-3 py-1.5">
              <span className="flex-1">{row.what}</span>
              {row.detail && <span className="text-muted-foreground/70 hidden sm:inline">{row.detail}</span>}
              <span className="w-12 text-right font-extrabold text-primary">+{row.pts}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-secondary/40 font-extrabold">
            <span>{es ? 'Total' : 'Total'}</span>
            <span className="text-emerald-400">264</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-2 leading-relaxed">
          {es
            ? 'Fíjate: Francia le pagó en cada ronda (se acumula) y otra vez por su pick de campeón. Una buena lectura del torneo vale mucho más que un marcador suelto.'
            : 'Notice: France paid him in every round (it stacks) and again via his champion pick. Reading the tournament right is worth far more than a lucky scoreline.'}
        </p>
      </section>

      {/* TIEBREAKER */}
      <section className="mt-4 rounded-2xl border border-border/50 bg-card/50 p-4">
        <h2 className="font-bold">{es ? 'Desempate' : 'Tiebreaker'}</h2>
        <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
          {es
            ? 'Puntos totales y, si hay empate, quien más puntos haya sumado en la fase eliminatoria.'
            : 'Total points, and if tied, whoever earned the most points in the knockout stage.'}
        </p>
      </section>

      <p className="text-[11px] text-muted-foreground/70 mt-4 text-center">
        {es
          ? 'La fase de grupos puntúa 6 (exacto) / 2 (resultado) / 0 (fallo), sin multiplicador.'
          : 'The group stage scores 6 (exact) / 2 (result) / 0 (wrong), no multiplier.'}
      </p>
    </div>
  );
}
