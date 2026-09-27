-- LP244.66B LOCAL REVIEW DRAFT. Never apply without separate production approval.
-- Revised UNAPPLIED version 20260927204849; cache prerequisite also unapplied.
-- No scheduler/deployment/reporting changes in this migration.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('subscription_ops.store_entitlements') IS NULL
 OR to_regclass('subscription_ops.google_ack_work') IS NOT NULL THEN RAISE EXCEPTION 'ack_prerequisite_mismatch'; END IF;
END $$;
CREATE TABLE subscription_ops.google_ack_work (
 environment text NOT NULL CHECK(environment IN ('production','sandbox_test')),
 chain_fingerprint text NOT NULL CHECK(chain_fingerprint ~ '^[a-f0-9]{64}$'),
 ciphertext text NOT NULL CHECK(length(ciphertext) BETWEEN 23 AND 21867 AND ciphertext ~ '^[A-Za-z0-9_-]+$'),
 iv text NOT NULL CHECK(iv ~ '^[A-Za-z0-9_-]{16}$'),
 key_version text NOT NULL CHECK(key_version ~ '^[a-zA-Z0-9_-]{1,32}$'),
 queue_state text NOT NULL DEFAULT 'queued' CHECK(queue_state IN ('queued','leased','retry')),
 source_started_at timestamptz NOT NULL,
 provider_deadline_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 expires_at timestamptz NOT NULL,
 next_attempt_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 lease uuid,lease_until timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 1000000),
 error_category text NOT NULL DEFAULT 'none' CHECK(error_category IN ('none','provider_unavailable','credential_unavailable','reconciliation_retry')),
 PRIMARY KEY(environment,chain_fingerprint),
 CHECK(source_started_at<=created_at AND expires_at>created_at AND expires_at<=created_at+interval '1 hour'
 AND expires_at<=source_started_at+interval '1 hour' AND expires_at<=provider_deadline_at),
 CHECK((queue_state='leased')=(lease IS NOT NULL) AND (lease IS NULL)=(lease_until IS NULL))
);
CREATE INDEX google_ack_due ON subscription_ops.google_ack_work(environment,next_attempt_at);
CREATE INDEX google_ack_expiry ON subscription_ops.google_ack_work(environment,expires_at);
CREATE INDEX google_ack_created ON subscription_ops.google_ack_work(environment,created_at);
CREATE TABLE subscription_ops.google_ack_health (
 environment text PRIMARY KEY CHECK(environment IN ('production','sandbox_test')),
 last_tick_at timestamptz,
 last_completed_at timestamptz,
 last_purge_at timestamptz,
 window_started_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 completed_count integer NOT NULL DEFAULT 0 CHECK(completed_count BETWEEN 0 AND 1000000),
 denied_count integer NOT NULL DEFAULT 0 CHECK(denied_count BETWEEN 0 AND 1000000),
 expired_count integer NOT NULL DEFAULT 0 CHECK(expired_count BETWEEN 0 AND 1000000),
 terminal_count integer NOT NULL DEFAULT 0 CHECK(terminal_count BETWEEN 0 AND 1000000),
 last_error_category text NOT NULL DEFAULT 'none' CHECK(last_error_category IN ('none','provider_unavailable','credential_unavailable','reconciliation_retry','invalid_purchase','subscription_expired','purchase_canceled','provider_denial','cipher_invalid','key_version_unavailable','retry_deadline','configuration_unavailable'))
);
INSERT INTO subscription_ops.google_ack_health(environment) VALUES('production'),('sandbox_test');
ALTER TABLE subscription_ops.google_ack_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_ops.google_ack_health ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON subscription_ops.google_ack_work,subscription_ops.google_ack_health FROM PUBLIC,anon,authenticated,service_role;

