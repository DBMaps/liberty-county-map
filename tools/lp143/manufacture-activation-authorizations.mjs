import { readFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const AUTHORIZATION_SCHEMA = 'gridly-lp143-county-activation-authorization-v1';
export const REGISTRY_SCHEMA = 'gridly-lp143-statewide-activation-authorization-registry-v1';
export const CONTRACT_SCHEMA = 'gridly-lp143-activation-authorization-transition-contract-v1';

const gateNames = Object.freeze([
  'Package integrity', 'Certification complete', 'Community readiness', 'Destination readiness',
  'Crossing readiness', 'Runtime validation', 'Production approval'
]);
const approvalFields = Object.freeze([
  'operationalApproval', 'deploymentApproval', 'runtimeApproval', 'geometryApproval', 'membershipApproval'
]);
const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;

export function manufactureActivationAuthorizations({ plan }) {
  const counties = plan.counties.filter(row => row.readinessClass === 'CONDITIONALLY_READY')
    .sort((a, b) => a.fips.localeCompare(b.fips));
  if (new Set(counties.map(row => row.fips)).size !== counties.length) throw new Error('Duplicate conditionally-ready county FIPS');

  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: AUTHORIZATION_SCHEMA,
    title: 'LP143 County Activation Authorization', type: 'object', additionalProperties: false,
    required: ['county', 'fips', 'authorizationId', 'authorizationVersion', 'lp132GateReferences', ...approvalFields,
      'authorizationStatus', 'authorizationTimestamp', 'authorizationAuthority', 'activationRecommendation'],
    properties: {
      county: { type: 'string', minLength: 1 }, fips: { type: 'string', pattern: '^48[0-9]{3}$' },
      authorizationId: { type: 'string', pattern: '^LP143-TX-48[0-9]{3}-V[1-9][0-9]*$' },
      authorizationVersion: { type: 'integer', const: 1 },
      lp132GateReferences: { type: 'array', minItems: 7, maxItems: 7, items: { type: 'object' } },
      operationalApproval: { type: ['object', 'null'], default: null }, deploymentApproval: { type: ['object', 'null'], default: null },
      runtimeApproval: { type: ['object', 'null'], default: null }, geometryApproval: { type: ['object', 'null'], default: null },
      membershipApproval: { type: ['object', 'null'], default: null },
      authorizationStatus: { type: 'string', enum: ['NOT_AUTHORIZED', 'ACTIVATION_AUTHORIZED'], default: 'NOT_AUTHORIZED' },
      authorizationTimestamp: { type: ['string', 'null'], format: 'date-time', default: null },
      authorizationAuthority: { type: ['string', 'null'], default: null }, activationRecommendation: { type: ['object', 'null'], default: null }
    }
  };
  const registry = {
    schemaVersion: REGISTRY_SCHEMA, version: 1,
    generatedFrom: 'evidence/lp140/activation-wave-planning.json', generatedAt: '2026-08-04T00:00:00.000Z',
    authorizationCount: 0, authorizations: []
  };
  const templates = counties.map(row => ({
    schemaVersion: AUTHORIZATION_SCHEMA, milestone: 'LP143', scope: 'GOVERNANCE_TEMPLATE_ONLY', authority: 'NON_AUTHORIZING',
    county: row.county, fips: row.fips, authorizationId: `LP143-TX-${row.fips}-V1`, authorizationVersion: 1,
    lp132GateReferences: gateNames.map((name, index) => ({ gate: index + 1, name, evidenceReference: `reports/lp141/county-${row.fips}.json#/lp132Gates/${index}` })),
    operationalApproval: null, deploymentApproval: null, runtimeApproval: null, geometryApproval: null, membershipApproval: null,
    authorizationStatus: 'NOT_AUTHORIZED', authorizationTimestamp: null, authorizationAuthority: null, activationRecommendation: null,
    governingEvidence: [`reports/lp141/county-${row.fips}.json`, 'LP132-TEXAS-STATEWIDE-ACTIVATION-ROADMAP.md', 'reports/lp143/activation-authorization-contract.json']
  }));
  const contract = {
    schemaVersion: CONTRACT_SCHEMA, milestone: 'LP143', scope: 'DESCRIPTIVE_GOVERNANCE_ONLY', authority: 'NON_AUTHORIZING',
    transition: { from: 'CONDITIONALLY_READY', to: 'ACTIVATION_AUTHORIZED' }, grantsAuthority: false,
    prerequisites: [
      { id: 'LP132_GOVERNANCE_SATISFIED', requirement: 'All seven LP132 gates have governed, affirmative evidence.' },
      { id: 'AUTHORIZATION_RECORD_EXISTS', requirement: 'A schema-valid county authorization record exists in the statewide registry.' },
      { id: 'REQUIRED_APPROVALS_PRESENT', requirement: 'Operational, deployment, runtime, geometry, and membership approvals are all present and governed.' },
      { id: 'RUNTIME_PREREQUISITES_SATISFIED', requirement: 'County-specific runtime validation and operational controls are satisfied.' },
      { id: 'DEPLOYMENT_PREREQUISITES_SATISFIED', requirement: 'Change, rollback, observation, ownership, and production controls are satisfied.' },
      { id: 'PLANNER_EVALUATION_COMPLETED', requirement: 'The non-authorizing planner has evaluated the valid authorization record.' }
    ],
    failClosedRule: 'Missing, null, invalid, inferred, or incomplete evidence never authorizes activation.',
    prohibitedEffects: ['AUTHORIZE_COUNTY', 'ACTIVATE_COUNTY', 'DEPLOY_RUNTIME', 'MODIFY_RUNTIME_GEOMETRY', 'MODIFY_MEMBERSHIP_CONTRACT']
  };
  return { schema, registry, templates, contract };
}

export async function writeActivationAuthorizations({ root, verify = false }) {
  const plan = JSON.parse(await readFile(new URL('evidence/lp140/activation-wave-planning.json', root)));
  const result = manufactureActivationAuthorizations({ plan });
  const output = new URL('reports/lp143/', root);
  const expected = new Map([
    ['activation-authorization.schema.json', stableJson(result.schema)],
    ['activation-authorizations.json', stableJson(result.registry)],
    ['activation-authorization-contract.json', stableJson(result.contract)],
    ...result.templates.map(row => [`templates/county-${row.fips}.json`, stableJson(row)])
  ]);
  if (verify) {
    const collect = async (url, prefix = '') => (await readdir(url, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => entry.isDirectory() ? [] : [`${prefix}${entry.name}`]);
    const names = [...await collect(output), ...(await collect(new URL('templates/', output), 'templates/'))].sort();
    if (JSON.stringify(names) !== JSON.stringify([...expected.keys()].sort())) throw new Error('LP143 output file set differs');
    for (const [name, contents] of expected) if (await readFile(new URL(name, output), 'utf8') !== contents) throw new Error(`LP143 output differs: ${name}`);
    return result;
  }
  await rm(output, { recursive: true, force: true });
  await mkdir(new URL('templates/', output), { recursive: true });
  for (const [name, contents] of expected) await writeFile(new URL(name, output), contents);
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await writeActivationAuthorizations({ root: new URL('../../', import.meta.url), verify: process.argv.includes('--verify') });
  console.log(`${process.argv.includes('--verify') ? 'Verified' : 'Wrote'} ${result.templates.length} LP143 authorization templates.`);
}
