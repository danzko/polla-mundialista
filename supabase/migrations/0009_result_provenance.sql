-- ============================================================
-- 0009 Result provenance + machine-recorded results (June 12, 2026)
-- Applied live via Supabase MCP as: result_provenance
--
-- Owner decision (June 12, "auto confirm"): ESPN finals auto-confirm
-- into match_results once the score has been stable ~5 min past full
-- time. The sync inserts with ON CONFLICT DO NOTHING, so it can never
-- overwrite a human-entered or corrected result.
--
-- recorded_by becomes nullable: NULL = recorded by the sync, a user
-- id = recorded by that human. source disambiguates further:
--   'admin'     manual entry on /admin
--   'espn'      human tapped Confirmar/Usar ESPN on staged data
--   'espn-auto' auto-confirmed by live-scores-sync
-- ============================================================

alter table public.match_results alter column recorded_by drop not null;

alter table public.match_results
  add column if not exists source text not null default 'admin';
