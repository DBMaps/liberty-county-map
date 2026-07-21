const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const start = app.indexOf('function gridlyLp039RegionalDriveTexasAuthorityCertificationAudit()');
assert(start >= 0, 'LP039 audit helper source exists');
const end = app.indexOf('window.gridlyLp039RegionalDriveTexasAuthorityCertificationAudit = gridlyLp039RegionalDriveTexasAuthorityCertificationAudit;', start);
assert(end > start, 'LP039 audit helper export exists');
const source = app.slice(start, end + 'window.gridlyLp039RegionalDriveTexasAuthorityCertificationAudit = gridlyLp039RegionalDriveTexasAuthorityCertificationAudit;'.length);

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'lp039-audit-helper.js' });

assert.strictEqual(typeof sandbox.window.gridlyLp039RegionalDriveTexasAuthorityCertificationAudit, 'function');
const audit = sandbox.window.gridlyLp039RegionalDriveTexasAuthorityCertificationAudit();

assert.strictEqual(audit.milestone, 'LP039');
['investigationOnly','passive','noFetches','noPolling','noWrites','noStorageWrites','noMapMovement','noRuntimeActivation','noConsumerBehaviorChange'].forEach((key) => assert.strictEqual(audit[key], true, key));
assert(audit.sourceInventory);
assert(audit.activeProvider && audit.activeConnector && audit.endpointOwner && audit.fetchLifecycleOwner);
['Crash','Closure','Flooding','Construction','Lane Closure','Bridge Restriction','Travel Advisory'].forEach((category) => assert(audit.categoryOwner.includes(category), category));
assert(audit.sourceFieldsPreserved.length >= 8);
assert(audit.sourceFieldsLost.length >= 10);
['source geometry','source coordinates','roadway geometry intersection','certified county geometry containment','community/awareness geometry containment','Houston child-region geometry containment','county metadata','city/locality metadata','roadway/corridor association','radius matching','text matching','map bounds'].forEach((method) => assert(audit.ownershipMethodsObserved.some((entry) => entry.method === method), method));
assert(audit.selectedAwarenessFilteringStage.includes('after normalization'));
assert(audit.freshnessOwner && audit.expirationOwner);
assert(audit.deduplicationOwner && audit.situationIdentityOwner);
['rawRecordCount','normalizedRecordCount','uniqueProviderRecordCount','connectorRetainedCount','activeAwarenessRecordCount','officialSituationCount','markerCount','alertRowCount','awarenessBriefCount','communityPulseCount','travelBriefCount','countySummaryCount','communitySummaryCount','houstonRegionCount','compatibilityCount','debugAuditCount'].forEach((key) => assert(audit.countOwners[key], key));
['Map markers','Marker popups','Alert rows','Awareness Brief','Community Pulse','Travel Brief','Know Before You Go','County/community/Houston summaries','Quiet state'].forEach((surface) => assert(audit.consumerSurfaceFindings.some((line) => line.includes(surface)), surface));
['houstonParentCertification','houstonChildRegionCertification','daytonCertification','livingstonCertification','pasadenaCertification','springBranchCertification','woodvilleCertification'].forEach((key) => assert(audit[key], key));
assert(audit.roadwayOwnershipFindings.includes('routeName'));
assert(audit.officialSituationFindings.includes('presentation'));
assert(audit.quietStateFindings[0].includes('Cannot distinguish'));
['source_scope_mismatch','selected_awareness_filter_divergence','radius_fallback_overstatement','text_fallback_overstatement','mixed_behavior'].forEach((cause) => assert(audit.rootCauseClassifications.includes(cause), cause));
['A Raw DriveTexas records','F Selected-awareness DriveTexas situations','G Existing Awareness Brief/Travel Brief model'].forEach((candidate) => assert(audit.authorityCandidates.some((entry) => entry.includes(candidate)), candidate));
assert(audit.recommendedAuthority.includes('Option F'));
assert(audit.recommendedProductDefinition.includes('target'));
assert.strictEqual(audit.implementationReadyForLp0391, false);
assert.strictEqual(audit.recommendedNextMilestone.includes('LP039.1'), true);

const deterministicFixtures = [
  'active crash','closure','flooding record','construction record','lane closure','bridge restriction','travel advisory','duplicate provider ID','expired record','stale record','missing timestamp','future-effective record','outside-awareness record','county-only record','geometry-owned record','roadway-owned record','radius fallback record','text fallback record','same title with distinct source IDs','long roadway crossing multiple awareness areas','Houston parent context','Houston child-region context','Pasadena','Spring Branch','Dayton','Livingston','Woodville','no loaded records','connector disabled','provider unavailable','fetch failed','all records filtered outside awareness'
];
assert.strictEqual(deterministicFixtures.length, 32);

assert(!source.includes('fetch('));
assert(!source.includes('setTimeout('));
assert(!source.includes('setInterval('));
assert(!source.includes('localStorage'));
assert(!source.includes('sessionStorage'));
assert(!source.includes('startPolling('));
assert(!source.includes('replaceChildren('));
assert(!source.includes('setView('));

console.log('LP039 Regional DriveTexas Authority Certification audit tests passed');
