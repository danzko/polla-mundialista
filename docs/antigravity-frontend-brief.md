# Frontend Build Brief: Polla Mundialista 2026

This is a build brief for the **UI frontend only**. The backend (auth, database, server actions, scoring) is being built in parallel against the exact same contract defined in this document. Build to this contract and the two halves snap together.

## 1. What the app is

A bilingual (Spanish default, English) FIFA World Cup 2026 prediction pool for friend groups. Users sign in with a magic link, create or join private leagues by invite code, predict exact scores for matches, make tournament-long bonus picks, and climb a per-league leaderboard. Mobile-first. Free, friendly, made for one group of friends and generalized just enough to host others.

Hard external deadline: the tournament kicks off June 11, 2026. Predictions lock at each match kickoff. Bonus picks lock at the first kickoff. So the priority is the capture-before-lock screens: predictions and bonuses.

## 2. Your job, and what is not your job

**Build:** every screen and component listed below, fully styled, responsive, accessible, bilingual, with loading / empty / error states, runnable standalone with mock data via `npm run dev`.

**Do NOT build (the backend owns these):** Supabase clients, auth callback routes, middleware, real server actions, database queries, RLS, the scoring engine, the seed, the admin panel. Call the typed functions in `src/lib/api.ts` and nothing else. Never reach for a database or an auth SDK.

You own the entire visual direction: style, palette, typography, spacing, motion. Make it feel good for a World Cup pool among friends. Light guardrails only: mobile-first, accessible (WCAG AA contrast, keyboard nav, labelled inputs), and themeable via shadcn tokens so it can be retuned later. No fixed brand colors are imposed.

## 3. Stack and conventions (locked, do not deviate)

- Next.js 15, App Router, React Server Components, TypeScript strict.
- Tailwind CSS v4 (CSS-first config, `@theme`), shadcn/ui for primitives.
- next-intl for i18n with a `[locale]` route segment. Default locale `es`. Locales: `es`, `en`.
- react-hook-form + zod (`@hookform/resolvers`) for all forms.
- Path alias `@/` to `src/`.
- No `localStorage` for anything important. Language lives in the URL locale segment.

Folder structure to follow:

```
/app/[locale]
  /(public)        landing, login
  /(app)           authenticated: onboarding, dashboard, leagues, matches, bonuses
/src/lib           types.ts, api.ts, api.mock.ts, fixtures.ts, validation.ts
/src/messages      es.json, en.json
/components/ui      shadcn primitives
/components         feature components
```

## 4. The integration contract (most important section)

All data and mutations flow through one module, `src/lib/api.ts`. You import from `@/lib/api` everywhere. You ship a mock implementation in `src/lib/api.mock.ts`, and `api.ts` re-exports it for now (`export * from './api.mock'`). The backend later replaces the internals of `api.ts` with real server calls. **Your import sites never change.** Keep every signature below exactly as written.

### 4a. Canonical types

Create `src/lib/types.ts` verbatim:

```ts
export type Locale = 'es' | 'en';
export type MatchStage =
  | 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third_place' | 'final';

export interface SessionUser {
  id: string;
  displayName: string;
  preferredLanguage: Locale;
  isSuperadmin: boolean;
  onboarded: boolean;
}

export interface Team {
  id: string;
  code: string;          // FIFA 3-letter, e.g. "MEX"
  nameEn: string;
  nameEs: string;
  flagEmoji: string;
  group: string;         // 'A'..'L'
  groupPosition: number; // 1..4
  eliminated: boolean;
}

export interface ScorePrediction {
  homeScore: number;     // 0..15
  awayScore: number;     // 0..15
}

export interface MatchView {
  id: string;
  matchNumber: number;        // 1..104
  stage: MatchStage;
  groupLabel: string | null;  // 'A'..'L' for group, null for knockouts
  kickoffAt: string;          // ISO 8601 UTC
  homeTeam: Team | null;      // null for TBD knockout slots
  awayTeam: Team | null;
  isVoided: boolean;
  locked: boolean;                  // true once kickoff has passed or voided
  myPrediction: ScorePrediction | null;
  result: ScorePrediction | null;   // null until a result is recorded
  pointsEarned: number | null;      // null until scored
}

export interface LeagueSummary {
  id: string;
  name: string;
  inviteCode: string;   // 6-char alphanumeric, uppercase
  language: Locale;
  memberCount: number;
  myRank: number | null;
  myPoints: number;
  isAdmin: boolean;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string;
  totalPoints: number;
  matchPoints: number;
  bonusPoints: number;
  exactCount: number;
  resultCount: number;
  isMe: boolean;
}

export interface LeagueMemberView {
  userId: string;
  displayName: string;
  isAdmin: boolean;
}

export interface LeagueDetail {
  id: string;
  name: string;
  inviteCode: string;
  language: Locale;
  isAdmin: boolean;
  members: LeagueMemberView[];
  leaderboard: LeaderboardRow[];
}

export interface BonusView {
  championTeamId: string | null;
  runnerUpTeamId: string | null;
  thirdPlaceTeamId: string | null;
  semifinalists: string[];        // up to 4 team ids
  topScorerName: string | null;
  bestPlayerName: string | null;
  locked: boolean;
  lockAt: string;                 // ISO 8601 UTC, '2026-06-11T19:00:00Z'
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
```

