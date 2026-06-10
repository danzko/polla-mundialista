# Handoff to Antigravity: Predict Sheet + Standings Race

This is an enhancement pass on the existing Polla Mundialista app. Two features, built on the current stack and theme. The database and scoring layer are being changed in parallel by the other agent; you consume those changes through the contract additions in section 3. Do not touch the database, migrations, RLS, the scoring engine, or the seed. Those are owned and updated separately.

## 0. Why

The match-card list is good for reviewing matches but slow for entering up to 72 group predictions, and it never tells a user what still needs predicting before kickoff. And the league standings are a static table, which hides the actual story of a six-week pool: who is climbing, who is fading, how big the gap is. Fix both.

Stack reminder (do not deviate): Next.js 15 App Router, TypeScript, Tailwind v4 with the existing tokens in `src/app/globals.css` (dark theme, pitch-green primary, gold for bonuses), shadcn/ui, next-intl (ES default, EN), react-hook-form + zod, everything through `@/lib/api`. Mobile-first, accessible, both languages authored.

## 1. Feature A: Predict Sheet (fast bulk entry)

On `/[locale]/(app)/matches`, add a view toggle between "Tarjetas" (the existing `MatchCard` list) and "Planilla" (the new sheet). Default to Planilla, persist the choice in `localStorage`.

The sheet:

- Group matches by matchday, defined as the calendar date of `kickoffAt` rendered in the active locale. One section per date.
- Section header per day shows a progress chip ("12/16 predichos") and a live countdown ("cierra en 3h 20m") to the earliest still-unlocked kickoff that day.
- One compact row per match: home flag + code, two small numeric inputs (type directly, `inputMode="numeric"`, clamp 0 to 15), away flag + code, and the lock time. Pressing Tab or Enter advances home then away then the next match's home input.
- Auto-save when both scores are filled, reusing `submitPrediction`. Show a subtle per-row saving / saved / error state, with optimistic update and rollback on failure (same behavior the `MatchCard` already implements).
- A row with exactly one score filled is marked "incompleto" so a user never believes a half-entry was saved.
- Default the screen to the next matchday that still has unlocked matches, with quick jumps to other days. Locked, voided, and past matches are read-only. TBD knockout slots (null team) are not predictable.

Data: existing `getMatches()` and `submitPrediction()`. No backend change. Derive matchday and countdown from `kickoffAt` and `locked` on `MatchView`.

## 2. Feature B: Standings Race (who is leading)

On the league page `/[locale]/(app)/leagues/[id]`, upgrade the standings tab to three stacked pieces, mobile-first and readable at 360px:

1. Standings table (the anchor): rank, initials avatar, name, total points, the exact and result counts that drive tiebreakers, the current user's row highlighted in the primary green, and a movement arrow (up, down, or flat) showing rank change since the previous matchday. Compute movement client-side from the race series in section 3 (rank at the last matchday vs the one before). Use the corrected match and bonus split (see 3.2).
2. A cumulative-points race chart over matchdays: one line per member, the current user's line emphasized in primary green and the rest muted, a minimal legend, x axis is matchdays. Use a dependency-free inline SVG, or Chart.js from cdnjs if you prefer. It must stay legible on a phone.
3. A personal gap line and a points-in-play note: for example "2o, a 7 pts del lider, +3 sobre el siguiente", and a line stating that bonus points (up to 62) score only at the end of the tournament and are still in play. The gap comes from the standings table, the bonus total is a fixed max you can hardcode as a constant.

## 3. Contract additions you must make

The other agent is updating the database so that, by the time you wire this up:

- `leaderboard_view` returns these columns: `user_id`, `display_name`, `match_points`, `bonus_points`, `total_points` (which equals match plus bonus), `exact_count`, `result_count`, `wrong_count`, `first_prediction_at`.
- a new view `leaderboard_matchday` returns, per user per day: `user_id`, `match_day` (a date), `cumulative_points` (cumulative match points through that day).

Make exactly these code changes, nothing else in `api.ts` should change.

### 3.1 Add to `src/lib/types.ts`

