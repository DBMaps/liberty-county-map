-- LP244.66 LOCAL DRAFT. Pending separate production approval.
-- Depends on LP244.62 private cache. No scheduler/deployment/reporting change.
BEGIN;
DO $$ BEGIN
 IF current_user <> 'postgres' OR to_regclass('subscription_ops.store_entitlements') IS NULL
 OR to_regclass('subscription_ops.google_ack_work') IS NOT NULL THEN
  RAISE EXCEPTION 'LP24466 prerequisite/owner mismatch';
 END IF;
END $$;
CREATE TABLE subscription_ops.google_ack_work (
 environment text NOT NULL CHECK(environment IN ('production','sandbox_test')),
 chain_fingerprint text NOT NULL CHECK(chain_fingerprint ~ '^[a-f0-9]{64}$'),
 ciphertext text NOT NULL CHECK(length(ciphertext) BETWEEN 23 AND 21867 AND ciphertext ~ '^[A-Za-z0-9_-]+$'),
 iv text NOT NULL CHECK(iv ~ '^[A-Za-z0-9_-]{16}$'),
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 expires_at timestamptz NOT NULL,
 next_attempt_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 lease uuid, lease_until timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 1000000),
 error_category text NOT NULL DEFAULT 'none' CHECK(error_category IN ('none','provider_unavailable','reconciliation_retry','cipher_unavailable')),
 PRIMARY KEY(environment,chain_fingerprint),
 CHECK(expires_at > created_at AND expires_at <= created_at + interval '24 hours'),
 CHECK((lease IS NULL)=(lease_until IS NULL))
);
CREATE INDEX google_ack_due ON subscription_ops.google_ack_work(environment,next_attempt_at);
CREATE INDEX google_ack_expiry ON subscription_ops.google_ack_work(environment,expires_at);
CREATE TABLE subscription_ops.google_ack_health (
 environment text PRIMARY KEY CHECK(environment IN ('production','sandbox_test')),
 last_tick_at timestamptz,
 completed_count integer NOT NULL DEFAULT 0 CHECK(completed_count BETWEEN 0 AND 1000000),
 denied_count integer NOT NULL DEFAULT 0 CHECK(denied_count BETWEEN 0 AND 1000000),
 expired_count integer NOT NULL DEFAULT 0 CHECK(expired_count BETWEEN 0 AND 1000000)
);
INSERT INTO subscription_ops.google_ack_health(environment) VALUES ('production'),('sandbox_test');
ALTER TABLE subscription_ops.google_ack_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_ops.google_ack_health ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON subscription_ops.google_ack_work,subscription_ops.google_ack_health FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.gridly_enqueue_google_ack(p_record jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE period_end timestamptz; t timestamptz:=transaction_timestamp();
BEGIN
 IF p_record IS NULL OR jsonb_typeof(p_record)<>'object' OR octet_length(p_record::text)>24000
 OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_record) k)
 IS DISTINCT FROM ARRAY['chain_fingerprint','ciphertext','environment','iv']::text[] THEN RAISE EXCEPTION 'invalid_ack_record'; END IF;
 SELECT current_period_end INTO period_end FROM subscription_ops.store_entitlements
 WHERE platform='google' AND environment=p_record->>'environment' AND chain_fingerprint=p_record->>'chain_fingerprint'
 AND entitlement_state='entitled' AND subscription_state IN ('active','canceled_pending_expiry')
 AND current_period_end>t AND last_verified_at>=t-interval '5 minutes' AND last_verified_at<=t+interval '5 seconds';
 IF period_end IS NULL THEN RETURN false; END IF;
 INSERT INTO subscription_ops.google_ack_work(environment,chain_fingerprint,ciphertext,iv,expires_at)
 VALUES(p_record->>'environment',p_record->>'chain_fingerprint',p_record->>'ciphertext',p_record->>'iv',least(t+interval '24 hours',period_end))
 ON CONFLICT(environment,chain_fingerprint) DO NOTHING;
 -- Repeated requests never replace encryption material or refresh its TTL.
 RETURN EXISTS(SELECT FROM subscription_ops.google_ack_work WHERE environment=p_record->>'environment' AND chain_fingerprint=p_record->>'chain_fingerprint' AND expires_at>t);
END $$;

