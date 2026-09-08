-- LP244.22A: intentionally superseded before production deployment.
-- This migration version is a no-op history checkpoint. The complete retention,
-- reset, protocol, and privilege transition is atomic in 20260908200554.
begin;
set local statement_timeout = '10s';
select 1;
commit;
