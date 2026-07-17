/*
 * Gridly Alerts Published Awareness Consumer
 *
 * Alerts is a detailed consumer of the already-published Current Conditions
 * awareness summary. Opening Alerts must not initiate authoritative rebuilding.
 */
"use strict";


const GRIDLY_PUBLISHED_AWARENESS_TECHNICAL_METADATA_PATTERN = /(?:\b(?:future_source|txdot_incident|gridly_structured|canonicalDisplayLocation|canonicalLocationPhrase|structuredDisplayLocation|authoritativeLocationLabel|submittedCoordinate|county_id|countyId)\b|\[object Object\]|\{[^}]*\})/i;

function gridlyPublishedAwarenessCleanConsumerText(value = "") {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return "";

  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (GRIDLY_PUBLISHED_AWARENESS_TECHNICAL_METADATA_PATTERN.test(text)) return "";

  return text;
}


function gridlyPublishedAwarenessCrossingClassificationLabel(value = "") {
  const text = String(value || "").replace(/[\s_-]+/g, " ").trim();
  if (/^private(?: road)?$/i.test(text)) return "Private Crossing";
  if (/^restricted(?: access)?$/i.test(text)) return "Restricted Access Crossing";
  if (/^(?:public roadway|temporary access|rail yard|industrial|unknown)$/i.test(text)) return "";
  return text;
}

function gridlyPublishedAwarenessIsSuppressedCrossingClassification(value = "") {
  const text = String(value || "").replace(/[\s_-]+/g, " ").trim();
  return /^(?:public roadway|temporary access|rail yard|industrial|unknown)$/i.test(text);
}

function gridlyPublishedAwarenessCleanCrossingLocationCandidate(value = "") {
  const cleanText = gridlyPublishedAwarenessCleanConsumerText(value);
  if (!cleanText) return "";
  if (gridlyPublishedAwarenessIsSuppressedCrossingClassification(cleanText)) return "";
  return gridlyPublishedAwarenessCrossingClassificationLabel(cleanText);
}

function gridlyPublishedAwarenessReadPath(record = {}, path = []) {
  return path.reduce((current, key) => (
    current && typeof current === "object" ? current[key] : undefined
  ), record);
}

function gridlyGetPublishedAwarenessConsumerLocation(record = {}, fallback = "Nearby") {
  const meaningfulLocationPaths = [
    ["crossingName"],
    ["crossing_name"],
    ["resolvedCrossingName"],
    ["crossingRoad"],
    ["crossingLabel"],
    ["canonicalDisplayLocation"],
    ["canonicalLocationPhrase"],
    ["structuredDisplayLocation", "phrasing"],
    ["authoritativeLocationLabel"],
    ["strongestLocationLabel"],
    ["displayLocation"],
    ["knownLocation"],
    ["locationLabel"],
    ["resolvedLocationLabel"],
    ["nearbyLocationPhrase"],
    ["roadName"],
    ["primaryRoad"],
    ["route"],
    ["area"],
    ["city"]
  ];

  const normalizedCandidates = meaningfulLocationPaths
    .map((path) => gridlyPublishedAwarenessReadPath(record, path))
    .map((value) => (
      typeof normalizeGridlyCountyAwareDisplayText === "function"
        ? normalizeGridlyCountyAwareDisplayText(value, record)
        : value
    ))
    .map(gridlyPublishedAwarenessCleanCrossingLocationCandidate)
    .filter(Boolean);

  if (normalizedCandidates.length) return normalizedCandidates[0];

  const classificationCandidates = [
    record?.crossingClassification,
    record?.crossingType,
    record?.classification
  ]
    .map(gridlyPublishedAwarenessCleanCrossingLocationCandidate)
    .filter(Boolean);

  if (classificationCandidates.length) return classificationCandidates[0];

  return gridlyPublishedAwarenessCleanCrossingLocationCandidate(fallback) || "Nearby";
}

