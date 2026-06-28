# HANDOFF — Polla Mundialista 2026 (knockout bracket build)

Written for the next coding agent. Read this top to bottom before touching
anything. It tells you what the app is, what's live, what was just built, the
**new scoring spec that supersedes the placeholder numbers in the code**, the
two uncommitted/undeployed things you must finish, and the gotchas that have
bitten us repeatedly.

Pair this with `CLAUDE.md` (project canon) and `docs/HANDOFF-MYTHOS.md` (older
decisions). Where this file and CLAUDE.md disagree about scoring, **this file +
`docs/wc2026_pool_scoring_spec.md` win** (the spec is newer).

---

## 0. TL;DR — what to do next (in order)

1. **Commit + deploy the edge-function change that's already written but NOT
   live.** `supabase/functions/live-scores-sync/index.ts` has uncommitted
   AUTO-ASSIGN code (real 32 teams → knockout matches + record advancers). The
   **live deployed function is still the older version without it.** See §4.1.
2. **Re-do bracket scoring to match the new spec** `docs/wc2026_pool_scoring_spec.md`
   (v1.1). The numbers currently in `src/lib/bracket-scoring.ts` are
   placeholders from before the spec and are **wrong** vs the spec. See §4.2.
3. **Wire bracket scoring into the leaderboard** (today it isn't scored at all,
   and group/knockout-match scoring in the live view is still the old model).
   See §4.3.
4. Resolve the **champion double-count question** with the owner before shipping
   scoring. See §4.2 ⚠️.

Everything ships by **git push to `main`** (Vercel auto-deploys). DB + edge
functions go through the **Supabase MCP tools**, not the CLI (no CLI installed).

---

## 1. What this is

Bilingual (ES default / EN) World Cup 2026 prediction pool, **live in
production** with a real group of ~30+ friends across 3 small leagues.

- **Prod:** https://polla-mundialista-puce.vercel.app
- **Repo:** GitHub `danzko/polla-mundialista`, branch `main` → Vercel
  auto-deploys on push.
- **Stack:** Next.js 16 (App Router, Turbopack, RSC + Server Actions), React 19,
  Tailwind v4, shadcn/ui, next-intl (`/es`, `/en`), Supabase (Postgres + Auth +
  RLS), Drizzle (schema authority).
- **Owner:** Danny. App superadmin account is **daniel.zambrano@gmail.com**
  (display name "Danny"). His Claude/contact email is danzko@gmail.com but that
  app account was deleted during account consolidation — do not resurrect it.

### Infra IDs
- Supabase project ref: **`nsaajzmtzotwjpbfwyad`** (use with the Supabase MCP
  tools: `apply_migration`, `execute_sql`, `deploy_edge_function`, `get_advisors`…).
- Vercel: team `team_HgIjubDGVPZ50oTEhhzc7xye`, project
  `prj_3YXMom0inJGqC8widgcXVHWKY9Ar`.
- `.env.local` holds DATABASE_URL + service-role key for node scripts.

### How to ship / verify (no Supabase CLI is installed)
- **App code:** `npx next build` to verify, then `git commit && git push origin main`.
  Confirm deploy READY via the Vercel MCP `list_deployments`.
- **DB:** Supabase MCP `apply_migration` (DDL) / `execute_sql`. Mirror every
  migration into `supabase/migrations/000N_*.sql` for the record.
- **Edge function:** Supabase MCP `deploy_edge_function` with the file contents
  inline (project_id, name `live-scores-sync`, verify_jwt true). There is **no
  CLI**; the inline-content deploy is the only path used here.
- **Tests:** `npx vitest run` (scoring engines have unit tests).

---

## 2. Current production state (group stage, working)

- Magic-link auth, onboarding, create/join leagues (invite-code join via
  `lookup_league_by_invite_code` SECURITY DEFINER RPC).
- **Group stage:** per-match score predictions, **locked per match 15 min before
  kickoff** (RLS migration 0010 + server actions + UI). Scoring 6/2/0
  (exact/result/wrong). This is done; tournament is deep into the group stage.
- **Tournament picks** (`bonus_predictions`): champion / top scorer / best player,
  locked since June 11. **Champion currently pays 50 pts** via this pre-tournament
  pick. ⚠️ The new bracket spec also scores CHAMPION (55) — see §4.2.
