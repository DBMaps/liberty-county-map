-- LOCAL DISPOSABLE ONLY. Additive invitation delivery evidence; no provider credentials.
BEGIN;
GRANT dispatch_function_owner TO postgres;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM gridly_rehearsal.environment WHERE marker='GRIDLY_PHASE26_LOCAL_SYNTHETIC' AND NOT production_access_authorized) THEN RAISE EXCEPTION 'DELIVERY_LOCAL_ONLY'; END IF; END $$;
CREATE TABLE dispatch_private.invitation_delivery_attempts(
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,
 invitation_id uuid NOT NULL UNIQUE REFERENCES dispatch_private.organization_invitations,recipient_token uuid NOT NULL,
 prior_invitation_id uuid REFERENCES dispatch_private.organization_invitations,request_id uuid NOT NULL UNIQUE,request_digest bytea NOT NULL,
 mode text NOT NULL CHECK(mode IN('EMAIL','MANUAL')),status text NOT NULL CHECK(status IN('PENDING','SENDING','SENT','DELIVERED','FAILED','DELAYED','BOUNCED','COMPLAINED')),
 provider_message_id text UNIQUE CHECK(provider_message_id ~ '^[-a-zA-Z0-9_]{1,100}$'),actor_token uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),fallback_reason text CHECK(fallback_reason IN('DELIVERY_RECOVERY','ACCESSIBILITY','PROVIDER_OUTAGE')),
 disclosed_at timestamptz, CHECK((mode='MANUAL')=(disclosed_at IS NOT NULL)));
CREATE TABLE dispatch_private.invitation_provider_events(
 provider_event_id text PRIMARY KEY CHECK(provider_event_id ~ '^[-a-zA-Z0-9_]{1,100}$'),attempt_id uuid NOT NULL REFERENCES dispatch_private.invitation_delivery_attempts,
 status text NOT NULL CHECK(status IN('SENT','DELIVERED','FAILED','DELAYED','BOUNCED','COMPLAINED')),occurred_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE dispatch_private.invitation_delivery_suppressions(
 organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,recipient_token uuid NOT NULL,active boolean NOT NULL,
 reason text NOT NULL CHECK(reason IN('BOUNCED','COMPLAINED','MANUAL','CLEARED')),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,recipient_token));
CREATE TABLE dispatch_audit.invitation_delivery_events(
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL,actor_token uuid,invitation_id uuid,
 request_id uuid UNIQUE,request_digest bytea CHECK(request_digest IS NULL OR octet_length(request_digest)=32),
 event_type text NOT NULL CHECK(event_type IN('ISSUED','REISSUED','MANUAL_DISCLOSED','SUPPRESSED','SUPPRESSION_CLEARED','PROVIDER_STATUS')),
 reason text CHECK(reason IN('DELIVERY_RECOVERY','ACCESSIBILITY','PROVIDER_OUTAGE','BOUNCED','COMPLAINED','MANUAL','CLEARED','SENT','DELIVERED','FAILED','DELAYED')),
 created_at timestamptz NOT NULL DEFAULT now(),policy_version text NOT NULL DEFAULT 'DAYTON-INVITE-01-v1');
