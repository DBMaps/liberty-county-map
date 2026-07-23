(function attachHistoryIdentity(globalScope) {
  'use strict';

  const IDENTITY_VERSION = 'historical_identity_v1';
  const LOCATION_STRENGTH = Object.freeze({ certified: 'certified', structured: 'structured', approximate: 'approximate', insufficient: 'insufficient' });
  const CONDITION_WINDOWS = Object.freeze({
    'rail-crossing-obstruction': 120,
    'disabled-vehicle': 120,
    livestock: 120,
    debris: 120,
    crash: 120,
    flooding: 360,
    'lane-closure': 360,
    'road-closure': 360,
    construction: 1440,
    'other-hazard': 120
  });

  function freeze(value) { try { return Object.freeze(value); } catch (error) { return value; } }
  function token(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const normalized = String(value).trim().toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\b(u\.?s\.?|us)[\s.-]*(\d+)\b/g, 'us-$2')
      .replace(/\b(f\.?m\.?|fm)[\s.-]*(\d+)\b/g, 'fm-$2')
      .replace(/\b(i|ih|interstate)[\s.-]*(\d+)\b/g, 'i-$2')
      .replace(/\b(tx|sh|state highway)[\s.-]*(\d+)\b/g, 'tx-$2')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized || null;
  }
  function normalizeHistoricalIdentityToken(value) { return token(value); }
  function isCrossing(report) { return Boolean(report?.crossingId) || /crossing|rail/.test(`${report?.reportType || ''} ${report?.category || ''}`.toLowerCase()); }
  function lifecycle(eventType, report) {
    const raw = token(report?.lifecycle || report?.reportState || eventType) || '';
    if (/clear|cleared|resolved/.test(raw) || eventType === 'report_cleared') return 'clear';
    if (/active|blocked|created|open|reported/.test(raw) || eventType === 'report_created') return 'active';
    return 'unknown';
  }
  function deriveHistoricalConditionFamily(report, context) {
    const eventType = context?.eventType || '';
    if (isCrossing(report)) return 'rail-crossing-obstruction';
    const life = lifecycle(eventType, report);
    const raw = token(report?.category || report?.subtype || report?.reportType);
    if (!raw || (life === 'clear' && /hazard|road|report|clear|cleared/.test(raw))) return 'unknown';
    if (/flood|water/.test(raw)) return 'flooding';
    if (/construct|work-zone|road-work/.test(raw)) return 'construction';
    if (/disabled|stalled|vehicle/.test(raw)) return 'disabled-vehicle';
    if (/debris|object/.test(raw)) return 'debris';
    if (/livestock|animal|cattle/.test(raw)) return 'livestock';
    if (/road-closure|closed-road|closure|road-closed/.test(raw)) return 'road-closure';
    if (/lane-closure|closed-lane|lane-block/.test(raw)) return 'lane-closure';
    if (/crash|collision|accident|wreck/.test(raw)) return 'crash';
    if (/hazard|other/.test(raw)) return 'other-hazard';
    return raw;
  }
  function deriveHistoricalLocationKey(report) {
    const crossingId = token(report?.crossingId);
    if (crossingId) return freeze({ locationKey: `crossing:${crossingId}`, locationStrength: LOCATION_STRENGTH.certified });
    const county = token(report?.countyId); const state = token(report?.state); const scope = [state, county].filter(Boolean).join(':');
    const intersection = token(report?.intersection); const road = token(report?.roadName); const bucket = token(report?.locationBucket || report?.generalizedLocation?.bucket);
    if (intersection && scope) return freeze({ locationKey: `intersection:${scope}:${intersection}`, locationStrength: LOCATION_STRENGTH.structured });
    if (road && bucket && scope) return freeze({ locationKey: `road-bucket:${scope}:${road}:${bucket}`, locationStrength: LOCATION_STRENGTH.approximate });
    if (bucket && scope) return freeze({ locationKey: `geo-bucket:${scope}:${bucket}`, locationStrength: LOCATION_STRENGTH.approximate });
    if (bucket) return freeze({ locationKey: `geo-bucket:${bucket}`, locationStrength: LOCATION_STRENGTH.approximate });
    return freeze({ locationKey: null, locationStrength: LOCATION_STRENGTH.insufficient });
  }
  function hashString(input) { let hash = 2166136261; for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, '0'); }
  function stable(parts) { return parts.map((part) => part ?? '').join('|'); }
  function validMs(value) { const ms = Date.parse(value); return Number.isFinite(ms) ? ms : null; }
  function windowBucket(observedAt, minutes) { const ms = validMs(observedAt); if (ms === null || !minutes) return null; return Math.floor(ms / (minutes * 60000)); }
  function deriveHistoricalObservationKey(report, context) {
    const loc = context?.locationKey || deriveHistoricalLocationKey(report).locationKey;
    return `observation:${hashString(stable([IDENTITY_VERSION, context?.eventType, report?.id, report?.reportType, report?.category, context?.observedAt, loc, context?.lifecycleState, report?.source]))}`;
  }
  function deriveHistoricalRecurrenceKey(locationKey, conditionFamily) {
    if (!locationKey || !conditionFamily || conditionFamily === 'unknown') return null;
    return `recurrence:${hashString(stable([IDENTITY_VERSION, locationKey, conditionFamily]))}`;
  }
  function deriveHistoricalIncidentCandidateKey(locationKey, conditionFamily, observedAt) {
    const minutes = CONDITION_WINDOWS[conditionFamily] || null;
    const bucket = windowBucket(observedAt, minutes);
    if (!locationKey || !conditionFamily || conditionFamily === 'unknown' || bucket === null) return freeze({ incidentCandidateKey: null, candidateWindowMinutes: null, candidateTimeBucket: null });
    return freeze({ incidentCandidateKey: `incident-candidate:${hashString(stable([IDENTITY_VERSION, locationKey, conditionFamily, bucket]))}`, candidateWindowMinutes: minutes, candidateTimeBucket: bucket });
  }
  function buildPhase1AHistoricalIdentity(sanitizedReport, context) {
    try {
      const report = (sanitizedReport && typeof sanitizedReport === 'object') ? sanitizedReport : {};
      const eventType = context?.eventType || null; const observedAt = context?.observedAt || null;
      const loc = deriveHistoricalLocationKey(report); const conditionFamily = deriveHistoricalConditionFamily(report, { eventType }); const lifecycleState = lifecycle(eventType, report);
      const observationKey = deriveHistoricalObservationKey(report, { eventType, observedAt, locationKey: loc.locationKey, lifecycleState });
      const recurrenceKey = deriveHistoricalRecurrenceKey(loc.locationKey, conditionFamily);
      const candidate = deriveHistoricalIncidentCandidateKey(loc.locationKey, conditionFamily, observedAt);
      return freeze({ version: IDENTITY_VERSION, sourceReportId: typeof report.id === 'string' ? report.id : null, locationKey: loc.locationKey, locationStrength: loc.locationStrength, conditionFamily, lifecycleState, observationKey, incidentCandidateKey: candidate.incidentCandidateKey, recurrenceKey, candidateWindowMinutes: candidate.candidateWindowMinutes });
    } catch (error) {
      return freeze({ version: IDENTITY_VERSION, sourceReportId: null, locationKey: null, locationStrength: LOCATION_STRENGTH.insufficient, conditionFamily: 'unknown', lifecycleState: 'unknown', observationKey: null, incidentCandidateKey: null, recurrenceKey: null, candidateWindowMinutes: null });
    }
  }
  const api = freeze({ IDENTITY_VERSION, CONDITION_WINDOWS, normalizeHistoricalIdentityToken, deriveHistoricalConditionFamily, deriveHistoricalLocationKey, deriveHistoricalObservationKey, deriveHistoricalIncidentCandidateKey, deriveHistoricalRecurrenceKey, buildPhase1AHistoricalIdentity });
  globalScope.gridlyPassiveHistoryCaptureIdentity = api;
})(typeof window !== 'undefined' ? window : globalThis);
