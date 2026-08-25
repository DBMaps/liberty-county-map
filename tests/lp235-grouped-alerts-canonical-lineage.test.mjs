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

function buildRealGroups(rows) {
  const source = app.slice(app.indexOf('function getAlertLocationClusterLabel'), app.indexOf('\n  async function gridlyGetAlertsPresentationCountModelCooperative'));
  const sandbox = {
    globalThis: { gridlyAlertSemanticContract: { classify: row => ({ classification: row.situationType }) } },
    pickFirstNonEmptyText: values => String(values.find(value => value != null && String(value).trim()) || ''),
    coerceDisplayText: value => String(value || ''),
    gridlyResolveCountyAwareFallbackLocation: () => 'Texas',
    gridlyAlertsPresentationSourceClass: row => row.sourceKind || 'official_roadway',
    gridlyAlertsGroupingRecordHelper: () => {}, gridlyAlertsCooperativeNow: () => 0,
    gridlyAlertsGroupingMeasure: (_audit, _field, _label, fn) => fn(),
    gridlyAlertWriterRecordId: (row, index = 0) => String(row.evidenceId || `alert-${index}`)
  };
  vm.runInNewContext(`${source}\nthis.buildGroups = gridlyBuildGridlyAlertsPresentationCountModelSync;`, sandbox);
  const model = sandbox.buildGroups(rows);
  model.testCheckpointAuthority = sandbox.globalThis.__gridlyAlertsGroupCheckpointAuthority;
  model.testRouteAuthority = sandbox.globalThis.__gridlyAlertsPresentationBuilderRouteAuthority;
  return model;
}

async function buildRealGroupsCooperative(rows, options = {}) {
  const source = app.slice(app.indexOf('function getAlertLocationClusterLabel'), app.indexOf('\n  // LP226 owns only snapshot preparation'));
  const audit = { subphases: { sourceIterationMs: 0 }, sourceLoopIterations: 0, longestWorkSegmentMs: 0 };
  const sandbox = {
    globalThis: { gridlyAlertSemanticContract: { classify: row => ({ classification: row.situationType }) } },
    pickFirstNonEmptyText: values => String(values.find(value => value != null && String(value).trim()) || ''),
    coerceDisplayText: value => String(value || ''), gridlyResolveCountyAwareFallbackLocation: () => 'Texas',
    gridlyAlertsPresentationSourceClass: row => row.sourceKind || 'official_roadway', gridlyAlertsGroupingRecordHelper: () => {},
    gridlyAlertsCooperativeNow: () => 0, gridlyAlertsGroupingMeasure: (_audit, _field, _label, fn) => fn(),
    gridlyAlertWriterRecordId: (row, index = 0) => String(row.evidenceId || `alert-${index}`),
    gridlyCreateAlertsGroupingHotLoopAudit: () => audit, gridlyAlertsGroupingHotLoopState: {},
    gridlyAlertsGroupingYieldIfNeeded: async () => {}, gridlyFinalizeAlertsGroupingHotLoopAudit: () => {}
  };
  vm.runInNewContext(`${source}\nthis.buildGroupsCooperative = gridlyGetAlertsPresentationCountModelCooperative;`, sandbox);
  const model = await sandbox.buildGroupsCooperative(rows, options);
  model.testCheckpointAuthority = sandbox.globalThis.__gridlyAlertsGroupCheckpointAuthority;
  model.testRouteAuthority = sandbox.globalThis.__gridlyAlertsPresentationBuilderRouteAuthority;
  return model;
}

const officialRow = (index, cluster) => ({ evidenceId:`canonical-${index}`, providerRecordId:`provider-${index}`, sourceKind:'official_roadway', situationType:'construction', corridor:`road-${cluster}`, crossingRoad:`cluster-${cluster}`, title:'Construction' });