- **Live scores + results automation** — ESPN public scoreboard is the source of
  truth. `live-scores-sync` edge function polls every 2 min (pg_cron job
  `live-scores-sync-2min` + pg_net), stages into `live_scores` + `live_sync_state`
  heartbeat. AUTO-CONFIRM finals into `match_results` (source `espn-auto`), and
  AUTO-HEAL kickoff drift. `/admin` has the live panel + one-tap confirm.
- **Matches page** = mobile-first chronological **timeline feed** with live
  scores (polls every 30s), date chips, auto-scroll to "now".
- **Contestant pick strips** under each started game show every league-mate's
  pick (gold=on track for exact, green=for result, red=out, dim "sin jugar" for
  non-pickers), judged live. Scope = **the viewer's leagues only** (this was a
  repeated bug — see §6). The pick query is **paginated** (PostgREST 1000-row cap
  was truncating — see §6).

---

## 3. The knockout bracket — what was just built (this is the active feature)

Goal: a separate **Bracket tab**. The real 32 populate from results (no invented
logic). Players fill the bracket round by round (pick who advances + score),
winners auto-advance, **locks at the first R32 kickoff**. Scoring rewards getting
the *shape* of the bracket right, dominating lucky group-stage scores.

### Built & committed (HEAD = `3bcb538`)
- **`src/lib/bracket.ts`** — the FIFA bracket tree, matches 73–104, with
  winner/loser feeds (`W74`, `L101`), `ROUND_ORDER`, `roundOf`, `parseFeed`,
  `resolveSide`. This is THE advancement logic; it is correct and validated
  against `scripts/wc2026-bracket-structure.json`. Don't reinvent it.
- **`src/lib/bracket-scoring.ts`** — `BRACKET_SCORING` config object + pure
  `scoreBracket()` (set-based, path-independent) + 5 vitest tests
  (`tests/bracket-scoring.test.ts`). ⚠️ **The numbers here are placeholders and
  do NOT match the new spec — you must update them (§4.2).**
- **migration 0014** (`supabase/migrations/0014_bracket_picks.sql`, applied live):
  - `bracket_picks` table: `(user_id, match_id)` PK, `advancer_team_id`,
    `home_score`, `away_score`. RLS: read own / read-all-after-lock / superadmin;
    write only before lock, knockout matches only.
  - `match_results.advanced_team_id` — who actually advanced (penalty winners).
  - `bracket_lock_at()` SECURITY DEFINER = `min(kickoff_at)` of `stage='r32'`;
    RLS uses it so the lock auto-tracks the real first-R32 kickoff.
- **`src/lib/api.ts`** — `getBracket()` (KO matches + your picks + lock state) and
  `submitBracket()` (RLS-enforced lock).
- **`src/app/[locale]/(app)/bracket/`** — `page.tsx` + `BracketBoard.tsx`:
  round-by-round **stepper** (tap who advances = handles penalties; optional
  score; later rounds auto-derive participants from your earlier winners;
  champion callout) + a read-only **ladder view** ("Ver llave") + graceful
  "not open yet" (until the 32 are assigned) and "locked" states.
- **Nav** item "Llave / Bracket" added (`AppShell.tsx`, `nav.bracket` in
  `src/messages/{es,en}.json`).

