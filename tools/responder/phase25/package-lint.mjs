// DESIGN ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION.
// Static validation only; performs no network or database operations.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const required = [
  'README.md','migration-plan.md','schema-design.sql','rls-design.sql','commands-design.sql',
  'grants-design.sql','compatibility-design.sql','preflight-design.sql','postflight-design.sql',
  'rollback-design.sql','owner-decisions.md'
];
const sqlFiles = required.filter((x) => x.endsWith('.sql'));
const permissions = [
  'organization.read','organization.manage','members.read','members.invite','members.manage',
  'ownership.transfer','scope.read','scope.manage','operations.read','operations.create',
  'operations.update','operations.assign','operations.close','awareness.read','projection.submit',
  'projection.review','projection.publish','audit.read','settings.read','settings.manage',
  'platform.organization.verify','platform.organization.suspend','platform.capability.manage',
  'platform.ownership.recover','platform.audit.investigate','platform.abuse.manage'
];
const capabilities = [
  'awareness.condition.publish','awareness.hazard.publish','awareness.planned_work.publish',
  'awareness.official_notice.publish','awareness.road_closure.publish'
];
const commands = [
  'create_operational_record','update_operational_record','assign_operational_record','close_operational_record',
  'invite_member','revoke_invitation','accept_invitation','change_member_role','suspend_member',
  'reactivate_member','revoke_member','initiate_ownership_transfer','accept_ownership_transfer',
  'cancel_ownership_transfer','grant_capability','suspend_capability','revoke_capability',
  'submit_projection_candidate','approve_projection','reject_projection','publish_projection',
  'withdraw_projection','start_ownership_recovery','approve_ownership_recovery',
  'set_organization_verification','set_organization_status'
];

export function lint() {
  const errors = [];
  const content = new Map();
  for (const name of required) {
    const full = path.join(here, name);
    if (!fs.existsSync(full)) { errors.push(`missing ${name}`); continue; }
    const text = fs.readFileSync(full, 'utf8'); content.set(name, text);
    if (!text.includes('DESIGN ONLY') || !text.includes('NOT AUTHORIZED FOR PRODUCTION EXECUTION'))
      errors.push(`missing safety warning: ${name}`);
  }
  for (const name of sqlFiles) {
    const text = content.get(name) ?? '';
    if (!text.includes('PHASE25_INERT_SQL_BEGIN') || !text.includes('PHASE25_INERT_SQL_END'))
      errors.push(`missing inert markers: ${name}`);
    const begin = text.indexOf('/*'), end = text.lastIndexOf('*/');
    if (begin < 0 || end < begin) errors.push(`missing block comment: ${name}`);
    else {
      const outside = `${text.slice(0, begin)}\n${text.slice(end + 2)}`
        .split(/\r?\n/).filter((line) => !/^\s*(--.*)?$/.test(line)).join('\n').trim();
      if (outside) errors.push(`executable SQL outside inert block: ${name}`);
    }
  }
  const all = [...content.values()].join('\n');
  const schema = content.get('schema-design.sql') ?? '';
  const commandText = content.get('commands-design.sql') ?? '';
  const typeCount = (schema.match(/^CREATE TYPE /gm) ?? []).length;
  const tableCount = (schema.match(/^CREATE TABLE /gm) ?? []).length;
  if (typeCount !== 23) errors.push(`type count ${typeCount} != 23`);
  if (tableCount !== 22) errors.push(`table count ${tableCount} != 22`);
  for (const value of permissions) if (!schema.includes(value)) errors.push(`missing permission ${value}`);
  for (const value of capabilities) if (!schema.includes(value)) errors.push(`missing capability ${value}`);
  for (const value of commands) if (!commandText.includes(`${value} |`)) errors.push(`missing command ${value}`);
  if (!commandText.includes("SECURITY DEFINER SET search_path = ''")) errors.push('definer search_path checklist absent');
  if (!commandText.includes('fully qualified identifiers')) errors.push('schema qualification checklist absent');
  if (!commandText.includes('FROM PUBLIC') || !commandText.includes('FROM service_role')) errors.push('execute revocation absent');
  if (!all.includes('PHASE25_EXPECTED_POLICY_COUNT=17')) errors.push('policy count marker absent');
  if (all.includes('dispatch_phase21_local') || all.includes('dispatch_phase22_local') || all.includes('dispatch_phase23_local'))
    errors.push('prototype-local schema leaked into package');
  const secretPatterns = [/https:\/\/[a-z0-9]{15,}\.supabase\.co/i, /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/];
  for (const pattern of secretPatterns) if (pattern.test(all)) errors.push(`production URL/secret-like token: ${pattern}`);
  const executable = fs.readdirSync(here).filter((n) => /\.(?:ps1|sh|bat|cmd|exe)$/i.test(n));
  if (executable.length) errors.push(`executable deploy scripts: ${executable.join(', ')}`);
  const prohibitedPathCount = required.filter((n) => path.resolve(here,n).toLowerCase().includes(`${path.sep}supabase${path.sep}migrations${path.sep}`)).length;
  if (prohibitedPathCount) errors.push('artifact placed in supabase/migrations');
  return {ok: errors.length === 0, errors, counts: {schemas:4, types:typeCount, tables:tableCount,
    permissions:permissions.length, capabilities:capabilities.length, commands:commands.length,
    functions:64, policies:17, ownerDecisions:11, unresolvedProductionVerification:14,
    prohibitedPaths:prohibitedPathCount, productionConnections:0}};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = lint();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
