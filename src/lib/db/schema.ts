/**
 * Polla Mundialista 2026 - Drizzle ORM Schema
 *
 * All tables live in the `public` schema. Supabase Auth manages `auth.users`.
 * This schema references `auth.users.id` via uuid FK on the `users` table.
 *
 * Run migrations with: npx drizzle-kit push
 * Generate migrations with: npx drizzle-kit generate
 */

import { relations } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  smallint,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================
// Enums
// ============================================================

export const matchStageEnum = pgEnum("match_stage", [
  "group",
  "league",   // UCL league phase (migration 0031)
  "playoff",  // UCL knockout play-off round
  "r32",
  "r16",
  "qf",
  "sf",
  "third_place",
  "final",
]);

export const languageEnum = pgEnum("language", ["es", "en"]);

// ============================================================
// Tables
// ============================================================

/**
 * Public user profile, synced from auth.users on first login.
 * `id` matches the Supabase Auth user id.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // references auth.users.id
  displayName: text("display_name").notNull(),
  preferredLanguage: languageEnum("preferred_language").default("es").notNull(),
  isSuperadmin: boolean("is_superadmin").default(false).notNull(),
  // Owner-granted window to (re)enter tournament picks after the global
  // lock; null for everyone else. Column writes are revoked from
  // authenticated (migration 0011) — superadmin tooling only.
  bonusUnlockUntil: timestamp("bonus_unlock_until", { withTimezone: true }),
  // When the user used their one-time display-name change (null = unused).
  // Enforced by the change_display_name RPC (migration 0013).
  nameChangedAt: timestamp("name_changed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * One competition the club runs: World Cup 2026 (archived), Champions League
 * 2026-27, ... Fixed ids live in src/lib/tournament.ts (migration 0031).
 */
export const tournaments = pgTable("tournaments", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),          // 'wc-2026', 'ucl-2026-27'
  kind: text("kind").notNull(),                   // 'world_cup' | 'ucl'
  nameEn: text("name_en").notNull(),
  nameEs: text("name_es").notNull(),
  status: text("status").notNull().default("upcoming"), // upcoming | active | archived
  espnLeague: text("espn_league").notNull(),      // ESPN scoreboard league slug
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  picksLockAt: timestamp("picks_lock_at", { withTimezone: true }),       // champion/boot/ball lock
  bracketDeadline: timestamp("bracket_deadline", { withTimezone: true }), // null = per-match locks only
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Teams of a tournament: national teams (WC, flag emoji + groups) or clubs
 * (UCL, crest logo_url, no groups). Unique code per tournament.
 */
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }).notNull(),
    code: text("code").notNull(), // FIFA code ("MEX") or ESPN club abbreviation ("RMA")
    nameEn: text("name_en").notNull(),
    nameEs: text("name_es").notNull(),
    flagEmoji: text("flag_emoji").notNull().default(""),
    logoUrl: text("logo_url"), // club crest
    group: text("group"), // A-L; null for a league phase
    groupPosition: smallint("group_position"), // 1-4 within group; null for a league phase
    eliminated: boolean("eliminated").default(false).notNull(),
  },
  (table) => [uniqueIndex("teams_tournament_code_idx").on(table.tournamentId, table.code)]
);

/**
 * Knockout tree of a tournament as data: each deciding match, where its two
 * sides come from ('W74' / 'L101' feeds or slot labels) and the advancement
 * points for picking its advancer. Drives propagate_bracket() and the
 * leaderboard view (migration 0031).
 */
export const bracketNodes = pgTable(
  "bracket_nodes",
  {
    tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }).notNull(),
    matchNumber: smallint("match_number").notNull(),
    round: text("round").notNull(),
    homeRef: text("home_ref").notNull(),
    awayRef: text("away_ref").notNull(),
    advancePoints: smallint("advance_points").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.tournamentId, table.matchNumber] })]
);

