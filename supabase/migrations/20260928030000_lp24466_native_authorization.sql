-- LP244.66 Window 3C LOCAL DRAFT ONLY. Do not apply without separate approval.
-- Additive to the unapplied LP244.62 subscription_ops schema. No scheduler.
BEGIN;
DO $$ BEGIN
 IF current_user <> 'postgres' OR to_regnamespace('subscription_ops') IS NULL
 OR to_regclass('subscription_ops.native_challenges') IS NOT NULL
 THEN RAISE EXCEPTION 'native_authorization_prerequisite_mismatch'; END IF;
END $$;

CREATE TABLE subscription_ops.native_challenges (
 challenge_hash text PRIMARY KEY CHECK(challenge_hash ~ '^[A-Za-z0-9_-]{43}$'),
 platform text NOT NULL CHECK(platform IN ('apple','google')),
 purpose text NOT NULL CHECK(purpose='gridly-subscription-verification-v1'),
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '2 minutes'),
 CHECK(consumed_at IS NULL OR consumed_at>=created_at)
);
CREATE INDEX native_challenges_recent ON subscription_ops.native_challenges(created_at);
CREATE INDEX native_challenges_expiry ON subscription_ops.native_challenges(expires_at);
ALTER TABLE subscription_ops.native_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON subscription_ops.native_challenges FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE subscription_ops.apple_app_attest_keys (
 key_hash text PRIMARY KEY CHECK(key_hash ~ '^[a-f0-9]{64}$'),
 environment text NOT NULL CHECK(environment IN ('production','development')),
 public_spki text NOT NULL CHECK(length(public_spki) BETWEEN 80 AND 512 AND public_spki ~ '^[A-Za-z0-9+/]+={0,2}$'),
 assertion_counter bigint NOT NULL DEFAULT 0 CHECK(assertion_counter BETWEEN 0 AND 4294967295),
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 last_seen_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
ALTER TABLE subscription_ops.apple_app_attest_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON subscription_ops.apple_app_attest_keys FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.gridly_issue_native_challenge(p_hash text,p_platform text,p_purpose text,p_expires_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t timestamptz:=transaction_timestamp();n integer;
BEGIN
 IF p_hash IS NULL OR p_hash !~ '^[A-Za-z0-9_-]{43}$' OR p_platform IS NULL OR p_platform NOT IN ('apple','google')
 OR p_purpose IS NULL OR p_purpose<>'gridly-subscription-verification-v1' OR p_expires_at IS NULL OR p_expires_at<=t OR p_expires_at>t+interval '2 minutes'
 THEN RETURN false; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(24466,3);
 DELETE FROM subscription_ops.native_challenges WHERE challenge_hash IN
  (SELECT challenge_hash FROM subscription_ops.native_challenges
   WHERE expires_at<=t OR consumed_at<t-interval '2 minutes' ORDER BY expires_at LIMIT 500);
 IF (SELECT count(*) FROM subscription_ops.native_challenges WHERE created_at>t-interval '1 minute')>=300
 OR (SELECT count(*) FROM subscription_ops.native_challenges WHERE consumed_at IS NULL AND expires_at>t)>=10000
 THEN RETURN false; END IF;
 INSERT INTO subscription_ops.native_challenges(challenge_hash,platform,purpose,expires_at)
 VALUES(p_hash,p_platform,p_purpose,p_expires_at) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n=1;
END $$;

CREATE FUNCTION public.gridly_read_app_attest_key(p_key_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r subscription_ops.apple_app_attest_keys;
BEGIN
 IF p_key_hash IS NULL OR p_key_hash !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO r FROM subscription_ops.apple_app_attest_keys WHERE key_hash=p_key_hash;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN pg_catalog.jsonb_build_object('publicSpki',r.public_spki,'counter',r.assertion_counter,'environment',r.environment);
END $$;

CREATE FUNCTION public.gridly_consume_native_challenge(
 p_hash text,p_platform text,p_purpose text,p_kind text,p_key_hash text,p_public_spki text,p_counter bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE challenge subscription_ops.native_challenges;n integer;t timestamptz:=transaction_timestamp();
BEGIN
 IF p_hash IS NULL OR p_hash !~ '^[A-Za-z0-9_-]{43}$' OR p_platform IS NULL OR p_platform NOT IN ('apple','google')
 OR p_purpose IS NULL OR p_purpose<>'gridly-subscription-verification-v1' OR p_kind IS NULL THEN RETURN false; END IF;
 SELECT * INTO challenge FROM subscription_ops.native_challenges WHERE challenge_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR challenge.platform<>p_platform OR challenge.purpose<>p_purpose
 OR challenge.consumed_at IS NOT NULL OR challenge.expires_at<=t THEN RETURN false; END IF;
 IF p_platform='google' THEN
  IF p_kind<>'google_standard' OR p_key_hash IS NOT NULL OR p_public_spki IS NOT NULL OR p_counter IS NOT NULL THEN RETURN false; END IF;
 ELSIF p_kind='apple_initial' THEN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[a-f0-9]{64}$' OR p_public_spki IS NULL
  OR length(p_public_spki) NOT BETWEEN 80 AND 512 OR p_public_spki !~ '^[A-Za-z0-9+/]+={0,2}$'
  OR p_counter IS DISTINCT FROM 0 THEN RETURN false; END IF;
  INSERT INTO subscription_ops.apple_app_attest_keys(key_hash,environment,public_spki)
  VALUES(p_key_hash,'production',p_public_spki)
  ON CONFLICT(key_hash) DO UPDATE SET last_seen_at=t
  WHERE subscription_ops.apple_app_attest_keys.environment='production'
  AND subscription_ops.apple_app_attest_keys.public_spki=EXCLUDED.public_spki;
  GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RETURN false; END IF;
 ELSIF p_kind='apple_assertion' THEN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[a-f0-9]{64}$' OR p_public_spki IS NOT NULL
  OR p_counter IS NULL OR p_counter<=0 OR p_counter>4294967295 THEN RETURN false; END IF;
  UPDATE subscription_ops.apple_app_attest_keys SET assertion_counter=p_counter,last_seen_at=t
  WHERE key_hash=p_key_hash AND environment='production' AND assertion_counter<p_counter;
  GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RETURN false; END IF;
 ELSE RETURN false; END IF;
 UPDATE subscription_ops.native_challenges SET consumed_at=t WHERE challenge_hash=p_hash AND consumed_at IS NULL;
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n=1;
END $$;

REVOKE ALL ON FUNCTION public.gridly_issue_native_challenge(text,text,text,timestamptz),
 public.gridly_read_app_attest_key(text),
 public.gridly_consume_native_challenge(text,text,text,text,text,text,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gridly_issue_native_challenge(text,text,text,timestamptz),
 public.gridly_read_app_attest_key(text),
 public.gridly_consume_native_challenge(text,text,text,text,text,text,bigint)
 TO service_role;
COMMIT;
