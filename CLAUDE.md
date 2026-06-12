# Polla Mundialista 2026

## What is this

A bilingual (ES/EN) World Cup 2026 prediction pool web app. Users create or join private leagues via invite code, predict exact scores for every match, and climb a leaderboard. Free to use with a "buy me a coffee" tip jar.

## Owner

Danny (danzko@gmail.com) -- superadmin of the platform.

## Status

**Phase: LIVE in production (launched for the June 11, 2026 kickoff).**

Production: https://polla-mundialista-puce.vercel.app (Vercel auto-deploys from GitHub `danzko/polla-mundialista` `main`). Supabase project `nsaajzmtzotwjpbfwyad`, fully seeded (48 teams, 104 matches with kickoffs verified against the group's Excel) with RLS on.

Working end to end: magic-link auth, onboarding, create/join leagues (join uses the `lookup_league_by_invite_code` SECURITY DEFINER RPC), group-stage batch prediction entry (default 0-0, explicit save), bonus picks (podium + 4 semifinalists + 3 ranked top scorers + 3 ranked best players, locking June 11 19:00 UTC), superadmin result entry at `/[locale]/admin`, leaderboards via `leaderboard_view`.

Live scores (June 12): ESPN's public scoreboard is the external source of
truth. The `live-scores-sync` Supabase Edge Function (source mirrored in
`supabase/functions/live-scores-sync/index.ts`) polls it every 2 minutes via
pg_cron job `live-scores-sync-2min` + pg_net, staging into `live_scores` +
`live_sync_state` heartbeat (migration 0008) -- NEVER directly into
match_results. Mapping: stored ESPN event id -> FIFA-code pair (ESPN
abbreviations == our 48 codes exactly) -> unique-kickoff fallback for TBD
knockouts; scores stored oriented to OUR home/away. /admin shows the panel:
live scores, one-tap "Confirmar" of ESPN finals into match_results, alerts
when our recorded result differs, kickoff-drift alerts with one-tap fix (ET
times). Admin actions: `confirmLiveResult`, `applyProviderKickoff`.

**Read `docs/HANDOFF-MYTHOS.md` first** -- it corrects this file where they disagree and records decisions already made.

What's next (before June 28, when knockouts start):
1. Bracket entry UI on the REAL Round of 32 (one-shot: pick R16 winners through
   the final + third-place game), open only in the June 27 -> 28 window, locked
   at first R32 kickoff. `scripts/wc2026-bracket-structure.json` has the
   validated bracket tree; per-user predicted brackets are NOT needed anymore.
2. Scoring rewrite in leaderboard_view: advancement points (R32 tier derived
   from each player's locked group predictions via group tables + best-thirds
   lookup; later tiers from bracket picks), champion/boot/ball 50/25/25 from
   bonus_predictions, tiebreak by knockout-stage points. Drop the 6/2/0 x2
   knockout-match scoring and the 15/10/5/3 team bonuses.
3. Standings race view (docs/antigravity-handoff-2.md; data ready in `leaderboard_matchday`).
4. Admin: assign real knockout teams as groups conclude.

## Stack

- **Framework:** Next.js 16 (Turbopack), App Router, React Server Components, Server Actions
- **Hosting:** Vercel Hobby (free)
- **Database:** Supabase Pro ($25/mo) -- Postgres 16 + Auth + RLS
- **ORM:** Drizzle (schema authority, migrations, complex queries) + Supabase JS client (simple RLS-aware reads in RSC)
- **UI:** Tailwind CSS v4, shadcn/ui, TweakCN
- **Forms:** react-hook-form + Zod
- **State:** TanStack React Query (client polling only)
- **i18n:** next-intl with /es and /en route segments
- **Auth:** Supabase magic link only, no OAuth, no passwords

## Scoring rules (OFFICIAL pool rules from the owner, June 10 2026 -- supersede all earlier versions)

Group stage (per match):
- Exact score: 6 pts
- Correct result, wrong score: 2 pts
- Wrong result: 0 pts

Knockout stage (advancement-based -- knockout SCORES earn nothing; only teams advancing count).
ENTRY MODEL (owner decision June 10, lock rule tightened June 12): two entry
events. (1) Group scores, ALL locked at the tournament's first kickoff
(June 11 19:00 UTC) -- no entries or edits after the opening whistle (enforced
in RLS migration 0007 + app). (2) ONE knockout entry window after the last group match
and before the first R32 kickoff (June 27 -> June 28 02:00/19:00 UTC): players
fill the ENTIRE real bracket (R32 winners through champion + third-place game)
in one sitting on the REAL qualified teams. No per-user predicted brackets.
Points per team correctly advancing to each round:
- Round of 32: 2 pts per team -- DERIVED from the player's locked group-score
  predictions (their implied group tables + best-thirds), since the real R32 is
  known by entry time
