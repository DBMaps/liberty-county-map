-- REVIEW ONLY. Never execute this file. No production rollback authorized.
-- A future operator copy needs separate approval and fresh exact function-body,
-- ACL/membership, dependency/ledger review and quiesced/drained server callers.
-- No migration ledger repair; no CASCADE; no worker/job changes here.
BEGIN;
DO $review_only$
BEGIN
 RAISE EXCEPTION 'LP24466A_REVIEW_ONLY_NOT_AUTHORIZED';
END
$review_only$;

DO $precheck$
DECLARE f regprocedure; t regclass;
BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'rollback_owner_mismatch'; END IF;
 FOREACH t IN ARRAY ARRAY['subscription_ops.google_ack_work'::regclass,'subscription_ops.google_ack_health'::regclass] LOOP
  IF NOT EXISTS (SELECT FROM pg_class WHERE oid=t AND relkind='r' AND relowner='postgres'::regrole AND relrowsecurity) THEN
   RAISE EXCEPTION 'rollback_table_mismatch';
  END IF;
 END LOOP;
 FOREACH f IN ARRAY ARRAY['public.gridly_enqueue_google_ack(jsonb)'::regprocedure,'public.gridly_claim_google_ack(text,integer,text)'::regprocedure,'public.gridly_resolve_google_ack(text,text,uuid,text,text)'::regprocedure,'public.gridly_google_ack_health()'::regprocedure] LOOP
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid=f AND proowner='postgres'::regrole AND prosecdef AND proconfig=ARRAY['search_path=""']::text[]) THEN
   RAISE EXCEPTION 'rollback_function_mismatch';
  END IF;
 END LOOP;
END
$precheck$;
LOCK TABLE subscription_ops.google_ack_work,subscription_ops.google_ack_health IN ACCESS EXCLUSIVE MODE;
DO $pending$
BEGIN
 IF EXISTS (SELECT FROM subscription_ops.google_ack_work) THEN
  RAISE EXCEPTION 'rollback_pending_work_refused';
 END IF;
END
$pending$;
DROP FUNCTION public.gridly_google_ack_health();
DROP FUNCTION public.gridly_resolve_google_ack(text,text,uuid,text,text);
DROP FUNCTION public.gridly_claim_google_ack(text,integer,text);
DROP FUNCTION public.gridly_enqueue_google_ack(jsonb);
DROP TABLE subscription_ops.google_ack_work;
DROP TABLE subscription_ops.google_ack_health;
-- Private cache/schema, all existing production data and ledger remain.
-- New aggregate evidence is lost if a separately approved copy commits.
COMMIT;
