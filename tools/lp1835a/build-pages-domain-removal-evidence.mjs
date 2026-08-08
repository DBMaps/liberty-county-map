import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REPORT_DIR = 'reports/lp1835a';
export const NAMES = [
  'pages-custom-domain-removal-control.json',
  'first-deployment-rollback-closure.json',
  'lp1835a-summary.json'
];
const VERIFIED_ON = '2026-08-08';
const GENERATED_AT = '2026-08-08T00:00:00.000Z';
const DOMAIN_DELETE_ENDPOINT = '/accounts/{account_id}/pages/projects/{project_name}/domains/{domain_name}';
const PROJECT_DELETE_ENDPOINT = '/accounts/{account_id}/pages/projects/{project_name}';
const AUTHORIZATIONS = Object.fromEntries(
  ['deployment', 'distribution', 'activation', 'publicLaunch', 'restore', 'rollback', 'automaticDeployment']
    .map(key => [key, 'NOT_AUTHORIZED'])
);
const SECRET = /(?:api[_-]?key|cookie|bearer\s+\S+|(?:access|refresh|session)[_-]?token|-----BEGIN [A-Z ]*PRIVATE KEY-----|password\s*[:=]|github[_-]?token|supabase[_-]?(?:key|secret))/i;
const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
export const encode = value => `${JSON.stringify(stable(value), null, 2)}\n`;

const provenance = (title, url, capability) => ({
  provider: 'Cloudflare',
  sourceType: 'OFFICIAL_PROVIDER_DOCUMENTATION',
  title,
  url,
  verifiedOn: VERIFIED_ON,
  capability,
  executionOccurred: false
});

