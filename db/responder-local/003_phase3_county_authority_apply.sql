-- LOCAL/DISPOSABLE ONLY. Requires Phase 1 and Phase 2 local SQL plus PostGIS 3.6.2.
-- The catalog is a source fixture, NOT a statewide organization authority grant.
BEGIN;
CREATE TABLE agency_private.county_geometry_catalog (
  county_fips char(5) PRIMARY KEY CHECK (county_fips ~ '^48[0-9]{3}$'
    AND substring(county_fips,3)::integer BETWEEN 1 AND 507
    AND mod(substring(county_fips,3)::integer,2)=1),
  county_id text NOT NULL UNIQUE CHECK (char_length(county_id) BETWEEN 2 AND 100),
  geometry public.geometry(Polygon,4326) NOT NULL CHECK (NOT public.ST_IsEmpty(geometry)
    AND public.ST_IsValid(geometry) AND public.ST_XMin(geometry)>=-180
    AND public.ST_XMax(geometry)<=180 AND public.ST_YMin(geometry)>=-90
    AND public.ST_YMax(geometry)<=90),
  source_sha256 char(64) NOT NULL CHECK (source_sha256='6c6eeb549bb5e03d79efbc4d421783c06988c81c0f728c79add32f8c219e3d49'),
  source_schema_version text NOT NULL CHECK (source_schema_version='gridly.lp148.statewideCountyGeometry.runtime.v1'),
  source_package_version text NOT NULL CHECK (source_package_version='lp148-owner-built-statewide-runtime-geometry-v1')
);
CREATE INDEX county_geometry_catalog_gist_idx ON agency_private.county_geometry_catalog USING gist (geometry);
CREATE TRIGGER county_catalog_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON agency_private.county_geometry_catalog FOR EACH STATEMENT EXECUTE FUNCTION agency_private.reject_row_mutation();
REVOKE ALL ON agency_private.county_geometry_catalog FROM PUBLIC;
GRANT SELECT, INSERT ON agency_private.county_geometry_catalog TO responder_owner_fixture;

CREATE FUNCTION agency_private.phase3_catalog_authority_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,agency_private AS $$
DECLARE canonical record;
BEGIN
  SELECT * INTO canonical FROM agency_private.county_geometry_catalog WHERE county_fips=NEW.county_fips;
  IF NOT FOUND OR NEW.scope_type<>'COUNTY'
    OR NEW.geometry::text IS DISTINCT FROM canonical.geometry::text
    OR NEW.source_sha256 IS DISTINCT FROM canonical.source_sha256
    OR NEW.source_schema_version IS DISTINCT FROM canonical.source_schema_version
    OR NEW.source_path IS DISTINCT FROM 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json'
  THEN RAISE EXCEPTION 'authority must derive from certified county catalog' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER authorities_phase3_catalog_guard BEFORE INSERT OR UPDATE
  ON agency_private.organization_authorities FOR EACH ROW
  EXECUTE FUNCTION agency_private.phase3_catalog_authority_guard();

