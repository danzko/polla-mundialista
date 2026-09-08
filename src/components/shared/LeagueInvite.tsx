'use client';

import * as React from 'react';
import { UserPlus, Share2, X } from 'lucide-react';
import { CopyableCode } from './CopyableCode';
import type { Locale } from '@/lib/types';

// Compact "Invite" button that tucks the league's invite code behind a tap.
// Opens a small popover with the code (copyable) plus a one-tap native share —
// the way a friend-group actually spreads (WhatsApp), instead of a code block
// always taking up room at the top of the league page.
export function LeagueInvite({ code, leagueName, locale }: { code: string; leagueName: string; locale: Locale }) {
  const es = locale === 'es';
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/${locale}/leagues/join` : '';
    const text = es
      ? `¡Únete a mi polla "${leagueName}" en La Polla! Código: ${code}`
      : `Join my pool "${leagueName}" on La Polla! Code: ${code}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'La Polla', text, url });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
      }
    } catch {
      /* user dismissed the share sheet — nothing to do */
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-primary/30 bg-card px-3.5 text-xs font-bold text-foreground hover:bg-primary/10"
      >
        <UserPlus className="h-3.5 w-3.5 text-primary" />
        {es ? 'Invitar' : 'Invite'}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border/60 bg-card p-3 shadow-xl shadow-black/30">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {es ? 'Código de invitación' : 'Invite code'}
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="close" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <CopyableCode code={code} className="w-full justify-between" />
          <button
            type="button"
            onClick={handleShare}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-[hsl(var(--brand-2))] px-3 py-2 text-xs font-extrabold text-primary-foreground"
          >
            <Share2 className="h-3.5 w-3.5" />
            {es ? 'Compartir invitación' : 'Share invite'}
          </button>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            {es ? 'Comparte el código o el enlace para que tus amigos entren.' : 'Share the code or link so friends can join.'}
          </p>
        </div>
      )}
    </div>
  );
}