function gridlyGetPublishedAwarenessConsumerSummary(record = {}, title = "Travel Alert") {
  const candidates = [
    record?.summary,
    record?.description,
    record?.details
  ];

  const safeSummary = candidates
    .map((value) => (
      typeof normalizeGridlyCountyAwareDisplayText === "function"
        ? normalizeGridlyCountyAwareDisplayText(value, record)
        : value
    ))
    .map(gridlyPublishedAwarenessCleanConsumerText)
    .find(Boolean);

  return safeSummary || `${title} affecting nearby travel.`;
}

function gridlyGetPublishedCommunityAwarenessSummaryForAlerts() {
  const communityPulseSummary = typeof gridlyCommunityPulseAuditState !== "undefined"
    ? gridlyCommunityPulseAuditState?.communityAwarenessSummary
    : null;
  const topAwarenessSummary = typeof window !== "undefined"
    ? window.gridlyTopAwarenessMicrolineState?.communityAwarenessSummary
    : null;

  const validCandidates = [communityPulseSummary, topAwarenessSummary]
    .filter((summary) => (
      summary
      && typeof isGridlyCachedAwarenessSummaryForCurrentArea === "function"
      && isGridlyCachedAwarenessSummaryForCurrentArea(summary)
    ));

  if (!validCandidates.length) return null;

  return validCandidates.sort((left, right) => {
    const leftCount =
      (Array.isArray(left?.activeHazardsInArea) ? left.activeHazardsInArea.length : 0) +
      (Array.isArray(left?.activeReportsInArea) ? left.activeReportsInArea.length : 0);
    const rightCount =
      (Array.isArray(right?.activeHazardsInArea) ? right.activeHazardsInArea.length : 0) +
      (Array.isArray(right?.activeReportsInArea) ? right.activeReportsInArea.length : 0);

    if (rightCount !== leftCount) return rightCount - leftCount;

    const leftUpdatedAt = Date.parse(left?.lastUpdated || left?.generatedAt || left?.updatedAt || 0) || 0;
    const rightUpdatedAt = Date.parse(right?.lastUpdated || right?.generatedAt || right?.updatedAt || 0) || 0;
    return rightUpdatedAt - leftUpdatedAt;
  })[0];
}

function gridlyPublishedAwarenessRecordIsActive(record = {}) {
  if (!record || typeof record !== "object") return false;

  if (
    record.expired ||
    record.isExpired ||
    record.archived ||
    record.hidden
  ) {
    return false;
  }

  const lifecycle = String(
    record.lifecycleState ||
    record.lifecycle ||
    record.status ||
    record.state ||
    "active"
  ).toLowerCase();

  return !/(^|[_\s-])(cleared|expired|inactive|historical|removed|resolved|cancelled|canceled)([_\s-]|$)/.test(
    lifecycle
  );
}

function gridlyGetPublishedAwarenessAlertRecordsForCurrentArea(
  summary = null
) {
  const publishedSummary =
    summary &&
    isGridlyCachedAwarenessSummaryForCurrentArea(summary)
      ? summary
      : gridlyGetPublishedCommunityAwarenessSummaryForAlerts();

  if (!publishedSummary) return null;

  const hazards = Array.isArray(
    publishedSummary.activeHazardsInArea
  )
    ? publishedSummary.activeHazardsInArea
    : [];

  const reports = Array.isArray(
    publishedSummary.activeReportsInArea
  )
    ? publishedSummary.activeReportsInArea
    : [];

  return [...hazards, ...reports].filter(
    gridlyPublishedAwarenessRecordIsActive
  );
}

function gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords(
  records = []
) {
  const safeRecords = Array.isArray(records) ? records : [];

  if (!safeRecords.length) {
    return gridlyBuildNeutralAlertsSheetMarkup();
  }

  const rows = safeRecords
    .map((record, index) => {
      const consumerCard =
        typeof buildGridlyAlertCardConsumerModel === "function"
          ? buildGridlyAlertCardConsumerModel(record, {
              fallbackTitle:
                record?.title ||
                record?.headline ||
                record?.localizedSummary ||
                "Travel Alert"
            })
          : {};

      const title = normalizeGridlyCountyAwareDisplayText(
        consumerCard?.title ||
          record?.__gridlyEventSituationLabel ||
          record?.title ||
          record?.headline ||
          record?.localizedSummary ||
          record?.category ||
          record?.type ||
          "Travel Alert",
        record
      );

      const location = gridlyGetPublishedAwarenessConsumerLocation(
        record,
        consumerCard?.locationLabel || consumerCard?.locationLine || "Nearby"
      );

      const summary = gridlyGetPublishedAwarenessConsumerSummary(
        record,
        title
      );

      const freshness =
        typeof formatGridlyAlertsFreshnessLine === "function"
          ? formatGridlyAlertsFreshnessLine(
              record,
              consumerCard?.freshnessLine
            )
          : consumerCard?.freshnessLine ||
            record?.timeAgo ||
            "recently";

      const trust =
        typeof formatGridlyAlertsTrustLine === "function"
          ? formatGridlyAlertsTrustLine({
              report: record,
              count: Number(
                record?.count ||
                record?.confirmationCount ||
                1
              ),
              fallback: consumerCard?.trustLine
            })
          : consumerCard?.trustLine ||
            record?.trustLabel ||
            "Active report";

      const id = cleanDisplayValue(
        record?.id ||
          record?.reportId ||
          record?.incidentId ||
          record?.uuid ||
          `published-awareness-${index}`
      );
      const lat = Number(record?.lat ?? record?.latitude ?? record?.rawLat ?? record?.raw?.lat ?? record?.source?.lat);
      const lng = Number(record?.lng ?? record?.lon ?? record?.longitude ?? record?.rawLng ?? record?.raw?.lng ?? record?.raw?.lon ?? record?.source?.lng ?? record?.source?.lon);
      const coordAttrs = Number.isFinite(lat) && Number.isFinite(lng)
        ? ` data-gridly-alert-lat="${esc(lat)}" data-gridly-alert-lng="${esc(lng)}"`
        : "";

      return `
        <div
          class="gridly-alert-row gridly-alert-intel-card"
          data-gridly-alert-row="true"
          data-gridly-alert-id="${esc(id)}"
          data-gridly-alert-title="${esc(title)}"
          data-gridly-alert-location="${esc(location)}"
          data-gridly-alert-hazard-type="${esc(record?.hazardType || record?.type || record?.category || record?.providerId || "")}"
          data-gridly-alert-crossing-id="${esc(record?.crossingId || record?.crossing_id || record?.raw?.crossingId || "")}"
          ${coordAttrs}
          style="display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid rgba(255,255,255,0.09);border-radius:12px;background:linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.018));box-shadow:0 6px 20px rgba(0,0,0,0.28);margin-bottom:8px;"
        >
          <div style="width:18px;min-width:18px;height:18px;margin-top:1px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,179,71,0.18);border:1px solid rgba(255,179,71,0.5);color:#ffd28a;font-size:11px;line-height:1;">!</div>

          <div style="min-width:0;flex:1;display:grid;gap:4px;">
            <strong style="display:block;font-size:14px;line-height:1.3;color:#fff;">
              ${esc(title)}
            </strong>

            <div class="gridly-alert-location-line" style="font-size:11px;line-height:1.35;color:rgba(199,211,226,0.86);">
              ${esc(location)}
            </div>

            <div class="gridly-alert-situation-summary" style="font-size:12px;line-height:1.35;color:rgba(242,246,255,0.9);">
              ${esc(summary)}
            </div>

            <div class="gridly-alert-meta-line">
              <strong>Updated</strong>
              ${esc(String(freshness).replace(/^Updated\s*/i, ""))}
            </div>

            <div class="gridly-alert-trust-line">
              ${esc(trust)}
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div
      class="gridly-alerts-active"
      data-gridly-alerts-phase="published-awareness"
      style="padding:0 1px;"
    >
      <div class="gridly-v2-list">
        ${rows}
      </div>
    </div>
  `;
}

function openAlertsSurfaceFromDock() {
  gridlyLP012RecordAlertsClick("openAlertsSurfaceFromDock");
  window.gridlyStartupDiagnostics?.markInteractionProbe?.("clickHandler");
  window.gridlyStartupDiagnostics?.markPostPaintLifecycle?.("firstResponsiveInteraction");

  const handlerEnteredAt = gridlyAlertsOpenRefreshFixNow();
  const alertsSheetGeneration = gridlyBeginAlertsSheetLifecycle();
  gridlyBeginAlertsOpenRefreshFixTiming(handlerEnteredAt);

  const publishedSummary = gridlyGetPublishedCommunityAwarenessSummaryForAlerts();
  const publishedRecords = gridlyGetPublishedAwarenessAlertRecordsForCurrentArea(publishedSummary);
  window.__gridlyLatestAlertsForRender = Array.isArray(publishedRecords) ? publishedRecords : [];
  const initialContentSource = publishedRecords === null
    ? "shared-summary-unavailable"
    : (publishedRecords.length ? "published-awareness-summary" : "consumer-empty-state");
  const html = publishedRecords === null
    ? '<div class="gridly-alerts-active" data-gridly-alerts-phase="waiting-for-shared-summary"><div class="gridly-v2-list"><p class="gridly-v2-sheet-copy">Updating alerts…</p></div></div>'
    : gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords(publishedRecords);
  const title = "Alerts";

  const opened = typeof window.openGridlyPortraitV2Sheet === "function"
    ? Boolean(window.openGridlyPortraitV2Sheet("alerts", { title, html }))
    : (typeof openGridlyPortraitV2Sheet === "function"
      ? Boolean(openGridlyPortraitV2Sheet("alerts", { title, html }))
      : false);

  const sheetInsertedAt = gridlyAlertsOpenRefreshFixNow();
  if (typeof window.gridlyLp019BindAlertFocusHandlers === "function") window.setTimeout(() => window.gridlyLp019BindAlertFocusHandlers(document), 0);
  gridlyInstantAlertsSheetAuditState.lastOpen = {
    handlerEnteredAt,
    sheetInsertedAt,
    sheetVisibleAt: sheetInsertedAt,
    initialContentSource,
    cacheAvailable: false,
    cacheContextMatched: false,
    authoritativeBuildSkippedOnOpen: true,
    authoritativeBuildSkipReason: "alerts_open_is_cache_only",
    publishedAwarenessSummaryAvailable: Boolean(publishedSummary),
    publishedAwarenessRecordCount: Array.isArray(publishedRecords) ? publishedRecords.length : null,
    authoritativeBuildStartedAt: null,
    authoritativeBuildCompletedAt: null,
    authoritativeContentAppliedAt: null,
    sheetOpenDelayMs: Number((sheetInsertedAt - handlerEnteredAt).toFixed(2)),
    authoritativeBuildDurationMs: null,
    sheetWaitedForAuthoritativeBuild: false,
    duplicateBuildPrevented: false,
    sheetReopenedDuringUpdate: false,
    duplicateCardsDetected: false,
    alertsSheetGeneration,
    lateResultIgnoredCount: gridlyAlertsSheetLifecycleState.lateResultIgnoredCount
  };

  gridlyRecordAlertsOpenRefreshFixTiming({
    sheetVisibleAt: sheetInsertedAt,
    initialCardsRenderedAt: Array.isArray(publishedRecords) && publishedRecords.length
      ? sheetInsertedAt
      : null,
    sheetOpenDelayMs: Number((sheetInsertedAt - handlerEnteredAt).toFixed(2)),
    waitedForBackgroundRefresh: false
  });

  return opened;
}

window.gridlyGetPublishedCommunityAwarenessSummaryForAlerts =
  gridlyGetPublishedCommunityAwarenessSummaryForAlerts;
window.gridlyGetPublishedAwarenessAlertRecordsForCurrentArea =
  gridlyGetPublishedAwarenessAlertRecordsForCurrentArea;
window.gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords =
  gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords;
window.openAlertsSurfaceFromDock = openAlertsSurfaceFromDock;
