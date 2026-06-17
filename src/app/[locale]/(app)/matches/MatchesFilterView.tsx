'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { FeedMatchCard } from '@/components/predictions/FeedMatchCard';
import { Button } from '@/components/ui/button';
import { submitPredictions, getLiveScores } from '@/lib/api';
import { LOCK_BEFORE_KICKOFF_MS } from '@/lib/tournament';
import type { MatchView, Locale, MatchPickRow, LiveScoresPayload } from '@/lib/types';
import { cn } from '@/lib/utils';
import { HelpCircle, CheckCircle2, AlertTriangle, X, ArrowDownToLine, Trophy, ChevronDown } from 'lucide-react';

// Local-timezone day key (YYYY-MM-DD). Grouping by UTC day put every
// Colombian evening match under the next day's header.
const localDayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

interface MatchesFilterViewProps {
  initialMatches: MatchView[];
  locale: Locale;
  picksByMatch?: Record<string, MatchPickRow[]>;
  myUserId?: string;
  initialLive?: LiveScoresPayload;
}

export function MatchesFilterView({
  initialMatches, locale, picksByMatch = {}, myUserId,
  initialLive = { scores: {}, lastRunAt: null },
}: MatchesFilterViewProps) {
  const t = useTranslations();
  const es = locale === 'es';

  const [matches, setMatches] = React.useState<MatchView[]>(initialMatches);
  const [live, setLive] = React.useState<LiveScoresPayload>(initialLive);
  const [now, setNow] = React.useState(() => Date.now());
  const [mounted, setMounted] = React.useState(false);
  const [activeDay, setActiveDay] = React.useState<string | null>(null);
  const [showKnockouts, setShowKnockouts] = React.useState(false);

  const [edits, setEdits] = React.useState<Record<string, { homeScore: number; awayScore: number }>>(() => {
    const init: Record<string, { homeScore: number; awayScore: number }> = {};
    initialMatches.forEach(m => {
      if (m.stage === 'group' && !m.locked) {
        init[m.id] = { homeScore: m.myPrediction?.homeScore ?? 0, awayScore: m.myPrediction?.awayScore ?? 0 };
      }
    });
    return init;
  });

  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [toast, setToast] = React.useState<{ show: boolean; message: string; type: 'success' | 'warning' | 'error'; skippedCount: number; skippedNames?: string[] } | null>(null);

  const cardRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const dayRefs = React.useRef<Map<string, HTMLElement>>(new Map());
  const chipRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const chipScrollRef = React.useRef<HTMLDivElement | null>(null);
  const didAutoScroll = React.useRef(false);
  const didCenterChips = React.useRef(false);

  React.useEffect(() => { setMounted(true); }, []);

  // Tick the clock so lock windows / relative times stay fresh.
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  // Poll live scores every 30s while the tab is visible.
  React.useEffect(() => {
    let alive = true;
    const poll = async () => {
      const p = await getLiveScores();
      if (alive) setLive(p);
    };
    const id = setInterval(() => { if (document.visibilityState === 'visible') poll(); }, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const isEditable = React.useCallback(
    (m: MatchView) => m.stage === 'group' && !m.isVoided && now < new Date(m.kickoffAt).getTime() - LOCK_BEFORE_KICKOFF_MS,
    [now]
  );

  // Chronological group feed grouped by local day.
  const { dayKeys, matchesByDay, groupMatches } = React.useMemo(() => {
    const group = matches
      .filter(m => m.stage === 'group')
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
    const byDay: Record<string, MatchView[]> = {};
    for (const m of group) {
      const k = localDayKey(m.kickoffAt);
      (byDay[k] ??= []).push(m);
    }
    return { dayKeys: Object.keys(byDay).sort(), matchesByDay: byDay, groupMatches: group };
  }, [matches]);

  const knockoutMatches = React.useMemo(
    () => matches.filter(m => m.stage !== 'group').sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()),
    [matches]
  );

  const todayKey = mounted ? localDayKey(new Date().toISOString()) : null;

  // The "now" anchor: first live match, else first upcoming, else last.
  const nowMatchId = React.useMemo(() => {
    const liveOne = groupMatches.find(m => live.scores[m.id]?.status === 'in');
    if (liveOne) return liveOne.id;
    const next = groupMatches.find(m => new Date(m.kickoffAt).getTime() > now);
    return next?.id ?? groupMatches[groupMatches.length - 1]?.id ?? null;
  }, [groupMatches, live, now]);

  // The day the chip row should center on: today if it has games, else
  // the day of the live/next match.
  const focusDayKey = React.useMemo(() => {
    if (todayKey && dayKeys.includes(todayKey)) return todayKey;
    const m = groupMatches.find(x => x.id === nowMatchId);
    return m ? localDayKey(m.kickoffAt) : dayKeys[0] ?? null;
  }, [todayKey, dayKeys, groupMatches, nowMatchId]);

  const centerChips = React.useCallback((smooth = false) => {
    const key = focusDayKey;
    if (!key) return;
    const chip = chipRefs.current.get(key);
    chip?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
  }, [focusDayKey]);

  const scrollToNow = React.useCallback(() => {
    if (nowMatchId) cardRefs.current.get(nowMatchId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    centerChips(true);
  }, [nowMatchId, centerChips]);

  // Auto-scroll to "now" once after first mount.
  React.useEffect(() => {
    if (mounted && !didAutoScroll.current && nowMatchId) {
      didAutoScroll.current = true;
      requestAnimationFrame(() => {
        cardRefs.current.get(nowMatchId)?.scrollIntoView({ block: 'center' });
      });
    }
  }, [mounted, nowMatchId]);

  // Center the date-chip row on today (separate from the vertical scroll).
  React.useEffect(() => {
    if (mounted && !didCenterChips.current && focusDayKey) {
      didCenterChips.current = true;
      requestAnimationFrame(() => centerChips(false));
    }
  }, [mounted, focusDayKey, centerChips]);

  // Scroll-spy: the active day is the last day header that has scrolled
  // above a line just under the sticky bars — i.e. the day you're in.
  React.useEffect(() => {
    if (!mounted) return;
    let raf = 0;
    const compute = () => {
      const line = 150; // below the app bar (64) + chip bar (~76)
      let current: string | null = null;
      let bestTop = -Infinity;
      dayRefs.current.forEach((el, key) => {
        const top = el.getBoundingClientRect().top;
        if (top <= line && top > bestTop) { bestTop = top; current = key; }
      });
      setActiveDay(current ?? dayKeys[0] ?? null);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(compute); };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [mounted, dayKeys]);

  // Spanish locale renders "mié, 17 de jun" — drop the "de" and commas.
  const cleanDate = (s: string) => s.replace(/\bde\b/gi, '').replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  const chipLabel = (key: string) => {
    const d = new Date(key + 'T12:00:00');
    return cleanDate(d.toLocaleDateString(es ? 'es-CO' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
  };
  const dayHeader = (key: string) => {
    const d = new Date(key + 'T12:00:00');
    const s = cleanDate(d.toLocaleDateString(es ? 'es-CO' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' }));
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const jumpToDay = (key: string) => {
    dayRefs.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleScoreChange = (matchId: string, homeScore: number, awayScore: number) => {
    setEdits(prev => ({ ...prev, [matchId]: { homeScore, awayScore } }));
  };

  const unsavedMatches = React.useMemo(() => {
    return matches.filter(m => {
      if (!isEditable(m)) return false;
      const edit = edits[m.id];
      if (!edit) return false;
      if (m.myPrediction === null) return true;
      return m.myPrediction.homeScore !== edit.homeScore || m.myPrediction.awayScore !== edit.awayScore;
    });
  }, [matches, edits, isEditable]);
  const unsavedCount = unsavedMatches.length;

  const savedGroupCount = React.useMemo(
    () => matches.filter(m => m.stage === 'group' && m.myPrediction !== null).length,
    [matches]
  );

  const getMatchDisplayName = (match: MatchView) => {
    const h = match.homeTeam ? (es ? match.homeTeam.nameEs : match.homeTeam.nameEn) : 'TBD';
    const a = match.awayTeam ? (es ? match.awayTeam.nameEs : match.awayTeam.nameEn) : 'TBD';
    return `${h} vs ${a}`;
  };

  const agoLabel = (iso: string | null) => {
    if (!iso) return '';
    const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
    return s < 90 ? (es ? `hace ${s} s` : `${s}s ago`) : (es ? `hace ${Math.round(s / 60)} min` : `${Math.round(s / 60)}m ago`);
  };

  const liveCount = groupMatches.filter(m => live.scores[m.id]?.status === 'in').length;
  const syncStale = mounted && live.lastRunAt ? now - new Date(live.lastRunAt).getTime() > 6 * 60000 : false;

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const payload = unsavedMatches.map(m => ({ matchId: m.id, homeScore: edits[m.id].homeScore, awayScore: edits[m.id].awayScore }));
      const res = await submitPredictions({ predictions: payload });
      if (!res.ok) {
        setToast({ show: true, message: res.error || (es ? 'Error al guardar los pronósticos' : 'Error saving predictions'), type: 'error', skippedCount: 0 });
        setIsSubmitting(false);
        return;
      }
      const { saved, skipped } = res.data;
      setMatches(prev => prev.map(m => {
        const sp = payload.find(p => p.matchId === m.id && !skipped.includes(m.id));
        if (sp) return { ...m, myPrediction: { homeScore: sp.homeScore, awayScore: sp.awayScore } };
        if (skipped.includes(m.id)) return { ...m, locked: true };
        return m;
      }));
      if (skipped.length > 0) {
        const skippedNames = skipped.map(sId => { const m = matches.find(x => x.id === sId); return m ? getMatchDisplayName(m) : ''; }).filter(Boolean);
        setToast({ show: true, message: es ? `Se guardaron ${saved} pronósticos.` : `Saved ${saved} predictions.`, type: 'warning', skippedCount: skipped.length, skippedNames });
      } else {
        setToast({ show: true, message: t('matches.toastSuccess'), type: 'success', skippedCount: 0 });
      }
      setShowConfirmModal(false);
    } catch (err: any) {
      setToast({ show: true, message: err.message || (es ? 'Ocurrió un error inesperado' : 'An unexpected error occurred'), type: 'error', skippedCount: 0 });
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (toast?.show) {
      const timer = setTimeout(() => setToast(prev => prev ? { ...prev, show: false } : null), 6500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <div className="pb-24">
      {/* STICKY HEADER: status + date chips (sits below the app's top bar) */}
      <div className="sticky top-16 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-2 pb-2 bg-background/90 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-muted-foreground">
            {savedGroupCount === 72 ? t('matches.completed') : t('matches.savedCount', { count: savedGroupCount })}
          </span>
          <span className="flex items-center gap-1.5 text-[11px]">
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1 font-bold text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                {liveCount} {es ? 'en vivo' : 'live'}
              </span>
            )}
            {mounted && live.lastRunAt && (
              <span className={cn('text-muted-foreground', syncStale && 'text-amber-500')}>
                {liveCount > 0 ? '· ' : ''}{es ? 'act.' : 'upd.'} {agoLabel(live.lastRunAt)}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Pinned, always-visible Today button */}
          <button
            type="button"
            onClick={scrollToNow}
            className="flex-shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold bg-primary text-primary-foreground active:scale-95 transition-transform shadow-sm"
          >
            <ArrowDownToLine className="h-3 w-3" />
            {es ? 'Hoy' : 'Today'}
          </button>
          {/* Independently scrollable date chips */}
          <div ref={chipScrollRef} className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1">
            {dayKeys.map(key => {
              const isActive = activeDay === key;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  type="button"
                  ref={(el) => { if (el) chipRefs.current.set(key, el); else chipRefs.current.delete(key); }}
                  onClick={() => jumpToDay(key)}
                  className={cn(
                    'flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors border',
                    isActive
                      ? 'bg-foreground text-background border-foreground'
                      : isToday
                        ? 'bg-primary/10 text-primary border-primary/40'
                        : 'bg-card/50 text-muted-foreground border-border/40 hover:text-foreground'
                  )}
                >
                  {chipLabel(key)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* FEED */}
      {!mounted ? (
        <div className="p-12 text-center text-muted-foreground font-light animate-pulse">{t('common.loading')}</div>
      ) : (
        <div className="space-y-5 pt-4">
          {dayKeys.map(key => (
            <section
              key={key}
              data-day={key}
              ref={(el) => { if (el) dayRefs.current.set(key, el); else dayRefs.current.delete(key); }}
              className="scroll-mt-[150px] space-y-2"
            >
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90 py-1 flex items-center gap-2">
                {dayHeader(key)}
                {key === todayKey && (
                  <span className="rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal">
                    {es ? 'hoy' : 'today'}
                  </span>
                )}
              </h3>
              {matchesByDay[key].map(m => (
                <div key={m.id} ref={(el) => { if (el) cardRefs.current.set(m.id, el); else cardRefs.current.delete(m.id); }}>
                  <FeedMatchCard
                    match={m}
                    locale={locale}
                    live={live.scores[m.id] ?? null}
                    editable={isEditable(m)}
                    homeScore={edits[m.id]?.homeScore ?? m.myPrediction?.homeScore ?? 0}
                    awayScore={edits[m.id]?.awayScore ?? m.myPrediction?.awayScore ?? 0}
                    onChange={handleScoreChange}
                    picks={picksByMatch[m.id]}
                    myUserId={myUserId}
                  />
                </div>
              ))}
            </section>
          ))}

          {/* KNOCKOUTS — collapsed block at the bottom */}
          {knockoutMatches.length > 0 && (
            <div className="pt-3 border-t border-border/30">
              <button
                type="button"
                onClick={() => setShowKnockouts(v => !v)}
                className="w-full flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5"
              >
                <span className="flex items-center gap-2 text-xs font-bold text-amber-500">
                  <Trophy className="h-3.5 w-3.5" />
                  {t('matches.knockoutSection')}
                  <span className="font-medium text-muted-foreground normal-case">· {t('matches.knockoutSectionNote')}</span>
                </span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showKnockouts && 'rotate-180')} />
              </button>
              {showKnockouts && (
                <div className="mt-2 space-y-2">
                  {knockoutMatches.map(m => (
                    <FeedMatchCard
                      key={m.id}
                      match={m}
                      locale={locale}
                      live={live.scores[m.id] ?? null}
                      editable={false}
                      homeScore={0}
                      awayScore={0}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {groupMatches.length === 0 && knockoutMatches.length === 0 && (
            <div className="p-12 text-center text-muted-foreground font-light">{t('matches.noMatches')}</div>
          )}
        </div>
      )}

      {/* SAVE BAR */}
      <div className="fixed bottom-[57px] md:bottom-0 left-0 w-full z-30 border-t border-border bg-card/90 backdrop-blur-md shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', unsavedCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500')} />
            <span className="text-[11px] sm:text-xs font-bold text-foreground">
              {unsavedCount > 0
                ? t('matches.unsavedChanges', { count: unsavedCount })
                : (es ? 'Todo guardado' : 'All saved')}
            </span>
          </div>
          <Button
            onClick={() => setShowConfirmModal(true)}
            disabled={unsavedCount === 0 || isSubmitting}
            className={cn(
              'rounded-xl px-4 py-2 font-extrabold text-xs sm:text-sm active:scale-95 transition-transform flex items-center gap-1.5',
              unsavedCount > 0 ? 'bg-gradient-to-r from-primary to-emerald-500 text-primary-foreground' : 'bg-secondary text-muted-foreground cursor-not-allowed'
            )}
          >
            {t('matches.saveBtnCount', { count: unsavedCount })}
          </Button>
        </div>
      </div>

      {/* CONFIRM MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card border border-border/80 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <div className="flex items-center gap-2 text-primary">
                <HelpCircle className="h-5 w-5" />
                <h3 className="text-base font-extrabold">{t('matches.saveConfirmTitle')}</h3>
              </div>
              <button type="button" onClick={() => setShowConfirmModal(false)} className="text-muted-foreground hover:text-foreground rounded-lg p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground font-medium leading-relaxed">{t('matches.saveConfirmDesc', { count: unsavedCount })}</p>
            <div className="bg-slate-950/50 rounded-xl border border-border/50 max-h-36 overflow-y-auto p-3 space-y-2 text-[11px]">
              {unsavedMatches.map(m => (
                <div key={m.id} className="flex justify-between items-center text-muted-foreground border-b border-border/10 pb-1.5 last:border-0 last:pb-0">
                  <span className="font-semibold text-foreground text-left line-clamp-1 max-w-[260px]">{getMatchDisplayName(m)}</span>
                  <span className="font-extrabold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/25 whitespace-nowrap">{edits[m.id].homeScore} - {edits[m.id].awayScore}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowConfirmModal(false)} disabled={isSubmitting} className="rounded-xl text-xs font-bold text-muted-foreground border border-border/40">{t('common.cancel')}</Button>
              <Button onClick={handleSave} disabled={isSubmitting} className="rounded-xl text-xs font-extrabold bg-gradient-to-r from-primary to-emerald-500 text-primary-foreground">{isSubmitting ? t('common.saving') : t('matches.saveConfirmBtn')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast?.show && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-card/95 border border-border/80 rounded-2xl shadow-2xl p-4 backdrop-blur-md">
          <div className="flex items-start gap-3">
            {toast.type === 'success' ? (
              <div className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="h-5 w-5" /></div>
            ) : (
              <div className={cn('rounded-full p-1.5 border', toast.type === 'error' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20')}><AlertTriangle className="h-5 w-5" /></div>
            )}
            <div className="flex-1 space-y-1.5">
              <h4 className="text-xs font-bold text-foreground">
                {toast.type === 'success' ? (es ? '¡Guardado!' : 'Saved!') : toast.type === 'error' ? (es ? 'Error al guardar' : 'Error saving') : (es ? 'Advertencia' : 'Warning')}
              </h4>
              <p className="text-[11px] text-muted-foreground font-medium leading-normal">{toast.message}</p>
              {toast.skippedCount > 0 && toast.skippedNames && (
                <div className="pt-1 space-y-1">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">{es ? 'Partidos cerrados omitidos:' : 'Skipped closed matches:'}</span>
                  <ul className="text-[9px] text-muted-foreground list-disc pl-3 space-y-0.5 font-semibold">
                    {toast.skippedNames.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <button type="button" onClick={() => setToast(prev => prev ? { ...prev, show: false } : null)} className="text-muted-foreground hover:text-foreground rounded-lg p-0.5 self-start"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
