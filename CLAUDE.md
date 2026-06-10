# Polla Mundialista 2026

## What is this

A bilingual (ES/EN) World Cup 2026 prediction pool web app. Users create or join private leagues via invite code, predict exact scores for every match, and climb a leaderboard. Free to use with a "buy me a coffee" tip jar.

## Owner

Danny (danzko@gmail.com) -- superadmin of the platform.

## Status

**Phase: LIVE in production (launched for the June 11, 2026 kickoff).**

Production: https://polla-mundialista-puce.vercel.app (Vercel auto-deploys from GitHub `danzko/polla-mundialista` `main`). Supabase project `nsaajzmtzotwjpbfwyad`, fully seeded (48 teams, 104 matches with kickoffs verified against the group's Excel) with RLS on.

Working end to end: magic-link auth, onboarding, create/join leagues (join uses the `lookup_league_by_invite_code` SECURITY DEFINER RPC), group-stage batch prediction entry (default 0-0, explicit save), bonus picks (podium + 4 semifinalists + 3 ranked top scorers + 3 ranked best players, locking June 11 19:00 UTC), superadmin result entry at `/[locale]/admin`, leaderboards via `leaderboard_view`.

**Read `docs/HANDOFF-MYTHOS.md` first** -- it corrects this file where they disagree and records decisions already made.

What's next (before June 28, when knockouts start):
1. Per-user predictive bracket (the Excel model): group tables computed from the user's own scores -> best-thirds lookup -> R32 -> propagate to champion. `scripts/wc2026-bracket-structure.json` has the validated structure + 495 best-thirds combinations.
2. Knockout scoring option A wired into the leaderboard (points only when the user's predicted pairing matches the real pairing), plus Golden Boot/Ball scoring once outcomes are known.
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
Points per team the player correctly has advancing to each round (from their predictive bracket):
- Round of 32: 2 pts per team
- Round of 16: 4 pts per team
- Quarterfinals: 7 pts per team
- Semifinals: 15 pts per team
- Final: 25 pts per team
- Champion correct: 50 pts
- 3rd-place finisher correct: 20 pts

Bonus picks (locked at tournament start June 11, 19:00 UTC):
- Golden Boot (FIFA top scorer): 30 pts
- Golden Ball (FIFA best player): 30 pts
- Entry is 3 ranked picks each (gold/silver/bronze, Excel parity); whether silver/bronze
  earn anything is an OPEN DECISION for the owner -- default assumption: only the gold pick pays 30.

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
