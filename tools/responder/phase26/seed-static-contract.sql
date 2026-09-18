\set ON_ERROR_STOP on
-- LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
INSERT INTO dispatch_private.role_templates(role_key,description) VALUES
 ('OWNER','Accountable controller'),('ORGANIZATION_ADMIN','Organization administrator'),
 ('SUPERVISOR','Operational reviewer'),('OPERATOR','Operational operator'),('VIEWER','Bounded viewer')
ON CONFLICT DO NOTHING;
INSERT INTO dispatch_private.permissions(permission_key,scope_class) VALUES
 ('organization.read','ORGANIZATION'),('organization.manage','ORGANIZATION'),('members.read','ORGANIZATION'),('members.invite','ORGANIZATION'),('members.manage','ORGANIZATION'),('ownership.transfer','ORGANIZATION'),('scope.read','ORGANIZATION'),('scope.manage','ORGANIZATION'),('operations.read','ORGANIZATION'),('operations.create','ORGANIZATION'),('operations.update','ORGANIZATION'),('operations.assign','ORGANIZATION'),('operations.close','ORGANIZATION'),('awareness.read','ORGANIZATION'),('projection.submit','ORGANIZATION'),('projection.review','ORGANIZATION'),('projection.publish','ORGANIZATION'),('audit.read','ORGANIZATION'),('settings.read','ORGANIZATION'),('settings.manage','ORGANIZATION'),('platform.organization.verify','PLATFORM'),('platform.organization.suspend','PLATFORM'),('platform.capability.manage','PLATFORM'),('platform.ownership.recover','PLATFORM'),('platform.audit.investigate','PLATFORM'),('platform.abuse.manage','PLATFORM')
ON CONFLICT DO NOTHING;
INSERT INTO dispatch_private.role_permissions(role_key,permission_key)
 SELECT 'OWNER',permission_key FROM dispatch_private.permissions WHERE scope_class='ORGANIZATION' ON CONFLICT DO NOTHING;
INSERT INTO dispatch_private.role_permissions(role_key,permission_key)
 SELECT 'ORGANIZATION_ADMIN',permission_key FROM dispatch_private.permissions WHERE scope_class='ORGANIZATION' AND permission_key<>'ownership.transfer' ON CONFLICT DO NOTHING;
INSERT INTO dispatch_private.role_permissions VALUES
 ('SUPERVISOR','organization.read'),('SUPERVISOR','members.read'),('SUPERVISOR','scope.read'),('SUPERVISOR','operations.read'),('SUPERVISOR','operations.create'),('SUPERVISOR','operations.update'),('SUPERVISOR','operations.assign'),('SUPERVISOR','operations.close'),('SUPERVISOR','projection.submit'),('SUPERVISOR','projection.review'),('SUPERVISOR','projection.publish'),('SUPERVISOR','audit.read'),('OPERATOR','organization.read'),('OPERATOR','scope.read'),('OPERATOR','operations.read'),('OPERATOR','operations.create'),('OPERATOR','operations.update'),('OPERATOR','projection.submit'),('VIEWER','organization.read'),('VIEWER','scope.read'),('VIEWER','operations.read')
ON CONFLICT DO NOTHING;
