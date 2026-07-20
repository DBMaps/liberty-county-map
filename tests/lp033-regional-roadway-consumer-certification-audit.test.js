const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/LP033-REGIONAL-ROADWAY-CONSUMER-CERTIFICATION.md', 'utf8');

assert(app.includes('function gridlyLp033RegionalRoadwayConsumerCertificationAudit'), 'LP033 passive audit function exists');
assert(app.includes('window.gridlyLp033RegionalRoadwayConsumerCertificationAudit = gridlyLp033RegionalRoadwayConsumerCertificationAudit;'), 'LP033 browser audit is exposed');
[
  'activeCountyId',
  'activeCommunity',
  'roadwayRuntimeClassification',
  'roadwayLoadStatus',
  'activeRoadwayFeatureCount',
  'roadwayDatasetOwner',
  'partitionRuntimeActive',
  'activePackageIds',
  'countyContainmentPass',
  'libertyFallbackDetected',
  'staleCountyGeometryDetected',
  'roadContextResolverAvailable',
  'primaryRoadAvailable',
  'secondaryRoadAvailable',
  'intersectionAvailable',
  'communityLocationPipelineConnected',
  'crossingLocationPipelineConnected',
  'officialLocationPipelineConnected',
  'alertsConsumerConnected',
  'popupConsumerConnected',
  'travelBriefConsumerConnected',
  'awarenessConsumerConnected',
  'providerDescriptionOwnershipSafe',
  'technicalMetadataDetected',
  'representativeFindings',
  'firstDisconnectedStage',
  'recommendedNextAction',
  'certificationStatus'
].forEach((field) => assert(app.includes(field), `LP033 audit reports ${field}`));
assert(app.includes('investigation_unverified_or_disconnected'), 'LP033 audit can report unverified/disconnected instead of invented PASS');
assert(app.includes('slice(0, 250)'), 'LP033 containment sampling remains bounded');
assert(doc.includes('not fully certified'), 'LP033 documentation avoids over-certifying consumer integration');
assert(doc.includes('secondary-road/intersection proof after coordinate road-context resolution'), 'LP033 documentation identifies first disconnected/detail-loss stage');
assert(doc.includes('Harris → Liberty → Jefferson → Harris'), 'LP033 documentation covers county-switch scenario');
console.log('LP033 regional roadway consumer certification audit checks passed.');
