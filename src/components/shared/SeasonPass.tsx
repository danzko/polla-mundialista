'use client';

import * as React from 'react';
import { Flag } from '@/components/shared/Flag';
import type { SeasonHub, Locale } from '@/lib/types';

const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",ui-serif,serif';

/**
 * The enrollment moment: the first time someone opens a new season, a
 * full-screen "season pass" reveal — their name on the gold plaque, their
 * club, their finish in the last tournament, and the date it all starts.
 * Shown once per tournament (localStorage), never for archived tournaments.
 */
export function SeasonPass({ hub, userName, locale }: { hub: SeasonHub; userName: string; locale: Locale }) {
  const es = locale === 'es';
  const key = `seasonpass:${hub.tournament.slug}`;
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (hub.tournament.status === 'archived') return;
    try {
      if (!localStorage.getItem(key)) setOpen(true);
    } catch { /* storage blocked: just skip the ceremony */ }
  }, [key, hub.tournament.status]);

  const dismiss = () => {
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
    setOpen(false);
  };

  if (!open) return null;

  const t = hub.tournament;
  const last = hub.honors[0] ?? null;
  const startsAt = t.startsAt
    ? new Date(t.startsAt).toLocaleDateString(es ? 'es-CO' : 'en-US', { timeZone: 'America/New_York', day: 'numeric', month: 'long' })
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(900px 520px at 50% -10%, rgba(242,196,82,.22), transparent 60%), rgba(5,7,13,.92)', backdropFilter: 'blur(8px)' }}
      onClick={dismiss}
    >
      <style>{`
        @keyframes sp-in { from { opacity: 0; transform: translateY(18px) scale(.97) } to { opacity: 1; transform: none } }
        @keyframes sp-sweep { 0%,70% { transform: translateX(-130%) } 100% { transform: translateX(130%) } }
        .sp-card { animation: sp-in .7s cubic-bezier(.2,.8,.2,1) both }
        .sp-shine { position:absolute; inset:0; background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,.75) 50%, transparent 60%);
          -webkit-background-clip:text; background-clip:text; color:transparent; animation: sp-sweep 2.6s ease-in-out 1s 1 both }
        @media (prefers-reduced-motion: reduce) { .sp-card { animation: none } .sp-shine { display:none } }
      `}</style>
      <div
        className="sp-card w-full max-w-md overflow-hidden rounded-3xl border border-amber-400/40 text-center shadow-2xl"
        style={{ background: 'linear-gradient(180deg,#141C2E,#0C111C)', boxShadow: '0 0 80px -20px rgba(242,196,82,.55)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-8 pb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[.4em] text-amber-200/80">
            {es ? 'Pase de temporada' : 'Season pass'}
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-[.3em] text-muted-foreground">
            {es ? t.nameEs : t.nameEn}
          </div>
          <div
            className="relative mt-2 font-bold leading-[.95] text-[clamp(34px,9vw,54px)]"
            style={{
              fontFamily: SERIF,
              background: 'linear-gradient(180deg,#FBE7B6 0%,#F2C452 46%,#A9863A 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', textWrap: 'balance',
            }}
          >
            {userName}
            <span className="sp-shine" aria-hidden="true">{userName}</span>
          </div>
          {last?.leagueName && (
            <div className="mt-2 text-sm font-semibold text-foreground/90">{last.leagueName}</div>
          )}

          {last && last.myRank != null && (
            <div className="mt-5 rounded-xl border border-border/50 bg-card/40 px-4 py-3 text-left">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {es ? 'Tu última temporada' : 'Your last season'}
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">{es ? last.tournament.nameEs : last.tournament.nameEn}</span>
                <span className="tabular-nums font-extrabold text-amber-300">
                  #{last.myRank} <span className="text-muted-foreground font-medium">· {last.myPoints} pts</span>
                </span>
              </div>
              {last.podium[0] && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  🏆 {last.podium[0].displayName}
                  {last.championCode && (
                    <span className="ml-2">
                      <Flag code={last.championCode} emoji={last.championFlagEmoji ?? ''} logoUrl={last.championLogoUrl} className="inline-block h-3 w-auto rounded-[2px] align-[-2px]" />{' '}
                      {last.championName}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            {es
              ? `Nueva temporada, misma polla, mismos amigos. ${startsAt ? `Arranca el ${startsAt}.` : ''} Ocho jornadas, la llave a ida y vuelta y una final en junio.`
              : `New season, same pool, same friends. ${startsAt ? `Kicks off ${startsAt}.` : ''} Eight matchdays, a two-legged bracket, and a final in June.`}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="w-full border-t border-amber-400/30 bg-amber-400/10 py-4 text-sm font-extrabold uppercase tracking-widest text-amber-200 hover:bg-amber-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
        >
          {es ? 'Entrar a la temporada' : 'Enter the season'} →
        </button>
      </div>
    </div>
  );
}