- Round of 16: 4 pts per team (picked in the bracket window)
- Quarterfinals: 7 pts per team
- Semifinals: 15 pts per team
- Final: 25 pts per team
- 3rd-place finisher correct: 20 pts (the bracket's third-place game pick)
- Champion is NOT scored from the bracket -- it pays via the pre-tournament
  pick below (no double counting; reaching the final still pays 25/team)

Tournament picks (exactly THREE, locked at tournament start June 11, 19:00 UTC;
owner decision June 10: "simplify -- no runners up"):
- Champion: 50 pts
- Top scorer (FIFA Golden Boot winner): 25 pts
- Best player (FIFA Golden Ball winner): 25 pts
Single picks each. Legacy columns (runner-up, third place, semifinalists,
silver/bronze boot/ball slots) remain in bonus_predictions but are UNSCORED
and no longer collected by the UI.

Tiebreaker: total pts, then most points earned in the knockout stage.

Prizes (1st 75% / 2nd 25% after 3rd gets buy-in back) are handled OUTSIDE the app -- never build payment features.

IMPLEMENTATION STATUS: the live leaderboard_view + TS engine still score knockout
matches as 6/2/0 x2 and team bonuses as 15/10/5/3 -- harmless until knockout
results exist (June 28+). The rewrite to advancement-based scoring MUST land
with the bracket build before June 28. R32 advancement is derivable from group
predictions already locked at kickoff; champion + third picks are collected in
bonus_predictions; runner-up/semifinalist picks are collected but not scored
under the official rules.

## Architecture decisions (don't revisit these)

- ONE prediction per user per match, scored across ALL their leagues (not per-league predictions)
- Server Actions for all mutations, no REST API endpoints
- Postgres VIEW for leaderboard (no materialized table in v1)
- No realtime subscriptions, React Query polling on match days
- No email notifications beyond magic link
- Manual result entry by superadmin (no paid API in v1)
- Soft-delete leagues with 7-day grace period
- Invite codes: 6-char alphanumeric, case-insensitive

## Folder structure

```
/app/[locale]/(public)     -- landing, login
/app/[locale]/(app)        -- authenticated: dashboard, leagues, matches, bonuses
/app/[locale]/(admin)      -- superadmin: enter results, manage leagues/users
/app/api/cron              -- optional future cron routes
/src/lib/db                -- schema.ts, queries
/src/lib/scoring           -- calculate-points.ts
/src/lib/supabase          -- server/client helpers
/src/lib/i18n              -- next-intl config
/src/messages              -- es.json, en.json
/components/ui             -- shadcn
/components/{predictions,leagues,shared}
/supabase/migrations       -- SQL migrations
/scripts                   -- seed.ts, seed data JSON
/tests                     -- vitest tests
/docs                      -- PRD.md
```

## Key files

- `docs/PRD.md` -- full product spec, scoring rules, data model, RLS policies, milestones, acceptance checklist
- `src/lib/db/schema.ts` -- Drizzle schema, THE source of truth for all tables
- `supabase/migrations/0001_initial_schema.sql` -- raw SQL schema + RLS policies + leaderboard view
- `src/lib/scoring/calculate-points.ts` -- scoring engine (mirrors the Postgres view)
- `tests/scoring.test.ts` -- vitest unit tests for scoring
- `scripts/seed.ts` -- seeds 48 teams + 104 matches from JSON
- `scripts/wc2026-seed-data.json` -- extracted from buddy's Excel (teams, groups, matchups, kickoff times)

## Data model summary

Tables: users, teams (48), matches (104), match_results, leagues, league_members, predictions, bonus_predictions
Views: leaderboard_view (computed scoring, no materialization)
All tables have RLS enabled. See migration file for policies.

## Roles

- Visitor: landing page, sign up
- Member: create/join leagues, submit predictions, view leaderboards
- League admin: manage their league (kick, rename, regenerate code, soft-delete)
- Superadmin (Danny): enter results, void matches, edit fixtures, manage everything

## Environment variables needed

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, for seed script and admin actions
NEXT_PUBLIC_BMC_URL=              # Buy Me a Coffee link
NEXT_PUBLIC_CAFECITO_URL=         # Cafecito link
```

## Commands

```bash
# Install
npm install

# Dev
npm run dev

# Run scoring tests
npx vitest run tests/scoring.test.ts

# Generate Drizzle migration
npx drizzle-kit generate

# Push schema to Supabase
npx drizzle-kit push

# Seed data
npx tsx scripts/seed.ts

# Deploy
npx vercel --prod
```

## Non-goals (do NOT build these)

- ~~Bracket-style scoring~~ SUPERSEDED: the owner chose the full predictive bracket like the group's Excel pool (see docs/HANDOFF-MYTHOS.md); phased to ship before June 28
- Custom scoring rules per league
- Real-time API sync (v1 is manual entry)
- Email/SMS/push notifications
- Chat, comments, reactions
- Social sharing
- Multiple tournaments
- Mobile native apps
- Profile pictures, badges, streaks
- Public leaderboards

## World Cup 2026 facts

- 48 teams, 12 groups of 4, 104 matches
- June 11 to July 19, 2026
- USA / Canada / Mexico host
- 32 teams advance from groups (top 2 + 8 best 3rd place)
- Round of 32 is new (was Round of 16 in previous World Cups)
- Iran situation may cause changes -- handle via manual void/reschedule by superadmin