-- Private aggregate helper: postgres only. Window reset does not extend work TTL.
CREATE FUNCTION subscription_ops.roll_ack_health(p_environment text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE subscription_ops.google_ack_health SET window_started_at=transaction_timestamp(),completed_count=0,denied_count=0,expired_count=0,terminal_count=0,last_error_category='none'
 WHERE environment=p_environment AND window_started_at<=transaction_timestamp()-interval '24 hours';
END $$;

CREATE FUNCTION public.gridly_enqueue_google_ack(p_record jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE period_end timestamptz;t timestamptz:=transaction_timestamp();deadline timestamptz;started timestamptz;provider_end timestamptz;
BEGIN
 IF p_record IS NULL OR jsonb_typeof(p_record)<>'object' OR octet_length(p_record::text)>24000
 OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_record) k) IS DISTINCT FROM
 ARRAY['chain_fingerprint','ciphertext','environment','iv','key_version','provider_deadline_at','source_started_at']::text[] THEN RAISE EXCEPTION 'invalid_ack_record'; END IF;
 SELECT current_period_end INTO period_end FROM subscription_ops.store_entitlements
 WHERE platform='google' AND environment=p_record->>'environment' AND chain_fingerprint=p_record->>'chain_fingerprint'
 AND entitlement_state='entitled' AND subscription_state IN ('active','canceled_pending_expiry') AND current_period_end>t
 AND cache_expires_at>t AND last_verified_at>=t-interval '5 minutes' AND last_verified_at<=t+interval '5 seconds';
 IF period_end IS NULL THEN RETURN false; END IF;
 started:=(p_record->>'source_started_at')::timestamptz;provider_end:=(p_record->>'provider_deadline_at')::timestamptz;
 IF started IS NULL OR provider_end IS NULL OR started>t THEN RAISE EXCEPTION 'invalid_ack_deadline'; END IF;
 deadline:=least(t+interval '1 hour',started+interval '1 hour',provider_end,period_end,
 started+CASE WHEN p_record->>'environment'='sandbox_test' THEN interval '3 minutes' ELSE interval '3 days' END);
 IF deadline<=t THEN
  PERFORM subscription_ops.roll_ack_health(p_record->>'environment');
  UPDATE subscription_ops.google_ack_health SET terminal_count=least(1000000,terminal_count+1),expired_count=least(1000000,expired_count+1),last_error_category='retry_deadline' WHERE environment=p_record->>'environment';
  RETURN false;
 END IF;
 INSERT INTO subscription_ops.google_ack_work(environment,chain_fingerprint,ciphertext,iv,key_version,source_started_at,provider_deadline_at,expires_at)
 VALUES(p_record->>'environment',p_record->>'chain_fingerprint',p_record->>'ciphertext',p_record->>'iv',p_record->>'key_version',started,provider_end,deadline)
 ON CONFLICT(environment,chain_fingerprint) DO NOTHING;
 RETURN EXISTS(SELECT FROM subscription_ops.google_ack_work WHERE environment=p_record->>'environment' AND chain_fingerprint=p_record->>'chain_fingerprint' AND expires_at>t);
END $$;

