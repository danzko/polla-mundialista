'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { setCurrentTournament } from '@/lib/api';
import type { Locale } from '@/lib/types';

/** Steps into an archived tournament (read-only) from the Hall of Fame. */
export function ViewTournamentButton({ slug, locale, label }: { slug: string; locale: Locale; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => {
        await setCurrentTournament(slug);
        router.push(`/${locale}/leaderboard`);
        router.refresh();
      })}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-60"
    >
      <ExternalLink className="h-3 w-3" />
      {label}
    </button>
  );
}
