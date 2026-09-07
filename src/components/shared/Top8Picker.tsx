'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { Flag } from '@/components/shared/Flag';
import { shortTeamName } from '@/lib/team-names';
import { cn } from '@/lib/utils';
import type { Team, Locale } from '@/lib/types';

/** Tap-to-toggle crest grid: pick exactly 8 clubs. */
export function Top8Picker({ teams, value, onChange, locale, disabled = false }: {
  teams: Team[];
  value: string[];
  onChange: (ids: string[]) => void;
  locale: Locale;
  disabled?: boolean;
}) {
  const es = locale === 'es';
  const selected = new Set(value);
  const full = selected.size >= 8;
  const sorted = React.useMemo(() => [...teams].sort((a, b) => (es ? a.nameEs : a.nameEn).localeCompare(es ? b.nameEs : b.nameEn)), [teams, es]);

  const toggle = (id: string) => {
    if (disabled) return;
    if (selected.has(id)) onChange(value.filter((x) => x !== id));
    else if (!full) onChange([...value, id]);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{es ? 'Toca 8 escudos' : 'Tap 8 crests'}</span>
        <span className={cn('rounded-full px-2 py-0.5 font-bold tabular-nums', full ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}>{selected.size}/8</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {sorted.map((t) => {
          const on = selected.has(t.id);
          const idx = value.indexOf(t.id);
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled || (!on && full)}
              onClick={() => toggle(t.id)}
              aria-pressed={on}
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center transition-colors',
                on ? 'border-primary bg-primary/15' : 'border-border/50 bg-card/50 hover:border-border',
                (disabled || (!on && full)) && !on && 'opacity-40',
                disabled && 'cursor-default'
              )}
            >
              {on && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-extrabold text-primary-foreground">
                  {idx + 1}
                </span>
              )}
              <Flag code={t.code} emoji={t.flagEmoji} logoUrl={t.logoUrl} className={t.logoUrl ? 'h-8 w-8 object-contain' : 'h-5 w-auto rounded-[2px]'} />
              <span className="w-full truncate text-[11px] font-semibold leading-tight">{shortTeamName(es ? t.nameEs : t.nameEn)}</span>
              {on && <Check className="sr-only" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
