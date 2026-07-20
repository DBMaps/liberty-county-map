const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const auditStart = source.indexOf('function gridlyLp034ConsumerRoadContextAudit');
const auditEnd = source.indexOf('if (typeof exposeGridlyAuditHelper === "function") exposeGridlyAuditHelper("gridlyLp034ConsumerRoadContextAudit"', auditStart);
const auditBody = source.slice(auditStart, auditEnd);

assert(auditBody.includes('sampleStatus = "no_live_location_sample_observed"'), 'no observed live sample has an explicit sample status');
assert(auditBody.includes('firstDetailLossStage: firstLoss?.[0] || null'), 'no observed live sample does not become nearestRoad detail loss');
assert(auditBody.includes('resolver_completed_no_road_match'), 'resolver completed without match is distinct from no observation');
assert(auditBody.includes('structuredMetadataObserved'), 'structured metadata observation is surfaced');
assert(auditBody.includes('normalizedReportObserved'), 'normalized road context observation is surfaced');
assert(auditBody.includes('canonicalIncidentObserved'), 'canonical road context observation is surfaced');
assert(auditBody.includes('renderedConsumerObserved'), 'consumer rendered observation is surfaced');
assert(auditBody.includes('observedPrimaryRoad'), 'observed primary road field is returned');
assert(auditBody.includes('observedSecondaryRoad'), 'observed secondary road field is returned');
assert(auditBody.includes('observedIntersection'), 'observed intersection field is returned');
assert(auditBody.includes('observedCanonicalRoadContext'), 'observed canonical road context is returned');
assert(auditBody.includes('observedNormalizedRoadContext'), 'observed normalized road context is returned');
assert(auditBody.includes('observedCanonicalLocation'), 'observed canonical location is returned');
assert(auditBody.includes('observedRenderedLocation'), 'observed rendered location is returned');

assert(source.includes('gridlyLp034RoadContextAuditObservationState'), 'LP034R1 stores audit-only runtime observations');
assert(source.includes('gridlyLp034CaptureAuditObservation("resolverResults"'), 'resolver observations are captured from real context resolution');
assert(source.includes('gridlyLp034CaptureNormalizedReportObservation(normalized)'), 'normalized report observations are captured from normalizeReports');
assert(source.includes('gridlyLp034CaptureAuditObservation("renderedConsumerLocations"'), 'rendered consumer observations are captured without changing presentation');

const lp033Start = source.indexOf('function gridlyLp033RegionalRoadwayConsumerCertificationAudit');
const lp033End = source.indexOf('if (typeof exposeGridlyAuditHelper === "function") exposeGridlyAuditHelper("gridlyLp033RegionalRoadwayConsumerCertificationAudit"', lp033Start);
const lp033Body = source.slice(lp033Start, lp033End);
assert(lp033Body.includes('containmentCanUseBounds'), 'containment requires a verified bounds contract');
assert(lp033Body.includes(': null'), 'containment uncertainty can remain null instead of false');
assert(!auditBody.includes('["nearestRoad", Boolean(nearestRoad)]'), 'LP034R1 audit no longer treats missing passive nearestRoad probe as downstream loss');

const normalizeStart = source.indexOf('function normalizeReports');
const normalizeEnd = source.indexOf('function populateCrossingSelect', normalizeStart);
const normalizeBody = source.slice(normalizeStart, normalizeEnd);
assert(normalizeBody.includes('primaryRoad: metadataPrimaryRoad'), 'original LP034 primary-road normalization repair remains intact');
assert(normalizeBody.includes('secondaryRoad: metadataSecondaryRoad'), 'original LP034 secondary-road normalization repair remains intact');
assert(normalizeBody.includes('canonicalRoadContext: structuredRoadContext'), 'original LP034 canonical road context repair remains intact');

const officialStart = source.indexOf('function gridlyLp023OfficialLocationAdapter');
const officialEnd = source.indexOf('function gridlyLp023AdapterType', officialStart);
const officialBody = source.slice(officialStart, officialEnd);
assert(officialBody.includes('let label = roadwayLabel || providerGeo || ""'), 'DriveTexas roadway-preference repair remains intact');
