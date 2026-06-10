# Handoff 3: Prediction entry redesign (default 0-0 + explicit per-phase lock-in)

Based on live testing. Keep the existing `MatchCard` look and the dark theme. This changes the entry behavior, not the visual design. Supersedes the "predict sheet" idea from handoff 2 (the user likes the cards, so we keep them).

## Settled decisions

- Scores default to 0, never blank. Every open match shows 0-0 (or the user's saved value).
- No silent auto-save. Predictions commit only on an explicit "Guardar" (lock-in).
- One save per phase: the whole group stage is a single form with one lock-in. Then bonuses. Then the knockout bracket (later, with the bracket build).
- It must be obvious what is being locked: a live count, an unsaved-changes indicator, a confirm summary, a saved confirmation, and the reassurance that any match stays editable until it kicks off.

## A. ScoreStepper and MatchCard

`ScoreStepper`: default value 0 (not null), always renders a number, minus disabled at 0, plus disabled at 15. Direct typing still clamps 0 to 15.

`MatchCard`: remove the auto-save behavior entirely. The card no longer calls `onSubmitPrediction`, no per-card saving/saved/error indicator, and no `useEffect` that submits. Make it controlled: it takes the current `homeScore`/`awayScore` and an `onChange(matchId, home, away)` callback, and reports edits up to the parent phase form. Keep everything else (flags, stage badge, knockout x2, the locked/result/points display) as is. Note the spacing fix below applies here too.

Locked matches (kickoff passed or `isVoided`) stay read-only: show the saved prediction, the result, and points earned, and exclude them from the editable set.

## B. Spacing fix (do this while in MatchCard)

The current 7-column grid crams both steppers plus "VS" into the middle 3 columns, so on a phone the steppers overflow and the team flags render on top of the minus/plus buttons. Fix by giving the scores their own full-width row under the team row: row 1 is home team | VS | away team (flags, names, codes), row 2 is a centered, roomy [home stepper] [VS] [away stepper]. Same card, same style, no overlap.

## C. Group-stage phase form (the matches screen)

- Render all still-open group matches (kickoff in the future) as editable cards defaulting to 0-0 or the saved value. Past/locked matches go in a separate read-only "Ya jugados" section.
- Sticky footer bar: a summary like "72 partidos · N sin guardar" and a primary button "Guardar pronosticos (N)". Disable the button when nothing has changed.
- Track which matches differ from their last saved value; that drives the count and the button state.
- On press, show a brief confirm ("Vas a guardar N pronosticos. Puedes editar cualquier partido hasta que empiece."), then call `submitPredictions` once. Show a success toast and refresh saved state. If any match was locked mid-edit, surface which ones were skipped.
- A phase progress header: Grupos, Bonos, Eliminatorias (proximamente). For launch only Grupos and Bonos are active. Make the current phase and completion obvious, building toward a "porra completa" feel.

## D. Backend: batch save (add to `src/lib/api.ts`)

Add this server action. It validates every score, enforces the kickoff/void lock server-side, upserts in one batch, and reports how many saved and which were skipped. Keep the existing `submitPrediction` too.

```ts
export async function submitPredictions(
  input: { predictions: { matchId: string; homeScore: number; awayScore: number }[] }
): Promise<ActionResult<{ saved: number; skipped: string[] }>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado / Not authenticated" };

    for (const p of input.predictions) {
      if (!scoreSchema.safeParse(p.homeScore).success || !scoreSchema.safeParse(p.awayScore).success) {
        return { ok: false, error: "Marcador invalido / Invalid score (0-15)" };
      }
    }

    const ids = input.predictions.map((p) => p.matchId);
    const { data: matches } = await supabase
      .from("matches")
      .select("id, kickoff_at, is_voided")
      .in("id", ids);

    const now = Date.now();
    const openIds = new Set(
      (matches ?? [])
        .filter((m) => !m.is_voided && new Date(m.kickoff_at).getTime() > now)
        .map((m) => m.id)
    );

    const rows = input.predictions
      .filter((p) => openIds.has(p.matchId))
      .map((p) => ({
        user_id: user.id,
        match_id: p.matchId,
        home_score: p.homeScore,
        away_score: p.awayScore,
        updated_at: new Date().toISOString(),
      }));
    const skipped = input.predictions.filter((p) => !openIds.has(p.matchId)).map((p) => p.matchId);

    if (rows.length > 0) {
      const { error } = await supabase.from("predictions").upsert(rows);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true, data: { saved: rows.length, skipped } };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al guardar / Error saving" };
  }
}
```

`scoreSchema` is already in `src/lib/validation.ts`. The same phase-form pattern (default values, one explicit save) will be reused later for the knockout bracket.

## E. Coming next from the other agent (do not build yet)

- Bonuses become three Golden Boot and three Golden Ball entries (Excel parity), as autocomplete inputs backed by a player list. The database change and the updated `submitBonuses` shape and types will be sent once the player dataset is ready. Leave the current single fields until then.

## Constraints

- Keep every existing `@/lib/api` signature; only add `submitPredictions`.
- Do not touch `supabase/`, scoring, RLS, or the seed.
- Author new strings in both `es.json` and `en.json`.
- Preserve the theme tokens in `globals.css`.
