-- LP244.71 source migration. Apply only in a separately authorized deployment.
-- No scheduling, reporting, credential, or Apple changes.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('subscription_ops.store_entitlements') IS NULL
 OR to_regclass('subscription_ops.google_token_lineage') IS NOT NULL
 THEN RAISE EXCEPTION 'google_contract_prerequisite_mismatch'; END IF;
END $$;

-- Old-product cache rows are only disposable after their ten-minute TTL.
DELETE FROM subscription_ops.store_entitlements
 WHERE platform='google' AND product_id='gridly_monthly' AND cache_expires_at<=transaction_timestamp();
DO $$ BEGIN
 IF EXISTS(SELECT FROM subscription_ops.store_entitlements WHERE platform='google' AND product_id='gridly_monthly')
 THEN RAISE EXCEPTION 'unexpired_old_google_product_cache'; END IF;
END $$;
ALTER TABLE subscription_ops.store_entitlements
 DROP CONSTRAINT store_entitlements_check,
 DROP CONSTRAINT store_entitlements_check1,
 DROP CONSTRAINT store_entitlements_subscription_state_check,
 ADD CONSTRAINT store_entitlements_lp24471_product_check CHECK
  ((platform='apple' AND product_id='com.gridlygo.gridly.monthly' AND base_plan_id IS NULL)
   OR (platform='google' AND product_id='com.gridlygo.gridly.monthly' AND base_plan_id='monthly')),
 ADD CONSTRAINT store_entitlements_lp24471_state_check CHECK
  (subscription_state IN ('active','inactive','expired','canceled_pending_expiry','grace_period','unknown')),
 ADD CONSTRAINT store_entitlements_lp24471_entitlement_check CHECK
  (entitlement_state=CASE WHEN subscription_state IN ('active','canceled_pending_expiry','grace_period') THEN 'entitled'
   WHEN subscription_state='unknown' THEN 'unknown' ELSE 'not_entitled' END);

-- HMAC fingerprints only. A predecessor can have exactly one verified successor;
-- retaining this private ledger prevents later replay of replaced tokens.
CREATE TABLE subscription_ops.google_token_lineage (
 environment text NOT NULL CHECK(environment IN ('production','sandbox_test')),
 predecessor_fingerprint text NOT NULL CHECK(predecessor_fingerprint ~ '^[a-f0-9]{64}$'),
 successor_fingerprint text NOT NULL CHECK(successor_fingerprint ~ '^[a-f0-9]{64}$'),
 linked_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY(environment,predecessor_fingerprint),
 CHECK(predecessor_fingerprint<>successor_fingerprint)
);
CREATE INDEX google_token_lineage_successor ON subscription_ops.google_token_lineage(environment,successor_fingerprint);
ALTER TABLE subscription_ops.google_token_lineage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON subscription_ops.google_token_lineage FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.gridly_reconcile_google_entitlement(p_record jsonb,p_lineage jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_fp text; env text; chain text[]; predecessor text; existing text; i integer;
BEGIN
 IF p_record IS NULL OR p_record->>'platform'<>'google' OR p_record->>'product_id'<>'com.gridlygo.gridly.monthly'
  OR p_record->>'base_plan_id'<>'monthly' OR p_lineage IS NULL OR jsonb_typeof(p_lineage)<>'array'
  OR jsonb_array_length(p_lineage)>4 THEN RAISE EXCEPTION 'invalid_google_lineage'; END IF;
 current_fp:=p_record->>'chain_fingerprint';env:=p_record->>'environment';
 IF current_fp !~ '^[a-f0-9]{64}$' OR env NOT IN ('production','sandbox_test') THEN RAISE EXCEPTION 'invalid_google_lineage'; END IF;
 chain:=ARRAY[current_fp];
 FOR i IN 0..jsonb_array_length(p_lineage)-1 LOOP
  IF jsonb_typeof(p_lineage->i)<>'string' THEN RAISE EXCEPTION 'invalid_google_lineage'; END IF;
  predecessor:=p_lineage->>i;
  IF predecessor !~ '^[a-f0-9]{64}$' OR predecessor=ANY(chain) THEN RAISE EXCEPTION 'invalid_google_lineage'; END IF;
  chain:=array_append(chain,predecessor);
 END LOOP;
 -- Serialize replacement checks and inserts, including competing invocations.
 LOCK TABLE subscription_ops.google_token_lineage IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT FROM subscription_ops.google_token_lineage
  WHERE environment=env AND predecessor_fingerprint=current_fp) THEN RETURN false; END IF;
 FOR i IN 2..array_length(chain,1) LOOP
  SELECT successor_fingerprint INTO existing FROM subscription_ops.google_token_lineage
   WHERE environment=env AND predecessor_fingerprint=chain[i];
  IF existing IS NOT NULL AND existing<>chain[i-1] THEN RETURN false; END IF;
 END LOOP;
 IF NOT public.gridly_reconcile_store_entitlement(p_record) THEN RETURN false; END IF;
 FOR i IN 2..array_length(chain,1) LOOP
  INSERT INTO subscription_ops.google_token_lineage(environment,predecessor_fingerprint,successor_fingerprint)
   VALUES(env,chain[i],chain[i-1]) ON CONFLICT(environment,predecessor_fingerprint) DO NOTHING;
 END LOOP;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.gridly_reconcile_google_entitlement(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE role_name text; BEGIN
 FOR role_name IN SELECT r.rolname FROM pg_proc p
  CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  JOIN pg_roles r ON r.oid=a.grantee
  WHERE p.oid='public.gridly_reconcile_google_entitlement(jsonb,jsonb)'::regprocedure
   AND a.privilege_type='EXECUTE' AND a.grantee NOT IN (p.proowner,'service_role'::regrole::oid)
 LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION public.gridly_reconcile_google_entitlement(jsonb,jsonb) FROM %I',role_name);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.gridly_reconcile_google_entitlement(jsonb,jsonb) TO service_role;
DO $$ DECLARE f oid:='public.gridly_reconcile_google_entitlement(jsonb,jsonb)'::regprocedure; BEGIN
 IF (SELECT proowner FROM pg_proc WHERE oid=f)<>'postgres'::regrole
 OR NOT (SELECT prosecdef FROM pg_proc WHERE oid=f)
 OR (SELECT proconfig FROM pg_proc WHERE oid=f) IS DISTINCT FROM ARRAY['search_path=""']::text[]
 OR has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('authenticated',f,'EXECUTE')
 OR NOT has_function_privilege('service_role',f,'EXECUTE')
 OR EXISTS(SELECT FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid=f AND a.privilege_type='EXECUTE' AND a.grantee NOT IN (p.proowner,'service_role'::regrole::oid))
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='subscription_ops.google_token_lineage'::regclass)
 THEN RAISE EXCEPTION 'google_lineage_privilege_mismatch'; END IF;
END $$;
COMMIT;
