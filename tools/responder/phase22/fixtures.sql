-- LOCAL DISPOSABLE PROTOTYPE ONLY
-- NOT A PRODUCTION MIGRATION
-- Synthetic Phase 22 actors, sessions, and command-test state only.

BEGIN;

INSERT INTO dispatch_phase21_local.profiles(user_id,display_name,status) VALUES
  ('10000000-0000-4000-8000-000000000011','Synthetic Second Platform Approver','ACTIVE'),
  ('10000000-0000-4000-8000-000000000012','Synthetic Invitee One','ACTIVE'),
  ('10000000-0000-4000-8000-000000000013','Synthetic Supervisor','ACTIVE'),
  ('10000000-0000-4000-8000-000000000014','Synthetic Invitee Two','ACTIVE');

INSERT INTO dispatch_phase21_local.organization_memberships
  (id,organization_id,user_id,status,role_template,activated_at) VALUES
  ('30000000-0000-4000-8000-000000000013','20000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000013','ACTIVE','SUPERVISOR',statement_timestamp());

INSERT INTO dispatch_phase21_local.platform_admin_grants
  (user_id,permission_key,active,granted_by_user_id)
SELECT '10000000-0000-4000-8000-000000000011',permission_key,true,
  '10000000-0000-4000-8000-000000000009'
FROM dispatch_phase21_local.permissions WHERE scope_class='PLATFORM';

UPDATE dispatch_phase21_local.ownership_transfers
SET status='CANCELLED',cancelled_at=statement_timestamp()
WHERE id='90000000-0000-4000-8000-000000000001' AND status='PENDING';

INSERT INTO dispatch_phase22_local.synthetic_sessions
  (session_id,auth_user_id,aal_level,totp_verified,issued_at,mfa_verified_at,expires_at) VALUES
  ('a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000010','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000007','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000008','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000009','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000011','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000013','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000012','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000014','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000003','aal1',false,now()-interval '5 minutes',NULL,now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000003','aal2',true,now()-interval '2 hours',now()-interval '1 hour',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000003','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000005','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour'),
  ('a0000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000006','aal2',true,now()-interval '5 minutes',now()-interval '2 minutes',now()+interval '1 hour');

COMMIT;
