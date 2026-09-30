-- REVIEW ONLY. Never execute this file. No production rollback authorized.
-- Requires separate approval, fresh exact identity/ACL/dependency/ledger review,
-- quiesced server callers, and removal of acknowledgment objects first.
BEGIN;
DO $review_only$
BEGIN
 RAISE EXCEPTION 'LP24466A_REVIEW_ONLY_NOT_AUTHORIZED';
END
$review_only$;

DO $precheck$
DECLARE f regprocedure;
BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'rollback_owner_mismatch'; END IF;
 IF to_regclass('subscription_ops.google_ack_work') IS NOT NULL
 OR to_regclass('subscription_ops.google_ack_health') IS NOT NULL
 OR to_regprocedure('public.gridly_enqueue_google_ack(jsonb)') IS NOT NULL
 OR to_regprocedure('public.gridly_claim_google_ack(text,integer,text)') IS NOT NULL
 OR to_regprocedure('public.gridly_resolve_google_ack(text,text,uuid,text,text)') IS NOT NULL
 OR to_regprocedure('public.gridly_google_ack_health()') IS NOT NULL THEN
  RAISE EXCEPTION 'rollback_ack_dependency_present';
 END IF;
 IF NOT EXISTS (SELECT FROM pg_namespace WHERE nspname='subscription_ops' AND nspowner='postgres'::regrole)
 OR NOT EXISTS (SELECT FROM pg_class WHERE oid='subscription_ops.store_entitlements'::regclass AND relkind='r' AND relowner='postgres'::regrole AND relrowsecurity) THEN
  RAISE EXCEPTION 'rollback_cache_mismatch';
 END IF;
 FOREACH f IN ARRAY ARRAY['public.gridly_reconcile_store_entitlement(jsonb)'::regprocedure,'public.gridly_prune_store_entitlement_cache(integer)'::regprocedure] LOOP
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid=f AND proowner='postgres'::regrole AND prosecdef AND proconfig=ARRAY['search_path=""']::text[]) THEN
   RAISE EXCEPTION 'rollback_function_mismatch';
  END IF;
 END LOOP;
END
$precheck$;
LOCK TABLE subscription_ops.store_entitlements IN ACCESS EXCLUSIVE MODE;
DROP FUNCTION public.gridly_prune_store_entitlement_cache(integer);
DROP FUNCTION public.gridly_reconcile_store_entitlement(jsonb);
DROP TABLE subscription_ops.store_entitlements;
-- Any unexpected remaining schema object/dependency makes DROP fail atomically.
DROP SCHEMA subscription_ops;
-- Cache metadata lost if a separately approved copy commits. No history repair.
COMMIT;
