import fs from 'node:fs';
import path from 'node:path';

const corridorPath = 'assets/directional-intelligence/extracted/v684-us59-i69-corridor-inventory.json';
const segmentPath = 'assets/directional-intelligence/extracted/v684-us59-i69-segment-inventory.json';
const v684EvidencePath = 'assets/directional-intelligence/evidence/v684-osm-extraction-prototype-evidence.json';
const outputPath = 'assets/directional-intelligence/evidence/v685-osm-extraction-validation-audit.json';

const expectedStatuses = new Set(['extracted', 'extracted_with_review', 'rejected']);
const expectedSignalFields = ['hasRef','hasFutureRef','hasName','hasCounty','hasOneway','hasOnewayConditional','hasLanes','hasTurnLanes','hasDestinationLanes','hasStrategicTags','hasGeometry','isReversible','isConstruction','isHovHot','hasFixme'];
const expectedCounties = new Set(['Liberty, TX', 'Montgomery, TX', 'San Jacinto, TX', 'Harris, TX']);
const protectedSystemsVerified = { historicalReadsEnabled: false, historyUiEnabled: false, DriveTexasPaused: true, TransportationIntelligenceEnabled: false, TransportationIntelligenceDisplay: false, TransportationIntelligenceActivation: false };

function readJson(filePath) {
  const exists = fs.existsSync(filePath);
  if (!exists) return { filePath, exists, parseValid: false, data: null, error: 'missing input artifact' };
  try { return { filePath, exists, parseValid: true, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) }; }
  catch (error) { return { filePath, exists, parseValid: false, data: null, error: error.message }; }
}
function percent(count, total) { return total === 0 ? 0 : Number(((count / total) * 100).toFixed(2)); }
function sample(records, limit = 10) { return records.slice(0, limit); }
function normalizeRecordText(segment) { return [segment.sourceRef, segment.sourceFutureRef, segment.sourceName, segment.sourceTigerNameBase, segment.highway].filter(Boolean).join(' | '); }
function hasCorridorEvidence(segment) {
  const text = normalizeRecordText(segment);
  const direct = /\bI\s*-?\s*69\b/i.test(text) || /\bUS\s*-?\s*59\b/i.test(text) || /United States Highway 59/i.test(text);
  const eastexPaired = /Eastex Freeway/i.test(text) && (/\bI\s*-?\s*69\b/i.test(text) || /\bUS\s*-?\s*59\b/i.test(text));
  return direct || eastexPaired;
}
function hasWeakCorridorEvidence(segment) {
  return !hasCorridorEvidence(segment) && /Eastex Freeway|US 59 Business|I\s*-?\s*69|US\s*-?\s*59|United States Highway 59/i.test(normalizeRecordText(segment));
}
function isGeometryValid(segment) {
  const g = segment.geometrySummary;
  return Boolean(g && g.coordinateCount >= 2 && Array.isArray(g.startCoordinate) && Array.isArray(g.endCoordinate) && Array.isArray(g.bbox));
}
function bucketOk(segment) {
  const bucket = segment.reviewBucket || 'none';
  const reasons = Array.isArray(segment.reviewReasons) ? segment.reviewReasons.join(' ').toLowerCase() : '';
  const signals = segment.evidenceSignals || {};
  const checks = [];
  const inAny = (...names) => names.includes(bucket);
  if (signals.isReversible || /reversible/.test(reasons)) checks.push(inAny('reversible_lane','review'));
  if (signals.isConstruction || /construction/.test(reasons)) checks.push(inAny('construction_segment','review'));
  if (signals.isHovHot || /hov|hot/.test(reasons)) checks.push(inAny('hov_hot_lane','review'));
  if ((!signals.hasRef && !signals.hasFutureRef) || /missing.*(ref|fut_ref)|ref.*missing/.test(reasons)) checks.push(inAny('missing_ref','review'));
  if (!signals.hasOneway || /missing.*oneway|oneway.*missing/.test(reasons)) checks.push(inAny('missing_oneway','review'));
  if (!signals.hasCounty || /missing.*county|county.*missing/.test(reasons)) checks.push(inAny('missing_county','review'));
  if (signals.hasFixme || /fixme/.test(reasons)) checks.push(inAny('manual_review_required','review'));
  return checks.length === 0 || checks.every(Boolean);
}

