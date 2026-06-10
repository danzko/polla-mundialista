# Continuation handoff: Polla Mundialista 2026

For a capable successor (codename: mythos), taking over after Antigravity finishes the entry-redesign work in `docs/antigravity-handoff-3-entry-redesign.md`. You can read the codebase yourself, so this captures only what you cannot derive from the repo: the corrected mental model, live state, the decisions already made and why, the bracket design intent, the gotchas, and the access reality. Trust your own judgment past this.

Owner: Danny (danzko@gmail.com). Timeframe: today is ~June 10 2026. Tournament kicks off June 11. Group stage June 11 to 27, knockouts June 28 to July 19. Bonus picks lock at first kickoff, June 11 19:00 UTC (hardcoded in RLS and in `api.ts`). So group-stage entry and the pre-tournament picks are the only launch-critical surfaces; the knockout bracket is not needed until June 28.

## 1. The one correction that overrides the PRD

`docs/PRD.md` and `CLAUDE.md` describe a scoreline pool and explicitly list bracket-style as a non-goal. That was wrong about what the owner's group actually wants. The pool they have run for years is the "Excel Mundial" (a video transcript of it is in the conversation history), which is a full predictive bracket: you predict every match score, group tables rank themselves from your scores, the qualified teams (top 2 per group plus the 8 best third-placed teams) propagate into your Round of 32, knockout winners propagate all the way to a derived champion, and you also enter three top scorers and three best players. The owner chose "make it as the Excel." So the target is a predictive bracket pool, phased: ship group-stage entry plus picks for June 11, build the real bracket during the group stage and ship before June 28.

## 2. Current state

Built and deployed (production at `polla-mundialista-puce.vercel.app`):
- Full bilingual (ES default, EN) frontend: landing, login, onboarding, dashboard, leagues new/join/detail, matches, bonuses. Dark theme, pitch-green primary, gold for bonuses, Outfit font, glass cards. The owner likes the look; keep it.
- Real backend in `src/lib/api.ts` (`"use server"`): magic-link auth, Supabase SSR clients (`src/lib/supabase/`), PKCE callback (`src/app/api/auth/callback/route.ts`), middleware session refresh + next-intl (`src/proxy.ts`), onboarding route guard (`src/app/[locale]/(app)/layout.tsx`).
- Superadmin result-entry panel at `/[locale]/admin` (`src/app/[locale]/(admin)/admin/`), with a `recordResult`/`clearResult`/`setVoided` server action. This was missing entirely and is what lets scores be entered at all.
- Database fully provisioned and seeded (48 teams, 104 matches, all RLS on).

Live data as of last check: 1 user (Danny, `is_superadmin = true`, display_name "Test", id `d66e82d8-92cb-4b37-89ec-e1bf11fbcbad`), 1 league, 0 predictions, 0 results. The predict -> enter-result -> leaderboard loop has been exercised once and works.

Stack reality (note: not what CLAUDE.md says): Next.js 16.2.7 App Router with Turbopack, TypeScript, Tailwind v4 (CSS tokens in `src/app/globals.css`), shadcn/ui, next-intl, `@supabase/ssr` cookie auth, Drizzle schema as authority (`src/lib/db/schema.ts`), Supabase Postgres 17, Vercel auto-deploy from GitHub `danzko/polla-mundialista` `main`.

## 3. The contract and the database

All UI data flows through `@/lib/api`. Reads: `getSessionUser`, `getDashboard`, `getLeague`, `getTeams`, `getMatches`, `getBonuses`. Mutations: `requestMagicLink`, `completeOnboarding`, `createLeague`, `joinLeague`, `submitPrediction`, `submitBonuses`. Types in `src/lib/types.ts`, zod in `src/lib/validation.ts`, scoring in `src/lib/scoring/calculate-points.ts`.

Pending contract additions already specced (in the handoff docs, not yet merged by Antigravity): `submitPredictions` (batch, handoff 3) and `getLeagueRace` plus race types and a `getLeague` mapping fix for `match_points`/`bonus_points` (handoff 2).

