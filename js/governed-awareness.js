(function gridlyGovernedAwarenessModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GridlyGovernedAwareness = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGridlyGovernedAwarenessApi() {
  "use strict";

  const VERSION = "LP237-community-hazard-identity-reconciliation-v1";
  const SURFACES = Object.freeze(["locationContext", "communityPulse", "alerts", "kbygCommunity", "kbygOfficialRoadways", "map", "popup", "history"]);
  const BLOCKED_CROSSING_OWNERS = Object.freeze({
    locationContext: "governed_awareness", communityPulse: "governed_awareness", alerts: "governed_awareness",
    kbygCommunity: "governed_awareness", kbygOfficialRoadways: "none",
    map: "crossing_specific", popup: "crossing_specific", history: "crossing_specific"
  });
  const COMMUNITY_POLICY = Object.freeze({
    blocked_crossing: { locationContext: true, communityPulse: true, alerts: true, kbygCommunity: true, kbygOfficialRoadways: false, map: true, popup: true, history: true },
    rail_crossing_issue: { locationContext: true, communityPulse: true, alerts: true, kbygCommunity: null, kbygOfficialRoadways: false, map: true, popup: true, history: null },
    disabled_vehicle: { locationContext: false, communityPulse: false, alerts: true, kbygCommunity: null, kbygOfficialRoadways: false, map: true, popup: true },
    flooded_road: { locationContext: true, communityPulse: true, alerts: true, kbygCommunity: null, kbygOfficialRoadways: false, map: true, popup: true },
    closed_road: { locationContext: true, communityPulse: true, alerts: true, kbygCommunity: null, kbygOfficialRoadways: false, map: true, popup: true }
  });
  const OFFICIAL_POLICY = Object.freeze(Object.fromEntries([
    "flooding", "lane_closure", "road_closure", "bridge_restriction", "travel_advisory", "debris"
  ].map((subtype) => [subtype, Object.freeze({ locationContext: true, communityPulse: true, alerts: true, kbygCommunity: false, kbygOfficialRoadways: true, map: true, popup: true })])));
  const GENERATED_POLICY = Object.freeze({ locationContext: true, communityPulse: true, alerts: true, kbygCommunity: true, kbygOfficialRoadways: false, map: true, popup: true });
  const HAZARD_POLICY = Object.freeze({ locationContext: true, communityPulse: true, alerts: true, kbygCommunity: true, kbygOfficialRoadways: false, map: true, popup: true });
  const WEATHER_POLICY = Object.freeze({ locationContext: false, communityPulse: false, alerts: true, kbygCommunity: false, kbygOfficialRoadways: false, map: false, popup: false });

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
    if (/weather|nws|noaa/.test(source) || /weather/.test(explicit)) return "weather_provider";
    if (/generated/.test(source) || /^road[-_]/.test(text(record.incidentId || record.id))) return "generated_road_incident";
    if (/hazard/.test(source) || record.reportKind === "hazard") return "active_hazard";
    if (COMMUNITY_POLICY[type] || /user|community|report/.test(source)) return "community_report";
    return "consumer_only_projection";
  }
  function identity(record = {}, sourceKind = sourceKindOf(record), subtype = subtypeOf(record)) {
    const governedId = sourceKind === "community_report"
      ? text(record.evidenceId || record.persistedReportId || record.persisted_report_id || record.reportId || record.report_id || record.id || record.incidentId || record.crossingReportId || record.sourceId)
      : text(record.evidenceId || record.providerRecordId || record.reportId || record.report_id || record.incidentId || record.crossingReportId || record.id || record.sourceId);
    if (governedId) return `${sourceKind}:${governedId}`;
    const lat = Number(record.lat ?? record.latitude ?? record.coordinates?.lat);
    const lng = Number(record.lng ?? record.lon ?? record.longitude ?? record.coordinates?.lng);
    const observed = text(record.observedAt || record.updatedAt || record.updated_at || record.createdAt || record.created_at || record.timestamp);
    if (Number.isFinite(lat) && Number.isFinite(lng) && observed) return `${sourceKind}:fallback:${subtype}:${lat.toFixed(5)},${lng.toFixed(5)}:${observed}`;
    return "";
  }
  // A consumer is allowed to keep its presentation id, but identity ownership
  // remains with the stable submitted/provider record.  Keep this list ordered
  // and coordinate-free: coordinates describe a presentation, not a condition.
  function communityHazardAliasCandidates(record = {}, sourceKind = sourceKindOf(record), subtype = subtypeOf(record), visited = new Set()) {
    if (!record || typeof record !== "object" || visited.has(record)) return Object.freeze([]);
    visited.add(record);
    const values = [
      identity(record, sourceKind, subtype), record.evidenceId,
      record.canonicalGovernedId, record.canonicalReportIdentity,
      record.canonicalReportId, record.canonical_report_id,
      record.lifecycleIdentity, record.lifecycle_identity,
      record.persistedReportId, record.persisted_report_id,
      record.submittedReportId, record.submitted_report_id,
      record.providerRecordId, record.provider_record_id,
      record.crossingId, record.crossing_id, record.reportId,
      record.report_id, record.incidentId, record.id, record.sourceId
    ].map(text).filter(Boolean);
    for (const child of [record.record, record.raw, record.latestReport, ...(Array.isArray(record.reports) ? record.reports : [])]) {
      if (!child || child === record) continue;
      values.push(...communityHazardAliasCandidates(child, sourceKindOf(child), subtypeOf(child), visited));
    }
    const expanded = values.flatMap((value) => {
      const bare = value.includes(":") ? value.split(":").slice(1).join(":") : value;
      return [value, bare, `${sourceKind}:${bare}`];
    });
    return Object.freeze([...new Set(expanded.filter(Boolean))]);
  }
  function persistedReportId(record = {}) {
    return text(record.persistedReportId || record.persisted_report_id || record.reportId || record.report_id || record.id || record.raw?.id || record.raw?.report_id);
  }
  function crossingProviderId(record = {}) {
    return text(record.providerRecordId || record.provider_record_id || record.crossingId || record.crossing_id || record.crossing?.id);
  }
  function explicitLifecycleIdentity(record = {}) {
    return text(record.explicitLifecycleTargetRaw || record.lifecycleIdentity || record.lifecycle_identity || record.canonicalReportId || record.canonical_report_id || record.clearsReportId || record.clears_report_id || record.sourceReportId || record.source_report_id);
  }
  function eventTime(record = {}) {
    const value = Date.parse(record.updatedAt || record.updated_at || record.createdAt || record.created_at || record.submittedAt || record.timestamp || "");
    return Number.isFinite(value) ? value : 0;
  }
  function isCrossingCommunityRecord(record = {}) {
    const subtype = subtypeOf(record);
    return sourceKindOf(record) === "community_report"
      && (subtype === "blocked_crossing" || subtype === "cleared" || subtype === "recently_cleared" || text(record.reportKind).toLowerCase() === "crossing");
  }
  function lifecycleRoleOf(record = {}) {
    const subtype = subtypeOf(record);
    const state = [record.lifecycleState, record.status, record.state, record.reportKind]
      .map((value) => slug(value));
    return ["cleared", "recently_cleared"].includes(subtype)
      || state.some((value) => value === "cleared" || value === "recently_cleared")
      ? "CLEAR_HISTORY" : "ACTIVE";
  }
  // A reports.id UUID identifies a user report. crossing_id/providerRecordId
  // identifies the FRA infrastructure and is deliberately not a report key.
  // Legacy clear rows did not carry their target UUID, so they are linked only
  // to the latest preceding report at that crossing from the same reporter.
  function reconcileCommunityReportAliases(records = []) {
    const rows = records.map((record, index) => ({ record, index, persistedId: persistedReportId(record), providerId: crossingProviderId(record), explicitId: explicitLifecycleIdentity(record), subtype: subtypeOf(record), lifecycleRole: lifecycleRoleOf(record), time: eventTime(record), deviceId: text(record.deviceId || record.device_id) }));
    const activeCandidates = rows.filter((row) => isCrossingCommunityRecord(row.record) && row.lifecycleRole === "ACTIVE");
    const resolved = rows.map((row) => {
      const isClear = isCrossingCommunityRecord(row.record) && row.lifecycleRole === "CLEAR_HISTORY";
      // A normalized clear used to copy its own reports.id into lifecycleIdentity
      // when no lifecycle_report_id was persisted.  That value is observable for
      // audit purposes, but it is not an explicit relationship and must never
      // prevent the safe legacy resolver from finding the preceding active row.
      const validExplicitTarget = isClear && row.explicitId && row.explicitId !== row.persistedId
        && activeCandidates.some((candidate) => candidate.persistedId === row.explicitId);
      let lifecycleIdentity = isClear ? "" : row.persistedId;
      let result = "NO_VALID_TARGET";
      if (validExplicitTarget) {
        lifecycleIdentity = row.explicitId;
        result = "EXPLICIT_ACTIVE_REPORT_ID";
      } else if (isClear) {
        const candidates = activeCandidates.filter((candidate) => candidate.providerId && candidate.providerId === row.providerId
          && candidate.deviceId && candidate.deviceId === row.deviceId && (!row.time || !candidate.time || candidate.time <= row.time))
          .sort((left, right) => right.time - left.time || right.index - left.index);
        if (candidates[0]?.persistedId) {
          lifecycleIdentity = candidates[0].persistedId;
          result = "LEGACY_SAME_REPORTER_SAME_CROSSING";
        }
      }
      return { ...row, lifecycleIdentity, reconciliationResult: result };
    });
    const groups = new Map();
    resolved.forEach((row) => {
      if (!row.lifecycleIdentity || !isCrossingCommunityRecord(row.record)) return;
      if (!groups.has(row.lifecycleIdentity)) groups.set(row.lifecycleIdentity, []);
      groups.get(row.lifecycleIdentity).push(row);
    });
    return resolved.map((row) => {
      const aliases = groups.get(row.lifecycleIdentity) || [row];
      const cleared = aliases.filter((alias) => alias.lifecycleRole === "CLEAR_HISTORY");
      const active = aliases.filter((alias) => alias.lifecycleRole === "ACTIVE");
      const conflict = cleared.length > 0 && active.length > 0;
      const retiringClear = cleared.slice().sort((left, right) => right.time - left.time || right.index - left.index)[0];
      return Object.freeze({
        lifecycleIdentity: row.lifecycleIdentity || null,
        persistedReportId: row.persistedId || null,
        providerRecordId: row.providerId || null,
        crossingFraIdentity: row.providerId || null,
        lifecycleRole: row.lifecycleRole,
        explicitLifecycleTargetRaw: row.explicitId || null,
        canonicalLifecycleTarget: row.lifecycleIdentity || null,
        targetResolutionSource: row.reconciliationResult,
        retiredByClearId: row.lifecycleRole === "ACTIVE" && conflict ? (retiringClear?.persistedId || null) : null,
        aliasIds: Object.freeze(aliases.map((alias) => identity(alias.record, sourceKindOf(alias.record), subtypeOf(alias.record))).filter(Boolean)),
        clearedAliasIds: Object.freeze(cleared.map((alias) => identity(alias.record, sourceKindOf(alias.record), subtypeOf(alias.record))).filter(Boolean)),
        activeAliasIds: Object.freeze(active.map((alias) => identity(alias.record, sourceKindOf(alias.record), subtypeOf(alias.record))).filter(Boolean)),
        aliasReconciliationResult: conflict ? "SAME_REPORT_ACTIVE_HISTORY_ALIAS_CONFLICT" : row.reconciliationResult,
        retireActiveAlias: conflict && row.lifecycleRole === "ACTIVE",
        firstLifecycleLosingStage: conflict && row.lifecycleRole === "ACTIVE" ? "governed_active_lifecycle_alias_reconciliation" : null
      });
    });
  }
  function policyFor(sourceKind, subtype) {
    if (sourceKind === "weather_provider") return WEATHER_POLICY;
    if (sourceKind === "official_roadway") return OFFICIAL_POLICY[subtype] || OFFICIAL_POLICY.debris;
    if (sourceKind === "generated_road_incident") return GENERATED_POLICY;
    if (sourceKind === "active_hazard") return HAZARD_POLICY;
    if (sourceKind === "community_report") return COMMUNITY_POLICY[subtype] || Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, ["alerts", "map", "popup"].includes(surface) ? true : null])));
    return Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, false])));
  }
  function isCurrent(record = {}, nowMs = Date.now()) {
    const state = slug(record.freshness || record.currentState || record.lifecycleState || record.status || "current");
    if (["stale", "expired", "cleared", "inactive", "historical", "recently_cleared"].includes(state) || record.expired === true) return false;
    const expires = Date.parse(record.expiresAt || record.expires_at || "");
    return !Number.isFinite(expires) || expires > nowMs;
  }
  function lifecycle(record = {}, subtype = subtypeOf(record), nowMs = Date.now()) {
    const explicitlyCleared = subtype === "cleared" || [record.lifecycleState, record.status, record.state].some((value) => /^(?:cleared|recently[_ -]?cleared)$/i.test(text(value)));
    // A cleared row may be current history, but it can never be a current active
    // condition. Keeping these concepts separate is the LP219.3 boundary.
    const current = explicitlyCleared ? true : isCurrent(record, nowMs);
    return Object.freeze({
      current,
      active: current && !explicitlyCleared && record.active !== false,
      classification: explicitlyCleared ? "CURRENT_HISTORY_INACTIVE_CLEARED" : (current && record.active !== false ? "CURRENT_ACTIVE" : "STALE_OR_INACTIVE"),
      retainedForHistory: explicitlyCleared,
      reason: explicitlyCleared ? "Cleared is retained lifecycle evidence, not an active condition." : (current ? "Current lifecycle record is active." : "Record is stale or inactive.")
    });
  }
  function isGovernedActiveLifecycle(row = {}) {
    const state = row.lifecycle && typeof row.lifecycle === "object" ? row.lifecycle : row;
    return state.current === true
      && state.active === true
      && state.retainedForHistory !== true
      && row.cleared !== true
      && row.stale !== true;
  }
  function omission(policyValue, current, geographic, published) {
    if (published) return "PUBLISHED";
    if (!current) return "STALE_OR_INACTIVE";
    if (!geographic) return "GEOGRAPHICALLY_INELIGIBLE";
    if (policyValue === false) return "EXPECTED_BY_DESIGN";
    if (policyValue === null) return "PRODUCT_CONTRACT_UNDEFINED";
    return "PROPAGATION_FAILURE";
  }
  function surfaceOwner(sourceKind, subtype, surface) {
    if (sourceKind === "community_report" && subtype === "blocked_crossing") return BLOCKED_CROSSING_OWNERS[surface] || "none";
    return "governed_awareness";
  }
  const LOCATION_FIELDS = Object.freeze([
    "roadName", "routeName", "street", "streetName", "primaryRoad", "nearestRoad",
    "crossStreet", "referenceRoadA", "locationName", "location", "resolvedLocation"
  ]);
  const LOCATION_CONTAINERS = Object.freeze(["structuredMetadata", "gridlyStructuredMetadata", "canonicalRoadContext"]);
  // Governed evidence is also the authority handed to consumer projections.
  // Preserve already-normalized location facts at that boundary; do not derive
  // geography, rewrite identity, or create a second location authority.
  function governedLocationEvidence(record = {}) {
    const projection = {};
    for (const field of LOCATION_FIELDS) {
      const value = text(record[field]);
      if (value) projection[field] = value;
    }
    for (const field of LOCATION_CONTAINERS) {
      const value = record[field];
      if (value && typeof value === "object") projection[field] = value;
    }
    return Object.freeze(projection);
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
      return communityHazardAliasCandidates(item || {}, kind, subtype);
    };
    const actualSets = Object.fromEntries(SURFACES.map((surface) => [surface, new Set(consumerItems[surface].flatMap(itemIds))]));
    const records = Array.isArray(input.records) ? input.records : [];
    const aliasRows = reconcileCommunityReportAliases(records);
    const seen = new Set();
    const duplicates = [];
    const evidence = [];
    for (const [recordIndex, record] of records.entries()) {
      const sourceKind = sourceKindOf(record);
      let subtype = subtypeOf(record);
      if (sourceKind === "community_report" && isCrossingCommunityRecord(record) && ["cleared", "recently_cleared"].includes(subtype)) subtype = "blocked_crossing";
      if (sourceKind === "official_roadway" && subtype === "flooded_road") subtype = "flooding";
      if (sourceKind === "official_roadway" && subtype === "closed_road") subtype = "road_closure";
      const evidenceId = identity(record, sourceKind, subtype);
      if (!evidenceId) continue; // fail closed: identity-less data cannot become authority
      if (seen.has(evidenceId)) { duplicates.push(evidenceId); continue; }
      seen.add(evidenceId);
      const alias = aliasRows[recordIndex];
      // Alias reconciliation is authoritative and deliberately precedes both
      // final lifecycle state and every consumer-eligibility calculation.
      const baseLifecycleState = alias?.lifecycleRole === "CLEAR_HISTORY"
        ? Object.freeze({ current: true, active: false, classification: "CURRENT_HISTORY_INACTIVE_CLEARED", retainedForHistory: true, reason: "Cleared is retained lifecycle evidence, not an active condition." })
        : lifecycle(record, subtype, nowMs);
      const lifecycleState = alias?.retireActiveAlias ? Object.freeze({ current: true, active: false, classification: "RETIRED_BY_CLEARED_CANONICAL_REPORT_ALIAS", retainedForHistory: false, reason: "Another governed alias records the clear transition for this canonical report." }) : baseLifecycleState;
      const current = lifecycleState.current;
      const geographicEligible = record.geographicEligible !== false;
      const policy = policyFor(sourceKind, subtype);
      const eligible = Object.fromEntries(SURFACES.map((surface) => [surface, geographicEligible && policy[surface] === true && (surface === "history" ? lifecycleState.retainedForHistory : lifecycleState.active)]));
      const aliasCandidates = communityHazardAliasCandidates(record, sourceKind, subtype);
      const published = Object.fromEntries(SURFACES.map((surface) => [surface, aliasCandidates.some((candidate) => actualSets[surface].has(candidate))]));
      const locationEvidence = governedLocationEvidence(record);
      evidence.push(Object.freeze({
        evidenceId, sourceKind, sourceId: text(record.sourceId || record.provider || record.source), subtype,
        ...locationEvidence,
        persistedReportId: alias?.persistedReportId || persistedReportId(record) || null,
        providerRecordId: alias?.providerRecordId || crossingProviderId(record) || null,
        crossingFraIdentity: alias?.crossingFraIdentity || null,
        lifecycleRole: alias?.lifecycleRole || (baseLifecycleState.retainedForHistory ? "CLEAR_HISTORY" : "ACTIVE"),
        explicitLifecycleTargetRaw: alias?.explicitLifecycleTargetRaw || null,
        canonicalLifecycleTarget: alias ? alias.canonicalLifecycleTarget : (persistedReportId(record) || null),
        targetResolutionSource: alias?.targetResolutionSource || "NO_VALID_TARGET",
        retiredByClearId: alias?.retiredByClearId || null,
        lifecycleIdentity: alias ? alias.lifecycleIdentity : (persistedReportId(record) || null),
        canonicalReportIdentity: alias ? alias.lifecycleIdentity : (persistedReportId(record) || null),
        aliases: Object.freeze([...new Set([...(alias?.aliasIds || []), ...aliasCandidates])]), aliasCandidates, clearedAliasIds: alias?.clearedAliasIds || Object.freeze([]), activeAliasIds: alias?.activeAliasIds || Object.freeze([]),
        aliasReconciliationResult: alias?.aliasReconciliationResult || "NOT_APPLICABLE", firstLifecycleLosingStage: alias?.firstLifecycleLosingStage || null,
        canonicalCommunity: text(record.canonicalCommunity || record.community || record.city || record.town),
        canonicalKey: text(record.canonicalKey || record.placeGeoid || record.place_geoid), countyId: text(record.countyId || record.county_id),
        transitionGeneration: Number(record.transitionGeneration ?? input.transitionGeneration ?? 0) || 0,
        createdAt: text(record.createdAt || record.created_at), observedAt: text(record.observedAt || record.observed_at), updatedAt: text(record.updatedAt || record.updated_at),
        freshness: current ? "current" : "stale", current, active: lifecycleState.active, lifecycle: lifecycleState, geographicEligible,
        reportabilityPolicy: Object.freeze({ ...policy }), eligible: Object.freeze(eligible), published: Object.freeze(published),
        surfaceEligibility: Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, Object.freeze({ eligible: policy[surface] === null ? null : eligible[surface], policyStatus: policy[surface] === null ? "PRODUCT_POLICY_UNDEFINED" : (policy[surface] ? "PRODUCT_POLICY_ELIGIBLE" : "PRODUCT_POLICY_INELIGIBLE"), owningPublisher: surfaceOwner(sourceKind, subtype, surface), reason: surface === "history" && lifecycleState.retainedForHistory ? "Cleared crossing evidence is retained by crossing history." : !lifecycleState.active ? lifecycleState.reason : (!geographicEligible ? "Outside governed geography." : policy[surface] === null ? "Surface ownership is not defined by the product contract." : policy[surface] ? "Explicit surface policy includes this evidence kind." : "Explicit surface policy excludes this evidence kind.") })]))),
        countedByLocationContext: eligible.locationContext,
        contributesToCommunityPulse: eligible.communityPulse,
        omissionReasons: Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, omission(policy[surface], current, geographicEligible, published[surface])]))),
        staleStatus: current ? "CURRENT" : "STALE"
      }));
    }
    const lifecycleAudit = evidence.filter((row) => row.sourceKind === "community_report").map((row) => Object.freeze({
      persistedReportId: row.persistedReportId,
      lifecycleRole: row.lifecycleRole,
      explicitLifecycleTargetRaw: row.explicitLifecycleTargetRaw,
      canonicalLifecycleTarget: row.canonicalLifecycleTarget,
      targetResolutionSource: row.targetResolutionSource,
      retiredByClearId: row.retiredByClearId,
      finalLifecycleEligible: isGovernedActiveLifecycle(row),
      finalHistoryEligible: row.eligible.history === true,
      finalConsumerEligible: SURFACES.some((surface) => surface !== "history" && row.eligible[surface] === true),
      reconciliationResult: row.aliasReconciliationResult
    }));
    if (lifecycleAudit.some((row) => row.lifecycleRole === "CLEAR_HISTORY" && row.finalLifecycleEligible)) {
      throw new Error("LP223 invariant violation: CLEAR_HISTORY cannot be lifecycle-active");
    }
    if (lifecycleAudit.some((row) => row.lifecycleRole === "CLEAR_HISTORY" && row.canonicalLifecycleTarget === row.persistedReportId)) {
      throw new Error("LP223 invariant violation: CLEAR_HISTORY cannot target its own persisted report id");
    }
    const locationIds = evidence.filter((row) => row.countedByLocationContext).map((row) => row.evidenceId);
    const pulseIds = evidence.filter((row) => row.contributesToCommunityPulse).map((row) => row.evidenceId);
    const displayed = Number.isFinite(Number(input.displayedActiveIssueCount)) ? Math.max(0, Number(input.displayedActiveIssueCount)) : null;
    const events = (Array.isArray(input.events) ? input.events : []).map((event) => ({ at: text(event.at || event.timestamp), reason: text(event.reason || event.type), generation: Number(event.generation ?? generation) || 0 })).sort((a, b) => Date.parse(a.at || 0) - Date.parse(b.at || 0));
    const observations = Object.fromEntries(SURFACES.map((surface) => {
      const items = consumerItems[surface];
      const matched = evidence.filter((row) => row.published[surface]);
      const unmatched = items.filter((item) => !itemIds(item).some((id) => evidence.some((row) => row.aliasCandidates.includes(id))));
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
      evidence: Object.freeze(evidence), lifecycleAudit: Object.freeze(lifecycleAudit), duplicateEvidenceIds: Object.freeze(duplicates), locationContextCountedIds: Object.freeze(locationIds), communityPulseEvidenceIds: Object.freeze(pulseIds),
      publishedIds: Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, Object.freeze(evidence.filter((row) => row.published[surface]).map((row) => row.evidenceId))]))),
      omissions: Object.freeze(evidence.flatMap((row) => SURFACES.filter((surface) => !row.published[surface]).map((surface) => Object.freeze({ evidenceId: row.evidenceId, surface, reason: !observations[surface].surfaceObserved || observations[surface].observationStatus === "OBSERVED_UNMATCHED" ? "IDENTITY_UNAVAILABLE" : row.omissionReasons[surface] })))),
      sourceKindBreakdown: Object.freeze(evidence.reduce((out, row) => ({ ...out, [row.sourceKind]: (out[row.sourceKind] || 0) + 1 }), {})),
      currentStaleBreakdown: Object.freeze({ current: evidence.filter((row) => row.current).length, stale: evidence.filter((row) => !row.current).length }), events: Object.freeze(events), stableState: true
    });
  }
  function buildConsumerProjection(input = {}) {
    const records = Array.isArray(input.records) ? input.records : [];
    const snapshot = buildSnapshot({ ...input, records, actual: input.actual || {} });
    const byId = new Map(records.map((record) => {
      const kind = sourceKindOf(record); const subtype = subtypeOf(record);
      return [identity(record, kind, subtype), record];
    }).filter(([id]) => id));
    const surfaces = Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, Object.freeze(snapshot.evidence
      .filter((row) => row.eligible[surface] === true)
      .map((row) => {
        const record = byId.get(row.evidenceId);
        return Object.freeze({
          evidenceId: row.evidenceId, sourceKind: row.sourceKind, subtype: row.subtype,
          record: Object.freeze({ ...record, governedEvidence: governedLocationEvidence(row) })
        });
      }))])));
    const lineage = Object.freeze(snapshot.evidence.map((row) => Object.freeze({
      evidenceId: row.evidenceId, deduplicationIdentity: row.evidenceId,
      governedEvidenceId: row.evidenceId, persistedReportId: row.persistedReportId,
      providerRecordId: row.providerRecordId, crossingFraIdentity: row.crossingFraIdentity,
      lifecycleIdentity: row.lifecycleIdentity, canonicalReportIdentity: row.canonicalReportIdentity,
      lifecycleRole: row.lifecycleRole, explicitLifecycleTargetRaw: row.explicitLifecycleTargetRaw,
      canonicalLifecycleTarget: row.canonicalLifecycleTarget, targetResolutionSource: row.targetResolutionSource, retiredByClearId: row.retiredByClearId,
      aliases: row.aliases, clearedAliasIds: row.clearedAliasIds, activeAliasIds: row.activeAliasIds,
      aliasReconciliationResult: row.aliasReconciliationResult, firstLifecycleLosingStage: row.firstLifecycleLosingStage,
      deduplicationStatus: snapshot.duplicateEvidenceIds.includes(row.evidenceId) ? "DEDUPLICATED_SHARED_EVIDENCE" : "CANONICAL_UNIQUE_EVIDENCE",
      sourceKind: row.sourceKind, subtype: row.subtype,
      canonicalCommunity: row.canonicalCommunity, canonicalKey: row.canonicalKey, countyId: row.countyId,
      current: row.current, active: row.active, lifecycleEligible: isGovernedActiveLifecycle(row),
      alertsEligible: row.eligible.alerts, alertsOmissionReason: row.eligible.alerts ? null : row.omissionReasons.alerts,
      kbygCommunityEligible: row.eligible.kbygCommunity, kbygCommunityOmissionReason: row.eligible.kbygCommunity ? null : row.omissionReasons.kbygCommunity,
      kbygOfficialRoadwaysEligible: row.eligible.kbygOfficialRoadways,
      communityPulseEligible: row.eligible.communityPulse,
      consumerOwnership: Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, Object.freeze({
        policyStatus: row.surfaceEligibility[surface].policyStatus,
        owningPublisher: row.surfaceEligibility[surface].owningPublisher,
        publicationStatus: row.published[surface]
          ? (row.surfaceEligibility[surface].owningPublisher === "crossing_specific" ? "PUBLISHED_BY_CROSSING_SPECIFIC_OWNER" : "PUBLISHED_BY_GOVERNED_OWNER")
          : (row.eligible[surface] ? "PROPAGATION_FAILURE" : row.surfaceEligibility[surface].policyStatus),
        finalConsumerMember: row.eligible[surface], omissionReason: row.eligible[surface] ? null : row.omissionReasons[surface]
      })]))),
      historyEligible: row.eligible.history,
      finalLifecycleEligible: isGovernedActiveLifecycle(row), finalHistoryEligible: row.eligible.history,
      finalConsumerEligible: SURFACES.some((surface) => surface !== "history" && row.eligible[surface] === true),
      reconciliationResult: row.aliasReconciliationResult
    })));
    return Object.freeze({ version: "LP219.4-governed-consumer-propagation-v1", surfaces, lineage, snapshot });
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
    const projectedItems = included.map((row, index) => project(row, index, true));
    const items = projectedItems.slice(0, 100);
    const excludedItems = excluded.slice(0, Math.max(0, 100 - items.length)).map((row, index) => project(row, index, false));
    const breakdown = (field) => Object.freeze(items.reduce((out, row) => ({ ...out, [row[field] || "unknown"]: (out[row[field] || "unknown"] || 0) + 1 }), {}));
    const activeItems = projectedItems.filter((row) => row.governedMatch === "MATCHED_GOVERNED_ACTIVE" && isGovernedActiveLifecycle(row));
    const lifecycleExcludedItems = projectedItems.filter((row) => !activeItems.includes(row));
    return Object.freeze({
      currentVisibleReportCount: included.length,
      currentVisibleIncidentItems: Object.freeze(items),
      currentVisibleIncidentIdentities: Object.freeze(items.map((row) => row.productionIdentity).filter(Boolean)),
      currentActiveVisibleIncidentCount: activeItems.length,
      currentActiveVisibleIncidentItems: Object.freeze(activeItems.slice(0, 100)),
      currentActiveVisibleIncidentIdentities: Object.freeze(activeItems.slice(0, 100).map((row) => row.productionIdentity).filter(Boolean)),
      currentVisibleIncidentSourceBreakdown: breakdown("sourceKind"),
      currentVisibleIncidentLifecycleBreakdown: breakdown("lifecycle"),
      currentVisibleIncidentCountyId: text(input.countyId),
      currentVisibleIncidentGeneration: Number(input.generation || 0),
      currentVisibleIncidentSourceCollection: "activeHazards + activeReports",
      currentVisibleIncidentFilterStages: Object.freeze({ sourceCollectionCount: source.length, countyMatchedCount: included.length, countyExcludedCount: excluded.length, lifecycleFilteredCount: 0, staleFilteredCount: 0, duplicateFilteredCount: 0, sourceTypeFilteredCount: 0 }),
      currentActiveVisibleIncidentFilterStages: Object.freeze({ countyMatchedCount: included.length, activeLifecycleCount: activeItems.length, lifecycleExcludedCount: lifecycleExcludedItems.length, staleFilteredCount: projectedItems.filter((row) => row.stale).length, duplicateFilteredCount: projectedItems.filter((row) => row.governedMatch === "MATCHED_DUPLICATE").length }),
      currentVisibleIncidentExcludedItems: Object.freeze(excludedItems),
      currentVisibleIncidentDuplicateIds: Object.freeze([...new Set(duplicateIds)]),
      currentVisibleIncidentStaleIds: Object.freeze(items.filter((row) => row.stale).map((row) => row.productionIdentity).filter(Boolean)),
      currentVisibleIncidentInactiveHistoryIds: Object.freeze(items.filter((row) => row.cleared || (row.inactive && row.current)).map((row) => row.productionIdentity).filter(Boolean)),
      currentVisibleIncidentLifecycleExcludedIds: Object.freeze(lifecycleExcludedItems.map((row) => row.productionIdentity).filter(Boolean)),
      duplicateIds: Object.freeze([...new Set(duplicateIds)]),
      staleIds: Object.freeze(items.filter((row) => row.stale).map((row) => row.productionIdentity).filter(Boolean)),
      inactiveHistoryIds: Object.freeze(items.filter((row) => row.cleared || (row.inactive && row.current)).map((row) => row.productionIdentity).filter(Boolean)),
      lifecycleExcludedIds: Object.freeze(lifecycleExcludedItems.map((row) => row.productionIdentity).filter(Boolean)),
      currentVisibleIncidentCountContract: "MAP_REPORT_INVENTORY_COUNTY_MEMBERSHIP_NOT_ACTIVE_LIFECYCLE",
      currentActiveVisibleIncidentCountContract: "CURRENT_COUNTY_GOVERNED_ACTIVE_LIFECYCLE_COUNT"
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
      scalarSources: Object.freeze({ ...(input.scalarSources || {}) }),
      lifecycleOperandAudit: Object.freeze({ ...(input.lifecycleOperandAudit || {}) })
    });
  }
  function buildCommunityHazardAcceptanceAudit(input = {}) {
    const submissions = Array.isArray(input.submissions) ? input.submissions.slice(0, 100) : [];
    const hazards = Array.isArray(input.hazards) ? input.hazards.slice(0, 100) : [];
    const terminal = new Set(["cleared", "expired", "deleted", "stale", "rejected"]);
    const aliasesOf = (row) => new Set([
      row?.submissionId, row?.canonicalGovernedId, row?.canonicalReportId,
      row?.submittedReportId, row?.hazardDeviceId, row?.providerRecordId,
      row?.provider_record_id, row?.crossingId, row?.crossing_id,
      ...(row?.aliasCandidates || [])
    ].map(text).filter(Boolean));
    const governedAliases = hazards.map((row) => ({ row, aliases: aliasesOf(row) }));
    const selectedMembershipCounty = text(input.selectedMembershipCounty) || null;
    const authoritativeMembershipCounty = text(input.authoritativeMembershipCounty) || null;
    const activeCounty = text(input.activeCounty) || null;
    const membershipCounties = new Set((input.membershipCounties || []).map(text).filter(Boolean));
    const authorityAvailable = Boolean(selectedMembershipCounty && authoritativeMembershipCounty && activeCounty && membershipCounties.size);
    const countyGovernancePass = authorityAvailable
      && membershipCounties.has(selectedMembershipCounty)
      && selectedMembershipCounty === authoritativeMembershipCounty
      && activeCounty === authoritativeMembershipCounty;
    const hazardCountyAuthority = submissions.map((submission) => {
      const submissionAliases = aliasesOf(submission);
      const match = governedAliases.find(({ aliases }) => [...submissionAliases].some((id) => aliases.has(id)))?.row || null;
      const disposition = text(submission?.terminalDisposition || submission?.status || submission?.lifecycleState).toLowerCase();
      const terminalReconciled = terminal.has(disposition) && (disposition !== "rejected" || Boolean(text(submission?.rejectionReason)));
      const submissionCounty = text(submission?.submissionCounty || submission?.countyId || submission?.county_id) || null;
      const persistedCounty = text(submission?.persistedCounty || submission?.report?.countyId || submission?.report?.county_id) || null;
      const governedCounty = text(match?.governedCounty || match?.countyId || match?.county_id) || null;
      const countyFirstDivergenceStage = !countyGovernancePass ? (!authorityAvailable ? "COMMUNITY_MEMBERSHIP_AUTHORITY_UNAVAILABLE" : "ACTIVE_COUNTY_AUTHORITY")
        : submissionCounty && membershipCounties.has(submissionCounty) === false ? "HAZARD_GEOGRAPHY_OUTSIDE_PLACE_MEMBERSHIPS"
          : persistedCounty && submissionCounty && persistedCounty !== submissionCounty ? "PERSISTED_HAZARD_COUNTY" : null;
      return Object.freeze({
        submissionId: text(submission?.submissionId || submission?.canonicalReportId) || null,
        canonicalGovernedId: match?.canonicalGovernedId || null,
        selectedMembershipCounty, authoritativeMembershipCounty, activeCounty,
        submissionCounty, persistedCounty, governedCounty,
        countyResolutionReason: text(submission?.countyResolutionReason) || (submissionCounty ? "hazard_geography_metadata_preserved" : "hazard_geography_unavailable"),
        countyFirstDivergenceStage,
        lifecycleFirstLosingStage: match || terminalReconciled ? null : "SUBMITTED_TO_GOVERNED_RECONCILIATION",
        terminalDisposition: terminalReconciled ? disposition : null
      });
    });
    const missing = hazardCountyAuthority.filter((row) => !row.canonicalGovernedId && !row.terminalDisposition);
    const submittedButUngovernedHazardIds = missing.map((row) => row.submissionId).filter(Boolean);
    // This is an owner acceptance audit, not a generic idle-state health flag.
    // With no bounded submission evidence it must not certify lifecycle parity
    // merely because Array#every/find have no counterexample.
    const submittedToGovernedParityPass = submissions.length > 0 && missing.length === 0;
    return Object.freeze({
      submittedHazardCount: submissions.length, governedHazardCount: hazards.length,
      submittedButUngovernedHazardIds: Object.freeze(submittedButUngovernedHazardIds),
      missingGovernedHazardIds: Object.freeze([...submittedButUngovernedHazardIds]),
      hazardCountyAuthority: Object.freeze(hazardCountyAuthority), countyGovernancePass,
      submittedToGovernedParityPass,
      firstLosingStage: hazardCountyAuthority.find((row) => row.countyFirstDivergenceStage || row.lifecycleFirstLosingStage)?.countyFirstDivergenceStage
        || hazardCountyAuthority.find((row) => row.lifecycleFirstLosingStage)?.lifecycleFirstLosingStage || null
    });
  }
  return Object.freeze({ VERSION, SURFACES, COMMUNITY_POLICY, OFFICIAL_POLICY, BLOCKED_CROSSING_OWNERS, buildSnapshot, buildConsumerProjection, buildLocationContextProductionAudit, buildCurrentCountyVisibleIncidentAudit, captureActiveIssueReconciliationInvocation, buildCommunityHazardAcceptanceAudit, isGovernedActiveLifecycle, identity, communityHazardAliasCandidates, sourceKindOf, subtypeOf, persistedReportId, crossingProviderId, reconcileCommunityReportAliases, governedLocationEvidence });
});