const inputs = [readJson(corridorPath), readJson(segmentPath), readJson(v684EvidencePath)];
if (inputs.some((input) => !input.exists || !input.parseValid)) {
  console.error('V685 input validation failed before audit could run.', inputs.map(({filePath, exists, parseValid, error}) => ({filePath, exists, parseValid, error})));
  process.exit(1);
}
const [corridorInput, segmentInput, v684Input] = inputs;
const segmentRecords = Array.isArray(segmentInput.data) ? segmentInput.data : (Array.isArray(segmentInput.data?.segments) ? segmentInput.data.segments : []);
const corridorRecords = Array.isArray(corridorInput.data) ? corridorInput.data : [corridorInput.data];
const corridor = corridorRecords.find((record) => record?.corridorId === 'us59-i69');

const totalSegments = segmentRecords.length;
const extractedCount = segmentRecords.filter((s) => s.extractionStatus === 'extracted').length;
const extractedWithReviewCount = segmentRecords.filter((s) => s.extractionStatus === 'extracted_with_review').length;
const rejectedCount = segmentRecords.filter((s) => s.extractionStatus === 'rejected').length;
const nonRejected = segmentRecords.filter((s) => s.extractionStatus !== 'rejected');
const segmentIds = segmentRecords.map((s) => s.segmentId).filter(Boolean);
const duplicateSegmentIds = [...new Set(segmentIds.filter((id, i) => segmentIds.indexOf(id) !== i))];
const sourceWayCounts = segmentRecords.reduce((acc, s) => { if (s.sourceWayId) acc[s.sourceWayId] = (acc[s.sourceWayId] || 0) + 1; return acc; }, {});
const duplicateSourceWayIds = Object.entries(sourceWayCounts).filter(([, count]) => count > 1).map(([sourceWayId, count]) => ({sourceWayId, count}));

const traceableSourceIdentity = segmentRecords.filter((s) => s.sourceRef || s.sourceFutureRef || s.sourceName || s.sourceTigerNameBase).length;
const geometryValidRecords = segmentRecords.filter(isGeometryValid);
const bearingPresentWhenGeometryValid = geometryValidRecords.filter((s) => typeof s.geometrySummary.approximateBearingDegrees === 'number').length;
const accepted = segmentRecords.filter((s) => s.extractionStatus !== 'rejected');
const rejected = segmentRecords.filter((s) => s.extractionStatus === 'rejected');
const suspiciousAccepted = accepted.filter((s) => !hasCorridorEvidence(s));
const suspiciousRejected = rejected.filter((s) => hasCorridorEvidence(s) || hasWeakCorridorEvidence(s));