/**
 * All 104 matches. Group stage matches are seeded with both teams.
 * Knockout matches start with null away_team_id (TBD) and get updated
 * as the tournament progresses.
 */
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }).notNull(),
    matchNumber: smallint("match_number").notNull(), // unique per tournament (WC: FIFA numbering 1-104)
    homeTeamId: uuid("home_team_id").references(() => teams.id),
    awayTeamId: uuid("away_team_id").references(() => teams.id),
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
    stage: matchStageEnum("stage").notNull(),
    groupLabel: text("group_label"), // A-L for group stage, null otherwise
    matchday: smallint("matchday"), // league-phase round (1..8)
    leg: smallint("leg"), // 1 / 2 for two-legged ties
    tieNumber: smallint("tie_number"), // groups the two legs of one tie
    venue: text("venue"), // optional, nice to have
    isVoided: boolean("is_voided").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("matches_tournament_number_idx").on(table.tournamentId, table.matchNumber),
    index("matches_tournament_idx").on(table.tournamentId),
    index("matches_kickoff_idx").on(table.kickoffAt),
    index("matches_stage_idx").on(table.stage),
  ]
);

/**
 * Actual match results. One row per completed match.
 * Only the superadmin can insert/update.
 */
export const matchResults = pgTable("match_results", {
  matchId: uuid("match_id")
    .primaryKey()
    .references(() => matches.id, { onDelete: "cascade" }),
  homeScore: smallint("home_score").notNull(),
  awayScore: smallint("away_score").notNull(),
  // Who actually advanced — covers penalty shootouts (a draw on the board).
  // Null for group matches. Set for knockouts (migration 0014).
  advancedTeamId: uuid("advanced_team_id").references(() => teams.id),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Nullable: machine-recorded results (espn-auto) have no human (migration 0009).
  recordedBy: uuid("recorded_by").references(() => users.id),
  source: text("source").default("admin").notNull(),
});

/**
 * Private leagues. Users create and join leagues via invite code.
 * Soft-deleted via deleted_at with a 7-day grace period.
 */
export const leagues = pgTable(
  "leagues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    inviteCode: text("invite_code").notNull(),
    language: languageEnum("language").default("es").notNull(),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    adminUserId: uuid("admin_user_id")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("leagues_invite_code_idx").on(table.inviteCode)]
);

/**
 * League membership join table.
 */
export const leagueMembers = pgTable(
  "league_members",
  {
    leagueId: uuid("league_id")
      .references(() => leagues.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.leagueId, table.userId] }),
    index("league_members_user_idx").on(table.userId),
  ]
);

/**
 * Per-match predictions. One prediction per user per match.
 * The same prediction scores across all leagues the user belongs to.
 * Immutable after match kickoff (enforced by RLS + app layer).
 */
export const predictions = pgTable(
  "predictions",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    matchId: uuid("match_id")
      .references(() => matches.id, { onDelete: "cascade" })
      .notNull(),
    homeScore: smallint("home_score").notNull(),
    awayScore: smallint("away_score").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.matchId] }),
    index("predictions_match_idx").on(table.matchId),
    // Score sanity: 0-15 per side
    check("home_score_range", sql`home_score >= 0 AND home_score <= 15`),
    check("away_score_range", sql`away_score >= 0 AND away_score <= 15`),
  ]
);

/**
 * Tournament-long bonus predictions. One row per user per tournament.
 * Locked at tournaments.picks_lock_at.
 */
export const bonusPredictions = pgTable("bonus_predictions", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  tournamentId: uuid("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  championTeamId: uuid("champion_team_id").references(() => teams.id),
  runnerUpTeamId: uuid("runner_up_team_id").references(() => teams.id),
  thirdPlaceTeamId: uuid("third_place_team_id").references(() => teams.id),
  semifinalists: jsonb("semifinalists").$type<string[]>(), // array of 4 team UUIDs
  topScorerName: text("top_scorer_name"), // legacy single pick, mirrors topScorerNames[0]
  bestPlayerName: text("best_player_name"), // legacy single pick, mirrors bestPlayerNames[0]
  topScorerNames: jsonb("top_scorer_names")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`), // ranked: gold, silver, bronze boot
  bestPlayerNames: jsonb("best_player_names")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`), // ranked: gold, silver, bronze ball
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.tournamentId] })]);

