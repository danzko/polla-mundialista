-- ============================================================
-- 0034 Reminder emails: opt-out + send log (Nov 2026)
--
--   * users.email_reminders: false = never email this person a reminder.
--     Set by the unsubscribe link in every email (service role, via a signed
--     URL). Default true: opt-out, not opt-in (owner default, Sept 2026).
--   * reminder_log: one row per reminder actually sent. The primary key IS
--     the dedupe rule (max one email per user / tournament / kind / round),
--     so the cron is idempotent: safe to re-run, retry or trigger by hand
--     without double-sending. Written before sending, removed if the send
--     fails so the next run retries.
-- RLS is on with NO policies on reminder_log: invisible to every client;
-- only the service role (the cron route) reads or writes it.
-- ============================================================
alter table public.users add column if not exists email_reminders boolean not null default true;

create table if not exists public.reminder_log (
  user_id       uuid not null references public.users(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  kind          text not null check (kind in ('matchday', 'picks')),
  round_key     text not null,
  sent_at       timestamptz not null default now(),
  primary key (user_id, tournament_id, kind, round_key)
);
alter table public.reminder_log enable row level security;
