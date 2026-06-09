# PRD: Polla Mundialista 2026

**Owner:** Danny
**Last updated:** April 14, 2026
**Status:** Draft v2, revised scoring, ready to build
**Target launch:** June 1, 2026 (10 days before tournament kickoff on June 11)

---

## 1. Overview

A bilingual (Spanish/English) web app for friend groups to predict FIFA World Cup 2026 match results and compete on a private leaderboard. Users create or join leagues via invite code. One prediction per user per match counts across every league they belong to. Free to use, supported by optional tips via Buy Me a Coffee (English UI) or Cafecito (Spanish UI).

### Why this exists
- Existing pollas are spreadsheets in WhatsApp groups. Painful to manage.
- Commercial alternatives are bloated, ad-heavy, or paid.
- Vibe-coded, opinionated, fast. Built for one specific group of friends, generalized just enough to host other friend groups.

### Success criteria for v1
- Functional and bug-free for the full 104 matches
- 30+ users actively submitting predictions across at least 3 leagues
- Zero downtime during the tournament (June 11 to July 19)
- At least one tip received

---

## 2. Users and roles

### Visitor (unauthenticated)
- View landing page
- Sign up via magic link
- Join a league via invite code (after auth)

### Member (authenticated user)
- Create leagues (becomes admin of those leagues automatically)
- Join leagues with an invite code
- Submit and edit predictions until kickoff
- Submit and edit bonus predictions until tournament start
- View leaderboards and prediction comparisons (post-kickoff) in their leagues
- Toggle UI language
- Update display name
- Leave a league

### League admin
- Everything a member can do, plus:
- Rename their league
- Regenerate invite code
- Kick members
- Soft-delete league (7-day undo window)
- Transfer admin to another member

### Superadmin (Danny)
- Everything any user can do, in any league
- Enter actual match results via admin panel
- Mark a match as void (no points awarded)
- Edit match kickoff times if FIFA reschedules
- Hard-delete leagues and users (abuse handling)
- View all leagues, members, predictions for support

---

## 3. Feature scope

### In scope (v1)
- Magic link auth via Supabase
- Bilingual UI (ES/EN) with browser detection and persistent toggle
- League creation, joining via 6-char alphanumeric invite code
- Per-match prediction submission and editing until kickoff
- Tournament-long bonus predictions: champion, runner-up, 3rd place, 4 semifinalists, top scorer (Golden Boot), best player (Golden Ball)
- League leaderboard with point breakdown and tiebreakers
- Per-match prediction comparison (visible only after kickoff)
- Admin panel for entering match results
- Manual fixture editing for the superadmin
- Tip jar (Buy Me a Coffee + Cafecito) shown in footer and after first prediction
- Soft-delete leagues with 7-day grace
- Mobile-first responsive design

### Out of scope (v1)
- Bracket-style scoring (LATAM polla only)
- Custom scoring rules per league
- Real-time data sync from a paid API (manual entry only)
- Email notifications beyond the magic link
- SMS, push notifications
- Comments, chat, reactions
- Social sharing of predictions
- Tournament types other than WC 2026
- Native mobile apps
- Multi-currency tip handling beyond external links
- Team logos via CDN (use emoji flags or static SVG bundle)
- OAuth providers beyond magic link
- Public leaderboards

---

## 4. Scoring rules

### Per-match scoring (mutually exclusive, simpler is better)
- **Exact score:** 6 points (e.g., predicted 2-1, actual 2-1)
- **Correct result, wrong score:** 2 points (e.g., predicted 1-0, actual 3-1; both home wins)
- **Wrong result:** 0 points

### Knockout multiplier
- All matches from Round of 32 onward: x2 multiplier on per-match points
- This means: exact score in knockouts = 12 pts, correct result = 4 pts

### Tournament bonus predictions (locked at tournament start, June 11 first kickoff)
- **Champion correct:** 15 points
- **Runner-up correct:** 10 points
- **3rd place correct:** 5 points
- **Each semifinalist correctly picked (4 max):** 3 points each, 12 max
- **Top scorer (Golden Boot) correct:** 10 points
- **Best player (Golden Ball) correct:** 10 points

### Tiebreakers (in order)
1. Total points
2. Number of exact-score predictions
3. Number of correct-result predictions
4. Earliest first prediction submission timestamp

