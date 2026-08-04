const { createHash } = require('node:crypto');

const STATES = [
  'DRAFT', 'EVIDENCE_COMPLETE', 'APPROVED_FOR_PACKAGE_GENERATION',
  'APPROVED_FOR_DEPLOYMENT', 'APPROVED_FOR_RUNTIME_ACTIVATION', 'REVOKED'
];
const TEXAS_FIPS = /^48\d{3}$/;
const PERMISSIONS = ['prepareGeometry', 'generateRuntimePackage', 'deploy', 'activateRuntime', 'storageUpload'];

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function membershipSha256(members) {
  return createHash('sha256').update(canonicalJson(members)).digest('hex');
}
function fail(message) { throw new Error(`LP138 membership contract: ${message}`); }

function validateMembershipContract(contract, { registryMembers, packageMembers, expectedContractKind } = {}) {
  if (contract.schemaVersion !== '1.0.0') fail('unsupported schemaVersion');
  if (contract.contractVersion !== '1.0.0') fail('unsupported contractVersion');
  if (!['CURRENT_OPERATIONAL_BASELINE', 'FUTURE_APPROVAL_DRAFT'].includes(contract.contractKind)) fail('unknown contractKind');
  if (expectedContractKind && contract.contractKind !== expectedContractKind) fail(`contract is not ${expectedContractKind}`);
  if (!STATES.includes(contract.approval?.status)) fail('unknown approval status');
  const members = contract.approvedCounties;
  if (!Array.isArray(members)) fail('approvedCounties must be an array');
  if (contract.approvedCountyCount !== members.length) fail('declared count differs from exact set length');
  if (contract.existingBaselineCountyCount + contract.newlyApprovedCountyCount !== members.length) fail('baseline/new approval counts do not reconcile');
  if (contract.contractKind === 'CURRENT_OPERATIONAL_BASELINE' && contract.newlyApprovedCountyCount !== 0) fail('baseline cannot claim newly approved counties');
  if (contract.contractKind === 'FUTURE_APPROVAL_DRAFT' && contract.existingBaselineCountyCount !== 0) fail('future draft cannot claim baseline membership');
  let priorFips = '';
  const ids = new Set(); const fipsCodes = new Set();
  for (const member of members) {
    if (!member.countyId || !member.displayName || !TEXAS_FIPS.test(member.fips)) fail('unknown or malformed county identity');
    if (ids.has(member.countyId) || fipsCodes.has(member.fips)) fail('duplicate county identity');
    if (member.fips <= priorFips) fail('members must be strictly ordered by ascending FIPS');
    ids.add(member.countyId); fipsCodes.add(member.fips); priorFips = member.fips;
    if (!member.identityEvidenceRef) fail(`missing identity evidence for ${member.countyId}`);
    if (!Array.isArray(member.gates) || member.gates.length !== 7) fail(`incomplete gate evidence for ${member.countyId}`);
    member.gates.forEach((gate, index) => {
      if (gate.gate !== index + 1 || !['PASS', 'BLOCKED', 'NOT_EVALUATED'].includes(gate.status) || !gate.evidenceRef) fail(`invalid sequential Gate ${index + 1} evidence for ${member.countyId}`);
    });
  }
  if (contract.provenance?.membershipSha256 !== membershipSha256(members)) fail('membership provenance hash mismatch');
  const permissions = contract.permissions || {};
  if (PERMISSIONS.some(name => typeof permissions[name]?.authorized !== 'boolean' || !permissions[name]?.authorityRef)) fail('each separate permission requires authorized and authorityRef');
  if (permissions.generateRuntimePackage.authorized && contract.approval.status !== 'APPROVED_FOR_PACKAGE_GENERATION') fail('package generation lacks exact approval state');
  if (permissions.deploy.authorized && contract.approval.status !== 'APPROVED_FOR_DEPLOYMENT') fail('deployment lacks exact approval state');
  if (permissions.activateRuntime.authorized) {
    if (contract.approval.status !== 'APPROVED_FOR_RUNTIME_ACTIVATION') fail('runtime activation lacks exact approval state');
    if (members.some(member => member.gates.some(gate => gate.status !== 'PASS'))) fail('runtime activation requires Gates 1–7 PASS for every county');
  }
  for (const [label, actual] of [['registry', registryMembers], ['package', packageMembers]]) {
    if (actual === undefined) continue;
    const normalized = actual.map(({ countyId, fips }) => ({ countyId, fips })).sort((a, b) => a.fips.localeCompare(b.fips));
    const approved = members.map(({ countyId, fips }) => ({ countyId, fips }));
    if (canonicalJson(normalized) !== canonicalJson(approved)) fail(`${label} membership does not equal approved membership`);
  }
  return true;
}

module.exports = { STATES, canonicalJson, membershipSha256, validateMembershipContract };
