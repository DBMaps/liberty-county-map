-- LOCAL/DISPOSABLE ONLY. Never deploy this synthetic-session SECURITY DEFINER function.
-- Requires Phases 1-4, PostgreSQL 17.10, and PostGIS 3.6.2.
BEGIN;

-- A non-login local definer has only the objects needed by this command.
-- BYPASSRLS is necessary for Phase 4's FORCE RLS tables and is never granted to a login.
CREATE ROLE responder_command_fixture NOLOGIN BYPASSRLS;
GRANT USAGE,CREATE ON SCHEMA agency_private TO responder_command_fixture;
GRANT SELECT ON agency_private.phase4_session_bindings,
  agency_private.local_auth_identities,agency_private.organizations,
  agency_private.organization_memberships,agency_private.organization_authorities,
  agency_private.county_geometry_catalog,agency_private.agency_program_controls
  TO responder_command_fixture;
GRANT SELECT,INSERT,UPDATE ON agency_private.agency_updates TO responder_command_fixture;
-- PostgreSQL requires UPDATE privilege to take the singleton FOR SHARE row lock.
GRANT UPDATE ON agency_private.agency_program_controls TO responder_command_fixture;
GRANT INSERT ON agency_private.agency_update_events TO responder_command_fixture;
GRANT SELECT,INSERT ON agency_private.agency_operation_receipts TO responder_command_fixture;
GRANT EXECUTE ON FUNCTION agency_private.phase3_authorize_point(
  uuid,uuid,public.geometry,text,uuid,integer) TO responder_command_fixture;
GRANT EXECUTE ON FUNCTION agency_private.phase2_identity_ok(uuid,boolean)
  TO responder_command_fixture;

-- Phase 1's initial activation window must advance on an explicit reviewed renewal.
-- The Phase 5 command sets updated_at from server time and enforces <= 24h per command.
DO $$
DECLARE v_constraint name;
BEGIN
  SELECT conname INTO v_constraint FROM pg_constraint
    WHERE conrelid='agency_private.agency_updates'::regclass
      AND contype='c' AND pg_get_constraintdef(oid) LIKE '%expires_at <=%'
      AND pg_get_constraintdef(oid) LIKE '%activated_at%';
  IF v_constraint IS NULL THEN RAISE EXCEPTION 'Phase 1 expiry constraint missing'; END IF;
  EXECUTE format('ALTER TABLE agency_private.agency_updates DROP CONSTRAINT %I',v_constraint);
END $$;
ALTER TABLE agency_private.agency_updates ADD CONSTRAINT phase5_rolling_expiry_window
  CHECK (activated_at IS NULL OR expires_at IS NULL OR
    (expires_at > activated_at AND expires_at <= updated_at + interval '24 hours'));