export function build() {
  const dashboardSteps = [
    'Open the DNS Records page for gridlygo.com.',
    'Locate the Pages-associated CNAME record for preview.gridlygo.com.',
    'Select Edit, then select Delete to remove the preview-specific DNS record.',
    'Open Workers & Pages, select gridly-preview, then open Custom domains.',
    'Open the three-dot menu for preview.gridlygo.com and select Remove domain.'
  ];
  const domainControl = {
    schemaVersion: 'gridly.lp1835a.pagesCustomDomainRemovalControl.v1',
    milestone: 'LP183.5A',
    generatedAt: GENERATED_AT,
    classification: 'PAGES_CUSTOM_DOMAIN_REMOVAL_CONTROL_EVIDENCE_CLOSED',
    evidenceClass: 'AUTHORITATIVE_PLATFORM_DOCUMENTED_CONTROL',
    status: 'PROVEN_BY_AUTHORITATIVE_PLATFORM_DOCUMENTATION',
    dashboardControl: { procedure: dashboardSteps, executionOccurred: false },
    apiControl: {
      method: 'DELETE',
      endpoint: DOMAIN_DELETE_ENDPOINT,
      purpose: "Delete a Pages project's domain.",
      requiredPermission: 'Pages Write',
      targetIfSeparatelyAuthorized: {
        account: 'VERIFIED_GRIDLY_CLOUDFLARE_ACCOUNT',
        project: 'gridly-preview',
        domain: 'preview.gridlygo.com'
      },
      executionOccurred: false
    },
    domainApiFamily: ['GET domains', 'GET domain', 'POST domain', 'PATCH domain', 'DELETE domain'],
    provenance: [
      provenance('Custom domains · Cloudflare Pages docs', 'https://developers.cloudflare.com/pages/configuration/custom-domains/', 'Dashboard removal requires deleting the Pages CNAME and selecting Remove domain in the Pages custom-domain menu.'),
      provenance('Delete a Pages project domain · Cloudflare API', 'https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/domains/methods/delete/', `DELETE ${DOMAIN_DELETE_ENDPOINT} with Pages Write permission.`),
      provenance('Pages project domains · Cloudflare API', 'https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/domains/', 'Pages project domain API family includes get, add, patch, and delete controls.')
    ],
    ownerExecutedRemoveTest: false,
    liveRollbackExecuted: false,
    secretMaterialStored: false
  };
  const rollback = {
    schemaVersion: 'gridly.lp1835a.firstDeploymentRollbackClosure.v1',
    milestone: 'LP183.5A',
    generatedAt: GENERATED_AT,
    readiness: 'ROLLBACK_CONTROLS_EVIDENCE_COMPLETE_EXECUTION_NOT_AUTHORIZED',
    preferredRollback: 'REMOVE_PREVIEW_SPECIFIC_DNS_AND_CUSTOM_DOMAIN_PUBLICATION',
    sequence: [
      'Locate the preview.gridlygo.com Pages-associated DNS record.',
      'Delete or remove that preview-specific DNS record.',
      'Open Workers & Pages -> gridly-preview -> Custom domains.',
      'Use the custom-domain menu for preview.gridlygo.com.',
      `Select Remove domain; or, only with separate API authorization, call DELETE ${DOMAIN_DELETE_ENDPOINT} for the verified Gridly account, gridly-preview, and preview.gridlygo.com.`,
      'Verify preview.gridlygo.com no longer serves the Gridly candidate.',
      'Verify gridlygo.com production remains unaffected.',
      'Verify beta-closed surfaces remain unaffected.'
    ],
    controls: {
      dnsDelete: { status: 'PROVEN', evidenceClass: 'OWNER_OBSERVED_AUTHENTICATED_DASHBOARD_CONTROL', executedInLp1835a: false },
      pagesCustomDomainRemove: { status: 'PROVEN_BY_AUTHORITATIVE_PLATFORM_DOCUMENTATION', evidenceClass: 'AUTHORITATIVE_PLATFORM_DOCUMENTED_CONTROL', executedInLp1835a: false },
      projectDeleteFallback: {
        status: 'PROVEN_BY_AUTHORITATIVE_PLATFORM_DOCUMENTATION',
        role: 'LAST_RESORT_NOT_PREFERRED',
        method: 'DELETE',
        endpoint: PROJECT_DELETE_ENDPOINT,
        separatelyAuthorizationGated: true,
        executionOccurred: false,
        provenance: provenance('Delete a Pages project · Cloudflare API', 'https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/delete/', `DELETE ${PROJECT_DELETE_ENDPOINT}; associated custom-domain CNAME removal is required before project deletion.`)
      }
    },
    rollbackAuthorization: 'NOT_AUTHORIZED',
    rollbackExecuted: false
  };
  const summary = {
    schemaVersion: 'gridly.lp1835a.summary.v1',
    milestone: 'LP183.5A',
    generatedAt: GENERATED_AT,
    classification: 'PAGES_CUSTOM_DOMAIN_REMOVAL_CONTROL_EVIDENCE_CLOSED',
    evidenceOnly: true,
    destructiveControlExecuted: false,
    project: { name: 'gridly-preview', exists: true, productionBranch: 'preview', defaultHostname: 'gridly-preview.pages.dev', gitIntegration: false },
    deploymentCount: 0,
    customDomainCount: 0,
    previewGridlygoComBound: false,
    artifactUploaded: false,
    dnsChanged: false,
    accessChanged: false,
    automaticDeployment: false,
    dnsDeleteEvidenceStatus: 'PROVEN_OWNER_OBSERVED_AUTHENTICATED_DASHBOARD_CONTROL',
    pagesDomainRemoveEvidenceStatus: 'PROVEN_BY_AUTHORITATIVE_PLATFORM_DOCUMENTATION',
    projectDeletionFallbackEvidenceStatus: 'PROVEN_BY_AUTHORITATIVE_PLATFORM_DOCUMENTATION_SEPARATELY_AUTHORIZATION_GATED',
    firstDeploymentRollbackReadiness: rollback.readiness,
    deploymentConsequence: 'SEPARATE_DEPLOYMENT_AUTHORIZATION_REASSESSMENT_REQUIRED',
    globalAuthorizationState: AUTHORIZATIONS,
    protectedRuntimeNativeDiff: 'EMPTY',
    secretSafety: 'PASS_NO_SECRET_MATERIAL_STORED'
  };
  const reports = Object.fromEntries(NAMES.map((name, index) => [name, [domainControl, rollback, summary][index]]));
  if (SECRET.test(JSON.stringify(reports))) throw new Error('LP183.5A output contains secret-shaped material');
  return reports;
}

export function write(out = path.join(ROOT, REPORT_DIR)) {
  const reports = build();
  fs.mkdirSync(out, { recursive: true });
  for (const name of NAMES) fs.writeFileSync(path.join(out, name), encode(reports[name]));
  return reports;
}

export function verify(root = ROOT) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp1835a-'));
  try {
    write(path.join(tmp, 'a'));
    write(path.join(tmp, 'b'));
    for (const name of NAMES) {
      const a = fs.readFileSync(path.join(tmp, 'a', name));
      const b = fs.readFileSync(path.join(tmp, 'b', name));
      const committed = fs.readFileSync(path.join(root, REPORT_DIR, name));
      if (!a.equals(b) || !a.equals(committed) || a[0] === 0xef || a.includes(13)) throw new Error(`LP183.5A report drift: ${name}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? 'build';
  if (mode === 'build') write();
  else if (mode === 'verify') verify();
  else throw new Error(`Unknown mode: ${mode}`);
  console.log(`LP183.5A ${mode} PASS`);
}
