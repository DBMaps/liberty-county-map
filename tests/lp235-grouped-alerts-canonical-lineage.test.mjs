import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const start = app.indexOf('function gridlyBuildAlertCanonicalToPresentationMapping');
const end = app.indexOf('\nwindow.gridlyAlertsAuthorityWriterAudit = function', start);
const helperSource = app.slice(start, end);

function buildMapping(presentations, dom) {
  const sandbox = {
    gridlyAlertWriterRecordId: (row, index = 0) => String(row?.evidenceId || row?.id || `alert-${index}`),
    gridlyAlertPresentationId: (row, index = 0) => String(row?.presentationId || row?.evidenceId || row?.id || `alert-${index}`)
  };
  vm.runInNewContext(`${helperSource}\nthis.build = gridlyBuildAlertCanonicalToPresentationMapping;`, sandbox);
  return sandbox.build(presentations, dom);
}
const domRow = id => ({ presentationId:id, persistedId:`persisted-${id}`, providerId:`provider-${id}`, presentationContract:'CONCISE_ALERT_CARD', presentationTemplateUsed:'RenderCompleteAlertCard.CONCISE_ALERT_CARD' });
const group = (presentationId, ids, sourceIndexes = ids.map((_, i) => i)) => ({ presentationId, evidenceId:ids[0], __gridlyPresentationEvidenceRows:ids.map(id => ({ evidenceId:id, providerRecordId:`provider-${id}`, sourceKind:'official_roadway' })), __gridlyPresentationSourceIndexes:sourceIndexes, __gridlyPresentationClusterKey:`official_roadway|construction|road|cluster` });

test('three canonical identities expand to one leader and two grouped mappings without cards', () => {
  const output = buildMapping([group('p-1', ['a','b','c'])], [domRow('p-1')]);
  assert.equal(output.mapping.length, 3);
  assert.deepEqual(Array.from(output.mapping, row => row.canonicalId), ['a','b','c']);
  assert.deepEqual(Array.from(output.mapping, row => row.representationRole), ['LEADER','GROUP_MEMBER','GROUP_MEMBER']);
  assert.equal(new Set(output.mapping.map(row => row.presentationId)).size, 1);
});

test('duplicate canonical/presentation pairs are rejected and reported', () => {
  const output = buildMapping([group('p-1', ['a','a','b'])], [domRow('p-1')]);
  assert.equal(output.mapping.length, 2);
  assert.deepEqual(Array.from(output.duplicatePairs), ['a::p-1']);
});

test('26 writer identities through 12 cards produce 26 unique mappings', () => {
  const ids = Array.from({length:26}, (_, i) => `canonical-${i + 1}`);
  const presentations = Array.from({length:12}, (_, i) => group(`presentation-${i + 1}`, i < 2 ? ids.slice(i * 8, i * 8 + 8) : [ids[16 + i - 2]]));
  const output = buildMapping(presentations, presentations.map(row => domRow(row.presentationId)));
  assert.equal(presentations.length, 12);
  assert.equal(output.mapping.length, 26);
  assert.equal(new Set(output.mapping.map(row => row.canonicalId)).size, 26);
});

test('26 to 12 leader-only mapping fails canonical identity coverage while one-to-one passes', () => {
  const writer = Array.from({length:26}, (_, i) => `canonical-${i + 1}`);
  const leaderOnly = writer.slice(0,12).map((canonicalId, i) => ({canonicalId, presentationId:`p-${i}`}));
  const coverage = mapping => writer.every(id => mapping.some(row => row.canonicalId === id));
  assert.equal(coverage(leaderOnly), false);
  assert.equal(coverage(writer.map((canonicalId, i) => ({canonicalId,presentationId:`p-${i}`}))), true);
});

test('LP235.4B audit declares grouped lineage coverage and explicit count semantics', () => {
  const block = app.slice(app.indexOf('// LP235.4: passive'), app.indexOf('// LP235.4A:'));
  for (const field of ['groupedPresentationLineage','leaderCanonicalId','representedCanonicalIds','representedProviderIds','representationCount','canonicalToPresentationMappingUniqueCanonicalCount','canonicalToPresentationMappingDuplicatePairs','groupedLineageCoveragePass','GROUPED_CANONICAL_TO_PRESENTATION_IDENTITY_COVERAGE']) assert.match(block, new RegExp(field));
  assert.match(block, /directPresentationCountMeaning: "FINAL_PRESENTATION_GROUPS"/);
  assert.match(block, /writerAudit\.parity === true/);
});

