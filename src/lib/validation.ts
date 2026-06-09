import { z } from 'zod';

export const displayNameSchema = z
  .string()
  .min(2, { message: 'Display name must be at least 2 characters.' })
  .max(40, { message: 'Display name cannot exceed 40 characters.' })
  .transform((val) => val.trim());

export const emailSchema = z
  .string()
  .email({ message: 'Please enter a valid email address.' })
  .transform((val) => val.trim().toLowerCase());

export const leagueNameSchema = z
  .string()
  .min(2, { message: 'League name must be at least 2 characters.' })
  .max(40, { message: 'League name cannot exceed 40 characters.' })
  .transform((val) => val.trim());

export const inviteCodeSchema = z
  .string()
  .length(6, { message: 'Invite code must be exactly 6 characters.' })
  .regex(/^[a-zA-Z0-9]+$/, { message: 'Invite code must contain only letters and numbers.' })
  .transform((val) => val.trim().toUpperCase());

export const scoreSchema = z
  .number({ message: 'Must be a number.' })
  .int({ message: 'Must be an integer.' })
  .min(0, { message: 'Score cannot be negative.' })
  .max(15, { message: 'Score cannot exceed 15.' });

export const bonusPredictionsSchema = z.object({
  championTeamId: z.string().nullable(),
  runnerUpTeamId: z.string().nullable(),
  thirdPlaceTeamId: z.string().nullable(),
  semifinalists: z
    .array(z.string())
    .max(4, { message: 'You can pick up to 4 semifinalists.' })
    .refine((arr) => new Set(arr).size === arr.length, {
      message: 'Semifinalists must be unique teams.',
    }),
  topScorerName: z
    .string()
    .max(60, { message: 'Name cannot exceed 60 characters.' })
    .transform((val) => val.trim())
    .nullable(),
  bestPlayerName: z
    .string()
    .max(60, { message: 'Name cannot exceed 60 characters.' })
    .transform((val) => val.trim())
    .nullable(),
});
