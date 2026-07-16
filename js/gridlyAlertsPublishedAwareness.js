/*
 * Gridly Alerts Published Awareness Consumer
 *
 * Alerts is a detailed consumer of the already-published Current Conditions
 * awareness summary. Opening Alerts must not initiate authoritative rebuilding.
 */
"use strict";

function gridlyGetPublishedCommunityAwarenessSummaryForAlerts() {
  const communityPulseSummary = typeof gridlyCommunityPulseAuditState !== "undefined"
    ? gridlyCommunityPulseAuditState?.communityAwarenessSummary
    : null;
  const topAwarenessSummary = typeof window !== "undefined"
    ? window.gridlyTopAwarenessMicrolineState?.communityAwarenessSummary
    : null;
  const candidates = [communityPulseSummary, topAwarenessSummary];

  return candidates.find((summary) => (
    summary
    && typeof isGridlyCachedAwarenessSummaryForCurrentArea === "function"
    && isGridlyCachedAwarenessSummaryForCurrentArea(summary)
  )) || null;
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

      const location = normalizeGridlyCountyAwareDisplayText(
        consumerCard?.locationLabel ||
          consumerCard?.locationLine ||
          record?.locationLabel ||
          record?.roadName ||
          record?.primaryRoad ||
          record?.route ||
          record?.area ||
          record?.city ||
          "Nearby",
        record
      );

      const summary = normalizeGridlyCountyAwareDisplayText(
        record?.summary ||
          record?.description ||
          record?.details ||
          consumerCard?.summary ||
          `${title} affecting nearby travel.`,
        record
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
          record?.uuid ||
          `published-awareness-${index}`
      );

      return `
        <div
          class="gridly-alert-row gridly-alert-intel-card"
          data-gridly-alert-row="true"
          data-gridly-alert-id="${esc(id)}"
          data-gridly-alert-title="${esc(title)}"
          data-gridly-alert-location="${esc(location)}"
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
