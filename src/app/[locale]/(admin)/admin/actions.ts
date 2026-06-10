"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, ok: false as const, error: "No autenticado" };
  }
  const { data: profile } = await supabase
    .from("users")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_superadmin) {
    return { supabase, user, ok: false as const, error: "No autorizado" };
  }
  return { supabase, user, ok: true as const };
}

export async function recordResult(input: {
  matchId: string;
  homeScore: number;
  awayScore: number;
}): Promise<ActionResult> {
  const auth = await requireSuperadmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const h = Math.trunc(Number(input.homeScore));
  const a = Math.trunc(Number(input.awayScore));
  if (!Number.isFinite(h) || !Number.isFinite(a) || h < 0 || a < 0 || h > 30 || a > 30) {
    return { ok: false, error: "Marcador invalido (0-30)" };
  }

  const { error } = await auth.supabase.from("match_results").upsert({
    match_id: input.matchId,
    home_score: h,
    away_score: a,
    recorded_by: auth.user!.id,
    recorded_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function clearResult(input: { matchId: string }): Promise<ActionResult> {
  const auth = await requireSuperadmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await auth.supabase
    .from("match_results")
    .delete()
    .eq("match_id", input.matchId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setVoided(input: {
  matchId: string;
  voided: boolean;
}): Promise<ActionResult> {
  const auth = await requireSuperadmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await auth.supabase
    .from("matches")
    .update({ is_voided: input.voided })
    .eq("id", input.matchId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