```ts
export interface RaceSeriesPoint {
  matchDay: string;          // ISO date, 'YYYY-MM-DD'
  cumulativePoints: number;
}

export interface RaceSeries {
  userId: string;
  displayName: string;
  isMe: boolean;
  points: RaceSeriesPoint[];
}

export interface LeagueRace {
  matchDays: string[];       // sorted unique ISO dates
  series: RaceSeries[];
}
```

And add one optional field to the existing `LeaderboardRow`:

```ts
  movement?: number;         // rank change since previous matchday; positive = moved up
```

### 3.2 Fix the mapping in `getLeague` (in `src/lib/api.ts`)

The current code hardcodes `bonusPoints: 0` and sets both `totalPoints` and `matchPoints` to `total_points`. Replace those three fields in the leaderboard row mapping with:

```ts
        matchPoints: score?.match_points ?? 0,
        bonusPoints: score?.bonus_points ?? 0,
        totalPoints: score?.total_points ?? 0,
```

Keep the existing tiebreaker sort (total, then exact_count, then result_count, then first_prediction_at).

### 3.3 Add `getLeagueRace` to `src/lib/api.ts`

Paste this function as-is. It mirrors the member-fetch pattern already used by `getLeague`.

```ts
export async function getLeagueRace(leagueId: string): Promise<LeagueRace> {
  const empty: LeagueRace = { matchDays: [], series: [] };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return empty;

    const { data: members } = await supabase
      .from("league_members")
      .select("user_id, users(display_name)")
      .eq("league_id", leagueId);
    if (!members || members.length === 0) return empty;

    const memberIds = members.map((m) => m.user_id);
    const nameById = new Map<string, string>(
      members.map((m) => [m.user_id, (m.users as any)?.display_name || "Usuario"])
    );

    const { data: rows } = await supabase
      .from("leaderboard_matchday")
      .select("user_id, match_day, cumulative_points")
      .in("user_id", memberIds)
      .order("match_day", { ascending: true });
    if (!rows) return empty;

    const matchDays = Array.from(new Set(rows.map((r) => r.match_day as string))).sort();

    const byUser = new Map<string, RaceSeriesPoint[]>();
    for (const r of rows) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push({ matchDay: r.match_day as string, cumulativePoints: r.cumulative_points as number });
      byUser.set(r.user_id, arr);
    }

    const series: RaceSeries[] = memberIds.map((id) => ({
      userId: id,
      displayName: nameById.get(id) || "Usuario",
      isMe: id === user.id,
      points: byUser.get(id) ?? [],
    }));

    return { matchDays, series };
  } catch (err) {
    console.error("Error in getLeagueRace:", err);
    return empty;
  }
}
```

Remember to import the new types (`LeagueRace`, `RaceSeries`, `RaceSeriesPoint`) at the top of `api.ts`.

## 4. While you are in here (small, your lane)

Two quick fixes worth doing in the same pass:

- Invite code generation in `createLeague` uses `Math.random().toString(36).substring(2, 8)`, which can occasionally produce fewer than 6 characters (which then fails your own `length(6)` validation) and has no collision handling. Replace it with a guaranteed 6-character generator over an unambiguous alphabet (no O/0/I/1), and retry on a unique-constraint violation.
- Add `vitest` to `devDependencies` and a `"test": "vitest run"` script so the existing `tests/scoring.test.ts` suite actually runs.

## 5. Constraints and do-not-touch

- Keep every existing `@/lib/api` signature unchanged. Only add `getLeagueRace` and fix the three mapped fields in `getLeague`.
- Do not edit anything under `supabase/`, `src/lib/scoring/`, `src/lib/db/schema.ts`, RLS, or the seed. The database and scoring are owned by the other agent and are being updated in parallel. If a column you expect is missing, the database migration has not landed yet, so flag it rather than rebuilding it yourself.
- Author all new user-facing strings in both `src/messages/es.json` and `src/messages/en.json`. No hardcoded strings.
- No new global state manager. React state plus the existing patterns.
- Preserve the existing theme tokens in `globals.css`.

## 6. Deliverables

The matches page with a working Cards/Planilla toggle and the dense sheet, the league standings upgraded to table plus race chart plus gap line, the type and `api.ts` additions from section 3, the two small fixes from section 4, ES and EN copy for everything new, and a short note listing any component props worth knowing.