test('real group create and append paths retain three identities and source indexes', () => {
  const model = buildRealGroups([officialRow(1, 1), officialRow(2, 1), officialRow(3, 1)]);
  assert.equal(model.alerts.length, 1);
  const [presentation] = model.alerts;
  assert.equal(presentation.__gridlyRepresentedEvidenceCount, 3);
  assert.deepEqual(Array.from(presentation.__gridlyPresentationEvidenceRows, row => row.evidenceId), ['canonical-1','canonical-2','canonical-3']);
  assert.deepEqual(Array.from(presentation.__gridlyPresentationSourceIndexes), [0,1,2]);
  assert.deepEqual(Array.from(presentation.__gridlyGroupAccumulationTrace, row => row.action), ['CREATE_GROUP','APPEND_GROUP_MEMBER','APPEND_GROUP_MEMBER']);
  assert.ok(presentation.__gridlyGroupAccumulationTrace.every(row => row.memberRetained));
  assert.equal(presentation.__gridlyPresentationClusterKey, 'official_roadway|construction|road-1|cluster-1');
  assert.equal(presentation.__gridlyGroupObjectIdentityTrace.accumulatorIsMapStored, true);
  assert.equal(presentation.__gridlyGroupObjectIdentityTrace.mapStoredIsMapToArray, true);
  for (const checkpoint of ['accumulator', 'mapStored', 'mapToArray']) {
    assert.equal(presentation.__gridlyGroupObjectIdentityTrace[checkpoint].hasEvidenceRows, true);
    assert.equal(presentation.__gridlyGroupObjectIdentityTrace[checkpoint].evidenceRowCount, 3);
  }
  for (const property of ['__gridlyPresentationEvidenceRows', '__gridlyPresentationSourceIndexes', '__gridlyPresentationClusterKey']) {
    assert.equal(Object.prototype.hasOwnProperty.call(presentation, property), true);
    assert.equal(Object.prototype.propertyIsEnumerable.call(presentation, property), true);
    assert.equal(Object.getOwnPropertyDescriptor(presentation, property).enumerable, true);
  }
  const mapping = buildMapping(model.alerts.map(row => ({...row, presentationId:'p-1'})), [domRow('p-1')]);
  assert.deepEqual(Array.from(mapping.mapping, row => row.representationRole), ['LEADER','GROUP_MEMBER','GROUP_MEMBER']);
});

test('real 26 input grouping path retains all identities in 12 groups', () => {
  const rows = Array.from({length:26}, (_, index) => officialRow(index + 1, (index % 12) + 1));
  const model = buildRealGroups(rows);
  assert.equal(model.alerts.length, 12);
  assert.equal(model.alerts.reduce((sum, row) => sum + row.__gridlyRepresentedEvidenceCount, 0), 26);
  assert.equal(model.alerts.reduce((sum, row) => sum + row.__gridlyPresentationEvidenceRows.length, 0), 26);
  assert.equal(new Set(model.alerts.flatMap(row => row.__gridlyPresentationEvidenceRows.map(member => member.evidenceId))).size, 26);
});

test('cooperative production builder bridges private lineage to public rows', async () => {
  const rows = [officialRow(1, 1), officialRow(2, 1), officialRow(3, 1)];
  const model = await buildRealGroupsCooperative(rows);
  assert.equal(model.alerts.length, 1);
  assert.deepEqual(Array.from(model.alerts[0].__gridlyPresentationEvidenceRows), rows);
  assert.deepEqual(Array.from(model.alerts[0].__gridlyPresentationSourceIndexes), [0, 1, 2]);
  assert.equal(model.alerts[0].__gridlyPresentationClusterKey, 'official_roadway|construction|road-1|cluster-1');
  assert.equal(model.alerts[0].__gridlyRepresentedEvidenceCount, 3);
});

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

