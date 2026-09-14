-- LOCAL/DISPOSABLE ONLY. Synthetic PostgreSQL sessions; never deploy as a production RPC.
-- Requires Phases 1-5, PostgreSQL 17.10 and PostGIS 3.6.2.
BEGIN;

CREATE ROLE responder_governance_fixture NOLOGIN BYPASSRLS;
GRANT USAGE,CREATE ON SCHEMA agency_private TO responder_governance_fixture;
GRANT SELECT ON agency_private.phase4_session_bindings,
  agency_private.local_auth_identities,agency_private.organization_memberships,
  agency_private.county_geometry_catalog,agency_private.agency_program_controls
  TO responder_governance_fixture;
GRANT SELECT,UPDATE ON agency_private.organizations,agency_private.organization_authorities,
  agency_private.agency_updates TO responder_governance_fixture;
GRANT INSERT ON agency_private.organization_authorities,
  agency_private.organization_verification_events,
  agency_private.organization_governance_events,
  agency_private.agency_update_events TO responder_governance_fixture;
GRANT SELECT (id) ON agency_private.organization_verification_events
  TO responder_governance_fixture;
GRANT SELECT,INSERT,UPDATE ON agency_private.organization_invites,
  agency_private.organization_memberships TO responder_governance_fixture;
GRANT SELECT,UPDATE ON agency_private.local_auth_identities TO responder_governance_fixture;
GRANT EXECUTE ON FUNCTION agency_private.phase2_membership_command(
  text,uuid,uuid,uuid,text,uuid,bytea,text,uuid,boolean) TO responder_governance_fixture;
GRANT EXECUTE ON FUNCTION agency_private.phase2_audit(
  uuid,uuid,uuid,text,jsonb,jsonb,text,uuid) TO responder_governance_fixture;

ALTER TABLE agency_private.organizations ADD COLUMN governance_revision integer NOT NULL
  DEFAULT 0 CHECK (governance_revision >= 0);