CREATE FUNCTION agency_private.phase3_create_county_authority(
  p_reviewer uuid,p_organization uuid,p_county_fips char(5),p_version integer,
  p_effective_from timestamptz,p_effective_until timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SET search_path=pg_catalog,agency_private AS $$
DECLARE county record; org record; new_id uuid;
BEGIN
  IF NOT agency_private.phase2_identity_ok(p_reviewer,true)
    OR NOT EXISTS (SELECT 1 FROM agency_private.local_auth_identities
      WHERE user_id=p_reviewer AND identity_kind='GRIDLY_ADMIN') THEN
    RAISE EXCEPTION 'local Gridly reviewer required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO org FROM agency_private.organizations WHERE id=p_organization FOR UPDATE;
  IF NOT FOUND OR org.verification_state<>'verified' THEN
    RAISE EXCEPTION 'verified organization required' USING ERRCODE='23514';
  END IF;
  IF (SELECT count(*) FROM agency_private.county_geometry_catalog)<>254 THEN
    RAISE EXCEPTION 'complete certified county catalog required' USING ERRCODE='23514';
  END IF;
  SELECT * INTO county FROM agency_private.county_geometry_catalog WHERE county_fips=p_county_fips;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown certified county' USING ERRCODE='23514'; END IF;
  INSERT INTO agency_private.organization_authorities
    (organization_id,authority_version,scope_type,county_fips,geometry,source_path,
     source_sha256,source_schema_version,effective_from,effective_until,approved_by,approved_at,status)
  VALUES (p_organization,p_version,'COUNTY',county.county_fips,county.geometry,
    'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json',
    county.source_sha256,county.source_schema_version,p_effective_from,p_effective_until,
    p_reviewer,clock_timestamp(),'approved') RETURNING id INTO new_id;
  INSERT INTO agency_private.organization_governance_events
    (organization_id,actor_user_id,affected_authority_id,action,before_snapshot,after_snapshot,reason,correlation_id)
  VALUES (p_organization,p_reviewer,new_id,'county_authority_approved','{}'::jsonb,
    jsonb_build_object('county_fips',county.county_fips,'authority_version',p_version,'status','approved'),
    'local certified county fixture',gen_random_uuid());
  RETURN new_id;
END $$;

CREATE FUNCTION agency_private.phase3_authorize_point(
  p_actor uuid,p_organization uuid,p_point public.geometry,p_client_fips text DEFAULT NULL,
  p_client_authority_id uuid DEFAULT NULL,p_client_version integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog,agency_private,public AS $$
DECLARE org record; member record; authority record; resolved_fips char(5); matching_count integer;
DECLARE x double precision; y double precision; v_now timestamptz;
BEGIN
  -- Trusted local fixture only. Actor must become server-derived auth.uid() later.
  IF NOT agency_private.phase2_identity_ok(p_actor,true) THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  SELECT verification_state,operation_state INTO org FROM agency_private.organizations WHERE id=p_organization;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF org.operation_state='suspended' THEN RETURN jsonb_build_object('status','suspended'); END IF;
  IF org.verification_state<>'verified' OR org.operation_state<>'active' THEN
    RETURN jsonb_build_object('status','forbidden'); END IF;
  SELECT role,status INTO member FROM agency_private.organization_memberships
    WHERE organization_id=p_organization AND user_id=p_actor AND status IN ('active','suspended')
    ORDER BY (status='active') DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF member.status='suspended' THEN RETURN jsonb_build_object('status','suspended'); END IF;
  IF member.role NOT IN ('RESPONDER','SUPERVISOR','AGENCY_ADMIN') THEN
    RETURN jsonb_build_object('status','forbidden'); END IF;
  IF p_point IS NULL OR public.ST_IsEmpty(p_point) OR NOT public.ST_IsValid(p_point)
    OR public.ST_GeometryType(p_point)<>'ST_Point' OR public.ST_SRID(p_point)<>4326
    OR public.ST_NDims(p_point)<>2 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  x:=public.ST_X(p_point); y:=public.ST_Y(p_point);
  IF x::text IN ('NaN','Infinity','-Infinity') OR y::text IN ('NaN','Infinity','-Infinity')
    OR x NOT BETWEEN -180 AND 180 OR y NOT BETWEEN -90 AND 90 THEN
    RETURN jsonb_build_object('status','invalid_request'); END IF;
  IF (SELECT count(*) FROM agency_private.county_geometry_catalog)<>254 THEN
    RETURN jsonb_build_object('status','maintenance'); END IF;
  -- Any exact catalog boundary, even where source polygons slightly overlap,
  -- is manual-correction territory. No buffer or nearest-county fallback.
  IF EXISTS (SELECT 1 FROM agency_private.county_geometry_catalog
    WHERE public.ST_Touches(geometry,p_point)) THEN RETURN jsonb_build_object('status','out_of_scope'); END IF;
  SELECT count(*),min(county_fips) INTO matching_count,resolved_fips
    FROM agency_private.county_geometry_catalog WHERE public.ST_Contains(geometry,p_point);
  IF matching_count<>1 THEN RETURN jsonb_build_object('status','out_of_scope'); END IF;
  IF p_client_fips IS NOT NULL AND p_client_fips<>resolved_fips THEN
    RETURN jsonb_build_object('status','out_of_scope'); END IF;
  v_now:=clock_timestamp();
  SELECT * INTO authority FROM agency_private.organization_authorities
    WHERE organization_id=p_organization AND county_fips=resolved_fips AND status='approved'
      AND revoked_at IS NULL AND effective_from<=v_now
      AND (effective_until IS NULL OR effective_until>v_now);
  IF NOT FOUND THEN RETURN jsonb_build_object('status','out_of_scope'); END IF;
  IF p_client_authority_id IS NOT NULL AND p_client_authority_id<>authority.id THEN
    RETURN jsonb_build_object('status','out_of_scope'); END IF;
  IF p_client_version IS NOT NULL AND p_client_version<>authority.authority_version THEN
    RETURN jsonb_build_object('status','out_of_scope'); END IF;
  IF NOT public.ST_Contains(authority.geometry,p_point) THEN
    RETURN jsonb_build_object('status','out_of_scope'); END IF;
  RETURN jsonb_build_object('status','accepted','county_fips',resolved_fips,
    'authority_id',authority.id,'authority_version',authority.authority_version);
END $$;

REVOKE ALL ON FUNCTION agency_private.phase3_create_county_authority(uuid,uuid,character,integer,timestamptz,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION agency_private.phase3_authorize_point(uuid,uuid,public.geometry,text,uuid,integer) FROM PUBLIC;
COMMIT;
