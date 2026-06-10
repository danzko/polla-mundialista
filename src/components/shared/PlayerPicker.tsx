'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import playersData from '@/lib/players-wc2026.json';

interface PlayerPickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Accent-insensitive normalization: "Vinícius Júnior" -> "vinicius junior"
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

type PlayerEntry = { name: string; team: string; haystack: string };

// Precomputed once: searchable haystack includes name, team and a "jr"
// alias so colloquial searches like "vini jr" still match "Vinícius Júnior".
const PLAYERS: PlayerEntry[] = (playersData as { n: string; t: string }[]).map(
  (p) => {
    const base = `${norm(p.n)} ${norm(p.t)}`;
    const haystack = base.includes('junior') ? `${base} jr` : base;
    return { name: p.n, team: p.t, haystack };
  }
);

export function PlayerPicker({
  id,
  value,
  onChange,
  disabled = false,
  placeholder,
}: PlayerPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const suggestions = React.useMemo(() => {
    const q = norm(value.trim());
    if (q.length < 2) return [];
    const tokens = q.split(/\s+/);
    const out: PlayerEntry[] = [];
    for (const p of PLAYERS) {
      if (tokens.every((tok) => p.haystack.includes(tok))) {
        out.push(p);
        if (out.length >= 10) break;
      }
    }
    // Hide the dropdown when the field already holds an exact pick
    if (out.length === 1 && out[0].name === value) return [];
    return out;
  }, [value]);

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className={cn(
          'flex h-10 w-full rounded-xl border border-input bg-card/65 px-3 py-2 text-sm font-semibold ring-offset-background placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-all',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      />

      {isOpen && !disabled && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl glass-panel animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="overflow-y-auto max-h-[220px] py-1">
            {suggestions.map((p) => (
              <button
                key={`${p.name}|${p.team}`}
                type="button"
                onClick={() => {
                  onChange(p.name);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-secondary transition-colors cursor-pointer"
              >
                <span className="font-semibold truncate">{p.name}</span>
                <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground shrink-0">
                  <Search className="h-3 w-3 opacity-50" />
                  {p.team}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