/**
 * Per-user knockout bracket predictions. One row per knockout match the
 * user fills (advancer + score). Participants of later rounds are derived
 * from earlier advancers (bracket tree), so only the advancer + score are
 * stored. Locked at the first R32 kickoff. See migration 0014.
 */
export const bracketPicks = pgTable(
  "bracket_picks",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    matchId: uuid("match_id")
      .references(() => matches.id, { onDelete: "cascade" })
      .notNull(),
    advancerTeamId: uuid("advancer_team_id").references(() => teams.id),
    homeScore: smallint("home_score"),
    awayScore: smallint("away_score"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.matchId] }),
    index("bracket_picks_match_idx").on(table.matchId),
  ]
);

// ============================================================
// Relations (for Drizzle relational queries)
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  predictions: many(predictions),
  bonusPredictions: many(bonusPredictions),
  leagueMemberships: many(leagueMembers),
  createdLeagues: many(leagues, { relationName: "createdLeagues" }),
  adminLeagues: many(leagues, { relationName: "adminLeagues" }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  homeMatches: many(matches, { relationName: "homeTeam" }),
  awayMatches: many(matches, { relationName: "awayTeam" }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  homeTeam: one(teams, {
    fields: [matches.homeTeamId],
    references: [teams.id],
    relationName: "homeTeam",
  }),
  awayTeam: one(teams, {
    fields: [matches.awayTeamId],
    references: [teams.id],
    relationName: "awayTeam",
  }),
  result: one(matchResults, {
    fields: [matches.id],
    references: [matchResults.matchId],
  }),
  predictions: many(predictions),
}));

export const matchResultsRelations = relations(matchResults, ({ one }) => ({
  match: one(matches, {
    fields: [matchResults.matchId],
    references: [matches.id],
  }),
  recordedByUser: one(users, {
    fields: [matchResults.recordedBy],
    references: [users.id],
  }),
}));

export const leaguesRelations = relations(leagues, ({ one, many }) => ({
  creator: one(users, {
    fields: [leagues.createdBy],
    references: [users.id],
    relationName: "createdLeagues",
  }),
  admin: one(users, {
    fields: [leagues.adminUserId],
    references: [users.id],
    relationName: "adminLeagues",
  }),
  members: many(leagueMembers),
}));

export const leagueMembersRelations = relations(leagueMembers, ({ one }) => ({
  league: one(leagues, {
    fields: [leagueMembers.leagueId],
    references: [leagues.id],
  }),
  user: one(users, {
    fields: [leagueMembers.userId],
    references: [users.id],
  }),
}));

export const predictionsRelations = relations(predictions, ({ one }) => ({
  user: one(users, {
    fields: [predictions.userId],
    references: [users.id],
  }),
  match: one(matches, {
    fields: [predictions.matchId],
    references: [matches.id],
  }),
}));

export const bonusPredictionsRelations = relations(
  bonusPredictions,
  ({ one }) => ({
    user: one(users, {
      fields: [bonusPredictions.userId],
      references: [users.id],
    }),
    champion: one(teams, {
      fields: [bonusPredictions.championTeamId],
      references: [teams.id],
    }),
  })
);

// ============================================================
// Type exports (for use across the app)
// ============================================================

export type Tournament = typeof tournaments.$inferSelect;
export type BracketNode = typeof bracketNodes.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchResult = typeof matchResults.$inferSelect;
export type League = typeof leagues.$inferSelect;
export type NewLeague = typeof leagues.$inferInsert;
export type LeagueMember = typeof leagueMembers.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type NewPrediction = typeof predictions.$inferInsert;
export type BonusPrediction = typeof bonusPredictions.$inferSelect;
export type BracketPick = typeof bracketPicks.$inferSelect;
export type NewBracketPick = typeof bracketPicks.$inferInsert;
