'use client';

import * as React from 'react';
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreStepperProps {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ScoreStepper({
  value,
  onChange,
  disabled = false,
  placeholder = '-',
}: ScoreStepperProps) {
  const increment = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    const current = value ?? 0;
    if (current < 15) {
      onChange(current + 1);
    }
  };

  const decrement = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    const current = value ?? 0;
    if (current > 0) {
      onChange(current - 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const val = e.target.value;
    if (val === '') {
      // Allow empty value state temporarily in the input box, 
      // but we resolve it to 0 or leave as is. Let's force a number or default.
      return;
    }
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(0, Math.min(15, parsed));
      onChange(clamped);
    }
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-950/40 p-1 rounded-xl border border-border/60">
      {/* Minus Button */}
      <button
        type="button"
        onClick={decrement}
        disabled={disabled || (value !== null && value <= 0)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-card text-foreground transition-all active:scale-90 select-none",
          (disabled || (value !== null && value <= 0))
            ? "opacity-30 pointer-events-none cursor-not-allowed"
            : "hover:bg-primary/20 hover:text-primary hover:border-primary/40 cursor-pointer"
        )}
      >
        <Minus className="h-4 w-4" />
      </button>

      {/* Numeric Input */}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value !== null ? value : ''}
        placeholder={placeholder}
        onChange={handleInputChange}
        disabled={disabled}
        className={cn(
          "h-8 w-10 border-0 bg-transparent text-center text-base font-extrabold focus:outline-none focus:ring-0 select-all",
          disabled ? "text-muted-foreground" : "text-foreground"
        )}
      />

      {/* Plus Button */}
      <button
        type="button"
        onClick={increment}
        disabled={disabled || (value !== null && value >= 15)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-card text-foreground transition-all active:scale-90 select-none",
          (disabled || (value !== null && value >= 15))
            ? "opacity-30 pointer-events-none cursor-not-allowed"
            : "hover:bg-primary/20 hover:text-primary hover:border-primary/40 cursor-pointer"
        )}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
