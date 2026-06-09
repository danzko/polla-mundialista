# Frontend Implementation Notes: Polla Mundialista 2026

This document details the user interface design choices, architecture decisions, component specifications, and local verification flows implemented for the Polla Mundialista 2026 UI.

---

## 1. Design System & Visual Aesthetics

To create a premium, immersive sports experience, we built a **dark-first athletic aesthetic** with high-contrast highlighting:
- **Color Palette**:
  - **Base Background**: Deep Slate-Blue/Black (`hsl(224 71% 4%)`) mimicking stadium night lighting.
  - **Primary Accents**: Vibrant Pitch Emerald Green (`hsl(142 76% 40%)`) representing the grass field and action states.
  - **Special Indicators**: Golden Trophy Yellow (`#f59e0b` / `amber-500`) for top podium spots, points, and count downs.
- **Visual Styles**:
  - **Glassmorphism**: `.glass-panel` and `.glass-card` classes utilize `backdrop-filter: blur()` and semitransparent borders to float contents above background gradients.
  - **Micro-animations**: Smooth hover translations (`hover:-translate-y-0.5`), scaling triggers (`active:scale-97`), and success state bounces for actions like saving predictions and copying codes.
  - **Typography**: Google Font **Outfit** is loaded at the top of the stylesheet, giving the application a clean, modern, geometric style.

---

## 2. Interactive Mock API & Fixtures

All data queries and mutations flow through `src/lib/api.ts` which acts as the contract boundary and re-exports from `src/lib/api.mock.ts`.
- **In-Memory Persistence**: Mutations (like saving predictions, updating bonus picks, creating or joining leagues) modify the mock fixtures in `src/lib/fixtures.ts` directly. This makes the UI feel fully alive during a preview session.
- **Simulated Latency**: Reads and writes introduce a randomized artificial delay (150ms to 400ms) to demonstrate loading skeletons and optimistic UI savers.
- **Shortcuts / Helpers**:
  - The **Login page** includes preview buttons to quickly simulate logging in either as a new user (which routes to `/onboarding`) or an onboarded user (which routes to `/dashboard`).
  - The **Join League page** lists quick codes like `AMIGOS` or `OFFICE` to successfully join mock leagues, or `ERROR6` to test failure state handling.

---

## 3. Core Component Reference

### `ScoreStepper` (`src/components/predictions/ScoreStepper.tsx`)
- **Props**: `value (number | null)`, `onChange ((val: number) => void)`, `disabled (boolean)`, `placeholder (string)`
- **Behavior**: Renders buttons for `+` and `-` that automatically clamp inputs between `0` and `15` to prevent invalid scores. Also supports direct keying.

### `MatchCard` (`src/components/predictions/MatchCard.tsx`)
- **Props**: `match (MatchView)`, `locale (Locale)`, `onSubmitPrediction ((id, home, away) => Promise<ActionResult>)`
- **Behavior**: Composes `ScoreStepper`. Triggers optimistic state updates instantly, displaying a green checkmark on save success. Renders appropriate status badges: upcoming/editable, locked (padlock icon), past results, points earned (+6/+2/0), knockout multipliers (x2), and voided games.

### `TeamPicker` (`src/components/shared/TeamPicker.tsx`)
- **Props**: `teams (Team[])`, `value (string | null)`, `onChange (id => void)`, `locale (Locale)`
- **Behavior**: Custom combobox that handles fuzzy search filtering by localized team name or FIFA code. Includes a toggle to hide eliminated teams.

### `CountdownToLock` (`src/components/shared/CountdownToLock.tsx`)
- **Props**: `lockAt (string)`, `onLockChange? ((locked: boolean) => void)`
- **Behavior**: Ticks down every second showing days, hours, minutes, and seconds. Once expired, it fires the callback to lock inputs and displays a prominent red "Locked" badge.

### `CopyableCode` (`src/components/shared/CopyableCode.tsx`)
- **Props**: `code (string)`
- **Behavior**: Displays a block with the invite code and a copy action. When clicked, it copies the code to the clipboard, switching icons to a checkmark for 2 seconds.

---

## 4. Internationalization (next-intl)

- **Locale Segments**: Paths are prefixed with the active locale: `/es` or `/en`. Redirects are automatically handled by `middleware.ts`.
- **Syncing Prefixes**: The `LanguageToggle` and the language choice select inside `Onboarding` automatically rewrite the URL path segment when language preference changes, enabling instant locale updates.
- **Tip Jar URLs**: The footer links are language-aware, pointing to Cafecito (`https://cafecito.app`) for Spanish-speaking players and Buy Me a Coffee (`https://buymeacoffee.com`) for English-speaking players.

---

## 5. Verification Commands

Start the development server:
```bash
npm run dev
```

Build and compile the production bundle (TypeScript & turbopack assets typecheck):
```bash
npm run build
```