test('repair stays passive and preserves grouping/source/runtime boundaries', () => {
  const helper = app.slice(start, end);
  assert.match(helper, /__gridlyPresentationEvidenceRows/);
  assert.doesNotMatch(helper, /fetch\(|setTimeout|setInterval|document\.|querySelector|Dallas|Austin|Katy/);
  assert.match(app, /const key = `\$\{sourceClass\}\|\$\{kind\}\|\$\{corridor\}\|\$\{locationCluster\}`/);
  assert.match(app, /sourceClass === "community_report"/);
  assert.doesNotMatch(helper, /RenderCompleteAlertCard|slice\(0,/);
});

test('LP235.4C retains grouped lineage through normalization and completed context', () => {
  const renderPipeline = app.slice(app.indexOf('alertsOpenRenderContext = {'), app.indexOf('return opened;', app.indexOf('alertsOpenRenderContext = {')));
  assert.match(renderPipeline, /POST_GROUP_BUILD/);
  assert.match(renderPipeline, /POST_PRESENTATION_NORMALIZATION/);
  assert.match(renderPipeline, /PRE_RENDER_COMPLETE_ALERT_CARD/);
  assert.match(renderPipeline, /COMPLETED_RENDER_CONTEXT/);
  assert.match(renderPipeline, /presentationModel = \{ \.\.\.presentationCountModel, alerts: presentationAlerts \}/);
  assert.match(renderPipeline, /lastCompletedRenderContext = alertsOpenRenderContext/);
  assert.ok(renderPipeline.indexOf('lastCompletedRenderContext = alertsOpenRenderContext') > renderPipeline.indexOf('const opened ='));
  assert.doesNotMatch(renderPipeline.slice(renderPipeline.indexOf('presentationModel ='), renderPipeline.indexOf('lastCompletedRenderContext =')), /__gridlyPresentationEvidenceRows\s*=/);
});

test('lineage stage audit detects field loss without DOM reconstruction', () => {
  const summaryStart = app.indexOf('function gridlySummarizeAlertsGroupedLineage');
  const summaryEnd = app.indexOf('\nfunction gridlyAlertsWithActiveRenderContext', summaryStart);
  const summarySource = app.slice(summaryStart, summaryEnd);
  const sandbox = { gridlyAlertWriterRecordId: (row, index = 0) => String(row?.evidenceId || `alert-${index}`) };
  vm.runInNewContext(`${summarySource}\nthis.summarize = gridlySummarizeAlertsGroupedLineage;`, sandbox);
  const writer = ['a', 'b', 'c'].map(evidenceId => ({ evidenceId }));
  const retained = group('p-1', ['a', 'b', 'c']);
  const complete = sandbox.summarize('COMPLETED_RENDER_CONTEXT', [retained], writer);
  assert.equal(complete.representedCanonicalCount, 3);
  assert.equal(complete.groupsMissingEvidenceRows, 0);
  assert.deepEqual(Array.from(complete.missingCanonicalIds), []);
  const lost = sandbox.summarize('COMPLETED_RENDER_CONTEXT', [{ evidenceId: 'a' }], writer);
  assert.equal(lost.representedCanonicalCount, 1);
  assert.equal(lost.groupsMissingEvidenceRows, 1);
  assert.deepEqual(Array.from(lost.missingCanonicalIds), ['b', 'c']);
  assert.doesNotMatch(summarySource, /document\.|querySelector|textContent|fetch\(|setTimeout|setInterval/);
});

test('completeness audit publishes all passive grouped-lineage checkpoints', () => {
  const audit = app.slice(app.indexOf('window.gridlyLP235AlertsPresentationCompletenessAudit = function'), app.indexOf('// LP235.4A:'));
  for (const field of [
    'groupedLineageStageAudit', 'postGroupBuildRepresentedCanonicalCount', 'preRenderRepresentedCanonicalCount',
    'postNormalizationRepresentedCanonicalCount', 'completedRenderContextRepresentedCanonicalCount',
    'mappingBuilderInputRepresentedCanonicalCount', 'groupedLineageFirstLosingStage',
    'groupsMissingEvidenceRowsAtCompletedContext'
  ]) assert.match(audit, new RegExp(field));
  assert.doesNotMatch(audit, /fetch\(|setTimeout|setInterval|querySelector|openGridlyPortraitV2Sheet/);
});
