-- LP244.72 local forward migration. Deployment requires separate approval.
-- Prerequisite: LP244.71 Google contract/lineage migration.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('subscription_ops.google_token_lineage') IS NULL
  OR to_regclass('subscription_ops.google_rtdn_receipts') IS NOT NULL
 THEN RAISE EXCEPTION 'rtdn_prerequisite_mismatch'; END IF;
END $$;

-- Pub/Sub IDs only: no raw notification, purchase token, order, or account data.
CREATE TABLE subscription_ops.google_rtdn_receipts (
 message_id text PRIMARY KEY CHECK(message_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 state text NOT NULL CHECK(state IN ('processing','retry','done','terminal')),
 lease uuid,
 lease_until timestamptz,
 attempts integer NOT NULL DEFAULT 1 CHECK(attempts BETWEEN 1 AND 1000000),
 first_received_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 last_received_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 processed_at timestamptz,
 expires_at timestamptz NOT NULL DEFAULT transaction_timestamp()+interval '31 days',
 last_error_category text NOT NULL DEFAULT 'none' CHECK(last_error_category IN
  ('none','invalid_evidence','invalid_purchase','credential_unavailable','provider_unavailable',
   'reconciliation_retry','ack_unavailable','subscription_unavailable')),
 CHECK((state='processing')=(lease IS NOT NULL)),
 CHECK((lease IS NULL)=(lease_until IS NULL)),
 CHECK(expires_at=first_received_at+interval '31 days')
);
CREATE INDEX google_rtdn_receipts_expiry ON subscription_ops.google_rtdn_receipts(expires_at);
ALTER TABLE subscription_ops.google_rtdn_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON subscription_ops.google_rtdn_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE subscription_ops.google_rtdn_health (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 window_started_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 last_received_at timestamptz,
 last_completed_at timestamptz,
 last_retry_at timestamptz,
 last_terminal_at timestamptz,
 completed_count integer NOT NULL DEFAULT 0 CHECK(completed_count BETWEEN 0 AND 1000000),
 retry_count integer NOT NULL DEFAULT 0 CHECK(retry_count BETWEEN 0 AND 1000000),
 terminal_count integer NOT NULL DEFAULT 0 CHECK(terminal_count BETWEEN 0 AND 1000000),
 duplicate_count integer NOT NULL DEFAULT 0 CHECK(duplicate_count BETWEEN 0 AND 1000000),
 busy_count integer NOT NULL DEFAULT 0 CHECK(busy_count BETWEEN 0 AND 1000000),
 last_error_category text NOT NULL DEFAULT 'none' CHECK(last_error_category IN
  ('none','invalid_evidence','invalid_purchase','credential_unavailable','provider_unavailable',
   'reconciliation_retry','ack_unavailable','subscription_unavailable'))
);
INSERT INTO subscription_ops.google_rtdn_health(singleton) VALUES(true);
ALTER TABLE subscription_ops.google_rtdn_health ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON subscription_ops.google_rtdn_health FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.gridly_prune_google_rtdn_receipts(p_limit integer DEFAULT 500)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE removed integer;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid_rtdn_prune'; END IF;
 WITH due AS (SELECT message_id FROM subscription_ops.google_rtdn_receipts
  WHERE expires_at<=transaction_timestamp() ORDER BY expires_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
 DELETE FROM subscription_ops.google_rtdn_receipts r USING due WHERE r.message_id=due.message_id;
 GET DIAGNOSTICS removed=ROW_COUNT;RETURN removed;
END $$;

CREATE FUNCTION public.gridly_claim_google_rtdn(p_message_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t timestamptz:=transaction_timestamp(); new_lease uuid; current_row subscription_ops.google_rtdn_receipts;
BEGIN
 IF p_message_id IS NULL OR p_message_id !~ '^[A-Za-z0-9_-]{1,128}$' THEN RAISE EXCEPTION 'invalid_rtdn_id'; END IF;
 PERFORM public.gridly_prune_google_rtdn_receipts(100);
 UPDATE subscription_ops.google_rtdn_health SET window_started_at=t,completed_count=0,retry_count=0,
  terminal_count=0,duplicate_count=0,busy_count=0 WHERE singleton AND window_started_at<=t-interval '24 hours';
 DELETE FROM subscription_ops.google_rtdn_receipts WHERE message_id=p_message_id AND expires_at<=t;
 new_lease:=gen_random_uuid();
 INSERT INTO subscription_ops.google_rtdn_receipts(message_id,state,lease,lease_until)
 VALUES(p_message_id,'processing',new_lease,t+interval '90 seconds')
 ON CONFLICT DO NOTHING;
 IF FOUND THEN
  UPDATE subscription_ops.google_rtdn_health SET last_received_at=t WHERE singleton;
  RETURN jsonb_build_object('status','claimed','lease',new_lease::text);
 END IF;
 SELECT * INTO current_row FROM subscription_ops.google_rtdn_receipts WHERE message_id=p_message_id FOR UPDATE;
 IF current_row.state IN ('done','terminal') THEN
  UPDATE subscription_ops.google_rtdn_health SET duplicate_count=least(1000000,duplicate_count+1),last_received_at=t WHERE singleton;
  RETURN jsonb_build_object('status',current_row.state);
 END IF;
 IF current_row.state='processing' AND current_row.lease_until>t THEN
  UPDATE subscription_ops.google_rtdn_health SET busy_count=least(1000000,busy_count+1),last_received_at=t WHERE singleton;
  RETURN jsonb_build_object('status','busy');
 END IF;
 UPDATE subscription_ops.google_rtdn_receipts SET state='processing',lease=new_lease,lease_until=t+interval '90 seconds',
  attempts=least(1000000,attempts+1),last_received_at=t WHERE message_id=p_message_id;
 UPDATE subscription_ops.google_rtdn_health SET last_received_at=t WHERE singleton;
 RETURN jsonb_build_object('status','claimed','lease',new_lease::text);
END $$;

CREATE FUNCTION public.gridly_finish_google_rtdn(p_message_id text,p_lease uuid,p_outcome text,p_error_category text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;t timestamptz:=transaction_timestamp();
BEGIN
 IF p_message_id IS NULL OR p_message_id !~ '^[A-Za-z0-9_-]{1,128}$' OR p_lease IS NULL OR
  p_outcome IS NULL OR p_error_category IS NULL OR
  p_outcome NOT IN ('done','terminal','retry') OR
  (p_outcome='done' AND p_error_category<>'none') OR
  (p_outcome='terminal' AND p_error_category NOT IN ('invalid_evidence','invalid_purchase')) OR
  (p_outcome='retry' AND p_error_category NOT IN ('credential_unavailable','provider_unavailable',
   'reconciliation_retry','ack_unavailable','subscription_unavailable'))
 THEN RAISE EXCEPTION 'invalid_rtdn_finish'; END IF;
 UPDATE subscription_ops.google_rtdn_receipts SET state=p_outcome,lease=NULL,lease_until=NULL,
  processed_at=CASE WHEN p_outcome='retry' THEN NULL ELSE t END,last_error_category=p_error_category
 WHERE message_id=p_message_id AND state='processing' AND lease=p_lease AND lease_until>t AND expires_at>t;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RETURN false; END IF;
 UPDATE subscription_ops.google_rtdn_health SET
  window_started_at=CASE WHEN window_started_at<=t-interval '24 hours' THEN t ELSE window_started_at END,
  completed_count=least(1000000,CASE WHEN window_started_at<=t-interval '24 hours' THEN 0 ELSE completed_count END+CASE WHEN p_outcome='done' THEN 1 ELSE 0 END),
  retry_count=least(1000000,CASE WHEN window_started_at<=t-interval '24 hours' THEN 0 ELSE retry_count END+CASE WHEN p_outcome='retry' THEN 1 ELSE 0 END),
  terminal_count=least(1000000,CASE WHEN window_started_at<=t-interval '24 hours' THEN 0 ELSE terminal_count END+CASE WHEN p_outcome='terminal' THEN 1 ELSE 0 END),
  duplicate_count=CASE WHEN window_started_at<=t-interval '24 hours' THEN 0 ELSE duplicate_count END,
  busy_count=CASE WHEN window_started_at<=t-interval '24 hours' THEN 0 ELSE busy_count END,
  last_completed_at=CASE WHEN p_outcome='done' THEN t ELSE last_completed_at END,
  last_retry_at=CASE WHEN p_outcome='retry' THEN t ELSE last_retry_at END,
  last_terminal_at=CASE WHEN p_outcome='terminal' THEN t ELSE last_terminal_at END,
  last_error_category=p_error_category WHERE singleton;
 RETURN true;
END $$;

CREATE FUNCTION public.gridly_google_rtdn_health()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('subsystem','google_rtdn','window_started_at',h.window_started_at,
  'last_received_at',h.last_received_at,'last_completed_at',h.last_completed_at,
  'last_retry_at',h.last_retry_at,'last_terminal_at',h.last_terminal_at,
  'completed_count',h.completed_count,'retry_count',h.retry_count,'terminal_count',h.terminal_count,
  'duplicate_count',h.duplicate_count,'busy_count',h.busy_count,
  'pending_count',(SELECT count(*) FROM subscription_ops.google_rtdn_receipts r WHERE r.state IN ('processing','retry')),
  'last_error_category',h.last_error_category) FROM subscription_ops.google_rtdn_health h WHERE h.singleton;
$$;

-- The existing minute-scale housekeeping operation also bounds receipt storage.
CREATE OR REPLACE FUNCTION public.gridly_subscription_housekeeping() RETURNS TABLE(queue_purged integer,cache_purged integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;c integer;
BEGIN
 PERFORM public.gridly_prune_google_rtdn_receipts(500);
 n:=public.gridly_prune_google_ack_work('production',500)+public.gridly_prune_google_ack_work('sandbox_test',500);
 c:=public.gridly_prune_store_entitlement_cache(500);
 RETURN QUERY SELECT n,c;
END $$;

DO $$ DECLARE f regprocedure; a record; role_name text; BEGIN
 FOREACH f IN ARRAY ARRAY['public.gridly_prune_google_rtdn_receipts(integer)'::regprocedure,
  'public.gridly_claim_google_rtdn(text)'::regprocedure,
  'public.gridly_finish_google_rtdn(text,uuid,text,text)'::regprocedure,
  'public.gridly_google_rtdn_health()'::regprocedure] LOOP
  FOR a IN SELECT DISTINCT x.grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x WHERE p.oid=f AND x.grantee<>'postgres'::regrole::oid LOOP
   IF a.grantee=0 THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f);
   ELSE SELECT rolname INTO role_name FROM pg_roles WHERE oid=a.grantee;EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f,role_name);END IF;
  END LOOP;
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);
  IF EXISTS(SELECT FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
   WHERE p.oid=f AND (p.proowner<>'postgres'::regrole::oid OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
    OR x.grantee NOT IN ('postgres'::regrole::oid,'service_role'::regrole::oid) OR x.is_grantable))
   OR has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('authenticated',f,'EXECUTE')
  THEN RAISE EXCEPTION 'rtdn_function_acl_mismatch'; END IF;
 END LOOP;
 IF EXISTS(SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x
  WHERE c.oid IN ('subscription_ops.google_rtdn_receipts'::regclass,'subscription_ops.google_rtdn_health'::regclass)
   AND (NOT c.relrowsecurity OR c.relowner<>'postgres'::regrole OR x.grantee<>'postgres'::regrole::oid))
 THEN RAISE EXCEPTION 'rtdn_table_acl_mismatch'; END IF;
END $$;
COMMIT;
