'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MatchCard } from '@/components/predictions/MatchCard';
import { Button } from '@/components/ui/button';
import { submitPredictions } from '@/lib/api';
import type { MatchView, MatchStage, Locale } from '@/lib/types';
import { cn } from '@/lib/utils';

// Local-timezone day key (YYYY-MM-DD). Grouping by UTC day put every
// Colombian evening match under the next day's header.
const localDayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
import { Calendar as CalendarIcon, Filter, HelpCircle, CheckCircle2, AlertTriangle, X, Trophy } from 'lucide-react';

interface MatchesFilterViewProps {
  initialMatches: MatchView[];
  locale: Locale;
}

export function MatchesFilterView({ initialMatches, locale }: MatchesFilterViewProps) {
  const t = useTranslations();
  const basePath = `/${locale}`;

  // Local state for matches
  const [matches, setMatches] = React.useState<MatchView[]>(initialMatches);
  const [selectedStage, setSelectedStage] = React.useState<MatchStage | 'all'>('all');
  const [selectedDate, setSelectedDate] = React.useState<string | 'all'>('all');

  // Form edits state
  const [edits, setEdits] = React.useState<Record<string, { homeScore: number; awayScore: number }>>(() => {
    const initialEdits: Record<string, { homeScore: number; awayScore: number }> = {};
    initialMatches.forEach(m => {
      if (m.stage === 'group' && !m.locked) {
        initialEdits[m.id] = {
          homeScore: m.myPrediction?.homeScore ?? 0,
          awayScore: m.myPrediction?.awayScore ?? 0,
        };
      }
    });
    return initialEdits;
  });

  // Date grouping depends on the viewer's timezone, which the server cannot
  // know — render the date-grouped sections only after mount.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // True once every group match has passed its own lock (15 min before
  // kickoff) — i.e. the group phase is effectively over for entries.
  const allGroupLocked =
    mounted && matches.every(m => m.stage !== 'group' || m.locked || m.isVoided);

  // UI state
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    type: 'success' | 'warning' | 'error';
    skippedCount: number;
    skippedNames?: string[];
  } | null>(null);

  // Extract unique kickoff dates from matches (local YYYY-MM-DD)
  const uniqueDates = React.useMemo(() => {
    const datesSet = new Set<string>();
    initialMatches.forEach(m => {
      datesSet.add(localDayKey(m.kickoffAt));
    });
    return Array.from(datesSet).sort();
  }, [initialMatches]);

  // Handle score change
  const handleScoreChange = (matchId: string, homeScore: number, awayScore: number) => {
    setEdits(prev => ({
      ...prev,
      [matchId]: { homeScore, awayScore },
    }));
  };

  // Filter matches based on selections
  const filteredMatches = React.useMemo(() => {
    return matches.filter(m => {
      const matchesStage = selectedStage === 'all' ? true : m.stage === selectedStage;
      const matchesDate = selectedDate === 'all' ? true : localDayKey(m.kickoffAt) === selectedDate;
      return matchesStage && matchesDate;
    });
  }, [matches, selectedStage, selectedDate]);

  // Partition matches: editable group matches, locked-but-upcoming group
  // matches (each closes 15 min before its kickoff), already-played group
  // matches, and knockout matches (locked until the bracket phase opens)
  const { editableMatches, lockedUpcomingMatches, playedMatches, knockoutMatches } = React.useMemo(() => {
    const editable: MatchView[] = [];
    const lockedUpcoming: MatchView[] = [];
    const played: MatchView[] = [];
    const knockout: MatchView[] = [];
    const now = Date.now();
    filteredMatches.forEach(m => {
      if (m.stage !== 'group') {
        knockout.push(m);
      } else if (!m.locked && !m.isVoided) {
        editable.push(m);
      } else if (!m.isVoided && new Date(m.kickoffAt).getTime() > now) {
        lockedUpcoming.push(m);
      } else {
        played.push(m);
      }
    });
    return {
      editableMatches: editable,
      lockedUpcomingMatches: lockedUpcoming,
      playedMatches: played,
      knockoutMatches: knockout,
    };
  }, [filteredMatches]);

  // Track unsaved changes (only for open group matches)
  const unsavedMatches = React.useMemo(() => {
    return matches.filter(m => {
      if (m.stage !== 'group' || m.locked || m.isVoided) return false;
      const edit = edits[m.id];
      if (!edit) return false;
      if (m.myPrediction === null) return true;
      return m.myPrediction.homeScore !== edit.homeScore || m.myPrediction.awayScore !== edit.awayScore;
    });
  }, [matches, edits]);

  const unsavedCount = unsavedMatches.length;

  // Calculate saved group predictions count (out of 72)
  const savedGroupCount = React.useMemo(() => {
    return matches.filter(m => m.stage === 'group' && m.myPrediction !== null).length;
  }, [matches]);

  // Group matches by local date
  const groupMatchesByDate = (matchList: MatchView[]) => {
    const groups: Record<string, MatchView[]> = {};
    matchList.forEach(m => {
      const dateKey = localDayKey(m.kickoffAt);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(m);
    });
    return Object.keys(groups).sort().reduce<Record<string, MatchView[]>>((acc, key) => {
      acc[key] = groups[key].sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
      return acc;
    }, {});
  };

  const groupedEditable = React.useMemo(() => groupMatchesByDate(editableMatches), [editableMatches]);
  const groupedLockedUpcoming = React.useMemo(() => groupMatchesByDate(lockedUpcomingMatches), [lockedUpcomingMatches]);
  const groupedPlayed = React.useMemo(() => groupMatchesByDate(playedMatches), [playedMatches]);
  const groupedKnockout = React.useMemo(() => groupMatchesByDate(knockoutMatches), [knockoutMatches]);

  // Format date headers nicely
  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    const formatted = date.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', options);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  // Helper for team name display in confirmations
  const getMatchDisplayName = (match: MatchView) => {
    const homeName = match.homeTeam 
      ? (locale === 'es' ? match.homeTeam.nameEs : match.homeTeam.nameEn)
      : 'TBD';
    const awayName = match.awayTeam 
      ? (locale === 'es' ? match.awayTeam.nameEs : match.awayTeam.nameEn)
      : 'TBD';
    return `${homeName} vs ${awayName}`;
  };

  // Handle batch save
  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const payload = unsavedMatches.map(m => ({
        matchId: m.id,
        homeScore: edits[m.id].homeScore,
        awayScore: edits[m.id].awayScore,
      }));

      const res = await submitPredictions({ predictions: payload });
      if (!res.ok) {
        setToast({
          show: true,
          message: res.error || (locale === 'es' ? 'Error al guardar los pronósticos' : 'Error saving predictions'),
          type: 'error',
          skippedCount: 0
        });
        setIsSubmitting(false);
        return;
      }

      const { saved, skipped } = res.data;

      // Update local matches state
      setMatches(prevMatches => 
        prevMatches.map(m => {
          const savedPred = payload.find(sp => sp.matchId === m.id && !skipped.includes(m.id));
          if (savedPred) {
            return {
              ...m,
              myPrediction: {
                homeScore: savedPred.homeScore,
                awayScore: savedPred.awayScore
              }
            };
          }
          if (skipped.includes(m.id)) {
            return {
              ...m,
              locked: true
            };
          }
          return m;
        })
      );

      // Show toast notifications
      if (skipped.length > 0) {
        const skippedNames: string[] = [];
        skipped.forEach(sId => {
          const match = matches.find(m => m.id === sId);
          if (match) {
            skippedNames.push(getMatchDisplayName(match));
          }
        });

        setToast({
          show: true,
          message: locale === 'es' 
            ? `Se guardaron ${saved} pronósticos.`
            : `Saved ${saved} predictions.`,
          type: 'warning',
          skippedCount: skipped.length,
          skippedNames
        });
      } else {
        setToast({
          show: true,
          message: t('matches.toastSuccess'),
          type: 'success',
          skippedCount: 0
        });
      }

      setShowConfirmModal(false);
    } catch (err: any) {
      setToast({
        show: true,
        message: err.message || (locale === 'es' ? 'Ocurrió un error inesperado' : 'An unexpected error occurred'),
        type: 'error',
        skippedCount: 0
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-close Toast
  React.useEffect(() => {
    if (toast && toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => prev ? { ...prev, show: false } : null);
      }, 6500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // List of stages for segment filter
  const stagesList: { value: MatchStage | 'all'; labelEs: string; labelEn: string }[] = [
    { value: 'all', labelEs: 'Todos', labelEn: 'All' },
    { value: 'group', labelEs: 'Grupos', labelEn: 'Groups' },
    { value: 'r32', labelEs: '1/16', labelEn: 'R32' },
    { value: 'r16', labelEs: 'Octavos', labelEn: 'R16' },
    { value: 'qf', labelEs: 'Cuartos', labelEn: 'QF' },
    { value: 'sf', labelEs: 'Semis', labelEn: 'SF' },
    { value: 'final', labelEs: 'Final', labelEn: 'Final' },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* A. PHASE PROGRESS HEADER */}
      <div className="glass-card p-5 rounded-2xl border border-border/60 shadow-lg space-y-4 select-none">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-primary">
            {t('matches.phaseHeaderTitle')}
          </h2>
          <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary glow-green" />
            {savedGroupCount === 72 
              ? t('matches.completed')
              : t('matches.savedCount', { count: savedGroupCount })}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950/40 rounded-full h-2.5 overflow-hidden border border-border/20">
          <div 
            className="bg-gradient-to-r from-primary to-emerald-400 h-full rounded-full transition-all duration-500 ease-out glow-green"
            style={{ width: `${(savedGroupCount / 72) * 100}%` }}
          />
        </div>

        {/* Phase Nodes */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/25">
          {/* Groups Phase */}
          <div className="flex flex-col space-y-1 p-2 rounded-xl bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-primary">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">1</span>
              {t('matches.phaseGroups')}
            </div>
            <span className="text-[10px] font-bold text-muted-foreground pl-6">
              {savedGroupCount}/72 {locale === 'es' ? 'guardados' : 'saved'}
            </span>
          </div>

          {/* Bonuses Phase */}
          <Link 
            href={`${basePath}/bonuses`}
            className="flex flex-col space-y-1 p-2 rounded-xl hover:bg-secondary/40 border border-transparent hover:border-border/40 transition-all group"
          >
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-foreground group-hover:text-primary transition-colors">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-muted-foreground text-[10px] group-hover:bg-primary group-hover:text-primary-foreground transition-all">2</span>
              {t('matches.phaseBonuses')}
            </div>
            <span className="text-[10px] font-semibold text-primary pl-6 flex items-center gap-0.5 group-hover:underline">
              {locale === 'es' ? 'Ir a Bonos' : 'Go to Bonuses'} &rarr;
            </span>
          </Link>

          {/* Knockouts Phase */}
          <div className="flex flex-col space-y-1 p-2 rounded-xl opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-muted-foreground text-[10px]">3</span>
              {t('matches.phaseKnockouts')}
            </div>
            <span className="text-[10px] font-extrabold text-amber-500 pl-6 uppercase tracking-wider scale-90 origin-left">
              {t('matches.comingSoon')}
            </span>
          </div>
        </div>
      </div>

      {/* FILTERS CONTAINER */}
      <div className="glass-card p-4 rounded-2xl border border-border/65 space-y-4 shadow-md select-none">
        {/* Stage tag filters */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
            <Filter className="h-3 w-3" />
            {t('matches.stageFilter')}
          </label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none snap-x">
            {stagesList.map(stage => {
              const active = selectedStage === stage.value;
              return (
                <button
                  key={stage.value}
                  type="button"
                  onClick={() => setSelectedStage(stage.value)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap snap-align-start cursor-pointer",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/15"
                      : "bg-secondary/40 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/75"
                  )}
                >
                  {locale === 'es' ? stage.labelEs : stage.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date dropdown filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <label htmlFor="date-filter" className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {t('matches.dateFilter')}
            </label>
            <select
              id="date-filter"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 focus-visible:border-primary/50 font-semibold cursor-pointer"
            >
              <option value="all">
                📅 {locale === 'es' ? 'Todas las fechas' : 'All dates'}
              </option>
              {uniqueDates.map(d => (
                <option key={d} value={d}>
                  📅 {formatDateHeader(d)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* B. MATCH SECTIONS (grouped by the viewer's local day — client-only) */}
      <div className="space-y-12">
        {!mounted && (
          <div className="p-12 text-center text-muted-foreground font-light glass-card border border-border/40 rounded-3xl animate-pulse">
            {t('common.loading')}
          </div>
        )}

        {/* SECTION 1: ACTIVE / EDITABLE MATCHES */}
        {mounted && Object.keys(groupedEditable).length > 0 && (
          <div className="space-y-6">
            {Object.keys(groupedEditable).map(dateKey => (
              <div key={dateKey} className="space-y-4">
                <h3 className="text-sm font-extrabold text-primary tracking-wider uppercase pl-1 select-none border-l-2 border-primary/60 ml-0.5">
                  {formatDateHeader(dateKey)}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupedEditable[dateKey]!.map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      locale={locale}
                      homeScore={edits[match.id]?.homeScore ?? 0}
                      awayScore={edits[match.id]?.awayScore ?? 0}
                      onChange={handleScoreChange}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SECTION 1.5: LOCKED BUT NOT YET PLAYED (entries closed at tournament start) */}
        {mounted && Object.keys(groupedLockedUpcoming).length > 0 && (
          <div className="space-y-6 pt-6 border-t border-border/20">
            <h2 className="text-base font-extrabold tracking-wider text-muted-foreground uppercase pl-1 select-none flex items-center gap-2">
              <span>🔒 {t('matches.lockedUpcoming')}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 normal-case tracking-normal">
                {t('matches.lockedUpcomingNote')}
              </span>
            </h2>
            {Object.keys(groupedLockedUpcoming).map(dateKey => (
              <div key={dateKey} className="space-y-4">
                <h3 className="text-sm font-extrabold text-muted-foreground/80 tracking-wider uppercase pl-1 select-none border-l-2 border-muted/50 ml-0.5">
                  {formatDateHeader(dateKey)}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupedLockedUpcoming[dateKey]!.map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      locale={locale}
                      homeScore={match.myPrediction?.homeScore ?? 0}
                      awayScore={match.myPrediction?.awayScore ?? 0}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SECTION 2: YA JUGADOS (played group matches) */}
        {mounted && Object.keys(groupedPlayed).length > 0 && (
          <div className="space-y-6 pt-6 border-t border-border/20 opacity-90">
            <h2 className="text-base font-extrabold tracking-wider text-muted-foreground uppercase pl-1 select-none flex items-center gap-2">
              <span>⚽️ {t('matches.alreadyPlayed')}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-950/60 border border-border/40 text-muted-foreground">
                {playedMatches.length}
              </span>
            </h2>
            {Object.keys(groupedPlayed).map(dateKey => (
              <div key={dateKey} className="space-y-4">
                <h3 className="text-sm font-extrabold text-muted-foreground/80 tracking-wider uppercase pl-1 select-none border-l-2 border-muted/50 ml-0.5">
                  {formatDateHeader(dateKey)}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupedPlayed[dateKey]!.map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      locale={locale}
                      homeScore={match.myPrediction?.homeScore ?? 0}
                      awayScore={match.myPrediction?.awayScore ?? 0}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SECTION 3: KNOCKOUT STAGE (locked until the bracket phase opens) */}
        {mounted && Object.keys(groupedKnockout).length > 0 && (
          <div className="space-y-6 pt-6 border-t border-border/20 opacity-90">
            <h2 className="text-base font-extrabold tracking-wider text-muted-foreground uppercase pl-1 select-none flex items-center gap-2">
              <span>🏆 {t('matches.knockoutSection')}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500">
                {t('matches.knockoutSectionNote')}
              </span>
            </h2>
            {Object.keys(groupedKnockout).map(dateKey => (
              <div key={dateKey} className="space-y-4">
                <h3 className="text-sm font-extrabold text-muted-foreground/80 tracking-wider uppercase pl-1 select-none border-l-2 border-muted/50 ml-0.5">
                  {formatDateHeader(dateKey)}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupedKnockout[dateKey]!.map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      locale={locale}
                      homeScore={match.myPrediction?.homeScore ?? 0}
                      awayScore={match.myPrediction?.awayScore ?? 0}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EMPTY STATE */}
        {mounted &&
          Object.keys(groupedEditable).length === 0 &&
          Object.keys(groupedLockedUpcoming).length === 0 &&
          Object.keys(groupedPlayed).length === 0 &&
          Object.keys(groupedKnockout).length === 0 && (
          <div className="p-12 text-center text-muted-foreground font-light glass-card border border-border/40 rounded-3xl">
            {t('matches.noMatches')}
          </div>
        )}
      </div>

      {/* C. STICKY FOOTER BAR */}
      <div className="fixed bottom-[57px] md:bottom-0 left-0 w-full z-30 border-t border-border bg-card/90 backdrop-blur-md shadow-2xl transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={cn(
              "h-2 w-2 rounded-full transition-all duration-300",
              unsavedCount > 0 ? "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.7)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
            )} />
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
              <span className="text-xs sm:text-sm font-extrabold text-foreground">
                72 {t('nav.matches').toLowerCase()}
              </span>
              {unsavedCount > 0 ? (
                <>
                  <span className="hidden sm:inline text-xs text-muted-foreground">•</span>
                  <span className="text-[10px] sm:text-xs font-bold text-amber-500 animate-pulse">
                    {t('matches.unsavedChanges', { count: unsavedCount })}
                  </span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline text-xs text-muted-foreground">•</span>
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-400">
                    {allGroupLocked
                      ? t('matches.lockedUpcoming')
                      : locale === 'es' ? 'Todo guardado' : 'All saved'}
                  </span>
                </>
              )}
            </div>
          </div>

          <Button
            onClick={() => setShowConfirmModal(true)}
            disabled={unsavedCount === 0 || isSubmitting}
            className={cn(
              "rounded-xl px-4 py-2 font-extrabold text-xs sm:text-sm transition-all duration-200 active:scale-95 shadow-md flex items-center gap-1.5",
              unsavedCount > 0 
                ? "bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/95 hover:to-emerald-500/95 text-primary-foreground cursor-pointer"
                : "bg-secondary text-muted-foreground cursor-not-allowed"
            )}
          >
            {t('matches.saveBtnCount', { count: unsavedCount })}
          </Button>
        </div>
      </div>

      {/* D. CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            className="glass-card border border-border/80 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <div className="flex items-center gap-2 text-primary">
                <HelpCircle className="h-5 w-5" />
                <h3 className="text-base font-extrabold">
                  {t('matches.saveConfirmTitle')}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowConfirmModal(false)}
                className="text-muted-foreground hover:text-foreground rounded-lg p-1 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                {t('matches.saveConfirmDesc', { count: unsavedCount })}
              </p>

              {/* Scrollable list of modifications */}
              <div className="bg-slate-950/50 rounded-xl border border-border/50 max-h-36 overflow-y-auto p-3 space-y-2 text-[11px] scrollbar-thin">
                {unsavedMatches.map(m => {
                  const edit = edits[m.id];
                  return (
                    <div key={m.id} className="flex justify-between items-center text-muted-foreground border-b border-border/10 pb-1.5 last:border-0 last:pb-0">
                      <span className="font-semibold text-foreground text-left line-clamp-1 max-w-[260px]">
                        {getMatchDisplayName(m)}
                      </span>
                      <span className="font-extrabold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/25 whitespace-nowrap">
                        {edit.homeScore} - {edit.awayScore}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground border border-border/40 hover:bg-secondary/40 cursor-pointer"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSubmitting}
                className="rounded-xl text-xs font-extrabold bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/95 hover:to-emerald-500/95 text-primary-foreground cursor-pointer shadow-md"
              >
                {isSubmitting ? t('common.saving') : t('matches.saveConfirmBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* E. FLOATING SUCCESS / WARNING / ERROR TOAST */}
      {toast && toast.show && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-card/95 border border-border/80 rounded-2xl shadow-2xl p-4 backdrop-blur-md animate-in slide-in-from-top-12 duration-300 select-none">
          <div className="flex items-start gap-3">
            {toast.type === 'success' && (
              <div className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            )}
            {(toast.type === 'warning' || toast.type === 'error') && (
              <div className={cn(
                "rounded-full p-1.5 border",
                toast.type === 'error' ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              )}>
                <AlertTriangle className="h-5 w-5" />
              </div>
            )}

            <div className="flex-1 space-y-1.5">
              <h4 className="text-xs font-bold text-foreground">
                {toast.type === 'success' 
                  ? (locale === 'es' ? '¡Guardado!' : 'Saved!') 
                  : toast.type === 'error' 
                    ? (locale === 'es' ? 'Error al guardar' : 'Error saving')
                    : (locale === 'es' ? 'Advertencia' : 'Warning')}
              </h4>
              <p className="text-[11px] text-muted-foreground font-medium leading-normal">
                {toast.message}
              </p>
              
              {toast.skippedCount > 0 && toast.skippedNames && (
                <div className="pt-1 space-y-1">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">
                    {locale === 'es' ? 'Partidos cerrados omitidos:' : 'Skipped closed matches:'}
                  </span>
                  <ul className="text-[9px] text-muted-foreground list-disc pl-3 space-y-0.5 font-semibold">
                    {toast.skippedNames.map((name, i) => (
                      <li key={i}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button 
              type="button" 
              onClick={() => setToast(prev => prev ? { ...prev, show: false } : null)}
              className="text-muted-foreground hover:text-foreground rounded-lg p-0.5 transition-colors self-start"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