### Voided matches
If the superadmin marks a match as void, no points are awarded for any prediction on that match. This is the manual escape hatch for cancellations or unforeseen events.

---

## 5. Data model

### Tables (via Drizzle ORM, Postgres)

**users**
- `id` (uuid, PK, references `auth.users.id`)
- `display_name` (text, required)
- `preferred_language` (text, 'es' or 'en')
- `is_superadmin` (boolean, default false)
- `created_at`, `updated_at`

**teams**
- `id` (uuid, PK)
- `code` (text, FIFA 3-letter code)
- `name_en`, `name_es` (text)
- `flag_emoji` (text)
- `eliminated` (boolean, default false, used for bonus prediction UI)

**matches**
- `id` (uuid, PK)
- `home_team_id` (FK teams)
- `away_team_id` (FK teams, nullable for knockout TBD)
- `kickoff_at` (timestamptz)
- `stage` (enum: group, r32, r16, qf, sf, third_place, final)
- `group_label` (text, nullable, e.g., 'A', 'B', 'C')
- `is_voided` (boolean, default false)

**match_results**
- `match_id` (FK matches, PK)
- `home_score` (smallint)
- `away_score` (smallint)
- `recorded_at` (timestamptz)
- `recorded_by` (FK users)

**leagues**
- `id` (uuid, PK)
- `name` (text)
- `invite_code` (text, unique, 6-char)
- `language` (text, 'es' or 'en', default UI language for new members)
- `created_by` (FK users)
- `admin_user_id` (FK users)
- `created_at`, `deleted_at` (nullable for soft-delete)

**league_members**
- `league_id` (FK leagues)
- `user_id` (FK users)
- `joined_at` (timestamptz)
- PK: composite (league_id, user_id)

**predictions**
- `user_id` (FK users)
- `match_id` (FK matches)
- `home_score` (smallint, 0-15)
- `away_score` (smallint, 0-15)
- `submitted_at` (timestamptz)
- `updated_at` (timestamptz)
- PK: composite (user_id, match_id)

**bonus_predictions**
- `user_id` (FK users, PK)
- `champion_team_id` (FK teams)
- `runner_up_team_id` (FK teams)
- `third_place_team_id` (FK teams)
- `semifinalists` (jsonb array of 4 team_ids)
- `top_scorer_name` (text, free-form, Golden Boot)
- `best_player_name` (text, free-form, Golden Ball)
- `submitted_at`, `updated_at`

### Views (Postgres)

**leaderboard_view**
Joins predictions to match_results, applies scoring rules, groups by user. Filtered per league via the league_members table at query time.

---

## 6. RLS policies

All tables have RLS enabled.

### users
- Read: anyone authenticated can read display_name, language. Only self can read all fields.
- Write: only self.
- Superadmin: bypass via JWT claim or `is_superadmin` check in policy.

### teams
- Read: anyone authenticated.
- Write: only superadmin.

### matches
- Read: anyone authenticated.
- Write: only superadmin.

### match_results
- Read: anyone authenticated.
- Write: only superadmin.

### leagues
- Read: members of that league.
- Insert: any authenticated user (becomes admin).
- Update: only `admin_user_id`.
- Delete (soft): only `admin_user_id` or superadmin.

### league_members
- Read: members can read other members of leagues they belong to.
- Insert: self-insert via valid invite_code (validated in Server Action).
- Delete: self (leave) or league admin (kick).

### predictions
- Read: self always. Other users: only if a row in `match_results` exists for that match (i.e., post-kickoff and recorded). For pre-kickoff comparison hiding, also enforce in app layer.
- Write: self only, only for matches where `now() < kickoff_at` and `is_voided = false`.

### bonus_predictions
- Read: self always. Others: only after tournament start (June 11, 2026 first kickoff).
- Write: self only, only before tournament start.

---

## 7. App architecture

