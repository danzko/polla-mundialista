"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { recordResult, clearResult, setVoided } from "./actions";

interface Team {
  code: string;
  nameEs: string;
  flagEmoji: string;
}

export interface RowMatch {
  id: string;
  matchNumber: number;
  stage: string;
  groupLabel: string | null;
  kickoffAt: string;
  isVoided: boolean;
  homeTeam: Team | null;
  awayTeam: Team | null;
  result: { homeScore: number; awayScore: number } | null;
}

export function ResultRow({ match, locale }: { match: RowMatch; locale: string }) {
  const router = useRouter();
  const [home, setHome] = React.useState(match.result ? String(match.result.homeScore) : "");
  const [away, setAway] = React.useState(match.result ? String(match.result.awayScore) : "");
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = React.useState("");

  const hasTeams = Boolean(match.homeTeam && match.awayTeam);

  const save = async () => {
    if (home === "" || away === "") {
      setStatus("error");
      setMsg("Completa ambos marcadores");
      return;
    }
    setStatus("saving");
    setMsg("");
    const res = await recordResult({
      matchId: match.id,
      homeScore: Number(home),
      awayScore: Number(away),
    });
    if (res.ok) {
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
      setMsg(res.error);
    }
  };

  const clear = async () => {
    setStatus("saving");
    const res = await clearResult({ matchId: match.id });
    if (res.ok) {
      setHome("");
      setAway("");
      setStatus("idle");
      router.refresh();
    } else {
      setStatus("error");
      setMsg(res.error);
    }
  };

  const toggleVoid = async () => {
    const res = await setVoided({ matchId: match.id, voided: !match.isVoided });
    if (res.ok) router.refresh();
    else {
      setStatus("error");
      setMsg(res.error);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "es" ? "es-ES" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const stageLabel =
    match.stage === "group" ? `Grupo ${match.groupLabel || ""}` : match.stage.toUpperCase();

  return (
    <div
      className={`rounded-xl border border-border bg-card p-3 ${
        match.isVoided ? "opacity-50" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-bold">
          #{match.matchNumber} · {stageLabel}
        </span>
        <span>{fmt(match.kickoffAt)}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 truncate text-right text-sm font-semibold">
          {match.homeTeam ? `${match.homeTeam.flagEmoji} ${match.homeTeam.nameEs}` : "TBD"}
        </div>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={30}
          value={home}
          onChange={(e) => setHome(e.target.value)}
          disabled={!hasTeams || match.isVoided}
          className="h-9 w-12 rounded-lg border border-border bg-input text-center font-bold text-foreground disabled:opacity-40"
        />
        <span className="text-xs text-muted-foreground">-</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={30}
          value={away}
          onChange={(e) => setAway(e.target.value)}
          disabled={!hasTeams || match.isVoided}
          className="h-9 w-12 rounded-lg border border-border bg-input text-center font-bold text-foreground disabled:opacity-40"
        />
        <div className="flex-1 truncate text-left text-sm font-semibold">
          {match.awayTeam ? `${match.awayTeam.nameEs} ${match.awayTeam.flagEmoji}` : "TBD"}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={!hasTeams || match.isVoided || status === "saving"}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
          >
            Guardar
          </button>
          {match.result && (
            <button
              onClick={clear}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
            >
              Borrar
            </button>
          )}
          <button
            onClick={toggleVoid}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
          >
            {match.isVoided ? "Reactivar" : "Anular"}
          </button>
        </div>
        <span className="text-xs font-semibold">
          {status === "saving" && <span className="text-primary">Guardando…</span>}
          {status === "saved" && <span className="text-emerald-400">Guardado ✓</span>}
          {status === "error" && <span className="text-destructive">{msg}</span>}
        </span>
      </div>
    </div>
  );
}
