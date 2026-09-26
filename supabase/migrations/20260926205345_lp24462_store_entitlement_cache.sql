-- LP244.62 LOCAL FOUNDATION ONLY. Production application requires separate approval.
BEGIN;
DO $$ BEGIN
 IF current_user <> 'postgres' OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='subscription_ops')
 THEN RAISE EXCEPTION 'LP244.62 precheck failed'; END IF;
END $$;
CREATE SCHEMA subscription_ops AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA subscription_ops FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE subscription_ops.store_entitlements (
 platform text NOT NULL CHECK(platform IN ('apple','google')),
 environment text NOT NULL CHECK(environment IN ('production','sandbox_test')),
 chain_fingerprint text NOT NULL CHECK(chain_fingerprint ~ '^[a-f0-9]{64}$'),
 product_id text NOT NULL,
 base_plan_id text,
 subscription_state text NOT NULL CHECK(subscription_state IN ('active','inactive','expired','canceled_pending_expiry','unknown')),
 entitlement_state text NOT NULL CHECK(entitlement_state IN ('entitled','not_entitled','unknown')),
 current_period_end timestamptz,
 last_verified_at timestamptz NOT NULL,
 verification_source text NOT NULL CHECK(verification_source='gridly_server_store_api'),
 error_category text NOT NULL CHECK(error_category IN ('none','verification_unavailable','purchase_pending')),
 reconciled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 cache_expires_at timestamptz NOT NULL,
 PRIMARY KEY(platform,environment,chain_fingerprint),
 CHECK((platform='apple' AND product_id='com.gridlygo.gridly.monthly' AND base_plan_id IS NULL)
  OR (platform='google' AND product_id='gridly_monthly' AND base_plan_id IS NOT NULL AND base_plan_id='monthly')),
 CHECK(entitlement_state=CASE WHEN subscription_state IN ('active','canceled_pending_expiry') THEN 'entitled'
  WHEN subscription_state='unknown' THEN 'unknown' ELSE 'not_entitled' END),
 CHECK(entitlement_state<>'entitled' OR (current_period_end IS NOT NULL AND current_period_end>last_verified_at AND error_category='none')),
 CHECK(subscription_state<>'expired' OR (current_period_end IS NOT NULL AND current_period_end<=last_verified_at)),
 CHECK(cache_expires_at=last_verified_at+interval '24 hours')
);
ALTER TABLE subscription_ops.store_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON subscription_ops.store_entitlements FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX store_entitlements_cache_expiry ON subscription_ops.store_entitlements(cache_expires_at);

CREATE FUNCTION public.gridly_reconcile_store_entitlement(p_record jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r subscription_ops.store_entitlements; changed integer;
BEGIN
 IF p_record IS NULL OR jsonb_typeof(p_record)<>'object' OR octet_length(p_record::text)>8192
  OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_record) k)
    IS DISTINCT FROM ARRAY['base_plan_id','chain_fingerprint','current_period_end','entitlement_state','environment','error_category','last_verified_at','platform','product_id','subscription_state','verification_source']::text[]
 THEN RAISE EXCEPTION 'Invalid entitlement record'; END IF;
 r := jsonb_populate_record(NULL::subscription_ops.store_entitlements,p_record);
 IF r.last_verified_at IS NULL OR r.last_verified_at>clock_timestamp()+interval '5 seconds'
  OR r.last_verified_at<clock_timestamp()-interval '5 minutes'
 THEN RAISE EXCEPTION 'Invalid verification time'; END IF;
 INSERT INTO subscription_ops.store_entitlements(platform,environment,chain_fingerprint,product_id,base_plan_id,
 subscription_state,entitlement_state,current_period_end,last_verified_at,verification_source,error_category,cache_expires_at)
 VALUES(r.platform,r.environment,r.chain_fingerprint,r.product_id,r.base_plan_id,r.subscription_state,r.entitlement_state,
 r.current_period_end,r.last_verified_at,r.verification_source,r.error_category,r.last_verified_at+interval '24 hours')
 ON CONFLICT(platform,environment,chain_fingerprint) DO UPDATE SET
 product_id=excluded.product_id,base_plan_id=excluded.base_plan_id,subscription_state=excluded.subscription_state,
 entitlement_state=excluded.entitlement_state,current_period_end=excluded.current_period_end,
 last_verified_at=excluded.last_verified_at,verification_source=excluded.verification_source,error_category=excluded.error_category,
 reconciled_at=clock_timestamp(),cache_expires_at=excluded.cache_expires_at
 WHERE excluded.last_verified_at>subscription_ops.store_entitlements.last_verified_at;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed=1 THEN RETURN true; END IF;
 -- Exact retries are idempotent; stale/conflicting observations cannot sign access.
 RETURN EXISTS(SELECT 1 FROM subscription_ops.store_entitlements c
 WHERE c.platform=r.platform AND c.environment=r.environment AND c.chain_fingerprint=r.chain_fingerprint
 AND c.last_verified_at=r.last_verified_at AND c.product_id=r.product_id
 AND c.base_plan_id IS NOT DISTINCT FROM r.base_plan_id AND c.subscription_state=r.subscription_state
 AND c.entitlement_state=r.entitlement_state AND c.current_period_end IS NOT DISTINCT FROM r.current_period_end
 AND c.verification_source=r.verification_source AND c.error_category=r.error_category);
END $$;
CREATE FUNCTION public.gridly_prune_store_entitlement_cache(p_limit integer DEFAULT 500)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE removed integer;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid prune bound'; END IF;
 WITH due AS (SELECT platform,environment,chain_fingerprint FROM subscription_ops.store_entitlements
 WHERE cache_expires_at<=statement_timestamp() ORDER BY cache_expires_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
 DELETE FROM subscription_ops.store_entitlements c USING due
 WHERE c.platform=due.platform AND c.environment=due.environment AND c.chain_fingerprint=due.chain_fingerprint;
 GET DIAGNOSTICS removed=ROW_COUNT; RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.gridly_reconcile_store_entitlement(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gridly_prune_store_entitlement_cache(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gridly_reconcile_store_entitlement(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gridly_prune_store_entitlement_cache(integer) TO service_role;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT * FROM pg_proc WHERE oid IN ('public.gridly_reconcile_store_entitlement(jsonb)'::regprocedure,
 'public.gridly_prune_store_entitlement_cache(integer)'::regprocedure) LOOP
 IF f.proowner<>'postgres'::regrole OR NOT f.prosecdef OR f.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a WHERE a.privilege_type='EXECUTE'
  AND (a.grantee NOT IN (f.proowner,'service_role'::regrole::oid) OR (a.grantee='service_role'::regrole::oid AND a.is_grantable)))
 OR NOT has_function_privilege('service_role',f.oid,'EXECUTE')
 OR has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE')
 THEN RAISE EXCEPTION 'LP244.62 function ACL failed'; END IF; END LOOP;
 IF NOT(SELECT relrowsecurity FROM pg_class WHERE oid='subscription_ops.store_entitlements'::regclass)
 OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  WHERE c.oid='subscription_ops.store_entitlements'::regclass AND a.grantee<>c.relowner)
 THEN RAISE EXCEPTION 'LP244.62 table ACL failed'; END IF;
END $$;
COMMIT;