CREATE TABLE agency_private.governance_operation_receipts (
  token_digest bytea PRIMARY KEY CHECK (octet_length(token_digest)=32),
  payload_digest bytea NOT NULL CHECK (octet_length(payload_digest)=32),
  actor_user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  related_id uuid,
  bounded_result jsonb NOT NULL CHECK (jsonb_typeof(bounded_result)='object'
    AND octet_length(bounded_result::text)<=1024),
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER governance_receipts_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
  ON agency_private.governance_operation_receipts FOR EACH STATEMENT
  EXECUTE FUNCTION agency_private.reject_row_mutation();
ALTER TABLE agency_private.governance_operation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_private.governance_operation_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON agency_private.governance_operation_receipts FROM PUBLIC;
GRANT SELECT,INSERT ON agency_private.governance_operation_receipts TO responder_governance_fixture;

CREATE FUNCTION agency_private.phase6_governance_command(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_action text; v_org uuid; v_token uuid; v_actor uuid; v_payload jsonb;
  v_reason text; v_evidence text; v_revision integer; v_digest bytea;
  v_payload_digest bytea; v_receipt record; v_organization record;
  v_authority record; v_county record; v_fips text; v_version integer;
  v_from timestamptz; v_until timestamptz; v_related uuid;
  v_before jsonb; v_after jsonb; v_result jsonb; v_correlation uuid;
  v_event text; v_verification_event text; v_new_state text;
  v_target uuid; v_outcome text; v_row record; v_now timestamptz;
  v_allowed text[];
BEGIN
  IF p_request IS NULL OR jsonb_typeof(p_request)<>'object'
    OR octet_length(p_request::text)>4096
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_request) k WHERE k NOT IN
      ('contract_version','action','operation_token','organization_id','expected_revision','payload'))
    OR coalesce(p_request->>'contract_version','')<>'responder.agency.v1.phase0.1'
    OR coalesce(p_request->>'operation_token','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR coalesce(p_request->>'organization_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR coalesce(p_request->>'expected_revision','') !~ '^(0|[1-9][0-9]{0,8})$'
    OR coalesce(jsonb_typeof(p_request->'payload'),'')<>'object' THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  v_action:=p_request->>'action';
  IF v_action NOT IN ('start_verification_review','verify_organization','reject_organization',
    'revoke_organization_verification','activate_organization','approve_authority',
    'revoke_authority','suspend_organization','reinstate_organization','recover_lost_admin') THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  v_org:=(p_request->>'organization_id')::uuid;
  v_token:=(p_request->>'operation_token')::uuid;
  v_revision:=(p_request->>'expected_revision')::integer;
  v_payload:=p_request->'payload';
  IF v_action='verify_organization' THEN
    v_allowed:=ARRAY['reason','evidence_reference','official_callback_confirmed','initial_admin_reviewed'];
  ELSIF v_action='approve_authority' THEN
    v_allowed:=ARRAY['reason','county_fips','source_sha256','source_schema_version',
      'authority_version','effective_from','effective_until','scope_type','place_point'];
  ELSIF v_action='revoke_authority' THEN
    v_allowed:=ARRAY['reason','authority_id'];
  ELSIF v_action='recover_lost_admin' THEN
    v_allowed:=ARRAY['reason','target_user_id','independent_contact_confirmed','invite_token_digest'];
  ELSIF v_action='start_verification_review' THEN
    v_allowed:=ARRAY['reason','evidence_reference'];
  ELSE
    v_allowed:=ARRAY['reason'];
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_payload) k WHERE k<>ALL(v_allowed))
    OR coalesce(jsonb_typeof(v_payload->'reason'),'')<>'string' THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  v_reason:=trim(v_payload->>'reason');
  IF char_length(v_reason) NOT BETWEEN 1 AND 1000 OR v_reason ~ '[<>]'
    OR octet_length(v_reason)>1000 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  IF v_payload ? 'evidence_reference' THEN
    IF jsonb_typeof(v_payload->'evidence_reference')<>'string' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_evidence:=trim(v_payload->>'evidence_reference');
    IF char_length(v_evidence) NOT BETWEEN 1 AND 160 OR v_evidence ~ '[<>]'
      OR octet_length(v_evidence)>160 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  END IF;
  IF v_action='verify_organization' AND
    (v_evidence IS NULL OR v_payload->'official_callback_confirmed' IS DISTINCT FROM 'true'::jsonb
      OR v_payload->'initial_admin_reviewed' IS DISTINCT FROM 'true'::jsonb) THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  IF v_action='start_verification_review' AND v_evidence IS NULL THEN
    RETURN jsonb_build_object('status','invalid_request'); END IF;

  SELECT b.user_id INTO v_actor FROM agency_private.phase4_session_bindings b
    JOIN agency_private.local_auth_identities i ON i.user_id=b.user_id
    WHERE b.db_role=session_user::name AND b.actor_kind='GRIDLY_ADMIN'
      AND i.identity_kind='GRIDLY_ADMIN' AND i.assurance='aal2'
      AND i.session_active AND i.eligibility='eligible';
  IF v_actor IS NULL THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_action='approve_authority' AND
    (v_payload ? 'place_point' OR (v_payload ? 'scope_type'
      AND v_payload->>'scope_type'<>'COUNTY')) THEN
    RETURN jsonb_build_object('status','out_of_scope'); END IF;

  v_digest:=sha256(decode(replace(v_token::text,'-',''),'hex'));
  v_payload_digest:=sha256(convert_to((p_request-'operation_token')::text,'UTF8'));
  PERFORM pg_advisory_xact_lock(hashtextextended(encode(v_digest,'hex'),0));
  SELECT * INTO v_receipt FROM agency_private.governance_operation_receipts
    WHERE token_digest=v_digest;
  IF FOUND THEN
    IF v_receipt.actor_user_id=v_actor AND v_receipt.organization_id=v_org
      AND v_receipt.action=v_action AND v_receipt.payload_digest=v_payload_digest THEN
      RETURN jsonb_build_object('status','already_processed',
        'correlation_id',v_receipt.bounded_result->>'correlation_id');
    END IF;
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  SELECT * INTO v_organization FROM agency_private.organizations
    WHERE id=v_org FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_organization.governance_revision<>v_revision THEN
    RETURN jsonb_build_object('status','stale_revision'); END IF;
  v_before:=jsonb_build_object('verification_state',v_organization.verification_state,
    'operation_state',v_organization.operation_state,'governance_revision',v_revision);
  v_correlation:=gen_random_uuid();
  v_now:=clock_timestamp();

  IF v_action IN ('start_verification_review','verify_organization','reject_organization',
    'revoke_organization_verification') THEN
    IF (v_action='start_verification_review' AND v_organization.verification_state<>'requested')
      OR (v_action IN ('verify_organization','reject_organization')
        AND v_organization.verification_state<>'pending_review')
      OR (v_action='revoke_organization_verification'
        AND v_organization.verification_state<>'verified') THEN
      RETURN jsonb_build_object('status','forbidden'); END IF;
    v_new_state:=CASE v_action WHEN 'start_verification_review' THEN 'pending_review'
      WHEN 'verify_organization' THEN 'verified' WHEN 'reject_organization' THEN 'rejected'
      ELSE 'revoked' END;
    v_verification_event:=CASE v_action WHEN 'start_verification_review' THEN 'verification_review_started'
      WHEN 'verify_organization' THEN 'organization_verified' WHEN 'reject_organization' THEN 'organization_rejected'
      ELSE 'verification_revoked' END;
    UPDATE agency_private.organizations SET verification_state=v_new_state,
      verified_at=CASE WHEN v_new_state='verified' THEN v_now ELSE verified_at END,
      revoked_at=CASE WHEN v_new_state='revoked' THEN v_now ELSE revoked_at END,
      operation_state=CASE WHEN v_new_state='revoked' THEN 'suspended' ELSE operation_state END,
      suspended_at=CASE WHEN v_new_state='revoked' THEN v_now ELSE suspended_at END,
      operation_epoch=operation_epoch+CASE WHEN v_new_state='revoked' THEN 1 ELSE 0 END,
      governance_revision=governance_revision+1 WHERE id=v_org;
    INSERT INTO agency_private.organization_verification_events
      (organization_id,reviewer_user_id,from_state,to_state,method_reference,reason)
    VALUES (v_org,v_actor,v_organization.verification_state,v_new_state,
      jsonb_build_object('evidence_reference',v_evidence,'operation_id',v_correlation,
        'official_callback_confirmed',coalesce(v_payload->'official_callback_confirmed','false'::jsonb),
        'initial_admin_reviewed',coalesce(v_payload->'initial_admin_reviewed','false'::jsonb)),v_reason)
    RETURNING id INTO v_related;
    v_event:=v_verification_event;
  ELSIF v_action IN ('activate_organization','suspend_organization','reinstate_organization') THEN
    IF (v_action='activate_organization' AND
        (v_organization.verification_state<>'verified' OR v_organization.operation_state<>'inactive'))
      OR (v_action='suspend_organization' AND v_organization.operation_state<>'active')
      OR (v_action='reinstate_organization' AND
        (v_organization.verification_state<>'verified' OR v_organization.operation_state<>'suspended')) THEN
      RETURN jsonb_build_object('status','forbidden'); END IF;
    IF v_action<>'suspend_organization' AND NOT EXISTS
      (SELECT 1 FROM agency_private.organization_authorities a
        WHERE a.organization_id=v_org AND a.status='approved' AND a.revoked_at IS NULL
          AND a.effective_from<=v_now AND (a.effective_until IS NULL OR a.effective_until>v_now)) THEN
      RETURN jsonb_build_object('status','out_of_scope'); END IF;
    IF v_action<>'suspend_organization' AND NOT EXISTS
      (SELECT 1 FROM agency_private.organization_memberships m
        JOIN agency_private.local_auth_identities i ON i.user_id=m.user_id
        WHERE m.organization_id=v_org AND m.role='AGENCY_ADMIN' AND m.status='active'
          AND i.identity_kind='RESPONDER' AND i.assurance='aal2'
          AND i.session_active AND i.eligibility='eligible') THEN
      RETURN jsonb_build_object('status','forbidden'); END IF;
    v_new_state:=CASE WHEN v_action='suspend_organization' THEN 'suspended' ELSE 'active' END;
    UPDATE agency_private.organizations SET operation_state=v_new_state,
      suspended_at=CASE WHEN v_new_state='suspended' THEN v_now ELSE NULL END,
      operation_epoch=operation_epoch+1,governance_revision=governance_revision+1 WHERE id=v_org;
    v_event:=CASE v_action WHEN 'activate_organization' THEN 'organization_activated'
      WHEN 'suspend_organization' THEN 'organization_suspended' ELSE 'organization_reinstated' END;
  ELSIF v_action='approve_authority' THEN
    IF v_organization.verification_state<>'verified' OR v_organization.operation_state<>'active' THEN
      RETURN jsonb_build_object('status',CASE WHEN v_organization.operation_state='suspended'
        THEN 'suspended' ELSE 'forbidden' END); END IF;
    IF coalesce(jsonb_typeof(v_payload->'county_fips'),'')<>'string'
      OR coalesce(v_payload->>'county_fips','') !~ '^48[0-9]{3}$'
      OR coalesce(jsonb_typeof(v_payload->'source_sha256'),'')<>'string'
      OR coalesce(jsonb_typeof(v_payload->'source_schema_version'),'')<>'string'
      OR coalesce(v_payload->>'authority_version','') !~ '^[1-9][0-9]{0,8}$'
      OR coalesce(jsonb_typeof(v_payload->'effective_from'),'')<>'string'
      OR (v_payload ? 'effective_until' AND jsonb_typeof(v_payload->'effective_until')<>'string') THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    IF (SELECT count(*) FROM agency_private.county_geometry_catalog)<>254 THEN
      RETURN jsonb_build_object('status','maintenance'); END IF;
    v_fips:=v_payload->>'county_fips';
    SELECT * INTO v_county FROM agency_private.county_geometry_catalog WHERE county_fips=v_fips;
    IF NOT FOUND OR v_county.source_sha256<>v_payload->>'source_sha256'
      OR v_county.source_schema_version<>v_payload->>'source_schema_version' THEN
      RETURN jsonb_build_object('status','out_of_scope'); END IF;
    v_version:=(v_payload->>'authority_version')::integer;
    BEGIN
      v_from:=(v_payload->>'effective_from')::timestamptz;
      v_until:=NULLIF(v_payload->>'effective_until','')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RETURN jsonb_build_object('status','invalid_request');
    END;
    IF v_from IS NULL OR NOT isfinite(v_from)
      OR (v_until IS NOT NULL AND (NOT isfinite(v_until) OR v_until<=v_from))
      OR v_version <= coalesce((SELECT max(authority_version)
        FROM agency_private.organization_authorities
        WHERE organization_id=v_org AND county_fips=v_fips),0)
      OR EXISTS (SELECT 1 FROM agency_private.organization_authorities
        WHERE organization_id=v_org AND county_fips=v_fips AND status='approved') THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    INSERT INTO agency_private.organization_authorities
      (organization_id,authority_version,scope_type,county_fips,geometry,source_path,
        source_sha256,source_schema_version,effective_from,effective_until,approved_by,approved_at,status)
    VALUES (v_org,v_version,'COUNTY',v_county.county_fips,v_county.geometry,
      'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json',
      v_county.source_sha256,v_county.source_schema_version,v_from,v_until,v_actor,v_now,'approved')
    RETURNING id INTO v_related;
    UPDATE agency_private.organizations SET governance_revision=governance_revision+1 WHERE id=v_org;
    v_event:='county_authority_approved';
  ELSIF v_action='revoke_authority' THEN
    IF coalesce(v_payload->>'authority_id','') !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_related:=(v_payload->>'authority_id')::uuid;
    SELECT * INTO v_authority FROM agency_private.organization_authorities
      WHERE id=v_related AND organization_id=v_org FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
    IF v_authority.status<>'approved' THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
    UPDATE agency_private.organization_authorities SET status='revoked',revoked_at=v_now WHERE id=v_related;
    UPDATE agency_private.organizations SET governance_revision=governance_revision+1 WHERE id=v_org;
    v_event:='county_authority_revoked';
  ELSIF v_action='recover_lost_admin' THEN
    IF v_organization.verification_state<>'verified' OR v_organization.operation_state<>'active' THEN
      RETURN jsonb_build_object('status',CASE WHEN v_organization.operation_state='suspended'
        THEN 'suspended' ELSE 'forbidden' END); END IF;
    IF v_payload->'independent_contact_confirmed' IS DISTINCT FROM 'true'::jsonb OR
      coalesce(v_payload->>'target_user_id','') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_target:=(v_payload->>'target_user_id')::uuid;
    v_outcome:=agency_private.phase2_membership_command('recover_admin',v_actor,v_org,v_target,
      NULL,NULL,CASE WHEN coalesce(v_payload->>'invite_token_digest','') ~ '^[0-9a-f]{64}$'
        THEN decode(v_payload->>'invite_token_digest','hex') ELSE NULL END,
      v_reason,v_correlation,true);
    IF v_outcome<>'accepted' THEN RETURN jsonb_build_object('status',v_outcome); END IF;
    SELECT id INTO v_related FROM agency_private.organization_memberships
      WHERE organization_id=v_org AND user_id=v_target;
    UPDATE agency_private.organizations SET governance_revision=governance_revision+1 WHERE id=v_org;
    v_event:='admin_recovery_governed';
  END IF;

  -- An active row whose expiry has passed is already effectively terminal and
  -- cannot be revised under the frozen lifecycle trigger. Current posts are
  -- withdrawn with a per-update event in this same transaction.
  IF v_action IN ('suspend_organization','revoke_organization_verification','revoke_authority') THEN
    FOR v_row IN SELECT * FROM agency_private.agency_updates u
      WHERE u.organization_id=v_org AND u.status='active' AND u.expires_at>v_now
        AND (v_action<>'revoke_authority' OR u.current_authority_id=v_related)
      FOR UPDATE LOOP
      UPDATE agency_private.agency_updates SET status='withdrawn',withdrawn_at=v_now,
        updated_at=v_now,revision=revision+1 WHERE id=v_row.id;
      INSERT INTO agency_private.agency_update_events
        (update_id,organization_id,actor_user_id,authority_id,action,
          previous_snapshot,new_snapshot,reason,operation_id,revision)
      VALUES (v_row.id,v_org,v_actor,v_row.current_authority_id,'update_withdrawn',
        jsonb_build_object('status','active','revision',v_row.revision),
        jsonb_build_object('status','withdrawn','revision',v_row.revision+1),
        v_reason,v_correlation,v_row.revision+1);
    END LOOP;
  END IF;
  IF v_action='revoke_organization_verification' THEN
    INSERT INTO agency_private.organization_governance_events
      (organization_id,actor_user_id,action,before_snapshot,after_snapshot,reason,correlation_id)
    VALUES (v_org,v_actor,'organization_suspended',
      jsonb_build_object('operation_state',v_organization.operation_state),
      jsonb_build_object('operation_state','suspended'),v_reason,v_correlation);
  END IF;
  SELECT jsonb_build_object('verification_state',verification_state,
    'operation_state',operation_state,'governance_revision',governance_revision)
    INTO v_after FROM agency_private.organizations WHERE id=v_org;
  INSERT INTO agency_private.organization_governance_events
    (organization_id,actor_user_id,affected_membership_id,affected_authority_id,
      action,before_snapshot,after_snapshot,reason,correlation_id)
  VALUES (v_org,v_actor,CASE WHEN v_action='recover_lost_admin' THEN v_related END,
    CASE WHEN v_action IN ('approve_authority','revoke_authority') THEN v_related END,
    v_event,v_before,v_after,v_reason,v_correlation);
  v_result:=jsonb_build_object('status','accepted','correlation_id',v_correlation,
    'governance_revision',v_revision+1,'related_id',v_related);
  INSERT INTO agency_private.governance_operation_receipts
    (token_digest,payload_digest,actor_user_id,organization_id,action,related_id,bounded_result)
  VALUES (v_digest,v_payload_digest,v_actor,v_org,v_action,v_related,v_result);
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  -- The PL/pgSQL exception subtransaction rolls back all state, events and receipt.
  RAISE LOG 'phase6 local governance SQLSTATE %: %', SQLSTATE, SQLERRM;
  RETURN jsonb_build_object('status','retryable_failure');
END $$;

REVOKE ALL ON FUNCTION agency_private.phase6_governance_command(jsonb) FROM PUBLIC;
ALTER FUNCTION agency_private.phase6_governance_command(jsonb) OWNER TO responder_governance_fixture;
GRANT EXECUTE ON FUNCTION agency_private.phase6_governance_command(jsonb)
  TO responder_rls_governance_fixture;
COMMIT;
