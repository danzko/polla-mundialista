# Polla Mundialista 2026

## What is this

A bilingual (ES/EN) World Cup 2026 prediction pool web app. Users create or join private leagues via invite code, predict exact scores for every match, and climb a leaderboard. Free to use with a "buy me a coffee" tip jar.

## Owner

Danny (danzko@gmail.com) -- superadmin of the platform.

## Status

**Phase: Schema + seed ready, scaffold next.**

What's done:
- PRD finalized (docs/PRD.md) -- v2, revised scoring
- Drizzle ORM schema (src/lib/db/schema.ts) -- all tables, relations, types
- SQL migration with RLS policies (supabase/migrations/0001_initial_schema.sql)
- Scoring engine with pure functions (src/lib/scoring/calculate-points.ts)
- Unit tests for scoring (tests/scoring.test.ts)
- Seed data extracted from buddy's Excel (scripts/wc2026-seed-data.json)
- Seed script (scripts/seed.ts) -- inserts 48 teams + 104 matches

What's next (Week 1 continued):
1. `npx create-next-app` with TypeScript, Tailwind v4, App Router
2. Install deps: drizzle-orm, @supabase/ssr, next-intl, shadcn/ui, react-hook-form, zod, @tanstack/react-query
3. Set up Supabase project, run migration, run seed
4. Wire up magic link auth end to end
5. Deploy skeleton to Vercel with custom domain

## Stack

- **Framework:** Next.js 15, App Router, React Server Components, Server Actions
- **Hosting:** Vercel Hobby (free)
- **Database:** Supabase Pro ($25/mo) -- Postgres 16 + Auth + RLS
- **ORM:** Drizzle (schema authority, migrations, complex queries) + Supabase JS client (simple RLS-aware reads in RSC)
- **UI:** Tailwind CSS v4, shadcn/ui, TweakCN
- **Forms:** react-hook-form + Zod
- **State:** TanStack React Query (client polling only)
- **i18n:** next-intl with /es and /en route segments
- **Auth:** Supabase magic link only, no OAuth, no passwords

## Scoring rules (IMPORTANT -- these are baked into the Postgres view and TS engine)

Per-match:
- Exact score: 6 pts
- Correct result, wrong score: 2 pts
- Wrong result: 0 pts
- Knockout multiplier (R32 onward): x2

Bonuses (locked at tournament start June 11):
- Champion: 15 pts
- Runner-up: 10 pts
- 3rd place: 5 pts
- Each semifinalist (4 max): 3 pts each
- Golden Boot (top scorer): 10 pts
- Golden Ball (best player): 10 pts

Tiebreakers: total pts > exact count > result count > earliest first prediction

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

- Bracket-style scoring
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
