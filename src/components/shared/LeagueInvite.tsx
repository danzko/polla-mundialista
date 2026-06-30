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
      ? `¡Únete a mi polla "${leagueName}" para el Mundial 2026! Código: ${code}`
      : `Join my World Cup 2026 pool "${leagueName}"! Code: ${code}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Polla 2026', text, url });
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
        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-card px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-primary/10"
      >
        <UserPlus className="h-3.5 w-3.5 text-primary" />
        {es ? 'Invitar' : 'Invite'}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border/60 bg-card p-3 shadow-xl shadow-black/30">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              {es ? 'Código de invitación' : 'Invite code'}
            </span>
            <button type="button" onClick={() => setOpen(false)} className="p-0.5 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <CopyableCode code={code} className="w-full justify-between" />
          <button
            type="button"
            onClick={handleShare}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-emerald-500 px-3 py-2 text-xs font-extrabold text-primary-foreground"
          >
            <Share2 className="h-3.5 w-3.5" />
            {es ? 'Compartir invitación' : 'Share invite'}
          </button>
          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
            {es ? 'Comparte el código o el enlace para que tus amigos entren.' : 'Share the code or link so friends can join.'}
          </p>
        </div>
      )}
    </div>
  );
}
