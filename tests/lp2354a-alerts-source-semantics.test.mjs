import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const semanticSource = fs.readFileSync(new URL('../js/gridlyAlertSemanticContract.js', import.meta.url), 'utf8');
const block = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const presentationHelpers = block('function gridlyAlertsPresentationSourceClass', 'function buildGridlyAlertCardConsumerModel');

function labels(record, count) {
  const context = { globalThis: {} };
  context.globalThis = context;
  vm.runInNewContext(semanticSource, context);
  vm.runInNewContext(`${presentationHelpers}; result = gridlyAlertsSourcePresentationLabels(input, count);`, { ...context, input: record, count });
  const execution = { ...context, input: record, count };
  vm.runInNewContext(`${presentationHelpers}; result = gridlyAlertsSourcePresentationLabels(input, count);`, execution);
  return execution.result;
}

test('audit scope reads cached authority and never references the open-local binding', () => {
  const writer = block('window.gridlyAlertsAuthorityWriterAudit = function', 'window.gridlyAlertDataDiagnostic = function');
  const completeness = block('// LP235.4: passive', '// LP235 is passive');
  assert.match(writer, /gridlyAlertsGetAuditRenderContext/);
  assert.match(writer, /authorityAvailable/);
  assert.match(writer, /NO_COMPLETED_ALERTS_RENDER_CONTEXT/);
  assert.doesNotMatch(writer, /alertsOpenRenderContext/);
  assert.match(completeness, /gridlyAlertsGetAuditRenderContext/);
  assert.doesNotMatch(completeness, /alertsOpenRenderContext/);
  assert.equal((app.match(/let alertsOpenRenderContext/g) || []).length, 1);
  assert.doesNotMatch(app, /window\.alertsOpenRenderContext|globalThis\.alertsOpenRenderContext/);
});

test('writer, completeness, and governed audits retain nonthrowing passive call paths', () => {
  assert.match(app, /window\.gridlyAlertsAuthorityWriterAudit = function/);
  assert.match(app, /window\.gridlyLP235AlertsPresentationCompletenessAudit = function/);
  assert.match(app, /gridlyGovernedAwarenessAudit/);
  assert.match(app, /const writerAudit = window\.gridlyAlertsAuthorityWriterAudit\?\.\(\) \|\| \{\}/);
});

test('official and community presentation labels preserve provenance', () => {
  const official = labels({ sourceKind: 'official_roadway', providerId: 'drivetexas' }, 26);
  assert.equal(official.sourceClass, 'official_roadway');
  assert.equal(official.sourceLabel, 'Official Roadways');
  assert.equal(official.confirmationLabel, 'Official source · DriveTexas');
  assert.equal(official.countLabel, '26 official roadway conditions');
  assert.doesNotMatch(`${official.confirmationLabel} ${official.countLabel}`, /community/i);

  const community = labels({ sourceKind: 'community_report' }, 2);
  assert.equal(community.sourceClass, 'community_report');
  assert.equal(community.sourceLabel, 'Community');
  assert.equal(community.confirmationLabel, 'Community confirmed');
  assert.equal(community.countLabel, '2 community reports');
});

test('grouping includes source ownership and exposes truthful count contribution authority', () => {
  const grouping = block('function gridlyGetAlertClusterKeyWithContext', '// LP226 owns only snapshot preparation');
  assert.match(grouping, /const sourceClass = gridlyAlertsPresentationSourceClass\(alert\)/);
  assert.match(grouping, /`\$\{sourceClass\}\|\$\{kind\}\|\$\{corridor\}\|\$\{locationCluster\}`/);
  assert.match(grouping, /__gridlyRepresentedEvidenceCount/);
  assert.match(grouping, /__gridlyCountContributionType/);
  assert.match(grouping, /group\.sourceClass === "community_report"/);
});

test('official cards bypass Community confirmed and community count fallbacks', () => {
  const model = block('function buildGridlyAlertCardConsumerModel', 'function gridlyResolveVisibleAlertCardLocationLine');
  const trust = block('function formatGridlyAlertsTrustLine', 'function getReportStateLabel');
  const render = block('const RenderCompleteAlertCard', 'const renderAlertCard');
  assert.match(model, /gridlyAlertsSourcePresentationLabels/);
  assert.match(model, /sourcePresentation\.confirmationLabel/);
  assert.match(trust, /sourcePresentation\.sourceClass === "official_roadway"/);
  assert.match(render, /trustLine/);
});

test('source-semantics audit is passive, generic, and reports required authorities', () => {
  const audit = block('// LP235.4A:', '// LP235 is passive');
  for (const field of ['auditAuthorityAvailable','auditAuthorityReason','canonicalCommunity','officialRoadwayCount','rows','officialRowsMisclassifiedAsCommunityCount','communityRowsMisclassifiedAsOfficialCount','countLabelValue','countLabelMeaning','countLabelSourceClass','sourceSemanticsPass','overallPass']) assert.match(audit, new RegExp(field));
  assert.doesNotMatch(audit, /fetch\(|setTimeout|setInterval|requestAnimationFrame|querySelector|innerHTML|renderAlertCard|openGridly/);
  assert.doesNotMatch(audit, /Dallas|Austin|Katy|Dayton|Liberty County|4819000/);
});

test('repair changes no writer ownership and introduces no provider work', () => {
  assert.match(app, /LP223: the portrait sheet is a live consumer/);
  assert.equal((app.match(/window\.gridlyAlertsAuthorityWriterAudit = function/g) || []).length, 1);
  const semantics = block('// LP235.4A:', '// LP235 is passive');
  assert.doesNotMatch(semantics, /fetch\(|setInterval|setTimeout|poll/i);
});
