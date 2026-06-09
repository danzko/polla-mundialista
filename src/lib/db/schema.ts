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
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * The 48 national teams in the World Cup 2026.
 * Seeded once at project setup.
 */
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(), // FIFA 3-letter code, e.g. "MEX", "ARG"
    nameEn: text("name_en").notNull(),
    nameEs: text("name_es").notNull(),
    flagEmoji: text("flag_emoji").notNull().default(""),
    group: text("group").notNull(), // A-L
    groupPosition: smallint("group_position").notNull(), // 1-4 within group
    eliminated: boolean("eliminated").default(false).notNull(),
  },
  (table) => [uniqueIndex("teams_code_idx").on(table.code)]
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
    matchNumber: smallint("match_number").notNull(), // 1-104, FIFA official numbering
    homeTeamId: uuid("home_team_id").references(() => teams.id),
    awayTeamId: uuid("away_team_id").references(() => teams.id),
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
    stage: matchStageEnum("stage").notNull(),
    groupLabel: text("group_label"), // A-L for group stage, null for knockouts
    venue: text("venue"), // optional, nice to have
    isVoided: boolean("is_voided").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("matches_number_idx").on(table.matchNumber),
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
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  recordedBy: uuid("recorded_by")
    .references(() => users.id)
    .notNull(),
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
 * Tournament-long bonus predictions. One row per user.
 * Locked at tournament start (June 11, 2026 first kickoff).
 */
export const bonusPredictions = pgTable("bonus_predictions", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  championTeamId: uuid("champion_team_id").references(() => teams.id),
  runnerUpTeamId: uuid("runner_up_team_id").references(() => teams.id),
  thirdPlaceTeamId: uuid("third_place_team_id").references(() => teams.id),
  semifinalists: jsonb("semifinalists").$type<string[]>(), // array of 4 team UUIDs
  topScorerName: text("top_scorer_name"), // free-form, Golden Boot
  bestPlayerName: text("best_player_name"), // free-form, Golden Ball
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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