CREATE FUNCTION agency_private.phase5_effective_status(
  p_status text,p_expires_at timestamptz,p_as_of timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT CASE WHEN p_status='active' AND p_expires_at<=p_as_of
    THEN 'expired' ELSE p_status END;
$$;
REVOKE ALL ON FUNCTION agency_private.phase5_effective_status(text,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION agency_private.phase5_effective_status(text,timestamptz,timestamptz)
  TO responder_command_fixture;

CREATE FUNCTION agency_private.phase5_agency_update_command(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_action text; v_org uuid; v_target uuid; v_token uuid; v_actor uuid;
  v_revision integer; v_role text; v_payload jsonb; v_allowed text[];
  v_digest bytea; v_payload_digest bytea; v_receipt record;
  v_update agency_private.agency_updates%ROWTYPE;
  v_identity record; v_member record; v_organization record; v_authority jsonb;
  v_point public.geometry; v_lon double precision; v_lat double precision;
  v_fips text; v_authority_id uuid; v_authority_version integer;
  v_title text; v_detail text; v_impact text; v_condition text;
  v_road text; v_cross text; v_crossing text; v_reason text;
  v_hours double precision; v_now timestamptz; v_new_revision integer;
  v_status text; v_event text; v_previous text; v_correlation uuid;
  v_result jsonb; v_update_id uuid; v_current_authority_id uuid; v_author uuid;
BEGIN
  IF p_request IS NULL OR jsonb_typeof(p_request) <> 'object'
    OR octet_length(p_request::text) > 8192
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_request) AS k
      WHERE k NOT IN ('contract_version','action','operation_token','organization_id',
        'update_id','expected_revision','payload')) THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  IF coalesce(p_request->>'contract_version','') <> 'responder.agency.v1.phase0.1'
    OR coalesce(p_request->>'operation_token','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR coalesce(p_request->>'organization_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR coalesce(jsonb_typeof(p_request->'payload'),'') <> 'object' THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  v_action := p_request->>'action';
  IF v_action NOT IN ('create_draft','edit_own_draft','edit_another_draft',
    'submit_for_review','return_for_changes','activate_non_closure',
    'activate_road_closed','edit_active_update','renew_update',
    'resolve_update','withdraw_update') OR v_action IS NULL THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  IF v_action = 'create_draft' THEN
    IF p_request ? 'update_id' OR p_request ? 'expected_revision' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
  ELSE
    IF coalesce(p_request->>'update_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR coalesce(p_request->>'expected_revision','') !~ '^(0|[1-9][0-9]{0,8})$' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_target := (p_request->>'update_id')::uuid;
    v_revision := (p_request->>'expected_revision')::integer;
  END IF;
  v_token := (p_request->>'operation_token')::uuid;
  v_org := (p_request->>'organization_id')::uuid;
  v_payload := p_request->'payload';
  IF v_action IN ('create_draft','edit_own_draft','edit_another_draft','edit_active_update') THEN
    v_allowed := ARRAY['condition_type','impact_level','title','detail','longitude','latitude',
      'road_name','cross_street','crossing_id','county_fips','authority_id','authority_version'];
  ELSIF v_action IN ('submit_for_review','activate_non_closure','activate_road_closed','renew_update') THEN
    v_allowed := ARRAY['county_fips','authority_id','authority_version','expiry_hours'];
  ELSE
    v_allowed := ARRAY['reason'];
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_payload) AS k WHERE k <> ALL(v_allowed)) THEN
    RETURN jsonb_build_object('status','invalid_request'); END IF;
  IF v_action IN ('create_draft','edit_own_draft','edit_another_draft','edit_active_update') THEN
    IF coalesce(v_payload->>'condition_type','') NOT IN
      ('road_closed','high_water','obstruction','construction','public_works_notice')
      OR coalesce(jsonb_typeof(v_payload->'title'),'') <> 'string'
      OR coalesce(char_length(trim(v_payload->>'title')),0) NOT BETWEEN 1 AND 120
      OR coalesce(jsonb_typeof(v_payload->'impact_level'),'') <> 'string'
      OR coalesce(char_length(trim(v_payload->>'impact_level')),0) NOT BETWEEN 1 AND 40
      OR (v_payload ? 'detail' AND (jsonb_typeof(v_payload->'detail') <> 'string'
        OR char_length(v_payload->>'detail') > 1000))
      OR (v_payload ? 'road_name' AND (jsonb_typeof(v_payload->'road_name') <> 'string'
        OR char_length(v_payload->>'road_name') > 120))
      OR (v_payload ? 'cross_street' AND (jsonb_typeof(v_payload->'cross_street') <> 'string'
        OR char_length(v_payload->>'cross_street') > 120))
      OR (v_payload ? 'crossing_id' AND (jsonb_typeof(v_payload->'crossing_id') <> 'string'
        OR char_length(v_payload->>'crossing_id') > 120))
      OR coalesce(v_payload->>'longitude','') !~ '^-?[0-9]{1,3}(\.[0-9]{1,16})?$'
      OR coalesce(v_payload->>'latitude','') !~ '^-?[0-9]{1,2}(\.[0-9]{1,16})?$'
      OR concat_ws(' ',v_payload->>'title',v_payload->>'impact_level',v_payload->>'detail',v_payload->>'road_name',
        v_payload->>'cross_street') ~ '[<>]' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_lon := (v_payload->>'longitude')::double precision;
    v_lat := (v_payload->>'latitude')::double precision;
    IF v_lon NOT BETWEEN -180 AND 180 OR v_lat NOT BETWEEN -90 AND 90 THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_point := public.ST_SetSRID(public.ST_MakePoint(v_lon,v_lat),4326);
    v_condition := v_payload->>'condition_type'; v_impact := trim(v_payload->>'impact_level');
    v_title := trim(v_payload->>'title'); v_detail := v_payload->>'detail';
    v_road := v_payload->>'road_name'; v_cross := v_payload->>'cross_street';
    v_crossing := v_payload->>'crossing_id';
  END IF;
  IF v_action IN ('return_for_changes','resolve_update','withdraw_update') THEN
    IF coalesce(jsonb_typeof(v_payload->'reason'),'') <> 'string'
      OR coalesce(char_length(trim(v_payload->>'reason')),0) NOT BETWEEN 1 AND 1000
      OR v_payload->>'reason' ~ '[<>]' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_reason := trim(v_payload->>'reason');
  END IF;
  IF v_payload ? 'county_fips' THEN
    IF coalesce(v_payload->>'county_fips','') !~ '^48[0-9]{3}$' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_fips := v_payload->>'county_fips';
  END IF;
  IF v_payload ? 'authority_id' THEN
    IF coalesce(v_payload->>'authority_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_authority_id := (v_payload->>'authority_id')::uuid;
  END IF;
  IF v_payload ? 'authority_version' THEN
    IF coalesce(v_payload->>'authority_version','') !~ '^[1-9][0-9]{0,8}$' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_authority_version := (v_payload->>'authority_version')::integer;
  END IF;
  IF v_payload ? 'expiry_hours' THEN
    IF v_action NOT IN ('activate_non_closure','activate_road_closed','renew_update')
      OR coalesce(v_payload->>'expiry_hours','') !~ '^(0|[1-9][0-9]?)(\.[0-9]{1,2})?$' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_hours := (v_payload->>'expiry_hours')::double precision;
    IF v_hours <= 0 OR v_hours > 24 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  ELSE v_hours := 12; END IF;

  -- Session identity is bound to the PostgreSQL login by Phase 4, never to payload or GUC.
  SELECT b.user_id,i.session_active,i.assurance,i.eligibility INTO v_identity
    FROM agency_private.phase4_session_bindings b
    JOIN agency_private.local_auth_identities i ON i.user_id=b.user_id
    WHERE b.db_role=session_user::name AND b.actor_kind='RESPONDER'
      AND i.identity_kind='RESPONDER';
  IF NOT FOUND OR NOT v_identity.session_active OR v_identity.assurance <> 'aal2'
    OR v_identity.eligibility <> 'eligible' THEN
    RETURN jsonb_build_object('status','forbidden'); END IF;
  v_actor := v_identity.user_id;
  SELECT verification_state,operation_state INTO v_organization
    FROM agency_private.organizations WHERE id=v_org;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_organization.operation_state='suspended' THEN
    RETURN jsonb_build_object('status','suspended'); END IF;
  IF v_organization.verification_state<>'verified' OR v_organization.operation_state<>'active' THEN
    RETURN jsonb_build_object('status','forbidden'); END IF;
  SELECT role,status INTO v_member FROM agency_private.organization_memberships
    WHERE organization_id=v_org AND user_id=v_actor AND status IN ('active','suspended')
    ORDER BY (status='active') DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_member.status='suspended' THEN RETURN jsonb_build_object('status','suspended'); END IF;
  v_role := v_member.role;
  IF v_role='VIEWER' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_action IN ('edit_another_draft','return_for_changes','activate_non_closure',
    'activate_road_closed','edit_active_update','renew_update','resolve_update')
    AND v_role NOT IN ('SUPERVISOR','AGENCY_ADMIN') THEN
    RETURN jsonb_build_object('status','forbidden'); END IF;

  -- Serializes exact-token retries; a committed receipt is never rewritten.
  v_digest := sha256(decode(replace(v_token::text,'-',''),'hex'));
  v_payload_digest := sha256(convert_to((p_request - 'operation_token')::text,'UTF8'));
  PERFORM pg_advisory_xact_lock(hashtextextended(encode(v_digest,'hex'),0));
  SELECT * INTO v_receipt FROM agency_private.agency_operation_receipts WHERE token_digest=v_digest;
  IF FOUND THEN
    IF v_receipt.actor_user_id=v_actor AND v_receipt.organization_id=v_org
      AND v_receipt.action=v_action
      AND (v_action='create_draft' OR v_receipt.update_id IS NOT DISTINCT FROM v_target)
      AND v_receipt.payload_digest=v_payload_digest THEN
      RETURN jsonb_build_object('status','already_processed',
        'correlation_id',v_receipt.bounded_result->>'correlation_id');
    END IF;
    RETURN jsonb_build_object('status','invalid_request');
  END IF;

  IF v_action<>'create_draft' THEN
    SELECT * INTO v_update FROM agency_private.agency_updates
      WHERE id=v_target AND organization_id=v_org FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
    IF v_update.revision<>v_revision THEN RETURN jsonb_build_object('status','stale_revision'); END IF;
    v_previous := v_update.status;
    v_current_authority_id := v_update.current_authority_id;
    v_author := v_update.author_user_id;
    IF v_update.status IN ('resolved','withdrawn') THEN
      RETURN jsonb_build_object('status',CASE WHEN v_action IN
        ('activate_non_closure','activate_road_closed') THEN 'invalid_request'
        ELSE 'forbidden' END); END IF;
    IF agency_private.phase5_effective_status(v_update.status,v_update.expires_at,
      clock_timestamp())='expired' THEN
      RETURN jsonb_build_object('status','expired'); END IF;
  END IF;
  IF v_action='edit_own_draft' AND v_update.author_user_id<>v_actor THEN
    RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_action='submit_for_review' AND v_role='RESPONDER'
    AND v_update.author_user_id<>v_actor THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_action='withdraw_update' AND v_role='RESPONDER'
    AND (v_update.author_user_id<>v_actor OR v_update.status NOT IN ('draft','pending_review')) THEN
    RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_action='activate_road_closed' AND v_update.author_user_id=v_actor THEN
    RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_action IN ('edit_own_draft','edit_another_draft','submit_for_review')
    AND v_update.status<>'draft' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_action IN ('return_for_changes','activate_non_closure','activate_road_closed')
    AND v_update.status<>'pending_review' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_action IN ('edit_active_update','renew_update','resolve_update')
    AND v_update.status<>'active' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_action='activate_non_closure' AND v_update.condition_type='road_closed' THEN
    RETURN jsonb_build_object('status','invalid_request'); END IF;
  IF v_action='activate_road_closed' AND v_update.condition_type<>'road_closed' THEN
    RETURN jsonb_build_object('status','invalid_request'); END IF;
  IF v_action='edit_active_update' AND v_condition<>v_update.condition_type THEN
    RETURN jsonb_build_object('status','invalid_request'); END IF;
  -- No governed crossing-ID resolver exists in the private local fixture.
  -- Preserve a draft reference, but fail closed before an active mutation.
  IF v_action IN ('activate_non_closure','activate_road_closed')
    AND v_update.crossing_id IS NOT NULL THEN
    RETURN jsonb_build_object('status','invalid_request'); END IF;
  IF v_action='edit_active_update' AND v_crossing IS NOT NULL THEN
    RETURN jsonb_build_object('status','invalid_request'); END IF;

  IF v_action IN ('activate_non_closure','activate_road_closed','edit_active_update','renew_update') THEN
    SELECT agency_publishing_enabled INTO STRICT v_status
      FROM agency_private.agency_program_controls WHERE singleton_key=1 FOR SHARE;
    IF v_status<>'true' THEN RETURN jsonb_build_object('status','maintenance'); END IF;
  END IF;
  IF v_action IN ('create_draft','edit_own_draft','edit_another_draft','submit_for_review',
    'return_for_changes','activate_non_closure','activate_road_closed',
    'edit_active_update','renew_update') THEN
    IF v_point IS NULL THEN v_point := v_update.point; END IF;
    v_authority := agency_private.phase3_authorize_point(v_actor,v_org,v_point,
      v_fips,v_authority_id,v_authority_version);
    IF v_authority->>'status'<>'accepted' THEN
      RETURN jsonb_build_object('status',v_authority->>'status'); END IF;
  END IF;

  v_now := clock_timestamp(); v_correlation := gen_random_uuid();
  IF v_action='create_draft' THEN
    INSERT INTO agency_private.agency_updates
      (organization_id,author_user_id,created_authority_id,condition_type,impact_level,
        title,detail,point,road_name,cross_street,crossing_id,status)
    VALUES (v_org,v_actor,(v_authority->>'authority_id')::uuid,v_condition,v_impact,
      v_title,v_detail,v_point,v_road,v_cross,v_crossing,'draft')
    RETURNING id,revision INTO v_update_id,v_new_revision;
    v_event := 'update_draft_created'; v_status := 'accepted';
  ELSE
    v_update_id := v_target; v_new_revision := v_revision+1; v_status := 'accepted';
    CASE v_action
      WHEN 'edit_own_draft','edit_another_draft','edit_active_update' THEN
        UPDATE agency_private.agency_updates SET
          condition_type=v_condition,impact_level=v_impact,title=v_title,detail=v_detail,
          point=v_point,road_name=v_road,cross_street=v_cross,crossing_id=v_crossing,
          current_authority_id=CASE WHEN v_action='edit_active_update' THEN
            (v_authority->>'authority_id')::uuid ELSE current_authority_id END,
          revision=v_new_revision,updated_at=v_now WHERE id=v_target;
        v_event := CASE WHEN v_action='edit_active_update' THEN 'update_edited'
          ELSE 'update_draft_edited' END;
      WHEN 'submit_for_review' THEN
        UPDATE agency_private.agency_updates SET status='pending_review',
          submitted_at=v_now,revision=v_new_revision,updated_at=v_now WHERE id=v_target;
        v_event := 'update_submitted'; v_status := 'pending_review';
      WHEN 'return_for_changes' THEN
        UPDATE agency_private.agency_updates SET status='draft',revision=v_new_revision,
          updated_at=v_now WHERE id=v_target;
        v_event := 'update_returned';
      WHEN 'activate_non_closure','activate_road_closed' THEN
        UPDATE agency_private.agency_updates SET status='active',
          current_authority_id=(v_authority->>'authority_id')::uuid,
          activated_at=v_now,expires_at=v_now+make_interval(secs => v_hours*3600),
          revision=v_new_revision,updated_at=v_now WHERE id=v_target;
        v_event := CASE WHEN v_action='activate_road_closed' THEN 'road_closure_activated'
          ELSE 'update_activated' END;
      WHEN 'renew_update' THEN
        UPDATE agency_private.agency_updates SET
          current_authority_id=(v_authority->>'authority_id')::uuid,
          expires_at=v_now+make_interval(secs => v_hours*3600),
          revision=v_new_revision,updated_at=v_now WHERE id=v_target;
        v_event := 'update_renewed';
      WHEN 'resolve_update' THEN
        UPDATE agency_private.agency_updates SET status='resolved',resolved_at=v_now,
          resolved_by_user_id=v_actor,revision=v_new_revision,updated_at=v_now WHERE id=v_target;
        v_event := 'update_resolved';
      WHEN 'withdraw_update' THEN
        UPDATE agency_private.agency_updates SET status='withdrawn',withdrawn_at=v_now,
          revision=v_new_revision,updated_at=v_now WHERE id=v_target;
        v_event := 'update_withdrawn';
    END CASE;
  END IF;
  INSERT INTO agency_private.agency_update_events
    (update_id,organization_id,actor_user_id,authority_id,action,
      previous_snapshot,new_snapshot,point,reason,operation_id,revision)
  VALUES (v_update_id,v_org,v_actor,
    CASE WHEN v_authority->>'status'='accepted' THEN (v_authority->>'authority_id')::uuid
      ELSE v_current_authority_id END,
    v_event,jsonb_build_object('status',v_previous),
    jsonb_build_object('status',CASE
      WHEN v_action IN ('create_draft','return_for_changes') THEN 'draft'
      WHEN v_action='submit_for_review' THEN 'pending_review'
      WHEN v_action IN ('activate_non_closure','activate_road_closed','edit_active_update','renew_update') THEN 'active'
      WHEN v_action='resolve_update' THEN 'resolved' WHEN v_action='withdraw_update' THEN 'withdrawn'
      ELSE 'draft' END,'revision',v_new_revision,
      'author_user_id',CASE WHEN v_action='activate_road_closed' THEN v_author END),
    CASE WHEN v_authority->>'status'='accepted' THEN v_point ELSE NULL END,
    v_reason,v_correlation,v_new_revision);
  v_result := jsonb_build_object('status',v_status,'update_id',v_update_id,
    'revision',v_new_revision,'correlation_id',v_correlation);
  INSERT INTO agency_private.agency_operation_receipts
    (token_digest,actor_user_id,organization_id,update_id,action,payload_digest,bounded_result)
  VALUES (v_digest,v_actor,v_org,v_update_id,v_action,v_payload_digest,v_result);
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  -- PL/pgSQL exception subtransaction rolls back mutation, event, and receipt together.
  RAISE LOG 'phase5 local command SQLSTATE %: %', SQLSTATE, SQLERRM;
  RETURN jsonb_build_object('status','retryable_failure');
END $$;

REVOKE ALL ON FUNCTION agency_private.phase5_agency_update_command(jsonb) FROM PUBLIC;
ALTER FUNCTION agency_private.phase5_agency_update_command(jsonb) OWNER TO responder_command_fixture;
GRANT EXECUTE ON FUNCTION agency_private.phase5_agency_update_command(jsonb)
  TO responder_rls_agency_fixture;
COMMIT;