### Data-model mapping (important for scoring)
`bracket_picks` stores, per knockout match: `advancer_team_id` (who the player
says goes through — this is the spec's `pred_winner`) and `home_score`/`away_score`
(the spec's `pred_goals`, oriented to the bracket tree's home/away slots). The
player's predicted "teams reaching round X" = the advancers of that round's
feeder matches (derive via the tree). Real advancers come from
`match_results.advanced_team_id` (penalty-safe) and real scores from
`match_results.home_score/away_score`.

---

## 4. What you must finish

### 4.1 ⛳ Deploy the AUTO-ASSIGN edge-function change (uncommitted + undeployed)

`git status` shows `supabase/functions/live-scores-sync/index.ts` **modified but
not committed**, and the **deployed** function does not yet include it. The change
adds, after the existing auto-confirm/auto-heal blocks:
- AUTO-ASSIGN: when ESPN reveals the real 32 (its abbreviations == our FIFA team
  codes), fill the knockout matches' `home_team_id`/`away_team_id` — **fill-only**
  (only when both are still null; never overwrites an assigned matchup).
- Records `match_results.advanced_team_id` for completed KO games (ESPN flags the
  winner incl. shootouts; `homeC.winner === true`).

**Do this:** review the diff, then **deploy via Supabase MCP
`deploy_edge_function`** (name `live-scores-sync`, `verify_jwt: true`, full file
contents inline), then **commit** the file. It is inert until groups conclude and
ESPN swaps placeholder slots ("2A", "3:A/B/C/D/F") for real team codes — which
happens ~June 27. Deploy it **before** then. After it runs you can verify with
`execute_sql`: knockout matches 73–88 should get real `home_team_id`/`away_team_id`,
which flips the Bracket tab from "not open yet" to fillable.

> Why it wasn't deployed: the session was about to deploy when interrupted. The
> inline-content deploy is large; copy the file contents exactly — a transcription
> slip would break the live sync mid-tournament. Consider `deno check` mentally /
> re-read before deploying.

### 4.2 🎯 Re-do bracket scoring to match the NEW spec (`docs/wc2026_pool_scoring_spec.md`, v1.1)

The owner provided a formal scoring spec that **supersedes** the placeholder
numbers in `src/lib/bracket-scoring.ts`. Align the engine to it. Differences:

| Thing | Current code (placeholder) | **Spec v1.1 (use this)** |
|---|---|---|
| Advancement R16 | 3 | **4** |
| Advancement QF | 6 | **8** |
| Advancement SF | 12 | **16** |
| Advancement Final | 24 | **30** |
| **Champion** | not in bracket (separate 50 pick) | **55, scored in the bracket** (stacks: 4+8+16+30+55=113) |
| Correct-result bonus | not implemented | **+3 if `pred_winner==winner`, excluded in R32**, all other rounds incl. THIRD |
| Exact-score bonus | flat 3 | **R32=2, all other rounds=1** |
| Third-place match | `thirdPlace:25` flat | **scored as a normal bonus match** (result +3, exact +1; max 4). Optional dedicated podium bracket bonus `THIRD_PLACE_PTS` default **0**. |
| Perfect max | ~217 | **403** (bracket 307 + result 48 + exact 48) |

The spec is self-contained with pseudocode (§4), edge cases (§5), invariants
(§6), and **13 test vectors (§7)** — port those into
`tests/bracket-scoring.test.ts` and make them pass. Keep all weights in one
config object so the owner can still tune them (he explicitly wants to play with
weights; `groupWeight` dial too).

⚠️ **CHAMPION DOUBLE-COUNT — get an owner decision before shipping.** The spec
scores the champion **inside the bracket (55)**. The app **already** pays the
champion **50** via the separate pre-tournament `bonus_predictions` pick. Left
as-is that's **double counting** (50 + 55). Options to put to Danny:
(a) bracket champion 55 only, drop/zero the old 50 bonus champion;
(b) keep the 50 bonus pick, set bracket CHAMPION to 0 (diverges from spec total);
(c) intentionally keep both. The spec author seems to intend the bracket to be
self-contained (a). **Do not ship scoring until this is decided.**

Also reconcile the spec's "match_predictions are on the **actual fixtures**,
scored independently of bracket correctness" with our storage (scores tied to the
player's predicted matchup in `bracket_picks`). For R32 the matchup is fixed so
it's moot; for later rounds, exact/result bonuses only apply when the player's
predicted matchup equals the actual one. Confirm this is acceptable or adjust the
data capture. (The current `scoreBracket()` already gates the exact bonus on
matchup equality via enriched picks.)

### 4.3 📊 Wire bracket scoring into the leaderboard

Today nothing surfaces bracket points. The live `leaderboard_view` + the TS
engine (`src/lib/scoring/calculate-points.ts`) still use the OLD model (group
6/2/0 plus a stale knockout-match `x2` and legacy team bonuses that are not the
official rules). You need to:
- Compute each player's bracket points (per §4.2 spec) from `bracket_picks` +
  real results (`match_results` incl. `advanced_team_id`) via the bracket tree.
- Add it to each player's total alongside group points (apply `groupWeight` if the
  owner wants to de-weight groups — he asked for the bracket to dominate).
- Tiebreaker: knockout-stage points (per CLAUDE.md).
- Decide: compute in a Postgres view (consistent with `leaderboard_view`) or in
  TS and store/merge. A TS computation reusing `scoreBracket()` is simplest and
  already unit-tested; a view is more consistent with current architecture. Either
  is fine — just make the leaderboard reflect bracket points before June 28.

This MUST land before the first R32 game (≈ June 28) or knockout results will
score wrong/zero.

### 4.4 Smaller follow-ups
- **Admin override** for assigning the 32 (fallback if ESPN is wrong/late) — there
  is no UI to set knockout teams; only the auto-assign + raw SQL. Nice to have.
