'use client';

import * as React from 'react';
import { Sun, Moon } from 'lucide-react';

/** Light / dark switch. Persists in localStorage; the root layout's inline
 *  script re-applies it before paint. Dark is the default. */
export function ModeToggle({ className }: { className?: string }) {
  const [mode, setMode] = React.useState<'dark' | 'light'>('dark');

  React.useEffect(() => {
    const m = document.documentElement.dataset.mode;
    if (m === 'light' || m === 'dark') setMode(m);
  }, []);

  const toggle = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    document.documentElement.dataset.mode = next;
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem('mode', next); } catch { /* ignore */ }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
      className={className ?? 'inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground'}
    >
      {mode === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