test('object identity audit identifies an intentional reconstruction loss at its exact boundary', () => {
  const source = app.slice(app.indexOf('function gridlyAlertGroupObjectIdentityCheckpoint'), app.indexOf('\n  function getGridlyAlertsPresentationCountModel'));
  const sandbox = {};
  vm.runInNewContext(`${source}\nthis.checkpoint = gridlyAlertGroupObjectIdentityCheckpoint; this.firstLoss = gridlyAlertGroupObjectIdentityFirstLosingStage;`, sandbox);
  const retained = group('p-1', ['a', 'b', 'c']);
  const good = sandbox.checkpoint(retained);
  const dropped = sandbox.checkpoint({ presentationId: retained.presentationId });
  assert.equal(good.hasEvidenceRows, true);
  assert.equal(good.evidenceRowsOwnProperty, true);
  assert.equal(good.evidenceRowsEnumerable, true);
  assert.equal(dropped.hasEvidenceRows, false);
  assert.equal(sandbox.firstLoss({
    PRE_GROUP_INPUT: good, ACCUMULATOR_GROUP_OBJECT: good, MAP_STORED_GROUP_OBJECT: good,
    MAP_TO_ARRAY_GROUP_OBJECT: dropped, PRESENTATION_MODEL_ROW: dropped,
    FUNCTION_RETURN_ROW: dropped, POST_GROUP_BUILD_AUDIT_ROW: dropped
  }), 'MAP_TO_ARRAY_GROUP_OBJECT');
  assert.equal(sandbox.firstLoss({
    PRE_GROUP_INPUT: good, ACCUMULATOR_GROUP_OBJECT: good, MAP_STORED_GROUP_OBJECT: good,
    MAP_TO_ARRAY_GROUP_OBJECT: good, PRESENTATION_MODEL_ROW: good,
    FUNCTION_RETURN_ROW: good, POST_GROUP_BUILD_AUDIT_ROW: dropped
  }), 'POST_GROUP_BUILD_AUDIT_ROW');
});

test('private checkpoints use private fields and first loss occurs only at the public bridge', () => {
  const source = app.slice(app.indexOf('function gridlyAlertGroupObjectIdentityCheckpoint'), app.indexOf('\n  function getGridlyAlertsPresentationCountModel'));
  const sandbox = {};
  vm.runInNewContext(`${source}\nthis.checkpoint = gridlyAlertGroupObjectIdentityCheckpoint; this.firstLoss = gridlyAlertGroupObjectIdentityFirstLosingStage;`, sandbox);
  const members = [{ evidenceId: 'a' }, { evidenceId: 'b' }, { evidenceId: 'c' }];
  const privateGroup = { evidenceRows: members, sourceIndexes: [0, 1, 2] };
  const privateCheckpoint = sandbox.checkpoint(privateGroup, 'private');
  const wrongDomainCheckpoint = sandbox.checkpoint(privateGroup, 'public');
  const publicLoss = sandbox.checkpoint({ __gridlyPresentationEvidenceRows: [members[0]], __gridlyPresentationSourceIndexes: [0] });
  assert.equal(privateCheckpoint.evidenceRowCount, 3);
  assert.equal(privateCheckpoint.sourceIndexCount, 3);
  assert.equal(wrongDomainCheckpoint.evidenceRowCount, 0, 'intentional wrong-field lookup exposes AUDIT_FIELD_DOMAIN_DEFECT');
  assert.equal(sandbox.firstLoss({ PRE_GROUP_INPUT: privateCheckpoint, ACCUMULATOR_GROUP_OBJECT: privateCheckpoint,
    MAP_STORED_GROUP_OBJECT: privateCheckpoint, MAP_TO_ARRAY_GROUP_OBJECT: privateCheckpoint,
    PRESENTATION_MODEL_ROW: publicLoss, FUNCTION_RETURN_ROW: publicLoss, POST_GROUP_BUILD_AUDIT_ROW: publicLoss }), 'PRESENTATION_MODEL_ROW');
});

