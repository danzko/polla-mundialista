"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { confirmLiveResult, applyProviderKickoff } from "./actions";

interface LiveTeam {
  code: string;
  nameEs: string;
  flagEmoji: string;
}

export interface LiveItem {
  matchId: string;
  matchNumber: number;
  homeTeam: LiveTeam | null;
  awayTeam: LiveTeam | null;
  kickoffAt: string;
  isVoided: boolean;
  providerKickoffAt: string | null;
  providerHome: string | null;
  providerAway: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string; // pre | in | post
  statusDetail: string | null;
  displayClock: string | null;
  completed: boolean;
  result: { homeScore: number; awayScore: number } | null;
}

export interface SyncState {
  lastRunAt: string;
  ok: boolean;
  message: string | null;
}

const fmtET = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso)) + " ET";

export function LivePanel({ items, sync }: { items: LiveItem[]; sync: SyncState | null }) {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState("");

  React.useEffect(() => setMounted(true), []);

  // The panel is only useful fresh: re-pull server data every minute.
  React.useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  const name = (t: LiveTeam | null, fallback: string | null) =>
    t ? `${t.flagEmoji} ${t.nameEs}` : fallback ?? "TBD";

  // Drift recomputed from fresh kickoff_at so applying a fix clears the
  // alert immediately instead of waiting for the next sync run.
  const driftSec = (it: LiveItem) =>
    it.providerKickoffAt
      ? Math.round(
          (new Date(it.providerKickoffAt).getTime() - new Date(it.kickoffAt).getTime()) / 1000,
        )
      : 0;

  const active = items.filter((i) => !i.isVoided);
  const live = active.filter((i) => i.status === "in");
  const toConfirm = active.filter(
    (i) => i.completed && i.homeScore !== null && i.awayScore !== null && !i.result,
  );
  const mismatched = active.filter(
    (i) =>
      i.completed &&
      i.result &&
      (i.result.homeScore !== i.homeScore || i.result.awayScore !== i.awayScore),
  );
  const drifted = active.filter((i) => !i.completed && i.status === "pre" && Math.abs(driftSec(i)) >= 60);
  const nextUp = active
    .filter((i) => i.status === "pre")
    .sort((a, b) => +new Date(a.kickoffAt) - +new Date(b.kickoffAt))[0];

  const run = async (matchId: string, fn: (i: { matchId: string }) => Promise<{ ok: boolean } & { error?: string }>) => {
    setBusy(matchId);
    setErr("");
    const res = await fn({ matchId });
    setBusy(null);
    if (res.ok) router.refresh();
    else setErr(res.error ?? "Error");
  };

  const ago = (iso: string) => {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    return s < 90 ? `hace ${s} s` : `hace ${Math.round(s / 60)} min`;
  };

  const syncStale = mounted && sync ? Date.now() - new Date(sync.lastRunAt).getTime() > 6 * 60_000 : false;

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold">📡 ESPN en vivo</span>
        <span className="text-xs text-muted-foreground">
          {!mounted || !sync ? (
            "…"
          ) : syncStale || !sync.ok ? (
            <span className="font-semibold text-amber-400">
              ⚠️ Sincronización {sync.ok ? "atrasada" : "con error"} · {ago(sync.lastRunAt)}
            </span>
          ) : (
            <span className="text-emerald-400">Sincronizado {ago(sync.lastRunAt)} ✓</span>
          )}
        </span>
      </div>

      {!mounted ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <div className="space-y-3">
          {live.length > 0 && (
            <div className="space-y-1">
              {live.map((i) => (
                <div key={i.matchId} className="flex items-center justify-between text-sm">
                  <span className="font-semibold">
                    <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500 align-middle" />
                    #{i.matchNumber} {name(i.homeTeam, i.providerHome)}{" "}
                    <span className="font-extrabold">
                      {i.homeScore ?? 0} - {i.awayScore ?? 0}
                    </span>{" "}
                    {name(i.awayTeam, i.providerAway)}
                  </span>
                  <span className="text-xs text-muted-foreground">{i.displayClock}</span>
                </div>
              ))}
            </div>
          )}

          {toConfirm.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-muted-foreground">
                Finales recientes — se confirman solos ~5 min después del pitazo
              </div>
              {toConfirm.map((i) => (
                <div key={i.matchId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    #{i.matchNumber} {name(i.homeTeam, i.providerHome)}{" "}
                    <span className="font-extrabold">
                      {i.homeScore} - {i.awayScore}
                    </span>{" "}
                    {name(i.awayTeam, i.providerAway)}{" "}
                    <span className="text-xs text-muted-foreground">({i.statusDetail})</span>
                  </span>
                  <button
                    onClick={() => run(i.matchId, confirmLiveResult)}
                    disabled={busy === i.matchId}
                    className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
                  >
                    {busy === i.matchId ? "…" : `Confirmar ${i.homeScore}-${i.awayScore}`}
                  </button>
                </div>
              ))}
            </div>
          )}

          {mismatched.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-destructive/40 bg-destructive/10 p-2">
              <div className="text-xs font-bold text-destructive">
                ⚠️ Nuestro resultado difiere de ESPN
              </div>
              {mismatched.map((i) => (
                <div key={i.matchId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    #{i.matchNumber} {name(i.homeTeam, i.providerHome)} vs{" "}
                    {name(i.awayTeam, i.providerAway)}: nuestro{" "}
                    <b>
                      {i.result!.homeScore}-{i.result!.awayScore}
                    </b>
                    , ESPN{" "}
                    <b>
                      {i.homeScore}-{i.awayScore}
                    </b>
                  </span>
                  <button
                    onClick={() => run(i.matchId, confirmLiveResult)}
                    disabled={busy === i.matchId}
                    className="shrink-0 rounded-lg border border-destructive px-3 py-1.5 text-xs font-bold text-destructive disabled:opacity-40"
                  >
                    Usar ESPN
                  </button>
                </div>
              ))}
            </div>
          )}

          {drifted.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2">
              <div className="text-xs font-bold text-amber-400">🕐 Horarios distintos a ESPN</div>
              {drifted.map((i) => (
                <div key={i.matchId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    #{i.matchNumber} {name(i.homeTeam, i.providerHome)} vs{" "}
                    {name(i.awayTeam, i.providerAway)}: nuestra <b>{fmtET(i.kickoffAt)}</b>, ESPN{" "}
                    <b>{fmtET(i.providerKickoffAt!)}</b>
                  </span>
                  <button
                    onClick={() => run(i.matchId, applyProviderKickoff)}
                    disabled={busy === i.matchId}
                    className="shrink-0 rounded-lg border border-amber-500 px-3 py-1.5 text-xs font-bold text-amber-400 disabled:opacity-40"
                  >
                    Usar hora ESPN
                  </button>
                </div>
              ))}
            </div>
          )}

          {live.length === 0 && toConfirm.length === 0 && mismatched.length === 0 && drifted.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Todo al día ✓
              {nextUp && (
                <>
                  {" "}
                  · Próximo: #{nextUp.matchNumber} {name(nextUp.homeTeam, nextUp.providerHome)} vs{" "}
                  {name(nextUp.awayTeam, nextUp.providerAway)}, {fmtET(nextUp.kickoffAt)}
                </>
              )}
            </p>
          )}

          {err && <p className="text-xs font-semibold text-destructive">{err}</p>}
        </div>
      )}
    </div>
  );
}
