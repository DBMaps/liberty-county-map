-- LOCAL DISPOSABLE PROTOTYPE ONLY
-- NOT A PRODUCTION MIGRATION
-- Synthetic identities and organizations only.

BEGIN;

INSERT INTO dispatch_phase21_local.profiles(user_id,display_name,status) VALUES
  ('10000000-0000-4000-8000-000000000001','Synthetic Multi-Org User','ACTIVE'),
  ('10000000-0000-4000-8000-000000000002','Synthetic Viewer','ACTIVE'),
  ('10000000-0000-4000-8000-000000000003','Synthetic Operator','ACTIVE'),
  ('10000000-0000-4000-8000-000000000004','Synthetic Utility Owner','ACTIVE'),
  ('10000000-0000-4000-8000-000000000005','Synthetic School Owner','ACTIVE'),
  ('10000000-0000-4000-8000-000000000006','Synthetic Fleet Owner','ACTIVE'),
  ('10000000-0000-4000-8000-000000000007','Synthetic Suspended Member','ACTIVE'),
  ('10000000-0000-4000-8000-000000000008','Synthetic Revoked Member','ACTIVE'),
  ('10000000-0000-4000-8000-000000000009','Synthetic Platform Admin','ACTIVE'),
  ('10000000-0000-4000-8000-000000000010','Synthetic Organization Admin','ACTIVE');

INSERT INTO dispatch_phase21_local.organizations
  (id,display_name,legal_name,organization_type,status,verification_level) VALUES
  ('20000000-0000-4000-8000-000000000001','Synthetic Municipal Public Works','Synthetic Municipal Public Works','MUNICIPALITY','ACTIVE','VERIFIED_PUBLIC_ENTITY'),
  ('20000000-0000-4000-8000-000000000002','Synthetic Electric Utility','Synthetic Electric Utility LLC','UTILITY','ACTIVE','VERIFIED_ORGANIZATION'),
  ('20000000-0000-4000-8000-000000000003','Synthetic School District','Synthetic Independent School District','SCHOOL_DISTRICT','SUSPENDED','VERIFIED_PUBLIC_ENTITY'),
  ('20000000-0000-4000-8000-000000000004','Synthetic Fleet Company','Synthetic Fleet Company LLC','FLEET','CLOSED','VERIFIED_ORGANIZATION');

INSERT INTO dispatch_phase21_local.organization_memberships
  (id,organization_id,user_id,status,role_template,activated_at,suspended_at,revoked_at) VALUES
  ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','ACTIVE','OWNER',now(),NULL,NULL),
  ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','ACTIVE','OPERATOR',now(),NULL,NULL),
  ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','ACTIVE','VIEWER',now(),NULL,NULL),
  ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','ACTIVE','OPERATOR',now(),NULL,NULL),
  ('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','ACTIVE','OWNER',now(),NULL,NULL),
  ('30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000005','ACTIVE','OWNER',now(),NULL,NULL),
  ('30000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000006','ACTIVE','OWNER',now(),NULL,NULL),
  ('30000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000007','SUSPENDED','OPERATOR',now(),now(),NULL),
  ('30000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000008','REVOKED','VIEWER',now(),NULL,now()),
  ('30000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','ACTIVE','ORGANIZATION_ADMIN',now(),NULL,NULL);

INSERT INTO dispatch_phase21_local.organization_invitations
  (id,organization_id,email_or_identity_target,role_template,token_digest,status,expires_at,created_by_membership_id)
VALUES ('35000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  'synthetic-invite@example.invalid','VIEWER',decode(repeat('ab',32),'hex'),'PENDING',
  now()+interval '7 days','30000000-0000-4000-8000-000000000010');

INSERT INTO dispatch_phase21_local.operational_scopes
  (id,organization_id,scope_type,status,label,definition,source_reference,source_version,valid_from,valid_until) VALUES
  ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','COUNTY','ACTIVE','Synthetic County 48001','{"county_fips":"48001"}','synthetic-county-catalog','phase21.synthetic.v1',now()-interval '1 day',NULL),
  ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','SERVICE_TERRITORY','ACTIVE','Synthetic Utility Territory','{"geometry_ref":"synthetic-territory-1"}','synthetic-territory-catalog','phase21.synthetic.v1',now()-interval '1 day',NULL),
  ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','FACILITY','ACTIVE','Synthetic School Campus','{"facility_id":"synthetic-school-1"}','synthetic-facility-catalog','phase21.synthetic.v1',now()-interval '1 day',NULL),
  ('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000004','ROUTE','ACTIVE','Synthetic Fleet Route','{"route_id":"synthetic-route-1"}','synthetic-route-catalog','phase21.synthetic.v1',now()-interval '1 day',NULL),
  ('40000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','NON_GEOGRAPHIC','ACTIVE','Synthetic Administrative Scope','{}','synthetic-non-geographic','phase21.synthetic.v1',now()-interval '1 day',NULL),
  ('40000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000002','ROUTE','ACTIVE','Synthetic Utility Route','{"route_id":"synthetic-utility-route"}','synthetic-route-catalog','phase21.synthetic.v1',now()-interval '1 day',NULL);

INSERT INTO dispatch_phase21_local.platform_admin_grants
  (user_id,permission_key,active,granted_by_user_id)
SELECT '10000000-0000-4000-8000-000000000009',permission_key,true,
  '10000000-0000-4000-8000-000000000009'
FROM dispatch_phase21_local.permissions WHERE scope_class='PLATFORM';

