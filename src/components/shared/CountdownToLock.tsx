'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
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
  const locale = useLocale();
  const pad = (num: number) => String(num).padStart(2, '0');

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

  // One calm line: "Cierran en 42 d 13 h · mar 20 oct, 12:45 p.m. ET". No box-per-digit.
  const when = new Date(lockAt).toLocaleString(locale === 'es' ? 'es-CO' : 'en-US', {
    timeZone: 'America/New_York', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }).replace(/\bde\b/g, '').replace(/\s+/g, ' ').trim();
  const rel = time.days > 0
    ? `${time.days} d ${time.hours} h`
    : time.hours > 0 ? `${time.hours} h ${pad(time.minutes)} min` : `${time.minutes} min ${pad(time.seconds)} s`;
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm', className)}>
      <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
        <Clock className="h-4 w-4 text-primary" aria-hidden />
        {t('bonuses.lockWarning')} <span className="tabular-nums text-primary">{rel}</span>
      </span>
      <span className="text-xs text-muted-foreground">· {when} ET</span>
    </div>
  );
}