### Stack
- **Framework:** Next.js 15 (App Router, React Server Components, Server Actions)
- **Hosting:** Vercel Hobby tier
- **Database:** Supabase Pro (Postgres 16, Auth, daily backups)
- **ORM:** Drizzle for schema and migrations, Drizzle queries for complex reads, Supabase JS client for simple RLS-aware reads in Server Components
- **UI:** Tailwind CSS v4, shadcn/ui, TweakCN for theming
- **Forms:** react-hook-form + Zod via @hookform/resolvers
- **State:** TanStack React Query for any client-side polling (live leaderboard refresh during match days)
- **i18n:** next-intl with `/es` and `/en` route segments
- **Validation:** Zod at every Server Action boundary
- **Logging:** structured `console.log` server-side, Vercel logs for capture

### Folder structure
```
/app
  /[locale]
    /(public)         landing, login
    /(app)            authenticated routes
      /dashboard      user's leagues
      /leagues/[id]   overview, leaderboard, settings
        /predictions
        /members
      /matches        all matches + prediction form
      /bonuses        tournament bonus picks
    /(admin)          superadmin only
      /matches        enter results
      /leagues
      /users
  /api
    /cron/sync-fixtures   optional, for v1.1 if API added
/lib
  /db                 drizzle schema + queries
  /supabase           server/client helpers
  /scoring            scoring functions, also in Postgres view
  /i18n               next-intl config
/messages
  es.json
  en.json
/components
  /ui                 shadcn primitives
  /predictions
  /leagues
  /shared
/docs
  PRD.md (this file)
```

### Mutations
All writes go through Server Actions. No REST endpoints except the optional cron route. Each Server Action validates input with Zod, runs the operation via Drizzle or Supabase client (with RLS enforcement), revalidates affected paths.