- **Verify the Bracket tab on a real phone** — the agent that built it could not
  load the authed page (auth-gated), so it was build-verified only. Check the
  round tabs, tap-to-advance, the ladder view, and lock/closed states on mobile.
- Bracket **score precision UI**: the stepper collects scores; confirm they map to
  `pred_goals` correctly per the spec's orientation rules.

---

## 5. Repo map (knockout-relevant)

```
src/lib/bracket.ts                 # FIFA bracket tree + helpers (correct, keep)
src/lib/bracket-scoring.ts         # tunable weights + scoreBracket() (UPDATE to spec)
tests/bracket-scoring.test.ts      # port spec §7 test vectors here
src/lib/api.ts                     # getBracket(), submitBracket(), getMatchPicks(), getLiveScores(), ...
src/app/[locale]/(app)/bracket/    # page.tsx + BracketBoard.tsx (stepper + ladder)
supabase/migrations/0014_bracket_picks.sql
supabase/functions/live-scores-sync/index.ts   # AUTO-ASSIGN uncommitted+undeployed (§4.1)
scripts/wc2026-bracket-structure.json          # validated bracket tree source
docs/wc2026_pool_scoring_spec.md               # THE scoring spec (v1.1) — source of truth
CLAUDE.md                          # project canon (older scoring notes are superseded by the spec)
```

Migrations history: 0001 initial → … → 0010 per-match lock → 0011 bonus unlock +
users write hardening → 0012 reveal picks at kickoff → 0013 one-time name change →
**0014 bracket picks**. Mirror any new DDL into `supabase/migrations/`.

---

## 6. Gotchas that have bitten us (read these)

- **PostgREST caps responses at 1000 rows.** Cross-user/cross-match reads silently
  truncate. `getMatchPicks` was dropping picks until paginated with `.range()`.
  The bracket scoring read (all users × 32 KO matches) WILL exceed 1000 — paginate.
- **Pick/score visibility scope = the viewer's leagues only.** We shipped a bug
  showing the whole pool (strangers); reverted. Bracket picks have the same
  requirement — reveal others' brackets only after lock, and only league-mates.
- **Test RLS by simulating the real role**, not as admin (admin bypasses RLS and
  hides scope bugs): `set local role authenticated; select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true);`
  then run the exact app query. The superadmin account sees everything by policy.
- **`"use server"` files export only async functions** — constants live elsewhere
  (e.g. `src/lib/tournament.ts`, `src/lib/bracket-scoring.ts`).
- **RLS + column grants are different layers.** A past hole let any user set
  `is_superadmin` because table-wide UPDATE was granted (RLS only checks rows, not
  columns). When adding privileged columns, scope GRANTs (migration 0011).
- **SECURITY DEFINER + `set search_path = public, pg_temp`** for any helper a
  policy calls (`bracket_lock_at`, `is_superadmin`, `lookup_league_by_invite_code`,
  `soft_delete_league`). Supabase advisors flag these as warnings — accepted.
- **Hydration:** anything timezone/`Date.now()`-dependent must render after a
  `mounted` gate (kickoff times, "today" highlighting). Don't compute them during SSR.
- **Edge function deploy is inline-content via MCP** (no CLI). Be exact.
- **Auto-everything is intentional.** Results auto-confirm, kickoff times
  auto-heal, knockout teams auto-assign — all fill-only, never overwriting human
  input. Keep that philosophy; the only manual act is overriding a human-entered
  result via the `/admin` mismatch alert.

---

## 7. Open owner decisions (pending Danny)
- **Champion double-count** (§4.2 ⚠️) — must resolve before scoring ships.
- **Group weighting** — does the bracket fully dominate (e.g. `groupWeight < 1`),
  or do groups stay at full value? He wanted the bracket to decide the winner;
  the spec's 403 bracket max already dwarfs group spread, so `groupWeight = 1` may
  be fine. Confirm.
- Final tuning of all bracket weights once he sees it with real data.

---

## 8. Timeline context
- Group stage essentially complete; knockouts start **≈ June 28**.
- Bracket entry window: after groups conclude (~June 27) until the first R32
  kickoff, when it locks.
- **Critical path before June 28:** (4.1) deploy auto-assign, (4.2) correct
  scoring to spec, (4.3) wire it into the leaderboard. If those three aren't done,
  the bracket can't be filled and/or won't score.

Good luck. Verify with `npx next build` + `npx vitest run`, ship via push, and
confirm deploys READY through the Vercel MCP.
