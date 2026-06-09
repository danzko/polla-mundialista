'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { MatchCard } from '@/components/predictions/MatchCard';
import { submitPrediction } from '@/lib/api';
import type { MatchView, MatchStage, Locale } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, Filter } from 'lucide-react';

interface MatchesFilterViewProps {
  initialMatches: MatchView[];
  locale: Locale;
}

export function MatchesFilterView({ initialMatches, locale }: MatchesFilterViewProps) {
  const t = useTranslations();
  
  const [matches, setMatches] = React.useState<MatchView[]>(initialMatches);
  const [selectedStage, setSelectedStage] = React.useState<MatchStage | 'all'>('all');
  const [selectedDate, setSelectedDate] = React.useState<string | 'all'>('all');

  // Extract unique kickoff dates from matches (YYYY-MM-DD)
  const uniqueDates = React.useMemo(() => {
    const datesSet = new Set<string>();
    initialMatches.forEach(m => {
      datesSet.add(m.kickoffAt.substring(0, 10));
    });
    return Array.from(datesSet).sort();
  }, [initialMatches]);

  // Handle local state updates for prediction
  const handleSubmitPrediction = async (matchId: string, homeScore: number, awayScore: number) => {
    const result = await submitPrediction({ matchId, homeScore, awayScore });
    if (result.ok) {
      // Sync local matches array
      setMatches(prev =>
        prev.map(m =>
          m.id === matchId
            ? { ...m, myPrediction: { homeScore, awayScore } }
            : m
        )
      );
    }
    return result;
  };

  // Filter matches based on selections
  const filteredMatches = React.useMemo(() => {
    return matches.filter(m => {
      const matchesStage = selectedStage === 'all' ? true : m.stage === selectedStage;
      const matchesDate = selectedDate === 'all' ? true : m.kickoffAt.substring(0, 10) === selectedDate;
      return matchesStage && matchesDate;
    });
  }, [matches, selectedStage, selectedDate]);

  // Group filtered matches by kickoff date (YYYY-MM-DD)
  const groupedMatches = React.useMemo(() => {
    const groups: Record<string, MatchView[]> = {};
    
    filteredMatches.forEach(m => {
      const dateKey = m.kickoffAt.substring(0, 10);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(m);
    });

    // Sort group keys chronologically
    return Object.keys(groups)
      .sort()
      .reduce<Record<string, MatchView[]>>((acc, key) => {
        acc[key] = groups[key]!.sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
        return acc;
      }, {});
  }, [filteredMatches]);

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
    // Capitalize first letter (especially useful in Spanish)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  // List of stages for the segment filter
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
    <div className="space-y-6">
      
      {/* FILTERS CONTAINER */}
      <div className="glass-card p-4 rounded-2xl border border-border/65 space-y-4 shadow-md select-none">
        
        {/* Stage tag filters (Scrollable segment bar) */}
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

      {/* MATCH CARDS BY DATE GROUP */}
      <div className="space-y-8">
        {Object.keys(groupedMatches).length > 0 ? (
          Object.keys(groupedMatches).map(dateKey => (
            <div key={dateKey} className="space-y-4">
              
              {/* Date Header */}
              <h3 className="text-sm font-extrabold text-muted-foreground tracking-wider uppercase pl-1 select-none border-l-2 border-primary/50 ml-0.5">
                {formatDateHeader(dateKey)}
              </h3>

              {/* Matches list grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedMatches[dateKey]!.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    locale={locale}
                    onSubmitPrediction={handleSubmitPrediction}
                  />
                ))}
              </div>

            </div>
          ))
        ) : (
          <div className="p-12 text-center text-muted-foreground font-light glass-card border border-border/40 rounded-3xl">
            {t('matches.noMatches')}
          </div>
        )}
      </div>

    </div>
  );
}
