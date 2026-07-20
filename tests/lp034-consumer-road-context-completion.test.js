const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert(source.includes('function gridlyLp034ConsumerRoadContextAudit'), 'LP034 passive consumer road-context audit exists');
assert(source.includes('window.gridlyLp034ConsumerRoadContextAudit = gridlyLp034ConsumerRoadContextAudit'), 'LP034 browser audit is exposed');

const normalizeStart = source.indexOf('function normalizeReports');
const normalizeEnd = source.indexOf('function populateCrossingSelect', normalizeStart);
const normalizeBody = source.slice(normalizeStart, normalizeEnd);
assert(normalizeBody.includes('const structuredRoadContext = otherHazardMetadata?.canonicalRoadContext'), 'normalizeReports reads structured canonical road context');
assert(normalizeBody.includes('primaryRoad: metadataPrimaryRoad'), 'normalizeReports preserves primary road ownership');
assert(normalizeBody.includes('secondaryRoad: metadataSecondaryRoad'), 'normalizeReports preserves secondary road ownership');
assert(normalizeBody.includes('canonicalRoadContext: structuredRoadContext'), 'normalizeReports persists canonical road context for canonical incidents and consumer adapters');

const officialStart = source.indexOf('function gridlyLp023OfficialLocationAdapter');
const officialEnd = source.indexOf('function gridlyLp023AdapterType', officialStart);
const officialBody = source.slice(officialStart, officialEnd);
assert(officialBody.indexOf('const roadContext = gridlyLp025ResolveAuthoritativeRoadContext') < officialBody.indexOf('const roadwayLabel = roadContext.resolvedIntersection'), 'official adapter resolves roadway context before choosing display label');
assert(officialBody.includes('let label = roadwayLabel || providerGeo || ""'), 'official adapter prefers roadway-derived location over provider prose when available');
assert(officialBody.includes('providerLocationDemotedByRoadContext'), 'official adapter records provider prose demotion for audit safety');

const auditBody = source.slice(source.indexOf('function gridlyLp034ConsumerRoadContextAudit'), source.indexOf('if (typeof exposeGridlyAuditHelper === "function") exposeGridlyAuditHelper("gridlyLp034ConsumerRoadContextAudit"'));
[
  'structuredMetadataOwnership',
  'normalizedOwnership',
  'canonicalOwnership',
  'alertOwnership',
  'popupOwnership',
  'travelBriefOwnership',
  'awarenessOwnership',
  'firstDetailLossStage',
  'providerOwnershipSafe',
  'crossingOwnershipSafe',
  'countyContainmentPass',
  'certificationStatus'
].forEach((field) => assert(auditBody.includes(field), `LP034 audit reports ${field}`));

const doc = fs.readFileSync('docs/LP034-CONSUMER-ROAD-CONTEXT-COMPLETION.md', 'utf8');
assert(doc.includes('Structured Metadata → Normalized Report'), 'LP034 documentation records repaired structured-to-normalized boundary');
assert(doc.includes('DriveTexas provider prose'), 'LP034 documentation covers DriveTexas provider ownership');
assert(doc.includes('Recommended next milestone'), 'LP034 documentation recommends next milestone');
