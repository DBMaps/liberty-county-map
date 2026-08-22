(function gridlyGovernedAwarenessModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GridlyGovernedAwareness = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGridlyGovernedAwarenessApi() {
  "use strict";

  const VERSION = "LP219.2B-visible-incident-identity-rca-v5";
  const SURFACES = Object.freeze(["locationContext", "communityPulse", "alerts", "kbygCommunity", "kbygOfficialRoadways", "map", "popup"]);
  const COMMUNITY_POLICY = Object.freeze({
    blocked_crossing: { locationContext: true, communityPulse: true, alerts: null, kbygCommunity: null, kbygOfficialRoadways: false, map: true, popup: true },
    rail_crossing_issue: { locationContext: true, communityPulse: true, alerts: null, kbygCommunity: null, kbygOfficialRoadways: false, map: true, popup: true },
    disabled_vehicle: { locationContext: false, communityPulse: false, alerts: null, kbygCommunity: null, kbygOfficialRoadways: false, map: true, popup: true },
    flooded_road: { locationContext: true, communityPulse: true, alerts: null, kbygCommunity: null, kbygOfficialRoadways: false, map: true, popup: true },
    closed_road: { locationContext: true, communityPulse: true, alerts: null, kbygCommunity: null, kbygOfficialRoadways: false, map: true, popup: true }
  });
  const OFFICIAL_POLICY = Object.freeze(Object.fromEntries([
    "flooding", "lane_closure", "road_closure", "bridge_restriction", "travel_advisory", "debris"
  ].map((subtype) => [subtype, Object.freeze({ locationContext: true, communityPulse: true, alerts: true, kbygCommunity: false, kbygOfficialRoadways: true, map: true, popup: true })])));
  const GENERATED_POLICY = Object.freeze({ locationContext: true, communityPulse: true, alerts: true, kbygCommunity: true, kbygOfficialRoadways: false, map: true, popup: true });
  const HAZARD_POLICY = Object.freeze({ locationContext: true, communityPulse: true, alerts: true, kbygCommunity: true, kbygOfficialRoadways: false, map: true, popup: true });

  const text = (value) => String(value ?? "").trim();
  const slug = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  function subtypeOf(record = {}) {
    const raw = slug(record.subtype || record.classification || record.report_type || record.reportType || record.type || record.condition || record.category || "unknown");
    const aliases = {
      blocked: "blocked_crossing", rail_blocked: "blocked_crossing", crossing_blocked: "blocked_crossing",
      crossing_issue: "rail_crossing_issue", rail_issue: "rail_crossing_issue",
      disabled: "disabled_vehicle", vehicle_disabled: "disabled_vehicle", stalled_vehicle: "disabled_vehicle",
      flooding: "flooded_road", flooded: "flooded_road", road_flooding: "flooded_road",
      closure: "closed_road", road_closed: "closed_road"
    };
    return aliases[raw] || raw;
  }
  function sourceKindOf(record = {}) {
    const explicit = slug(record.sourceKind || record.evidenceKind);
    if (explicit) return explicit;
    const source = slug(record.provider || record.source || record.sourceId);
    const type = subtypeOf(record);
    if (/drivetexas|txdot|official/.test(source) || record.official === true) return "official_roadway";
    if (/generated/.test(source) || /^road[-_]/.test(text(record.incidentId || record.id))) return "generated_road_incident";
    if (/hazard/.test(source) || record.reportKind === "hazard") return "active_hazard";
    if (COMMUNITY_POLICY[type] || /user|community|report/.test(source)) return "community_report";
    return "consumer_only_projection";
  }
  function identity(record = {}, sourceKind = sourceKindOf(record), subtype = subtypeOf(record)) {
    const governedId = text(record.evidenceId || record.providerRecordId || record.reportId || record.report_id || record.incidentId || record.crossingReportId || record.id || record.sourceId);
    if (governedId) return `${sourceKind}:${governedId}`;
    const lat = Number(record.lat ?? record.latitude ?? record.coordinates?.lat);
    const lng = Number(record.lng ?? record.lon ?? record.longitude ?? record.coordinates?.lng);
    const observed = text(record.observedAt || record.updatedAt || record.updated_at || record.createdAt || record.created_at || record.timestamp);
    if (Number.isFinite(lat) && Number.isFinite(lng) && observed) return `${sourceKind}:fallback:${subtype}:${lat.toFixed(5)},${lng.toFixed(5)}:${observed}`;
    return "";
  }
  function policyFor(sourceKind, subtype) {
    if (sourceKind === "official_roadway") return OFFICIAL_POLICY[subtype] || OFFICIAL_POLICY.debris;
    if (sourceKind === "generated_road_incident") return GENERATED_POLICY;
    if (sourceKind === "active_hazard") return HAZARD_POLICY;
    if (sourceKind === "community_report") return COMMUNITY_POLICY[subtype] || Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, surface === "map" || surface === "popup" ? true : null])));
    return Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, false])));
  }
  function isCurrent(record = {}, nowMs = Date.now()) {
    const state = slug(record.freshness || record.currentState || record.lifecycleState || record.status || "current");
    if (["stale", "expired", "cleared", "inactive", "historical", "recently_cleared"].includes(state) || record.expired === true) return false;
    const expires = Date.parse(record.expiresAt || record.expires_at || "");
    return !Number.isFinite(expires) || expires > nowMs;
  }
  function lifecycle(record = {}, subtype = subtypeOf(record), nowMs = Date.now()) {
    const current = isCurrent(record, nowMs);
    const explicitlyCleared = subtype === "cleared" || [record.lifecycleState, record.status, record.state].some((value) => /^(?:cleared|recently[_ -]?cleared)$/i.test(text(value)));
    return Object.freeze({
      current,
      active: current && !explicitlyCleared && record.active !== false,
      classification: explicitlyCleared ? "CURRENT_HISTORY_INACTIVE_CLEARED" : (current && record.active !== false ? "CURRENT_ACTIVE" : "STALE_OR_INACTIVE"),
      retainedForHistory: explicitlyCleared,
      reason: explicitlyCleared ? "Cleared is retained lifecycle evidence, not an active condition." : (current ? "Current lifecycle record is active." : "Record is stale or inactive.")
    });
  }
  function omission(policyValue, current, geographic, published) {
    if (published) return "PUBLISHED";
    if (!current) return "STALE_OR_INACTIVE";
    if (!geographic) return "GEOGRAPHICALLY_INELIGIBLE";
    if (policyValue === false) return "EXPECTED_BY_DESIGN";
    if (policyValue === null) return "PRODUCT_CONTRACT_UNDEFINED";
    return "PROPAGATION_FAILURE";
  }
  function buildSnapshot(input = {}) {
    const nowMs = Number.isFinite(Number(input.nowMs)) ? Number(input.nowMs) : Date.now();
    const generation = Number(input.evidenceGeneration ?? input.transitionGeneration ?? 0) || 0;
    const previousGeneration = Number(input.previousSnapshot?.evidenceGeneration ?? -1);
    if (input.previousSnapshot && generation < previousGeneration) return Object.freeze({ ...input.previousSnapshot, rejectedGeneration: generation, updateReason: "OLDER_GENERATION_REJECTED" });
    const actual = input.actual || {};
    const consumerItems = Object.fromEntries(SURFACES.map((surface) => [surface, Array.isArray(actual[surface]) ? actual[surface] : []]));
    const itemIds = (item) => {
      if (typeof item === "string" || typeof item === "number") return [text(item)];
      const kind = sourceKindOf(item || {}); const subtype = subtypeOf(item || {});
      return [identity(item || {}, kind, subtype), item?.evidenceId, item?.id, item?.reportId, item?.incidentId, item?.providerRecordId].map(text).filter(Boolean);
    };
    const actualSets = Object.fromEntries(SURFACES.map((surface) => [surface, new Set(consumerItems[surface].flatMap(itemIds))]));
    const seen = new Set();
    const duplicates = [];
    const evidence = [];
    for (const record of Array.isArray(input.records) ? input.records : []) {
      const sourceKind = sourceKindOf(record);
      let subtype = subtypeOf(record);
      if (sourceKind === "official_roadway" && subtype === "flooded_road") subtype = "flooding";
      if (sourceKind === "official_roadway" && subtype === "closed_road") subtype = "road_closure";
      const evidenceId = identity(record, sourceKind, subtype);
      if (!evidenceId) continue; // fail closed: identity-less data cannot become authority
      if (seen.has(evidenceId)) { duplicates.push(evidenceId); continue; }
      seen.add(evidenceId);
      const lifecycleState = lifecycle(record, subtype, nowMs);
      const current = lifecycleState.current;
      const geographicEligible = record.geographicEligible !== false;
      const policy = policyFor(sourceKind, subtype);
      const eligible = Object.fromEntries(SURFACES.map((surface) => [surface, lifecycleState.active && geographicEligible && policy[surface] === true]));
      const published = Object.fromEntries(SURFACES.map((surface) => [surface, actualSets[surface].has(evidenceId) || actualSets[surface].has(text(record.id)) || actualSets[surface].has(text(record.reportId)) || actualSets[surface].has(text(record.incidentId))]));
      evidence.push(Object.freeze({
        evidenceId, sourceKind, sourceId: text(record.sourceId || record.provider || record.source), subtype,
        canonicalCommunity: text(record.canonicalCommunity || record.community || record.city || record.town),
        canonicalKey: text(record.canonicalKey || record.placeGeoid || record.place_geoid), countyId: text(record.countyId || record.county_id),
        transitionGeneration: Number(record.transitionGeneration ?? input.transitionGeneration ?? 0) || 0,
        createdAt: text(record.createdAt || record.created_at), observedAt: text(record.observedAt || record.observed_at), updatedAt: text(record.updatedAt || record.updated_at),
        freshness: current ? "current" : "stale", current, active: lifecycleState.active, lifecycle: lifecycleState, geographicEligible,
        reportabilityPolicy: Object.freeze({ ...policy }), eligible: Object.freeze(eligible), published: Object.freeze(published),
        surfaceEligibility: Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, Object.freeze({ eligible: policy[surface] === null ? null : eligible[surface], policyStatus: policy[surface] === null ? "PRODUCT_CONTRACT_UNDEFINED" : (policy[surface] ? "DEFINED_ELIGIBLE" : "DEFINED_INELIGIBLE"), reason: !lifecycleState.active ? lifecycleState.reason : (!geographicEligible ? "Outside governed geography." : policy[surface] === null ? "Surface ownership is not defined by the product contract." : policy[surface] ? "Existing surface policy includes this evidence kind." : "Existing surface policy excludes this evidence kind.") })]))),
        countedByLocationContext: eligible.locationContext,
        contributesToCommunityPulse: eligible.communityPulse,
        omissionReasons: Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, omission(policy[surface], current, geographicEligible, published[surface])]))),
        staleStatus: current ? "CURRENT" : "STALE"
      }));
    }
    const locationIds = evidence.filter((row) => row.countedByLocationContext).map((row) => row.evidenceId);
    const pulseIds = evidence.filter((row) => row.contributesToCommunityPulse).map((row) => row.evidenceId);
    const displayed = Number.isFinite(Number(input.displayedActiveIssueCount)) ? Math.max(0, Number(input.displayedActiveIssueCount)) : null;
    const events = (Array.isArray(input.events) ? input.events : []).map((event) => ({ at: text(event.at || event.timestamp), reason: text(event.reason || event.type), generation: Number(event.generation ?? generation) || 0 })).sort((a, b) => Date.parse(a.at || 0) - Date.parse(b.at || 0));
    const observations = Object.fromEntries(SURFACES.map((surface) => {
      const items = consumerItems[surface];
      const matched = evidence.filter((row) => row.published[surface]);
      const unmatched = items.filter((item) => !itemIds(item).some((id) => evidence.some((row) => [row.evidenceId, row.evidenceId.split(":").slice(1).join(":")].includes(id))));
      const observed = Object.prototype.hasOwnProperty.call(actual, surface);
      const governedExpectedIds = evidence.filter((row) => row.eligible[surface]).map((row) => row.evidenceId);
      return [surface, Object.freeze({ surfaceObserved: observed, surfaceVisible: actual[`${surface}Visible`] === true, observationStatus: !observed ? "NOT_OBSERVED" : matched.length ? "OBSERVED_MATCHED" : unmatched.length ? "OBSERVED_UNMATCHED" : "OBSERVED_EMPTY", publishedIds: Object.freeze(matched.map((row) => row.evidenceId)), governedEligibleIds: Object.freeze(governedExpectedIds), unmatchedConsumerItems: Object.freeze(unmatched), missingGovernedIds: Object.freeze(governedExpectedIds.filter((id) => !matched.some((row) => row.evidenceId === id))) })];
    }));
    const productionCount = Number.isFinite(Number(input.locationContextProductionCount)) ? Math.max(0, Number(input.locationContextProductionCount)) : displayed;
    const domCount = Number.isFinite(Number(input.locationContextDomCount)) ? Math.max(0, Number(input.locationContextDomCount)) : displayed;
    const productionIds = observations.locationContext.publishedIds;
    const unexpectedIds = productionIds.filter((id) => !locationIds.includes(id));
    return Object.freeze({
      version: VERSION, canonicalCommunity: text(input.canonicalCommunity), canonicalKey: text(input.canonicalKey), countyId: text(input.countyId),
      transitionGeneration: Number(input.transitionGeneration || 0), evidenceGeneration: generation, providerRefreshGeneration: Number(input.providerRefreshGeneration || 0), updateReason: text(input.updateReason || "audit"),
      displayedActiveIssueCount: displayed, governedEligibleEvidenceCount: locationIds.length, locationContextCountAgreement: displayed === null ? null : displayed === locationIds.length,
      locationContextProductionCount: productionCount, locationContextDomCount: domCount, locationContextCountParity: productionCount === null || domCount === null ? null : productionCount === domCount,
      locationContextProductionEvidenceIds: productionIds, locationContextGovernedEvidenceIds: Object.freeze(locationIds), locationContextUnmatchedProductionItems: observations.locationContext.unmatchedConsumerItems,
      locationContextUnexpectedEvidenceIds: Object.freeze(unexpectedIds), locationContextMissingGovernedIds: Object.freeze(locationIds.filter((id) => !productionIds.includes(id))), surfaces: Object.freeze(observations),
      evidence: Object.freeze(evidence), duplicateEvidenceIds: Object.freeze(duplicates), locationContextCountedIds: Object.freeze(locationIds), communityPulseEvidenceIds: Object.freeze(pulseIds),
      publishedIds: Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, Object.freeze(evidence.filter((row) => row.published[surface]).map((row) => row.evidenceId))]))),
      omissions: Object.freeze(evidence.flatMap((row) => SURFACES.filter((surface) => !row.published[surface]).map((surface) => Object.freeze({ evidenceId: row.evidenceId, surface, reason: !observations[surface].surfaceObserved || observations[surface].observationStatus === "OBSERVED_UNMATCHED" ? "IDENTITY_UNAVAILABLE" : row.omissionReasons[surface] })))),
      sourceKindBreakdown: Object.freeze(evidence.reduce((out, row) => ({ ...out, [row.sourceKind]: (out[row.sourceKind] || 0) + 1 }), {})),
      currentStaleBreakdown: Object.freeze({ current: evidence.filter((row) => row.current).length, stale: evidence.filter((row) => !row.current).length }), events: Object.freeze(events), stableState: true
    });
  }
  function buildLocationContextProductionAudit(input = {}) {
    const governed = Array.isArray(input.governedEvidence) ? input.governedEvidence : [];
    const production = Array.isArray(input.productionItems) ? input.productionItems : [];
    const seen = new Map();
    const items = production.slice(0, 100).map((entry, index) => {
      const record = entry?.record && typeof entry.record === "object" ? entry.record : (entry || {});
      const sourceKind = sourceKindOf(record);
      const subtype = subtypeOf(record);
      const productionIdentity = identity(record, sourceKind, subtype);
      const governedRow = productionIdentity ? governed.find((row) => row.evidenceId === productionIdentity) : null;
      let matchStatus = productionIdentity ? (governedRow ? "MATCHED_GOVERNED" : "UNMATCHED_PRODUCTION_ITEM") : "IDENTITY_UNAVAILABLE";
      if (governedRow && governedRow.lifecycle?.retainedForHistory) matchStatus = "MATCHED_INACTIVE_HISTORY";
      else if (governedRow && (!governedRow.current || governedRow.staleStatus === "STALE")) matchStatus = "MATCHED_STALE";
      if (productionIdentity && seen.has(productionIdentity)) matchStatus = "MATCHED_DUPLICATE";
      else if (productionIdentity) seen.set(productionIdentity, index);
      return Object.freeze({
        productionIdentity: productionIdentity || null, sourceKind, subtype,
        governedEvidenceId: governedRow?.evidenceId || null, matchStatus,
        lifecycle: governedRow?.lifecycle?.classification || (matchStatus === "IDENTITY_UNAVAILABLE" ? "IDENTITY_UNAVAILABLE" : "UNRECONCILED"),
        countedReason: text(entry?.countedReason || "production_collection_member")
      });
    });
    const operands = Object.freeze({ ...(input.operands || {}) });
    const count = Number.isFinite(Number(input.productionCount)) ? Math.max(0, Number(input.productionCount)) : items.length;
    const ids = (status) => items.filter((row) => status.includes(row.matchStatus)).map((row) => row.governedEvidenceId || row.productionIdentity).filter(Boolean);
    const sourceBreakdown = items.reduce((out, row) => ({ ...out, [row.sourceKind]: (out[row.sourceKind] || 0) + 1 }), {});
    return Object.freeze({
      locationContextProductionSource: text(input.productionSource || "normalizeGridlyMobileAwarenessPanelSummary.getGridlyReconciledAwarenessActiveIssueCount"),
      locationContextProductionCount: count, locationContextProductionItems: Object.freeze(items),
      locationContextProductionCollectionCardinality: items.length, locationContextProductionOperands: operands,
      locationContextCountDerivationReason: text(input.derivationReason || "MAX_RECONCILIATION_ACROSS_LP214_OPERANDS"),
      locationContextMatchedGovernedIds: Object.freeze(ids(["MATCHED_GOVERNED"])),
      locationContextInactiveHistoryIds: Object.freeze(ids(["MATCHED_INACTIVE_HISTORY"])),
      locationContextStaleIds: Object.freeze(ids(["MATCHED_STALE"])),
      locationContextDuplicateIds: Object.freeze(ids(["MATCHED_DUPLICATE"])),
      locationContextUnmatchedProductionItems: Object.freeze(items.filter((row) => row.matchStatus === "UNMATCHED_PRODUCTION_ITEM")),
      locationContextIdentityUnavailableItems: Object.freeze(items.filter((row) => row.matchStatus === "IDENTITY_UNAVAILABLE")),
      locationContextSourceBreakdown: Object.freeze(sourceBreakdown)
    });
  }
  function buildCurrentCountyVisibleIncidentAudit(input = {}) {
    const source = Array.isArray(input.sourceCollection) ? input.sourceCollection : [];
    const included = Array.isArray(input.includedItems) ? input.includedItems : source;
    const excluded = Array.isArray(input.excludedItems) ? input.excludedItems : [];
    const governed = Array.isArray(input.governedEvidence) ? input.governedEvidence : [];
    const seen = new Set();
    const duplicateIds = [];
    const project = (entry, index, counted) => {
      const record = entry || {};
      const sourceKind = sourceKindOf(record);
      const subtype = subtypeOf(record);
      const productionIdentity = identity(record, sourceKind, subtype);
      const rawId = text(record.providerRecordId || record.reportId || record.report_id || record.incidentId || record.crossingReportId || record.crossing_id || record.crossingId || record.id || record.sourceId);
      const candidates = new Set([productionIdentity, rawId, text(record.evidenceId), rawId ? `${sourceKind}:${rawId}` : ""].filter(Boolean));
      const governedRow = governed.find((row) => candidates.has(text(row.evidenceId)) || candidates.has(text(row.evidenceId).split(":").slice(1).join(":"))) || null;
      const localLifecycle = lifecycle(record, subtype, Number.isFinite(Number(input.nowMs)) ? Number(input.nowMs) : Date.now());
      const lifecycleState = governedRow?.lifecycle || localLifecycle;
      let governedMatch = !productionIdentity ? "IDENTITY_UNAVAILABLE" : governedRow ? "MATCHED_GOVERNED_ACTIVE" : "UNMATCHED_REAL_INCIDENT";
      if (governedRow && lifecycleState.retainedForHistory) governedMatch = "MATCHED_INACTIVE_HISTORY";
      else if (governedRow && lifecycleState.current === false) governedMatch = "MATCHED_STALE";
      else if (governedRow && lifecycleState.active === false) governedMatch = "MATCHED_NON_ACTIVE_PROJECTION";
      if (productionIdentity && seen.has(productionIdentity)) {
        governedMatch = "MATCHED_DUPLICATE";
        duplicateIds.push(productionIdentity);
      } else if (productionIdentity) seen.add(productionIdentity);
      return Object.freeze({
        productionIdentity: productionIdentity || null,
        providerRecordId: rawId || null,
        governedEvidenceId: governedRow?.evidenceId || null,
        governedMatch,
        sourceKind,
        subtype,
        countyId: text(record.countyId || record.county_id) || null,
        canonicalCommunityIdentity: text(record.canonicalKey || record.placeGeoid || record.place_geoid || record.canonicalCommunity || record.community || record.city || record.town) || null,
        current: lifecycleState.current,
        stale: lifecycleState.current === false && !lifecycleState.retainedForHistory,
        active: lifecycleState.active,
        inactive: lifecycleState.active === false,
        cleared: lifecycleState.retainedForHistory === true || subtype === "cleared",
        lifecycle: lifecycleState.classification,
        status: text(record.lifecycleState || record.status || record.state) || null,
        inclusionReason: counted ? "ACTIVE_INVENTORY_MEMBER_MATCHING_CURRENT_COUNTY" : text(entry?.exclusionReason || "COUNTY_MISMATCH"),
        sourceIndex: index
      });
    };
    const items = included.slice(0, 100).map((row, index) => project(row, index, true));
    const excludedItems = excluded.slice(0, Math.max(0, 100 - items.length)).map((row, index) => project(row, index, false));
    const breakdown = (field) => Object.freeze(items.reduce((out, row) => ({ ...out, [row[field] || "unknown"]: (out[row[field] || "unknown"] || 0) + 1 }), {}));
    return Object.freeze({
      currentVisibleReportCount: included.length,
      currentVisibleIncidentItems: Object.freeze(items),
      currentVisibleIncidentIdentities: Object.freeze(items.map((row) => row.productionIdentity).filter(Boolean)),
      currentVisibleIncidentSourceBreakdown: breakdown("sourceKind"),
      currentVisibleIncidentLifecycleBreakdown: breakdown("lifecycle"),
      currentVisibleIncidentCountyId: text(input.countyId),
      currentVisibleIncidentGeneration: Number(input.generation || 0),
      currentVisibleIncidentSourceCollection: "activeHazards + activeReports",
      currentVisibleIncidentFilterStages: Object.freeze({ sourceCollectionCount: source.length, countyMatchedCount: included.length, countyExcludedCount: excluded.length, lifecycleFilteredCount: 0, staleFilteredCount: 0, duplicateFilteredCount: 0, sourceTypeFilteredCount: 0 }),
      currentVisibleIncidentExcludedItems: Object.freeze(excludedItems),
      currentVisibleIncidentDuplicateIds: Object.freeze([...new Set(duplicateIds)]),
      currentVisibleIncidentStaleIds: Object.freeze(items.filter((row) => row.stale).map((row) => row.productionIdentity).filter(Boolean)),
      currentVisibleIncidentInactiveHistoryIds: Object.freeze(items.filter((row) => row.cleared || (row.inactive && row.current)).map((row) => row.productionIdentity).filter(Boolean)),
      currentVisibleIncidentCountContract: "MAP_REPORT_INVENTORY_COUNTY_MEMBERSHIP_NOT_ACTIVE_LIFECYCLE"
    });
  }
  function captureActiveIssueReconciliationInvocation(input = {}) {
    const safeNumber = (value) => {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(0, number) : 0;
    };
    const operands = Object.freeze(Object.fromEntries(Object.entries(input.operands || {}).map(([name, value]) => [name, safeNumber(value)])));
    const values = Object.values(operands);
    const winningValue = values.length ? Math.max(...values) : 0;
    const winningOperandNames = Object.freeze(Object.keys(operands).filter((name) => operands[name] === winningValue));
    const candidateCollections = Object.freeze(Object.fromEntries(Object.entries(input.collections || {}).map(([name, rows]) => {
      const collection = Array.isArray(rows) ? rows : [];
      const boundedIdentities = collection.slice(0, 100).map((record) => {
        const sourceKind = sourceKindOf(record || {});
        const subtype = subtypeOf(record || {});
        return Object.freeze({
          productionIdentity: identity(record || {}, sourceKind, subtype) || null,
          governedEvidenceId: text(record?.evidenceId) || null,
          sourceKind,
          subtype,
          lifecycle: text(record?.lifecycle?.classification || record?.lifecycleState || record?.status || record?.state) || null,
          countyId: text(record?.countyId || record?.county_id) || null,
          communityIdentity: text(record?.canonicalKey || record?.placeGeoid || record?.community || record?.city || record?.town) || null,
          active: typeof record?.active === "boolean" ? record.active : null,
          cleared: subtype === "cleared" || /cleared/i.test(text(record?.status || record?.state || record?.lifecycleState))
        });
      });
      return [name, Object.freeze({ length: collection.length, boundedIdentities: Object.freeze(boundedIdentities) })];
    })));
    return Object.freeze({
      timestamp: text(input.timestamp) || new Date().toISOString(),
      transitionGeneration: Number(input.transitionGeneration || 0),
      evidenceGeneration: Number(input.evidenceGeneration ?? input.transitionGeneration ?? 0),
      providerRefreshGeneration: Number(input.providerRefreshGeneration || 0),
      allCandidateOperands: operands,
      winningValue,
      winningOperandNames,
      returnedValue: safeNumber(input.returnedValue ?? winningValue),
      candidateCollections,
      scalarSources: Object.freeze({ ...(input.scalarSources || {}) })
    });
  }
  return Object.freeze({ VERSION, SURFACES, COMMUNITY_POLICY, OFFICIAL_POLICY, buildSnapshot, buildLocationContextProductionAudit, buildCurrentCountyVisibleIncidentAudit, captureActiveIssueReconciliationInvocation, identity, sourceKindOf, subtypeOf });
});
