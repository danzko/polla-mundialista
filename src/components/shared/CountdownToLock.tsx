'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Clock, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountdownToLockProps {
  lockAt: string;
  onLockChange?: (locked: boolean) => void;
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export function CountdownToLock({ lockAt, onLockChange, className }: CountdownToLockProps) {
  const t = useTranslations();

  const calculateTimeRemaining = React.useCallback((): TimeRemaining => {
    const difference = new Date(lockAt).getTime() - new Date().getTime();
    
    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      isExpired: false,
    };
  }, [lockAt]);

  const [time, setTime] = React.useState<TimeRemaining>(calculateTimeRemaining());

  React.useEffect(() => {
    // Initial check
    const initialTime = calculateTimeRemaining();
    setTime(initialTime);
    if (initialTime.isExpired && onLockChange) {
      onLockChange(true);
    }

    if (initialTime.isExpired) return;

    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTime(remaining);
      
      if (remaining.isExpired) {
        clearInterval(timer);
        if (onLockChange) {
          onLockChange(true);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lockAt, calculateTimeRemaining, onLockChange]);

  if (time.isExpired) {
    return (
      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider", className)}>
        <Lock className="h-3.5 w-3.5" />
        {t('bonuses.locked')}
      </div>
    );
  }

  // Formatting utility to pad numbers
  const pad = (num: number) => String(num).padStart(2, '0');

  return (
    <div className={cn("inline-flex flex-col items-center gap-1.5", className)}>
      <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest flex items-center gap-1 select-none">
        <Clock className="h-3 w-3" />
        {t('bonuses.lockWarning')}
      </div>

      <div className="flex items-center gap-1.5 text-center select-none font-mono">
        {/* Days */}
        {time.days > 0 && (
          <>
            <div className="flex flex-col items-center bg-slate-900/80 border border-border/80 rounded-lg px-2.5 py-1 min-w-[36px]">
              <span className="text-sm font-extrabold text-foreground">{pad(time.days)}</span>
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                {time.days === 1 ? 'd' : 'd'}
              </span>
            </div>
            <span className="text-muted-foreground font-extrabold pb-4">:</span>
          </>
        )}

        {/* Hours */}
        <div className="flex flex-col items-center bg-slate-900/80 border border-border/80 rounded-lg px-2.5 py-1 min-w-[36px]">
          <span className="text-sm font-extrabold text-foreground">{pad(time.hours)}</span>
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">h</span>
        </div>
        <span className="text-muted-foreground font-extrabold pb-4">:</span>

        {/* Minutes */}
        <div className="flex flex-col items-center bg-slate-900/80 border border-border/80 rounded-lg px-2.5 py-1 min-w-[36px]">
          <span className="text-sm font-extrabold text-foreground">{pad(time.minutes)}</span>
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">m</span>
        </div>
        <span className="text-muted-foreground font-extrabold pb-4">:</span>

        {/* Seconds */}
        <div className="flex flex-col items-center bg-slate-900/80 border border-border/80 rounded-lg px-2.5 py-1 min-w-[36px]">
          <span className="text-sm font-extrabold text-primary">{pad(time.seconds)}</span>
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">s</span>
        </div>
      </div>
    </div>
  );
}