### 4b. The api.ts interface

Implement every one of these in `src/lib/api.mock.ts`. Reads return fixture data after a small simulated delay (150 to 400 ms). Mutations validate, log, and return a successful `ActionResult` (and demonstrate at least one realistic failure path, for example `joinLeague` with an unknown code returns `{ ok: false, error: ... }`).

```ts
import type {
  SessionUser, Team, MatchView, LeagueSummary, LeagueDetail,
  BonusView, ActionResult, Locale, MatchStage,
} from './types';

// Reads
export function getSessionUser(): Promise<SessionUser | null>;
export function getDashboard(): Promise<LeagueSummary[]>;
export function getLeague(leagueId: string): Promise<LeagueDetail | null>;
export function getTeams(): Promise<Team[]>;
export function getMatches(
  filter?: { stage?: MatchStage; dateISO?: string }
): Promise<MatchView[]>;
export function getBonuses(): Promise<BonusView>;

// Mutations
export function requestMagicLink(
  input: { email: string; locale: Locale }
): Promise<ActionResult>;
export function completeOnboarding(
  input: { displayName: string; preferredLanguage: Locale }
): Promise<ActionResult<SessionUser>>;
export function createLeague(
  input: { name: string; language: Locale }
): Promise<ActionResult<{ leagueId: string; inviteCode: string }>>;
export function joinLeague(
  input: { inviteCode: string }
): Promise<ActionResult<{ leagueId: string }>>;
export function submitPrediction(
  input: { matchId: string; homeScore: number; awayScore: number }
): Promise<ActionResult>;
export function submitBonuses(
  input: Omit<BonusView, 'locked' | 'lockAt'>
): Promise<ActionResult>;
```

Treat these as async and server-callable. Do not assume client-side `fetch`, do not add your own HTTP layer. Page components call the read functions; forms call the mutation functions and branch on `ActionResult`.

### 4c. Shared validation

Put zod schemas in `src/lib/validation.ts` and use them in forms via `zodResolver`. The backend imports these same schemas, so keep them pure and dependency-light. At minimum:

- `displayName`: 2 to 40 chars, trimmed.
- `email`: valid email.
- `leagueName`: 2 to 40 chars.
- `inviteCode`: exactly 6 alphanumeric chars, case-insensitive (normalize to uppercase before submit).
- `score`: integer 0 to 15.
- bonus: `semifinalists` is 0 to 4 unique team ids; player names 0 to 60 chars.

## 5. Screens to build

All routes are under `/app/[locale]`. Every authenticated screen assumes `getSessionUser()` resolves to a user; if it returns null, redirect to `/[locale]/login` (the backend enforces this for real, but wire the redirect).

**`(public)/` Landing.** Hero with tagline (ES: "La polla mundialista para tu grupo de amigos" / EN: "The World Cup pool for your friend group"), primary "Sign in" CTA to `/login`, language toggle in header, footer. No tip jar yet (deferred).

**`(public)/login` Magic link.** Email input, submit calls `requestMagicLink`. On success show a "check your email" confirmation state. Handle the error branch inline.

**`(app)/onboarding` First login.** Display name input + language choice, calls `completeOnboarding`. On success route to `/dashboard`. Shown when `getSessionUser().onboarded === false`.

**`(app)/dashboard` Home.** Calls `getDashboard()`. Empty state with two CTAs ("Create a league" to `/leagues/new`, "Join with code" to `/leagues/join`). Otherwise a list of `LeagueCard`s showing name, member count, my rank, my points.

**`(app)/leagues/new` Create league.** Name + language, calls `createLeague`. On success show the generated invite code with a copy button, then link into the league.

**`(app)/leagues/join` Join league.** Invite-code input, calls `joinLeague`. Handle unknown-code error inline. On success route to the league.