CREATE FUNCTION public.gridly_prune_google_ack_work(p_environment text,p_limit integer DEFAULT 500) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF p_environment IS NULL OR p_environment NOT IN ('production','sandbox_test') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid_ack_prune'; END IF;
 PERFORM subscription_ops.roll_ack_health(p_environment);
 WITH due AS (SELECT w.environment,w.chain_fingerprint FROM subscription_ops.google_ack_work w
 WHERE w.environment=p_environment AND w.expires_at<=transaction_timestamp() ORDER BY w.expires_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
 DELETE FROM subscription_ops.google_ack_work w USING due WHERE w.environment=due.environment AND w.chain_fingerprint=due.chain_fingerprint;
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE subscription_ops.google_ack_health SET last_purge_at=transaction_timestamp(),expired_count=least(1000000,expired_count+n),terminal_count=least(1000000,terminal_count+n),last_error_category=CASE WHEN n>0 THEN 'retry_deadline' ELSE last_error_category END WHERE environment=p_environment;
 RETURN n;
END $$;

CREATE FUNCTION public.gridly_claim_google_ack(p_environment text,p_limit integer DEFAULT 10,p_fingerprint text DEFAULT NULL)
RETURNS TABLE(environment text,chain_fingerprint text,ciphertext text,iv text,key_version text,lease uuid,lease_until timestamptz,expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t timestamptz:=transaction_timestamp();
BEGIN
 IF p_environment IS NULL OR p_environment NOT IN ('production','sandbox_test') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10
 OR(p_fingerprint IS NOT NULL AND p_fingerprint !~ '^[a-f0-9]{64}$') THEN RAISE EXCEPTION 'invalid_ack_claim'; END IF;
 -- Opportunistic pruning is no longer the ONLY deletion path.
 PERFORM public.gridly_prune_google_ack_work(p_environment,100);
 UPDATE subscription_ops.google_ack_health SET last_tick_at=t WHERE google_ack_health.environment=p_environment;
 RETURN QUERY WITH ready AS(SELECT w.environment,w.chain_fingerprint FROM subscription_ops.google_ack_work w
 WHERE w.environment=p_environment AND w.expires_at>t AND w.next_attempt_at<=t AND(w.lease_until IS NULL OR w.lease_until<=t)
 AND(p_fingerprint IS NULL OR w.chain_fingerprint=p_fingerprint)
 ORDER BY w.next_attempt_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
 UPDATE subscription_ops.google_ack_work w SET queue_state='leased',lease=gen_random_uuid(),lease_until=t+interval '60 seconds',attempts=least(1000000,w.attempts+1)
 FROM ready WHERE w.environment=ready.environment AND w.chain_fingerprint=ready.chain_fingerprint
 RETURNING w.environment,w.chain_fingerprint,w.ciphertext,w.iv,w.key_version,w.lease,w.lease_until,w.expires_at;
END $$;

CREATE FUNCTION public.gridly_resolve_google_ack(p_environment text,p_fingerprint text,p_lease uuid,p_outcome text,p_error_category text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF p_outcome IS NULL OR p_outcome NOT IN('success','denied','terminal','retry') OR p_error_category IS NULL
 OR (p_outcome='success' AND p_error_category<>'none')
 OR (p_outcome='retry' AND p_error_category NOT IN('provider_unavailable','credential_unavailable','reconciliation_retry'))
 OR (p_outcome IN('denied','terminal') AND p_error_category NOT IN('invalid_purchase','subscription_expired','purchase_canceled','provider_denial','cipher_invalid','key_version_unavailable','retry_deadline')) THEN RAISE EXCEPTION 'invalid_ack_outcome'; END IF;
 IF p_outcome='retry' THEN
  UPDATE subscription_ops.google_ack_work SET queue_state='retry',lease=NULL,lease_until=NULL,next_attempt_at=transaction_timestamp()+interval '1 minute',error_category=p_error_category
  WHERE environment=p_environment AND chain_fingerprint=p_fingerprint AND lease=p_lease AND lease_until>transaction_timestamp() AND expires_at>transaction_timestamp();
 ELSE
  DELETE FROM subscription_ops.google_ack_work WHERE environment=p_environment AND chain_fingerprint=p_fingerprint AND lease=p_lease AND lease_until>transaction_timestamp();
 END IF;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n=1 THEN
  PERFORM subscription_ops.roll_ack_health(p_environment);
  UPDATE subscription_ops.google_ack_health SET completed_count=least(1000000,completed_count+(p_outcome='success')::integer),
  denied_count=least(1000000,denied_count+(p_outcome='denied' OR p_error_category IN('provider_denial','subscription_expired','purchase_canceled','invalid_purchase'))::integer),
  terminal_count=least(1000000,terminal_count+(p_outcome IN('terminal','denied'))::integer),
  expired_count=least(1000000,expired_count+(p_error_category='retry_deadline')::integer),last_error_category=CASE WHEN p_outcome='success' THEN last_error_category ELSE p_error_category END
  WHERE environment=p_environment;
 END IF;
 RETURN n=1;
END $$;

CREATE FUNCTION public.gridly_complete_google_ack_run(p_environment text,p_error_category text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_environment IS NULL OR p_environment NOT IN('production','sandbox_test') OR p_error_category IS NULL OR p_error_category NOT IN('none','provider_unavailable','credential_unavailable','configuration_unavailable','reconciliation_retry') THEN RAISE EXCEPTION 'invalid_ack_run'; END IF;
 PERFORM subscription_ops.roll_ack_health(p_environment);
 UPDATE subscription_ops.google_ack_health SET last_completed_at=transaction_timestamp(),last_error_category=p_error_category WHERE environment=p_environment;
 RETURN FOUND;
END $$;

CREATE FUNCTION public.gridly_subscription_housekeeping() RETURNS TABLE(queue_purged integer,cache_purged integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;c integer;
BEGIN
 n:=public.gridly_prune_google_ack_work('production',500)+public.gridly_prune_google_ack_work('sandbox_test',500);
 c:=public.gridly_prune_store_entitlement_cache(500);
 RETURN QUERY SELECT n,c;
END $$;

CREATE FUNCTION public.gridly_google_ack_health() RETURNS TABLE(environment text,subsystem text,last_tick_at timestamptz,last_completed_at timestamptz,last_purge_at timestamptz,pending_count bigint,due_count bigint,failed_count bigint,stale_count bigint,overdue_count bigint,oldest_pending_age_seconds integer,completed_count integer,denied_count integer,expired_count integer,terminal_count integer,error_category text)
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT h.environment,'google_ack'::text,h.last_tick_at,h.last_completed_at,h.last_purge_at,
 (SELECT count(*) FROM(SELECT 1 FROM subscription_ops.google_ack_work w WHERE w.environment=h.environment LIMIT 1000000)b),
 (SELECT count(*) FROM(SELECT 1 FROM subscription_ops.google_ack_work w WHERE w.environment=h.environment AND w.next_attempt_at<=transaction_timestamp() AND w.expires_at>transaction_timestamp() AND(w.lease_until IS NULL OR w.lease_until<=transaction_timestamp()) LIMIT 1000000)b),
 (SELECT count(*) FROM(SELECT 1 FROM subscription_ops.google_ack_work w WHERE w.environment=h.environment AND w.error_category<>'none' LIMIT 1000000)b),
 (SELECT count(*) FROM(SELECT 1 FROM subscription_ops.google_ack_work w WHERE w.environment=h.environment AND w.created_at<=transaction_timestamp()-interval '1 minute' LIMIT 1000000)b),
 (SELECT count(*) FROM(SELECT 1 FROM subscription_ops.google_ack_work w WHERE w.environment=h.environment AND w.expires_at<=transaction_timestamp() LIMIT 1000000)b),
 coalesce((SELECT least(3600,greatest(0,extract(epoch FROM(transaction_timestamp()-w.created_at))::integer)) FROM subscription_ops.google_ack_work w WHERE w.environment=h.environment ORDER BY w.created_at LIMIT 1),0),
 CASE WHEN h.window_started_at>transaction_timestamp()-interval '24 hours' THEN h.completed_count ELSE 0 END,
 CASE WHEN h.window_started_at>transaction_timestamp()-interval '24 hours' THEN h.denied_count ELSE 0 END,
 CASE WHEN h.window_started_at>transaction_timestamp()-interval '24 hours' THEN h.expired_count ELSE 0 END,
 CASE WHEN h.window_started_at>transaction_timestamp()-interval '24 hours' THEN h.terminal_count ELSE 0 END,
 CASE WHEN h.window_started_at>transaction_timestamp()-interval '24 hours' THEN h.last_error_category ELSE 'none' END
 FROM subscription_ops.google_ack_health h ORDER BY h.environment;
$$;

-- Clear default-ACL grantees on ONLY these new functions; no global ACL changes.
DO $$ DECLARE f regprocedure;a record;name text;BEGIN
 FOREACH f IN ARRAY ARRAY[
 'subscription_ops.roll_ack_health(text)'::regprocedure,
 'public.gridly_enqueue_google_ack(jsonb)'::regprocedure,
 'public.gridly_claim_google_ack(text,integer,text)'::regprocedure,
 'public.gridly_resolve_google_ack(text,text,uuid,text,text)'::regprocedure,
 'public.gridly_prune_google_ack_work(text,integer)'::regprocedure,
 'public.gridly_complete_google_ack_run(text,text)'::regprocedure,
 'public.gridly_subscription_housekeeping()'::regprocedure,
 'public.gridly_google_ack_health()'::regprocedure] LOOP
  FOR a IN SELECT DISTINCT x.grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))x WHERE p.oid=f AND x.grantee<>'postgres'::regrole::oid LOOP
   IF a.grantee=0 THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f);
   ELSE SELECT rolname INTO name FROM pg_roles WHERE oid=a.grantee;EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f,name);END IF;
  END LOOP;
  IF f<>'subscription_ops.roll_ack_health(text)'::regprocedure THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);END IF;
  IF EXISTS(SELECT FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))x WHERE p.oid=f AND(p.proowner<>'postgres'::regrole::oid OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR x.grantee NOT IN('postgres'::regrole::oid,CASE WHEN f='subscription_ops.roll_ack_health(text)'::regprocedure THEN 'postgres'::regrole::oid ELSE 'service_role'::regrole::oid END) OR x.is_grantable)) THEN RAISE EXCEPTION 'unexpected_ack_acl';END IF;
  IF has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('authenticated',f,'EXECUTE') THEN RAISE EXCEPTION 'unexpected_client_execute';END IF;
 END LOOP;
 IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))x WHERE n.nspname='subscription_ops' AND c.relname IN('google_ack_work','google_ack_health') AND (NOT c.relrowsecurity OR c.relowner<>'postgres'::regrole OR x.grantee<>'postgres'::regrole::oid)) THEN RAISE EXCEPTION 'unexpected_ack_table_acl';END IF;
 IF EXISTS(SELECT FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner)))x WHERE n.nspname='subscription_ops' AND x.grantee<>'postgres'::regrole::oid) THEN RAISE EXCEPTION 'unexpected_private_schema_acl';END IF;
END $$;
COMMIT;
