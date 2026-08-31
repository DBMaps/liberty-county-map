(function gridlyConditionDisplayLabelOwner(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.gridlyConditionDisplayLabel = api.gridlyConditionDisplayLabel;
    root.GRIDLY_COMMUNITY_CONDITION_LABELS = api.COMMUNITY_LABELS;
    root.GRIDLY_OTHER_HAZARD_SUBTYPE_LABELS = api.OTHER_HAZARD_SUBTYPE_LABELS;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildConditionLabelAuthority() {
  "use strict";

  const COMMUNITY_LABELS = Object.freeze({
    blocked: "Blocked",
    flooding: "Flooding",
    crash: "Crash / Wreck",
    disabled_vehicle: "Disabled Vehicle",
    debris: "Debris In Road",
    road_closed: "Road Closed",
    construction: "Construction",
    traffic_backup: "Traffic Backup / Heavy Delay",
    other_hazard: "Other Hazard"
  });
  const OTHER_HAZARD_SUBTYPE_LABELS = Object.freeze({
    livestock_on_road: "Livestock on Road",
    traffic_signal_issue: "Traffic Signal Issue",
    downed_power_line: "Downed Power Line",
    emergency_response_activity: "Emergency Response Activity",
    other: "Other"
  });
  // Official-roadway provider copy is not presentation authority. These are
  // established consumer labels, keyed by semantic condition identity; an
  // unknown provider label remains verbatim rather than being title-cased.
  const OFFICIAL_ROADWAY_LABELS = Object.freeze({
    construction: "Construction",
    flooding: "Flooding",
    flood: "Flooding",
    high_water: "High Water",
    closure: "Closure",
    road_closed: "Road Closed",
    road_closure: "Road Closure",
    lane_closure: "Lane Closure",
    bridge_restriction: "Bridge Restriction",
    crash: "Crash",
    incident: "Incident",
    crash_incident: "Crash / Incident"
  });
  const OFFICIAL_ROADWAY_GROUP_LABELS = Object.freeze({
    lane_closures: "Lane Closures",
    road_closures: "Road Closures",
    bridge_restrictions: "Bridge Restrictions",
    construction: "Construction",
    flooding_high_water: "Flooding / High Water",
    crash_incident: "Crash / Incident",
    other: "Other"
  });
  const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const key = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const humanize = (value) => clean(value).replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const usableWeatherEvent = (value) => {
    const event = clean(value);
    return event && !/^(?:hazard|other hazard|other_hazard|weather|weather alert|alert)$/i.test(event) ? event : "";
  };

  function gridlyConditionDisplayLabel(context = {}) {
    const sourceFamily = key(context.sourceFamily);
    const canonicalKey = key(context.canonicalKey);
    const subtype = key(context.subtype);
    const trustedLabel = clean(context.trustedLabel || context.existingLabel);
    if (/weather|nws|noaa/.test(sourceFamily)) {
      return usableWeatherEvent(context.providerEvent) || usableWeatherEvent(trustedLabel) || "Weather Alert";
    }
    if (/crossing|rail/.test(sourceFamily)) {
      if (["blocked", "blocked_crossing", "crossing_blocked", "rail_crossing_blocked"].includes(canonicalKey)) return "Blocked Crossing";
      if (["rail_blockage_delay", "train_blocking_crossing"].includes(canonicalKey)) return "Train Blocking Crossing";
    }
    if (/community|report|road_hazard/.test(sourceFamily)) {
      if (canonicalKey === "other_hazard" && OTHER_HAZARD_SUBTYPE_LABELS[subtype]) return OTHER_HAZARD_SUBTYPE_LABELS[subtype];
      if (COMMUNITY_LABELS[canonicalKey]) return COMMUNITY_LABELS[canonicalKey];
    }
    if (/official|roadway|drivetexas|txdot/.test(sourceFamily)) {
      const isConditionGroup = key(context.displayRole) === "condition_group";
      const labels = isConditionGroup ? OFFICIAL_ROADWAY_GROUP_LABELS : OFFICIAL_ROADWAY_LABELS;
      if (isConditionGroup && labels[canonicalKey]) return labels[canonicalKey];
      const trustedKey = key(trustedLabel);
      if (labels[trustedKey]) return labels[trustedKey];
      // Concise summaries can be arbitrary provider prose. Only consult the
      // canonical key when there is no such presentation copy to preserve.
      if (trustedLabel) return trustedLabel;
      if (labels[canonicalKey]) return labels[canonicalKey];
      return clean(context.canonicalKey) || "Condition";
    }
    if (trustedLabel && !/[_]/.test(trustedLabel)) return trustedLabel;
    return humanize(context.canonicalKey || trustedLabel || "Condition");
  }

  return Object.freeze({ COMMUNITY_LABELS, OTHER_HAZARD_SUBTYPE_LABELS, OFFICIAL_ROADWAY_LABELS, OFFICIAL_ROADWAY_GROUP_LABELS, gridlyConditionDisplayLabel });
});
