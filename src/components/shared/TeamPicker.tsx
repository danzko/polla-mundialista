'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Team, Locale } from '@/lib/types';

interface TeamPickerProps {
  teams: Team[];
  value: string | null; // Selected team ID
  onChange: (teamId: string | null) => void;
  locale: Locale;
  disabled?: boolean;
  hideEliminatedToggle?: boolean;
  placeholder?: string;
}

export function TeamPicker({
  teams,
  value,
  onChange,
  locale,
  disabled = false,
  hideEliminatedToggle = true,
  placeholder,
}: TeamPickerProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [hideEliminated, setHideEliminated] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedTeam = React.useMemo(() => {
    return teams.find((t) => t.id === value) || null;
  }, [teams, value]);

  // Filter teams based on search query and elimination status
  const filteredTeams = React.useMemo(() => {
    return teams.filter((team) => {
      const name = locale === 'es' ? team.nameEs : team.nameEn;
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.code.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesElimination = hideEliminated ? !team.eliminated : true;
      
      return matchesSearch && matchesElimination;
    });
  }, [teams, searchQuery, hideEliminated, locale]);

  const handleSelect = (teamId: string) => {
    if (disabled) return;
    onChange(teamId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(null);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 text-left cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        {selectedTeam ? (
          <div className="flex items-center gap-2">
            <span className="text-xl filter drop-shadow-sm select-none">{selectedTeam.flagEmoji}</span>
            <span className="font-semibold text-foreground">
              {locale === 'es' ? selectedTeam.nameEs : selectedTeam.nameEn}
            </span>
            <span className="text-xs font-extrabold text-muted-foreground uppercase">
              ({selectedTeam.code})
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">
            {placeholder || t('bonuses.emptyTeamOption')}
          </span>
        )}

        <div className="flex items-center gap-1.5">
          {selectedTeam && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-250", isOpen && "rotate-180")} />
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 max-h-60 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl glass-panel animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Search Box */}
          <div className="flex items-center border-b border-border/80 px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              placeholder={t('bonuses.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Hide Eliminated Toggle */}
          {hideEliminatedToggle && (
            <div className="flex items-center justify-between border-b border-border/40 px-3 py-2 bg-secondary/30">
              <label htmlFor="hide-eliminated" className="text-xs font-medium text-muted-foreground cursor-pointer select-none">
                {locale === 'es' ? 'Ocultar eliminados' : 'Hide eliminated teams'}
              </label>
              <input
                id="hide-eliminated"
                type="checkbox"
                checked={hideEliminated}
                onChange={(e) => setHideEliminated(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"
              />
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto max-h-[170px] py-1">
            {filteredTeams.length > 0 ? (
              filteredTeams.map((team) => {
                const name = locale === 'es' ? team.nameEs : team.nameEn;
                const isSelected = team.id === value;
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => handleSelect(team.id)}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-sm text-left hover:bg-secondary transition-colors cursor-pointer",
                      isSelected && "bg-accent/40 text-accent-foreground font-bold",
                      team.eliminated && "opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl filter drop-shadow-sm select-none">{team.flagEmoji}</span>
                      <span>{name}</span>
                      <span className="text-xs font-extrabold text-muted-foreground uppercase">
                        ({team.code})
                      </span>
                      {team.eliminated && (
                        <span className="text-[9px] font-extrabold uppercase text-destructive border border-destructive/20 bg-destructive/5 px-1 rounded">
                          {locale === 'es' ? 'Eliminado' : 'Out'}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary stroke-[3px]" />}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                {locale === 'es' ? 'Sin resultados' : 'No teams found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