test('LP235.4F audit checkpoint is accessible without a window binding and stays pure', () => {
  const auditStart = app.indexOf('// LP235.4: passive presentation-completeness reconciliation');
  const auditEnd = app.indexOf('// LP235.4A:', auditStart);
  const auditSource = app.slice(auditStart, auditEnd);
  const declaration = auditSource.indexOf('function gridlyAlertGroupObjectIdentityCheckpoint');
  const call = auditSource.indexOf('gridlyAlertGroupObjectIdentityCheckpoint(row)');
  assert.ok(declaration >= 0 && call > declaration, 'checkpoint declaration must share the passive audit lexical scope');
  assert.doesNotMatch(auditSource, /window\.gridlyAlertGroupObjectIdentityCheckpoint\s*=/);
  const pureHelper = auditSource.slice(declaration, auditSource.indexOf('\n\nfunction gridlyAlertGroupObjectIdentityFirstLosingStage', declaration));
  assert.doesNotMatch(pureHelper, /document\.|fetch\(|setTimeout|setInterval|openGridlyPortraitV2Sheet|gridlyMap|selected/);

  const sandbox = {};
  vm.runInNewContext(`${pureHelper}\nthis.checkpoint = gridlyAlertGroupObjectIdentityCheckpoint;`, sandbox);
  for (const rows of [
    buildRealGroups([officialRow(1, 1), officialRow(2, 1), officialRow(3, 1)]).alerts,
    buildRealGroups(Array.from({ length: 26 }, (_, index) => officialRow(index + 1, (index % 12) + 1))).alerts
  ]) {
    const groupObjectIdentityAudit = rows.map(sandbox.checkpoint);
    assert.ok(groupObjectIdentityAudit.length > 0);
    assert.ok(groupObjectIdentityAudit.every(checkpoint => checkpoint.hasEvidenceRows && checkpoint.evidenceRowCount > 0));
  }
});

test('LP235.4F object identity authority fails closed when its checkpoint is unavailable', () => {
  const audit = app.slice(app.indexOf('// LP235.4: passive presentation-completeness reconciliation'), app.indexOf('// LP235.4A:'));
  assert.match(audit, /groupObjectIdentityAuthorityAvailable = Boolean\(authorityAvailable && groupCheckpointRecords/);
  assert.match(audit, /COOPERATIVE_GROUP_CHECKPOINT_NOT_PUBLISHED/);
  assert.match(audit, /groupObjectIdentityAuthorityAvailable \? finalRows : \[\]/);
  assert.match(audit, /&& groupObjectIdentityAuthorityAvailable/);
  assert.match(audit, /groupObjectIdentityAuthorityAvailable, groupObjectIdentityAuthorityReason/);
});

function runPresentationCompletenessAudit(auditRenderContext, checkpointAuthority = null, routeAuthority = null) {
  const auditStart = app.indexOf('(() => {', app.indexOf('// LP235.4: passive presentation-completeness reconciliation'));
  const auditEnd = app.indexOf('// LP235.4A:', auditStart);
  const auditSource = app.slice(auditStart, auditEnd);
  const sandbox = {
    __gridlyAlertsGroupCheckpointAuthority: checkpointAuthority,
    __gridlyAlertsPresentationBuilderRouteAuthority: routeAuthority,
    window: {
      __gridlyLp2194AlertStages: { finalAlertData: auditRenderContext?.alerts || [] },
      gridlyAlertsAuthorityWriterAudit: () => ({
        canonicalToPresentationMapping: auditRenderContext ? [{ canonicalId: 'canonical-1', presentationId: 'presentation-1' }] : [],
        canonicalToPresentationMappingDuplicatePairs: [], parity: Boolean(auditRenderContext)
      })
    },
    getGridlySelectedAwarenessArea: () => null,
    gridlyResolveCanonicalPlaceGeoid: () => null,
    gridlyAlertsGetAuditRenderContext: () => auditRenderContext,
    gridlyAlertWriterRecordId: (row, index = 0) => String(row?.evidenceId || `alert-${index}`),
    gridlyBuildCanonicalLiveIncidentPresentation: row => ({ incidentId: row?.presentationId, title: row?.title }),
    gridlyAlertPresentationId: (row, index = 0) => String(row?.presentationId || row?.evidenceId || `alert-${index}`),
    gridlyAlertsPresentationSourceClass: row => row?.sourceKind || 'official_roadway',
    gridlySummarizeAlertsGroupedLineage: (stage, rows) => ({
      stage, representedCanonicalCount: rows.reduce((count, row) => count + (row?.__gridlyPresentationEvidenceRows?.length || 1), 0),
      groupsMissingEvidenceRows: rows.filter(row => !Array.isArray(row?.__gridlyPresentationEvidenceRows)).length
    }),
    exposeGridlyAuditHelper: () => {}
  };
  vm.runInNewContext(auditSource, sandbox);
  return { result: sandbox.window.gridlyLP235AlertsPresentationCompletenessAudit(), sandbox };
}

test('LP235.4G owner audit object-identity names are lexical and never globalized', () => {
  const audit = app.slice(app.indexOf('// LP235.4: passive presentation-completeness reconciliation'), app.indexOf('// LP235.4A:'));
  assert.match(audit, /const postGroupHasEvidenceRows = postGroup\?\.hasEvidenceRows === true;/);
  assert.match(audit, /postGroupAuditHasEvidenceRows: postGroupHasEvidenceRows/);
  for (const field of ['accumulatorHasEvidenceRows', 'mapStoredHasEvidenceRows', 'mapToArrayHasEvidenceRows', 'presentationModelHasEvidenceRows', 'functionReturnHasEvidenceRows']) {
    assert.match(audit, new RegExp(`${field}: (?:Boolean\\(trace\\.|presentation\\.hasEvidenceRows)`));
  }
  assert.doesNotMatch(audit, /window\.(?:postGroupAuditHasEvidenceRows|accumulatorHasEvidenceRows|mapStoredHasEvidenceRows|mapToArrayHasEvidenceRows|presentationModelHasEvidenceRows|functionReturnHasEvidenceRows)\s*=/);
  assert.doesNotMatch(audit, /\bpostGroupAuditHasEvidenceRows\s*[,}]/, 'owner audit must not use unresolved shorthand');
});

test('LP235.4G owner audit runs with checkpoint authority and summarizes identity', () => {
  const evidence = officialRow(1, 1);
  const presentation = group('presentation-1', ['canonical-1']);
  presentation.title = 'Construction';
  presentation.sourceKind = 'official_roadway';
  presentation.__gridlyGroupObjectIdentityTrace = {
    accumulator: { hasEvidenceRows: true, evidenceRowCount: 1 },
    mapStored: { hasEvidenceRows: true, evidenceRowCount: 1 },
    mapToArray: { hasEvidenceRows: true, evidenceRowCount: 1 },
    accumulatorIsMapStored: true, mapStoredIsMapToArray: true
  };
  const checkpoint = buildRealGroupsCooperative([evidence]);
  return checkpoint.then((built) => {
    const { result, sandbox } = runPresentationCompletenessAudit({
      alerts: [evidence], presentationModel: { alerts: [presentation] },
      groupedLineageStages: [{ stage: 'POST_GROUP_BUILD', representedCanonicalCount: 1, groups: [{ hasEvidenceRows: true, evidenceRowCount: 1 }] }]
    }, built.testCheckpointAuthority);
  assert.equal(result.groupObjectIdentityAuthorityAvailable, true);
  assert.equal(result.groupObjectIdentityAuthorityReason, null);
  assert.equal(result.groupObjectIdentityAudit.length, 1);
  assert.equal(result.groupObjectIdentityAudit[0].postGroupAuditHasEvidenceRows, true);
  assert.equal(Object.hasOwn(sandbox.window, 'postGroupAuditHasEvidenceRows'), false);
  });
});

test('LP235.4G owner audit runs without checkpoint authority and fails closed', () => {
  const { result, sandbox } = runPresentationCompletenessAudit(null);
  assert.equal(result.groupObjectIdentityAuthorityAvailable, false);
  assert.equal(result.groupObjectIdentityAuthorityReason, 'COOPERATIVE_GROUP_CHECKPOINT_NOT_PUBLISHED');
  assert.deepEqual(Array.from(result.groupObjectIdentityAudit), []);
  assert.equal(result.overallPass, false);
  assert.equal(Object.hasOwn(sandbox.window, 'postGroupAuditHasEvidenceRows'), false);
});

test('completeness audit publishes all passive grouped-lineage checkpoints', () => {
  const audit = app.slice(app.indexOf('window.gridlyLP235AlertsPresentationCompletenessAudit = function'), app.indexOf('// LP235.4A:'));
  for (const field of [
    'groupedLineageStageAudit', 'postGroupBuildRepresentedCanonicalCount', 'preRenderRepresentedCanonicalCount',
    'postNormalizationRepresentedCanonicalCount', 'completedRenderContextRepresentedCanonicalCount',
    'mappingBuilderInputRepresentedCanonicalCount', 'groupedLineageFirstLosingStage',
    'groupsMissingEvidenceRowsAtCompletedContext'
  ]) assert.match(audit, new RegExp(field));
  for (const field of ['groupObjectIdentityAudit', 'groupObjectIdentityFirstLosingStage', 'authoritativePostGroupCollectionName',
    'authoritativePostGroupRepresentedCanonicalCount', 'postGroupAuditObservationMatchesAuthority', 'postGroupBuildAuditReadsAuthoritativeGroupObjects']) {
    assert.match(audit, new RegExp(field));
  }
  assert.doesNotMatch(audit, /fetch\(|setTimeout|setInterval|querySelector|openGridlyPortraitV2Sheet/);
});

test('LP235.4I synchronous and cooperative builders publish bounded value-only checkpoint authorities', async () => {
  for (const model of [
    buildRealGroups([officialRow(1, 1), officialRow(2, 1), officialRow(3, 1)]),
    await buildRealGroupsCooperative([officialRow(1, 1), officialRow(2, 1), officialRow(3, 1)])
  ]) {
    const authority = model.testCheckpointAuthority;
    assert.ok(authority);
    assert.equal(authority.groupCount, 1);
    assert.equal(authority.writeCount, 6);
    assert.deepEqual(Array.from(authority.stagesWritten), ['ACCUMULATOR_GROUP_OBJECT','MAP_STORED_GROUP_OBJECT','MAP_TO_ARRAY_GROUP_OBJECT','PRESENTATION_MODEL_ROW','FUNCTION_RETURN_ROW','POST_GROUP_BUILD_AUDIT_ROW']);
    assert.ok(authority.records.every(record => record.evidenceRowCount === 3 && record.representedCanonicalIds.length === 3));
    assert.ok(authority.records.every(record => !Object.hasOwn(record, 'row') && !Object.hasOwn(record, 'group')));
  }
});

test('LP235.4I cooperative 26 to 12 authority observes all private and public identities', async () => {
  const model = await buildRealGroupsCooperative(Array.from({length:26}, (_, index) => officialRow(index + 1, (index % 12) + 1)));
  const authority = model.testCheckpointAuthority;
  assert.equal(authority.executionMode, 'COOPERATIVE');
  assert.equal(authority.groupCount, 12);
  for (const stage of ['MAP_TO_ARRAY_GROUP_OBJECT', 'PRESENTATION_MODEL_ROW']) {
    const records = authority.records.filter(record => record.stage === stage);
    assert.equal(records.length, 12);
    assert.equal(records.reduce((sum, record) => sum + record.evidenceRowCount, 0), 26);
    assert.equal(new Set(records.flatMap(record => record.representedCanonicalIds)).size, 26);
  }
});

test('LP235.4I audit distinguishes unavailable authority from explicitly observed empty collections', () => {
  const missing = runPresentationCompletenessAudit(null).result;
  assert.equal(missing.groupCheckpointAuthorityAvailable, false);
  assert.equal(missing.privateCheckpointIdentityCount, null);
  assert.equal(missing.publicCheckpointEvidenceRowCount, null);
  assert.equal(missing.correctedGroupObjectIdentityFirstLosingStage, null);
  assert.equal(missing.groupCheckpointRcaClassification, 'COOPERATIVE_BUILDER_NOT_ACTUALLY_INVOKED');
  const emptyAuthority = Object.freeze({ authorityName:'__gridlyAlertsGroupCheckpointAuthority', executionMode:'COOPERATIVE', builderFunctionName:'gridlyGetAlertsPresentationCountModelCooperative', groupingFunctionName:'gridlyAccumulateAlertPresentationGroup', accumulatorOwner:'groups Map', inputCount:0, groupCount:0, writeCount:0, stagesWritten:Object.freeze([]), records:Object.freeze([]) });
  const observed = runPresentationCompletenessAudit({ alerts:[], presentationModel:{ alerts:[] }, groupedLineageStages:[] }, emptyAuthority).result;
  assert.equal(observed.groupCheckpointAuthorityAvailable, true);
  assert.equal(observed.privateCheckpointIdentityCount, 0);
  assert.equal(observed.privateCheckpointEvidenceRowCount, 0);
});

test('LP235.4J builder entries certify actual synchronous and cooperative invocation', async () => {
  const synchronous = buildRealGroups([officialRow(1, 1)]).testRouteAuthority;
  const cooperative = (await buildRealGroupsCooperative([officialRow(1, 1)])).testRouteAuthority;
  assert.equal(synchronous.invokedBuilder, 'gridlyBuildGridlyAlertsPresentationCountModelSync');
  assert.equal(synchronous.executionMode, 'SYNCHRONOUS');
  assert.equal(cooperative.invokedBuilder, 'gridlyGetAlertsPresentationCountModelCooperative');
  assert.equal(cooperative.executionMode, 'COOPERATIVE');
  for (const route of [synchronous, cooperative]) {
    assert.equal(route.invocationCount, 1);
    assert.equal(route.reusedCachedModel, false);
    assert.equal(route.checkpointPublisherReached, true);
    assert.equal(route.checkpointAuthorityWritten, true);
    assert.equal(route.presentationOutputCount, 1);
  }
});

test('LP235.4J route contract keeps selection distinct and recognizes cache reuse without a build', () => {
  const routeBlock = app.slice(app.indexOf('function gridlyRecordAlertsPresentationBuilderRoute'), app.indexOf('\n  function gridlyPublishAlertsGroupCheckpointAuthority'));
  const sandbox = { globalThis: {}, performance: { now: () => 1 } };
  vm.runInNewContext(`${routeBlock}\nthis.recordRoute = gridlyRecordAlertsPresentationBuilderRoute;`, sandbox);
  sandbox.recordRoute(null, 'CACHED_REUSE', 26, { selectedBuilder:'gridlyGetAlertsPresentationCountModelCooperative' }, { entry:false, reuseAuthority:'completed render context', reuseReason:'UNCHANGED_GENERATION', presentationOutputCount:12 });
  const route = sandbox.globalThis.__gridlyAlertsPresentationBuilderRouteAuthority;
  assert.equal(route.selectedBuilder, 'gridlyGetAlertsPresentationCountModelCooperative');
  assert.equal(route.invokedBuilder, null);
  assert.equal(route.invocationCount, 0);
  assert.equal(route.executionMode, 'CACHED_REUSE');
  assert.equal(route.reusedCachedModel, true);
  assert.equal(route.checkpointAuthorityWritten, false);
});

test('LP235.4J cooperative generation cancellation exposes the exact pre-checkpoint bypass', async () => {
  const model = await buildRealGroupsCooperative([officialRow(1, 1)], { isCancelled: () => true });
  assert.equal(model.testRouteAuthority.executionMode, 'COOPERATIVE');
  assert.equal(model.testRouteAuthority.checkpointPublisherReached, false);
  assert.equal(model.testRouteAuthority.checkpointAuthorityWritten, false);
  assert.equal(model.testRouteAuthority.bypassStage, 'GENERATION_CANCELLED_DURING_SOURCE_ITERATION');
  assert.equal(model.testRouteAuthority.presentationOutputCount, 0);
});

test('LP235.4J runtime route authority is passive, bounded, and changes no product paths', () => {
  const routeSource = app.slice(app.indexOf('// LP235.4J:'), app.indexOf('\n  function gridlyPublishAlertsGroupCheckpointAuthority'));
  assert.doesNotMatch(routeSource, /fetch\(|setTimeout|setInterval|querySelector|openGridlyPortraitV2Sheet/);
  assert.doesNotMatch(app.slice(app.indexOf('async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync'), app.indexOf('function invokeMobileAlertsEntry')), /__gridlyAlertsPresentationBuilderRouteAuthority/);
  for (const forbidden of ['gridlyAccumulateAlertPresentationGroup(groups', 'gridlyBuildAlertCanonicalToPresentationMapping', 'RenderCompleteAlertCard', 'gridlyAlertSemanticContract']) {
    assert.doesNotMatch(routeSource, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
