import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REPORT_DIR = 'reports/lp180';
export const REPORT_NAMES = [
  'web-pwa-hosting-audit.json',
  'gridlygo-domain-readiness.json',
  'physical-device-validation-access-plan.json',
  'lp180-summary.json'
];
export const AUTHORIZATIONS = Object.freeze({
  deployment: 'NOT_AUTHORIZED', activation: 'NOT_AUTHORIZED', distribution: 'NOT_AUTHORIZED',
  publicLaunch: 'NOT_AUTHORIZED', restore: 'NOT_AUTHORIZED', rollback: 'NOT_AUTHORIZED'
});
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
const item = (classification, evidence, remainingAction, ownerDependency = false, platformDependency = false, repositoryDependency = false) => ({
  classification, evidence, remainingAction, ownerDependency, platformDependency, repositoryDependency
});

export function build() {
  const hosting = {
    schemaVersion: 'gridly.lp180.webPwaHostingAudit.v1', milestone: 'LP180', auditOnly: true,
    currentHost: item('NOT_CONFIGURED', 'No CNAME, Pages publication workflow, Pages source configuration, or Vercel/Netlify/Cloudflare/Firebase hosting configuration is present. The repository does not identify the external historical beta provider or URL.', 'Owner must identify the historical beta hostname/provider and confirm its platform mapping before any hosting action.', true, true),
    currentBetaUrlClassification: item('NOT_CONFIGURED', 'The URL itself is not stored in the repository. Every non-local, non-allowlisted hostname is treated as historical/closed.', 'Record the old beta hostname as owner evidence without reopening it.', true),
    betaClosureMechanism: item('READY', 'index.html gridlyHostnameGate executes at runtime before app paint. It lowercases location.hostname; localhost, 127.0.0.1, gridlygo.com, www.gridlygo.com, and preview.gridlygo.com may continue. Every other/unknown hostname redirects to ./beta-closed.html. Query strings are preserved except redirect-like parameters. beta-closed.html registers ./service-worker.js at ./ scope and removes recognized old Gridly caches.', 'Keep the historical hostname outside the explicit production-candidate allowlist.', false, false, false),
    hostDifferentiation: item('READY', 'One static artifact behaves differently by exact runtime hostname; unknown hosts fail closed and local development remains available.', 'Add any future candidate hostname only through governed review and deterministic tests.'),
    recommendedProductionHost: item('PLATFORM_ACTION_REQUIRED', 'GitHub Pages is the smallest repository-aligned option: the application is static, uses relative paths, includes an explicit GitHub Pages compatibility audit, and needs no server-side SPA rewrite for the current single-page root entry. No Pages publisher is currently configured.', 'Owner must select/configure GitHub Pages and obtain current account/repository-specific custom-domain instructions before DNS or deployment.', true, true),
    recommendedValidationHost: item('BLOCKED_BY_AUTHORIZATION', 'preview.gridlygo.com is allowlisted as the distinct validation candidate and keeps gridlygo.com reserved for eventual launch. It must serve the same artifact. A reachable URL is distribution under the unchanged governance boundary; noindex or obscurity is not access control.', 'Obtain explicit Deployment and Distribution authorization before publishing the preview origin.', true, true),
    hostingDecision: { recommendedHost: 'GitHub Pages', currentHost: 'NOT_EVIDENCED_IN_REPOSITORY', why: 'Static relative-path PWA plus existing GitHub Pages compatibility logic; avoids an unsupported migration.', migrationRequired: false },
    deploymentWorkflow: {
      trigger: 'NOT_CONFIGURED_FOR_WEB; only Capacitor Validation runs on pull_request and workflow_dispatch',
      source: 'Repository-root static assets; no publishing artifact is currently produced', productionBranch: 'main (authoritative policy; no web publisher configured)',
      rollbackMethod: 'NOT_CONFIGURED; after authorization, prefer redeploying a reviewed prior main commit/artifact. Rollback remains NOT_AUTHORIZED.'
    },
    manifest: item('READY', 'manifest.json uses Gridly/Gridly, standalone, relative ./ start_url and scope, relative 192/512 icons, #020812 background and #06101f theme. These values are origin-portable.', 'Validate installability on authorized HTTPS origins.'),
    serviceWorker: item('READY', 'js/app.js registers ./service-worker.js with ./ scope. The worker is same-origin only, navigation network-first with no-store and cached ./index.html fallback; listed closure shell assets are cache-first.', 'Do not broaden scope. Validate the production candidate online; full offline app operation is not claimed.'),
    cacheSafety: item('READY', 'Cache name gridly-pwa-shell-lp1011-v1 and version lp101.1-runtime-recovery are unchanged. Service-worker storage is origin-scoped, so old-beta caches cannot cross into gridlygo.com or preview.gridlygo.com. A fresh candidate origin requires no cache-version bump. On the old origin, activation deletes other gridly-pwa-shell-* and gridly-beta-closure-* caches; navigation refreshes index from network when available.', 'If the worker bytes or precache contract later change, issue a reviewed deterministic version/cache-name increment; no global cache clearing is required now.'),
    metadata: item('REPOSITORY_ACTION_REQUIRED', 'Description/theme/mobile metadata exist, but canonical URL, Open Graph URL/image metadata, social metadata, robots policy, and sitemap are absent. The visible shell still contains Liberty County Beta branding.', 'After launch/legal authorization, add reviewed canonical/share/SEO metadata and remove beta branding in a separately authorized presentation change.', false, false, true),
    absoluteUrls: item('READY', 'Core PWA files and local assets use relative URLs. External runtime dependencies/API endpoints are HTTPS. No old beta URL or host-specific redirect target is stored.', 'Re-audit third-party availability and policy before deployment.'),
    legalRoutes: {
      privacy: item('NOT_CONFIGURED', 'No /privacy route or approved privacy-policy file exists.', 'Owner/legal approval and repository implementation are launch blockers.', true, false, true),
      terms: item('NOT_CONFIGURED', 'No /terms route or approved terms file exists.', 'Owner/legal approval and repository implementation are launch blockers.', true, false, true),
      support: item('NOT_CONFIGURED', 'No /support route exists; support@gridlygo.com is only a future possibility and no MX/email configuration was performed.', 'Create approved support content and configure email separately; do not add MX under LP180.', true, true, true),
      communityReportingDisclaimer: item('NOT_CONFIGURED', 'No standalone approved legal route was found.', 'Obtain legal approval and publish only under later authorization.', true, false, true),
      subscriptionRefundTerms: item('NOT_CONFIGURED', 'No standalone approved terms were found.', 'Determine applicability and obtain legal approval.', true, false, true)
    }
  };

  const domain = {
    schemaVersion: 'gridly.lp180.gridlygoDomainReadiness.v1', milestone: 'LP180', domain: 'gridlygo.com',
    canonicalHost: 'gridlygo.com', redirectHost: 'www.gridlygo.com', validationHost: 'preview.gridlygo.com',
    gridlygoReadiness: item('BLOCKED_BY_AUTHORIZATION', 'Repository host gate and origin-relative PWA configuration are prepared, but no host, custom domain, DNS, certificate, or deployment is configured.', 'Complete owner/platform setup only after the required authorizations.', true, true),
    dnsRequirements: item('OWNER_ACTION_REQUIRED', 'For the recommended GitHub Pages architecture, apex record categories are A and optionally AAAA; www and preview use CNAME when configured as platform custom domains. A TXT record may be required for domain verification. Exact targets must come from the current GitHub Pages repository/account setup and platform documentation; the repository contains no supported account-specific values. MX is out of scope.', 'Owner obtains the exact current targets from the configured platform, verifies ownership, removes conflicts if instructed, then changes DNS only under separate authorization.', true, true),
    httpsReadiness: item('PLATFORM_ACTION_REQUIRED', 'No certificate or custom-domain evidence exists. GitHub Pages/platform is expected to own certificate issuance after DNS/custom-domain verification; this has not been executed or proven.', 'Platform provisions HTTPS and owner enables/enforces it only after authorization.', true, true),
    customDomainReadiness: item('PLATFORM_ACTION_REQUIRED', 'No CNAME file or repository custom-domain configuration is present. No unsupported value was added.', 'Configure the domain through the selected host UI/workflow after verifying current platform requirements.', true, true),
    originSensitiveIntegrations: {
      supabaseAuthRedirects: item('NOT_APPLICABLE', 'Runtime creates a data client but no Supabase Auth, OAuth, or auth callback flow was found.', 'Re-audit if authentication is introduced.'),
      corsAndApiAllowlists: item('READY', 'No repository-managed browser-origin allowlist or CSP was found. Supabase data APIs and external connectors use browser HTTPS/CORS; live acceptance still requires authorized device validation.', 'Confirm project/platform logs and connector behavior on the authorized origin; do not change security settings without failure evidence.', true, true),
      storageOriginChecks: item('NOT_APPLICABLE', 'No hostname-bound storage check was found; browser local storage/cache/service workers remain origin isolated.', 'No repository action.'),
      referrerPolicy: item('NOT_CONFIGURED', 'No explicit referrer-policy metadata/header configuration was found.', 'Choose a reviewed host-level policy before launch.', false, true, true)
    },
    appStoreFutureCompatibility: item('REPOSITORY_ACTION_REQUIRED', 'gridlygo.com can be a future marketing/PWA origin, but approved privacy, terms, and support URLs do not yet exist and HTTPS ownership is unproven.', 'Close legal/support and HTTPS/custom-domain blockers before store metadata submission.', true, true, true),
    ownerActions: ['Authorize deployment/distribution before any reachable validation origin', 'Select/configure host', 'Obtain platform-generated DNS targets', 'Perform domain verification and later DNS changes', 'Provide legal/support approvals', 'Configure support email separately if desired'],
    repositoryActions: ['No web publisher enabled under LP180', 'After authorization, add a manual fail-closed Pages publishing workflow/custom-domain configuration', 'After legal approval, implement privacy/terms/support routes', 'After launch authorization, add canonical/share metadata and reviewed discoverability policy'],
    authorizations: AUTHORIZATIONS,
    operationsPerformed: { dnsChanges: 0, deployments: 0, activations: 0, distributions: 0, publicLaunches: 0, restores: 0, rollbacks: 0 }
  };

  const sharedChecks = ['location permission', 'search', 'Current Location route', 'Talco route', 'Route Watch', 'Destination Intelligence', 'Awareness', 'report creation', 'hazard clear if safe', 'screenshots', 'tester attestation'];
  const plan = {
    schemaVersion: 'gridly.lp180.physicalDeviceValidationAccessPlan.v1', milestone: 'LP180', classification: 'BLOCKED_BY_AUTHORIZATION',
    accessModel: 'After explicit Deployment and Distribution authorization, publish the unchanged production-candidate artifact over HTTPS at preview.gridlygo.com. Do not reopen the historical beta, add ad-hoc authentication, or rely on noindex/obscurity. Promote the already-validated artifact to gridlygo.com only under later Public Launch authorization.',
    optionComparison: {
      gridlygoCom: { classification: 'BLOCKED_BY_AUTHORIZATION', governance: 'Resembles the final public entry point and risks being interpreted as Distribution/Public Launch.', recommendation: 'Reserve for authorized launch.' },
      previewGridlygoCom: { classification: 'BLOCKED_BY_AUTHORIZATION', governance: 'Separates device validation from the canonical launch origin while using the same artifact; still constitutes reachable distribution and requires authorization.', recommendation: 'Preferred validation hostname after authorization.' }
    },
    android: item('OWNER_ACTION_REQUIRED', ['manufacturer/model', 'Android version', 'Chrome version', 'UTC timestamp', 'approved HTTPS validation URL', ...sharedChecks, 'PWA installation', 'home-screen launch', 'online reload', 'offline/service-worker fallback observation (do not claim full offline support)'], 'Owner supplies actual device evidence; LP180 does not mark PASS.', true, true),
    iphone: item('OWNER_ACTION_REQUIRED', ['iPhone model', 'iOS version', 'Safari version', 'UTC timestamp', 'approved HTTPS validation URL', ...sharedChecks, 'Add to Home Screen', 'standalone launch', 'online reload', 'service-worker fallback observation (do not claim full offline support)'], 'Owner supplies actual device evidence; LP180 does not mark PASS.', true, true),
    evidenceRules: ['Record exact URL and UTC timestamp', 'Capture permission prompts/results and screenshots', 'Identify tester', 'Do not clear a real hazard unless safe and authorized', 'Do not infer PASS from emulators, repository tests, or prior beta evidence'],
    authorizationRequiredBeforeExecution: ['deployment', 'distribution'], publicLaunchAuthorizationRemainsRequiredForCanonicalHost: true
  };

  const summary = {
    schemaVersion: 'gridly.lp180.summary.v1', milestone: 'LP180', classification: 'PASS', mergeRecommendation: 'READY_TO_MERGE',
    foundationPrepared: true, physicalDeviceValidationExecuted: false, sameArtifactSuitable: true,
    oldBetaCanRemainClosed: true, recommendedHost: 'GitHub Pages', recommendedCanonicalHost: 'gridlygo.com', recommendedValidationHost: 'preview.gridlygo.com',
    gridlygoReadiness: 'BLOCKED_BY_AUTHORIZATION', physicalDeviceValidationAccessReadiness: 'BLOCKED_BY_AUTHORIZATION',
    privacyRouteReadiness: 'NOT_CONFIGURED', termsRouteReadiness: 'NOT_CONFIGURED', supportRouteReadiness: 'NOT_CONFIGURED',
    protectedRuntimeBusinessLogicChanged: false, lp179ConclusionsChanged: false, authorizations: AUTHORIZATIONS,
    operationsPerformed: domain.operationsPerformed, canonicalLf: 'PASS', utf8WithoutBom: 'PASS', deterministicTwoGeneration: 'PASS', secretSafety: 'PASS'
  };
  return Object.fromEntries(REPORT_NAMES.map((name, index) => [name, [hosting, domain, plan, summary][index]]));
}

export function write(root = ROOT, output = path.join(root, REPORT_DIR)) {
  const reports = build(); fs.mkdirSync(output, { recursive: true });
  for (const name of REPORT_NAMES) fs.writeFileSync(path.join(output, name), encode(reports[name]), 'utf8');
  return reports;
}

export function verify(root = ROOT) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp180-'));
  try {
    const a = path.join(temp, 'a'); const b = path.join(temp, 'b'); write(root, a); write(root, b);
    for (const name of REPORT_NAMES) {
      const first = fs.readFileSync(path.join(a, name)); const second = fs.readFileSync(path.join(b, name)); const committed = fs.readFileSync(path.join(root, REPORT_DIR, name));
      const text = first.toString('utf8');
      if (!first.equals(second) || !first.equals(committed) || first.includes(13) || first[0] === 0xef || /(?:service_role|private[_ -]?key|secret[_ -]?key|bearer\s+[a-z0-9._-]+)/i.test(text)) throw Error(`LP180 verification failed: ${name}`);
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if ((process.argv[2] || 'build') === 'verify') { verify(); console.log('LP180 verification PASS'); }
  else { write(); console.log('LP180 reports written; no deployment, DNS, activation, distribution, launch, restore, or rollback performed.'); }
}