### Reads
Server Components fetch data via Supabase client (so RLS applies based on the user's session). Client Components use React Query only when polling (live leaderboard).

### Background jobs
- v1: none. All fixture data seeded from extracted Excel data (48 teams, 72 group matches, kickoff times). Match results entered manually by superadmin.
- v1.1 (optional): Vercel Cron pulls API-Football every 5 minutes during match windows.

---

## 8. UI flows

### Landing page (unauthenticated)
- Hero with tagline ("La polla mundialista para tu grupo de amigos" / "The World Cup pool for your friend group")
- "Sign in / Sign up" CTA
- Language toggle in header
- Footer with tip jar links

### Magic link flow
- Enter email, get email with link
- Click link, land on dashboard
- First-time users prompted for display name and preferred language

### Dashboard
- Empty state if no leagues: "Create a league" or "Join with code" CTAs
- List of user's leagues with their current rank in each

### League page
- Tabs: Leaderboard, My predictions, Members, (admin only) Settings
- Leaderboard shows rank, name, points, breakdown of exact/correct-result counts
- "Predict matches" CTA goes to /matches

### Matches page
- Filterable by date and stage
- Upcoming matches show prediction form inline
- Past matches show: your prediction, actual result, points earned, what others in this league predicted (collapsed by default)

### Bonuses page
- Pick champion, runner-up, 3rd place, 4 semifinalists, top scorer (Golden Boot), best player (Golden Ball)
- Locked once tournament starts
- Visual indicator of how many days/hours until lock

### Admin panel (superadmin)
- Match results entry form (one per match, with current standings overview)
- Manual edit of kickoff times
- "Mark match as void" button
- League and user lookup

---

## 9. Tech decisions and tradeoffs

### Why Next.js over Vite SPA
- Server Components reduce client JS for read-heavy pages (leaderboards, match lists)
- Server Actions simplify mutations vs separate API
- Vercel deployment is one click
- We don't need SSR for SEO but we benefit from server-rendered initial loads on mobile

### Why Supabase over self-hosted Postgres
- Auth is solved (magic links work out of the box)
- RLS is built-in
- $25/month for managed Postgres + auth + backups is cheap
- We can leave the Mac Mini for other projects

### Why Drizzle over Prisma
- Lighter, faster, closer to SQL
- Better for hand-tuned queries when we hit edge cases
- Schema-first migrations work well with Supabase

### Why hybrid Drizzle + Supabase client
- Drizzle for schema authority and complex queries (leaderboard joins, scoring)
- Supabase JS client in Server Components because it carries the user JWT and RLS just works
- Use one or the other per query, not both for the same query

### Why no realtime in v1
- Leaderboard updates only when results are entered (rare events)
- Polling on demand via React Query is enough
- Realtime adds connection overhead and complexity

### Why one prediction per user (not per league)
- Standard LATAM polla behavior
- Way simpler data model
- Users in multiple leagues only fill out predictions once
- If we ever want per-league, we add a `league_id` to predictions later (breaking change, but acceptable)

---

## 10. Cost estimate

| Item | Monthly cost | Annual |
|---|---|---|
| Vercel Hobby | $0 | $0 |
| Supabase Pro | $25 | $300 (only during active months) |
| Domain | $1 | $12 |
| API-Football (optional, v1.1) | $20 | $240 |
| **Total v1** | **~$26/month** | **~$312/year if always on** |

Recommended: pay for Supabase Pro April through August (5 months = $125), downgrade to free tier the rest of the year. Total real spend: ~$140 + $12 domain = $152 for the year.

Tip jar covers the rest if friends are generous.

---

## 11. Milestones

### Week 1 (April 13-20): Foundation
- Repo setup, Next.js + Tailwind + shadcn/ui scaffold
- Supabase project, Drizzle schema, RLS policies
- Magic link auth working end to end
- Seed teams and matches from openfootball JSON
- Deploy to Vercel with custom domain

### Week 2 (April 21-27): Core flows
- Create league, join league via invite code
- Submit and edit predictions
- Bonus predictions form
- Basic leaderboard (computed on the fly)
- i18n scaffold with ES/EN messages

### Week 3 (April 28 - May 4): Admin and polish
- Admin panel for entering match results
- Manual match editing (reschedule, void)
- Tip jar component
- Mobile UI pass
- Empty states and loading states

### Week 4 (May 5-11): Hardening
- Scoring engine unit tests
- RLS policy tests
- E2E happy path with Playwright
- Soft-delete + 7-day grace
- Tiebreaker logic

### Week 5 (May 12-18): Beta with friends
- Invite 5-10 close friends
- Have them create test leagues, submit predictions
- Fix what breaks

### Week 6 (May 19-25): Buffer
- Polish based on beta feedback
- Performance pass
- Documentation

### Launch (June 1, 2026)
- Open invitations to wider friend group
- Bonus predictions accepted
- Final checks

### June 11: Tournament kickoff
- Group stage begins, predictions flow
- Daily result entry by superadmin

---

## 12. Open risks

- **Manual result entry burden:** 104 matches over 39 days = ~3 results per day. Plan: enter results within 30 min of full-time. If this becomes a chore, integrate API-Football mid-tournament.
- **Friend abuse:** someone shares an invite code publicly. Mitigation: league admin can regenerate code, kick members.
- **FIFA chaos:** team withdrawal, schedule changes. Mitigation: superadmin can edit kickoff times and void matches manually.
- **Supabase outage during a match:** out of our control. Mitigation: predictions are server-validated against kickoff time; if Supabase is down, no one can submit, which is fair to all.
- **Vercel function timeouts on big leagues:** unlikely with <500 users per league. If hit, paginate leaderboard or move to materialized table.

---

## 13. Out of scope, written down so we don't argue about it later

- Group chat per league
- Notifications of any kind beyond the magic link email
- Custom scoring rules
- Multiple tournaments (only WC 2026)
- Public leaderboards
- Mobile native apps
- Sharing predictions on social media
- Profile pictures
- Achievements or badges
- Streaks
- Pre-tournament friendlies or qualifiers
- Live commentary or score widgets
- Multi-language beyond ES and EN
- Currency conversion or payment processing

---

## 14. Acceptance checklist for launch

- [ ] User can sign up with magic link in ES or EN
- [ ] User can create a league and share invite code
- [ ] Another user can join with that code
- [ ] User can submit prediction for any future match
- [ ] User cannot submit prediction for a match that has started (server-validated)
- [ ] User can edit prediction up to kickoff
- [ ] Superadmin can enter a match result
- [ ] Leaderboard updates correctly for all league members after result entered
- [ ] Bonus predictions lock at first kickoff of June 11
- [ ] Soft-delete league has 7-day undo
- [ ] All RLS policies pass test suite
- [ ] Mobile UI works on iPhone SE and modern Android
- [ ] Spanish and English UI both fully translated
- [ ] Tip jar links work and are language-aware
- [ ] App stays up under simulated load of 200 concurrent users
