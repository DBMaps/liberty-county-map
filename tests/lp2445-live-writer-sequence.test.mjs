import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import parity from '../js/gridlyGovernedActiveConditionParity.js';

const REPORT_ID = '0f798ec4-b48a-4452-be2f-105c0d1af859';
const EVIDENCE_ID = `community_report:${REPORT_ID}`;

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in production`);
  const argumentsStart = source.indexOf('(', start);
  let parentheses = 0;
  let brace = -1;
  for (let index = argumentsStart; index < source.length; index += 1) {
    if (source[index] === '(') parentheses += 1;
    if (source[index] === ')') parentheses -= 1;
    if (parentheses === 0) {
      brace = source.indexOf('{', index);
      break;
    }
  }
  assert.notEqual(brace, -1, `${name} body must exist`);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

test('LP244.5 browser writer sequence retains Dayton summary parity and a non-quiet Brief', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  const publisher = extractFunction(app, 'gridlyPublishAuthoritativeCommunityAwarenessSummary');
  const ownerAudit = extractFunction(app, 'gridlyGovernedActiveConditionParityAudit');
  const record = { id: REPORT_ID, status: 'active', countyId: 'liberty-tx', placeGeoid: '4819432', community: 'Dayton' };
  const governed = [{ evidenceId: EVIDENCE_ID, record }];
  const window = {
    gridlyGovernedActiveConditionParity: parity,
    gridlyTopAwarenessMicrolineState: {},
    gridlyAwarenessBriefIntelligenceModel: { state: 'quiet' }
  };
  const document = { querySelector: () => null };
  const context = {
    window, document,
    gridlyLastAuthoritativeCommunityAwarenessSummary: null,
    gridlyCommunityPulseAuditState: { activeAwareness: { topAwarenessCanonicalIds: [EVIDENCE_ID], governedKbygEvidenceIds: [EVIDENCE_ID] } },
    gridlyV923PortraitRefreshOptimizationState: {},
    gridlyGetGovernedActiveAwarenessRows: () => governed,
    getGridlyAlertsSurfaceActiveCommunityReportRows: () => [record],
    getGridlySelectedAwarenessArea: () => ({ label: 'Dayton', countyId: 'liberty-tx', placeGeoid: '4819432' }),
    getGridlyAwarenessAreaDebugOption: (area) => area,
    gridlyCommunityAwarenessObjectId: () => 1,
    publishGridlyCommunityPulseAuditState(patch) {
      context.gridlyCommunityPulseAuditState = { ...context.gridlyCommunityPulseAuditState, ...patch };
      window.gridlyCommunityPulseAuditState = context.gridlyCommunityPulseAuditState;
      return context.gridlyCommunityPulseAuditState;
    },
    refreshPortraitV2LocalizedIntelligence(options) {
      // Reproduce the production refresh boundary: a cached calm presentation
      // exists, then the authoritative summary must win the final Brief write.
      window.gridlyAwarenessBriefIntelligenceModel = { state: 'quiet' };
      const count = options.communityAwarenessSummary.activeReportsInArea.length;
      window.gridlyAwarenessBriefIntelligenceModel = { state: count ? 'active' : 'quiet' };
      context.gridlyCommunityPulseAuditState = {
        ...context.gridlyCommunityPulseAuditState,
        communityAwarenessSummary: { ...options.communityAwarenessSummary, activeReportsInArea: [] }
      };
    }
  };
  vm.createContext(context);
  vm.runInContext(`${publisher}; ${ownerAudit};`, context);

  // Initialization publishes a healthy-empty presentation snapshot even
  // though KBYG governance already contains the selected Dayton condition.
  const initialized = context.gridlyPublishAuthoritativeCommunityAwarenessSummary({
    selectedAwarenessArea: context.getGridlySelectedAwarenessArea(),
    activeHazardsInArea: [], activeReportsInArea: []
  }, { reason: 'initialization' });
  assert.deepEqual(initialized.activeReportsInArea.map(parity.canonicalIdentity), [EVIDENCE_ID]);

  // A later provider/portrait cycle attempts the same empty overwrite. The
  // actual production publisher must rejoin governance and refresh Brief.
  context.gridlyPublishAuthoritativeCommunityAwarenessSummary({
    selectedAwarenessArea: context.getGridlySelectedAwarenessArea(),
    activeHazardsInArea: [], activeReportsInArea: []
  }, { reason: 'post-portrait-provider-refresh' });

  const audit = context.gridlyGovernedActiveConditionParityAudit();
  assert.deepEqual(audit.communitySummaryIds, [EVIDENCE_ID]);
  assert.notEqual(audit.awarenessBriefState, 'quiet');
  assert.equal(audit.locationContextCount, 0, 'Location Context retains its independent narrower scope');
  assert.equal(audit.countParityPass, true);
  assert.equal(audit.identityParityPass, true);
  assert.equal(audit.briefParityPass, true);
  assert.equal(audit.overallPass, true);
});

test('Brief snapshot count cannot become quiet when a governed KBYG identity survives a stale empty summary', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  assert.match(app, /Math\.max\(areaScopedActiveCount, governedActiveCount\)/);
  assert.match(app, /convergeAuthoritativeSummary/);
  assert.match(app, /locationContextCount/);
});

test('writer trace proves the legacy last writers fail before repair and the full sequential publication passes after repair', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  const record = { id: REPORT_ID, status: 'active', countyId: 'liberty-tx', placeGeoid: '4819432' };
  const governed = [{ evidenceId: EVIDENCE_ID, record }];
  const staleHealthyEmpty = { awarenessAreaName: 'Dayton', activeReportsInArea: [] };

  // Browser-observed pre-repair sequence: the official publisher converged,
  // then the generic Pulse publisher preferred its older official snapshot;
  // portrait subsequently published its cached quiet Brief.
  let legacySummary = parity.convergeAuthoritativeSummary(staleHealthyEmpty, governed);
  legacySummary = staleHealthyEmpty;
  let legacyBrief = { state: legacySummary.activeReportsInArea.length ? 'active' : 'quiet' };
  const legacyAudit = parity.audit({ governed, alerts: [record], kbyg: governed,
    communitySummary: legacySummary.activeReportsInArea,
    topAwarenessRepresentations: [{ evidenceId: EVIDENCE_ID }], awarenessBriefState: legacyBrief.state });
  assert.equal(legacyAudit.overallPass, false, 'pre-repair last-writer sequence reproduces owner failure');

  // Repaired sequence includes initialization, official publication, portrait
  // refresh, stale provider refresh, and final post-portrait convergence.
  let summary = parity.convergeAuthoritativeSummary(staleHealthyEmpty, governed);
  summary = parity.convergeAuthoritativeSummary(staleHealthyEmpty, governed);
  summary = parity.convergeAuthoritativeSummary(summary, governed);
  const evidenceCount = governed.length + 1 + summary.activeReportsInArea.length + 1;
  legacyBrief = { state: evidenceCount ? 'active' : 'quiet' };
  const repairedAudit = parity.audit({ governed, alerts: [record], kbyg: governed,
    communitySummary: summary.activeReportsInArea,
    topAwarenessRepresentations: [{ evidenceId: EVIDENCE_ID }], awarenessBriefState: legacyBrief.state });
  assert.deepEqual(repairedAudit.communitySummaryIds, [EVIDENCE_ID]);
  assert.equal(repairedAudit.overallPass, true, 'full simulated writer sequence reaches governed parity');

  assert.match(app, /function gridlyGovernedParityWriterTrace\(\)/);
  assert.match(app, /writer: "invalidateGridlyPortraitAwarenessSnapshotsForAreaChange"/);
  assert.match(app, /writer: "refreshPortraitV2LocalizedIntelligence:awareness-brief-publication"/);
  assert.match(app, /governed-active-evidence-blocked-quiet/);
  assert.match(app, /const proposedSummary = gridlyLastAuthoritativeCommunityAwarenessSummary \|\| normalizedPatch\.communityAwarenessSummary \|\| publisherAuthoritativeSummary/);
  assert.match(app, /firstSummaryLoss/);
  assert.match(app, /firstBriefQuietOverwrite/);
});
