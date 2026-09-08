-- NOT a migration and NOT authorized to run in this task.
-- After backup/log inventory, staging rehearsal, coordinated client rollout and
-- explicit production approval, run as the database owner. No credentials here.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create extension if not exists pg_cron;
select cron.schedule('gridly-community-report-retention', '* * * * *',
  'select report_retention.run_cleanup()');
do $$ begin
  if (select count(*) from cron.job
      where jobname='gridly-community-report-retention'
        and schedule='* * * * *'
        and command='select report_retention.run_cleanup()'
        and active) <> 1 then
    raise exception 'Report retention Cron activation did not reach the exact expected state';
  end if;
end $$;
commit;
-- An EXTERNAL monitor must poll report_retention.health every minute and page on
-- last_status != succeeded, missing/stale (>5 minutes) success, or overdue rows.
-- Cron success alone is insufficient: run_cleanup returns -1 on caught failure.
-- Check cron.job_run_details for uncaught errors and interrupted transactions.
