import * as React from 'react';
import Link from 'next/link';
import { Trophy, GitBranch, Calendar, Medal, ArrowLeft } from 'lucide-react';

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
          ? 'En la fase eliminatoria hay dos formas de sumar, y se acumulan: la Llave (los puntos grandes) y los marcadores de cada partido (un bono pequeño).'
          : 'In the knockout stage there are two ways to score, and they stack: the Bracket (the big points) and each match scoreline (a small bonus).'}
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
        <ul className="mt-3 divide-y divide-border/40 rounded-xl border border-border/40 overflow-hidden">
          {advancement.map((r) => (
            <li key={r.en} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{es ? r.es : r.en}</span>
              <span className="font-extrabold text-primary">
                +{r.pts}{' '}
                <span className="text-[11px] font-medium text-muted-foreground">
                  {es ? 'por equipo' : 'per team'}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.08] p-3 text-[13px] leading-relaxed">
          {es ? (
            <>Un equipo que pones campeón y gana suma <strong>4+8+16+30+55 = 113 pts</strong> él solo. Solo importan los equipos, no el camino que dibujes.</>
          ) : (
            <>A team you call champion that wins is worth <strong>4+8+16+30+55 = 113 pts</strong> on its own. Only the teams matter, not the path you draw.</>
          )}
        </div>
        <p className="text-[12px] text-amber-500 font-semibold mt-2">
          ⏰ {es
            ? 'La Llave se cierra al primer partido de 32avos (3:00pm ET, 28 jun).'
            : 'The Bracket locks at the first Round-of-32 kickoff (3:00pm ET, Jun 28).'}
        </p>
      </section>

      {/* 2 — MATCH SCORES */}
      <section className="mt-4 rounded-2xl border border-border/50 bg-card/50 p-4">
        <h2 className="font-bold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          {es ? '2. Marcadores — bono pequeño' : '2. Match scores — small bonus'}
        </h2>
        <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
          {es
            ? 'En la pestaña Partidos predices el marcador de cada partido eliminatorio, ronda por ronda, a medida que se conocen los equipos. Cada partido se cierra 15 min antes del pitazo, igual que en la fase de grupos.'
            : 'In the Matches tab you predict each knockout game’s scoreline, round by round, as the teams become known. Each game locks 15 min before kickoff, just like the group stage.'}
        </p>
        <ul className="mt-3 space-y-2 text-[13px]">
          <li className="flex gap-2">
            <span className="font-bold text-emerald-400 shrink-0">+2 / +1</span>
            <span className="text-muted-foreground">
              {es
                ? 'Marcador exacto: +2 en 32avos, +1 en las rondas siguientes.'
                : 'Exact score: +2 in the Round of 32, +1 in every later round.'}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-emerald-400 shrink-0">+3</span>
            <span className="text-muted-foreground">
              {es
                ? 'Ganador correcto — excepto en 32avos (ahí acertar al ganador ya se paga con los 4 pts de avance). El ganador por penales cuenta.'
                : 'Correct winner — except in the Round of 32 (there, the winner is already paid by the 4-pt advancement). Penalty-shootout winners count.'}
            </span>
          </li>
          <li className="flex gap-2">
            <Medal className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <span className="text-muted-foreground">
              {es
                ? 'El partido por el 3er puesto puntúa como uno normal (ganador +3, exacto +1).'
                : 'The third-place game scores like a normal match (winner +3, exact +1).'}
            </span>
          </li>
        </ul>
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