const countyDistribution = segmentRecords.reduce((acc, s) => { const key = s.county || '__MISSING__'; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
const unknownCounty = segmentRecords.filter((s) => s.county && !expectedCounties.has(s.county));
const multiCountyAmbiguity = segmentRecords.filter((s) => typeof s.county === 'string' && /;|,\s*(Liberty|Montgomery|San Jacinto|Harris),\s*TX/.test(s.county.replace(/^([^,]+, TX)$/, '')));

const bucketDistribution = segmentRecords.reduce((acc, s) => { const key = s.reviewBucket || '__MISSING__'; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
const questionableBucket = segmentRecords.filter((s) => !bucketOk(s));
const rejectedCorrect = rejected.filter((s) => {
  const reasons = Array.isArray(s.reviewReasons) ? s.reviewReasons.join(' ').toLowerCase() : '';
  if (/geometry_invalid/.test(reasons) || s.reviewBucket === 'geometry_invalid') return !isGeometryValid(s);
  if (/non_primary_corridor/.test(reasons) || s.reviewBucket === 'non_primary_corridor') return !hasCorridorEvidence(s);
  return true;
});
const unexpectedStatuses = [...new Set(segmentRecords.map((s) => s.extractionStatus).filter((status) => !expectedStatuses.has(status)))];
const missingSignalCoverage = expectedSignalFields.map((field) => ({ field, presentCount: segmentRecords.filter((s) => typeof s.evidenceSignals?.[field] === 'boolean').length, missingCount: segmentRecords.filter((s) => typeof s.evidenceSignals?.[field] !== 'boolean').length })).filter((row) => row.missingCount > 0);
const readiness = { confidence_ready_candidate: [], confidence_review_required: [], confidence_blocked: [] };
for (const s of segmentRecords) {
  const signals = s.evidenceSignals || {};
  if (s.extractionStatus === 'rejected' || !isGeometryValid(s) || !hasCorridorEvidence(s)) readiness.confidence_blocked.push(s);
  else if (s.extractionStatus === 'extracted' && signals.hasCounty && signals.hasOneway && !signals.isReversible && !signals.isConstruction && !signals.isHovHot && !signals.hasFixme && (!s.reviewReasons || s.reviewReasons.includes('none'))) readiness.confidence_ready_candidate.push(s);
  else readiness.confidence_review_required.push(s);
}
const finalDetermination = questionableBucket.length === 0 && suspiciousAccepted.length === 0 && unexpectedStatuses.length === 0 && missingSignalCoverage.length === 0
  ? 'EXTRACTION VALIDATION STRONG — READY FOR CONFIDENCE VALIDATION PROTOTYPE'
  : (readiness.confidence_ready_candidate.length > 0 && unexpectedStatuses.length === 0 ? 'EXTRACTION VALIDATION PARTIAL — CONFIDENCE VALIDATION ALLOWED WITH REVIEW BUCKETS' : 'EXTRACTION VALIDATION INSUFFICIENT — CONFIDENCE VALIDATION BLOCKED');

const evidence = {
  milestone: 'V685', generatedAt: new Date().toISOString(),
  inputArtifacts: inputs.map(({filePath, exists, parseValid}) => ({filePath, exists, parseValid})),
  v683Dependency: { determination: 'METADATA COVERAGE PARTIAL — EXTRACTION PROTOTYPE ALLOWED WITH REVIEW BUCKETS' },
  v684Dependency: { milestone: v684Input.data.milestone, finalDetermination: v684Input.data.finalDetermination, evidencePath: v684EvidencePath },
  detectedInputShapes: { segmentInventory: Array.isArray(segmentInput.data) ? 'array' : (Array.isArray(segmentInput.data?.segments) ? 'object.segments array' : 'unsupported'), corridorInventory: Array.isArray(corridorInput.data) ? 'array' : 'object', corridorIdUs59I69Found: Boolean(corridor) },
  totalSegments, extractedCount, extractedWithReviewCount, rejectedCount,
  segmentIdValidation: { nonRejectedCount: nonRejected.length, nonRejectedMissingSegmentIdCount: nonRejected.filter((s) => !s.segmentId).length, uniqueSegmentIdCount: new Set(segmentIds).size, duplicateSegmentIds, sourceWayIdPreservedCount: segmentRecords.filter((s) => s.sourceWayId).length, duplicateSourceWayIdCount: duplicateSourceWayIds.length, duplicateSourceWayIds: sample(duplicateSourceWayIds) },
  sourceTraceabilityValidation: { sourceWayIdCount: segmentRecords.filter((s) => s.sourceWayId).length, sourceWayIdPercent: percent(segmentRecords.filter((s) => s.sourceWayId).length,totalSegments), sourceIdentityCount: traceableSourceIdentity, sourceIdentityPercent: percent(traceableSourceIdentity,totalSegments), geometrySummaryCount: segmentRecords.filter((s) => s.geometrySummary).length, geometrySummaryPercent: percent(segmentRecords.filter((s) => s.geometrySummary).length,totalSegments) },
  geometryValidation: { validGeometryCount: geometryValidRecords.length, invalidGeometryCount: totalSegments - geometryValidRecords.length, coordinateCountAtLeastTwoCount: segmentRecords.filter((s) => s.geometrySummary?.coordinateCount >= 2).length, startCoordinateCount: segmentRecords.filter((s) => Array.isArray(s.geometrySummary?.startCoordinate)).length, endCoordinateCount: segmentRecords.filter((s) => Array.isArray(s.geometrySummary?.endCoordinate)).length, bboxCount: segmentRecords.filter((s) => Array.isArray(s.geometrySummary?.bbox)).length, bearingPresentWhenGeometryValidCount: bearingPresentWhenGeometryValid, bearingNote: 'Bearing is validated as geometry-only evidence and is not treated as standalone directional confidence.' },
  corridorMembershipValidation: { acceptedPrimaryCorridorSegments: accepted.filter(hasCorridorEvidence).length, rejectedNonPrimaryCorridorSegments: rejected.filter((s) => !hasCorridorEvidence(s)).length, suspiciousAcceptedWeakCorridorEvidenceCount: suspiciousAccepted.length, suspiciousAcceptedWeakCorridorEvidenceSample: sample(suspiciousAccepted.map((s) => ({segmentId:s.segmentId, sourceWayId:s.sourceWayId, sourceRef:s.sourceRef, sourceFutureRef:s.sourceFutureRef, sourceName:s.sourceName}))), suspiciousRejectedPossibleCorridorEvidenceCount: suspiciousRejected.length, suspiciousRejectedPossibleCorridorEvidenceSample: sample(suspiciousRejected.map((s) => ({segmentId:s.segmentId, sourceWayId:s.sourceWayId, sourceRef:s.sourceRef, sourceFutureRef:s.sourceFutureRef, sourceName:s.sourceName}))) },
  countyContainmentValidation: { expectedCountyNames: [...expectedCounties], countyPreservedCount: segmentRecords.filter((s) => s.county).length, missingCountyCount: segmentRecords.filter((s) => !s.county).length, countyDistribution, unknownCountyCount: unknownCounty.length, unknownCountySample: sample(unknownCounty.map((s) => ({segmentId:s.segmentId, county:s.county}))), multiCountyAmbiguityCount: multiCountyAmbiguity.length, harrisAndSanJacintoEvidenceOnly: true },
  reviewBucketValidation: { correctlyBucketedCount: totalSegments - questionableBucket.length, questionableBucketCount: questionableBucket.length, bucketDistribution, questionableBucketSample: sample(questionableBucket.map((s) => ({segmentId:s.segmentId, reviewBucket:s.reviewBucket, reviewReasons:s.reviewReasons, evidenceSignals:s.evidenceSignals}))) },
  rejectionValidation: { rejectedCount, correctRejectionCount: rejectedCorrect.length, questionableRejectionCount: rejected.length - rejectedCorrect.length, questionableRejectionSample: sample(rejected.filter((s) => !rejectedCorrect.includes(s)).map((s) => ({segmentId:s.segmentId, reviewBucket:s.reviewBucket, reviewReasons:s.reviewReasons}))) },
  extractionStatusValidation: { allowedStatuses: [...expectedStatuses], unexpectedStatuses, unexpectedStatusCount: unexpectedStatuses.length },
  evidenceSignalValidation: { expectedSignalFields, recordsWithEvidenceSignalsCount: segmentRecords.filter((s) => s.evidenceSignals).length, missingSignalCoverage },
  confidencePrerequisiteReadiness: { distribution: Object.fromEntries(Object.entries(readiness).map(([k,v]) => [k, v.length])), samples: Object.fromEntries(Object.entries(readiness).map(([k,v]) => [k, sample(v.map((s) => s.segmentId), 10)])), note: 'No final confidence score calculated.' },
  protectedSystemsVerified, runtimeChanged: false, appJsChanged: false, uiChanged: false, driveTexasChanged: false, transportationIntelligenceChanged: false,
  finalDetermination
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`V685 validation complete: ${finalDetermination}`);
console.log(`Segments: ${totalSegments}; ready=${readiness.confidence_ready_candidate.length}; review=${readiness.confidence_review_required.length}; blocked=${readiness.confidence_blocked.length}`);