Database (Supabase project `nsaajzmtzotwjpbfwyad`, "Polla Mundialista 2026"):
- Migration `0001` (in repo) plus live RLS fixes applied via Antigravity commits (e.g. a leagues select-policy fix not reflected in the 0001 file; trust the live DB over the file).
- Migration `0002_bonus_scoring_and_views.sql` (in repo, applied): added `tournament_outcomes` (singleton, superadmin-writable), rewrote `leaderboard_view` to expose `match_points`, `bonus_points`, and a `total_points` that includes bonuses (original 7 columns preserved so existing queries are untouched), and added `leaderboard_matchday` (`user_id`, `match_day`, `cumulative_points`) for the standings race chart. Important: only the team bonuses (champion 15, runner-up 10, third 5, semifinalists 3 each) are scored in the view so far. Golden Boot and Ball scoring is deliberately deferred until the 3-scorers/3-players schema lands.

## 4. Decisions already made (canon, do not relitigate)

- Pool model: full predictive bracket like the Excel. Phased (groups + picks now, bracket before June 28).
- Scoring (settled, simple): exact score 6, correct result 2, wrong 0, doubled from the Round of 32 on. Bonuses: champion 15, runner-up 10, third 5, each correct semifinalist 3 (max 12), Golden Boot 10, Golden Ball 10. Tiebreakers in order: total points, exact count, result count, earliest first-prediction timestamp.
- Knockout scoring: option A. A knockout match scores the usual 6/2/0 (doubled) only if the user's predicted two teams are the ones who actually played that match; otherwise 0. "Who advances" is rewarded through the bonus picks. Chosen because it is the natural extension of the existing rubric and barely more work given the bracket already computes matchups.
- Entry UX: scores default to 0-0 (not blank), no silent auto-save, one explicit lock-in per phase (groups, then bonuses, then bracket), with clear progress and an obvious "what am I locking in." See handoff 3.
- Picks: three Golden Boot and three Golden Ball entries (Excel parity), via autocomplete backed by a curated player list. Open question the owner has not yet answered: curated contenders (~150-250 attackers/stars) vs full squads. Lean curated.
- Knockouts before the bracket exists must lock (not show editable steppers for unknown "Ganador PXX" teams).

## 5. The remaining build: the bracket