**`(app)/leagues/[id]` League detail.** Calls `getLeague(id)`. Tabs or sections: Leaderboard (a `LeaderboardTable` from `leaderboard`, highlight `isMe`, show points plus exact/result counts and bonus column) and Members (simple list). Show the invite code with copy for admins. A "Predict matches" CTA to `/matches`. Admin management actions are deferred, do not build them.

**`(app)/matches` Matches.** Calls `getMatches()` and `getTeams()`. Filter controls by stage and by date. Each match is a `MatchCard`:
- Upcoming and not locked: inline score prediction inputs (home / away steppers, 0 to 15) prefilled with `myPrediction` if present, saving via `submitPrediction`. Show an optimistic saved state.
- Locked or past: read-only. Show my prediction, the result if present, and `pointsEarned` if scored. TBD knockout slots (null team) render as placeholders ("Winner of Match N" style) and are not predictable.
Group order sensibly (by kickoff time). Make this screen excellent on a phone, it is the most-used screen.

**`(app)/bonuses` Bonus picks.** Calls `getBonuses()` and `getTeams()`. Pickers for champion, runner-up, 3rd place, exactly four semifinalists, plus free-text inputs for top scorer (Golden Boot) and best player (Golden Ball). Submit via `submitBonuses`. Show a prominent countdown to `lockAt`. When `locked` is true, render everything read-only. This screen must be finished and usable before June 11, picks are lost otherwise.

## 6. Components to build

`LanguageToggle`, `AppShell` (header + mobile-friendly nav), `LeagueCard`, `EmptyState`, `MatchCard` (composes `ScoreStepper`), `ScoreStepper` (0 to 15, accessible +/- and direct entry), `LeaderboardTable`, `TeamPicker` (searchable select over 48 teams, flag emoji + localized name, optional "hide eliminated"), `BonusForm`, `CountdownToLock`, `CopyableCode`, plus shared `LoadingSkeleton` and `ErrorState`. Keep presentational components prop-driven and typed against `src/lib/types.ts`.

## 7. Internationalization

next-intl, message files `src/messages/es.json` and `src/messages/en.json`, both fully authored (you write the copy in both languages, ES is primary). No hardcoded user-facing strings. Suggested namespaces: `common`, `nav`, `landing`, `auth`, `onboarding`, `dashboard`, `league`, `matches`, `bonuses`, `errors`. Team names come from the data (`nameEs` / `nameEn`) keyed off the active locale, not from message files. Dates and countdowns must render correctly per locale.

## 8. UX requirements

Mobile-first, looks right from 320 px up. Every async view has explicit loading, empty, and error states. Forms show validation inline and disable submit while pending. Score inputs are clamped to 0 to 15. Use optimistic UI on prediction save with a clear saved indicator and a rollback on failure. Respect `prefers-reduced-motion`. Keyboard accessible throughout.

## 9. Fixtures for standalone preview

In `src/lib/fixtures.ts` provide enough mock data that every screen looks real:

- One `SessionUser` (`onboarded: true`; flip to test onboarding).
- All-or-sample teams: at least 12 across several groups, with real flag emojis and ES/EN names (you can borrow from the seed data in `scripts/wc2026-seed-data.json` if available).
- At least 10 `MatchView`s spanning: upcoming unlocked (with and without `myPrediction`), one locked-but-unscored, two past-with-result-and-points, and one knockout with TBD teams.
- Two `LeagueSummary`s for the dashboard, and one full `LeagueDetail` with a 5-row leaderboard where one row `isMe`.
- One `BonusView` in the unlocked state, and a note in code on how to flip `locked` to test the locked view.

Mutations should mutate the in-memory fixtures so the UI feels live during a preview session.

## 10. Deliverables and run

Deliver a project that runs with `npm run dev` and shows every screen above driven entirely by mocks, plus:
- `src/lib/types.ts`, `src/lib/api.ts`, `src/lib/api.mock.ts`, `src/lib/fixtures.ts`, `src/lib/validation.ts` exactly as specified.
- shadcn/ui initialized, components added as needed.
- next-intl configured with both message files authored.
- A short `FRONTEND_NOTES.md` listing your design choices and any component props worth knowing.

## 11. Hard don'ts

- Do not change any signature in section 4. That is the contract.
- Do not implement auth, database access, real server actions, or scoring.
- Do not introduce a state manager beyond React state and next-intl. No global store, no localStorage.
- Do not invent extra routes or features beyond section 5 (no settings, admin, tip jar, comparison views yet).
- Do not hardcode user-facing strings outside the message files.
