(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.gridlyAlertSemanticContract = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ROADWAY_TYPES = Object.freeze([
    ["bridge_restriction", "Bridge Restriction", /bridge[ _-]*(?:restriction|closed|closure)|weight[ _-]*limit|height[ _-]*limit/],
    ["lane_closure", "Lane Closure", /lane[ _-]*(?:closure|closed|blocked)|shoulder[ _-]*(?:closure|closed)/],
    ["road_closure", "Road Closed", /^(?:closure|road[ _-]*(?:closure|closed)|full[ _-]*closure)$/],
    ["construction", "Construction", /construction|work[ _-]*zone|road[ _-]*work|maintenance/],
    ["crash", "Crash", /crash|collision|wreck|accident/],
    ["flooding", "Flooding", /flood|high[ _-]*water|standing[ _-]*water/]
  ]);
  const CLEARED = /^(?:cleared|recently[ _-]*cleared|expired|inactive|removed|reopened|open)$/;
  const token = (value) => String(value == null ? "" : value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  const values = (record, names) => names.map((name) => record?.[name]).filter((value) => value != null && String(value).trim());
  const rawRecord = (record) => record?.canonicalSourceRecord || record?.raw || record?.latestReport || {};

  function sourceOwnership(record = {}) {
    const raw = rawRecord(record);
    const provider = token(record.providerId || record.provider || raw.providerId || raw.provider || record.sourceLabel || record.source || raw.source);
    const kind = token(record.sourceKind || record.reportKind || record.report_kind || raw.sourceKind || raw.reportKind || raw.report_kind);
    const workflow = token(record.reportSource || record.sourceWorkflow || raw.reportSource || raw.sourceWorkflow);
    // The governed consumer projection deliberately replaces the upstream
    // provider id with its authority identity. Its namespaced situation id is
    // therefore the minimum surviving, non-descriptive source provenance.
    const consumerIdentity = token(record.consumerSituationId || raw.consumerSituationId);
    if (/drivetexas|txdot|official_roadways|official_roadway/.test(`${provider}_${kind}_${workflow}_${consumerIdentity}`)) return "OFFICIAL_ROADWAY";
    if (/weather|nws|noaa/.test(`${provider}_${kind}_${workflow}`)) return "WEATHER";
    if (/crossing|rail/.test(kind) || /crossing|rail/.test(workflow) || record.isCrossingReport === true || raw.isCrossingReport === true || record.explicitCrossingReport === true || raw.explicitCrossingReport === true) return "CROSSING";
    return "COMMUNITY";
  }

  function explicitCategory(record = {}) {
    const raw = rawRecord(record);
    return values(record, ["submittedReportType", "submitted_report_type", "submittedHazardType", "submitted_hazard_type", "normalizedCategory", "category", "reportCategory", "incidentType", "hazardType", "hazard_type", "reportType", "report_type", "type", "situationType"])
      .concat(values(raw, ["submittedReportType", "submitted_report_type", "submittedHazardType", "submitted_hazard_type", "normalizedCategory", "category", "eventType", "condition", "hazardType", "reportType", "report_type", "type"]))
      .map(token).filter(Boolean);
  }

  function roadwayClassification(record = {}) {
    if (sourceOwnership(record) !== "OFFICIAL_ROADWAY") return null;
    const categories = explicitCategory(record);
    for (const [classification, title, pattern] of ROADWAY_TYPES) {
      if (categories.some((category) => pattern.test(category))) return { classification, title };
    }
    return { classification: "travel_advisory", title: "Travel Advisory" };
  }

  function crossingBlockedEvidence(record = {}) {
    if (sourceOwnership(record) !== "CROSSING") return false;
    const categories = explicitCategory(record);
    return categories.some((category) => /^(?:crossing_blocked|blocked_crossing|rail_crossing_blocked|train_blocking_crossing|rail_blockage|rail_blockage_delay|blocked|delay|delayed)$/.test(category));
  }

  function lifecycleActive(record = {}) {
    const raw = rawRecord(record);
    const state = token(record.lifecycleState || record.status || record.state || raw.lifecycleState || raw.status || raw.state || "active");
    return record.expired !== true && !CLEARED.test(state) && !CLEARED.test(token(record.type || record.report_type));
  }

  function classify(record = {}) {
    const ownership = sourceOwnership(record);
    const roadway = roadwayClassification(record);
    if (roadway) return Object.freeze({ ...roadway, ownership, active: lifecycleActive(record), governedEvidence: "official roadway category" });
    if (crossingBlockedEvidence(record)) {
      const delayed = explicitCategory(record).some((category) => /train_blocking|rail_blockage_delay|delay|delayed/.test(category));
      return Object.freeze({ classification: "crossing_blocked", title: delayed ? "Train Blocking Crossing" : "Crossing Blocked", ownership, active: lifecycleActive(record), governedEvidence: "crossing-owned explicit blockage category" });
    }
    if (ownership === "WEATHER") return Object.freeze({ classification: "weather_alert", title: "Weather Alert", ownership, active: lifecycleActive(record), governedEvidence: "travel-impacting weather provider record" });
    const categories = explicitCategory(record);
    for (const [classification, title, pattern] of ROADWAY_TYPES) {
      if (categories.some((category) => pattern.test(category))) return Object.freeze({ classification, title, ownership, active: lifecycleActive(record), governedEvidence: "submitted incident category" });
    }
    return Object.freeze({ classification: "community_report", title: "Community Report", ownership, active: lifecycleActive(record), governedEvidence: "community report without a governed specialized category" });
  }

  function consistency(record = {}, presented = {}) {
    const semantic = classify(record);
    const title = String(presented.title || semantic.title).trim();
    const crossingTitle = /^(?:Crossing Blocked|Train Blocking Crossing)$/i.test(title);
    const pass = semantic.active && (!crossingTitle || semantic.classification === "crossing_blocked") && (semantic.classification !== "crossing_blocked" || crossingTitle);
    return Object.freeze({ pass, semantic, title, reason: pass ? "title, source, category, evidence, and lifecycle agree" : "presentation is not allowed by governed source/category/lifecycle evidence" });
  }

  return Object.freeze({ ROADWAY_TYPES, sourceOwnership, crossingBlockedEvidence, lifecycleActive, classify, consistency });
});
