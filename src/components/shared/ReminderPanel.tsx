"use client";

import * as React from "react";
import type { ReminderStatus } from "@/lib/types";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { timeZone: "America/New_York", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

/** Superadmin: who still has picks to make, plus ready-to-paste WhatsApp nudges. */
export function ReminderPanel({ status }: { status: ReminderStatus }) {
  const [includeIdle, setIncludeIdle] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);
  const { round, lockAt, members } = status;

  const idle = (m: (typeof members)[number]) => !m.onBoard && m.picks === 0 && !m.hasChampion && !m.hasTop8;
  const pool = members.filter((m) => includeIdle || !idle(m));
  const missingGames = round ? pool.filter((m) => m.picks < round.openGames) : [];
  const missingSeason = lockAt && new Date(lockAt) > new Date()
    ? pool.filter((m) => !m.hasChampion || (status.isUcl && !m.hasTop8))
    : [];

  const origin = () => (typeof window !== "undefined" ? window.location.origin : "");

  const matchdayText = round
    ? `⚽ *${round.label}* arranca ${fmt(round.firstKickoff)} (hora ET).\n\nTodavía les faltan pronósticos a: ${missingGames.map((m) => m.name).join(", ") || "nadie 🎉"}.\n\nCada partido se cierra 15 minutos antes del pitazo. Entren aquí: ${origin()}/es/matches`
    : "";
  const seasonText = lockAt
    ? `🏆 Los picks de temporada (campeón, goleador, mejor jugador y Top 8) cierran ${fmt(lockAt)} (hora ET).\n\nFalta: ${missingSeason.map((m) => m.name).join(", ") || "nadie 🎉"}.\n\nEntren aquí: ${origin()}/es/bonuses`
    : "";

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copia este mensaje:", text);
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  const btn = "rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40";

  return (
    <details className="mb-6 rounded-xl border bg-card p-4" open>
      <summary className="cursor-pointer text-sm font-semibold">
        Recordatorios · {status.tournamentName}
        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${status.emailReady ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>
          {status.emailReady ? "correo activo" : "correo apagado"}
        </span>
      </summary>

      <div className="mt-3 space-y-3 text-sm">
        {!status.emailReady && (
          <p className="text-muted-foreground">
            El correo automático está apagado (faltan BREVO_API_KEY, EMAIL_FROM o CRON_SECRET en Vercel). Mientras tanto, copia el mensaje para WhatsApp.
          </p>
        )}

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeIdle} onChange={(e) => setIncludeIdle(e.target.checked)} />
          Incluir a quienes nunca han jugado
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="font-medium">{round ? `${round.label}: faltan ${missingGames.length}` : "Sin ronda próxima"}</div>
            <div className="mb-2 text-xs text-muted-foreground">{missingGames.map((m) => `${m.name} (${m.picks}/${round?.openGames})`).join(", ") || "—"}</div>
            <button className={btn} disabled={!round} onClick={() => copy("md", matchdayText)}>
              {copied === "md" ? "¡Copiado!" : "Copiar mensaje de jornada"}
            </button>
          </div>
          <div className="rounded-lg border p-3">
            <div className="font-medium">{lockAt ? `Picks de temporada: faltan ${missingSeason.length}` : "Sin cierre de picks"}</div>
            <div className="mb-2 text-xs text-muted-foreground">{missingSeason.map((m) => m.name).join(", ") || "—"}</div>
            <button className={btn} disabled={!lockAt || missingSeason.length === 0} onClick={() => copy("sp", seasonText)}>
              {copied === "sp" ? "¡Copiado!" : "Copiar mensaje de picks"}
            </button>
          </div>
        </div>

        {members.some((m) => !m.emailsOn) && (
          <p className="text-xs text-muted-foreground">Sin correos (se dieron de baja): {members.filter((m) => !m.emailsOn).map((m) => m.name).join(", ")}</p>
        )}
      </div>
    </details>
  );
}