This is the bulk of what is left. The hard, error-prone asset is already done: `scripts/wc2026-bracket-structure.json` contains the fixed Round of 32 slots (matches 73-88), the full bracket tree to the final (matches 89-104, including third-place 103), and the validated 495-row best-thirds lookup from FIFA Annex C. It was generated and validated (all C(12,8) combinations present, each row's assigned thirds equal its qualifying-group set) by `outputs/build_bracket.py` in the session scratch. Structure: `r32`, `thirdsColumns` = `[1A,1B,1D,1E,1G,1I,1K,1L]`, `thirdsColumnMatch` (which match each of those winners plays), `bracket`, and `thirdsCombinations` keyed by the sorted 8-letter group string mapping to `{1A: "E", ...}`.

Design intent for the per-user bracket:
- Data model: the current `predictions` table is keyed to real match ids and is shared (everyone predicts the same real match). Knockouts are different: each user predicts their OWN matchups derived from their OWN group predictions, so you need a per-user bracket store. Minimum: per-user predicted group order with manual tiebreak overrides, and per-user predicted knockout results (score plus an advancer flag for draws) keyed to bracket slots, not real match ids.
- Pipeline: a user's group score predictions -> group tables (points, GD, GF, head-to-head among tied teams) -> where pts/GD/GF/h2h cannot separate teams, a manual ordering UI (the Excel exposes dropdowns; v1 may auto-resolve and add the manual picker later) -> top 2 per group plus rank all 12 third-placed teams and take the best 8 -> look up `thirdsCombinations[sortedKey]` to assign the 8 third slots -> fill the R32 -> user predicts R32 scores -> propagate winners through the bracket tree, capturing the penalty/extra-time winner when a predicted knockout is a draw -> derive champion, runner-up, third.
- Scoring reconciliation: keep match-score points on REAL matches. The superadmin enters real knockout teams (and scores) as the tournament progresses via the admin panel, which needs extending to assign real knockout teams. For each user knockout slot, award 6/2/0 (doubled) only when the user's predicted teams equal the real teams in that bracket position (option A), else 0. Wire this into `leaderboard_view` (or a companion view) alongside the existing group/bonus scoring.
- Also wire the 3+3 Golden Boot/Ball scoring once `bonus_predictions` and `tournament_outcomes` move from single name fields to arrays.

## 6. Other open work

- Standings "race" view (handoff 2): a standings table with movement arrows, a cumulative-points-over-matchdays chart, a personal gap line, and a "points still in play" note. Data is ready (`leaderboard_view` + `leaderboard_matchday` + `getLeagueRace`).
- Entry redesign (handoff 3) is what Antigravity is finishing now; verify it shipped before building on top of it.
- Real knockout kickoff dates: the seed used placeholders (the final shows 2026-07-16; the real final is July 19). Update them (superadmin-editable, or reseed the knockout rows).

## 7. Known gaps, bugs, and security notes

- `package.json` name is still `tmp-next-app`.
- vitest is not in `devDependencies` and there is no `test` script, so `tests/scoring.test.ts` cannot run as-is.
- `createLeague` invite-code generator (`Math.random().toString(36).substring(2,8)`) can produce fewer than 6 chars and has no collision retry. Replace with a guaranteed 6-char unambiguous generator plus retry.
- There is a hardcoded `isSuperadmin: true` in the login page (around line 67). Confirm it is dead mock data and not a privilege leak.
- Security advisor (run `get_advisors`): the leaderboard views are SECURITY DEFINER (intentional, a leaderboard must read across users; but any signed-in user can read global standings via the raw REST endpoint, consistent with the existing public-display-name posture; convert to a league-scoped function if true isolation is wanted). The `is_superadmin` / `is_league_member` SECURITY DEFINER helpers have mutable search_path (advisor warning) and are exposed via RPC; harden if you touch them. Leaked-password protection is off but irrelevant (magic link only).
- Supabase Auth URL config: confirm the production domain and `/api/auth/callback` are in Site URL / Redirect URLs, or magic links silently fail. Auth works today, so it is set for the current domain.

## 8. Access, deploy, coordination

This has been a two-agent setup and may continue:
- Antigravity runs natively on the owner's Mac with his GitHub, Vercel, and Supabase logins. It owns the UI and drives git and deploys. It receives specs as the `docs/antigravity-handoff-*.md` files.
- The prior Cowork agent (me) had: Supabase MCP (full, project `nsaajzmtzotwjpbfwyad`), Vercel connector (read plus deploy, team `team_HgIjubDGVPZ50oTEhhzc7xye`, project `prj_3YXMom0inJGqC8widgcXVHWKY9Ar`), no git access, and wrote files directly into the shared working tree. It did all database changes (via MCP) and authored backend/SQL and the bracket data, handing UI work to Antigravity to avoid both agents writing the same files.

Deploy: every push to `main` auto-builds a production deploy on Vercel; a failed build keeps the prior version live. You can read build and runtime logs via the Vercel connector to verify or debug. Database changes go through the Supabase MCP (`apply_migration` for DDL, `execute_sql` for data), and you should run `get_advisors` after schema changes.

If you (mythos) have full access to all three, you can collapse this split and own the whole stack. Just be aware that if Antigravity is still active on the same working tree, two agents writing the same files will collide; coordinate or take exclusive ownership.

## 9. Key files and artifacts

- `scripts/wc2026-bracket-structure.json` — validated R32 slots, bracket tree, 495 best-thirds combinations. The bracket linchpin.
- `supabase/migrations/0002_bonus_scoring_and_views.sql` — bonus + leaderboard + race views (applied).
- `src/lib/api.ts`, `src/lib/types.ts`, `src/lib/validation.ts`, `src/lib/scoring/calculate-points.ts` — the contract and scoring.
- `src/app/[locale]/(admin)/admin/` — result entry (extend for knockout team assignment).
- `scripts/wc2026-seed-data.json`, `scripts/seed.ts` — teams and group fixtures (group kickoffs correct in UTC; knockout dates are placeholders).
- `docs/PRD.md` (historical, superseded on the bracket question), `docs/antigravity-frontend-brief.md`, `docs/antigravity-handoff-2.md` (predict-sheet superseded; standings race still valid), `docs/antigravity-handoff-3-entry-redesign.md` (current).
