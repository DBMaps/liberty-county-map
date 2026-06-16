-- V371 — Additive Historical Schema Rollback Draft
-- Draft only: use only if the V371 historical schema draft has been applied
-- in a future approved migration window.
-- Drops only new V371 historical tables and their dependent indexes/policies.
-- Does not touch public.reports or any existing production table.

drop policy if exists "Deny client recurrence index reads" on public.incident_recurrence_index;
drop policy if exists "Deny client incident event reads" on public.incident_events;
drop policy if exists "Deny client historical incident reads" on public.historical_incidents;

drop table if exists public.incident_recurrence_index;
drop table if exists public.incident_events;
drop table if exists public.historical_incidents;