CREATE FUNCTION public.gridly_claim_google_ack(p_environment text,p_limit integer DEFAULT 10,p_fingerprint text DEFAULT NULL)
RETURNS TABLE(environment text,chain_fingerprint text,ciphertext text,iv text,lease uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t timestamptz:=transaction_timestamp(); expired integer;
BEGIN
 IF p_environment IS NULL OR p_environment NOT IN ('production','sandbox_test') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10
 OR (p_fingerprint IS NOT NULL AND p_fingerprint !~ '^[a-f0-9]{64}$') THEN RAISE EXCEPTION 'invalid_ack_claim'; END IF;
 WITH old AS (SELECT w.environment,w.chain_fingerprint FROM subscription_ops.google_ack_work w
  WHERE w.environment=p_environment AND w.expires_at<=t ORDER BY w.expires_at LIMIT 100 FOR UPDATE SKIP LOCKED)
 DELETE FROM subscription_ops.google_ack_work w USING old WHERE w.environment=old.environment AND w.chain_fingerprint=old.chain_fingerprint;
 GET DIAGNOSTICS expired=ROW_COUNT;
 UPDATE subscription_ops.google_ack_health h SET last_tick_at=t,expired_count=least(1000000,h.expired_count+expired) WHERE h.environment=p_environment;
 RETURN QUERY WITH ready AS (SELECT w.environment,w.chain_fingerprint FROM subscription_ops.google_ack_work w
  WHERE w.environment=p_environment AND w.expires_at>t AND w.next_attempt_at<=t AND (w.lease_until IS NULL OR w.lease_until<=t)
  AND (p_fingerprint IS NULL OR w.chain_fingerprint=p_fingerprint)
  ORDER BY w.next_attempt_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
 UPDATE subscription_ops.google_ack_work w SET lease=gen_random_uuid(),lease_until=t+interval '2 minutes',attempts=least(1000000,w.attempts+1)
 FROM ready WHERE w.environment=ready.environment AND w.chain_fingerprint=ready.chain_fingerprint
 RETURNING w.environment,w.chain_fingerprint,w.ciphertext,w.iv,w.lease;
END $$;

CREATE FUNCTION public.gridly_resolve_google_ack(p_environment text,p_fingerprint text,p_lease uuid,p_outcome text,p_error_category text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t timestamptz:=transaction_timestamp(); changed integer;
BEGIN
 IF p_outcome IS NULL OR p_outcome NOT IN ('success','denied','retry') OR p_error_category IS NULL
 OR p_error_category NOT IN ('none','provider_unavailable','reconciliation_retry','cipher_unavailable')
 OR (p_outcome='retry')=(p_error_category='none') THEN RAISE EXCEPTION 'invalid_ack_outcome'; END IF;
 IF p_outcome='retry' THEN
  UPDATE subscription_ops.google_ack_work SET lease=NULL,lease_until=NULL,next_attempt_at=t+interval '30 seconds',error_category=p_error_category
  WHERE environment=p_environment AND chain_fingerprint=p_fingerprint AND lease=p_lease AND lease_until>t AND expires_at>t;
 ELSE
  DELETE FROM subscription_ops.google_ack_work WHERE environment=p_environment AND chain_fingerprint=p_fingerprint AND lease=p_lease AND lease_until>t AND expires_at>t;
 END IF;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed=1 THEN UPDATE subscription_ops.google_ack_health SET completed_count=least(1000000,completed_count+(p_outcome='success')::integer),denied_count=least(1000000,denied_count+(p_outcome='denied')::integer) WHERE environment=p_environment; END IF;
 RETURN changed=1;
END $$;

CREATE FUNCTION public.gridly_google_ack_health() RETURNS TABLE(environment text,subsystem text,last_tick_at timestamptz,pending_count bigint,failed_count bigint,stale_count bigint,overdue_count bigint,completed_count integer,denied_count integer,expired_count integer)
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT h.environment,'google_ack'::text,h.last_tick_at,
 (SELECT count(*) FROM (SELECT 1 FROM subscription_ops.google_ack_work w WHERE w.environment=h.environment LIMIT 1000000) b),
 (SELECT count(*) FROM (SELECT 1 FROM subscription_ops.google_ack_work w WHERE w.environment=h.environment AND w.error_category<>'none' LIMIT 1000000) b),
 (SELECT count(*) FROM (SELECT 1 FROM subscription_ops.google_ack_work w WHERE w.environment=h.environment AND w.created_at<=transaction_timestamp()-interval '1 minute' LIMIT 1000000) b),
 (SELECT count(*) FROM (SELECT 1 FROM subscription_ops.google_ack_work w WHERE w.environment=h.environment AND w.expires_at<=transaction_timestamp() LIMIT 1000000) b),
 h.completed_count,h.denied_count,h.expired_count FROM subscription_ops.google_ack_health h ORDER BY h.environment;
$$;

-- Exact ACL, including privileges supplied by database default ACLs.
DO $$ DECLARE f regprocedure; grantee_name text; a record; BEGIN
 FOREACH f IN ARRAY ARRAY['public.gridly_enqueue_google_ack(jsonb)'::regprocedure,'public.gridly_claim_google_ack(text,integer,text)'::regprocedure,'public.gridly_resolve_google_ack(text,text,uuid,text,text)'::regprocedure,'public.gridly_google_ack_health()'::regprocedure] LOOP
  FOR a IN SELECT DISTINCT x.grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x WHERE p.oid=f AND x.grantee<>'postgres'::regrole::oid LOOP
   IF a.grantee=0 THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f);
   ELSE SELECT rolname INTO grantee_name FROM pg_roles WHERE oid=a.grantee; EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f,grantee_name); END IF;
  END LOOP;
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);
  IF EXISTS(SELECT FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x WHERE p.oid=f AND (p.proowner<>'postgres'::regrole::oid OR (x.privilege_type='EXECUTE' AND (x.grantee NOT IN ('postgres'::regrole::oid,'service_role'::regrole::oid) OR x.is_grantable)))) THEN RAISE EXCEPTION 'unexpected_ack_acl'; END IF;
 END LOOP;
 IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x WHERE n.nspname='subscription_ops' AND c.relname IN ('google_ack_work','google_ack_health') AND x.grantee<>'postgres'::regrole::oid) THEN RAISE EXCEPTION 'unexpected_ack_table_acl'; END IF;
 IF EXISTS(SELECT FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x WHERE n.nspname='subscription_ops' AND x.grantee<>'postgres'::regrole::oid) THEN RAISE EXCEPTION 'unexpected_private_schema_acl'; END IF;
END $$;
COMMIT;
