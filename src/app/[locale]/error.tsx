'use client';

import * as React from 'react';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="glass-card w-full max-w-md rounded-2xl border border-border/60 p-8 text-center space-y-5">
        <div className="text-5xl select-none">😵‍💫⚽</div>
        <h2 className="text-xl font-extrabold text-foreground">
          Algo salió mal
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tranquilo: tus pronósticos guardados están a salvo. Intenta de nuevo
          y si sigue fallando, avísanos en el grupo.
          <br />
          <span className="text-xs opacity-75">
            Something went wrong — your saved picks are safe. Try again, and
            tell us if it keeps happening.
          </span>
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground transition-all hover:opacity-90 active:scale-95 cursor-pointer"
        >
          Reintentar / Try again
        </button>
        {error.digest && (
          <p className="text-[10px] text-muted-foreground/60 font-mono select-all">
            ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