INSERT INTO dispatch_phase21_local.capability_grants
  (id,organization_id,capability_key,operational_scope_id,status,required_verification,
   valid_from,valid_until,granted_by_platform_actor,governance_reference) VALUES
  ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','awareness.condition.publish','40000000-0000-4000-8000-000000000001','ACTIVE','VERIFIED_PUBLIC_ENTITY',now()-interval '1 day',now()+interval '30 days','10000000-0000-4000-8000-000000000009','synthetic-governance-case-1'),
  ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','awareness.hazard.publish','40000000-0000-4000-8000-000000000002','ACTIVE','VERIFIED_ORGANIZATION',now()-interval '1 day',now()+interval '30 days','10000000-0000-4000-8000-000000000009','synthetic-governance-case-2'),
  ('50000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','awareness.official_notice.publish','40000000-0000-4000-8000-000000000001','ACTIVE','VERIFIED_PUBLIC_ENTITY',now()-interval '30 days',now()-interval '1 day','10000000-0000-4000-8000-000000000009','synthetic-expired-case'),
  ('50000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002','awareness.condition.publish','40000000-0000-4000-8000-000000000006','ACTIVE','VERIFIED_ORGANIZATION',now()-interval '1 day',now()+interval '30 days','10000000-0000-4000-8000-000000000009','synthetic-route-case');

SET CONSTRAINTS ALL DEFERRED;
INSERT INTO dispatch_phase21_local.operational_records
  (id,organization_id,record_type,status,priority,title,description,operational_scope_id,location,
   created_by_membership_id,current_revision) VALUES
  ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','CONDITION','OPEN','HIGH','Synthetic roadway condition','Synthetic private operational detail','40000000-0000-4000-8000-000000000001','{"longitude":-95.1,"latitude":30.1}','30000000-0000-4000-8000-000000000004',0),
  ('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','HAZARD','OPEN','NORMAL','Synthetic utility hazard','Synthetic utility private detail','40000000-0000-4000-8000-000000000002','{"asset_ref":"synthetic-transformer"}','30000000-0000-4000-8000-000000000002',0);

INSERT INTO dispatch_phase21_local.record_revisions
  (id,organization_id,record_id,revision_number,actor_membership_id,payload_snapshot) VALUES
  ('61000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',0,'30000000-0000-4000-8000-000000000004','{"record_type":"CONDITION","status":"OPEN","title":"Synthetic roadway condition"}'),
  ('61000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002',0,'30000000-0000-4000-8000-000000000002','{"record_type":"HAZARD","status":"OPEN","title":"Synthetic utility hazard"}');

INSERT INTO dispatch_phase21_local.record_assignments
  (id,organization_id,record_id,assigned_membership_id,assigned_by_membership_id) VALUES
  ('62000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000010');

INSERT INTO dispatch_phase21_local.record_provenance
  (id,organization_id,record_id,revision_number,author_user_id,membership_id,source_class,
   verification_level,capability_grant_id,operational_scope_id,visibility,review_state) VALUES
  ('63000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',0,'10000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004','ORGANIZATION','VERIFIED_PUBLIC_ENTITY','50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','PROJECTION_CANDIDATE','APPROVED'),
  ('63000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002',0,'10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','PRIVATE_OPERATIONAL','VERIFIED_ORGANIZATION',NULL,'40000000-0000-4000-8000-000000000002','PRIVATE','NOT_SUBMITTED');

INSERT INTO dispatch_phase21_local.projection_candidates
  (id,source_record_id,organization_id,source_revision,capability_grant_id,status,
   requested_by_membership_id,reviewed_by_membership_id,reviewed_at,sanitized_payload,
   consumer_taxonomy,freshness_deadline) VALUES
  ('70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',0,'50000000-0000-4000-8000-000000000001','APPROVED','30000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000010',now(),'{"title":"Road condition","summary":"Use caution","public_location":{"longitude":-95.1,"latitude":30.1}}','condition',now()+interval '12 hours'),
  ('70000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',0,'50000000-0000-4000-8000-000000000002','SUBMITTED','30000000-0000-4000-8000-000000000002',NULL,NULL,'{"title":"Utility hazard","summary":"Pending review"}','hazard',now()+interval '12 hours');

INSERT INTO dispatch_phase21_local.public_safe_projections
  (id,candidate_id,organization_public_name,source_label,consumer_taxonomy,title,summary,
   public_location,expires_at) VALUES
  ('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
   'Synthetic Municipal Public Works','Organization update','condition','Road condition','Use caution',
   '{"longitude":-95.1,"latitude":30.1}',now()+interval '12 hours');

INSERT INTO dispatch_phase21_local.dispatch_audit_events
  (organization_id,actor_user_id,actor_membership_id,event_type,target_type,target_id,event_payload,operation_correlation_id) VALUES
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004','RECORD_CREATED','operational_record','60000000-0000-4000-8000-000000000001','{"revision":0}','80000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','30000000-0000-4000-8000-000000000010','PROJECTION_APPROVED','projection_candidate','70000000-0000-4000-8000-000000000001','{"source_revision":0}','80000000-0000-4000-8000-000000000002');

INSERT INTO dispatch_phase21_local.ownership_transfers
  (id,organization_id,from_membership_id,to_membership_id,initiated_by_user_id,reason,expires_at) VALUES
  ('90000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','Synthetic accepted-transfer test',now()+interval '1 day');

COMMIT;