CREATE FUNCTION dispatch_private.invitation_issue(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid:=(p->>'organization_id')::uuid; actor uuid:=dispatch_private.current_actor_id(); mid uuid; previous dispatch_private.organization_invitations%ROWTYPE;
 target uuid:=(p->>'target_user_id')::uuid; req uuid:=(p->>'idempotency_key')::uuid; inv uuid:=extensions.gen_random_uuid(); attempt uuid:=extensions.gen_random_uuid(); tok uuid; mode text:=p->>'mode'; unitname text;
BEGIN
 IF NOT dispatch_private.has_live_aal2() OR actor IS NULL OR org IS NULL OR req IS NULL OR target IS NULL THEN RAISE EXCEPTION 'DELIVERY_FORBIDDEN'; END IF;
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','target_user_id','role','idempotency_key','prior_invitation_id','expected_revision','token_digest','mode','fallback_reason','recipient_confirmed','unit_id']);
 PERFORM pg_advisory_xact_lock(280028);PERFORM 1 FROM dispatch_private.organizations WHERE id=org AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_FORBIDDEN';END IF;
 mid:=dispatch_private.actor_membership(org,'members.invite');IF mid IS NULL THEN RAISE EXCEPTION 'DELIVERY_FORBIDDEN';END IF;
 IF p->>'unit_id' IS NOT NULL THEN IF NOT dispatch_private.unit_access(org,(p->>'unit_id')::uuid,'members.invite') THEN RAISE EXCEPTION 'DELIVERY_UNIT';END IF;SELECT display_name INTO unitname FROM dispatch_private.organization_units WHERE id=(p->>'unit_id')::uuid AND organization_id=org;END IF;
 tok:=dispatch_private.token_for(org,actor);
 IF EXISTS(SELECT 1 FROM dispatch_private.invitation_delivery_attempts WHERE request_id=req) THEN RAISE EXCEPTION 'DELIVERY_ALREADY_CONSUMED';END IF;
 IF mode NOT IN('EMAIL','MANUAL') OR mode IS NULL OR coalesce(p->>'token_digest','') !~ '^[a-f0-9]{64}$' OR p->>'role'='OWNER' OR p->>'role' IS NULL THEN RAISE EXCEPTION 'DELIVERY_INPUT';END IF;
 IF mode='EMAIL' AND EXISTS(SELECT 1 FROM dispatch_private.invitation_delivery_suppressions WHERE organization_id=org AND recipient_token=dispatch_private.token_for(org,target) AND active) THEN RAISE EXCEPTION 'DELIVERY_SUPPRESSED';END IF;
 IF p->>'prior_invitation_id' IS NOT NULL THEN
  SELECT * INTO previous FROM dispatch_private.organization_invitations WHERE id=(p->>'prior_invitation_id')::uuid AND organization_id=org FOR UPDATE;
  IF NOT FOUND OR previous.target_identity<>'user:'||target::text OR previous.status<>'PENDING' OR previous.revision IS DISTINCT FROM (p->>'expected_revision')::int THEN RAISE EXCEPTION 'DELIVERY_STALE';END IF;
  UPDATE dispatch_private.organization_invitations SET status='REVOKED',revoked_at=now(),revision=revision+1 WHERE id=previous.id;
 END IF;
 IF mode='MANUAL' AND (previous.id IS NULL OR coalesce((p->>'recipient_confirmed')::boolean,false)=false OR coalesce(p->>'fallback_reason','') NOT IN('DELIVERY_RECOVERY','ACCESSIBILITY','PROVIDER_OUTAGE')) THEN RAISE EXCEPTION 'DELIVERY_MANUAL_BOUNDARY';END IF;
 INSERT INTO dispatch_private.organization_invitations(id,organization_id,target_identity,role_template,token_digest,expires_at,created_by_membership_id)
 VALUES(inv,org,'user:'||target::text,(p->>'role')::dispatch_private.role_template_key,decode(p->>'token_digest','hex'),now()+interval '168 hours',mid);
 INSERT INTO dispatch_private.invitation_delivery_attempts(id,organization_id,invitation_id,recipient_token,prior_invitation_id,request_id,request_digest,mode,status,actor_token,fallback_reason,disclosed_at)
 VALUES(attempt,org,inv,dispatch_private.token_for(org,target),previous.id,req,dispatch_private.request_hash(p),mode,CASE WHEN mode='MANUAL' THEN 'SENT' ELSE 'PENDING' END,tok,CASE WHEN mode='MANUAL' THEN p->>'fallback_reason' END,CASE WHEN mode='MANUAL' THEN now() END);
 INSERT INTO dispatch_audit.invitation_delivery_events(organization_id,actor_token,invitation_id,event_type,reason) VALUES(org,tok,inv,CASE WHEN mode='MANUAL' THEN 'MANUAL_DISCLOSED' WHEN previous.id IS NOT NULL THEN 'REISSUED' ELSE 'ISSUED' END,CASE WHEN mode='MANUAL' THEN p->>'fallback_reason' END);
 RETURN jsonb_build_object('invitationId',inv,'attemptId',attempt,'expiresAt',now()+interval '168 hours','organization',(SELECT display_name FROM dispatch_private.organizations WHERE id=org),'unit',unitname);
END $$;
CREATE FUNCTION dispatch_private.invitation_suppress(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid:=(p->>'organization_id')::uuid; target uuid:=(p->>'target_user_id')::uuid; tok uuid; active boolean:=(p->>'active')::boolean; req uuid:=(p->>'idempotency_key')::uuid; prior dispatch_audit.invitation_delivery_events%ROWTYPE;
BEGIN
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','target_user_id','active','idempotency_key']);
 IF NOT dispatch_private.has_live_aal2() OR dispatch_private.actor_membership(org,'members.invite') IS NULL OR target IS NULL OR active IS NULL OR req IS NULL THEN RAISE EXCEPTION 'DELIVERY_FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(280028);tok:=dispatch_private.token_for(org,dispatch_private.current_actor_id());
 SELECT * INTO prior FROM dispatch_audit.invitation_delivery_events WHERE request_id=req;IF FOUND THEN IF prior.organization_id<>org OR prior.actor_token<>tok OR prior.request_digest<>dispatch_private.request_hash(p) THEN RAISE EXCEPTION 'DELIVERY_REPLAY_MISMATCH';END IF;RETURN jsonb_build_object('status','RECORDED','replay',true);END IF;
 INSERT INTO dispatch_private.invitation_delivery_suppressions VALUES(org,dispatch_private.token_for(org,target),active,CASE WHEN active THEN 'MANUAL' ELSE 'CLEARED' END,now()) ON CONFLICT(organization_id,recipient_token) DO UPDATE SET active=EXCLUDED.active,reason=EXCLUDED.reason,updated_at=now();
 INSERT INTO dispatch_audit.invitation_delivery_events(organization_id,actor_token,event_type,reason,request_id,request_digest) VALUES(org,tok,CASE WHEN active THEN 'SUPPRESSED' ELSE 'SUPPRESSION_CLEARED' END,CASE WHEN active THEN 'MANUAL' ELSE 'CLEARED' END,req,dispatch_private.request_hash(p));
 RETURN jsonb_build_object('status','RECORDED');
END $$;
-- Transport role is a trusted server port, never granted to browser/service_role.
CREATE ROLE dispatch_delivery_transport NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE FUNCTION dispatch_private.invitation_claim_send(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a dispatch_private.invitation_delivery_attempts%ROWTYPE;
BEGIN
 SELECT * INTO a FROM dispatch_private.invitation_delivery_attempts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR a.mode<>'EMAIL' OR a.status<>'PENDING' THEN RETURN false;END IF;
 PERFORM 1 FROM dispatch_private.organization_invitations i JOIN dispatch_private.organizations o ON o.id=i.organization_id WHERE i.id=a.invitation_id AND i.status='PENDING' AND i.expires_at>now() AND o.status='ACTIVE' FOR UPDATE OF i;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM dispatch_private.invitation_delivery_suppressions WHERE organization_id=a.organization_id AND recipient_token=a.recipient_token AND active) THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM dispatch_private.actor_tokens t JOIN dispatch_private.profiles p ON p.user_id=t.user_id JOIN dispatch_private.organization_memberships m ON m.user_id=t.user_id AND m.organization_id=t.organization_id JOIN dispatch_private.role_permissions rp ON rp.role_key=m.role_template WHERE t.organization_id=a.organization_id AND t.token=a.actor_token AND p.status='ACTIVE' AND m.status='ACTIVE' AND rp.permission_key='members.invite') THEN RETURN false;END IF;
 UPDATE dispatch_private.invitation_delivery_attempts SET status='SENDING' WHERE id=p_id;RETURN true;
END $$;
CREATE FUNCTION dispatch_private.invitation_transport_result(p jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a dispatch_private.invitation_delivery_attempts%ROWTYPE; s text:=p->>'status';msg text:=p->>'messageId';eid text:=p->>'eventId';t timestamptz:=coalesce((p->>'occurredAt')::timestamptz,now());rank int;
BEGIN
 PERFORM dispatch_private.report_keys(p,ARRAY['attemptId','status','messageId','eventId','occurredAt','reason']);
 IF s NOT IN('SENT','DELIVERED','FAILED','DELAYED','BOUNCED','COMPLAINED') OR s IS NULL OR t>now()+interval '5 minutes' THEN RAISE EXCEPTION 'DELIVERY_EVENT_INPUT';END IF;
 IF p->>'attemptId' IS NOT NULL THEN SELECT * INTO a FROM dispatch_private.invitation_delivery_attempts WHERE id=(p->>'attemptId')::uuid FOR UPDATE;
 ELSE SELECT * INTO a FROM dispatch_private.invitation_delivery_attempts WHERE provider_message_id=msg FOR UPDATE; END IF;
 IF NOT FOUND OR a.mode<>'EMAIL' THEN RAISE EXCEPTION 'DELIVERY_UNKNOWN';END IF;
 IF eid IS NOT NULL THEN
  IF a.provider_message_id IS DISTINCT FROM msg THEN RAISE EXCEPTION 'DELIVERY_CORRELATION';END IF;
  IF EXISTS(SELECT 1 FROM dispatch_private.invitation_provider_events WHERE provider_event_id=eid) THEN
   IF NOT EXISTS(SELECT 1 FROM dispatch_private.invitation_provider_events WHERE provider_event_id=eid AND attempt_id=a.id AND status=s AND occurred_at=t) THEN RAISE EXCEPTION 'DELIVERY_EVENT_CONFLICT';END IF;RETURN;
  END IF;
  INSERT INTO dispatch_private.invitation_provider_events VALUES(eid,a.id,s,t,now());
 ELSE
  IF s NOT IN('SENT','FAILED') OR a.status<>'SENDING' THEN RAISE EXCEPTION 'DELIVERY_RESULT_CONSUMED';END IF;
  IF s='SENT' AND (msg IS NULL OR msg !~ '^[-a-zA-Z0-9_]{1,100}$') THEN RAISE EXCEPTION 'DELIVERY_MESSAGE';END IF;
  UPDATE dispatch_private.invitation_delivery_attempts SET provider_message_id=msg WHERE id=a.id;
 END IF;
 -- Adverse terminal status cannot be downgraded by a late successful event.
 IF (CASE s WHEN 'COMPLAINED' THEN 6 WHEN 'BOUNCED' THEN 5 WHEN 'FAILED' THEN 4 WHEN 'DELIVERED' THEN 3 WHEN 'DELAYED' THEN 2 ELSE 1 END) >= (CASE a.status WHEN 'COMPLAINED' THEN 6 WHEN 'BOUNCED' THEN 5 WHEN 'FAILED' THEN 4 WHEN 'DELIVERED' THEN 3 WHEN 'DELAYED' THEN 2 WHEN 'SENT' THEN 1 ELSE 0 END) THEN UPDATE dispatch_private.invitation_delivery_attempts SET status=s WHERE id=a.id;END IF;
 IF s IN('BOUNCED','COMPLAINED') THEN
  INSERT INTO dispatch_private.invitation_delivery_suppressions VALUES(a.organization_id,a.recipient_token,true,s,now()) ON CONFLICT(organization_id,recipient_token) DO UPDATE SET active=true,reason=EXCLUDED.reason,updated_at=now();
 END IF;
 INSERT INTO dispatch_audit.invitation_delivery_events(organization_id,invitation_id,event_type,reason) VALUES(a.organization_id,a.invitation_id,'PROVIDER_STATUS',s);
END $$;
DO $$ DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['dispatch_private.invitation_delivery_attempts','dispatch_private.invitation_provider_events','dispatch_private.invitation_delivery_suppressions','dispatch_audit.invitation_delivery_events'] LOOP EXECUTE 'ALTER TABLE '||n||' ENABLE ROW LEVEL SECURITY';EXECUTE 'ALTER TABLE '||n||' FORCE ROW LEVEL SECURITY';EXECUTE 'REVOKE ALL ON '||n||' FROM PUBLIC,anon,authenticated,service_role';EXECUTE 'GRANT SELECT,INSERT,UPDATE ON '||n||' TO dispatch_function_owner';END LOOP; END $$;
CREATE TRIGGER invitation_event_immutable BEFORE UPDATE OR DELETE ON dispatch_private.invitation_provider_events FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();
CREATE TRIGGER invitation_audit_immutable BEFORE UPDATE OR DELETE ON dispatch_audit.invitation_delivery_events FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();
GRANT CREATE ON SCHEMA dispatch_private TO dispatch_function_owner;
ALTER FUNCTION dispatch_private.invitation_issue(jsonb) OWNER TO dispatch_function_owner;
ALTER FUNCTION dispatch_private.invitation_suppress(jsonb) OWNER TO dispatch_function_owner;
ALTER FUNCTION dispatch_private.invitation_transport_result(jsonb) OWNER TO dispatch_function_owner;
ALTER FUNCTION dispatch_private.invitation_claim_send(uuid) OWNER TO dispatch_function_owner;
REVOKE ALL ON FUNCTION dispatch_private.invitation_claim_send(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION dispatch_private.invitation_claim_send(uuid) TO dispatch_delivery_transport;
REVOKE CREATE ON SCHEMA dispatch_private FROM dispatch_function_owner;
REVOKE ALL ON FUNCTION dispatch_private.invitation_issue(jsonb),dispatch_private.invitation_suppress(jsonb),dispatch_private.invitation_transport_result(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION dispatch_private.invitation_issue(jsonb),dispatch_private.invitation_suppress(jsonb) TO authenticated;
GRANT USAGE ON SCHEMA dispatch_private TO dispatch_delivery_transport;
GRANT EXECUTE ON FUNCTION dispatch_private.invitation_transport_result(jsonb) TO dispatch_delivery_transport;
CREATE FUNCTION dispatch_api.issue_dispatch_invitation(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT dispatch_private.invitation_issue(p_payload) $$;
CREATE FUNCTION dispatch_api.set_delivery_suppression(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT dispatch_private.invitation_suppress(p_payload) $$;
REVOKE ALL ON FUNCTION dispatch_api.issue_dispatch_invitation(jsonb),dispatch_api.set_delivery_suppression(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION dispatch_api.issue_dispatch_invitation(jsonb),dispatch_api.set_delivery_suppression(jsonb) TO authenticated;
REVOKE dispatch_function_owner FROM postgres;
NOTIFY pgrst,'reload schema';
COMMIT;
