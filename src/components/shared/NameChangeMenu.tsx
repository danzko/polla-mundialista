'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { changeDisplayName } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/types';

interface NameChangeMenuProps {
  locale: Locale;
  displayName: string;
  used: boolean;
  variant?: 'icon' | 'row';
  onDone?: () => void;
}

/**
 * Tucked-away one-time display-name change. Renders a discreet trigger
 * (pencil icon in the desktop header, or a full row in the mobile menu)
 * and a small modal with a clear "only once" warning. The DB enforces
 * the one-time rule (change_display_name RPC); this is the front door.
 */
export function NameChangeMenu({ locale, displayName, used, variant = 'icon', onDone }: NameChangeMenuProps) {
  const es = locale === 'es';
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(displayName);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const openModal = () => { setName(displayName); setError(''); setOpen(true); };

  const trimmed = name.trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 40 && trimmed !== displayName;

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    setError('');
    const res = await changeDisplayName({ name: trimmed });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      onDone?.();
      router.refresh();
    } else {
      setError(res.error);
    }
  };

  const trigger = variant === 'row' ? (
    <button
      type="button"
      onClick={openModal}
      className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      <Pencil className="h-3.5 w-3.5" />
      {es ? 'Cambiar nombre' : 'Change name'}
      {used && <span className="ml-auto text-[11px] text-muted-foreground/60">{es ? 'usado' : 'used'}</span>}
    </button>
  ) : (
    <button
      type="button"
      onClick={openModal}
      title={es ? 'Cambiar nombre' : 'Change name'}
      aria-label={es ? 'Cambiar nombre' : 'Change name'}
      className="rounded-md p-1 text-muted-foreground/70 hover:text-foreground transition-colors"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <>
      {trigger}
      {open && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setOpen(false)}>
          <div className="glass-card border border-border/80 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">{es ? 'Cambiar tu nombre' : 'Change your name'}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground rounded-lg p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            {used ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {es
                  ? 'Ya usaste tu único cambio de nombre. No se puede cambiar de nuevo.'
                  : 'You already used your one-time name change. It can’t be changed again.'}
              </p>
            ) : (
              <>
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-500 font-medium leading-snug">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {es
                    ? 'Solo puedes cambiar tu nombre UNA vez. Elígelo con cuidado.'
                    : 'You can only change your name ONCE. Choose carefully.'}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {es ? 'Nuevo nombre' : 'New name'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    maxLength={40}
                    autoFocus
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                    className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving} className="rounded-xl text-xs font-bold text-muted-foreground border border-border/40">
                {used ? (es ? 'Cerrar' : 'Close') : (es ? 'Cancelar' : 'Cancel')}
              </Button>
              {!used && (
                <Button
                  onClick={submit}
                  disabled={!valid || saving}
                  className={cn('rounded-xl text-xs font-extrabold text-primary-foreground', valid ? 'bg-gradient-to-r from-primary to-[hsl(var(--brand-2))]' : 'bg-secondary text-muted-foreground cursor-not-allowed')}
                >
                  {saving ? (es ? 'Guardando…' : 'Saving…') : (es ? 'Cambiar' : 'Change')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
