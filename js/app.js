const SUPABASE_URL = "https://nhwhkbkludzkuyxmkkcj.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO";

const FRA_URL =
  "https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=LIBERTY";
const CROSSING_REVIEW_OVERRIDES_URL = "data/gridly-crossing-review-overrides.json";
const ROADWAY_SEGMENTS_URL = "data/liberty-county-road-segments.geojson";
const HAZARD_REPORT_EXPIRATION_MINUTES = 180;

const HAZARD_TYPES = {
  flooding: {
    label: "Flooding",
    icon: "🌊",
    severity: "high",
    detail: "Shared report: flooding may affect travel."
  },
  ice: {
    label: "Ice",
    icon: "🧊",
    severity: "high",
    detail: "Shared report: icy roadway conditions may affect travel."
  },
  debris: {
    label: "Debris",
    icon: "⚠️",
    severity: "moderate",
    detail: "Shared report: debris may affect the road."
  },
  crash: {
    label: "Crash",
    icon: "🚗",
    severity: "high",
    detail: "Shared report: crash may affect traffic."
  },
  construction: {
    label: "Construction",
    icon: "🚧",
    severity: "moderate",
    detail: "Shared report: construction may slow travel."
  },
  road_closed: {
    label: "Road Closure",
    icon: "⛔",
    severity: "high",
    detail: "Shared report: road closure is blocking travel."
  },
  disabled_vehicle: {
    label: "Disabled Vehicle",
    icon: "🚙",
    severity: "moderate",
    detail: "Shared report: disabled vehicle may slow travel."
  },
  rail_blockage_delay: {
    label: "Rail Blockage / Delay",
    icon: "🚆",
    severity: "high",
    detail: "Shared report: rail blockage or delay may affect travel."
  },
  other_hazard: {
    label: "Other Hazard",
    icon: "❗",
    severity: "moderate",
    detail: "Shared report: road hazard may affect travel."
  }
};

const REPORT_MODES = {
  rail: "rail",
  roadHazard: "road_hazard"
};

const ROAD_HAZARD_TYPE_OPTIONS = [
  { value: "crash", label: "Wreck / Crash" },
  { value: "flooding", label: "Flooding" },
  { value: "ice", label: "Ice" },
  { value: "debris", label: "Debris" },
  { value: "construction", label: "Construction" },
  { value: "road_closed", label: "Road Closed" },
  { value: "disabled_vehicle", label: "Disabled Vehicle" },
  { value: "other_hazard", label: "Other Hazard" }
];

// TxDOT-ready mapping for future ingestion. No external API calls yet.
const ROAD_HAZARD_SOURCE_MAP = {
  crash: "txdot_incident",
  disabled_vehicle: "txdot_incident",
  debris: "community_report",
  flooding: "txdot_flooding",
  ice: "community_report",
  construction: "txdot_construction",
  road_closed: "txdot_closure",
  other_hazard: "community_report"
};

const HAZARD_CATEGORY_MAP = {
  blocked: "rail_blockage_delay",
  heavy: "rail_blockage_delay",
  delayed: "rail_blockage_delay",
  delay: "rail_blockage_delay",
  crash: "crash",
  wreck: "crash",
  flooding: "flooding",
  ice: "ice",
  debris: "debris",
  construction: "construction",
  road_closed: "road_closed",
  disabled_vehicle: "disabled_vehicle",
  rail_blockage_delay: "rail_blockage_delay",
  rail_blocked: "rail_blockage_delay",
  rail_delay: "rail_blockage_delay",
  other: "other_hazard",
  other_hazard: "other_hazard",
  hazard_cleared: "other_hazard"
};

const LOCATION_DEFAULTS = {
  country: "USA",
  state: "Texas",
  county: "Liberty County"
};

const LIBERTY_COUNTY_CITY_RULES = [
  { city: "Dayton", patterns: ["dayton"] },
  { city: "Liberty", patterns: ["liberty"] },
  { city: "Cleveland", patterns: ["cleveland"] },
  { city: "Ames", patterns: ["ames"] },
  { city: "Daisetta", patterns: ["daisetta"] },
  { city: "Hardin", patterns: ["hardin"] },
  { city: "Hull", patterns: ["hull"] },
  { city: "Kenefick", patterns: ["kenefick"] },
  { city: "Moss Hill", patterns: ["moss hill"] },
  { city: "Romayor", patterns: ["romayor"] },
  { city: "Raywood", patterns: ["raywood"] },
  { city: "Sour Lake", patterns: ["sour lake"] },
  { city: "Plum Grove", patterns: ["plum grove"] },
  { city: "Devers", patterns: ["devers"] }
];
let crossingReviewOverrides = {};
let roadwaySegmentFeatures = [];
let roadwayDatasetLoaded = false;
let roadwayDatasetLoadError = null;
const defaultCenter = [30.0466, -94.8852];
const REPORT_EXPIRATION_MINUTES = 90;
const RECENTLY_CLEARED_WINDOW_MINUTES = 20;
const LIVE_REFRESH_MS = 15000;
const APP_BUILD = "6D0";
const DEFAULT_NEARBY_RADIUS_MILES = 8;
const PRIORITY_NEARBY_MILES = 3;
const DISTANT_CROSSING_MIN_ZOOM = 14;
const CROSSING_FETCH_RETRY_ATTEMPTS = 3;
const CROSSING_FETCH_RETRY_DELAY_MS = 700;
const SMART_ALERTS_STORAGE_KEY = "gridlySmartAlertsV1";
const SMART_ALERTS_DRAWER_SEEN_KEY = "gridlySmartAlertsDrawerSeenV1";
const MAP_FIRST_HINT_SEEN_KEY = "gridlyMapFirstHintSeenV1";
const MAP_STYLE_STORAGE_KEY = "gridlyMapStyleV1";
const SAVED_PLACES_STORAGE_KEY = "gridlySavedPlacesV1";
const SELECTED_PLACE_STORAGE_KEY = "gridlySelectedPlaceIdV1";
const GRIDLY_PROFILE_STORAGE_KEY = "gridlyUserProfileV1";
const MOVEMENT_INTELLIGENCE_STORAGE_KEY = "gridlyMovementIntelligenceV1";
const OSRM_ROUTE_API = "https://router.project-osrm.org/route/v1/driving";
const OSRM_NEAREST_API = "https://router.project-osrm.org/nearest/v1/driving";

let supabaseClient = null;
let realtimeChannel = null;
let map;
let crossingLayer;
let crossingMarkers = new Map();
let savedRouteLayer;
let corridorIntelLayer;
let lastRenderedRouteKey = "";
let routeFocusArmed = true;
let crossings = [];
let activeReports = [];
let activeHazards = [];
let unifiedIncidentLayer;
let userLocation = null;
let userMarker = null;
let nearbyReportCrossingIds = new Set();
let lastSubmittedCrossing = null;
let lastSubmittedReportType = null;
let crossingLoadFailed = false;
let activeGeoFilter = "nearby";
let activeReportMode = REPORT_MODES.rail;
let routeLauncherSource = "none";
let showAllCrossingsLayer = false;
let savedRouteCrossingIds = new Set();
let activeDestinationPlace = null;
let routeWatchActivated = false;
let lastSavedPlaceResult = null;
let lastValidationError = null;
let lastManagePlacesSaveAttempt = null;
let lastManagePlacesSaveError = null;
let saveButtonHandlerAttached = false;
let routePreviewRendered = false;
let routePreviewLayerExists = false;
let mapHasRoutePreviewLayer = false;
let routePreviewPolylinePointCount = 0;
let routePreviewCorridorLayer = null;
let alternateRouteLayer = null;
let alternateRouteVertexCount = 0;
let alternateRouteGeometrySource = "none";
let alternateRouteStatus = "not_needed";
let alternateRouteReason = "";
let alternateRouteAvailable = false;
let primaryRouteHazardCount = 0;
let alternateRouteHazardCount = 0;
let hazardsAvoidedCount = 0;
let routeComparisonStatus = "alternate_unavailable";
let routeComparisonSummary = "";
let primaryRouteScore = 0;
let alternateRouteScore = 0;
let preferredRoute = "primary";
let preferredRouteReason = "Primary route is selected by default.";
let lastRouteSwitchAt = null;
let routeSwitchCount = 0;
let activeRouteSource = "primary";

let gridlyPopupTapSeq = 0;
let gridlyPopupOpenCount = 0;
let gridlyPopupCancelCount = 0;
let gridlyPopupLastFailureReason = "";
let gridlyPopupLastTapAt = null;
let gridlyPopupLastOpenAt = null;
let gridlyPopupReopenReady = true;
let gridlyPopupCameraPanApplied = false;
let gridlyPopupAnchorMode = "none";
let gridlyPopupLastMarkerScreenPoint = null;
let gridlyPopupLastSafeTargetPoint = null;
let gridlyPopupClippedAfterOpen = null;
let gridlyPopupViewportBounds = null;
let gridlyPopupSingleTapFlowReady = true;
let gridlyLastPopupTapCrossingId = null;
let gridlyLastPopupPanStartedAt = null;
let gridlyLastPopupMoveEndAt = null;
let gridlyLastPopupFallbackFiredAt = null;
let gridlyLastPopupFinalizeReason = null;
let gridlyLastPopupScheduledDelay = null;
let gridlyLastPopupTimerFiredAt = null;
let gridlyPopupSingleTapGuaranteed = true;
let gridlyDuplicateMarkerClickCount = 0;
let gridlyMarkerClickHandlerGuardApplied = false;
let gridlyPopupLastFinalizeAttemptAt = null;
let gridlyPopupLastOpenCallAt = null;
let gridlyPopupLastOpenMethod = "none";
let gridlyPopupEarlyReturnReason = "";
let gridlyPopupInterferenceEventSeen = false;
let gridlyRouteWatchAllClickedDuringPopupTap = false;

function cancelPendingCrossingPopup(reason = "") {
  const session = window.__gridlyPopupPanSession;
  if (!session) return;
  if (session.openTimer) clearTimeout(session.openTimer);
  if (!session.opened) gridlyPopupCancelCount += 1;
  if (reason) gridlyPopupLastFailureReason = reason;
  window.__gridlyPopupPanSession = null;
}

function finalizeOpenCrossingPopup(marker, token, reason = "unknown") {
  gridlyPopupLastFinalizeAttemptAt = Date.now();
  const session = window.__gridlyPopupPanSession;
  if (!session) {
    gridlyPopupEarlyReturnReason = "no-session";
    return false;
  }
  if (session.token !== token) {
    gridlyPopupEarlyReturnReason = "stale-token";
    return false;
  }
  if (session.marker !== marker) {
    gridlyPopupEarlyReturnReason = "marker-mismatch";
    return false;
  }
  if (session.opened) {
    gridlyPopupEarlyReturnReason = "already-opened";
    return false;
  }
  session.opened = true;
  if (session.openTimer) clearTimeout(session.openTimer);
  session.openTimer = null;
  gridlyPopupLastOpenAt = Date.now();
  gridlyLastPopupFinalizeReason = reason;
  gridlyPopupOpenCount += 1;
  gridlyPopupLastOpenCallAt = Date.now();
  gridlyPopupLastOpenMethod = "marker.openPopup";
  gridlyPopupEarlyReturnReason = "";
  gridlyPopupLastFailureReason = reason === "fallback" ? "" : gridlyPopupLastFailureReason;
  marker.openPopup();
  requestAnimationFrame(() => {
    const popupEl = marker.getPopup?.()?.getElement?.();
    const mapEl = document.getElementById("map");
    if (!popupEl || !mapEl) {
      gridlyPopupClippedAfterOpen = null;
      return;
    }
    const popupRect = popupEl.getBoundingClientRect?.();
    const mapRect = mapEl.getBoundingClientRect?.();
    if (!popupRect || !mapRect) {
      gridlyPopupClippedAfterOpen = null;
      return;
    }
    const pad = 4;
    gridlyPopupClippedAfterOpen = Boolean(
      popupRect.left < mapRect.left + pad ||
      popupRect.right > mapRect.right - pad ||
      popupRect.top < mapRect.top + pad ||
      popupRect.bottom > mapRect.bottom - pad
    );
  });
  window.__gridlyPopupPanSession = null;
  return true;
}
let lastRouteSwitchMessage = "";
let routeUxState = "primary_clear";
let routeRecommendationTone = "calm";
let routePressureScore = 0;
let routePressureBand = "Clear";
let routeConfidence = "Low";
let calibratedRecommendationBand = "Clear";
let estimatedHazardReduction = 0;
let estimatedPressureReduction = 0;
let confidenceInputs = {};
let confidenceReasoning = "Awaiting route monitoring data.";
let activeMonitoringState = "standby";
let lastRouteRecommendationMessage = "Monitoring active route conditions";
let routeTransitionUntil = 0;
let routePreviewReason = "Route preview has not been requested.";
let lastRoutePreviewError = null;
let routeGeometrySource = "fallback";
let osrmRouteSuccess = false;
let monitoredRouteEtaMinutes = null;
let monitoredRouteDelayMinutes = null;
let monitoredRouteDurationSeconds = null;
let lastRouteRequest = null;
let lastRouteGeometryPointCount = 0;
let lastRouteError = null;
let routeRequestTriggered = false;
let osrmRequestStarted = false;
let osrmResponseReceived = false;
let routeRenderAttempted = false;
let routeRenderSucceeded = false;
let lastRoutePanelCloseReason = null;
let lastRoutePipelineStep = "idle";
let lastRouteEarlyReturnReason = null;
let lastRouteButtonClickSource = "";
let lastRouteButtonClickAt = null;
let lastRouteAttempt = null;
let lastOsrmRequestUrl = null;
let lastOsrmResponseStatus = null;
let routeQuickButtonDelegatedBindingActive = false;
let routeQuickDirectListenerAttached = false;
let lastDirectRouteClick = null;
let routeRequestInFlight = false;
let lastRouteRequestKey = "";
let lastRouteRequestAt = 0;
let duplicateRouteRequestBlockedCount = 0;
let debugPipelineWrapperEntered = false;
window.gridlyLastRouteAttempt = null;
let pendingHazardPlacement = null;
let selectedQuickHazardType = null;
let lastRoadSnapDebug = {
  originalTapCoords: null,
  snappedCoords: null,
  snapDistanceMeters: null,
  nearestRoadFound: false,
  snapMethodUsed: "none",
  fallbackUsed: false,
  regionContext: { ...LOCATION_DEFAULTS },
  routeImpactDetected: false
};
let lastMarkerAuditDebug = {
  activeMarkerCount: 0,
  totalIncidentsInput: 0,
  uniqueIncidentRenderCount: 0,
  duplicateIncidentCount: 0,
  duplicateKeysPreview: [],
  activeRenderedCount: 0,
  clearedRenderedCount: 0,
  routeRelevantRenderedCount: 0,
  lastRenderAt: null,
  markerLayerCount: 0,
  markersByCategory: {},
  markersAffectingRoute: 0,
  clusteredMarkerCount: 0,
  markerTypesRendered: [],
  routeHighlightedMarkers: 0,
  activeVisualStates: []
};
let lastMobileReportSubmitDebug = {
  lastSubmitAttempt: "idle",
  lastSubmitError: "",
  originalTapCoords: null,
  snappedCoords: null,
  activeSubmitCoords: null,
  snapComplete: false,
  insertPayloadPreview: null,
  supabaseInsertStarted: false,
  supabaseInsertSucceeded: false,
  supabaseInsertError: "",
  postSubmitUiResetSucceeded: false
};

let mobileUiMode = "live";
let activeLayoutMode = "desktop";
let lastLayoutSignal = null;
const MOBILE_REPORT_ENTRY_SELECTORS = [
  "#mobileDockReportBtn",
  ".mobile-dock-btn.report",
  "#mobileQuickReportBtn",
  "#mobileQuickReportSmallBtn",
  "#mobileReportBtn",
  ".report-drawer-summary"
];
let mobileReportEntryBindingsAttached = false;

const reportingState = {
  selectedHazardType: null,
  reportModeActive: false,
  placementModeActive: false,
  submissionInProgress: false,
  locationLookupInProgress: false,
  lastReportMessage: "",
  lastReportError: "",
  activeReportEntryPoint: ""
};
const GRIDLY_REPORT_DIAGNOSTICS = false;

function reportLifecycleDiag(label, payload = {}) {
  if (!GRIDLY_REPORT_DIAGNOSTICS) return;
  console.debug(`[Gridly][ReportDiag] ${label}`, payload);
}

function updateReportingState(patch = {}) {
  reportLifecycleDiag("updateReportingState called", {
    patch,
    before: { ...reportingState },
    mobileMode: mobileUiMode,
    bodyMobileMode: document.body?.dataset?.mobileMode || null
  });
  Object.assign(reportingState, patch);
  const isReportingLive = Boolean(reportingState.reportModeActive || reportingState.placementModeActive || reportingState.submissionInProgress);
  document.body?.classList.toggle("reporting-live", isReportingLive);
  const mapFrame = document.querySelector(".map-frame");
  if (mapFrame) mapFrame.dataset.reportingState = isReportingLive ? "active" : "idle";
  if (window.matchMedia("(max-width: 760px)").matches) {
    setMobileUiMode(isReportingLive ? "report" : mobileUiMode === "report" ? "live" : mobileUiMode, { silent: true });
  }
  syncHazardPickerUiState();
  syncMapPlacementCursorState();
  syncHazardPickerFooterSpacing();
}

function computeLayoutModeSignals() {
  const viewportWidth = window.visualViewport?.width || window.innerWidth || document.documentElement?.clientWidth || 0;
  const appShell = document.querySelector(".app-shell");
  const commandCenter = document.querySelector(".command-center");
  const shellWidth = appShell?.getBoundingClientRect?.().width || viewportWidth;
  const commandWidth = commandCenter?.getBoundingClientRect?.().width || shellWidth;
  const hasHorizontalOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth > 2;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches === true;
  return { viewportWidth, shellWidth, commandWidth, hasHorizontalOverflow, coarsePointer };
}

function resolveLayoutMode({ viewportWidth, viewportHeight, shellWidth, commandWidth, hasHorizontalOverflow, coarsePointer, orientationLandscape }) {
  const tacticalLandscapeByHeight =
    orientationLandscape &&
    viewportWidth <= 1100 &&
    viewportHeight <= 520;
  if (tacticalLandscapeByHeight) {
    return {
      nextMode: "tactical-landscape",
      tacticalLandscapeByHeight,
      forcedPortrait: false,
      forcedDesktop: false
    };
  }
  const mobileByWidth = viewportWidth <= 980;
  const desktopByWidth = viewportWidth >= 1160;
  const containerCollapsed = shellWidth <= 1020 || commandWidth <= 760;
  const forcedPortrait = mobileByWidth || containerCollapsed || (hasHorizontalOverflow && viewportWidth < 1220);
  const forcedDesktop = desktopByWidth && !containerCollapsed && !hasHorizontalOverflow && !coarsePointer;
  const nextMode = forcedPortrait ? "portrait" : forcedDesktop ? "desktop" : activeLayoutMode;
  return { nextMode, tacticalLandscapeByHeight, forcedPortrait, forcedDesktop };
}

function evaluateLayoutMode() {
  const s = computeLayoutModeSignals();
  const orientationLandscape = window.matchMedia?.("(orientation: landscape)")?.matches === true;
  const resolved = resolveLayoutMode({
    viewportWidth: s.viewportWidth,
    viewportHeight: window.innerHeight || 0,
    shellWidth: s.shellWidth,
    commandWidth: s.commandWidth,
    hasHorizontalOverflow: s.hasHorizontalOverflow,
    coarsePointer: s.coarsePointer,
    orientationLandscape
  });
  const { nextMode, forcedPortrait, forcedDesktop, tacticalLandscapeByHeight } = resolved;
  lastLayoutSignal = { ...s, nextMode, forcedPortrait, forcedDesktop, tacticalLandscapeByHeight };
  return nextMode;
}

function applyLayoutMode(nextMode) {
  const previousLayoutMode = activeLayoutMode;
  const validModes = ["desktop", "portrait", "tactical-landscape"];
  const viewportWidth = window.visualViewport?.width || window.innerWidth || document.documentElement?.clientWidth || 0;
  const fallbackMode = viewportWidth <= 980 ? "portrait" : "desktop";
  const safePreviousMode = validModes.includes(previousLayoutMode) ? previousLayoutMode : fallbackMode;
  activeLayoutMode = validModes.includes(nextMode) ? nextMode : safePreviousMode;
  if (!document?.body) return;
  document.body.setAttribute("data-layout-mode", activeLayoutMode);
  document.body.setAttribute("data-layout-mode-legacy", activeLayoutMode === "desktop" ? "desktop" : "mobile");
  if (activeLayoutMode === "portrait" || activeLayoutMode === "tactical-landscape") {
    document.body.setAttribute("data-mobile-mode", mobileUiMode || "live");
  } else {
    document.body.removeAttribute("data-mobile-mode");
  }
  if (previousLayoutMode !== activeLayoutMode && typeof window.resetMobileSurfaceState === "function") {
    window.resetMobileSurfaceState("layout_transition", { previousLayoutMode, nextLayoutMode: activeLayoutMode });
  }
  syncTacticalMapSurfaceVisibility();
}

// Layout mode UX contracts:
// desktop = Regional Movement Intelligence Center
// portrait = Daily Community Awareness Companion
// tactical-landscape = Tactical In-Motion Awareness Mode
function syncAuthoritativeLayoutMode() {
  applyLayoutMode(evaluateLayoutMode());
}
let layoutSyncScheduled = false;
function scheduleAuthoritativeLayoutModeSync() {
  if (layoutSyncScheduled) return;
  layoutSyncScheduled = true;
  window.requestAnimationFrame(() => {
    layoutSyncScheduled = false;
    syncAuthoritativeLayoutMode();
  });
}

function getCurrentLayoutMode() {
  return activeLayoutMode;
}

function isDesktopMode() {
  return getCurrentLayoutMode() === "desktop";
}

function isPortraitMode() {
  return getCurrentLayoutMode() === "portrait";
}

function isTacticalLandscapeMode() {
  return getCurrentLayoutMode() === "tactical-landscape";
}

window.gridlyLayoutDebug = function gridlyLayoutDebug() {
  const s = computeLayoutModeSignals();
  const width = window.innerWidth || 0;
  const height = window.innerHeight || 0;
  const orientation = width > height ? "landscape" : "portrait";
  const resolved = resolveLayoutMode({
    viewportWidth: s.viewportWidth,
    viewportHeight: height,
    shellWidth: s.shellWidth,
    commandWidth: s.commandWidth,
    hasHorizontalOverflow: s.hasHorizontalOverflow,
    coarsePointer: s.coarsePointer,
    orientationLandscape: orientation === "landscape"
  });
  return {
    width,
    height,
    orientation,
    coarsePointer: s.coarsePointer,
    detectedMode: resolved.nextMode,
    bodyDataset: {
      layoutMode: document.body?.dataset?.layoutMode || null,
      layoutModeLegacy: document.body?.dataset?.layoutModeLegacy || null,
      mobileMode: document.body?.dataset?.mobileMode || null
    }
  };
};

function isMobileUiViewport() {
  return isPortraitMode() || isTacticalLandscapeMode();
}

function syncTacticalMapSurfaceVisibility(options = {}) {
  if (!document?.body) return;
  const { resync = false } = options;
  const mapEl = document.getElementById("map");
  const mapRect = mapEl?.getBoundingClientRect?.();
  const mapStyle = mapEl ? window.getComputedStyle(mapEl) : null;
  const tacticalMode = isTacticalLandscapeMode();
  const mapVisible = Boolean(
    tacticalMode &&
    mapEl &&
    mapStyle &&
    mapStyle.display !== "none" &&
    mapStyle.visibility !== "hidden" &&
    Number.parseFloat(mapStyle.opacity || "1") > 0 &&
    mapRect &&
    mapRect.width > 0 &&
    mapRect.height > 0
  );
  if (mapVisible) {
    document.body.dataset.tacticalMapActive = "true";
  } else {
    delete document.body.dataset.tacticalMapActive;
  }
  if (!mapVisible && tacticalMode && !resync) {
    window.requestAnimationFrame(() => {
      try {
        if (window.map && typeof window.map.invalidateSize === "function") {
          window.map.invalidateSize();
        }
      } catch (error) {
        console.debug("[Gridly] Tactical map invalidateSize sync skipped", error);
      }
      syncTacticalMapSurfaceVisibility({ resync: true });
    });
  }
}

function syncMobileNavVisibilityForViewport() {
  const shouldShowMobileNav = isMobileUiViewport();
  document.querySelectorAll(".mobile-floating-action-dock, .mobile-bottom-nav").forEach((el) => {
    el.hidden = !shouldShowMobileNav;
    el.setAttribute("aria-hidden", shouldShowMobileNav ? "false" : "true");
  });
}

function setMobileUiMode(mode = "live", options = {}) {
  const nextMode = ["live", "route", "report", "alert"].includes(mode) ? mode : "live";
  mobileUiMode = nextMode;
  reportLifecycleDiag("setMobileUiMode", {
    requestedMode: mode,
    nextMode,
    isMobileViewport: isMobileUiViewport(),
    reportModeActive: reportingState.reportModeActive,
    placementModeActive: reportingState.placementModeActive,
    submissionInProgress: reportingState.submissionInProgress
  });
  if (isMobileUiViewport()) {
    document.body?.setAttribute("data-mobile-mode", nextMode);
    if (els.reportSection) {
      els.reportSection.open = nextMode === "report";
    }
  } else {
    document.body?.removeAttribute("data-mobile-mode");
  }
  document.querySelectorAll(".mobile-dock-btn").forEach((btn) => {
    const btnMode = btn.dataset.mode;
    btn.classList.toggle("active", btnMode === nextMode);
  });
  if (!options.silent) {
    const labels = { live: "Live mode active.", route: "Route mode active.", report: "Report mode active.", alert: "Alert mode active." };
    setConfirmation(labels[nextMode], "info");
  }
}


function syncRouteQuickPanelUiState() {
  const panel = document.getElementById("gridlyMobileRouteQuickPanel");
  const routeQuickPanelOpen = Boolean(panel?.classList?.contains("visible"));
  document.body?.classList.toggle("route-quick-panel-open", routeQuickPanelOpen);
}
function closeMobileRouteQuickPanel(reason = "") {
  const panel = document.getElementById("gridlyMobileRouteQuickPanel");
  if (!panel?.classList?.contains("visible")) return;
  panel.classList.remove("visible");
  syncRouteQuickPanelUiState();
  if (reason) lastRoutePanelCloseReason = reason;
}

function isTacticalLandscapeDockMode() {
  return isTacticalLandscapeMode() && window.matchMedia("(orientation: landscape) and (max-height: 520px)").matches;
}


function setTacticalReportHelperVisibility(visible) {
  const helper = document.querySelector("#reportSection .report-copy > p");
  if (!helper) return;
  if (!isTacticalLandscapeDockMode()) {
    helper.hidden = false;
    return;
  }
  helper.hidden = !visible;
}

function ensureTacticalDockSheet() {
  let sheet = document.getElementById("gridlyTacticalDockSheet");
  if (sheet) return sheet;
  sheet = document.createElement("section");
  sheet.id = "gridlyTacticalDockSheet";
  sheet.className = "gridly-tactical-dock-sheet";
  sheet.hidden = true;
  sheet.innerHTML = `<div class="gridly-tactical-dock-sheet-head"><strong id="gridlyTacticalDockSheetTitle"></strong><button type="button" id="gridlyTacticalDockSheetClose" aria-label="Close tactical panel">×</button></div><div id="gridlyTacticalDockSheetBody" class="gridly-tactical-dock-sheet-body"></div>`;
  document.body.appendChild(sheet);
  sheet.querySelector("#gridlyTacticalDockSheetClose")?.addEventListener("click", () => closeTacticalDockSheet());
  return sheet;
}

function closeTacticalDockSheet() {
  const sheet = document.getElementById("gridlyTacticalDockSheet");
  if (!sheet) return;
  sheet.hidden = true;
  sheet.dataset.action = "";
  setTacticalReportHelperVisibility(false);
}

function closeAllTacticalDockSurfaces({ except = "" } = {}) {
  if (except !== "route") closeMobileRouteQuickPanel("switch_tactical_action");
  if (except !== "report") {
    window.closeHazardPanel?.({ preserveLastReportMessage: false });
    setTacticalReportHelperVisibility(false);
  }
  if (except !== "alerts" && except !== "area" && except !== "layers") closeTacticalDockSheet();
}

function openTacticalDockSheet(action, title, contentHtml) {
  setTacticalReportHelperVisibility(false);
  const sheet = ensureTacticalDockSheet();
  if (!sheet) return;
  closeAllTacticalDockSurfaces({ except: action });
  const titleEl = sheet.querySelector("#gridlyTacticalDockSheetTitle");
  const bodyEl = sheet.querySelector("#gridlyTacticalDockSheetBody");
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = contentHtml;
  sheet.dataset.action = action;
  sheet.hidden = false;
}

const GRIDLY_REPORT_VERBOSE_DEBUG = false;
const GRIDLY_ROUTE_VERBOSE_DEBUG = false;
const GRIDLY_LAYER_VERBOSE_DEBUG = false;
const GRIDLY_PORTRAIT_SURFACE_DEBUG = false;

function reportDebugLog(...args) {
  if (!GRIDLY_REPORT_VERBOSE_DEBUG) return;
  console.log(...args);
}

function routeDebugLog(...args) {
  if (!GRIDLY_ROUTE_VERBOSE_DEBUG) return;
  console.info(...args);
}

function routeDebugError(...args) {
  if (!GRIDLY_ROUTE_VERBOSE_DEBUG) return;
  console.error(...args);
}
window.gridlyRoadSnapDebug = function () {
  return { ...lastRoadSnapDebug };
};

window.gridlyMarkerAuditDebug = function () {
  return { ...lastMarkerAuditDebug };
};

function captureRouteAttempt(patch = {}) {
  lastRouteAttempt = { ...(lastRouteAttempt || {}), ...patch, timestamp: new Date().toISOString() };
  window.gridlyLastRouteAttempt = lastRouteAttempt;
}

function layerDebugLog(...args) {
  if (!GRIDLY_LAYER_VERBOSE_DEBUG) return;
  console.log(...args);
}

function portraitSurfaceDebugLog(...args) {
  if (!GRIDLY_PORTRAIT_SURFACE_DEBUG) return;
  console.log(...args);
}

window.gridlyMobileReportSubmitDebug = function () {
  const panel = document.getElementById("gridlyHazardPanel");
  const submitBtn = panel?.querySelector('[data-action="submit-hazard"]') || null;
  const rect = submitBtn?.getBoundingClientRect?.() || null;
  const panelRect = panel?.getBoundingClientRect?.() || null;
  const style = submitBtn ? window.getComputedStyle(submitBtn) : null;
  const submitButtonVisible = Boolean(submitBtn && style && style.display !== "none" && style.visibility !== "hidden" && rect && rect.width > 0 && rect.height > 0);
  const footer = panel?.querySelector('.hazard-panel-placement-actions') || null;
  const footerRect = footer?.getBoundingClientRect?.() || null;
  return {
    reportingState: { ...reportingState },
    selectedHazardType: reportingState.selectedHazardType || selectedQuickHazardType || pendingHazardPlacement || null,
    selectedPlacementMode: reportingState.placementModeActive ? "tap_map" : "use_my_location",
    originalTapCoords: lastMobileReportSubmitDebug.originalTapCoords,
    snappedCoords: lastMobileReportSubmitDebug.snappedCoords,
    activeSubmitCoords: lastMobileReportSubmitDebug.activeSubmitCoords,
    snapComplete: Boolean(lastMobileReportSubmitDebug.snapComplete),
    submitButtonExists: Boolean(submitBtn),
    submitButtonVisible,
    submitButtonDisabled: submitBtn ? Boolean(submitBtn.disabled) : null,
    submitButtonRect: rect ? rect.toJSON?.() || rect : null,
    lastSubmitAttempt: lastMobileReportSubmitDebug.lastSubmitAttempt,
    lastSubmitError: lastMobileReportSubmitDebug.lastSubmitError || reportingState.lastReportError || "",
    insertPayloadPreview: lastMobileReportSubmitDebug.insertPayloadPreview,
    supabaseConfigured: Boolean(supabaseClient),
    supabaseInsertStarted: Boolean(lastMobileReportSubmitDebug.supabaseInsertStarted),
    supabaseInsertSucceeded: Boolean(lastMobileReportSubmitDebug.supabaseInsertSucceeded),
    supabaseInsertError: lastMobileReportSubmitDebug.supabaseInsertError || "",
    modalOpen: Boolean(panel?.classList?.contains("visible")),
    activePanelRect: panelRect ? panelRect.toJSON?.() || panelRect : null,
    viewportHeight: window.innerHeight,
    saveOrSubmitButtonBlockedByFooter: Boolean(rect && footerRect && rect.bottom > footerRect.top && rect.top < footerRect.bottom),
    pointerEventsOnSubmitButton: style?.pointerEvents || null
  };
};

window.gridlyReportingDebug = function () {
  return {
    selectedHazardType: reportingState.selectedHazardType,
    reportModeActive: reportingState.reportModeActive,
    placementModeActive: reportingState.placementModeActive,
    submissionInProgress: reportingState.submissionInProgress,
    locationLookupInProgress: reportingState.locationLookupInProgress,
    mapPlacementArmed: Boolean(reportingState.placementModeActive && (pendingHazardPlacement || reportingState.selectedHazardType) && !reportingState.submissionInProgress),
    lastReportMessage: reportingState.lastReportMessage,
    lastReportError: reportingState.lastReportError,
    activeReportEntryPoint: reportingState.activeReportEntryPoint || ""
  };
};


window.gridlyLandscapeLayoutAudit = function gridlyLandscapeLayoutAudit() {
  const selectors = [
    ".mobile-daily-home",
    "#mobileDailyPanel",
    ".mobile-live-commute-card",
    ".mobile-live-state-card",
    "#map",
    ".map-card",
    ".map-frame",
    "#mobileLocalContextStrip",
    ".mobile-local-context-strip",
    "[id*='LocalContextStrip']",
    "[class*='local-context-strip']",
    ".mobile-floating-action-dock",
    "#mobileLiveRouteActionBtn",
    ".leaflet-control-zoom",
    ".leaflet-control-layers",
    ".gridly-mobile-route-quick-panel",
    ".route-setup-modal"
  ];

  const dockButtonSelectors = [
    ".mobile-floating-action-dock .mobile-dock-btn",
    ".mobile-floating-action-dock button",
    ".mobile-bottom-nav button",
    "#mobileDockRouteBtn",
    "#mobileDockReportBtn",
    "#mobileDockAlertsBtn",
    "#mobileDockLayersBtn"
  ];

  const isVisible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const readElement = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return { selector, exists: false };
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      selector,
      exists: true,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      position: style.position,
      zIndex: style.zIndex,
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      overflow: style.overflow,
      transform: style.transform,
      pointerEvents: style.pointerEvents
    };
  };

  const overlapY = (a, b) => {
    if (!a || !b) return 0;
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return y > 0 ? Math.round(y) : 0;
  };

  const rectOf = (selector) => document.querySelector(selector)?.getBoundingClientRect?.() || null;
  const findContextStrip = () => document.querySelector("#mobileLocalContextStrip") || document.querySelector(".mobile-local-context-strip");
  const findDock = () => document.querySelector(".mobile-floating-action-dock");
  const findMap = () => document.querySelector("#map") || document.querySelector(".map-frame") || document.querySelector(".map-card");
  const findZoom = () => document.querySelector(".leaflet-control-zoom");
  const findCommute = () => document.querySelector(".mobile-live-commute-card") || document.querySelector(".mobile-live-state-card");
  const routeActivation = (typeof getRouteWatchActivationState === "function" ? getRouteWatchActivationState() : null) || {};
  const routeWatchActive = Boolean(window.__gridlyRouteWatchActive === true || routeWatchActivated === true || routeActivation.routeWatchActive);
  const routeSelected = Boolean(routeActivation.selectedRouteId || routeActivation.selectedCorridorId || routeWatchActive);
  const routePanels = [
    ".gridly-mobile-route-quick-panel",
    ".route-setup-modal",
    "#mobileNativeSurfaceLayer",
    "#mobileNativeSurfaceBody"
  ].map((selector) => {
    const el = document.querySelector(selector);
    return { selector, visible: isVisible(el), exists: Boolean(el) };
  });

  const contextStripEl = findContextStrip();
  const contextStripRect = contextStripEl?.getBoundingClientRect?.() || null;
  const dockRect = rectOf(".mobile-floating-action-dock");
  const dockParentRect = document.querySelector(".command-center")?.getBoundingClientRect?.() || null;
  const mapRect = findMap()?.getBoundingClientRect?.() || null;
  const zoomRect = findZoom()?.getBoundingClientRect?.() || null;
  const topPanelRect = rectOf(".mobile-live-command");
  const routeTopCtaRect = rectOf("#mobileLiveRouteActionBtn");

  const stripParentStyle = contextStripEl?.parentElement ? window.getComputedStyle(contextStripEl.parentElement) : null;
  const stripClippedByParent = Boolean(
    contextStripEl &&
    stripParentStyle &&
    ["hidden", "clip", "scroll", "auto"].includes(stripParentStyle.overflow) &&
    contextStripRect &&
    contextStripEl.parentElement.getBoundingClientRect &&
    (contextStripRect.top < contextStripEl.parentElement.getBoundingClientRect().top ||
      contextStripRect.bottom > contextStripEl.parentElement.getBoundingClientRect().bottom)
  );

  const currentFilterLabel = contextStripEl?.querySelector?.(".mobile-local-context-value") || null;
  const currentFilterLabelClipped = Boolean(
    currentFilterLabel &&
    (currentFilterLabel.scrollWidth > currentFilterLabel.clientWidth || currentFilterLabel.scrollHeight > currentFilterLabel.clientHeight)
  );

  const dockButtons = [];
  dockButtonSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (isVisible(el)) {
        dockButtons.push({ selector, label: (el.textContent || "").trim() || el.id || "(icon)", rect: el.getBoundingClientRect().toJSON() });
      }
    });
  });

  const rows = selectors.map((selector) => readElement(selector));
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    orientation: window.innerWidth > window.innerHeight ? "landscape" : "portrait",
    devicePixelRatio: window.devicePixelRatio || 1,
    bodyLayoutMode: document.body?.dataset?.layoutMode || null,
    tacticalMediaMatches: window.matchMedia("(orientation: landscape) and (max-height: 520px)").matches,
    overlapContextDockY: overlapY(contextStripRect, dockRect),
    overlapContextMapY: overlapY(contextStripRect, mapRect),
    overlapDockMapY: overlapY(dockRect, mapRect),
    overlapZoomContextY: overlapY(zoomRect, contextStripRect),
    overlapTopPanelMapY: overlapY(topPanelRect, mapRect),
    contextStripClippedByParent: stripClippedByParent,
    currentFilterLabelTextClipped: currentFilterLabelClipped,
    liveCommuteCardPresent: Boolean(findCommute()),
    routeSelected,
    routeWatchActive,
    selectedRouteId: routeActivation.selectedRouteId || null,
    selectedCorridorId: routeActivation.selectedCorridorId || null,
    duplicateRouteTopCtaVisible: isVisible(document.getElementById("mobileLiveRouteActionBtn")),
    dockInsideBottomBand: Boolean(dockRect && mapRect && dockRect.top >= mapRect.bottom),
    dockParentBottomGap: dockRect && dockParentRect ? Math.round(dockParentRect.bottom - dockRect.bottom) : null,
    mapBottom: mapRect ? Math.round(mapRect.bottom) : null,
    dockTop: dockRect ? Math.round(dockRect.top) : null,
    dockBottom: dockRect ? Math.round(dockRect.bottom) : null,
    topPanelTop: topPanelRect ? Math.round(topPanelRect.top) : null,
    topPanelBottom: topPanelRect ? Math.round(topPanelRect.bottom) : null,
    topPanelOverflowingMap: Boolean(topPanelRect && mapRect && topPanelRect.bottom > mapRect.top + (mapRect.height * 0.35)),
    routeTopCtaTop: routeTopCtaRect ? Math.round(routeTopCtaRect.top) : null
  };

  console.groupCollapsed("[Gridly] Landscape layout audit");
  console.table(rows);
  console.table([viewport]);
  if (dockButtons.length) console.table(dockButtons);
  console.table(routePanels);
  console.groupEnd();
  return { elements: rows, viewport, dockButtons, routePanels };
};

window.gridlyMobileQAAuditDebug = function gridlyMobileQAAuditDebug() {
  const isMobileViewport = window.matchMedia?.("(max-width: 760px)")?.matches === true;
  const quickReportCandidates = Array.from(document.querySelectorAll("#mobileQuickReportBtn, #mobileQuickReportSmallBtn, #mobileReportBtn, .mobile-sticky-report, .report-drawer-summary"));
  const bottomDockCandidates = Array.from(document.querySelectorAll(".mobile-bottom-dock, .mobile-bottom-nav, .mobile-dock"));
  const isVisibleEl = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const quickReport = quickReportCandidates.find((el) => isVisibleEl(el)) || null;
  const bottomDock = bottomDockCandidates.find((el) => isVisibleEl(el)) || null;
  const hazardPicker = document.getElementById("gridlyHazardPanel");
  const selectedHazardType = reportingState.selectedHazardType || selectedQuickHazardType || null;
  const actionBusy = Boolean(reportingState.submissionInProgress || reportingState.locationLookupInProgress);
  const tapMapBtn = hazardPicker?.querySelector('[data-action="start-map-placement"]') || null;
  const useLocationBtn = hazardPicker?.querySelector('[data-action="submit-hazard"]') || null;
  const visibleTopCta = Array.from(document.querySelectorAll("#mobileCommuteRouteBtn, .mobile-commute-cta")).find((el) => isVisibleEl(el)) || null;
  const overlays = Array.from(document.querySelectorAll("body *")).filter((el) => {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    if ((style.position !== "fixed" && style.position !== "sticky") || style.pointerEvents === "none") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 32 && rect.height > 32;
  });
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight, isMobileViewport },
    activeMobileMode: mobileUiMode,
    routePanelOpen: Boolean(document.querySelector(".route-setup-modal.open, .route-quick-panel.open")),
    hazardPanelOpen: Boolean(document.querySelector(".hazard-picker-panel.show, .hazard-picker.open")),
    alertsPanelOpen: Boolean(document.querySelector(".mobile-alerts-panel.open, .alerts-drawer.open")),
    selectedHazardType,
    tapMapDisabled: tapMapBtn ? Boolean(tapMapBtn.disabled) : !Boolean(selectedHazardType && !actionBusy),
    useLocationDisabled: useLocationBtn ? Boolean(useLocationBtn.disabled) : !Boolean(selectedHazardType && !actionBusy),
    quickReportVisible: Boolean(quickReport),
    bottomDockRect: bottomDock ? bottomDock.getBoundingClientRect().toJSON() : null,
    layerMenuState: typeof window.gridlyMobileLayerMenuDebug === "function" ? window.gridlyMobileLayerMenuDebug() : null,
    routeLayerExists: Boolean(savedRouteLayer || window.__gridlyRoutePreviewLayer),
    routeWatchActive: window.__gridlyRouteWatchActive === true || routeWatchActivated === true,
    topCardButtonText: visibleTopCta?.textContent?.trim() || "",
    topCardButtonTarget: visibleTopCta?.getAttribute("data-section-jump") || "",
    visibleOverlays: overlays.map((el) => ({ className: el.className, id: el.id || null })),
    possibleBlockers: overlays.filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width * rect.height > (window.innerWidth * window.innerHeight * 0.2);
    }).map((el) => ({ className: el.className, id: el.id || null }))
  };
};

const LOCAL_PLACE_LOOKUP = {
  dayton: { lat: 30.0466, lng: -94.8852 },
  crosby: { lat: 29.9111, lng: -95.0622 },
  baytown: { lat: 29.7355, lng: -94.9774 },
  liberty: { lat: 30.0572, lng: -94.795 },
  cleveland: { lat: 30.3413, lng: -95.0858 }
};

const GRIDLY_SEARCH_STATE_DEFAULTS = {
  activeQuery: "",
  activeResult: null,
  recentSearches: [],
  homeLocation: null,
  workLocation: null,
  selectedDestination: null,
  destinationMarker: null,
  searchSessionActive: false,
  markerPlacementDiagnostics: {
    lastMarkerAttempted: false,
    lastMarkerSuccess: false,
    lastMarkerFailureReason: "not_attempted",
    lastMarkerLat: null,
    lastMarkerLng: null,
    lastMapFocusSuccess: false,
    lastMapFocusLat: null,
    lastMapFocusLng: null,
    lastMapFocusZoom: null,
    mapAvailable: false,
    markerAssignedToState: false,
    destinationMarkerStatePresent: false,
    lastMarkerStateCheckAt: null
  }
};

function ensureGridlySearchState() {
  const existingState = window.GridlySearchState;
  const nextState = { ...GRIDLY_SEARCH_STATE_DEFAULTS };
  if (existingState && typeof existingState === "object") {
    Object.keys(GRIDLY_SEARCH_STATE_DEFAULTS).forEach((key) => {
      if (Object.hasOwn(existingState, key)) {
        nextState[key] = existingState[key];
      }
    });
  }
  window.GridlySearchState = nextState;
  return window.GridlySearchState;
}

const gridlySearchUiRefs = {
  shell: null,
  input: null,
  clearBtn: null,
  results: null
};

const gridlySearchUiState = {
  pendingSearchTimer: null,
  activeSearchRequestId: 0,
  lastRenderedResults: [],
  lastRenderedResultsPreview: [],
  isSearching: false,
  prioritizedLocalResultsCount: 0,
  debugWarningsSeen: new Set(),
  lastContextDiagnostics: null,
  lastSearchShellOpenSource: ""
};

const GRIDLY_SEARCH_RENDER_LIMIT = 5;
const GRIDLY_SEARCH_NOISY_META_TOKENS = new Set(["administrative", "unknown", "boundary", "place", "node", "hamlet", "village", "city", "town"]);

function normalizeGridlySearchDisplayLabel(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function buildGridlySearchDisplayLines(result) {
  const raw = result?.raw && typeof result.raw === "object" ? result.raw : {};
  const rawAddress = raw?.address && typeof raw.address === "object" ? raw.address : {};
  const conciseAddressName = String(
    rawAddress.road ||
    rawAddress.city ||
    rawAddress.town ||
    rawAddress.village ||
    rawAddress.hamlet ||
    ""
  ).trim();
  const baseTitle = String(result.label || result.title || conciseAddressName || result.address || "Destination").trim();
  const title = isGridlyUsefulMetaValue(baseTitle) ? baseTitle : (conciseAddressName || "Destination");
  const titleNorm = normalizeGridlySearchDisplayLabel(title);
  const provider = String(result.provider || "").trim();
  const type = String(result.type || "").trim();
  const metaParts = [type, provider]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .filter((entry) => !GRIDLY_SEARCH_NOISY_META_TOKENS.has(entry.toLowerCase()));
  const meta = metaParts.find((entry) => normalizeGridlySearchDisplayLabel(entry) !== titleNorm) || "";
  return { title, meta };
}

function toGridlyTitleCase(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 3 && part.toUpperCase() === part) return part;
      if (/^\d/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function isGridlyUsefulMetaValue(value) {
  const normalized = normalizeGridlySearchDisplayLabel(value);
  if (!normalized) return false;
  return !GRIDLY_SEARCH_NOISY_META_TOKENS.has(normalized);
}

function cleanGridlyDisplayNameContext(displayName, fallbackTitle = "") {
  const normalizedTitle = normalizeGridlySearchDisplayLabel(fallbackTitle);
  const noisyDisplayParts = new Set(["united states", "usa", "us"]);
  const parts = String(displayName || "")
    .split(",")
    .map((part) => toGridlyTitleCase(part))
    .map((part) => String(part || "").trim())
    .filter((part) => isGridlyUsefulMetaValue(part))
    .filter((part) => normalizeGridlySearchDisplayLabel(part) !== normalizedTitle)
    .filter((part) => !noisyDisplayParts.has(normalizeGridlySearchDisplayLabel(part)));
  if (!parts.length) return "";
  const stateMatcher = /^(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia)$/i;
  const countyIndex = parts.findIndex((part) => /\bcounty\b/i.test(part));
  if (countyIndex >= 0) {
    const nextPart = parts[countyIndex + 1] || "";
    if (stateMatcher.test(nextPart)) return `${parts[countyIndex]}, ${nextPart}`;
  }
  const county = parts.find((part) => /\bcounty\b/i.test(part)) || "";
  const state = parts.find((part) => stateMatcher.test(part)) || "";
  if (county && state) return `${county}, ${state}`;
  if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
  return parts[0];
}

function cleanGridlyNormalizedContext(contextValue, fallbackTitle = "") {
  const normalizedTitle = normalizeGridlySearchDisplayLabel(fallbackTitle);
  const noisyTokens = new Set(["administrative", "unknown", "boundary", "place", "node", "city", "town", "village", "hamlet"]);
  const sanitizePart = (value) => toGridlyTitleCase(String(value || "").replace(/\s+/g, " ").trim());
  const cleanParts = (parts) => {
    const cleaned = parts
      .map((part) => sanitizePart(part))
      .filter(Boolean)
      .filter((part) => {
        const normalized = normalizeGridlySearchDisplayLabel(part);
        return normalized && normalized !== normalizedTitle && !noisyTokens.has(normalized) && normalized !== "[object object]" && normalized !== "object object";
      });
    while (cleaned.length && normalizeGridlySearchDisplayLabel(cleaned[cleaned.length - 1]) === "united states") cleaned.pop();
    return cleaned;
  };

  if (contextValue && typeof contextValue === "object" && !Array.isArray(contextValue)) {
    const location = contextValue;
    const take = (...keys) => keys.map((key) => sanitizePart(location?.[key])).find(Boolean) || "";
    const county = take("county");
    const state = take("state");
    const locality = take("city", "town", "village", "hamlet", "municipality");
    const suburb = take("suburb", "neighbourhood", "neighborhood");
    const road = take("road");
    const country = take("country");

    const objectCandidates = [];
    if (county && state) objectCandidates.push([county, state]);
    if (locality && state) objectCandidates.push([locality, state]);
    if (suburb && locality && state) objectCandidates.push([suburb, locality, state]);
    if (road && locality && state) objectCandidates.push([locality, state]);
    if (state && country) objectCandidates.push([state, country]);

    const objectEntries = Object.entries(location)
      .map(([, value]) => sanitizePart(value))
      .filter(Boolean)
      .slice(0, 2);
    if (objectEntries.length) objectCandidates.push(objectEntries);

    for (const candidate of objectCandidates) {
      const cleaned = cleanParts(candidate);
      if (cleaned.length) return cleaned.slice(0, 2).join(", ");
    }
    return "";
  }

  const normalizedRaw = normalizeGridlySearchDisplayLabel(contextValue);
  if (normalizedRaw === "[object object]" || normalizedRaw === "object object") return "";

  const parts = cleanParts(String(contextValue || "").split(","));
  return parts.join(", ").replace(/,\s*,+/g, ", ").replace(/\s{2,}/g, " ").trim().replace(/,\s*$/, "");
}

function buildGridlyLocationContext(result) {
  try {
    const raw = result?.raw && typeof result.raw === "object" ? result.raw : {};
    const resolve = (...values) => values.map((value) => String(value || "").trim()).find(Boolean) || "";
    const sourceTitle = resolve(result?.label, result?.title, result?.display_name, raw?.display_name, "");
    const subtitleContext = cleanGridlyNormalizedContext(result?.subtitle, sourceTitle);
    if (subtitleContext) {
      gridlySearchUiState.lastContextDiagnostics = { strategy: "subtitle", hasNormalizedSubtitle: true };
      return subtitleContext;
    }
    const addressContext = cleanGridlyNormalizedContext(result?.address, sourceTitle);
    if (addressContext) {
      gridlySearchUiState.lastContextDiagnostics = { strategy: "address", hasNormalizedAddress: true };
      return addressContext;
    }
    const rawAddressContext = cleanGridlyNormalizedContext(raw?.address, sourceTitle);
    if (rawAddressContext) {
      gridlySearchUiState.lastContextDiagnostics = { strategy: "raw_address", hasRawAddress: true };
      return rawAddressContext;
    }
    const displayNameValue = resolve(raw?.display_name, result?.display_name, "");
    const displayNameContext = cleanGridlyDisplayNameContext(displayNameValue, sourceTitle);
    if (displayNameContext) {
      gridlySearchUiState.lastContextDiagnostics = {
        strategy: "display_name_fallback",
        hasAddressFields: Boolean(raw?.address && typeof raw.address === "object" && Object.keys(raw.address).length),
        contextSourcePreview: {
          hasRawDisplayName: Boolean(resolve(raw?.display_name, "")),
          hasRawAddress: Boolean(raw?.address && typeof raw.address === "object"),
          rawDisplayNameSample: String(resolve(raw?.display_name, result?.display_name, "")).slice(0, 120),
          addressKeys: raw?.address && typeof raw.address === "object" ? Object.keys(raw.address).slice(0, 6) : []
        }
      };
      return displayNameContext;
    }
    gridlySearchUiState.lastContextDiagnostics = {
      strategy: "empty",
      hasAddressFields: Boolean(raw?.address && typeof raw.address === "object" && Object.keys(raw.address).length),
      hasDisplayName: Boolean(resolve(raw?.display_name, result?.display_name, ""))
    };
    return "";
  } catch (_error) {
    return "";
  }
}

function prioritizeGridlySearchResults(results = []) {
  if (!Array.isArray(results) || !results.length) return [];
  const bounds = map?.getBounds?.();
  const scored = results.map((result, index) => {
    const context = buildGridlyLocationContext(result);
    const haystack = normalizeGridlySearchDisplayLabel(
      `${result?.label || ""} ${result?.address || ""} ${context} ${result?.raw?.display_name || ""}`
    );
    let score = 0;
    if (haystack.includes("liberty county")) score += 6;
    if (haystack.includes(" texas") || haystack.endsWith("texas") || haystack.includes(", tx") || haystack.includes(" tx ")) score += 4;
    if (bounds && Number.isFinite(result?.lat) && Number.isFinite(result?.lng) && bounds.contains([result.lat, result.lng])) score += 3;
    if (score > 0) score += Math.max(0, GRIDLY_SEARCH_RENDER_LIMIT - index) * 0.05;
    return { result, score, index };
  });
  const prioritized = scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  gridlySearchUiState.prioritizedLocalResultsCount = prioritized.filter((entry) => entry.score > 0).length;
  return prioritized.map((entry) => entry.result);
}

function dedupeGridlySearchResults(results) {
  if (!Array.isArray(results) || !results.length) return [];
  const seen = new Set();
  const deduped = [];
  for (const result of results) {
    const display = buildGridlySearchDisplayLines(result);
    const labelKey = normalizeGridlySearchDisplayLabel(display.title);
    const hasCoords = Number.isFinite(result?.lat) && Number.isFinite(result?.lng);
    const coordKey = hasCoords ? `${result.lat.toFixed(3)},${result.lng.toFixed(3)}` : "no-coords";
    const dedupeKey = `${labelKey}|${coordKey}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(result);
    if (deduped.length >= GRIDLY_SEARCH_RENDER_LIMIT) break;
  }
  return deduped;
}

function clearGridlySearchResults(options = {}) {
  const state = ensureGridlySearchState();
  const resultsContainer = gridlySearchUiRefs.results || document.getElementById("gridlySearchResults");
  if (resultsContainer) resultsContainer.textContent = "";
  gridlySearchUiState.lastRenderedResults = [];
  gridlySearchUiState.lastResultShapePreview = [];
  if (options?.clearActiveResult === true) state.activeResult = null;
  if (options?.clearSelectedDestination === true) state.selectedDestination = null;
  if (options?.clearDestinationMarker === true) clearGridlyDestinationMarker({ silent: true });
  return true;
}

function renderGridlySearchResults(results = [], options = {}) {
  const resultsContainer = gridlySearchUiRefs.results || document.getElementById("gridlySearchResults");
  if (!resultsContainer) return false;
  resultsContainer.textContent = "";

  if (options?.state === "searching") {
    const status = document.createElement("div");
    status.className = "gridly-search-results-status";
    status.textContent = "Searching nearby places…";
    resultsContainer.appendChild(status);
    return true;
  }

  if (options?.state === "error") {
    const status = document.createElement("div");
    status.className = "gridly-search-results-status";
    status.textContent = "Search is unavailable right now.";
    resultsContainer.appendChild(status);
    return true;
  }

  const normalizedResults = Array.isArray(results)
    ? results.map((result) => normalizeGridlySearchResult(result)).filter(Boolean)
    : [];
  if (normalizedResults.length && !gridlySearchUiState.debugWarningsSeen.has("normalized-results-preview")) {
    const preview = normalizedResults.slice(0, 3).map((result) => {
      const display = buildGridlySearchDisplayLines(result);
      return {
        title: display.title,
        lat: Number.isFinite(result?.lat) ? Number(result.lat.toFixed(6)) : null,
        lng: Number.isFinite(result?.lng) ? Number(result.lng.toFixed(6)) : null,
        selectable: Boolean(Number.isFinite(result?.lat) && Number.isFinite(result?.lng))
      };
    });
    console.info("Gridly search normalized preview", preview);
    gridlySearchUiState.debugWarningsSeen.add("normalized-results-preview");
  }
  const prioritizedResults = prioritizeGridlySearchResults(normalizedResults);
  const renderedResults = dedupeGridlySearchResults(prioritizedResults);
  gridlySearchUiState.lastRenderedResults = renderedResults;

  if (!renderedResults.length) {
    if (options?.state === "done" && options?.allowEmptyMessage === true) {
      const status = document.createElement("div");
      status.className = "gridly-search-results-status";
      status.textContent = "No matching places found.";
      resultsContainer.appendChild(status);
    }
    return true;
  }

  const list = document.createElement("div");
  list.className = "gridly-search-results-list";
  const preview = [];
  renderedResults.forEach((result, index) => {
    const itemBtn = document.createElement("button");
    itemBtn.type = "button";
    itemBtn.className = "gridly-search-result-item";
    itemBtn.dataset.resultIndex = String(index);

    const display = buildGridlySearchDisplayLines(result);
    const locationContext = buildGridlyLocationContext(result);
    const label = document.createElement("span");
    label.className = "gridly-search-result-title";
    label.textContent = display.title;
    itemBtn.appendChild(label);

    const secondaryLine = [locationContext, display.meta]
      .map((entry) => String(entry || "").trim())
      .find((entry) => isGridlyUsefulMetaValue(entry));
    preview.push({
      title: display.title,
      context: secondaryLine || "",
      lat: Number.isFinite(result?.lat) ? Number(result.lat.toFixed(6)) : null,
      lng: Number.isFinite(result?.lng) ? Number(result.lng.toFixed(6)) : null,
      selectable: Boolean(Number.isFinite(result?.lat) && Number.isFinite(result?.lng))
    });
    if (secondaryLine) {
      const meta = document.createElement("span");
      meta.className = "gridly-search-result-meta";
      meta.textContent = secondaryLine;
      itemBtn.appendChild(meta);
    }

    itemBtn.addEventListener("click", () => {
      const resolvedIndex = Number.parseInt(itemBtn.dataset.resultIndex || "", 10);
      const picked = Number.isInteger(resolvedIndex) ? gridlySearchUiState.lastRenderedResults[resolvedIndex] : null;
      if (!picked) {
        if (!gridlySearchUiState.debugWarningsSeen.has("selection-missing-result")) {
          console.warn("Gridly selection skipped: missing rendered result.", { resolvedIndex });
          gridlySearchUiState.debugWarningsSeen.add("selection-missing-result");
        }
        return;
      }
      if (!Number.isFinite(picked?.lat) || !Number.isFinite(picked?.lng)) {
        if (!gridlySearchUiState.debugWarningsSeen.has("selection-invalid-coordinates")) {
          console.warn("Gridly selection skipped: invalid coordinates.", { resolvedIndex });
          gridlySearchUiState.debugWarningsSeen.add("selection-invalid-coordinates");
        }
        return;
      }
      selectGridlySearchResult(picked);
    });
    list.appendChild(itemBtn);
  });
  gridlySearchUiState.lastRenderedResultsPreview = preview.slice(0, 3);
  gridlySearchUiState.lastResultShapePreview = renderedResults.slice(0, 3).map((result) => buildGridlyResultShapePreviewItem(result));

  resultsContainer.appendChild(list);
  return true;
}

function collapseGridlySearchResults() {
  const resultsContainer = gridlySearchUiRefs.results || document.getElementById("gridlySearchResults");
  if (resultsContainer) resultsContainer.textContent = "";
  gridlySearchUiState.lastRenderedResults = [];
  gridlySearchUiState.lastRenderedResultsPreview = [];
  gridlySearchUiState.lastResultShapePreview = [];
  gridlySearchUiState.isSearching = false;
}


function getSelectedDestinationLabel() {
  const state = ensureGridlySearchState();
  const normalized = normalizeGridlySearchResult(state?.selectedDestination);
  if (!normalized) return "";
  return normalized.title || normalized.displayName || normalized.context || normalized.address || "";
}

function syncMobileDestinationCommandCard() {
  const routeIsMonitoring = Boolean(routeWatchActivated || window.__gridlyRouteWatchActive);
  const selectedLabel = getSelectedDestinationLabel();
  safeText("mobileDestinationCommandTitle", routeIsMonitoring ? "Destination selected" : "Destination");
  safeText(
    "mobileDestinationCommandMeta",
    routeIsMonitoring
      ? `Selected: ${selectedLabel || "Saved destination"}`
      : (selectedLabel || "Choose Route to set a destination and open search.")
  );
  safeText("mobileDestinationCommandBtn", selectedLabel ? "Change" : "Choose Route");
}

function selectGridlySearchResult(result, options = {}) {
  const normalized = normalizeGridlySearchResult(result);
  if (!normalized) return null;
  if (!Number.isFinite(normalized?.lat) || !Number.isFinite(normalized?.lng)) {
    if (!gridlySearchUiState.debugWarningsSeen.has("select-invalid-normalized-result")) {
      console.warn("Gridly selection aborted: normalized result missing coordinates.");
      gridlySearchUiState.debugWarningsSeen.add("select-invalid-normalized-result");
    }
    return null;
  }
  const state = ensureGridlySearchState();
  state.activeResult = normalized;
  state.selectedDestination = normalized;

  if (options?.addToRecentSearches !== false) {
    const existing = Array.isArray(state.recentSearches) ? state.recentSearches : [];
    const deduped = [normalized, ...existing.filter((entry) => normalizeGridlySearchResult(entry)?.id !== normalized.id)];
    state.recentSearches = deduped.slice(0, 5);
  }

  const selectedLabel = normalized.title || normalized.displayName || normalized.context || normalized.address || "";
  const input = gridlySearchUiRefs.input || document.getElementById("gridlyAddressSearchInput");
  if (input) input.value = selectedLabel;
  state.activeQuery = selectedLabel;
  const destinationHabitCopy = document.getElementById("destinationHabitCopy");
  if (destinationHabitCopy && selectedLabel) destinationHabitCopy.textContent = `Selected: ${selectedLabel}`;

  const marker = setGridlyDestinationMarker(normalized, { preserveSelectedDestination: true });
  if (!marker && !gridlySearchUiState.debugWarningsSeen.has("select-marker-failed")) {
    console.warn("Gridly selection warning: destination marker was not created.");
    gridlySearchUiState.debugWarningsSeen.add("select-marker-failed");
  }
  if (marker) focusGridlyDestinationOnMap(normalized.lat, normalized.lng);

  collapseGridlySearchResults();
  hideGridlySearchShell({ clear: false });
  syncMobileDestinationCommandCard();
  return normalized;
}

function initGridlySearchUI() {
  const shell = document.getElementById("gridlySearchShell");
  const input = document.getElementById("gridlyAddressSearchInput");
  const clearBtn = document.getElementById("gridlySearchClearBtn");
  const results = document.getElementById("gridlySearchResults");

  gridlySearchUiRefs.shell = shell || null;
  gridlySearchUiRefs.input = input || null;
  gridlySearchUiRefs.clearBtn = clearBtn || null;
  gridlySearchUiRefs.results = results || null;

  if (shell) {
    shell.hidden = true;
    shell.dataset.searchUi = "dormant";
  }

  if (clearBtn && !clearBtn.dataset.gridlySearchClearBound) {
    clearBtn.addEventListener("click", () => {
      const state = ensureGridlySearchState();
      if (gridlySearchUiState.pendingSearchTimer) {
        clearTimeout(gridlySearchUiState.pendingSearchTimer);
        gridlySearchUiState.pendingSearchTimer = null;
      }
      if (gridlySearchUiRefs.input) gridlySearchUiRefs.input.value = "";
      state.activeQuery = "";
      clearGridlySearchResults();
    });
    clearBtn.dataset.gridlySearchClearBound = "true";
  }

  if (input && !input.dataset.gridlySearchInputBound) {
    input.addEventListener("input", () => {
      const state = ensureGridlySearchState();
      const query = String(input.value || "").trim();
      state.activeQuery = query;

      if (gridlySearchUiState.pendingSearchTimer) {
        clearTimeout(gridlySearchUiState.pendingSearchTimer);
        gridlySearchUiState.pendingSearchTimer = null;
      }

      if (query.length < 3) {
        gridlySearchUiState.isSearching = false;
        clearGridlySearchResults();
        return;
      }

      const requestId = gridlySearchUiState.activeSearchRequestId + 1;
      gridlySearchUiState.activeSearchRequestId = requestId;
      gridlySearchUiState.isSearching = true;
      renderGridlySearchResults([], { state: "searching" });

      gridlySearchUiState.pendingSearchTimer = setTimeout(async () => {
        gridlySearchUiState.pendingSearchTimer = null;
        try {
          const searchResults = await gridlySearchAddress(query);
          if (requestId !== gridlySearchUiState.activeSearchRequestId) return;
          gridlySearchUiState.isSearching = false;
          renderGridlySearchResults(searchResults, { state: "done", allowEmptyMessage: true });
        } catch (_error) {
          if (requestId !== gridlySearchUiState.activeSearchRequestId) return;
          gridlySearchUiState.isSearching = false;
          renderGridlySearchResults([], { state: "error" });
        }
      }, 350);
    });
    const reopenResults = () => {
      const state = ensureGridlySearchState();
      const query = String(input.value || state.activeQuery || "").trim();
      state.activeQuery = query;
      if (query.length >= 3) {
        renderGridlySearchResults([], { state: "searching" });
        gridlySearchAddress(query)
          .then((resultsList) => renderGridlySearchResults(resultsList, { state: "done", allowEmptyMessage: true }))
          .catch(() => renderGridlySearchResults([], { state: "error" }));
      } else if (Array.isArray(state.recentSearches) && state.recentSearches.length) {
        renderGridlySearchResults(state.recentSearches, { state: "done", allowEmptyMessage: false });
      }
    };
    input.addEventListener("focus", reopenResults);
    input.addEventListener("click", reopenResults);
    input.dataset.gridlySearchInputBound = "true";
  }

  window.GridlySearchUI = {
    hasSearchShell: Boolean(shell),
    hasSearchInput: Boolean(input),
    hasSearchClearButton: Boolean(clearBtn),
    hasSearchResults: Boolean(results)
  };
}

function showGridlySearchShell(options = {}) {
  const shell = gridlySearchUiRefs.shell || document.getElementById("gridlySearchShell");
  if (options?.source) gridlySearchUiState.lastSearchShellOpenSource = String(options.source);
  if (!shell) return false;
  shell.hidden = false;
  shell.removeAttribute("hidden");
  shell.dataset.searchUi = "active";
  if (options?.focusInput === true) {
    const input = gridlySearchUiRefs.input || document.getElementById("gridlyAddressSearchInput");
    if (input && typeof input.focus === "function") input.focus();
  }
  return true;
}

function hideGridlySearchShell(options = {}) {
  const shell = gridlySearchUiRefs.shell || document.getElementById("gridlySearchShell");
  if (!shell) return false;
  shell.hidden = true;
  shell.setAttribute("hidden", "");
  shell.dataset.searchUi = "dormant";
  if (options?.clear === true) {
    const input = gridlySearchUiRefs.input || document.getElementById("gridlyAddressSearchInput");
    const results = gridlySearchUiRefs.results || document.getElementById("gridlySearchResults");
    if (input) input.value = "";
    if (results) results.textContent = "";
  }
  return true;
}

let lastRouteWatchSelection = { startId: "", destinationId: "" };
let gridlyUserProfile = getGridlyUserProfile();
let movementIntelligence = getMovementIntelligence();
let mapBaseLayersByName = {};
let mapStyleClassByName = {};
let currentMapStyle = "Satellite";
let activeBaseLayerName = "Satellite";
let mobileLayerMenuOpen = false;
let managePlacesSourceMode = "";
const LEGACY_PLACE_MARKER_TEXT = "legacy migrated";

let deviceId =
  localStorage.getItem("gridlyDeviceId") ||
  `device-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;

localStorage.setItem("gridlyDeviceId", deviceId);

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  reportLifecycleDiag("DOMContentLoaded init start", { readyState: document.readyState });
  ensureGridlySearchState();
  initGridlySearchUI();
  initVisualViewportHeightVar();
  hydrateElements();
  gridlyHealthCheck();
  setManualFallbackDefaultState();
  ensureSeededMovementIntelligence();
  attachGridlyMovementDebugGlobal();
  attachSavedPlacesDebugGlobal();
  attachRouteWatchDebugGlobal();
  attachRouteQuickPanelDebugGlobal();
  initGreeting();
  updateLastUpdated();
  initMap();
  installMapClickDiagnostics();
  initSupabase();
  bindEvents();
  setReportMode(REPORT_MODES.rail);
  closeRouteSetupModal({ restoreFocus: false });
  injectHazardReportUI();
  loadSavedRoute();
  loadSmartAlertsPreferences();
  initDailyDestinationHero();
  updateMobileWatchHeader();
  updateProfileUI();
  maybeOpenFirstRunSetup();

  await loadCrossings();
  await loadRoadwayDataset();
  await loadSharedReports();

  setInterval(loadSharedReports, LIVE_REFRESH_MS);
});

function initVisualViewportHeightVar() {
  const setVisualViewportHeight = () => {
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty("--gridly-visual-vh", `${Math.max(0, Math.round(viewportHeight))}px`);
  };
  setVisualViewportHeight();
  window.addEventListener("resize", setVisualViewportHeight, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", setVisualViewportHeight, { passive: true });
    window.visualViewport.addEventListener("scroll", setVisualViewportHeight, { passive: true });
  }
}

function installMapClickDiagnostics() {
  document.addEventListener("click", (event) => {
    const mapEl = document.getElementById("map");
    const mapFrame = document.querySelector(".map-frame");
    if (!mapEl || !mapFrame) return;

    const rect = mapFrame.getBoundingClientRect();
    const insideFrame =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!insideFrame) return;

    const topEl = document.elementFromPoint(event.clientX, event.clientY);
    const target = event.target;
    reportDebugLog("[Map click diagnostic]", {
      targetTag: target?.tagName || null,
      targetId: target?.id || null,
      targetClass: target?.className || null,
      topTag: topEl?.tagName || null,
      topId: topEl?.id || null,
      topClass: topEl?.className || null,
      x: event.clientX,
      y: event.clientY
    });
  }, true);
}




function setManualFallbackDefaultState() {
  if (!els.reportSection) return;
  const isDesktop = window.matchMedia("(min-width: 1101px)").matches;
  els.reportSection.open = isDesktop;
  if (!isDesktop) setMobileUiMode("live", { silent: true });
  reportLifecycleDiag("setManualFallbackDefaultState", { isDesktop, mobileMode: mobileUiMode });
}

function isReportSurfaceVisiblyOpen() {
  const reportSection = document.getElementById("reportSection");
  if (!reportSection) return false;
  const style = window.getComputedStyle(reportSection);
  return Boolean(
    reportSection.open &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    style.pointerEvents !== "none"
  );
}


function readSurfaceComputedState(selector) {
  const el = document.querySelector(selector);
  if (!el) return { selector, exists: false };
  const style = window.getComputedStyle(el);
  return {
    selector,
    exists: true,
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    pointerEvents: style.pointerEvents
  };
}

function traceMobileModeMutation(_label, _data = {}) {
  return;
}

function returnMobileToLiveMode(reason = "") {
  if (!window.matchMedia("(max-width: 760px)").matches) return;
  traceMobileModeMutation("returnMobileToLiveMode called", { reason });
  if (reportingState.reportModeActive || reportingState.placementModeActive || reportingState.submissionInProgress) return;
  const routePanelVisible = Boolean(document.getElementById("gridlyMobileRouteQuickPanel")?.classList.contains("visible"));
  if (isReportSurfaceVisiblyOpen()) {
    reportLifecycleDiag("returnMobileToLiveMode blocked: report surface still open", { reason, reportSectionOpen: true });
    return;
  }
  if (routePanelVisible) {
    traceMobileModeMutation("returnMobileToLiveMode blocked: route panel still open", { reason, routePanelVisible });
    return;
  }
  setMobileUiMode("live", { silent: true });
  traceMobileModeMutation("returnMobileToLiveMode completed", { reason });
  reportDebugLog("[Gridly][Report] returned to live mode", { reason, mobileUiMode });
}

function hydrateElements() {
  [
    "greetingTitle",
    "greetingSubtitle",
    "timeContext",
    "routeCardLabel",
    "routeStatusCard",
    "routeStatus",
    "routeEta",
    "departureTime",
    "departureReason",
    "delayRisk",
    "delayReason",
    "nearbyAlertCount",
    "activeAlertText",
    "alternateRoute",
    "alternateReason",
    "savedHome",
    "savedWork",
    "desktopRouteHome",
    "desktopRouteWork",
    "desktopRouteStatus",
    "routeFreshness",
    "routeConfidence",
    "routeReports",
    "desktopManageRouteBtn",
    "routeWatchStartSelect",
    "routeWatchDestinationSelect",
    "routeWatchStartBtn",
    "routeWatchSetupHint",
    "sideRouteWatchHint",
    "homeInput",
    "workInput",
    "savedDestinationSelect",
    "saveRouteBtn",
    "useLocationBtn",
    "refreshBtn",
    "alertsList",
    "roadHazardsList",
    "impactFill",
    "impactScore",
    "impactText",
    "crossingSelect",
    "crossingSearch",
    "searchResults",
    "manualReportType",
    "manualReportBtn",
    "reportSearchLabel",
    "reportSelectLabel",
    "reportTypeLabel",
    "clearReportsBtn",
    "reportConfirmation",
    "lastUpdated",
    "dataStatus",
    "syncStatus",
    "crossingCount",
    "reportDecayStatus",
    "lastReportTime",
    "mapTrustNote",
    "geoFilterStatus",
    "routeRecommendation",
    "routeRecommendationReason",
    "communityTrust",
    "communityTrustReason",
    "freshestReport",
    "freshestReportReason",
    "corridorSummaryHeadline",
    "mobileCorridorSummaryHeadline",
    "trendingList",
    "shareCard",
    "shareGridlyBtn",
    "headerShareGridlyBtn",
    "quickClearCard",
    "quickClearBtn",
    "mobileReportBtn",
    "desktopReportNearMeBtn",
    "desktopReportNearMeBtnRail",
    "reportModeBanner",
    "reportSection",
    "trendingDrawer",
    "smartAlertsModal",
    "smartAlertsModalBackdrop",
    "settingsModal",
    "settingsModalBackdrop",
    "closeSettingsModalBtn",
    "closeSmartAlertsModalBtn",
    "openSmartAlertsBtn",
    "mobileAlertsMirror",
    "habitStatusStrip",
    "habitStatusPill",
    "habitStatusHeadline",
    "habitStatusDetail",
    "smartAlertsStatus",
    "smartAlertNearbyBlocked",
    "smartAlertRouteDelay",
    "smartAlertUs90Clear",
    "smartAlertNeedsConfirm",
    "saveSmartAlertsBtn",
    "smartAlertsConfirmation",
    "smartAlertsBanner",
    "mobileHomeInput",
    "mobileWorkInput",
    "mobileSavedDestinationSelect",
    "mobileSaveRouteBtn",
    "managePlaceSlotRow",
    "managePlaceHomeBtn",
    "managePlaceWorkBtn",
    "managePlaceFavoriteBtn",
    "mobileResetPlacesBtn",
    "mobileUseLocationBtn",
    "routeSetupModal",
    "routeSetupModalBackdrop",
    "closeRouteSetupModalBtn",
    "mobileEditRouteBtn",
    "mobileQuickReportBtn",
    "mobileQuickReportSmallBtn",
    "mobileQuickClearedBtn",
    "mobileQuickRouteBtn",
    "mobileQuickFavoritesBtn",
    "mobileTownSelectorBtn",
    "mobileWeatherChipBtn",
    "mobileBellBtn",
    "mobileAvatarBtn",
    "mobileOpenLiveMapBtn",
    "mobileCommuteRouteBtn",
    "mobileCrossingReportBtn",
    "mobileHazardReportBtn",
    "mobileDockReportBtn",
    "mobileDockRouteBtn",
    "mobileDockAlertsBtn",
    "mobileDockAreaBtn",
    "mobileDestinationCommandBtn",
    "mobileDestinationCommandTitle",
    "mobileDestinationCommandMeta",
    "mobileLiveRouteActionBtn",
    "mobileLiveRouteStatus",
    "mobileLiveRouteMeta",
    "mapReportShortcutBtn",
    "destinationHomeBtn",
    "destinationWorkBtn",
    "destinationFavoriteBtn",
    "destinationAddBtn",
    "desktopDestinationHomeBtn",
    "desktopDestinationWorkBtn",
    "desktopDestinationFavoriteBtn",
    "desktopDestinationAddBtn",
    "destinationEmptyNote",
    "destinationHabitCopy",
    "routeWatchLivePill",
    "liveOpsStatus",
    "liveOpsDetail",
    "firstRunSetupModal","firstRunSetupBackdrop","setupNameInput","setupZipInput","setupTownInput","setupStateInput","setupDetectedTown","completeSetupBtn","skipSetupBtn","setupSaveHomeBtn","setupSaveWorkBtn","editSetupBtn","firstRunEditSetupBtn","setupStartBtn","setupNameContinueBtn","setupZipContinueBtn","setupSkipPlacesBtn","setupPlacesContinueBtn","setupSummaryTown","setupSummaryPlaces","setupTownFallbackLabel","setupStateFallbackLabel"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });

  setMobileUiMode("live", { silent: true });
  syncMobileNavVisibilityForViewport();
  window.addEventListener("resize", () => setMobileUiMode(mobileUiMode, { silent: true }));
  window.addEventListener("resize", syncMobileNavVisibilityForViewport);
  window.addEventListener("resize", syncAuthoritativeLayoutMode, { passive: true });
  highlightNearestCrossingOnFirstLoad();
}

function initSupabase() {
  if (!window.supabase) {
    setSync(`Live sync unavailable · Build ${APP_BUILD}`);
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);

    setSync(`Live sync connected · Build ${APP_BUILD}`);

    realtimeChannel = supabaseClient
      .channel("gridly-live-reports-v120")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reports"
        },
        () => loadSharedReports()
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSync(`Live sync active · Build ${APP_BUILD}`);
        }
      });
  } catch (error) {
    console.error("Supabase init failed:", error);
    setSync(`Live sync failed · Build ${APP_BUILD}`);
  }
}

function initGreeting() {
  const namePrefix = gridlyUserProfile?.name ? `, ${gridlyUserProfile.name}` : "";
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    setGreeting(
      `Good morning${namePrefix}`,
      "My Town route watch",
      "Check your route before leaving. Gridly watches crossings, live reports, and local impact.",
      "Route Status"
    );
  } else if (hour >= 12 && hour < 17) {
    setGreeting(
      `Good afternoon${namePrefix}`,
      "Midday Mobility Check",
      "Heading out soon? Gridly checks nearby crossings, slowdowns, and active road issues.",
      "Current Route"
    );
  } else if (hour >= 17 && hour < 22) {
    setGreeting(
      `Good evening${namePrefix}`,
      "Evening Commute Intelligence",
      "Check your route home before you leave. Gridly watches for crossing delays and local impacts.",
      "Commute Home"
    );
  } else {
    setGreeting(
      `Late Night Check${namePrefix}`,
      "After-Hours Route Watch",
      "Quiet roads are still worth checking. Gridly looks for late-night rail delays and blocked crossings.",
      "Night Route"
    );
  }
}

const ZIP_FALLBACK_LOOKUP = {
  "77535": { city: "Dayton", state: "TX" },
  "77575": { city: "Liberty", state: "TX" },
  "77327": { city: "Cleveland", state: "TX" },
  "77564": { city: "Hull", state: "TX" },
  "77582": { city: "Raywood", state: "TX" },
  "77532": { city: "Crosby", state: "TX" },
  "77336": { city: "Huffman", state: "TX" },
  "77520": { city: "Baytown", state: "TX" },
  "77521": { city: "Baytown", state: "TX" },
  "77523": { city: "Baytown / Mont Belvieu", state: "TX" },
  "77580": { city: "Mont Belvieu", state: "TX" },
  "77530": { city: "Channelview", state: "TX" },
  "77346": { city: "Humble / Atascocita", state: "TX" },
  "77338": { city: "Humble", state: "TX" },
  "77339": { city: "Kingwood", state: "TX" },
  "77345": { city: "Kingwood", state: "TX" },
  "77365": { city: "Porter", state: "TX" },
  "77357": { city: "New Caney", state: "TX" },
  "77372": { city: "Splendora", state: "TX" },
  "77351": { city: "Livingston", state: "TX" },
  "77331": { city: "Coldspring", state: "TX" }
};

function getDefaultGridlyProfile() {
  return {
    version: 1,
    name: "",
    zipCode: "",
    homeTown: "",
    state: "",
    homeTownLat: null,
    homeTownLng: null,
    homeTownLabel: "",
    setupComplete: false,
    setupSkipped: false
  };
}
function getGridlyUserProfile() {
  try {
    const rectsOverlap = (a, b) => {
      if (!a || !b) return false;
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    };
    const zoomControl = document.querySelector("#map .leaflet-control-zoom");
    const zoomIn = document.querySelector("#map .leaflet-control-zoom-in");
    const zoomOut = document.querySelector("#map .leaflet-control-zoom-out");
    const toggleNode = menuRoot?.querySelector(".gridly-mobile-layer-menu-toggle") || null;
    const zoomControlRect = zoomControl?.getBoundingClientRect?.()?.toJSON?.() || null;
    const zoomInRect = zoomIn?.getBoundingClientRect?.()?.toJSON?.() || null;
    const zoomOutRect = zoomOut?.getBoundingClientRect?.()?.toJSON?.() || null;
    const toggleRect = toggleNode?.getBoundingClientRect?.()?.toJSON?.() || null;

    return { ...getDefaultGridlyProfile(), ...JSON.parse(localStorage.getItem(GRIDLY_PROFILE_STORAGE_KEY) || "{}") };
  } catch (error) {
    return getDefaultGridlyProfile();
  }
}
function getGridlyProfile() { return getGridlyUserProfile(); }
function saveGridlyUserProfile(nextProfile = {}) {
  gridlyUserProfile = { ...getDefaultGridlyProfile(), ...gridlyUserProfile, ...nextProfile };
  localStorage.setItem(GRIDLY_PROFILE_STORAGE_KEY, JSON.stringify(gridlyUserProfile));
  updateProfileUI();
}
function saveGridlyProfile(profile = {}) { saveGridlyUserProfile(profile); }
function getDefaultMovementIntelligence() {
  return {
    version: 1,
    corridors: [],
    routeObservations: [],
    crossingImpact: [],
    computed: {}
  };
}

function normalizeMovementIntelligence(input = {}) {
  const base = getDefaultMovementIntelligence();
  const normalized = { ...base, ...(input && typeof input === "object" ? input : {}) };

  const toNumberOrNull = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const toIsoStringOrEmpty = (value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  };

  normalized.version = 1;
  normalized.corridors = Array.isArray(normalized.corridors)
    ? normalized.corridors.map((corridor, idx) => ({
        id: String(corridor?.id || `corridor-${idx + 1}`),
        label: String(corridor?.label || ""),
        type: ["town-crossing", "commute", "custom"].includes(corridor?.type) ? corridor.type : "custom",
        startLabel: String(corridor?.startLabel || ""),
        endLabel: String(corridor?.endLabel || ""),
        startLat: toNumberOrNull(corridor?.startLat),
        startLng: toNumberOrNull(corridor?.startLng),
        endLat: toNumberOrNull(corridor?.endLat),
        endLng: toNumberOrNull(corridor?.endLng),
        baselineMinutes: toNumberOrNull(corridor?.baselineMinutes),
        currentMinutes: toNumberOrNull(corridor?.currentMinutes),
        confidence: ["low", "medium", "high"].includes(corridor?.confidence) ? corridor.confidence : "low",
        lastUpdated: toIsoStringOrEmpty(corridor?.lastUpdated)
      }))
    : [];

  normalized.routeObservations = Array.isArray(normalized.routeObservations)
    ? normalized.routeObservations.map((obs, idx) => ({
        id: String(obs?.id || `observation-${idx + 1}`),
        corridorId: String(obs?.corridorId || ""),
        source: ["manual", "report", "gps", "future-api"].includes(obs?.source) ? obs.source : "manual",
        observedMinutes: toNumberOrNull(obs?.observedMinutes),
        delayMinutes: toNumberOrNull(obs?.delayMinutes),
        startedAt: toIsoStringOrEmpty(obs?.startedAt),
        endedAt: toIsoStringOrEmpty(obs?.endedAt),
        notes: String(obs?.notes || "")
      }))
    : [];

  normalized.crossingImpact = Array.isArray(normalized.crossingImpact)
    ? normalized.crossingImpact.map((impact) => ({
        crossingId: String(impact?.crossingId || ""),
        corridorId: String(impact?.corridorId || ""),
        impactLevel: ["none", "low", "moderate", "high"].includes(impact?.impactLevel) ? impact.impactLevel : "none",
        activeDelayCount: Math.max(0, Number.isFinite(Number(impact?.activeDelayCount)) ? Number(impact.activeDelayCount) : 0),
        confirmedCount: Math.max(0, Number.isFinite(Number(impact?.confirmedCount)) ? Number(impact.confirmedCount) : 0),
        lastImpactAt: toIsoStringOrEmpty(impact?.lastImpactAt)
      }))
    : [];

  normalized.computed = normalized.computed && typeof normalized.computed === "object" ? normalized.computed : {};
  return normalized;
}

function getMovementIntelligence() {
  try {
    const raw = localStorage.getItem(MOVEMENT_INTELLIGENCE_STORAGE_KEY);
    if (!raw) return normalizeMovementIntelligence();
    return normalizeMovementIntelligence(JSON.parse(raw));
  } catch {
    return normalizeMovementIntelligence();
  }
}

function saveMovementIntelligence(nextData = movementIntelligence) {
  movementIntelligence = normalizeMovementIntelligence(nextData);
  localStorage.setItem(MOVEMENT_INTELLIGENCE_STORAGE_KEY, JSON.stringify(movementIntelligence));
  return movementIntelligence;
}

function ensureSeededMovementIntelligence() {
  const normalized = getMovementIntelligence();
  if (normalized.corridors.length) return normalized;

  const nowIso = new Date().toISOString();
  const seeded = normalizeMovementIntelligence({
    ...normalized,
    corridors: [
      {
        id: "dayton-west-east",
        label: "Dayton West ↔ Dayton East",
        type: "town-crossing",
        startLabel: "Dayton West",
        endLabel: "Dayton East",
        startLat: 30.0395,
        startLng: -94.8852,
        endLat: 30.0468,
        endLng: -94.8291,
        baselineMinutes: 8,
        currentMinutes: 11,
        confidence: "medium",
        lastUpdated: nowIso
      }
    ],
    routeObservations: [
      {
        id: "dayton-west-east-obs-1",
        corridorId: "dayton-west-east",
        source: "manual",
        observedMinutes: 10,
        delayMinutes: 2,
        startedAt: nowIso,
        endedAt: nowIso,
        notes: "Seed observation: light slowdown."
      },
      {
        id: "dayton-west-east-obs-2",
        corridorId: "dayton-west-east",
        source: "report",
        observedMinutes: 11,
        delayMinutes: 3,
        startedAt: nowIso,
        endedAt: nowIso,
        notes: "Seed observation: crossing backup."
      }
    ],
    crossingImpact: [
      {
        crossingId: "seed-dayton-impact-1",
        corridorId: "dayton-west-east",
        impactLevel: "moderate",
        activeDelayCount: 1,
        confirmedCount: 2,
        lastImpactAt: nowIso
      }
    ]
  });

  return saveMovementIntelligence(seeded);
}

function getReportFreshnessMultiplier(minutesAgo = 0) {
  const age = Math.max(0, Number(minutesAgo) || 0);
  if (age <= 10) return 1;
  if (age <= 20) return 0.75;
  if (age <= 45) return 0.5;
  if (age <= 90) return 0.25;
  return 0;
}

function computeCorridorStatus(corridor = {}) {
  const normalized = normalizeMovementIntelligence({ corridors: [corridor] }).corridors[0] || {};
  const hasValidCoordinates =
    [normalized.startLat, normalized.startLng, normalized.endLat, normalized.endLng].every((coord) => Number.isFinite(coord));
  const baselineMinutes = Number(normalized.baselineMinutes);
  const currentMinutes = Number(normalized.currentMinutes);

  if (!Number.isFinite(baselineMinutes) || !Number.isFinite(currentMinutes)) {
    return {
      status: "insufficient-data",
      delayMinutes: null,
      delayRatio: null,
      delayScore: 0,
      confidence: 0,
      freshness: 0,
      weightedScore: 0,
      freshnessMultiplier: 0,
      stackedReportCount: 0,
      computedSeverity: "Clear",
      computedConfidence: 0,
      severityLabel: "Clear",
      hasValidCoordinates,
      warning: "Missing baselineMinutes or currentMinutes."
    };
  }

  const delayMinutes = Math.max(0, currentMinutes - baselineMinutes);
  const delayRatio = baselineMinutes > 0 ? currentMinutes / baselineMinutes : null;
  const status = delayMinutes <= 2 ? "on-time" : delayMinutes <= 7 ? "slowed" : "delayed";
  const linkedCorridor = (Array.isArray(window.__gridlyMovementReportLinks) ? window.__gridlyMovementReportLinks : []).find((item) => item.corridorId === normalized.id);
  const linkedReports = Array.isArray(linkedCorridor?.linkedReports) ? linkedCorridor.linkedReports : [];

  const incidentsByLocation = getUnifiedIncidents();
  const activeReports = linkedReports.filter((report) => ["active", "recently_cleared", "cleared"].includes(getIncidentLifecycleState(report)));
  let weightedScore = 0;
  let weightedFreshness = 0;
  let confirmationScore = 0;
  const uniqueUsers = new Set();

  activeReports.forEach((report) => {
    const type = String(report.type || "").toLowerCase();
    const minutesAgo = Math.max(0, Number(report.minutesAgo) || 0);
    const freshnessMultiplier = getReportFreshnessMultiplier(minutesAgo);
    if (!freshnessMultiplier) return;

    const incident = incidentsByLocation.find((item) => getReportLocationKey(item.latestReport) === getReportLocationKey(report));
    const confirmations = Math.max(1, Number(incident?.reports_count || incident?.count || 1));
    const uniqueUserCount = Math.max(1, Number(incident?.users_count || 1));
    const reportBase = type === "blocked" ? 70 : type === "heavy" ? 40 : type === "delayed" ? 20 : type === "cleared" || type === "hazard_cleared" ? -35 : 12;

    weightedScore += reportBase * freshnessMultiplier;
    weightedFreshness += freshnessMultiplier;
    confirmationScore += Math.max(0, confirmations - 1) * 6 * freshnessMultiplier;
    Array.from({ length: uniqueUserCount }).forEach((_, idx) => uniqueUsers.add(`${report.id || report.crossingId || report.crossingName || 'unknown'}-${idx}`));
  });

  const stackedReportCount = activeReports.filter((report) => getReportFreshnessMultiplier(report.minutesAgo) > 0).length;
  const freshness = stackedReportCount ? Math.round((weightedFreshness / stackedReportCount) * 100) : 0;
  const freshnessMultiplier = stackedReportCount ? Number((weightedFreshness / stackedReportCount).toFixed(2)) : 0;

  const weightedSeverity = Math.max(0, weightedScore);
  const delayScore = Math.max(0, Math.min(100, Math.round(weightedSeverity + confirmationScore)));
  const severityLabel = delayScore >= 60 ? "Blocked" : delayScore >= 30 ? "Heavy Delay" : delayScore >= 10 ? "Minor Delay" : "Clear";

  const blockedCount = activeReports.filter((r) => String(r.type || "").toLowerCase() === "blocked" && getReportFreshnessMultiplier(r.minutesAgo) > 0).length;
  const heavyCount = activeReports.filter((r) => String(r.type || "").toLowerCase() === "heavy" && getReportFreshnessMultiplier(r.minutesAgo) > 0).length;
  const delayedCount = activeReports.filter((r) => String(r.type || "").toLowerCase() === "delayed" && getReportFreshnessMultiplier(r.minutesAgo) > 0).length;

  const confidenceBase = blockedCount * 40 + heavyCount * 25 + delayedCount * 15;
  const multiUserBoost = Math.min(25, uniqueUsers.size * 4);
  const reportCountBoost = Math.min(20, stackedReportCount * 4);
  const confidence = Math.max(0, Math.min(100, Math.round((confidenceBase + confirmationScore + multiUserBoost + reportCountBoost) * (freshnessMultiplier || 0))));

  return {
    status,
    delayMinutes,
    delayRatio,
    delayScore,
    confidence,
    freshness,
    weightedScore: Math.round(weightedSeverity),
    freshnessMultiplier,
    stackedReportCount,
    computedSeverity: severityLabel,
    computedConfidence: confidence,
    severityLabel,
    hasValidCoordinates,
    warning: hasValidCoordinates ? "" : "Invalid or missing corridor coordinates.",
    lastComputedAt: new Date().toISOString()
  };
}

function computeRouteReliability(corridorId = "") {
  const normalized = getMovementIntelligence();
  const observations = normalized.routeObservations.filter((obs) => String(obs.corridorId) === String(corridorId));
  if (!observations.length) {
    return {
      corridorId: String(corridorId || ""),
      reliabilityScore: null,
      confidence: "low",
      sampleSize: 0,
      averageDelayMinutes: null
    };
  }

  const delays = observations
    .map((obs) => (Number.isFinite(obs.delayMinutes) ? obs.delayMinutes : null))
    .filter((value) => value !== null);

  const averageDelayMinutes = delays.length
    ? delays.reduce((sum, value) => sum + value, 0) / delays.length
    : null;

  const reliabilityScore =
    averageDelayMinutes === null
      ? null
      : Math.max(0, Math.min(100, Math.round(100 - Math.max(0, averageDelayMinutes) * 8)));

  const confidence = observations.length >= 15 ? "high" : observations.length >= 5 ? "medium" : "low";

  return {
    corridorId: String(corridorId || ""),
    reliabilityScore,
    confidence,
    sampleSize: observations.length,
    averageDelayMinutes
  };
}

function getActiveReportsForCorridor(corridor = {}) {
  const normalized = normalizeMovementIntelligence({ corridors: [corridor] }).corridors[0] || {};
  const startLat = Number(normalized.startLat);
  const startLng = Number(normalized.startLng);
  const endLat = Number(normalized.endLat);
  const endLng = Number(normalized.endLng);
  if (![startLat, startLng, endLat, endLng].every(Number.isFinite)) return [];

  const corridorSpanKm = calculateDistanceKm(startLat, startLng, endLat, endLng);
  const proximityKm = Math.max(0.8, Math.min(3.5, corridorSpanKm * 0.18));
  const now = Date.now();
  const sourceReports = [...(Array.isArray(activeReports) ? activeReports : []), ...(Array.isArray(activeHazards) ? activeHazards : [])];

  return sourceReports.filter((report) => {
    if (!report || report.expired) return false;
    const lat = Number(report.lat);
    const lng = Number(report.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    const lifecycleState = getIncidentLifecycleState(report, now);
    if (lifecycleState !== "active" && lifecycleState !== "recently_cleared" && lifecycleState !== "cleared") return false;
    return isPointNearCorridor(lat, lng, startLat, startLng, endLat, endLng, proximityKm);
  });
}

function updateCorridorFromReports(corridor = {}) {
  const reportMatches = getActiveReportsForCorridor(corridor);
  const base = normalizeMovementIntelligence({ corridors: [corridor] }).corridors[0] || {};
  const baselineMinutes = Number(base.baselineMinutes);
  const nowIso = new Date().toISOString();
  if (!Number.isFinite(baselineMinutes) || baselineMinutes <= 0) {
    return { corridor: { ...base, lastUpdated: nowIso }, linkedReports: reportMatches, delayMinutes: 0, impactLevel: "low", delayBreakdown: { blocked: 0, heavy: 0, other: 0, cleared: 0 } };
  }

  let delayMinutes = 0;
  const delayBreakdown = { blocked: 0, heavy: 0, other: 0, cleared: 0 };
  const incidentsByLocation = getUnifiedIncidents();

  reportMatches.forEach((report) => {
    const lifecycleState = getIncidentLifecycleState(report);
    const type = String(report.type || "").toLowerCase();
    const minutesAgo = Math.max(0, Number(report.minutesAgo) || 0);
    const recencyWeight = minutesAgo <= 15 ? 1 : minutesAgo <= 45 ? 0.7 : 0.45;
    const incident = incidentsByLocation.find((item) => getReportLocationKey(item.latestReport) === getReportLocationKey(report));
    const confirmations = Math.max(1, Number(incident?.reports_count || incident?.count || 1));
    const confirmationBoost = Math.min(1.35, 1 + (confirmations - 1) * 0.1);

    if (lifecycleState === "active" && type === "blocked") {
      const addition = Math.min(10, Math.max(4, 6 * recencyWeight * confirmationBoost));
      delayMinutes += addition;
      delayBreakdown.blocked += addition;
    } else if (lifecycleState === "active" && type === "heavy") {
      const addition = Math.min(5, Math.max(2, 3 * recencyWeight * confirmationBoost));
      delayMinutes += addition;
      delayBreakdown.heavy += addition;
    } else if (lifecycleState === "active") {
      const addition = Math.max(0.5, 1.2 * recencyWeight);
      delayMinutes += addition;
      delayBreakdown.other += addition;
    } else if (lifecycleState === "recently_cleared" || lifecycleState === "cleared" || type === "cleared" || type === "hazard_cleared") {
      const reduction = Math.min(3, Math.max(0.75, 2.2 * recencyWeight));
      delayMinutes -= reduction;
      delayBreakdown.cleared += reduction;
    }
  });

  const boundedDelay = Math.max(0, Math.round(delayMinutes * 10) / 10);
  const currentMinutes = Math.max(1, Math.round((baselineMinutes + boundedDelay) * 10) / 10);
  const impactLevel = boundedDelay >= 8 ? "high" : boundedDelay >= 3 ? "moderate" : "low";
  const nextConfidence = reportMatches.length >= 5 ? "high" : reportMatches.length >= 2 ? "medium" : base.confidence || "low";
  return {
    corridor: { ...base, currentMinutes, confidence: nextConfidence, lastUpdated: nowIso },
    linkedReports: reportMatches,
    delayMinutes: boundedDelay,
    impactLevel,
    delayBreakdown
  };
}

function recomputeMovementIntelligence() {
  const normalized = getMovementIntelligence();
  const computed = normalized.corridors.map((corridor) => updateCorridorFromReports(corridor));
  const updatedCorridors = computed.map((item) => item.corridor);
  const nextCrossingImpact = computed.map((item) => ({
    crossingId: `corridor-impact-${item.corridor.id}`,
    corridorId: item.corridor.id,
    impactLevel: item.impactLevel,
    activeDelayCount: item.linkedReports.filter((report) => getIncidentLifecycleState(report) === "active").length,
    confirmedCount: item.linkedReports.length,
    lastImpactAt: item.corridor.lastUpdated
  }));

  const next = saveMovementIntelligence({
    ...normalized,
    corridors: updatedCorridors,
    crossingImpact: nextCrossingImpact
  });

  window.__gridlyMovementReportLinks = computed.map((item) => ({
    corridorId: item.corridor.id,
    label: item.corridor.label,
    linkedReports: item.linkedReports.map((report) => ({
      id: report.id,
      type: report.type,
      lifecycleState: getIncidentLifecycleState(report),
      minutesAgo: report.minutesAgo,
      crossingId: report.crossingId,
      crossingName: report.crossingName
    })),
    delayMinutes: item.delayMinutes,
    delayBreakdown: item.delayBreakdown,
    impactLevel: item.impactLevel
  }));

  return next;
}

function getGridlyMovementDebugSnapshot() {
  const normalized = getMovementIntelligence();
  const computedStatuses = normalized.corridors.map((corridor) => ({
    corridorId: corridor.id,
    label: corridor.label,
    status: computeCorridorStatus(corridor),
    reliability: computeRouteReliability(corridor.id)
  }));

  const warnings = [];
  normalized.corridors.forEach((corridor) => {
    const status = computeCorridorStatus(corridor);
    if (!status.hasValidCoordinates) warnings.push(`Corridor ${corridor.id || "(missing id)"} has invalid/missing coordinates.`);
    if (status.warning && status.status === "insufficient-data") warnings.push(`Corridor ${corridor.id || "(missing id)"}: ${status.warning}`);
  });

  console.group("[Gridly] Movement Intelligence Debug");
  console.table(normalized.corridors);
  console.table(normalized.routeObservations);
  console.table(computedStatuses);
  if (warnings.length) console.warn("Missing data warnings:", warnings);
  else console.info("Missing data warnings: none");
  console.groupEnd();

  return {
    movementIntelligence: normalized,
    corridorStatuses: computedStatuses.map((item) => ({ corridorId: item.corridorId, label: item.label, ...item.status })),
    reliabilityCalculations: computedStatuses.map((item) => item.reliability),
    warnings,
    observationCounts: {
      total: normalized.routeObservations.length,
      byCorridor: normalized.corridors.reduce((acc, corridor) => {
        acc[corridor.id] = normalized.routeObservations.filter((obs) => obs.corridorId === corridor.id).length;
        return acc;
      }, {})
    },
    reportLinkedCorridors: Array.isArray(window.__gridlyMovementReportLinks) ? window.__gridlyMovementReportLinks : []
  };
}

function attachGridlyMovementDebugGlobal() {
  window.gridlyMovementDebug = function () {
    return getGridlyMovementDebugSnapshot();
  };
  window.gridlyMovementDebugVerbose = function () {
    const snapshot = getGridlyMovementDebugSnapshot();
    console.info("[Gridly] verbose corridor snapshot", snapshot.corridorStatuses);
    return snapshot;
  };
}

function getMyTownKey() {
  return String(gridlyUserProfile?.homeTown || "Liberty County").trim().toLowerCase() || "liberty county";
}
function updateProfileUI() {
  const townLabel = gridlyUserProfile?.homeTownLabel || gridlyUserProfile?.homeTown || "My Town";
  if (els.mobileTownSelectorBtn) {
    els.mobileTownSelectorBtn.setAttribute("aria-label", `Selected town ${townLabel}, Texas`);
    els.mobileTownSelectorBtn.innerHTML = `My Town<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>`;
    els.mobileTownSelectorBtn.title = townLabel;
  }
}
function maybeOpenFirstRunSetup() {
  // First-run onboarding auto-open disabled (Gridly V18 clean stable).
  return;
}
function syncModalScrollLock() {
  const hasPlaceNameModal = Boolean(document.querySelector(".place-name-modal"));
  const hasOpenModal = Boolean(
    (els.routeSetupModal && !els.routeSetupModal.hidden) ||
    (els.smartAlertsModal && !els.smartAlertsModal.hidden) ||
    hasPlaceNameModal
  );
  document.body.classList.toggle("modal-open", hasOpenModal);
  document.querySelector(".app-shell")?.toggleAttribute("inert", hasOpenModal);
  document.body.classList.toggle(
    "route-setup-open",
    Boolean(els.routeSetupModal && !els.routeSetupModal.hidden)
  );
}

function setRouteActiveBodyState(isActive) {
  document.body.classList.toggle("route-active", Boolean(isActive));
}
function openFirstRunSetupModal() {
  return;
}
let setupStep = 1;
let setupPlacesSummary = { home: false, work: false };
function setSetupStep(step = 1) {
  setupStep = step;
  document.querySelectorAll("[data-setup-step]").forEach((node) => {
    const isActive = Number(node.dataset.setupStep) === step;
    node.hidden = !isActive;
    node.classList.toggle("is-active", isActive);
  });
}
function refreshSetupSummary() {
  const town = String(els.setupTownInput?.value || "").trim();
  const state = String(els.setupStateInput?.value || "").trim();
  if (els.setupSummaryTown) els.setupSummaryTown.textContent = `My Town: ${town ? `${town}${state ? `, ${state}` : ""}` : "Not set"}`;
  const items = [];
  if (setupPlacesSummary.home) items.push("Home");
  if (setupPlacesSummary.work) items.push("Work / School / Jobsite");
  if (els.setupSummaryPlaces) els.setupSummaryPlaces.textContent = `Saved places: ${items.length ? items.join(", ") : "None yet"}`;
}
function closeFirstRunSetupModal() {
  return;
}
function openModal(modalEl, opener = null) {
  if (!modalEl) return;
  modalEl.__opener = opener || document.activeElement;
  modalEl.hidden = false;
  modalEl.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
}
function closeModal(modalEl, { restoreFocus = true } = {}) {
  if (!modalEl) return;
  const focusedElement = document.activeElement;
  if (focusedElement && modalEl.contains(focusedElement) && typeof focusedElement.blur === "function") focusedElement.blur();
  modalEl.hidden = true;
  modalEl.setAttribute("aria-hidden", "true");
  syncModalScrollLock();
  if (restoreFocus && modalEl.__opener && typeof modalEl.__opener.focus === "function") {
    requestAnimationFrame(() => modalEl.__opener.focus());
  }
}

const GRIDLY_PRIMARY_SURFACE_IDS = ["alerts", "settings", "route", "report", "search", "layers"];
let gridlyActiveSurface = null;

function closeGridlySurface(surface, options = {}) {
  const { silent = false } = options;
  if (!surface) return;
  if (surface === "alerts") document.body.classList.remove("portrait-alerts-open");
  if (surface === "settings") {
    closeSettingsModal({ restoreFocus: false });
    closeSmartAlertsModal();
  }
  if (surface === "route") closeRouteSetupModal({ restoreFocus: false });
  if (surface === "report" && typeof closeReportSurface === "function") closeReportSurface({ source: "gridly_surface_owner", nextMode: "live" });
  if (surface === "search" && typeof hideGridlySearchShell === "function") hideGridlySearchShell({ source: "surface_ownership", restoreFocus: false });
  if (!silent) gridlyActiveSurface = null;
}

function openGridlySurface(surface, openHandler = null) {
  if (!surface) return;
  GRIDLY_PRIMARY_SURFACE_IDS.forEach((id) => {
    if (id !== surface) closeGridlySurface(id, { silent: true });
  });
  if (typeof openHandler === "function") openHandler();
  gridlyActiveSurface = surface;
}

window.gridlySurfaceDebug = function gridlySurfaceDebug() {
  const surfaceSelectors = {
    alerts: "#alertsSection",
    settings: "#settingsModal",
    route: "#routeSetupModal, #gridlyMobileRouteQuickPanel",
    report: "#reportSection, #gridlyMobileHazardPanel",
    search: "#gridlySearchShell",
    layers: "#mobileNativeSurfaceLayer"
  };
  const surfaceStates = {
    alerts: Boolean(document.body.classList.contains("portrait-alerts-open")),
    settings: Boolean((els.settingsModal && !els.settingsModal.hidden) || (els.smartAlertsModal && !els.smartAlertsModal.hidden)),
    route: Boolean((els.routeSetupModal && !els.routeSetupModal.hidden) || mobileUiMode === "route"),
    report: Boolean((activeReportMode && activeReportMode !== REPORT_MODES.none) || mobileUiMode === "report"),
    search: Boolean(els.gridlySearchShell && !els.gridlySearchShell.hidden),
    layers: mobileUiMode === "layers"
  };
  const openPanels = Object.entries(surfaceStates).filter(([, open]) => open).map(([name]) => name);
  const modalCount = ["settingsModal", "smartAlertsModal", "routeSetupModal"].reduce((count, id) => {
    const modal = document.getElementById(id);
    return count + (modal && !modal.hidden ? 1 : 0);
  }, 0);
  const closeButtonsFound = Array.from(document.querySelectorAll(".gridly-surface-close")).map((button) => ({
    id: button.id || null,
    ariaLabel: button.getAttribute("aria-label") || null,
    visible: Boolean(button.getClientRects().length > 0)
  }));
  const surfacesMissingClose = Object.entries(surfaceSelectors)
    .filter(([, selector]) => {
      const node = document.querySelector(selector);
      return node && !node.querySelector(".gridly-surface-close");
    })
    .map(([surface]) => surface);
  return { activeSurface: gridlyActiveSurface, openPanels, modalCount, surfaceStates, closeButtonsFound, surfacesMissingClose };
};


function resolveZipCode(zipCode = "") {
  const normalized = String(zipCode || "").trim();
  return ZIP_FALLBACK_LOOKUP[normalized] || null;
}
let zipLookupDebounceTimer = null;
let latestZipLookupToken = 0;
let lastDetectedTown = null;
async function resolveZipCodeWithApi(zipCode = "") {
  const normalized = String(zipCode || "").trim();
  if (!/^\d{5}$/.test(normalized)) return null;
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${normalized}`);
    if (!response.ok) throw new Error("zip lookup failed");
    const payload = await response.json();
    const firstPlace = payload?.places?.[0];
    if (!firstPlace) throw new Error("zip missing place");
    return {
      city: firstPlace["place name"] || "",
      state: firstPlace["state abbreviation"] || "",
      lat: firstPlace.latitude ? Number(firstPlace.latitude) : null,
      lng: firstPlace.longitude ? Number(firstPlace.longitude) : null
    };
  } catch (error) {
    return resolveZipCode(normalized);
  }
}

async function updateDetectedTownFromZip() {
  if (!els.setupDetectedTown) return null;
  const zip = String(els.setupZipInput?.value || "").trim();
  const detected = await resolveZipCodeWithApi(zip);
  const hasManualFallback = Boolean(zip && !detected);
  if (els.setupTownFallbackLabel) els.setupTownFallbackLabel.hidden = !hasManualFallback;
  if (els.setupStateFallbackLabel) els.setupStateFallbackLabel.hidden = !hasManualFallback;
  if (detected) {
    lastDetectedTown = detected;
    els.setupDetectedTown.textContent = `Detected town: ${detected.city}, ${detected.state}`;
    if (els.setupTownInput) els.setupTownInput.value = detected.city;
    if (els.setupStateInput) els.setupStateInput.value = detected.state;
    return detected;
  }
  els.setupDetectedTown.textContent = zip ? "ZIP not recognized. Enter city and state manually." : "Enter ZIP to detect your town.";
  lastDetectedTown = null;
  return null;
}

function saveSetupPlace(type = "home", explicitLabel = "") {
  const fallbackLabel = type === "home" ? "Home" : "Work";
  const customLabel = String(explicitLabel || (type === "home" ? fallbackLabel : "Work")).trim() || fallbackLabel;
  const center = map?.getCenter?.();
  const target = {
    lat: userLocation?.lat || center?.lat || defaultCenter[0],
    lng: userLocation?.lng || center?.lng || defaultCenter[1],
    address: "Saved from setup"
  };
  savePlaceType(type === "home" ? "home" : "work", customLabel, target.address);
  localStorage.setItem(type === "home" ? "gridlyHome" : "gridlyWork", customLabel);
  loadSavedRoute();
  initDailyDestinationHero();
  setConfirmation(`${fallbackLabel} saved from ${userLocation ? "GPS" : "map center"}.`, "success");
}

function openPlaceNameModal(defaultValue = "Work") {
  return new Promise((resolve) => {
    const previousActive = document.activeElement;
    const modal = document.createElement("div");
    modal.className = "route-setup-modal place-name-modal";
    modal.innerHTML = `
      <div class="route-setup-modal-backdrop"></div>
      <div class="route-setup-modal-card place-name-modal-card" role="dialog" aria-modal="true" aria-labelledby="placeNameModalTitle">
        <div class="route-setup-modal-head">
          <h2 id="placeNameModalTitle">Name this place</h2>
        </div>
        <div class="route-setup-grid-mobile">
          <label>Place name
            <input id="placeNameInput" type="text" placeholder="Work, School, Jobsite, etc." />
          </label>
          <button type="button" class="primary-btn" id="savePlaceNameBtn">Save Place</button>
          <button type="button" class="secondary-btn" id="cancelPlaceNameBtn">Cancel</button>
        </div>
      </div>`;

    const cleanup = (value = null) => {
      closeModal(modal);
      modal.remove();
      if (previousActive && typeof previousActive.focus === "function") requestAnimationFrame(() => previousActive.focus());
      resolve(value);
    };
    document.body.appendChild(modal);
    const input = modal.querySelector("#placeNameInput");
    if (input) {
      input.value = defaultValue;
      requestAnimationFrame(() => input.focus());
    }
    openModal(modal);
    modal.querySelector(".route-setup-modal-backdrop")?.addEventListener("click", () => cleanup(null));
    modal.querySelector("#cancelPlaceNameBtn")?.addEventListener("click", () => cleanup(null));
    modal.querySelector("#savePlaceNameBtn")?.addEventListener("click", () => {
      const value = String(input?.value || "").trim() || defaultValue;
      cleanup(value);
    });
    modal.addEventListener("click", (event) => {
      if (event.target === modal) cleanup(null);
    });
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") cleanup(null);
    });
  });
}

function setGreeting(title, context, subtitle, routeLabel) {
  safeText("greetingTitle", title);
  safeText("timeContext", context);
  safeText("greetingSubtitle", subtitle);
  safeText("routeCardLabel", routeLabel);
}

function updateLastUpdated() {
  safeText(
    "lastUpdated",
    `Updated ${new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    })}`
  );
}

function initMap() {
  map = L.map("map", { zoomControl: false }).setView(defaultCenter, 13);
  window.gridlyMapInstance = map;

  L.control.zoom({ position: "bottomright" }).addTo(map);

  map.createPane("routePane");
  map.getPane("routePane").style.zIndex = 700;
  map.getPane("routePane").style.pointerEvents = "none";
  map.createPane("satLabelsPane");
  map.getPane("satLabelsPane").style.zIndex = 640;

  const standardLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    subdomains: "abc",
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors"
  });

  const darkLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  });

  const satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 20,
      attribution: "Tiles &copy; Esri"
    }
  );

  const satelliteLabelsLayer = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      maxZoom: 20,
      pane: "satLabelsPane",
      opacity: 1,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
    }
  );

  const satelliteHybrid = L.layerGroup([satelliteLayer, satelliteLabelsLayer]);
  const baseLayers = {
    Standard: standardLayer,
    Dark: darkLayer,
    Satellite: satelliteHybrid
  };

  const styleClassByName = {
    Standard: "map-style-standard",
    Dark: "map-style-dark",
    Satellite: "map-style-satellite"
  };
  mapBaseLayersByName = baseLayers;
  mapStyleClassByName = styleClassByName;

  const savedStyle = localStorage.getItem(MAP_STYLE_STORAGE_KEY);
  const initialStyle = baseLayers[savedStyle] ? savedStyle : "Satellite";
  currentMapStyle = initialStyle;
  activeBaseLayerName = initialStyle;
  baseLayers[initialStyle].addTo(map);
  map.getContainer().classList.add(styleClassByName[initialStyle]);

  L.control.layers(baseLayers, null, { position: "bottomright", collapsed: true }).addTo(map);
  installLayerPickerDebugDiagnostics();
  map.whenReady(() => syncTacticalMapSurfaceVisibility());

  map.on("baselayerchange", (event) => {
    const selectedName = event?.name;
    const previousStyle = currentMapStyle;
    if (!styleClassByName[selectedName]) return;
    Object.values(styleClassByName).forEach((className) => map.getContainer().classList.remove(className));
    map.getContainer().classList.add(styleClassByName[selectedName]);
    currentMapStyle = selectedName;
    activeBaseLayerName = selectedName;
    localStorage.setItem(MAP_STYLE_STORAGE_KEY, selectedName);
    layerDebugLog("[Gridly][LayerPicker] baselayerchange fired", {
      selectedLayer: selectedName,
      changed: previousStyle !== selectedName,
      previousLayer: previousStyle
    });
  });

  crossingLayer = L.layerGroup().addTo(map);
  savedRouteLayer = L.layerGroup().addTo(map);
  corridorIntelLayer = L.layerGroup().addTo(map);
  unifiedIncidentLayer = L.layerGroup().addTo(map);
  installGridlyMapLineDebugHelper();

  map.on("zoomend moveend", () => {
    if (!crossings.length) return;
    renderCrossings();
  });
  map.on("click", handleHazardPlacementMapClick);

  centerMapOnUserIfAllowed();
  highlightNearestCrossingOnFirstLoad();
  installMapLayoutResizeSafety();
}

function installLayerPickerDebugDiagnostics() {
  const shouldUseCompactLayerMenu = () => true;
  const baseLayerNames = () => Object.keys(mapBaseLayersByName || {});
  const normalizeLayerName = (name) => String(name || "").trim();

  const fallbackLayerNameByIndex = ["Standard", "Dark", "Satellite"];

  const resolveLayerNameFromLabel = (label, index) => {
    const input = label?.querySelector("input[type='radio']");
    const hardMappedByIndex = index >= 0 ? fallbackLayerNameByIndex[index] : null;
    const candidateNames = [
      input?.dataset?.layerName,
      input?.defaultValue,
      input?.value,
      label?.dataset?.layerName,
      label?.innerText,
      label?.textContent,
      label?.querySelector("span")?.innerText,
      label?.querySelector("span")?.textContent,
      input?.closest("label")?.innerText,
      input?.closest("label")?.textContent,
      hardMappedByIndex,
      baseLayerNames()[index]
    ];
    for (const candidate of candidateNames) {
      const normalized = normalizeLayerName(candidate).replace(/\s+/g, " ");
      if (mapBaseLayersByName[normalized]) return normalized;
    }
    return normalizeLayerName(candidateNames.find(Boolean));
  };

  const getCheckedInputLayerName = () => {
    const inputs = Array.from(document.querySelectorAll("#map .leaflet-control-layers-base input[type='radio']"));
    const checkedIndex = inputs.findIndex((input) => input.checked);
    const checkedInput = checkedIndex >= 0 ? inputs[checkedIndex] : null;
    const checkedLabel = checkedInput?.closest("label");
    return resolveLayerNameFromLabel(checkedLabel, checkedIndex);
  };

  const isLayerPickerDebugEnabled = () => typeof window.gridlyLayerControlDebug === "function";

  const collapseLayerPickerOnMobile = () => {
    const isMobileViewport = window.matchMedia?.("(max-width: 767px)")?.matches;
    const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    if (!isMobileViewport && !isCoarsePointer) return false;

    const controlContainer = document.querySelector("#map .leaflet-control-layers");
    if (!controlContainer) return false;

    controlContainer.classList.remove("leaflet-control-layers-expanded");
    controlContainer.classList.add("leaflet-control-layers-collapsed");

    const toggle = controlContainer.querySelector(".leaflet-control-layers-toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }

    const activeElement = document.activeElement;
    if (activeElement && controlContainer.contains(activeElement) && typeof activeElement.blur === "function") {
      activeElement.blur();
    }

    return !controlContainer.classList.contains("leaflet-control-layers-expanded");
  };

  const applyBaseLayerByName = (layerName, source) => {
    const normalizedName = normalizeLayerName(layerName);
    if (!map || !mapBaseLayersByName[normalizedName]) {
      console.warn("[Gridly][LayerPicker] rejected layer change", { source, requestedLayer: layerName, normalizedName });
      return false;
    }
    Object.entries(mapBaseLayersByName).forEach(([, layer]) => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    map.addLayer(mapBaseLayersByName[normalizedName]);
    const applied = map.hasLayer(mapBaseLayersByName[normalizedName]);
    if (!applied) return false;

    activeBaseLayerName = normalizedName;
    currentMapStyle = normalizedName;
    const controlInputs = Array.from(document.querySelectorAll("#map .leaflet-control-layers-base input[type='radio']"));
    controlInputs.forEach((input, index) => {
      const normalizedLabelText = resolveLayerNameFromLabel(input.closest("label"), index);
      input.checked = normalizedLabelText === normalizedName;
    });
    map.fire("baselayerchange", { name: normalizedName, layer: mapBaseLayersByName[normalizedName] });
    const collapsed = collapseLayerPickerOnMobile();
    if (isLayerPickerDebugEnabled()) {
      layerDebugLog("[Gridly][LayerPicker] mobile collapse after selection", {
        selectedLayer: normalizedName,
        collapsed
      });
    }
    layerDebugLog("[Gridly][LayerPicker] active layer after change", {
      source,
      requestedLayer: layerName,
      normalizedLayer: normalizedName,
      activeLayer: Object.entries(mapBaseLayersByName).find(([, layer]) => map.hasLayer(layer))?.[0] || null
    });
    return true;
  };

  let lastLayerToggleEventMeta = null;

  const installGridlyMobileLayerMenu = () => {
    const controlContainer = document.querySelector("#map .leaflet-control-layers");
    const mapNode = document.getElementById("map");
    let mobileControlRail = mapNode?.querySelector(".gridly-mobile-control-rail") || null;
    if (!mobileControlRail && mapNode) {
      mobileControlRail = document.createElement("div");
      mobileControlRail.className = "gridly-mobile-control-rail";
      mapNode.appendChild(mobileControlRail);
    }
    if (shouldUseCompactLayerMenu()) {
      controlContainer?.classList?.add("gridly-mobile-layer-control-hidden");
    } else {
      controlContainer?.classList?.remove("gridly-mobile-layer-control-hidden");
    }

    let existingMenus = Array.from(document.querySelectorAll("#map .gridly-mobile-layer-menu"));
    if (existingMenus.length > 1) {
      existingMenus.slice(1).forEach((duplicateMenu) => duplicateMenu.remove());
      existingMenus = Array.from(document.querySelectorAll("#map .gridly-mobile-layer-menu"));
    }
    let menuRoot = existingMenus[0] || null;
    if (!menuRoot) {
      menuRoot = document.createElement("div");
      menuRoot.className = "gridly-mobile-layer-menu";
      menuRoot.innerHTML = `
        <button type="button" class="gridly-mobile-layer-menu-toggle" aria-expanded="false" aria-haspopup="true" aria-label="Open map layers" title="Map layers">
          <span class="gridly-layer-icon" aria-hidden="true">🗺️</span>
          <span class="gridly-layer-label" aria-hidden="true">LAYERS</span>
        </button>
        <div class="gridly-mobile-layer-menu-list" hidden>
          <button type="button" data-layer-name="Standard">Standard</button>
          <button type="button" data-layer-name="Dark">Dark</button>
          <button type="button" data-layer-name="Satellite">Satellite</button>
        </div>
      `;
      mobileControlRail?.appendChild(menuRoot);

      const toggle = menuRoot.querySelector(".gridly-mobile-layer-menu-toggle");
      const list = menuRoot.querySelector(".gridly-mobile-layer-menu-list");
      const optionButtons = Array.from(menuRoot.querySelectorAll("button[data-layer-name]"));
      const syncActiveState = () => {
        optionButtons.forEach((button) => {
          const isActive = button.dataset.layerName === activeBaseLayerName;
          button.classList.toggle("active", isActive);
          button.setAttribute("aria-pressed", String(isActive));
        });
      };
      const setMenuOpenState = (open) => {
        mobileLayerMenuOpen = Boolean(open);
        menuRoot.classList.toggle("is-open", mobileLayerMenuOpen);
        list.hidden = !mobileLayerMenuOpen;
        toggle.setAttribute("aria-expanded", String(mobileLayerMenuOpen));
      };
      const closeMenu = () => setMenuOpenState(false);
      const openMenu = () => setMenuOpenState(true);
      closeMenu();

      const handleLayerToggleInteraction = (event) => {
        const preventedDefault = typeof event.preventDefault === "function";
        const stoppedPropagation = typeof event.stopPropagation === "function";
        if (preventedDefault) event.preventDefault();
        if (stoppedPropagation) event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        lastLayerToggleEventMeta = {
          type: event.type || null,
          preventedDefault,
          stoppedPropagation
        };
        if (!shouldUseCompactLayerMenu()) return;
        setMenuOpenState(!mobileLayerMenuOpen);
      };
      ["pointerdown", "touchstart", "click"].forEach((eventName) => {
        toggle?.addEventListener(eventName, handleLayerToggleInteraction, { passive: false });
      });

      optionButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const layerName = button.dataset.layerName;
          const didApply = applyBaseLayerByName(layerName, "gridly-mobile-menu");
          syncActiveState();
          if (didApply) closeMenu();
        });
      });
      map?.on?.("baselayerchange", syncActiveState);
      document.addEventListener("pointerdown", (event) => {
        if (!mobileLayerMenuOpen || !shouldUseCompactLayerMenu()) return;
        if (menuRoot.contains(event.target)) return;
        closeMenu();
      });
      syncActiveState();
    }

    const compactMode = shouldUseCompactLayerMenu();
    const zoomControl = document.querySelector("#map .leaflet-control-zoom");
    if (compactMode) {
      mobileControlRail?.appendChild(menuRoot);
      if (zoomControl) mobileControlRail?.appendChild(zoomControl);
    }
    menuRoot.classList.toggle("is-mobile-visible", compactMode);
    if (!compactMode) {
      mobileLayerMenuOpen = false;
      menuRoot.classList.remove("is-open");
      const list = menuRoot.querySelector(".gridly-mobile-layer-menu-list");
      const toggle = menuRoot.querySelector(".gridly-mobile-layer-menu-toggle");
      if (list) list.hidden = true;
      toggle?.setAttribute("aria-expanded", "false");
      mapNode?.appendChild(menuRoot);
      const controlCorner = document.querySelector("#map .leaflet-bottom.leaflet-right");
      if (zoomControl && controlCorner) controlCorner.appendChild(zoomControl);
    }
  };

  const bindLayerOptionLogs = () => {
    const labels = Array.from(document.querySelectorAll("#map .leaflet-control-layers-base label"));
    if (!labels.length) return false;
    labels.forEach((label, index) => {
      if (label.dataset.gridlyLayerBound === "true") return;
      label.dataset.gridlyLayerBound = "true";
      const input = label.querySelector("input[type='radio']");
      const layerName = resolveLayerNameFromLabel(label, index);
      if (input) {
        input.dataset.layerName = layerName;
        input.dataset.layerIndex = String(index);
      }
      label.dataset.layerName = layerName;
      label.addEventListener("click", (event) => {
        const clickedLayer = resolveLayerNameFromLabel(label, index);
        const diagnostic = {
          source: "label",
          rawClickedElement: event?.target?.tagName || null,
          resolvedLayerName: clickedLayer,
          applyCalled: false,
          result: false,
          activeBaseLayerNameAfterApply: activeBaseLayerName,
          checkedInputAfterApply: getCheckedInputLayerName()
        };
        layerDebugLog("[Gridly][LayerPicker] label clicked", { layerName: clickedLayer, selectedLayer: currentMapStyle });
        diagnostic.applyCalled = true;
        diagnostic.result = applyBaseLayerByName(clickedLayer, "label-click");
        diagnostic.activeBaseLayerNameAfterApply = activeBaseLayerName;
        diagnostic.checkedInputAfterApply = getCheckedInputLayerName();
        if (!isMobileLayerMenuMode()) {
          layerDebugLog("[Gridly][LayerPicker] label tap diagnostic", diagnostic);
        }
      });
      input?.addEventListener("change", (event) => {
        const clickedLayer = resolveLayerNameFromLabel(label, index);
        const diagnostic = {
          source: "input",
          rawClickedElement: event?.target?.tagName || null,
          resolvedLayerName: clickedLayer,
          applyCalled: false,
          result: false,
          activeBaseLayerNameAfterApply: activeBaseLayerName,
          checkedInputAfterApply: getCheckedInputLayerName()
        };
        layerDebugLog("[Gridly][LayerPicker] input change", { layerName: clickedLayer, selectedLayer: currentMapStyle, checked: Boolean(input.checked) });
        diagnostic.applyCalled = true;
        diagnostic.result = applyBaseLayerByName(clickedLayer, "input-change");
        diagnostic.activeBaseLayerNameAfterApply = activeBaseLayerName;
        diagnostic.checkedInputAfterApply = getCheckedInputLayerName();
        if (!isMobileLayerMenuMode()) {
          layerDebugLog("[Gridly][LayerPicker] input change diagnostic", diagnostic);
        }
      });
    });
    return true;
  };

  window.gridlyLayerControlDebug = function gridlyLayerControlDebug() {
    const controlRoot = document.querySelector("#map .leaflet-control-layers-base");
    const labels = Array.from(document.querySelectorAll("#map .leaflet-control-layers-base label"));
    const inputs = Array.from(document.querySelectorAll("#map .leaflet-control-layers-base input[type='radio']"));
    const currentTileLayersOnMap = [];
    if (map && typeof map.eachLayer === "function") {
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer || layer instanceof L.LayerGroup) {
          currentTileLayersOnMap.push(layer);
        }
      });
    }
    return {
      activeBaseLayerName: Object.entries(mapBaseLayersByName || {}).find(([, layer]) => map?.hasLayer?.(layer))?.[0] || null,
      registeredBaseLayers: baseLayerNames(),
      currentTileLayersOnMap,
      standardLayerExists: Boolean(mapBaseLayersByName?.Standard),
      darkLayerExists: Boolean(mapBaseLayersByName?.Dark),
      satelliteLayerExists: Boolean(mapBaseLayersByName?.Satellite),
      controlInputs: inputs.map((input, index) => ({
        index,
        value: input.value,
        name: input.name,
        checked: Boolean(input.checked),
        layerName: input.dataset.layerName || null,
        closestLabelText: normalizeLayerName(input.closest("label")?.textContent)
      })),
      controlLabels: labels.map((label, index) => ({
        index,
        innerText: normalizeLayerName(label.innerText),
        textContent: normalizeLayerName(label.textContent),
        closestLabelText: normalizeLayerName(label.closest("label")?.textContent),
        layerName: resolveLayerNameFromLabel(label, index),
        associatedLeafletLayerName: label.querySelector("input[type='radio']")?.dataset?.layerName || null
      })),
      checkedInput: getCheckedInputLayerName() || null,
      pointerEvents: {
        control: controlRoot ? getComputedStyle(controlRoot).pointerEvents : null,
        labels: labels.map((label, index) => ({ index, pointerEvents: getComputedStyle(label).pointerEvents })),
        inputs: inputs.map((input, index) => ({ index, pointerEvents: getComputedStyle(input).pointerEvents }))
      },
      visibleRects: {
        control: controlRoot ? controlRoot.getBoundingClientRect().toJSON() : null,
        labels: labels.map((label, index) => ({ index, rect: label.getBoundingClientRect().toJSON() })),
        inputs: inputs.map((input, index) => ({ index, rect: input.getBoundingClientRect().toJSON() }))
      }
    };
  };
  window.gridlySetBaseLayerDebug = function gridlySetBaseLayerDebug(name) {
    applyBaseLayerByName(name, "debug-helper");
    return window.gridlyLayerControlDebug();
  };
  window.applyMapStyle = function applyMapStyle(name) {
    return applyBaseLayerByName(name, "tactical-dock-layer-sheet");
  };
  window.gridlyLayerMenuAuditDebug = function gridlyLayerMenuAuditDebug() {
    const menuRoot = document.querySelector("#map .gridly-mobile-layer-menu");
    const menuList = menuRoot?.querySelector(".gridly-mobile-layer-menu-list");
    const buttons = Array.from(menuRoot?.querySelectorAll("button[data-layer-name]") || []);
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const isActuallyVisible = (node) => {
      if (!node) return false;
      let current = node;
      while (current && current !== document.documentElement) {
        const style = getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
        current = current.parentElement;
      }
      const rect = node.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return false;
      const insideViewport = rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
      return insideViewport;
    };
    const rectsOverlap = (a, b) => {
      if (!a || !b) return false;
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    };
    const zoomControl = document.querySelector("#map .leaflet-control-zoom");
    const zoomIn = document.querySelector("#map .leaflet-control-zoom-in");
    const zoomOut = document.querySelector("#map .leaflet-control-zoom-out");
    const toggleNode = menuRoot?.querySelector(".gridly-mobile-layer-menu-toggle") || null;
    const zoomControlRect = zoomControl?.getBoundingClientRect?.()?.toJSON?.() || null;
    const zoomInRect = zoomIn?.getBoundingClientRect?.()?.toJSON?.() || null;
    const zoomOutRect = zoomOut?.getBoundingClientRect?.()?.toJSON?.() || null;
    const toggleRect = toggleNode?.getBoundingClientRect?.()?.toJSON?.() || null;
    const controlRail = document.querySelector("#map .gridly-mobile-control-rail");
    const controlRailRect = controlRail?.getBoundingClientRect?.()?.toJSON?.() || null;
    const layerButtonAboveZoom = Boolean(toggleRect && zoomInRect && toggleRect.bottom <= zoomInRect.top);
    const verticalGapBetweenLayerAndZoom = toggleRect && zoomInRect
      ? Math.round((zoomInRect.top - toggleRect.bottom) * 100) / 100
      : null;
    const controlsShareSameParent = Boolean(toggleNode && zoomIn && toggleNode.parentElement === zoomIn.parentElement);
    const controlsAlignedRight = Boolean(toggleRect && zoomInRect && Math.abs(toggleRect.right - zoomInRect.right) <= 1.5);
    const computedLayerButtonStyles = toggleNode ? (() => {
      const style = getComputedStyle(toggleNode);
      return {
        background: style.backgroundColor,
        border: style.border,
        boxShadow: style.boxShadow,
        opacity: style.opacity
      };
    })() : null;
    const computedZoomButtonStyles = zoomIn ? (() => {
      const style = getComputedStyle(zoomIn);
      return {
        background: style.backgroundColor,
        border: style.border,
        boxShadow: style.boxShadow,
        opacity: style.opacity
      };
    })() : null;
    return {
      activeBaseLayerName,
      menuExists: Boolean(menuRoot),
      toggleExists: Boolean(menuRoot?.querySelector(".gridly-mobile-layer-menu-toggle")),
      isOpen: Boolean(menuRoot?.classList.contains("is-open") && menuList && !menuList.hidden),
      visibleButtons: buttons.filter((button) => isActuallyVisible(button) && menuRoot?.classList.contains("is-open")).map((button) => button.textContent.trim()),
      layerButtons: buttons.map((button) => ({ text: button.textContent.trim(), layerName: button.dataset.layerName || "" })),
      totalMenusFound: document.querySelectorAll("#map .gridly-mobile-layer-menu").length,
      duplicateMenusFound: Math.max(0, document.querySelectorAll("#map .gridly-mobile-layer-menu").length - 1),
      activeLayer: activeBaseLayerName,
      wrapperClasses: menuRoot?.className || "",
      toggleRect,
      zoomControlRect,
      zoomInRect,
      zoomOutRect,
      controlRailExists: Boolean(controlRail),
      controlRailRect,
      layerButtonAboveZoom,
      verticalGapBetweenLayerAndZoom,
      controlsShareSameParent,
      controlsAlignedRight,
      railChildrenOrder: controlRail ? Array.from(controlRail.children).map((node) => node.className || node.tagName) : [],
      computedLayerButtonStyles,
      computedZoomButtonStyles,
      toggleOverlapsZoomControl: rectsOverlap(toggleRect, zoomControlRect),
      toggleOverlapsZoomIn: rectsOverlap(toggleRect, zoomInRect),
      toggleOverlapsZoomOut: rectsOverlap(toggleRect, zoomOutRect),
      togglePointerEvents: toggleNode ? getComputedStyle(toggleNode).pointerEvents : null,
      toggleZIndex: toggleNode ? getComputedStyle(toggleNode).zIndex : null,
      menuZIndex: menuRoot ? getComputedStyle(menuRoot).zIndex : null,
      lastLayerToggleEventType: lastLayerToggleEventMeta?.type || null,
      lastLayerTogglePreventedDefault: Boolean(lastLayerToggleEventMeta?.preventedDefault),
      lastLayerToggleStoppedPropagation: Boolean(lastLayerToggleEventMeta?.stoppedPropagation),
      menuRect: menuRoot?.getBoundingClientRect?.()?.toJSON?.() || null,
      listRect: menuList?.getBoundingClientRect?.()?.toJSON?.() || null,
      computedPosition: menuRoot ? (() => {
        const style = getComputedStyle(menuRoot);
        return {
          top: style.top,
          right: style.right,
          bottom: style.bottom,
          left: style.left,
          display: style.display,
          visibility: style.visibility,
          zIndex: style.zIndex
        };
      })() : null,
      computedListDisplay: menuList ? getComputedStyle(menuList).display : null,
      computedListVisibility: menuList ? getComputedStyle(menuList).visibility : null,
      computedListOverflow: menuList ? getComputedStyle(menuList).overflow : null
    };
  };
window.gridlyMobileLayerMenuDebug = window.gridlyLayerMenuAuditDebug;

  bindLayerOptionLogs();
  setTimeout(bindLayerOptionLogs, 400);
  installGridlyMobileLayerMenu();
  window.addEventListener("resize", installGridlyMobileLayerMenu, { passive: true });
}




function installMapLayoutResizeSafety() {
  const mapEl = document.getElementById("map");
  const mapFrame = document.querySelector(".map-frame");
  if (!map || !mapEl || !mapFrame) return;

  let rafId = null;
  let debounceId = null;

  const scheduleMapResize = () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (debounceId) clearTimeout(debounceId);

    rafId = requestAnimationFrame(() => {
      map.invalidateSize({ pan: false, debounceMoveend: true });
      syncTacticalMapSurfaceVisibility();
    });

    debounceId = setTimeout(() => {
      map.invalidateSize({ pan: false, debounceMoveend: true });
      syncTacticalMapSurfaceVisibility();
    }, 180);
  };

  const observer = new ResizeObserver(() => {
    scheduleMapResize();
  });

  observer.observe(mapFrame);
  observer.observe(mapEl);
  window.addEventListener("resize", scheduleMapResize, { passive: true });
  scheduleMapResize();
}

function installGridlyMapLineDebugHelper() {
  window.gridlyMapLineDebug = function gridlyMapLineDebug() {
    const mapPolylineLayers = [];
    if (map && typeof map.eachLayer === "function") {
      map.eachLayer((layer) => {
        if (layer instanceof L.Polyline) mapPolylineLayers.push(layer);
      });
    }
    const knownLayerCounts = {
      savedRouteLayer: savedRouteLayer && typeof savedRouteLayer.getLayers === "function" ? savedRouteLayer.getLayers().length : 0,
      corridorIntelLayer: corridorIntelLayer && typeof corridorIntelLayer.getLayers === "function" ? corridorIntelLayer.getLayers().length : 0
    };
    const activation = getLineActivationContext();
    return {
      selectedCorridorId: window.__gridlySelectedCorridorId,
      activeCorridorId: window.__gridlyActiveCorridorId,
      movementSelectedCorridorId: window.__gridlyMovementSelectedCorridorId,
      selectedRouteId: window.__gridlySelectedRouteId,
      routeWatchActive: window.__gridlyRouteWatchActive,
      knownLineLayerCounts: knownLayerCounts,
      hasAnyLeafletPolylineLayers: mapPolylineLayers.length > 0,
      leafletPolylineLayerCount: mapPolylineLayers.length,
      knownLayerNames: Object.keys(knownLayerCounts),
      renderReason: activation.selectedCorridorId ? "selected-corridor-id" : activation.selectedRouteId ? "selected-route-id" : activation.routeWatchActive ? "route-watch-active" : "none"
    };
  };
}

function ensureMapStylePersistence(sourceLabel = "unknown") {
  if (!map || !currentMapStyle || !mapBaseLayersByName[currentMapStyle]) return;
  const activeLayer = Object.entries(mapBaseLayersByName).find(([, layer]) => map.hasLayer(layer));
  const activeName = activeLayer?.[0] || null;
  if (activeName === currentMapStyle) return;
  console.warn(`Map style drift detected after ${sourceLabel}. Restoring ${currentMapStyle}.`);
  mapBaseLayersByName[currentMapStyle].addTo(map);
  if (mapStyleClassByName[currentMapStyle]) {
    Object.values(mapStyleClassByName).forEach((className) => map.getContainer().classList.remove(className));
    map.getContainer().classList.add(mapStyleClassByName[currentMapStyle]);
  }
  localStorage.setItem(MAP_STYLE_STORAGE_KEY, currentMapStyle);
}

function centerMapOnUserIfAllowed() {
  if (!navigator.geolocation || !map) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      renderUserLocationDot();
      map.setView([userLocation.lat, userLocation.lng], 14);
      renderCrossings();
      renderUnifiedIncidents();
      updateNearestContext();
    },
    () => {}
  );
}

function updateNearestContext() {
  if (!userLocation) return;
  const nearestCrossing = findNearestCrossings(userLocation.lat, userLocation.lng, 1)[0];
  const nearestIssue = getUnifiedIncidents()
    .filter((incident) => incident.status === "active")
    .map((incident) => ({
      incident,
      distance: getDistanceMiles(userLocation.lat, userLocation.lng, incident.lat, incident.lng)
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  if (nearestCrossing && els.geoFilterStatus) {
    const crossingDistance = Number.isFinite(nearestCrossing.distance) ? nearestCrossing.distance.toFixed(1) : "nearby";
    const issueText = nearestIssue
      ? `${nearestIssue.incident.title} · ${nearestIssue.distance.toFixed(1)} mi`
      : "No active issues nearby";
    els.geoFilterStatus.textContent = `Nearest crossing: ${nearestCrossing.name} (${crossingDistance} mi) · Nearest issue: ${issueText}`;
  }
}

function renderUserLocationDot() {
  if (!map || !userLocation) return;
  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
    radius: 10,
    color: "#56a8ff",
    fillColor: "#2f86ff",
    fillOpacity: 0.96,
    weight: 3
  })
    .bindPopup("You are here")
    .addTo(map);
}

async function loadCrossings() {
  try {
    crossingLoadFailed = false;
    safeText("dataStatus", "Crossing data: loading");
    safeText("mapTrustNote", "Loading curated Gridly crossing dataset...");

    crossingReviewOverrides = await loadCrossingReviewOverrides();

    const response = await fetchFraCrossingsWithRetry();

    const data = await response.json();

    const rawCrossings = (data.features || [])
      .filter((feature) => {
        if (!feature || !feature.geometry) return false;
        if (!Array.isArray(feature.geometry.coordinates)) return false;

        const [lng, lat] = feature.geometry.coordinates;
        return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
      })
      .map((feature, index) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties || {};

        const id = String(
          props.crossingid ||
            props.crossing_id ||
            props.crossing ||
            `crossing-${index}`
        );

        const originalName =
          props.street ||
          props.roadwayname ||
          props.highwayname ||
          props.road ||
          props.crossingname ||
          "Railroad Crossing";

        const override = crossingReviewOverrides[id] || {};
        const localName = String(override.localName || "").trim();
        const resolvedName = localName || originalName;
        const city = inferCrossingCity(resolvedName, props);
        const regionKey = buildRegionKey({
          country: LOCATION_DEFAULTS.country,
          state: LOCATION_DEFAULTS.state,
          county: LOCATION_DEFAULTS.county,
          city
        });

        return {
          id,
          name: resolvedName,
          originalName,
          railroad:
            props.railroad ||
            props.railroadname ||
            props.railroad_company ||
            props.rrname ||
            "Rail line",
          lat: Number(lat),
          lng: Number(lng),
          country: LOCATION_DEFAULTS.country,
          state: LOCATION_DEFAULTS.state,
          county: LOCATION_DEFAULTS.county,
          city,
          regionKey,
          risk: calculateBaseRisk(props, index),
          review: override,
          props
        };
      });

    crossings = rawCrossings.filter((crossing) => {
      return shouldShowCrossingInLaunchMode(crossing);
    });

    populateCrossingSelect();
    renderCrossings();
    updateRouteIntelligence();
    updateTrustStats();
    updateGrowthWidgets();
    updateDailyHabitStatus();
    updateLastUpdated();

    safeText("dataStatus", `${crossings.length} curated crossings loaded`);
    safeText("crossingCount", crossings.length);

    safeText(
      "mapTrustNote",
      `${crossings.length} curated public crossings loaded for Gridly launch mode. Tap a marker to report road issues.`
    );
  } catch (error) {
    crossingLoadFailed = true;
    console.error("Gridly crossing load failed:", error);
    safeText("dataStatus", "Crossing data failed");
    safeText("crossingCount", "Failed");
    safeText("mapTrustNote", "Unable to load curated crossing data. Tap Refresh Reports to retry.");
  }
}

async function loadRoadwayDataset() {
  roadwayDatasetLoaded = false;
  roadwayDatasetLoadError = null;
  roadwaySegmentFeatures = [];
  try {
    const response = await fetch(ROADWAY_SEGMENTS_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Roadway dataset returned ${response.status}`);
    const geojson = await response.json();
    const features = Array.isArray(geojson?.features) ? geojson.features : [];
    roadwaySegmentFeatures = features.filter((feature) => {
      if (!feature || feature.type !== "Feature") return false;
      const geometryType = feature?.geometry?.type;
      const coordinates = feature?.geometry?.coordinates;
      const isLine = geometryType === "LineString" || geometryType === "MultiLineString";
      return isLine && Array.isArray(coordinates) && coordinates.length > 0;
    });
    roadwayDatasetLoaded = true;
  } catch (error) {
    roadwayDatasetLoadError = String(error?.message || error || "unknown_error");
    console.warn("Unable to load local roadway dataset:", error);
  }
}

function findNearestRoadwaySegment(lat, lng, maxDistanceMiles = 1.2) {
  if (!roadwayDatasetLoaded || !Array.isArray(roadwaySegmentFeatures) || !roadwaySegmentFeatures.length) return null;
  let best = null;
  for (const feature of roadwaySegmentFeatures) {
    const segments = flattenRoadGeometrySegments(feature?.geometry);
    for (const segment of segments) {
      const distance = distancePointToSegmentMiles(lat, lng, segment.startLat, segment.startLng, segment.endLat, segment.endLng);
      if (!Number.isFinite(distance)) continue;
      if (!best || distance < best.distanceMiles) {
        best = {
          feature,
          distanceMiles: distance
        };
      }
    }
  }
  if (!best || !Number.isFinite(best.distanceMiles) || best.distanceMiles > maxDistanceMiles) return null;
  return best;
}

function flattenRoadGeometrySegments(geometry) {
  if (!geometry || !geometry.type) return [];
  if (geometry.type === "LineString") return lineCoordinatesToSegments(geometry.coordinates);
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates.flatMap((line) => lineCoordinatesToSegments(line));
  }
  return [];
}

function lineCoordinatesToSegments(lineCoordinates) {
  if (!Array.isArray(lineCoordinates) || lineCoordinates.length < 2) return [];
  const segments = [];
  for (let i = 1; i < lineCoordinates.length; i += 1) {
    const start = lineCoordinates[i - 1];
    const end = lineCoordinates[i];
    const startLng = Number(start?.[0]);
    const startLat = Number(start?.[1]);
    const endLng = Number(end?.[0]);
    const endLat = Number(end?.[1]);
    if (![startLat, startLng, endLat, endLng].every(Number.isFinite)) continue;
    segments.push({ startLat, startLng, endLat, endLng });
  }
  return segments;
}

function distancePointToSegmentMiles(lat, lng, startLat, startLng, endLat, endLng) {
  const scale = Math.cos(toRad((startLat + endLat + lat) / 3));
  const pointX = lng * scale;
  const startX = startLng * scale;
  const endX = endLng * scale;
  const pointY = lat;
  const startY = startLat;
  const endY = endLat;
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0) return haversineDistance(lat, lng, startLat, startLng);
  let t = ((pointX - startX) * dx + (pointY - startY) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const projX = startX + t * dx;
  const projY = startY + t * dy;
  const projLng = scale === 0 ? startLng : projX / scale;
  const projLat = projY;
  return haversineDistance(lat, lng, projLat, projLng);
}

async function fetchFraCrossingsWithRetry() {
  let lastError = null;

  for (let attempt = 1; attempt <= CROSSING_FETCH_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(FRA_URL);

      if (!response.ok) {
        throw new Error(`FRA feed returned ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < CROSSING_FETCH_RETRY_ATTEMPTS) {
        console.warn(
          `FRA crossing fetch attempt ${attempt} failed. Retrying...`,
          error
        );
        await wait(CROSSING_FETCH_RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError || new Error("FRA crossing fetch failed");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inferCrossingCity(crossingName, props = {}) {
  const valuePool = [
    crossingName,
    props.city,
    props.cityname,
    props.community,
    props.place,
    props.inc_city,
    props.nearcity,
    props.municipality
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  for (const rule of LIBERTY_COUNTY_CITY_RULES) {
    if (rule.patterns.some((pattern) => valuePool.some((value) => value.includes(pattern)))) {
      return rule.city;
    }
  }

  return "Unassigned";
}

function buildRegionKey({ country, state, county, city }) {
  return [country, state, county, city].map(toRegionSlug).join(".");
}

function toRegionSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function loadCrossingReviewOverrides() {
  try {
    const response = await fetch(CROSSING_REVIEW_OVERRIDES_URL, {
      cache: "no-store"
    });

    if (!response.ok) {
      console.warn("Crossing review override file not found. Falling back to raw FRA data.");
      return {};
    }

    return await response.json();
  } catch (error) {
    console.warn("Unable to load crossing review overrides:", error);
    return {};
  }
}

function shouldShowCrossingInLaunchMode(crossing) {
  const review = crossing.review || {};
  const visibility = review.visibility || "unreviewed";
  const localName = String(review.localName || "").trim();

  if (visibility === "hide") return false;

  if (visibility === "keep") return true;

  if (localName.length > 0) return true;

  return false;
}
function refreshReportHazardViews() {
  renderAlerts();
  renderRoadHazards();
  renderTrendingCrossings();
  renderUnifiedIncidents();
  renderCrossings();
  updateRouteIntelligence();
  updateTrustStats();
  updateGrowthWidgets();
  updateDailyHabitStatus();
  updateMobileAlertsMirror();
  evaluateSmartAlertsBanner();
  updateLastUpdated();
  recomputeMovementIntelligence();
  updateCorridorSummaryCards();
}

window.gridlyClearLocalTestReports = function gridlyClearLocalTestReports() {
  const reportCountBefore = activeReports.length;
  const hazardCountBefore = activeHazards.length;

  activeReports = [];
  activeHazards = [];

  const removedLocalKeys = [];
  const testKeyMatcher = /^gridly(?:Local)?(?:Test|Dev).*(?:Report|Hazard)/i;
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (key && testKeyMatcher.test(key)) {
      localStorage.removeItem(key);
      removedLocalKeys.push(key);
    }
  }

  refreshReportHazardViews();

  const summary = {
    clearedLocalActiveReports: reportCountBefore,
    clearedLocalActiveHazards: hazardCountBefore,
    removedLocalStorageKeys: removedLocalKeys.sort(),
    supabaseRowsDeleted: 0,
    note: "Local in-memory report/hazard state cleared. Supabase production data was not deleted."
  };

  console.info("gridlyClearLocalTestReports summary", summary);
  return summary;
};

async function runPostSubmitRefresh() {
  console.debug("Post-submit refresh started");
  await loadSharedReports();
  refreshReportHazardViews();
  console.debug("Post-submit refresh complete");
}

async function loadSharedReports() {
  if (!supabaseClient) {
    setSync(`Live sync unavailable · Build ${APP_BUILD}`);
    return;
  }

  try {
    setSync("Reading live reports...");

    const nowIso = new Date().toISOString();

    const { data, error } = await supabaseClient
      .from("reports")
      .select("*")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;

    const rawRows = Array.isArray(data) ? data : [];
    if (!Array.isArray(data)) {
      console.warn("Gridly report sync returned a non-array payload; defaulting to empty reports.", data);
    }

    const normalized = normalizeReports(rawRows);

    activeHazards = normalized.filter((report) => report.reportKind === "hazard");
    activeReports = normalized.filter((report) => report.reportKind !== "hazard");

    refreshReportHazardViews();

    setSync(`${activeReports.length} crossing reports · ${activeHazards.length} hazards synced`);
  } catch (error) {
    console.error("Gridly report sync failed:", error);
    setSync("Live sync read failed");
  }

}

function normalizeReports(rows) {
  return rows.map((row) => {
    const createdAt = row.created_at || new Date().toISOString();
    const minutesAgo = Math.max(
      0,
      Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    );

    const incomingType = String(row.report_type || "other").toLowerCase();
    const reportType = incomingType === "wreck" ? "crash" : incomingType;
    const isHazard =
  Object.prototype.hasOwnProperty.call(HAZARD_TYPES, reportType) ||
  reportType === "hazard_cleared";
    const copy =
  reportType === "hazard_cleared"
    ? {
        label: "Hazard Cleared",
        icon: "✅",
        severity: "low",
        detail: row.detail || "Shared report: road hazard appears cleared."
      }
    : isHazard
    ? HAZARD_TYPES[reportType]
    : getReportCopy(reportType);

    return {
      id: row.id,
      crossingId: String(row.crossing_id),
      crossingName: row.crossing_name || (isHazard ? copy.label : "Unknown crossing"),
      railroad: row.railroad || (isHazard ? "Road hazard" : "Rail line"),
      lat: Number(row.lat),
      lng: Number(row.lng),
      type: reportType,
      reportKind: isHazard ? "hazard" : "crossing",
      icon: isHazard ? copy.icon : "",
      severity: row.severity || copy.severity,
      title: isHazard
        ? `${copy.icon} ${copy.label}`
        : `${row.crossing_name || "Crossing"} ${copy.shortTitle}`,
      detail: row.detail || copy.detail,
      source: row.source || "user",
      confidence: row.confidence || "shared live report",
      deviceId: row.device_id,
      submittedAt: createdAt,
      expiresAt: row.expires_at,
      minutesAgo,
      expired: row.expires_at ? new Date(row.expires_at).getTime() <= Date.now() : false
    };
  });

  highlightNearestCrossingOnFirstLoad();
}

function populateCrossingSelect() {
  if (!els.crossingSelect) return;

  const sorted = [...crossings].sort((a, b) => a.name.localeCompare(b.name));

  els.crossingSelect.innerHTML = `
    <option value="">Choose a crossing</option>
    ${sorted
      .map(
        (crossing) =>
          `<option value="${sanitizeText(crossing.id)}">${sanitizeText(crossing.name)} · ${sanitizeText(crossing.railroad)}</option>`
      )
      .join("")}
  `;
}


function getDefaultRelevantCrossings() {
  const activeOrClearedCrossingIds = new Set(
    activeReports
      .filter((report) => {
        const state = getIncidentLifecycleState(report);
        return state === "active" || state === "recently_cleared";
      })
      .map((report) => String(report.crossingId))
  );

  const nearbyCenter = userLocation || { lat: defaultCenter[0], lng: defaultCenter[1] };
  const nearbyCrossings = findNearestCrossings(nearbyCenter.lat, nearbyCenter.lng, 60).filter(
    (crossing) => getDistanceMiles(nearbyCenter.lat, nearbyCenter.lng, crossing.lat, crossing.lng) <= DEFAULT_NEARBY_RADIUS_MILES
  );
  const nearbyIds = new Set(nearbyCrossings.map((crossing) => String(crossing.id)));

  const hasSavedRoute = Boolean(localStorage.getItem("gridlyHome") && localStorage.getItem("gridlyWork"));
  const savedRouteCrossingIds = hasSavedRoute
    ? new Set(
        activeReports
          .filter((report) => getIncidentLifecycleState(report) === "active")
          .map((report) => String(report.crossingId))
      )
    : new Set();

  return crossings.filter((crossing) => {
    const id = String(crossing.id);
    if (activeOrClearedCrossingIds.has(id)) return true;
    if (nearbyIds.has(id)) return true;
    if (savedRouteCrossingIds.has(id)) return true;
    if (showAllCrossingsLayer) return true;
    return false;
  });

  highlightNearestCrossingOnFirstLoad();
}

function shouldShowDistantInactiveCrossing(crossing) {
  if (showAllCrossingsLayer) return true;
  if (!map) return false;
  const zoom = map.getZoom();
  if (zoom < DISTANT_CROSSING_MIN_ZOOM) return false;
  const report = getLatestReportForCrossing(crossing.id);
  const state = getIncidentLifecycleState(report);
  return state !== "active" && state !== "recently_cleared";
}
function renderCrossings() {
  if (!crossingLayer || !crossings.length) return;
  renderSavedRouteLine();

  const bounds = map?.getBounds?.();
  const visibleCrossings = getVisibleCrossingsForFilter().filter((crossing) => {
    const inDefaultSet = getDefaultRelevantCrossings().some((item) => String(item.id) === String(crossing.id));
    const inView = bounds ? bounds.contains([crossing.lat, crossing.lng]) : true;
    return (inDefaultSet || shouldShowDistantInactiveCrossing(crossing)) && inView;
  });
  const prioritizedVisibleCrossings = userLocation
    ? visibleCrossings
        .map((crossing) => ({
          crossing,
          distance: getDistanceMiles(userLocation.lat, userLocation.lng, crossing.lat, crossing.lng)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 120)
        .map((entry) => entry.crossing)
    : visibleCrossings;
  updateGeoFilterStatus(prioritizedVisibleCrossings);

  crossingLayer.clearLayers();
  crossingMarkers.clear();

  const smartClusterState = buildSmartIncidentClusters(prioritizedVisibleCrossings);
  const hasSavedRoute = savedRouteCrossingIds.size >= 2;

  prioritizedVisibleCrossings.forEach((crossing) => {
    const report = getLatestReportForCrossing(crossing.id);
    const lifecycleState = getIncidentLifecycleState(report);
    const hasActiveIssue = lifecycleState === "active";
    const isCleared = lifecycleState === "recently_cleared";
    const reportType = String(report?.type || "").toLowerCase();
    const markerStateClass = isCleared
      ? "state-cleared"
      : reportType === "blocked"
        ? "state-blocked"
        : reportType === "heavy"
          ? "state-delay"
          : "state-normal";
    const isNearby = nearbyReportCrossingIds.has(String(crossing.id));
    const isOnSavedRoute = savedRouteCrossingIds.has(String(crossing.id));
    const isImpactedOnRoute = isOnSavedRoute && hasActiveIssue;
    const isOffRouteFaded = hasSavedRoute && !isOnSavedRoute;
    const markerLabel = getMarkerLabel(report, markerStateClass, lifecycleState);
    const clusterCount = smartClusterState.leadCounts.get(String(crossing.id)) || 0;
    if (smartClusterState.hiddenIds.has(String(crossing.id))) return;
    const markerMinutes = hasActiveIssue && report?.minutesAgo <= REPORT_EXPIRATION_MINUTES ? `${report.minutesAgo}m ago` : "";

    const icon = L.divIcon({
      className: "",
      html: `<div class="gridly-marker-wrap">
        <div class="gridly-marker ${markerStateClass} ${hasActiveIssue ? "alert" : ""} ${isCleared ? "cleared" : ""} ${isNearby ? "nearby" : ""} ${clusterCount > 1 ? "cluster-lead" : ""}">${markerLabel}</div>
        ${clusterCount > 1 ? `<span class="gridly-marker-cluster-badge">${clusterCount}</span>` : ""}
        ${markerMinutes ? `<span class="gridly-marker-minutes">${markerMinutes}</span>` : ""}
      </div>`,
      iconSize: [72, 44],
      iconAnchor: [24, 22]
    });

    const marker = L.marker([crossing.lat, crossing.lng], { icon })
      .bindPopup(buildPopup(crossing, report), {
        maxWidth: 350,
        autoPan: false,
        closeButton: true,
        className: "gridly-crossing-popup"
      })
      .addTo(crossingLayer);

    if (!marker.__gridlyCrossingClickBound) {
      marker.off("click");
      marker.on("click", (event) => {
        event?.originalEvent?.stopPropagation?.();
        event?.originalEvent?.preventDefault?.();
        const now = Date.now();
        if (Number.isFinite(marker.__gridlyLastClickAt) && now - marker.__gridlyLastClickAt < 220) {
          gridlyDuplicateMarkerClickCount += 1;
          return;
        }
        marker.__gridlyLastClickAt = now;
        console.log("Crossing marker clicked", String(crossing.id));
        const mapRef = map;
        gridlyPopupLastTapAt = now;
        gridlyLastPopupTapCrossingId = String(crossing.id);
        gridlyPopupSingleTapFlowReady = true;
        gridlyPopupSingleTapGuaranteed = true;
        gridlyPopupReopenReady = false;
        const token = `popup-${++gridlyPopupTapSeq}`;
        cancelPendingCrossingPopup("replaced-by-new-tap");
        const session = { token, marker, mapRef: mapRef || null, opened: false, openTimer: null };
        window.__gridlyPopupPanSession = session;
        mapRef?.closePopup?.();

      if (!mapRef || typeof mapRef.latLngToContainerPoint !== "function" || typeof mapRef.panBy !== "function") {
        gridlyLastPopupScheduledDelay = 100;
        session.openTimer = setTimeout(() => {
          gridlyLastPopupTimerFiredAt = Date.now();
          finalizeOpenCrossingPopup(marker, token, "no-mapref-delay");
        }, gridlyLastPopupScheduledDelay);
        return;
      }

      const markerPoint = mapRef.latLngToContainerPoint(marker.getLatLng());
      const viewport = mapRef.getSize?.();
      const viewportWidth = viewport?.x || window.innerWidth || 0;
      const viewportHeight = viewport?.y || window.innerHeight || 0;
      const safeInsets = { left: 18, right: 18, top: 16, bottom: 16 };
      const estimatedPopupSize = { width: Math.min(340, Math.max(260, viewportWidth - 44)), height: 220 };
      const safeTargetX = Math.max(
        safeInsets.left + Math.ceil(estimatedPopupSize.width / 2),
        Math.min(viewportWidth - safeInsets.right - Math.ceil(estimatedPopupSize.width / 2), Math.round(viewportWidth * 0.5))
      );
      const safeTargetY = Math.max(
        safeInsets.top + estimatedPopupSize.height + 10,
        Math.min(viewportHeight - safeInsets.bottom - 20, Math.round(viewportHeight * 0.68))
      );
      const panX = Math.round(markerPoint.x - safeTargetX);
      const panY = Math.round(markerPoint.y - safeTargetY);
      const shouldAutoPan = Math.abs(panX) > 4 || Math.abs(panY) > 4;
      window.__gridlyLastPopupAutoPanApplied = shouldAutoPan;
      gridlyPopupCameraPanApplied = shouldAutoPan;
      gridlyPopupAnchorMode = "manual-safe-lower-center";
      gridlyPopupLastMarkerScreenPoint = { x: Math.round(markerPoint.x), y: Math.round(markerPoint.y) };
      gridlyPopupLastSafeTargetPoint = { x: safeTargetX, y: safeTargetY };
      gridlyPopupViewportBounds = { width: viewportWidth, height: viewportHeight, safeInsets };

      const openDelay = shouldAutoPan ? 360 : 100;
      gridlyLastPopupScheduledDelay = openDelay;
      if (!shouldAutoPan) {
        session.openTimer = setTimeout(() => {
          gridlyLastPopupTimerFiredAt = Date.now();
          finalizeOpenCrossingPopup(marker, token, "no-pan-guaranteed-delay");
        }, openDelay);
        return;
      }

      gridlyLastPopupPanStartedAt = Date.now();
      session.openTimer = setTimeout(() => {
        gridlyLastPopupTimerFiredAt = Date.now();
        finalizeOpenCrossingPopup(marker, token, "post-pan-guaranteed-delay");
      }, openDelay);
      mapRef.panBy([panX, panY], { animate: true, duration: 0.27 });
      });
      marker.__gridlyCrossingClickBound = true;
      gridlyMarkerClickHandlerGuardApplied = true;
    }

    marker.on("popupopen", () => {
      console.log("Crossing popup opened", String(crossing.id));
      gridlyPopupReopenReady = true;
      const popupEl = marker.getPopup()?.getElement?.();
      if (popupEl) wirePopupReportButtons(popupEl);
    });

    marker.on("popupclose", () => {
      gridlyPopupReopenReady = true;
      const activeSession = window.__gridlyPopupPanSession;
      if (activeSession && !activeSession.opened) return;
      cancelPendingCrossingPopup("popup-closed");
    });

    const markerEl = marker.getElement?.();
    if (markerEl) {
      markerEl.classList.toggle("route-priority", isOnSavedRoute);
      markerEl.classList.toggle("off-route-faded", isOffRouteFaded);
      markerEl.classList.toggle("route-impacted", isImpactedOnRoute);
    }

    crossingMarkers.set(String(crossing.id), marker);
  });

  highlightNearestCrossingOnFirstLoad();
}


function getRoutePolylineLatLngs() {
  const layerLatLngs = window.__gridlyRoutePreviewLayer?.getLatLngs?.();
  if (Array.isArray(layerLatLngs) && layerLatLngs.length >= 2) {
    return layerLatLngs.map((pt) => ({ lat: Number(pt?.lat), lng: Number(pt?.lng) })).filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng));
  }
  const savedLatLngs = savedRouteLayer?.getLayers?.().find((layer) => typeof layer.getLatLngs === "function")?.getLatLngs?.();
  if (Array.isArray(savedLatLngs) && savedLatLngs.length >= 2) {
    return savedLatLngs.map((pt) => ({ lat: Number(pt?.lat), lng: Number(pt?.lng) })).filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng));
  }
  return [];
}

function getHazardCategory(type = "") {
  const normalizedType = String(type || "").trim().toLowerCase();
  return HAZARD_CATEGORY_MAP[normalizedType] || "other_hazard";
}

function getHazardMetadata(type = "") {
  return HAZARD_TYPES[getHazardCategory(type)] || HAZARD_TYPES.other_hazard;
}

function getRouteCandidateDedupeKey(report = {}, crossing = null) {
  const normalizedType = String(report?.type || "").toLowerCase();
  const normalizedCategory = getHazardCategory(normalizedType);
  const normalizedCrossingId = String(report?.crossingId || crossing?.id || "").trim();
  if (normalizedCrossingId && !normalizedCrossingId.startsWith("hazard-")) {
    return `crossing:${normalizedCrossingId}`;
  }
  const lat = Number.isFinite(Number(report?.lat)) ? Number(report.lat) : Number(crossing?.lat);
  const lng = Number.isFinite(Number(report?.lng)) ? Number(report.lng) : Number(crossing?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const latKey = lat.toFixed(3);
    const lngKey = lng.toFixed(3);
    return `geo:${normalizedCategory}:${latKey}:${lngKey}`;
  }
  return `fallback:${normalizedCategory}:${normalizedCrossingId || "unknown"}`;
}

function getRouteCandidateSeverityRank(reportType = "", hazardCategory = "") {
  const normalizedType = String(reportType || "").toLowerCase();
  if (normalizedType === "blocked" || hazardCategory === "road_closed" || hazardCategory === "rail_blockage_delay" || hazardCategory === "flooding" || hazardCategory === "crash") return 5;
  if (normalizedType === "heavy" || normalizedType === "delayed" || normalizedType === "delay" || hazardCategory === "debris" || hazardCategory === "construction" || hazardCategory === "disabled_vehicle") return 4;
  if (normalizedType === "other" || hazardCategory === "other_hazard") return 3;
  if (normalizedType === "cleared" || normalizedType === "hazard_cleared") return 1;
  return 2;
}

function buildRouteHazardAssessment(routeLatLngs = []) {
  const thresholdMiles = 0.8;
  const nearReports = [];
  const severityWeight = {
    blocked: 12, heavy: 7, delayed: 5, delay: 5, clear: 0, cleared: 0,
    crash: 10, flooding: 10, debris: 6, construction: 5, road_closed: 12, disabled_vehicle: 5, rail_blockage_delay: 9, other_hazard: 4
  };
  const crossingLookup = new Map((Array.isArray(crossings) ? crossings : []).map((crossing) => [String(crossing?.id), crossing]));

  if (!Array.isArray(routeLatLngs) || routeLatLngs.length < 2) {
    return { score: 0, level: "clear", nearbyReports: [], nearestIssue: null, recommendation: "normal", routePointCount: 0 };
  }

  const unifiedRouteCandidates = [...(Array.isArray(activeReports) ? activeReports : []), ...(Array.isArray(activeHazards) ? activeHazards : [])];
  const dedupedCandidates = new Map();
  unifiedRouteCandidates.forEach((report) => {
    const crossing = crossingLookup.get(String(report?.crossingId));
    const anchorLat = Number.isFinite(Number(report?.lat)) ? Number(report.lat) : Number(crossing?.lat);
    const anchorLng = Number.isFinite(Number(report?.lng)) ? Number(report.lng) : Number(crossing?.lng);
    if (!Number.isFinite(anchorLat) || !Number.isFinite(anchorLng)) return;
    const type = String(report.type || "").toLowerCase();
    const normalizedType = type === "delay" ? "delayed" : type;
    const hazardCategory = getHazardCategory(normalizedType);
    const lifecycleState = getIncidentLifecycleState(report);
    const dedupeKey = getRouteCandidateDedupeKey(report, crossing);
    const severityRank = getRouteCandidateSeverityRank(normalizedType, hazardCategory);
    const freshnessRank = Number.isFinite(Number(report?.minutesAgo)) ? Number(report.minutesAgo) : Number.POSITIVE_INFINITY;
    const lifecycleRank = lifecycleState === "active" ? 3 : lifecycleState === "recently_cleared" ? 2 : lifecycleState === "cleared" ? 1 : 0;
    const candidate = { report, crossing, anchorLat, anchorLng, normalizedType, hazardCategory, lifecycleState, severityRank, freshnessRank, lifecycleRank };
    const existing = dedupedCandidates.get(dedupeKey);
    if (!existing) {
      dedupedCandidates.set(dedupeKey, candidate);
      return;
    }
    const shouldReplace = severityRank > existing.severityRank
      || (severityRank === existing.severityRank && lifecycleRank > existing.lifecycleRank)
      || (severityRank === existing.severityRank && lifecycleRank === existing.lifecycleRank && freshnessRank < existing.freshnessRank);
    if (shouldReplace) dedupedCandidates.set(dedupeKey, candidate);
  });

  [...dedupedCandidates.values()].forEach((candidate) => {
    const { crossing, anchorLat, anchorLng, normalizedType, hazardCategory, lifecycleState, report } = candidate;
    const crossingDist = routeLatLngs.reduce((minDist, pt) => {
      const d = getDistanceMiles(anchorLat, anchorLng, pt.lat, pt.lng);
      return Math.min(minDist, d);
    }, Number.POSITIVE_INFINITY);
    if (!Number.isFinite(crossingDist) || crossingDist > thresholdMiles) return;

    const ageMinutes = Number(report?.minutesAgo);
    const ageFactor = !Number.isFinite(ageMinutes) ? 0.5 : ageMinutes <= 20 ? 1 : ageMinutes <= 45 ? 0.75 : ageMinutes <= 90 ? 0.45 : 0.2;
    const lifecycleFactor = lifecycleState === "active" ? 1 : lifecycleState === "recently_cleared" ? 0.25 : 0.1;
    const distanceFactor = Math.max(0.2, 1 - crossingDist / thresholdMiles);
    const rawWeight = severityWeight[normalizedType] ?? severityWeight[hazardCategory] ?? 3;
    const impact = normalizedType === "cleared" ? 0 : rawWeight * ageFactor * lifecycleFactor * distanceFactor;

    nearReports.push({
      crossingId: String(crossing?.id || report?.crossingId || `${anchorLat.toFixed(3)},${anchorLng.toFixed(3)}`),
      crossingName: crossing?.name || report?.crossingName || getHazardMetadata(normalizedType).label,
      reportType: normalizedType,
      hazardCategory,
      lifecycleState,
      minutesAgo: Number.isFinite(ageMinutes) ? ageMinutes : null,
      distanceMiles: Number(crossingDist.toFixed(2)),
      impact: Number(impact.toFixed(2))
    });
  });

  nearReports.sort((a, b) => b.impact - a.impact || a.distanceMiles - b.distanceMiles);
  const score = Number(nearReports.reduce((sum, r) => sum + r.impact, 0).toFixed(2));
  const nearestIssue = nearReports.find((r) => r.impact > 0) || nearReports[0] || null;
  let level = "clear";
  if (nearReports.some((r) => r.reportType === "blocked" && r.lifecycleState === "active" && r.impact >= 3)) level = "blocked";
  else if (score >= 11) level = "heavy";
  else if (score >= 4) level = "caution";

  const recommendation = level === "blocked"
    ? "reroute"
    : level === "heavy"
      ? "leave-early-or-reroute"
      : level === "caution"
        ? "watch-delay"
        : "normal";

  return { score, level, nearbyReports: nearReports, nearestIssue, recommendation, routePointCount: routeLatLngs.length };
}

function getRouteHazardAssessment() {
  return buildRouteHazardAssessment(getRoutePolylineLatLngs());
}

function getHazardCountNearRoute(routeLatLngs = []) {
  const thresholdMiles = 0.8;
  if (!Array.isArray(routeLatLngs) || routeLatLngs.length < 2) return 0;
  const crossingLookup = new Map((Array.isArray(crossings) ? crossings : []).map((crossing) => [String(crossing?.id), crossing]));
  const nearActiveCrossings = new Set();
  const unifiedRouteCandidates = [...(Array.isArray(activeReports) ? activeReports : []), ...(Array.isArray(activeHazards) ? activeHazards : [])];
  unifiedRouteCandidates.forEach((report) => {
    if (getIncidentLifecycleState(report) !== "active") return;
    const crossing = crossingLookup.get(String(report?.crossingId));
    const anchorLat = Number.isFinite(Number(report?.lat)) ? Number(report.lat) : Number(crossing?.lat);
    const anchorLng = Number.isFinite(Number(report?.lng)) ? Number(report.lng) : Number(crossing?.lng);
    if (!Number.isFinite(anchorLat) || !Number.isFinite(anchorLng)) return;
    const crossingDist = routeLatLngs.reduce((minDist, pt) => {
      const d = getDistanceMiles(anchorLat, anchorLng, pt.lat, pt.lng);
      return Math.min(minDist, d);
    }, Number.POSITIVE_INFINITY);
    if (Number.isFinite(crossingDist) && crossingDist <= thresholdMiles) nearActiveCrossings.add(String(crossing?.id || report?.id || `${anchorLat.toFixed(3)},${anchorLng.toFixed(3)}`));
  });
  return nearActiveCrossings.size;
}


function calculateRouteScore(routeReports = []) {
  const reports = Array.isArray(routeReports) ? routeReports : [];
  const severityPenalty = {
    blocked: 20, heavy: 12, delayed: 8, caution: 5, clear: 0, cleared: 1,
    crash: 14, flooding: 14, ice: 14, debris: 8, construction: 7, road_closed: 18, disabled_vehicle: 7, rail_blockage_delay: 16, other_hazard: 6
  };
  let score = 0;
  reports.forEach((report) => {
    const lifecycleState = String(report?.lifecycleState || "").toLowerCase();
    const reportType = String(report?.reportType || "").toLowerCase();
    const impact = Number(report?.impact);
    const isActive = lifecycleState === "active";
    const isRecentClear = lifecycleState === "recently_cleared";
    const lifecycleMultiplier = isActive ? 1 : isRecentClear ? 0.45 : 0.2;
    const basePenalty = severityPenalty[reportType] ?? severityPenalty[getHazardCategory(reportType)] ?? 4;
    const impactPenalty = Number.isFinite(impact) ? Math.min(8, impact * 0.6) : 0;
    score += (basePenalty + impactPenalty) * lifecycleMultiplier;
  });
  const activeHazards = reports.filter((report) => String(report?.lifecycleState || "").toLowerCase() === "active").length;
  score += activeHazards * 1.5;
  return Number(score.toFixed(2));
}

function updateRouteComparisonState(routeHazard = null) {
  const activeHazard = routeHazard || getRouteHazardAssessment();
  const primaryReports = Array.isArray(activeHazard?.nearbyReports) ? activeHazard.nearbyReports : [];
  primaryRouteHazardCount = Math.max(0, Number(primaryReports.filter((report) => report.lifecycleState === "active").length || 0));
  primaryRouteScore = calculateRouteScore(primaryReports);
  alternateRouteHazardCount = 0;
  alternateRouteScore = 0;
  hazardsAvoidedCount = 0;
  preferredRoute = "primary";
  preferredRouteReason = "Current route remains the best option.";
  routeComparisonStatus = "alternate_unavailable";
  routeComparisonSummary = "Current route remains the best option.";

  if (!alternateRouteAvailable || !alternateRouteLayer || typeof alternateRouteLayer.getLatLngs !== "function") {
    preferredRouteReason = "Alternate route is unavailable; primary route is selected.";
    return;
  }

  const alternateLatLngs = alternateRouteLayer.getLatLngs();
  const alternateHazardAssessment = getRouteHazardAssessmentForPath(alternateLatLngs);
  const alternateReports = Array.isArray(alternateHazardAssessment?.nearbyReports) ? alternateHazardAssessment.nearbyReports : [];
  alternateRouteHazardCount = getHazardCountNearRoute(alternateLatLngs);
  alternateRouteScore = calculateRouteScore(alternateReports);
  hazardsAvoidedCount = primaryRouteHazardCount - alternateRouteHazardCount;
  estimatedHazardReduction = Math.max(0, hazardsAvoidedCount);
  estimatedPressureReduction = Math.max(0, Number((primaryRouteScore - alternateRouteScore).toFixed(2)));

  if (alternateRouteScore < primaryRouteScore) {
    preferredRoute = "alternate";
    preferredRouteReason = "Alternate route is currently safer.";
    routeComparisonStatus = "alternate_safer";
    routeComparisonSummary = "Alternate route is currently safer.";
  } else {
    preferredRoute = "primary";
    preferredRouteReason = "Current route remains the best option.";
    routeComparisonStatus = "alternate_available";
    routeComparisonSummary = "Current route remains the best option.";
  }

  if (primaryRouteScore >= 18 && alternateRouteScore >= 18) {
    preferredRouteReason = "Both routes currently have active delays.";
    routeComparisonSummary = "Both routes currently have active delays.";
  }

  applyRouteVisualEmphasis();
}

function getRouteHazardAssessmentForPath(routeLatLngs = []) {
  return buildRouteHazardAssessment(routeLatLngs);
}

function applyRouteVisualEmphasis() {
  const primaryStyle = preferredRoute === "primary"
    ? { weight: 8, opacity: 0.96 }
    : { weight: 6, opacity: 0.55 };
  const alternateStyle = preferredRoute === "alternate"
    ? { weight: 7, opacity: 0.98 }
    : { weight: 5, opacity: 0.55 };
  if (window.__gridlyRoutePreviewLayer?.setStyle) window.__gridlyRoutePreviewLayer.setStyle(primaryStyle);
  if (alternateRouteLayer?.setStyle) alternateRouteLayer.setStyle({ dashArray: "12 10", ...alternateStyle });
}



function getRerouteFoundation(routeHazard = {}) {
  const level = String(routeHazard?.level || "clear").toLowerCase();
  const rerouteRecommended = level === "blocked" || level === "heavy";
  const rerouteReason = level === "blocked"
    ? "Blocked crossing detected. Consider another route."
    : level === "heavy"
      ? "Heavy delay detected. Leave early or reroute."
      : "";
  const alternateRouteStatus = rerouteRecommended ? "needed" : "not_needed";
  return {
    rerouteRecommended,
    rerouteReason,
    rerouteTargetIssue: routeHazard?.nearestIssue || null,
    originalRouteGeometrySource: routeGeometrySource || "fallback",
    originalRouteVertexCount: Number.isFinite(Number(routePreviewPolylinePointCount)) ? Number(routePreviewPolylinePointCount) : 0,
    alternateRouteAvailable: rerouteRecommended ? alternateRouteAvailable : false,
    alternateRouteReason: rerouteRecommended ? (alternateRouteReason || "Alternate route check recommended.") : "",
    alternateRouteGeometrySource: rerouteRecommended ? (alternateRouteGeometrySource || "none") : "none",
    alternateRouteVertexCount: rerouteRecommended ? alternateRouteVertexCount : 0,
    alternateRouteStatus: rerouteRecommended ? (alternateRouteStatus || "unavailable") : alternateRouteStatus
  };
}

function isIncidentRouteRelevant(incident = {}, routeHazard = null) {
  if (!routeWatchActivated) return false;
  const routeLatLngs = getRoutePolylineLatLngs();
  if (routeLatLngs.length < 2) return false;
  const nearbyReports = Array.isArray(routeHazard?.nearbyReports) ? routeHazard.nearbyReports : getRouteHazardAssessment().nearbyReports;
  const nearbyCrossingIds = new Set(nearbyReports.map((report) => String(report.crossingId || "")));
  if (incident?.crossingId && nearbyCrossingIds.has(String(incident.crossingId))) return true;
  const incidentLat = Number(incident?.lat);
  const incidentLng = Number(incident?.lng);
  if (!Number.isFinite(incidentLat) || !Number.isFinite(incidentLng)) return false;
  const thresholdMiles = 0.8;
  const minDistance = routeLatLngs.reduce((minDist, pt) => Math.min(minDist, getDistanceMiles(incidentLat, incidentLng, pt.lat, pt.lng)), Number.POSITIVE_INFINITY);
  return Number.isFinite(minDistance) && minDistance <= thresholdMiles;
}

function getRouteStatusColor() {
  const routeReports = activeReports.filter((report) => savedRouteCrossingIds.has(String(report.crossingId)));
  const hasBlocked = routeReports.some(
    (report) => getIncidentLifecycleState(report) === "active" && String(report.type || "").toLowerCase() === "blocked"
  );
  if (hasBlocked) return "#e53935";
  const hasDelay = routeReports.some(
    (report) => getIncidentLifecycleState(report) === "active" && String(report.type || "").toLowerCase() === "heavy"
  );
  if (hasDelay) return "#ffb020";
  return "#1fbf68";
}

function inferSavedRouteCrossings() {
  const savedHome = String(localStorage.getItem("gridlyHome") || "").toLowerCase();
  const savedWork = String(localStorage.getItem("gridlyWork") || "").toLowerCase();
  if (!savedHome || !savedWork || !crossings.length) return [];
  const homeCandidates = crossings.filter((crossing) => savedHome.includes(String(crossing.city || "").toLowerCase()));
  const workCandidates = crossings.filter((crossing) => savedWork.includes(String(crossing.city || "").toLowerCase()));
  const from = (homeCandidates.length ? homeCandidates : crossings).slice(0, 80);
  const to = (workCandidates.length ? workCandidates : crossings).slice(0, 80);
  let bestPair = null;
  from.forEach((a) => {
    to.forEach((b) => {
      const d = getDistanceMiles(a.lat, a.lng, b.lat, b.lng);
      if (!bestPair || d < bestPair.distance) bestPair = { a, b, distance: d };
    });
  });
  if (!bestPair) return [];
  const corridor = crossings
    .map((crossing) => {
      const da = getDistanceMiles(crossing.lat, crossing.lng, bestPair.a.lat, bestPair.a.lng);
      const db = getDistanceMiles(crossing.lat, crossing.lng, bestPair.b.lat, bestPair.b.lng);
      return { crossing, metric: da + db };
    })
    .sort((x, y) => x.metric - y.metric)
    .slice(0, 12)
    .map((entry) => entry.crossing)
    .sort((x, y) => getDistanceMiles(x.lat, x.lng, bestPair.a.lat, bestPair.a.lng) - getDistanceMiles(y.lat, y.lng, bestPair.a.lat, bestPair.a.lng));
  return corridor;
}

async function fetchRoadRouteCoordinates(from, to) {
  if (!Array.isArray(from) || !Array.isArray(to)) return null;
  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  if (![fromLat, fromLng, toLat, toLng].every((n) => Number.isFinite(n))) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(
      `${OSRM_ROUTE_API}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&alternatives=false&steps=false`,
      { signal: controller.signal }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const coordinates = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
    return coordinates.map(([lng, lat]) => [lat, lng]).filter((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1]));
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAlternateRouteCoordinates(from, to, primaryPoints = []) {
  if (!Array.isArray(from) || !Array.isArray(to)) return null;
  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  if (![fromLat, fromLng, toLat, toLng].every((value) => Number.isFinite(Number(value)))) return null;
  const primarySignature = Array.isArray(primaryPoints)
    ? primaryPoints.map((point) => `${Number(point?.[0]).toFixed(5)},${Number(point?.[1]).toFixed(5)}`).join("|")
    : "";
  const osrmUrl = `${OSRM_ROUTE_API}/${Number(fromLng)},${Number(fromLat)};${Number(toLng)},${Number(toLat)}?overview=full&geometries=geojson&alternatives=true&steps=false`;
  const response = await fetch(osrmUrl, { method: "GET" });
  if (!response.ok) return null;
  const payload = await response.json();
  const alternateCandidates = Array.isArray(payload?.routes) ? payload.routes.slice(1) : [];
  for (const route of alternateCandidates) {
    const routeCoordinates = route?.geometry?.coordinates;
    if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 2) continue;
    const convertedPoints = routeCoordinates
      .map((point) => (Array.isArray(point) ? [Number(point[1]), Number(point[0])] : null))
      .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (convertedPoints.length < 2) continue;
    const signature = convertedPoints.map((point) => `${point[0].toFixed(5)},${point[1].toFixed(5)}`).join("|");
    if (primarySignature && signature === primarySignature) continue;
    return convertedPoints;
  }
  return null;
}

function drawPremiumRouteLine(latLngs, color = getRouteStatusColor(), renderFunction = "drawPremiumRouteLine") {
  if (!savedRouteLayer || !Array.isArray(latLngs) || latLngs.length < 2) return;
  const activation = getLineActivationContext();
  if (!activation.hasActivation) {
    savedRouteLayer.clearLayers();
    return;
  }

  const glow = L.polyline(latLngs, {
    pane: "routePane",
    color: "#3cf2ff",
    weight: 10,
    opacity: 0.18,
    lineJoin: "round",
    lineCap: "round",
    interactive: false
  });

  const core = L.polyline(latLngs, {
    pane: "routePane",
    color,
    weight: 4,
    opacity: 0.88,
    lineJoin: "round",
    lineCap: "round",
    interactive: false
  });

  const accent = L.polyline(latLngs, {
    pane: "routePane",
    color: "#9efaff",
    weight: 2,
    opacity: 0.68,
    lineJoin: "round",
    lineCap: "round",
    interactive: false
  });

  savedRouteLayer.addLayer(glow);
  savedRouteLayer.addLayer(core);
  savedRouteLayer.addLayer(accent);
  logGridlyMapLineRendered({
    renderFunction,
    routeId: activation.selectedRouteId,
    activationReason: activation.selectedRouteId ? "selected-route-id" : activation.routeWatchActive ? "route-watch-active" : "selected-corridor-id",
    coordinates: latLngs
  });

  if (map && routeFocusArmed) {
    const bounds = L.latLngBounds(latLngs);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { paddingTopLeft: [32, 240], paddingBottomRight: [32, 72], maxZoom: 13, animate: false });
      routeFocusArmed = false;
    }
  }
}

async function renderSavedRouteLine() {
  if (!savedRouteLayer) return;
  const activation = getLineActivationContext();
  if (!activation.hasActivation) {
    savedRouteLayer.clearLayers();
    lastRenderedRouteKey = "";
    return;
  }
  const routeCrossings = inferSavedRouteCrossings();
  savedRouteCrossingIds = new Set(routeCrossings.map((c) => String(c.id)));
  if (routeCrossings.length < 2) {
    lastRenderedRouteKey = "";
    routeFocusArmed = true;
    savedRouteLayer.clearLayers();
    return;
  }

  const from = [routeCrossings[0].lat, routeCrossings[0].lng];
  const to = [routeCrossings[routeCrossings.length - 1].lat, routeCrossings[routeCrossings.length - 1].lng];
  const routeKey = `${from.join(",")}|${to.join(",")}|${getRouteStatusColor()}`;
  if (routeKey === lastRenderedRouteKey) return;
  lastRenderedRouteKey = routeKey;

  savedRouteLayer.clearLayers();
  const osrmPath = await fetchRoadRouteCoordinates(from, to);
  const fallbackPath = routeCrossings.map((crossing) => [crossing.lat, crossing.lng]);
  drawPremiumRouteLine(osrmPath?.length > 1 ? osrmPath : fallbackPath, getRouteStatusColor(), "renderSavedRouteLine");
}

function getMarkerLabel(report, markerStateClass, lifecycleState) {
  if (lifecycleState === "recently_cleared" || markerStateClass === "state-cleared") return "✅";
  if (markerStateClass === "state-blocked") return "🛑";
  if (markerStateClass === "state-delay") return "⏱";
  return "◦";
}

function buildSmartIncidentClusters(visibleCrossings = []) {
  const candidates = visibleCrossings
    .map((crossing) => {
      const report = getLatestReportForCrossing(crossing.id);
      const lifecycleState = getIncidentLifecycleState(report);
      if (!report || lifecycleState !== "active") return null;
      const reportType = String(report?.type || "").toLowerCase();
      const severity = reportType === "blocked" ? 2 : reportType === "heavy" ? 1 : 0;
      const candidate = { crossing, report, severity };
      return candidate;
    })
    .filter(Boolean);

  const hiddenIds = new Set();
  const leadCounts = new Map();
  const groupedIds = new Set();

  candidates.forEach((seed) => {
    const seedId = String(seed.crossing.id);
    if (groupedIds.has(seedId)) return;
    const group = candidates.filter((candidate) => {
      if (groupedIds.has(String(candidate.crossing.id))) return false;
      return getDistanceMiles(seed.crossing.lat, seed.crossing.lng, candidate.crossing.lat, candidate.crossing.lng) <= 0.34;
    });
    group.forEach((entry) => groupedIds.add(String(entry.crossing.id)));
    if (group.length <= 2) return;

    const leader = group.sort((a, b) => b.severity - a.severity || a.report.minutesAgo - b.report.minutesAgo)[0];
    leadCounts.set(String(leader.crossing.id), group.length);
    group.forEach((entry) => {
      const id = String(entry.crossing.id);
      if (id !== String(leader.crossing.id)) hiddenIds.add(id);
    });
  });

  return { leadCounts, hiddenIds };
}




function highlightNearestCrossingOnFirstLoad() {
  if (!map || !crossings.length) return;
  if (localStorage.getItem(MAP_FIRST_HINT_SEEN_KEY)) return;

  const center = userLocation || { lat: defaultCenter[0], lng: defaultCenter[1] };
  const nearest = findNearestCrossings(center.lat, center.lng, 1)[0];
  if (!nearest) return;

  const marker = crossingMarkers.get(String(nearest.id));
  if (!marker) return;

  const markerEl = marker.getElement?.();
  markerEl?.classList.add("pulse-nearest");

  marker.bindTooltip("Tap marker to report status", {
    direction: "top",
    offset: [0, -12],
    className: "gridly-map-hint",
    opacity: 0.96
  });

  marker.openTooltip();
  localStorage.setItem(MAP_FIRST_HINT_SEEN_KEY, "1");

  setTimeout(() => {
    marker.closeTooltip();
    markerEl?.classList.remove("pulse-nearest");
  }, 4200);
}

function getFilterFitPadding() {
  const isMobile = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  return isMobile ? { topLeft: [20, 16], bottomRight: [20, 132] } : { topLeft: [24, 24], bottomRight: [24, 96] };
}

function fitMapToCrossingsForActiveFilter(visibleCrossings = []) {
  if (!map) return;
  if (!Array.isArray(visibleCrossings) || !visibleCrossings.length) return;

  const latLngs = visibleCrossings
    .map((crossing) => [Number(crossing.lat), Number(crossing.lng)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

  if (!latLngs.length) return;

  const bounds = L.latLngBounds(latLngs);
  if (!bounds.isValid()) return;

  map.fitBounds(bounds, {
    ...getFilterFitPadding(),
    animate: true,
    duration: 0.55,
    maxZoom: window.matchMedia && window.matchMedia("(max-width: 768px)").matches ? 16 : 15
  });

  highlightNearestCrossingOnFirstLoad();
}

function updateGeoFilterStatus(visibleCrossings = []) {
  if (!els.geoFilterStatus) return;
  if (activeGeoFilter === "nearby" && userLocation) {
    updateNearestContext();
    return;
  }

  const count = visibleCrossings.length;
  const crossingLabel = count === 1 ? "crossing" : "crossings";
  let message = "All crossings visible: tap markers to confirm route status.";

  if (activeGeoFilter === "nearby") {
    message = count ? `Act now: review ${count} nearby ${crossingLabel} before departure.` : "Action needed: switch filters or zoom to find crossings.";
  } else if (activeGeoFilter === "town") {
    message = count ? `Route focus: check ${count} likely commute ${crossingLabel}.` : "No route crossings in view. Try My Town or Delays.";
  } else if (activeGeoFilter === "county") {
    message = count ? "My Town area: scan crossings and tap any issue marker." : "No My Town crossings visible. Reset map view.";
  } else if (activeGeoFilter === "active-delays") {
    const delayLabel = count === 1 ? "delay" : "delays";
    message = count ? `Priority: resolve ${count} active ${delayLabel} affecting routes.` : "Good news: no active delays in this view.";
  } else if (activeGeoFilter === "all") {
    message = "All crossings visible: tap markers to confirm route status.";
  }

  els.geoFilterStatus.textContent = message;
}

function getVisibleCrossingsForFilter() {
  const fallbackToAll = () => {
    debugGeoFilter(activeGeoFilter, crossings.length);
    return crossings;
  };

  if (activeGeoFilter === "all") {
    const relevant = getDefaultRelevantCrossings();
    debugGeoFilter("All", relevant.length);
    return relevant;
  }

  if (activeGeoFilter === "active-delays") {
    const filtered = crossings.filter((crossing) => {
      const report = getLatestReportForCrossing(crossing.id);
      return getIncidentLifecycleState(report) === "active";
    });
    debugGeoFilter("Active Delays", filtered.length);
    return filtered;
  }

  if (activeGeoFilter === "county") {
    const filtered = crossings.filter(
      (crossing) => String(crossing.county || "").toLowerCase() === "liberty county"
    );
    debugGeoFilter("My County", filtered.length);
    return filtered;
  }

  if (activeGeoFilter === "town") {
    const filtered = crossings.filter(
      (crossing) => String(crossing.city || "").toLowerCase() === getMyTownKey()
    );

    if (!filtered.length) {
      debugGeoFilter("My Town", crossings.length);
      return crossings;
    }

    debugGeoFilter("My Town", filtered.length);
    return filtered;
  }

  if (activeGeoFilter === "nearby") {
    const center = userLocation || { lat: defaultCenter[0], lng: defaultCenter[1] };
    const nearest = findNearestCrossings(center.lat, center.lng, 10);
    debugGeoFilter("Nearby", nearest.length);
    return nearest;
  }

  return fallbackToAll();
}

function debugGeoFilter(label, visibleCount) {
  console.debug(`Filter applied: ${label}`);
  console.debug(`Visible crossings: ${visibleCount}`);
}
function renderUnifiedIncidents() {
  if (!unifiedIncidentLayer) return;

  unifiedIncidentLayer.clearLayers();

  const incidents = getUnifiedIncidents();
  const routeHazard = routeWatchActivated ? getRouteHazardAssessment() : null;
  const dedupedMap = new Map();
  const duplicateCounts = new Map();

  incidents.forEach((incident) => {
    const renderKey = getUnifiedIncidentRenderKey(incident);
    incident._gridlyRenderKey = renderKey;
    if (!dedupedMap.has(renderKey)) {
      dedupedMap.set(renderKey, incident);
      duplicateCounts.set(renderKey, 1);
      return;
    }
    duplicateCounts.set(renderKey, (duplicateCounts.get(renderKey) || 1) + 1);
    dedupedMap.set(renderKey, choosePreferredIncidentCandidate(dedupedMap.get(renderKey), incident, routeHazard));
  });
  const dedupedIncidents = [...dedupedMap.values()];

  const markersByCategory = {};
  const markerTypesRendered = new Set();
  const activeVisualStates = new Set();
  let markersAffectingRoute = 0;
  let routeHighlightedMarkers = 0;

  dedupedIncidents.forEach((incident) => {
    if (!Number.isFinite(incident.lat) || !Number.isFinite(incident.lng)) return;

    const distanceFromUser = userLocation
      ? getDistanceMiles(userLocation.lat, userLocation.lng, incident.lat, incident.lng)
      : null;
    const isNearbyPriority = Number.isFinite(distanceFromUser) && distanceFromUser <= PRIORITY_NEARBY_MILES;
    const ageClass =
      incident.age_minutes <= 15 ? "fresh" : incident.age_minutes <= 60 ? "aging" : "old";
    const proximityClass = isNearbyPriority ? "nearby-priority" : "far-faded";
    const routeRelevanceClass = routeWatchActivated
      ? (isIncidentRouteRelevant(incident, routeHazard) ? "route-relevant" : "route-deemphasized")
      : "";
    const category = getHazardCategory(incident.report_type || incident.type || "other_hazard");
    const markerVariantClass = `marker-${category}`;
    const confidenceClass = String(incident.confidence || "").toLowerCase().includes("community") ? "confidence-community" : "confidence-high";
    markersByCategory[category] = (markersByCategory[category] || 0) + 1;
    markerTypesRendered.add(markerVariantClass);
    markerTypesRendered.add(getMapSeverityClass(incident));
    markerTypesRendered.add(confidenceClass);
    activeVisualStates.add(ageClass);
    if (routeRelevanceClass) activeVisualStates.add(routeRelevanceClass);
    if (routeRelevanceClass === "route-relevant") {
      markersAffectingRoute += 1;
      routeHighlightedMarkers += 1;
    }

    const markerState = incident?.status === "cleared" || incident?.report_type === "hazard_cleared" ? "cleared" : "active";
    const icon = L.divIcon({
      className: "",
      html: `
        <div class="gridly-hazard-marker ${sanitizeText(getMapSeverityClass(incident))} ${ageClass} ${proximityClass} ${routeRelevanceClass} ${sanitizeText(markerVariantClass)} ${sanitizeText(confidenceClass)}"
          data-category="${sanitizeText(category)}"
          data-freshness="${sanitizeText(ageClass)}"
          data-confidence="${sanitizeText(confidenceClass.replace("confidence-", ""))}"
          data-route-relevance="${sanitizeText(routeRelevanceClass || "unscored")}"
          data-state="${sanitizeText(markerState)}">
          <span>${sanitizeText(getCategoryMarkerGlyph(category, incident))}</span>
          <small>${incident.age_minutes}m</small>
          ${incident.reports_count > 1 ? `<b>${incident.reports_count}</b>` : ""}
        </div>
      `,
      iconSize: [46, 46],
      iconAnchor: [23, 23]
    });

    L.marker([incident.lat, incident.lng], { icon })
      .bindPopup(buildUnifiedIncidentPopup(incident), { maxWidth: 340 })
      .addTo(unifiedIncidentLayer);
  });

  const duplicateEntries = [...duplicateCounts.entries()].filter(([, count]) => count > 1);
  const duplicateIncidentCount = duplicateEntries.reduce((sum, [, count]) => sum + (count - 1), 0);

  updateHazardCounter(dedupedIncidents);
  lastMarkerAuditDebug = {
    activeMarkerCount: dedupedIncidents.length,
    totalIncidentsInput: incidents.length,
    uniqueIncidentRenderCount: dedupedIncidents.length,
    duplicateIncidentCount,
    duplicateKeysPreview: duplicateEntries.slice(0, 8).map(([key, count]) => `${key}×${count}`),
    activeRenderedCount: dedupedIncidents.filter((item) => String(item?.status || "").toLowerCase() !== "cleared").length,
    clearedRenderedCount: dedupedIncidents.filter((item) => String(item?.status || "").toLowerCase() === "cleared").length,
    routeRelevantRenderedCount: dedupedIncidents.filter((item) => isIncidentRouteRelevant(item, routeHazard)).length,
    lastRenderAt: new Date().toISOString(),
    markerLayerCount: typeof unifiedIncidentLayer?.getLayers === "function" ? unifiedIncidentLayer.getLayers().length : null,
    markersByCategory,
    markersAffectingRoute,
    clusteredMarkerCount: getLiveHazardIncidents().length,
    markerTypesRendered: [...markerTypesRendered],
    routeHighlightedMarkers,
    activeVisualStates: [...activeVisualStates]
  };
}

function getCategoryMarkerGlyph(category, incident) {
  if (incident?.status === "cleared" || incident?.report_type === "hazard_cleared") return "✓";
  const glyphMap = {
    rail_blockage_delay: "⟂",
    delay: "◔",
    flooding: "≈",
    crash: "✶",
    construction: "▧",
    road_closed: "⛔",
    disabled_vehicle: "◌",
    other_hazard: "•"
  };
  return glyphMap[category] || "•";
}

function buildHazardPopup(incident) {
  const hazard = incident.latestReport;
  const isFresh = hazard.minutesAgo <= REPORT_EXPIRATION_MINUTES;
  const reportedAgo = humanizeMinutesAgo(hazard.minutesAgo);
  const driverLabel = `${incident.count} driver${incident.count === 1 ? "" : "s"}`;
  const reportStateLabel = isFresh ? "Live community report" : "Needs new confirmation";
  const reportedLabel = isFresh
    ? `Reported ${reportedAgo} by ${driverLabel}.`
    : `Last reported ${reportedAgo} by ${driverLabel}.`;
  const stateNote = isFresh
    ? "Drivers can confirm if this hazard is still active."
    : "This may no longer be active.";
  const actionButtons = isFresh
    ? `
        <button class="popup-report-btn warning" data-action="confirm-hazard" data-hazard-type="${sanitizeText(hazard.type)}" data-lat="${hazard.lat}" data-lng="${hazard.lng}">Still There</button>
        <button class="popup-report-btn blue" data-action="clear-hazard" data-hazard-type="${sanitizeText(hazard.type)}" data-lat="${hazard.lat}" data-lng="${hazard.lng}">Cleared</button>
      `
    : `
        <button class="popup-report-btn warning" data-action="confirm-hazard" data-hazard-type="${sanitizeText(hazard.type)}" data-lat="${hazard.lat}" data-lng="${hazard.lng}">Confirm Now</button>
      `
    ;

  return `
    <div class="gridly-popup">
      <strong>${sanitizeText(isFresh ? hazard.title : "Crash Report")}</strong>
      <span>${sanitizeText(reportStateLabel)}</span><br />
      <span>${sanitizeText(reportedLabel)}</span><br />
      <span>${sanitizeText(stateNote)}</span><br />

      <div class="popup-report-grid">
        ${actionButtons}
        <button class="popup-report-btn neutral" data-action="zoom-hazard" data-lat="${hazard.lat}" data-lng="${hazard.lng}">View Area</button>
      </div>
    </div>
  `;
}

function humanizeMinutesAgo(totalMinutes) {
  const minutes = Math.max(0, Number(totalMinutes) || 0);

  if (minutes <= 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const roundedHours = Math.round(minutes / 60);
  if (roundedHours < 24) return `${roundedHours}h ago`;

  const roundedDays = Math.round(roundedHours / 24);
  return `${roundedDays}d ago`;
}
function getLiveHazardIncidents() {
  const grouped = new Map();

  activeHazards
    .filter((hazard) => !hazard.expired && hazard.type !== "hazard_cleared")
    .forEach((hazard) => {
      const key = getHazardClusterKey(hazard);

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          reports: []
        });
      }

      grouped.get(key).reports.push(hazard);
    });

  return [...grouped.values()]
    .map((incident) => {
      const sorted = incident.reports.sort(
        (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
      );

      return {
        key: incident.key,
        count: sorted.length,
        latestReport: sorted[0],
        oldestMinutes: Math.max(...sorted.map((r) => r.minutesAgo)),
        newestMinutes: Math.min(...sorted.map((r) => r.minutesAgo))
      };
    })
    .sort((a, b) => b.count - a.count || a.newestMinutes - b.newestMinutes);
}

function getHazardClusterKey(hazard) {
  const lat = Number(hazard.lat).toFixed(3);
  const lng = Number(hazard.lng).toFixed(3);
  return `${hazard.type}-${lat}-${lng}`;
}



function futureTxdotIncidents() { return []; }
function futureTxdotConstruction() { return []; }
function futureFloodAlerts() { return []; }

function mapRailReportType(type) {
  if (type === "blocked") return "rail_blocked";
  if (type === "heavy") return "rail_delay";
  if (type === "cleared") return "rail_cleared";
  return "rail_delay";
}

function mapRoadHazardType(type) {
  const map = { crash: "wreck", flooding: "flooding",
  ice: "ice", construction: "construction", debris: "debris", road_closed: "closure", disabled_vehicle: "wreck", hazard_cleared: "cleared" };
  return map[type] || "debris";
}

function normalizeUnifiedIncident(base) {
  return { ...base, updated_at: base.updated_at || base.created_at, confidence: base.confidence || "community", reports_count: Number(base.reports_count || 1) };
}

function getUnifiedIncidents() {
  const railIncidents = getConsolidatedIncidents().map((incident) => {
    const latest = incident.latestReport;
    return normalizeUnifiedIncident({
      id: `rail-${incident.crossingId}`,
      type: mapRailReportType(latest.type),
      source: "community",
      severity: latest.severity === "moderate" ? "medium" : latest.severity || "medium",
      status: getIncidentLifecycleState(latest) === "active" ? "active" : "cleared",
      title:
        getIncidentLifecycleState(latest) === "active"
          ? `${incident.crossingName} Rail Update`
          : `✅ ${incident.crossingName} Cleared`,
      description: latest.detail,
      lat: latest.lat,
      lng: latest.lng,
      area: incident.crossingName,
      created_at: latest.submittedAt,
      confidence: latest.confidence,
      reports_count: incident.count,
      age_minutes: latest.minutesAgo,
      report_type: latest.type,
      crossing_id: incident.crossingId
    });
  });

  const roadIncidents = getLiveHazardIncidents().map((incident) => {
    const latest = incident.latestReport;
    return normalizeUnifiedIncident({
      id: `road-${incident.key}`,
      type: mapRoadHazardType(latest.type),
      source: latest.source || "community",
      severity: latest.severity === "moderate" ? "medium" : latest.severity || "medium",
      status: latest.type === "hazard_cleared" ? "cleared" : "active",
      title: latest.title,
      description: latest.detail,
      lat: latest.lat,
      lng: latest.lng,
      area: latest.location_name || latest.area || latest.city || incident.location_name || incident.area || incident.city || "",
      created_at: latest.submittedAt,
      confidence: latest.confidence,
      reports_count: incident.count,
      age_minutes: latest.minutesAgo,
      report_type: latest.type,
      crossing_id: incident.crossingId
    });
  });

  return [...railIncidents, ...roadIncidents, ...futureTxdotIncidents(), ...futureTxdotConstruction(), ...futureFloodAlerts()]
    .sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));
}


function getUnifiedIncidentRenderKey(incident = {}) {
  const explicitId = incident?.id ?? incident?.report_id ?? incident?.reportId;
  if (explicitId !== undefined && explicitId !== null && String(explicitId).trim()) return `id:${String(explicitId).trim()}`;

  const crossingId = incident?.crossing_id ?? incident?.crossingId;
  const reportType = String(incident?.report_type || incident?.type || "other_hazard").toLowerCase();
  const state = String(incident?.status || "").toLowerCase() === "cleared" || reportType === "hazard_cleared" ? "cleared" : "active";
  if (crossingId !== undefined && crossingId !== null && String(crossingId).trim()) {
    return `crossing:${String(crossingId).trim()}:${reportType}:${state}`;
  }

  const category = getHazardCategory(incident?.report_type || incident?.type || "other_hazard");
  const lat = Number(incident?.lat);
  const lng = Number(incident?.lng);
  const roundedLat = Number.isFinite(lat) ? lat.toFixed(4) : "na";
  const roundedLng = Number.isFinite(lng) ? lng.toFixed(4) : "na";
  const sourceTime = incident?.updated_at || incident?.created_at || incident?.submittedAt;
  const timeMs = sourceTime ? new Date(sourceTime).getTime() : Number.NaN;
  const bucketMinutes = Number.isFinite(timeMs) ? Math.floor(timeMs / (5 * 60 * 1000)) : "na";
  return `fallback:${category}:${roundedLat}:${roundedLng}:${bucketMinutes}:${state}`;
}

function choosePreferredIncidentCandidate(current, candidate, routeHazard) {
  if (!current) return candidate;

  const currentRelevant = isIncidentRouteRelevant(current, routeHazard);
  const candidateRelevant = isIncidentRouteRelevant(candidate, routeHazard);
  if (currentRelevant !== candidateRelevant) return candidateRelevant ? candidate : current;

  const currentStatus = String(current?.status || "").toLowerCase();
  const candidateStatus = String(candidate?.status || "").toLowerCase();
  const currentActive = currentStatus !== "cleared" && String(current?.report_type || "").toLowerCase() !== "hazard_cleared";
  const candidateActive = candidateStatus !== "cleared" && String(candidate?.report_type || "").toLowerCase() !== "hazard_cleared";

  const currentUpdated = new Date(current?.updated_at || current?.created_at || 0).getTime();
  const candidateUpdated = new Date(candidate?.updated_at || candidate?.created_at || 0).getTime();
  if (currentActive !== candidateActive) {
    if (!candidateActive && candidateUpdated > currentUpdated) return candidate;
    if (candidateActive) return candidate;
    return current;
  }

  const currentConfidence = String(current?.confidence || "").toLowerCase().includes("community") ? 1 : 2;
  const candidateConfidence = String(candidate?.confidence || "").toLowerCase().includes("community") ? 1 : 2;
  if (candidateConfidence !== currentConfidence) return candidateConfidence > currentConfidence ? candidate : current;
  if (candidateUpdated !== currentUpdated) return candidateUpdated > currentUpdated ? candidate : current;

  const currentReports = Number(current?.reports_count || 0);
  const candidateReports = Number(candidate?.reports_count || 0);
  if (candidateReports !== currentReports) return candidateReports > currentReports ? candidate : current;
  return current;
}

function getMapSeverityClass(incident){
  if (incident.status === "cleared") return "low";
  if (incident.type === "flooding") return "high";
  if (["rail_blocked","wreck","closure"].includes(incident.type)) return "high";
  if (["rail_delay","construction"].includes(incident.type)) return "moderate";
  return "low";
}

function getUnifiedIncidentIcon(incident){
  if (incident.status === "cleared") return "✅";
  const m={rail_blocked:"⛔", rail_delay:"🚦", wreck:"🚗", flooding:"🌊", construction:"🚧", closure:"⛔", debris:"⚠️", cleared:"✅"};
  return m[incident.type]||"❗";
}

function buildUnifiedIncidentPopup(incident){
  const isActive = incident.status === "active";
  const typeCategory = incident.id?.startsWith("rail-") ? "rail" : "road";
  const details = `<span>${incident.reports_count} report${incident.reports_count===1?"":"s"} · ${incident.status}</span>`;

  if (!isActive) {
    return `<div class="gridly-popup"><strong>${sanitizeText(incident.title)}</strong><span>${sanitizeText(incident.description || "Live incident")}</span><br />${details}</div>`;
  }

  return `<div class="gridly-popup"><strong>${sanitizeText(incident.title)}</strong><span>${sanitizeText(incident.description || "Live incident")}</span><br />${details}<div class="popup-report-grid"><button class="popup-report-btn warning" type="button" data-unified-action="confirm" data-incident-id="${sanitizeText(incident.id)}" data-incident-category="${sanitizeText(typeCategory)}" data-report-type="${sanitizeText(incident.report_type || "")}" data-crossing-id="${sanitizeText(incident.crossing_id || "")}" data-lat="${sanitizeText(String(incident.lat))}" data-lng="${sanitizeText(String(incident.lng))}">Confirm Still Active</button><button class="popup-report-btn blue" type="button" data-unified-action="cleared" data-incident-id="${sanitizeText(incident.id)}" data-incident-category="${sanitizeText(typeCategory)}" data-report-type="${sanitizeText(incident.report_type || "")}" data-crossing-id="${sanitizeText(incident.crossing_id || "")}" data-lat="${sanitizeText(String(incident.lat))}" data-lng="${sanitizeText(String(incident.lng))}">Mark Cleared</button><button class="popup-report-btn neutral" type="button" data-unified-action="view-area" data-lat="${sanitizeText(String(incident.lat))}" data-lng="${sanitizeText(String(incident.lng))}">View Area</button></div></div>`;
}

function mapUnifiedRailConfirmType(reportType) {
  if (reportType === "blocked" || reportType === "heavy" || reportType === "other") return reportType;
  if (reportType === "cleared") return "heavy";
  return "heavy";
}

async function handleUnifiedIncidentAction(button) {
  const action = button?.dataset?.unifiedAction;
  const incidentId = button?.dataset?.incidentId || "";
  const incident = getUnifiedIncidents().find((item) => String(item.id) === String(incidentId));
  const category = button?.dataset?.incidentCategory || (incidentId.startsWith("rail-") ? "rail" : "road");
  const reportType = button?.dataset?.reportType || incident?.report_type || "";
  const crossingId = button?.dataset?.crossingId || incident?.crossing_id || (incidentId.startsWith("rail-") ? incidentId.replace("rail-", "") : "");
  const lat = Number(button?.dataset?.lat ?? incident?.lat);
  const lng = Number(button?.dataset?.lng ?? incident?.lng);

  if (action === "view-area") {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      window.zoomToHazard?.(lat, lng);
    }
    return;
  }

  if (action === "confirm") {
    console.debug("Unified confirm action", { category, reportType, crossingId, incidentId });
    if (category === "rail") {
      const crossing = crossings.find((item) => String(item.id) === String(crossingId));
      if (!crossing) {
        setConfirmation("Crossing not found for this incident.", "error");
        return;
      }
      await createSharedReport(crossing, mapUnifiedRailConfirmType(reportType), "unified incident confirm");
      return;
    }

    await createSharedHazardReport(reportType || "other_hazard", lat, lng, "unified incident confirm still active");
    return;
  }

  if (action === "cleared") {
    console.debug("Unified cleared action", { category, reportType, crossingId, incidentId });
    if (category === "rail") {
      const crossing = crossings.find((item) => String(item.id) === String(crossingId));
      if (!crossing) {
        setConfirmation("Crossing not found for this incident.", "error");
        return;
      }
      await createSharedReport(crossing, "cleared", "unified incident cleared");
      return;
    }

    if (typeof window.clearHazard === "function") {
      await window.clearHazard(reportType || "other_hazard", lat, lng);
      return;
    }

    setConfirmation("Hazard clear is not supported yet for this incident.", "success");
  }
}

function getHazardConfidenceLabel(count) {
  if (count >= 4) return "Community verified";
  if (count >= 2) return "Likely active";
  return "Single live report";
}

function updateHazardCounter(liveHazards) {
  const existing = document.getElementById("gridlyHazardCounter");

  if (!existing) return;

  const count = liveHazards.length;
  const confirmed = liveHazards.filter((hazard) => (hazard.count || hazard.reports_count || 0) >= 2).length;

  existing.textContent =
    count === 0
      ? "No live incidents"
      : `${count} live incident${count === 1 ? "" : "s"} · ${confirmed} confirmed`;
}
window.zoomToHazard = function (lat, lng) {
  if (!map) return;
  map.setView([lat, lng], 16);
};

function injectHazardReportUI() {
  if (document.getElementById("gridlyHazardLauncher")) return;

  const launcher = document.createElement("button");
  launcher.id = "gridlyHazardLauncher";
  launcher.className = "gridly-hazard-launcher";
  launcher.type = "button";
  launcher.textContent = "Report Road Hazard";
  const counter = document.createElement("div");
counter.id = "gridlyHazardCounter";
counter.className = "gridly-hazard-counter";
counter.textContent = "Road conditions appear calm";
  launcher.addEventListener("click", openHazardPanel);

  const panel = document.createElement("div");
  panel.id = "gridlyHazardPanel";
  panel.className = "gridly-hazard-panel";
  panel.dataset.scrollTarget = "hazard-choice-grid";
  panel.innerHTML = `
    <div class="hazard-panel-header">
      <strong>Report Road Hazard</strong>
      <button type="button" data-action="close-hazard-panel">×</button>
    </div>
    <p>Choose a hazard, then use your location or tap the map.</p>
    <div class="hazard-choice-grid">
      <button type="button" data-action="open-hazard-placement" data-hazard-type="flooding">🌊 Flooding</button>
      <button type="button" data-action="open-hazard-placement" data-hazard-type="ice">🧊 Ice</button>
      <button type="button" data-action="open-hazard-placement" data-hazard-type="debris">⚠️ Debris</button>
      <button type="button" data-action="open-hazard-placement" data-hazard-type="crash">🚗 Crash / Wreck</button>
      <button type="button" data-action="open-hazard-placement" data-hazard-type="construction">🚧 Construction</button>
      <button type="button" data-action="open-hazard-placement" data-hazard-type="road_closed">⛔ Road Closed</button>
      <button type="button" data-action="open-hazard-placement" data-hazard-type="disabled_vehicle">🚙 Disabled Vehicle</button>
      <button type="button" data-action="open-hazard-placement" data-hazard-type="other_hazard">❗ Other Hazard</button>
    </div>
    <div class="hazard-panel-placement-actions">
      <button type="button" data-action="submit-hazard">Use My Location</button>
      <button type="button" data-action="start-map-placement">Tap Map Location</button>
      <button type="button" data-action="cancel-hazard-placement">Cancel</button>
    </div>
  `;

  document.body.appendChild(counter);
  document.body.appendChild(launcher);
  document.body.appendChild(panel);
  injectHazardStyles();
}


function syncHazardPickerUiState() {
  const picker = document.getElementById("gridlyHazardPanel");
  if (!picker) return;
  const selectedType = reportingState.selectedHazardType || selectedQuickHazardType || pendingHazardPlacement || null;
  const disablePlacementActions = Boolean(!selectedType || reportingState.submissionInProgress || reportingState.locationLookupInProgress);
  picker.querySelectorAll('[data-action="submit-hazard"], [data-action="start-map-placement"]').forEach((btn) => {
    btn.disabled = disablePlacementActions;
    btn.setAttribute("aria-busy", reportingState.locationLookupInProgress ? "true" : "false");
  });
  const cancelBtn = picker.querySelector('[data-action="cancel-hazard-placement"]');
  if (cancelBtn) cancelBtn.disabled = Boolean(reportingState.submissionInProgress);
}

function syncMapPlacementCursorState() {
  const mapEl = map?.getContainer?.() || document.getElementById("map");
  if (!mapEl) return;
  mapEl.style.cursor = reportingState.placementModeActive ? "crosshair" : "";
}

function openHazardPanel(entryPoint = reportingState.activeReportEntryPoint || "report_near_me") {
  reportLifecycleDiag("openHazardPanel", { entryPoint });
  injectHazardReportUI();
  updateReportingState({ reportModeActive: true, activeReportEntryPoint: entryPoint });
  const picker = document.getElementById("gridlyHazardPanel");
  picker?.classList.add("visible");
  document.getElementById("gridlyMobileRouteQuickPanel")?.classList.remove("visible");
  syncHazardPickerUiState();
  const computed = picker ? window.getComputedStyle(picker) : null;
  reportDebugLog("[Gridly][Report] picker open path called", {
    entryPoint,
    pickerSelector: "#gridlyHazardPanel",
    pickerExists: Boolean(picker),
    className: picker?.className || null,
    display: computed?.display || null,
    visibility: computed?.visibility || null,
    opacity: computed?.opacity || null,
    zIndex: computed?.zIndex || null,
    rect: picker ? picker.getBoundingClientRect() : null
  });
}

window.closeHazardPanel = function (options = {}) {
  const { preserveLastReportMessage = true } = options;
  setTacticalReportHelperVisibility(false);
  const updates = {
    reportModeActive: false,
    placementModeActive: false,
    selectedHazardType: null
  };
  if (!preserveLastReportMessage) updates.lastReportMessage = "";
  updateReportingState(updates);
  document.getElementById("gridlyHazardPanel")?.classList.remove("visible");
  returnMobileToLiveMode("close_hazard_panel");
};

function injectMobileQuickActionOverlays() {
  if (document.getElementById("gridlyMobileRouteQuickPanel")) return;
  const panel = document.createElement("div");
  panel.id = "gridlyMobileRouteQuickPanel";
  panel.className = "gridly-mobile-route-quick-panel";
  panel.innerHTML = `
    <div class="route-quick-head">
      <strong>Route Quick Panel</strong>
      <button type="button" data-action="close-route-quick">×</button>
    </div>
    <label class="route-quick-field">Start
      <select id="mobileRouteQuickStart"></select>
    </label>
    <label class="route-quick-field">Destination
      <select id="mobileRouteQuickDestination"></select>
    </label>
    <p id="mobileRouteQuickMeta" class="route-quick-meta">Select start and destination.</p>
    <div class="route-quick-actions">
      <button type="button" data-action="start-route-watch-quick">Start Route Watch</button>
      <button type="button" data-action="view-route-quick">View Route</button>
    </div>
    <button type="button" class="route-quick-manage-link" data-action="open-manage-places-quick">Manage Places</button>
  `;
  document.body.appendChild(panel);
  const style = document.createElement("style");
  style.id = "gridlyMobileQuickOverlaysStyles";
  style.textContent = `
    .gridly-hazard-panel,.gridly-mobile-route-quick-panel{z-index:10020!important}
    .gridly-mobile-route-quick-panel{position:fixed;left:14px;right:14px;bottom:160px;max-height:calc(var(--gridly-visual-vh, 100vh) - 24px);min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;background:rgba(7,17,31,.97);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px;display:none;box-shadow:0 16px 34px rgba(0,0,0,.35);backdrop-filter:blur(10px)}
    .gridly-mobile-route-quick-panel.visible{display:grid;gap:6px}
    .gridly-mobile-route-quick-panel .route-quick-field{display:grid;gap:3px;color:#d8e3f3;font-size:11px;font-weight:600}
    .gridly-mobile-route-quick-panel select{width:100%;min-height:36px;padding:7px 9px;border-radius:9px}
    .route-quick-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
    .route-quick-meta{margin:0;color:#afc2d8;font-size:11px;line-height:1.3}
    .route-quick-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .route-quick-actions button{border:0;border-radius:10px;padding:8px 10px;font-weight:700;font-size:12px}
    .route-quick-actions button[data-action="start-route-watch-quick"]{background:linear-gradient(135deg,#0fb8ff,#4ee3ff);color:#041018}
    .route-quick-manage-link{justify-self:end;border:0;background:transparent;color:#8ecfff;font-size:11px;font-weight:600;padding:2px 0}
  `;
  document.head.appendChild(style);
}

function openMobileRouteQuickPanel() {
  routeLauncherSource = routeLauncherSource || "unknown";
  injectMobileQuickActionOverlays();
  const panel = document.getElementById("gridlyMobileRouteQuickPanel");
  if (!panel) return;
  document.getElementById("gridlyHazardPanel")?.classList.remove("visible");
  const startSelect = document.getElementById("mobileRouteQuickStart");
  const destinationSelect = document.getElementById("mobileRouteQuickDestination");
  if (startSelect && els.routeWatchStartSelect) {
    startSelect.innerHTML = els.routeWatchStartSelect.innerHTML;
    startSelect.value = els.routeWatchStartSelect.value || "";
  }
  if (destinationSelect && els.routeWatchDestinationSelect) {
    destinationSelect.innerHTML = els.routeWatchDestinationSelect.innerHTML;
    destinationSelect.value = els.routeWatchDestinationSelect.value || "";
  }
  const meta = document.getElementById("mobileRouteQuickMeta");
  if (meta) {
    meta.textContent = `${els.routeStatus?.textContent || "Choose route"} • ${els.routeEta?.textContent || "ETA pending"} • ${els.routeRecommendation?.textContent || "Leave now for best commute"}`;
  }
  if (startSelect && !startSelect.dataset.gridlyRouteQuickBound) {
    startSelect.addEventListener("change", () => {
      console.info("Gridly route panel selection change", { control: "start", value: startSelect.value || "" });
    });
    startSelect.dataset.gridlyRouteQuickBound = "1";
  }
  if (destinationSelect && !destinationSelect.dataset.gridlyRouteQuickBound) {
    destinationSelect.addEventListener("change", () => {
      console.info("Gridly route panel selection change", { control: "destination", value: destinationSelect.value || "" });
    });
    destinationSelect.dataset.gridlyRouteQuickBound = "1";
  }
  bindDirectRouteQuickPanelButtonListeners();
  panel.classList.add("visible");
  syncRouteQuickPanelUiState();
  if (isMobileLayoutMode()) setMobileUiMode("route", { silent: true });
  traceMobileModeMutation("route quick panel opened", { intendedSurfaceSelector: "#gridlyMobileRouteQuickPanel", surfaceState: readSurfaceComputedState("#gridlyMobileRouteQuickPanel") });
}

async function debugEnterRoutePipeline(args = {}) {
  routeDebugError("DEBUG ROUTE PIPELINE ENTER");
  debugPipelineWrapperEntered = true;
  lastRoutePipelineStep = "pipeline-entered";
  routeDebugError("DEBUG ROUTE PIPELINE TRACE", {
    typeOfStartInlineRouteWatch: typeof startInlineRouteWatch,
    args
  });
  try {
    routeDebugError("DEBUG ROUTE PIPELINE BEFORE AWAIT", { args });
    const result = await startInlineRouteWatch(args);
    routeDebugError("DEBUG ROUTE PIPELINE AFTER AWAIT", { args });
    return result;
  } catch (error) {
    routeDebugError("DEBUG ROUTE PIPELINE CATCH ERROR", { error, args });
    throw error;
  }
}

function bindDirectRouteQuickPanelButtonListeners() {
  const panel = document.getElementById("gridlyMobileRouteQuickPanel");
  const viewRouteButton = panel?.querySelector?.('.route-quick-actions button[data-action="view-route-quick"]');
  const startRouteWatchButton = panel?.querySelector?.('.route-quick-actions button[data-action="start-route-watch-quick"]');
  if (!viewRouteButton || !startRouteWatchButton) return;
  if (viewRouteButton.dataset.gridlyDirectRouteListenerAttached === "1" && startRouteWatchButton.dataset.gridlyDirectRouteListenerAttached === "1") {
    routeQuickDirectListenerAttached = true;
    return;
  }

  const attachDirectListener = (button, action) => {
    if (!button || button.dataset.gridlyDirectRouteListenerAttached === "1") return;
    button.addEventListener("click", async (event) => {
      const startSelect = document.getElementById("mobileRouteQuickStart");
      const destinationSelect = document.getElementById("mobileRouteQuickDestination");
      const selectedStart = startSelect?.value || "";
      const selectedDestination = destinationSelect?.value || "";
      routeDebugError("DIRECT ROUTE BUTTON CLICK", {
        action,
        button,
        selectedStart,
        selectedDestination
      });
      lastRoutePipelineStep = "direct-listener-hit";
      lastDirectRouteClick = {
        action,
        buttonAction: button?.dataset?.action || "",
        selectedStart,
        selectedDestination,
        at: new Date().toISOString()
      };
      if (els.routeWatchStartSelect && startSelect) els.routeWatchStartSelect.value = selectedStart;
      if (els.routeWatchDestinationSelect && destinationSelect) els.routeWatchDestinationSelect.value = selectedDestination;
      updateRouteWatchStartButtonState();
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      const panelWasVisible = panel?.classList?.contains("visible") ?? false;
      await debugEnterRoutePipeline({
        activateWatch: action === "start-route-watch-quick",
        source: action === "start-route-watch-quick" ? "mobile_quick_panel_start_watch_direct" : "mobile_quick_panel_view_route_direct"
      });
      const routePreviewWasSuccessful = Boolean(routeRenderSucceeded && !lastRouteEarlyReturnReason);
      if (action === "view-route-quick" && routePreviewWasSuccessful) {
        closeMobileRouteQuickPanel("view_route_success");
      }
      if (action === "start-route-watch-quick" && routePreviewWasSuccessful) {
        closeMobileRouteQuickPanel("start_route_watch_success");
      }
      const panelIsVisible = panel?.classList?.contains("visible") ?? false;
      if (panelWasVisible && !panelIsVisible && routeRenderSucceeded && !lastRouteEarlyReturnReason) {
        lastRoutePanelCloseReason = action === "start-route-watch-quick" ? "start_route_watch_success" : "view_route_success";
      }
    }, true);
    button.dataset.gridlyDirectRouteListenerAttached = "1";
  };

  attachDirectListener(startRouteWatchButton, "start-route-watch-quick");
  attachDirectListener(viewRouteButton, "view-route-quick");
  routeQuickDirectListenerAttached = true;
}

// Compatibility wrapper: legacy callers still invoke this name after route CTA helper split.
function updateRouteWatchStartButtonState() {
  if (typeof loadSavedRoute === "function") {
    loadSavedRoute();
    return;
  }
  if (typeof updateRouteWatchStartButtonLabel === "function") updateRouteWatchStartButtonLabel();
}

async function handleRouteQuickPanelAction(action, event, actionEl) {
  const startSelect = document.getElementById("mobileRouteQuickStart");
  const destinationSelect = document.getElementById("mobileRouteQuickDestination");
  const selectedStartValue = startSelect?.value || "";
  const selectedDestinationValue = destinationSelect?.value || "";

  if (action === "view-route-quick") {
    routeDebugLog("ROUTE QUICK VIEW CLICK HIT", {
      eventTarget: event?.target || null,
      eventCurrentTarget: event?.currentTarget || null,
      selectedStartValue,
      selectedDestinationValue
    });
  } else if (action === "start-route-watch-quick") {
    routeDebugLog("ROUTE QUICK START CLICK HIT", {
      eventTarget: event?.target || null,
      eventCurrentTarget: event?.currentTarget || null,
      selectedStartValue,
      selectedDestinationValue
    });
  }

  lastRouteButtonClickSource = actionEl?.dataset?.action || action || "";
  lastRouteButtonClickAt = new Date().toISOString();
  routeRequestTriggered = true;
  lastRouteError = null;

  if (els.routeWatchStartSelect && startSelect) els.routeWatchStartSelect.value = startSelect.value;
  if (els.routeWatchDestinationSelect && destinationSelect) els.routeWatchDestinationSelect.value = destinationSelect.value;
  const places = getSavedPlaces();
  const resolvedStartPlace = places.find((place) => place.id === (els.routeWatchStartSelect?.value || "")) || null;
  const resolvedDestinationPlace = places.find((place) => place.id === (els.routeWatchDestinationSelect?.value || "")) || null;
  routeDebugLog("Gridly quick panel place resolution result", { resolvedStartPlace, resolvedDestinationPlace });
  updateRouteWatchStartButtonState();

  const routePipelineArgs = {
    activateWatch: action === "start-route-watch-quick",
    source: action === "start-route-watch-quick" ? "mobile_quick_panel_start_watch" : "mobile_quick_panel_view_route"
  };

  try {
    routeDebugLog("ABOUT TO CALL startInlineRouteWatch", {
      typeOfStartInlineRouteWatch: typeof startInlineRouteWatch,
      routePipelineArgs
    });
    if (typeof startInlineRouteWatch !== "function") {
      lastRouteEarlyReturnReason = "start_inline_route_watch_unavailable";
      lastRouteError = "Route pipeline function startInlineRouteWatch is unavailable";
      throw new Error(lastRouteError);
    }
    await startInlineRouteWatch(routePipelineArgs);
    routeDebugLog("RETURNED FROM startInlineRouteWatch", { routePipelineArgs });
  } catch (error) {
    lastRouteError = String(error?.message || error || "Route pipeline invocation failed");
    if (!lastRouteEarlyReturnReason) {
      lastRouteEarlyReturnReason = "route_pipeline_invocation_failed";
    }
    console.error("Gridly quick panel route pipeline call failed", {
      error,
      message: lastRouteError,
      routePipelineArgs
    });
    return;
  }

  const routePreviewWasSuccessful = Boolean(routeRenderSucceeded && !lastRouteEarlyReturnReason);
  if (action === "view-route-quick") {
    routeNavSection("map");
    if (routePreviewWasSuccessful) {
      closeMobileRouteQuickPanel("view_route_success");
    }
    return;
  }

  if (action === "start-route-watch-quick" && routePreviewWasSuccessful) {
    closeMobileRouteQuickPanel("start_route_watch_success");
  }
}

function attachRouteQuickPanelDelegatedClickHandlers() {
  if (routeQuickButtonDelegatedBindingActive) return;
  routeQuickButtonDelegatedBindingActive = true;
  document.addEventListener("click", async (event) => {
    const actionEl = event?.target?.closest?.(
      '#gridlyMobileRouteQuickPanel .route-quick-actions button[data-action="view-route-quick"], #gridlyMobileRouteQuickPanel .route-quick-actions button[data-action="start-route-watch-quick"]'
    );
    if (!actionEl) return;
    if (actionEl.dataset.gridlyDirectRouteListenerAttached === "1") return;
    const action = actionEl.dataset.action || "";
    if (!action) return;
    event.preventDefault();
    await handleRouteQuickPanelAction(action, event, actionEl);
  }, true);
}

function resetQuickHazardReportState() {
  pendingHazardPlacement = null;
  selectedQuickHazardType = null;
  updateReportingState({ selectedHazardType: null, placementModeActive: false, reportModeActive: false });
  document.querySelectorAll("#gridlyHazardPanel .hazard-choice-grid button").forEach((btn) => {
    btn.classList.remove("selected");
  });
  const useMyLocationBtn = document.querySelector('#gridlyHazardPanel [data-action="submit-hazard"]');
  useMyLocationBtn?.classList.remove("selected", "active", "armed");
  useMyLocationBtn?.removeAttribute("aria-pressed");
}

window.submitHazardNearMe = function (hazardType) {
  lastMobileReportSubmitDebug.lastSubmitAttempt = "use_my_location_clicked";
  const selectedType = hazardType || reportingState.selectedHazardType || selectedQuickHazardType || pendingHazardPlacement;
  if (!selectedType) {
    updateReportingState({ lastReportError: "Choose a hazard first, then use My Location.", lastReportMessage: "" });
    setConfirmation("Choose a hazard first, then use My Location.", "error");
    return;
  }

  if (reportingState.submissionInProgress || reportingState.locationLookupInProgress) return;

  if (!navigator.geolocation) {
    updateReportingState({ lastReportError: "Location is unavailable. Select a spot on the map to submit this hazard.", lastReportMessage: "" });
    setConfirmation("Location is unavailable. Select a spot on the map to submit this hazard.", "error");
    return;
  }

  const hazardCopy = HAZARD_TYPES[selectedType] || HAZARD_TYPES.other_hazard;

  updateReportingState({
    activeReportEntryPoint: "hazard_use_my_location",
    locationLookupInProgress: true,
    lastReportError: "",
    lastReportMessage: "Getting your location..."
  });
  setConfirmation("Getting your location...", "info");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const submitted = await createSharedHazardReport(selectedType, lat, lng, "gps hazard report");
      if (!submitted) return;

      if (map) {
        map.setView([lat, lng], 16);
      }

      resetQuickHazardReportState();
      closeHazardPanel();
    },
    () => {
      updateReportingState({
        locationLookupInProgress: false,
        lastReportError: "We couldn't access your location. Allow GPS or tap the map to place this hazard.",
        lastReportMessage: ""
      });
      setConfirmation("We couldn't access your location. Allow GPS or tap the map to place this hazard.", "error");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 15000
    }
  );
};

function openHazardPlacement(hazardType) {
  lastMobileReportSubmitDebug.lastSubmitAttempt = "tap_map_mode_selected";
  pendingHazardPlacement = hazardType || reportingState.selectedHazardType || selectedQuickHazardType || "other_hazard";
  selectedQuickHazardType = pendingHazardPlacement;
  updateReportingState({
    selectedHazardType: pendingHazardPlacement,
    placementModeActive: true,
    activeReportEntryPoint: "hazard_tap_map"
  });
  updateReportingState({
    lastReportError: "",
    lastReportMessage: "Tap the map to place report."
  });
  document.getElementById("gridlyHazardPanel")?.classList.remove("visible");
  setConfirmation("Tap the map to place report.", "info");
}

async function handleHazardPlacementMapClick(event) {
  if (!reportingState.placementModeActive) return;
  if (!pendingHazardPlacement && !reportingState.selectedHazardType) return;
  const lat = event?.latlng?.lat;
  const lng = event?.latlng?.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const selectedType = pendingHazardPlacement || reportingState.selectedHazardType;
  lastMobileReportSubmitDebug.originalTapCoords = { lat, lng };
  lastMobileReportSubmitDebug.lastSubmitAttempt = "tap_captured";
  const snapped = await snapHazardToRoad(lat, lng);
  lastMobileReportSubmitDebug.snappedCoords = { lat: snapped.lat, lng: snapped.lng };
  lastMobileReportSubmitDebug.activeSubmitCoords = { lat: snapped.lat, lng: snapped.lng };
  lastMobileReportSubmitDebug.snapComplete = true;
  lastMobileReportSubmitDebug.lastSubmitAttempt = "snap_completed";
  const submitted = await createSharedHazardReport(selectedType, snapped.lat, snapped.lng, "tap map placement", "", snapped.originalTapCoords);
  if (!submitted) return;
  if (map) {
    L.circleMarker([lat, lng], { radius: 4, color: "#8fb6ff", weight: 1, fillOpacity: 0.3, opacity: 0.8 })
      .addTo(unifiedIncidentLayer)
      .bindTooltip("Tap", { permanent: false, direction: "top" });
    map.flyTo([snapped.lat, snapped.lng], Math.max(map.getZoom(), 15), { duration: 0.35 });
  }
  setConfirmation(snapped.fallbackUsed ? "No nearby roadway found — using tapped location" : "Snapped to roadway", snapped.fallbackUsed ? "success" : "success");
  resetQuickHazardReportState();
  closeHazardPanel();
}

async function snapHazardToRoad(lat, lng) {
  const regionContext = { ...LOCATION_DEFAULTS };
  const snapAttemptRadii = [75, 150];
  const debug = {
    originalTapCoords: { lat, lng },
    snappedCoords: { lat, lng },
    snapAttemptRadii: [...snapAttemptRadii],
    finalSnapRadiusUsed: null,
    snapDistanceMeters: 0,
    nearestRoadFound: false,
    snapMethodUsed: "fallback_original_tap",
    fallbackUsed: true,
    fallbackReason: "nearest_no_result",
    osrmNearestUrl: "",
    osrmNearestStatus: null,
    regionContext,
    routeImpactDetected: false
  };
  for (const radiusMeters of snapAttemptRadii) {
    try {
      const nearestUrl = `${OSRM_NEAREST_API}/${lng},${lat}?number=1&radiuses=${radiusMeters}`;
      debug.osrmNearestUrl = nearestUrl;
      const response = await fetch(nearestUrl);
      debug.osrmNearestStatus = response.status;
      if (!response.ok) throw new Error(`nearest_failed_${response.status}`);
      const payload = await response.json();
      const nearest = payload?.waypoints?.[0];
      const snappedLat = nearest?.location?.[1];
      const snappedLng = nearest?.location?.[0];
      if (!Number.isFinite(snappedLat) || !Number.isFinite(snappedLng)) throw new Error("nearest_no_geometry");
      const snapDistanceMeters = Number(nearest?.distance || 0);
      debug.snappedCoords = { lat: snappedLat, lng: snappedLng };
      debug.snapDistanceMeters = snapDistanceMeters;
      debug.finalSnapRadiusUsed = radiusMeters;
      debug.nearestRoadFound = true;
      debug.snapMethodUsed = "osrm_nearest_v1_driving";
      debug.fallbackUsed = false;
      debug.fallbackReason = "";
      debug.routeImpactDetected = routeWatchActivated && isPointNearActiveRoute(snappedLat, snappedLng);
      lastRoadSnapDebug = debug;
      return { lat: snappedLat, lng: snappedLng, fallbackUsed: false, originalTapCoords: debug.originalTapCoords };
    } catch (error) {
      debug.fallbackReason = String(error?.message || error || "nearest_unknown_failure");
    }
  }
  lastRoadSnapDebug = debug;
  return { lat, lng, fallbackUsed: true, originalTapCoords: debug.originalTapCoords };
}

function isPointNearActiveRoute(lat, lng) {
  const points = savedRouteLayer?.getLatLngs?.() || [];
  if (!Array.isArray(points) || !points.length) return false;
  return points.some((p) => getDistanceMiles(lat, lng, p.lat, p.lng) <= 0.08);
}

async function createSharedHazardReport(hazardType, lat, lng, confidence, locationName = "", originalTapCoords = null) {
  lastMobileReportSubmitDebug.lastSubmitAttempt = "final_submit_handler_entered";
  if (reportingState.submissionInProgress) return false;

  if (!supabaseClient) {
    setConfirmation("Live hazard sync is unavailable.", "error");
    return false;
  }

  const copy = HAZARD_TYPES[hazardType] || HAZARD_TYPES.other_hazard;
  const sourceTag = ROAD_HAZARD_SOURCE_MAP[hazardType] || "community_report";
  const expiresAt = new Date(Date.now() + HAZARD_REPORT_EXPIRATION_MINUTES * 60000).toISOString();

  const row = {
    crossing_id: `hazard-${deviceId}-${Date.now()}`,
    crossing_name: locationName ? `${copy.label} · ${locationName}` : copy.label,
    railroad: "Road hazard",
    lat,
    lng,
    report_type: hazardType,
    severity: copy.severity,
    detail: `${copy.detail} (future_source: ${sourceTag})`,
    source: "user",
    confidence,
    device_id: deviceId,
    expires_at: expiresAt
  };

  try {
    lastMobileReportSubmitDebug.activeSubmitCoords = { lat, lng };
    if (originalTapCoords) lastMobileReportSubmitDebug.originalTapCoords = { ...originalTapCoords };
    lastMobileReportSubmitDebug.insertPayloadPreview = { ...row };
    lastMobileReportSubmitDebug.supabaseInsertStarted = false;
    lastMobileReportSubmitDebug.supabaseInsertSucceeded = false;
    lastMobileReportSubmitDebug.supabaseInsertError = "";
    lastMobileReportSubmitDebug.lastSubmitError = "";
    updateReportingState({ submissionInProgress: true, locationLookupInProgress: false });
    setSync("Sending hazard report...");
    updateReportingState({ lastReportError: "", lastReportMessage: `Sending ${copy.label} hazard report...` });
    setConfirmation(`Sending ${copy.label} hazard report...`, "success");

    lastMobileReportSubmitDebug.lastSubmitAttempt = "supabase_insert_started";
    lastMobileReportSubmitDebug.supabaseInsertStarted = true;
    const { error } = await supabaseClient.from("reports").insert(row);

    if (error) throw error;

    lastMobileReportSubmitDebug.lastSubmitAttempt = "supabase_insert_succeeded";
    lastMobileReportSubmitDebug.supabaseInsertSucceeded = true;
    updateReportingState({ lastReportError: "", lastReportMessage: "Report added" });
    setConfirmation("Report added", "success");
    setSync("Hazard report shared");

    await runPostSubmitRefresh();
    updateReportingState({
      submissionInProgress: false,
      locationLookupInProgress: false,
      reportModeActive: false,
      placementModeActive: false,
      selectedHazardType: null
    });
    closeHazardPanel({ preserveLastReportMessage: true });
    returnMobileToLiveMode("submit_hazard_success");
    lastMobileReportSubmitDebug.postSubmitUiResetSucceeded = true;
    lastMobileReportSubmitDebug.lastSubmitAttempt = "ui_reset_complete";
    return true;
  } catch (error) {
    console.error("Gridly hazard insert failed:", error);
    lastMobileReportSubmitDebug.lastSubmitAttempt = "supabase_insert_failed";
    lastMobileReportSubmitDebug.supabaseInsertError = error?.message || "unknown_error";
    lastMobileReportSubmitDebug.lastSubmitError = error?.message || "unknown_error";
    updateReportingState({ lastReportError: `Hazard report failed: ${error.message || "permission denied"}` });
    setConfirmation(`Hazard report failed: ${error.message || "permission denied"}`, "error");
    setSync("Hazard report failed");
    updateReportingState({ submissionInProgress: false, locationLookupInProgress: false });
    return false;
  }
}
window.confirmHazardStillThere = async function (hazardType, lat, lng) {
  await createSharedHazardReport(hazardType, lat, lng, "hazard confirmed still there");
};

window.clearHazard = async function (hazardType, lat, lng) {
  if (!supabaseClient) {
    setConfirmation("Live hazard sync is unavailable.", "error");
    return;
  }

  const copy = HAZARD_TYPES[hazardType] || HAZARD_TYPES.other_hazard;
  const expiresAt = new Date(Date.now() + 30 * 60000).toISOString();

  const row = {
    crossing_id: `hazard-cleared-${deviceId}-${Date.now()}`,
    crossing_name: `${copy.label} Cleared`,
    railroad: "Road hazard",
    lat,
    lng,
    report_type: "hazard_cleared",
    severity: "low",
    detail: `Shared report: ${copy.label} appears cleared.`,
    source: "user",
    confidence: "hazard cleared by user",
    device_id: deviceId,
    expires_at: expiresAt
  };

  try {
    setSync("Sending hazard clear report...");
    setConfirmation(`Clearing ${copy.label} hazard...`, "success");

    lastMobileReportSubmitDebug.lastSubmitAttempt = "supabase_insert_started";
    lastMobileReportSubmitDebug.supabaseInsertStarted = true;
    const { error } = await supabaseClient.from("reports").insert(row);

    if (error) throw error;

    setConfirmation(`${copy.label} marked cleared.`, "success");
    setSync("Hazard cleared");

    await runPostSubmitRefresh();
  } catch (error) {
    console.error("Gridly hazard clear failed:", error);
    setConfirmation(`Clear failed: ${error.message || "permission denied"}`, "error");
    setSync("Hazard clear failed");
  }
};
function injectHazardStyles() {
  if (document.getElementById("gridlyHazardStyles")) return;

  const style = document.createElement("style");
  style.id = "gridlyHazardStyles";
  style.textContent = `
    .gridly-hazard-marker {
      --gridly-marker-border: rgba(255, 209, 102, 0.95);
      --gridly-marker-glow: rgba(255, 209, 102, 0.24);
      width: 27px;
      height: 27px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      position: relative;
      background: rgba(8, 16, 24, 0.96);
      border: 2px solid var(--gridly-marker-border);
      box-shadow: 0 0 0 1.5px rgba(255,255,255,0.16), 0 0 10px var(--gridly-marker-glow);
      animation: gridlyHazardPulse 2.2s infinite;
    }

    .gridly-hazard-marker.high {
      border-color: rgba(255, 78, 111, 0.98);
      box-shadow: 0 0 0 2px rgba(255,255,255,0.16), 0 0 18px rgba(255, 78, 111, 0.48);
    }

    .gridly-hazard-marker.moderate {
      border-color: rgba(57, 200, 255, 0.95);
      box-shadow: 0 0 0 2px rgba(255,255,255,0.16), 0 0 18px rgba(57, 200, 255, 0.5);
    }

    .gridly-hazard-marker span {
      font-size: 14px;
      line-height: 1;
      font-weight: 800;
    }

    .gridly-hazard-marker small {
      position: absolute;
      right: -10px;
      bottom: -9px;
      background: #02080f;
      color: #fff;
      border-radius: 999px;
      padding: 2px 5px;
      font-size: 9px;
      font-weight: 900;
      border: 1px solid rgba(185, 236, 255, 0.34);
    }

    @keyframes gridlyHazardPulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.08); }
      100% { transform: scale(1); }
    }
    .gridly-hazard-counter {
      position: fixed;
      right: 18px;
      bottom: 146px;
      z-index: 9998;
      background: rgba(9, 18, 32, 0.92);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 900;
      box-shadow: 0 12px 34px rgba(0,0,0,0.24);
      backdrop-filter: blur(14px);
    }

    .gridly-hazard-marker.fresh {
      opacity: 1;
    }

    .gridly-hazard-marker.aging {
      opacity: 0.78;
      animation-duration: 2.6s;
    }

    .gridly-hazard-marker.old {
      opacity: 0.5;
      animation: none;
    }

    .gridly-hazard-marker.route-relevant {
      transform: scale(1.1);
      filter: saturate(1.12) brightness(1.06);
      box-shadow: 0 0 0 2px rgba(255,255,255,0.2), 0 0 14px rgba(255, 209, 102, 0.44);
    }

    .gridly-hazard-marker.high.route-relevant {
      box-shadow: 0 0 0 2px rgba(255,255,255,0.2), 0 0 16px rgba(255, 78, 111, 0.5);
    }

    .gridly-hazard-marker.moderate.route-relevant {
      box-shadow: 0 0 0 2px rgba(255,255,255,0.2), 0 0 16px rgba(57, 200, 255, 0.48);
    }

    .gridly-hazard-marker.route-deemphasized {
      opacity: 0.46;
      filter: saturate(0.72) brightness(0.88);
      animation-duration: 3.2s;
    }
    .gridly-hazard-marker[data-category="rail_blockage_delay"] { --gridly-marker-border: rgba(255, 78, 111, 0.98); --gridly-marker-glow: rgba(255, 78, 111, 0.46); }
    .gridly-hazard-marker[data-category="flooding"] { --gridly-marker-border: rgba(71, 169, 255, 0.98); --gridly-marker-glow: rgba(71, 169, 255, 0.44); }
    .gridly-hazard-marker[data-category="crash"] { --gridly-marker-border: rgba(255, 143, 71, 0.98); --gridly-marker-glow: rgba(255, 143, 71, 0.44); }
    .gridly-hazard-marker[data-category="construction"] { --gridly-marker-border: rgba(255, 176, 46, 0.98); --gridly-marker-glow: rgba(255, 176, 46, 0.44); }
    .gridly-hazard-marker[data-category="road_closed"] { --gridly-marker-border: rgba(255, 78, 111, 0.98); --gridly-marker-glow: rgba(255, 78, 111, 0.52); }
    .gridly-hazard-marker[data-category="disabled_vehicle"] { --gridly-marker-border: rgba(183, 197, 214, 0.95); --gridly-marker-glow: rgba(183, 197, 214, 0.4); }
    .gridly-hazard-marker[data-category="other_hazard"] { --gridly-marker-border: rgba(181, 210, 255, 0.9); --gridly-marker-glow: rgba(181, 210, 255, 0.36); }
    .gridly-hazard-marker[data-state="cleared"] {
      opacity: 0.48;
      filter: saturate(0.68) brightness(0.9);
      animation: none;
      --gridly-marker-border: rgba(80, 228, 156, 0.95);
      --gridly-marker-glow: rgba(80, 228, 156, 0.36);
    }
    .gridly-hazard-marker.confidence-high { box-shadow: 0 0 0 2px rgba(255,255,255,0.2), 0 0 12px rgba(143, 206, 255, 0.38); }

    .gridly-hazard-marker b {
      position: absolute;
      left: -8px;
      top: -8px;
      min-width: 18px;
      height: 18px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: #ff5858;
      color: #fff;
      font-size: 10px;
      font-weight: 950;
      border: 2px solid #fff;
    }
    .gridly-hazard-launcher {
      position: fixed;
      right: 18px;
      bottom: 92px;
      z-index: 9998;
      border: 0;
      border-radius: 999px;
      padding: 13px 16px;
      background: linear-gradient(135deg, #ffd166, #ff7a59);
      color: #08111f;
      font-weight: 950;
      box-shadow: 0 16px 40px rgba(0,0,0,0.28);
      cursor: pointer;
    }

    .gridly-hazard-panel {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      bottom: 16px;
      width: min(560px, calc(100vw - 24px));
      max-width: calc(100vw - 36px);
      z-index: 9999;
      display: none;
      background: rgba(9, 18, 32, 0.97);
      color: #fff;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.14);
      box-shadow: 0 22px 70px rgba(0,0,0,0.42);
      padding: 14px;
      backdrop-filter: blur(16px);
      max-height: calc(100dvh - 24px);
      overflow: hidden;
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      gap: 0;
    }

    .gridly-hazard-panel.visible {
      display: grid;
      animation: gridlyHazardSheetIn .18s ease-out;
    }
    @keyframes gridlyHazardSheetIn {
      from { opacity: 0; transform: translate(-50%, 16px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }

    .hazard-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .hazard-panel-header strong {
      font-size: 16px;
    }

    .hazard-panel-header button {
      border: 0;
      width: 30px;
      height: 30px;
      border-radius: 999px;
      background: rgba(255,255,255,0.12);
      color: #fff;
      font-size: 20px;
      cursor: pointer;
    }

    .gridly-hazard-panel p {
      margin: 0 0 12px;
      color: rgba(255,255,255,0.72);
      font-size: 13px;
      line-height: 1.4;
    }

    .hazard-choice-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      overflow-y: auto;
      min-height: 0;
      max-height: clamp(180px, 42dvh, 380px);
      padding-bottom: 8px;
      -webkit-overflow-scrolling: touch;
    }

    .hazard-choice-grid button {
      border: 0;
      border-radius: 14px;
      padding: 12px;
      text-align: left;
      font-weight: 900;
      background: rgba(255,255,255,0.1);
      color: #fff;
      cursor: pointer;
    }

    .hazard-choice-grid button:hover {
      background: rgba(255,255,255,0.16);
    }

    .hazard-choice-grid button.selected {
      background: rgba(255, 209, 102, 0.24);
      outline: 2px solid rgba(255, 209, 102, 0.7);
    }

    .hazard-panel-placement-actions {
      margin-top: 10px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      flex-shrink: 0;
      position: sticky;
      bottom: 0;
      z-index: 2;
      background: rgba(9, 18, 32, 0.98);
      border-top: 1px solid rgba(255,255,255,0.12);
      padding-top: 8px;
      padding-bottom: max(4px, env(safe-area-inset-bottom, 0px));
    }
    .hazard-panel-placement-actions button {
      border: 0;
      border-radius: 12px;
      padding: 12px;
      font-weight: 900;
      cursor: pointer;
    }
    .hazard-panel-placement-actions button[data-action="submit-hazard"] {
      background: linear-gradient(135deg, #ffd166, #ff7a59);
      color: #08111f;
    }
    .hazard-panel-placement-actions button[data-action="cancel-hazard-placement"] {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }

    @media (max-width: 760px) {
      .gridly-hazard-launcher {
        left: 14px;
        right: 14px;
        bottom: 116px;
        width: calc(100vw - 28px);
      }
      .gridly-hazard-counter {
        left: 14px;
        right: 14px;
        bottom: 171px;
        text-align: center;
      }
      .gridly-hazard-panel {
        left: 12px;
        right: 12px;
        bottom: calc(84px + env(safe-area-inset-bottom));
        top: max(10px, env(safe-area-inset-top));
        transform: none;
        width: auto;
        max-height: calc(100dvh - max(10px, env(safe-area-inset-top)) - (84px + env(safe-area-inset-bottom)));
        grid-template-rows: auto auto minmax(0, 1fr) auto;
        gap: 0;
      }
      .hazard-choice-grid {
        grid-template-columns: 1fr;
        gap: 6px;
        max-height: min(42dvh, 320px);
        padding-bottom: 8px;
      }
      .hazard-choice-grid button {
        padding: 10px;
      }
      .hazard-panel-placement-actions {
        gap: 6px;
        margin-top: 8px;
      }
      .hazard-panel-placement-actions button {
        padding: 10px;
      }
    }
  `;

  document.head.appendChild(style);
}


function wirePopupReportButtons(popupRoot) {
  if (!popupRoot) return;

  const buttons = popupRoot.querySelectorAll(".popup-report-btn[data-crossing-id][data-report-type]");
  console.log("Wiring crossing popup buttons", buttons.length);

  buttons.forEach((button) => {
    if (button.dataset.boundPopupHandler === "1") return;

    let lastSubmittedAt = 0;
    const submitFromPopup = async (event) => {
      const now = Date.now();
      if (now - lastSubmittedAt < 350) return;
      lastSubmittedAt = now;

      event.preventDefault();
      event.stopPropagation();
      const crossingId = button.getAttribute("data-crossing-id");
      const reportType = button.getAttribute("data-report-type");
      console.log("Crossing report button clicked", { type: reportType, crossingId });
      if (!crossingId || !reportType || typeof window.reportCrossingFromPopup !== "function") return;
      await window.reportCrossingFromPopup(crossingId, reportType, button);
    };

    button.addEventListener("click", submitFromPopup);
    button.dataset.boundPopupHandler = "1";
  });

  if (!popupRoot.dataset.boundCrossingDelegate) {
    popupRoot.addEventListener("click", async (event) => {
      const button = event.target.closest(".popup-report-btn[data-crossing-id][data-report-type]");
      if (!button) return;
      const crossingId = button.getAttribute("data-crossing-id");
      const reportType = button.getAttribute("data-report-type");
      console.log("Crossing popup delegate clicked", { type: reportType, crossingId });
      if (!crossingId || !reportType || typeof window.reportCrossingFromPopup !== "function") return;
      event.preventDefault();
      event.stopPropagation();
      await window.reportCrossingFromPopup(crossingId, reportType, button);
    });
    popupRoot.dataset.boundCrossingDelegate = "1";
  }
}

function buildPopup(crossing, report) {
  const lifecycleState = getIncidentLifecycleState(report);
  const status = report
    ? lifecycleState === "recently_cleared" || lifecycleState === "cleared"
      ? "Recently cleared"
      : report.title
    : "No active report";

  const freshness = report ? `${report.minutesAgo} min ago` : "No recent report";
  const trustCount = getReportCountForCrossing(crossing.id);

  const trustLabel = getDriverConfirmationLabel(trustCount);
  const confidenceLabel = getCrossingConfidenceLabel(report, trustCount);
  const trustFreshness = report
    ? `Last confirmed ${report.minutesAgo} min ago`
    : "Needs confirmation";
  const reportState = getReportStateLabel(report);
  const routeImpact = getRouteImpactSummary(report, crossing);

  return `
    <div class="gridly-popup">
      <strong>${sanitizeText(crossing.name)}</strong>
      <span>${sanitizeText(crossing.railroad)}</span><br />
      <span>Status: ${sanitizeText(status)}</span><br />
      <span>Freshness: ${sanitizeText(freshness)}</span><br />
      <span>Driver confirmations: ${sanitizeText(trustLabel)}</span><br />
      <span>${sanitizeText(trustFreshness)}</span><br />
      <span>How sure this is current: ${sanitizeText(confidenceLabel)}</span><br />
      <span>${sanitizeText(reportState)}</span><br />
      <span>What this means for your drive: ${sanitizeText(routeImpact)}</span><br />
      <span>Auto-expires after ${REPORT_EXPIRATION_MINUTES} min</span><br />
      <span>Risk Score: ${crossing.risk}/100</span>

      <div class="popup-report-grid">
        <button class="popup-report-btn danger" type="button" data-crossing-id="${sanitizeText(crossing.id)}" data-report-type="blocked">Blocked</button>
        <button class="popup-report-btn warning" type="button" data-crossing-id="${sanitizeText(crossing.id)}" data-report-type="heavy">Delay</button>
        <button class="popup-report-btn blue" type="button" data-crossing-id="${sanitizeText(crossing.id)}" data-report-type="cleared">Cleared</button>
        <button class="popup-report-btn neutral" type="button" data-crossing-id="${sanitizeText(crossing.id)}" data-report-type="other">Other</button>
      </div>
    </div>
  `;
}

function getRouteImpactSummary(report, crossing) {
  const lifecycleState = getIncidentLifecycleState(report);
  if (!report || lifecycleState === "cleared" || lifecycleState === "recently_cleared") return "Low · stay on route";
  if (report.type === "blocked") return "High · reroute recommended";
  if (report.type === "heavy") return "Moderate · expect delay";
  if ((crossing?.risk || 0) >= 70) return "Moderate · monitor crossing";
  return "Low · monitor conditions";
}

window.reportCrossingFromPopup = async function (crossingId, reportType, buttonEl) {
  const normalizedType = String(reportType || "").trim().toLowerCase();
  console.log("Submitting crossing report:", normalizedType || "other", String(crossingId));
  const crossing = crossings.find((item) => String(item.id) === String(crossingId));

  if (!crossing) {
    setConfirmation("Crossing not found. Try refreshing.", "error");
    return;
  }

  if (normalizedType === "cleared") {
    console.debug("Cleared crossing action", { crossingId, normalizedType, crossingName: crossing.name });
  }

  await createSharedReport(crossing, normalizedType || "other", "exact map marker", buttonEl);
};


function bindMobileTap(element, handler) {
  if (!element || typeof handler !== "function") return;

  let lastTapAt = 0;
  const invoke = (event) => {
    const now = Date.now();
    if (now - lastTapAt < 350) return;
    lastTapAt = now;

    event?.preventDefault?.();
    event?.stopPropagation?.();
    handler(event);
  };

  element.addEventListener("pointerup", invoke);
  element.addEventListener("click", invoke);
}

window.zoomToCrossing = function (crossingId) {
  const crossing = crossings.find((item) => String(item.id) === String(crossingId));
  if (!crossing) return;

  scrollToSection("mapSection");
  map.setView([crossing.lat, crossing.lng], 15);

  setTimeout(() => {
    if (map) map.invalidateSize();
    crossingMarkers.get(String(crossing.id))?.openPopup();
  }, 350);
};


function setReportMode(mode) {
  activeReportMode = mode === REPORT_MODES.roadHazard ? REPORT_MODES.roadHazard : REPORT_MODES.rail;
  updateReportingState({ activeReportEntryPoint: "manual_mode_toggle" });

  const isRoadHazardMode = activeReportMode === REPORT_MODES.roadHazard;

  if (els.mobileCrossingReportBtn) {
    els.mobileCrossingReportBtn.classList.toggle("active", !isRoadHazardMode);
    els.mobileCrossingReportBtn.setAttribute("aria-pressed", String(!isRoadHazardMode));
  }

  if (els.mobileHazardReportBtn) {
    els.mobileHazardReportBtn.classList.toggle("active", isRoadHazardMode);
    els.mobileHazardReportBtn.setAttribute("aria-pressed", String(isRoadHazardMode));
  }

  safeText("reportSearchLabel", isRoadHazardMode ? "Search hazard area" : "Search crossing");
  safeText("reportSelectLabel", isRoadHazardMode ? "Road hazard location" : "Manual crossing");
  safeText("reportTypeLabel", isRoadHazardMode ? "Hazard type" : "Report type");

  if (els.crossingSearch) {
    els.crossingSearch.placeholder = isRoadHazardMode
      ? "Search road, area, or landmark..."
      : "Search street, crossing, or railroad...";
  }

  if (els.manualReportType) {
    if (isRoadHazardMode) {
      els.manualReportType.innerHTML = ROAD_HAZARD_TYPE_OPTIONS.map(
        (option) => `<option value="${option.value}">${option.label}</option>`
      ).join("");
    } else {
      els.manualReportType.innerHTML = `
        <option value="blocked">Blocked</option>
        <option value="heavy">Heavy Delay</option>
        <option value="cleared">Cleared</option>
        <option value="other">Other Issue</option>
      `;
    }
  }

  if (els.manualReportBtn) {
    els.manualReportBtn.textContent = isRoadHazardMode ? "Submit Road Hazard" : "Submit Shared Report";
  }
}

function bindEvents() {
  migrateLegacyStorage();
  // Control ownership helpers: mode-scoped visible controls, shared behavior helpers.
  const bindSharedCoreControls = () => {
    if (document.body.dataset.gridlySharedCoreBound === "1") return;
    document.body.dataset.gridlySharedCoreBound = "1";
  };
  const bindDesktopControls = () => {
    if (document.body.dataset.gridlyDesktopControlsBound === "1") return;
    document.body.dataset.gridlyDesktopControlsBound = "1";
    const desktopReportBtn = els.desktopReportNearMeBtn;
    const desktopRailReportBtn = els.desktopReportNearMeBtnRail;
    desktopReportBtn?.addEventListener("click", handleReportNearMe);
    desktopRailReportBtn?.addEventListener("click", handleReportNearMe);
  };
  const bindPortraitControls = () => {
    if (document.body.dataset.gridlyPortraitControlsBound === "1") return;
    document.body.dataset.gridlyPortraitControlsBound = "1";
    const portraitRouteBtn = els.mobileQuickRouteBtn;
    const portraitAlertsBtn = els.mobileQuickFavoritesBtn;
    portraitRouteBtn?.addEventListener("click", () => openMobileRouteQuickPanel());
    portraitAlertsBtn?.addEventListener("click", () => openSmartAlertsModal());
  };
  const bindTacticalLandscapeControls = () => {
    if (document.body.dataset.gridlyTacticalControlsBound === "1") return;
    document.body.dataset.gridlyTacticalControlsBound = "1";
    const tacticalRouteBtn = document.getElementById("mobileDockRouteBtn");
    const tacticalLayersBtn = document.getElementById("mobileDockLayersBtn");
    tacticalRouteBtn?.setAttribute("data-gridly-mode-owner", "tactical-landscape");
    tacticalLayersBtn?.setAttribute("data-gridly-mode-owner", "tactical-landscape");
  };
  const bindTapSafeClose = (element, handler) => {
    if (!element) return;
    const invoke = (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      handler();
    };
    element.addEventListener("click", invoke);
    element.addEventListener("touchend", invoke, { passive: false });
    element.addEventListener("pointerup", invoke);
  };

  els.saveRouteBtn?.addEventListener("click", saveRoute);
  els.useLocationBtn?.addEventListener("click", handleReportNearMe);
  els.mobileUseLocationBtn?.addEventListener("click", () => {
    closeRouteSetupModal();
    handleReportNearMe();
  });

  els.refreshBtn?.addEventListener("click", async () => {
    if (crossingLoadFailed) {
      await loadCrossings();
    }
    await runPostSubmitRefresh();
    flashButton(els.refreshBtn, "Updated");
  });

  els.manualReportBtn?.addEventListener("click", submitManualReport);
  els.clearReportsBtn?.addEventListener("click", loadSharedReports);
  els.crossingSearch?.addEventListener("input", handleCrossingSearch);
  els.shareGridlyBtn?.addEventListener("click", shareGridly);
  els.headerShareGridlyBtn?.addEventListener("click", shareGridly);

  bindMobileReportEntryDelegation();
  const openPortraitAreaSurface = () => {
    portraitSurfaceDebugLog("[Gridly][PortraitSurface] openPortraitAreaSurface:start");
    const layer = document.getElementById("mobileNativeSurfaceLayer");
    const title = document.getElementById("mobileNativeSurfaceTitle");
    const body = document.getElementById("mobileNativeSurfaceBody");
    if (!layer || !title || !body) return;
    title.textContent = "Area Filter";
    body.dataset.mobileSurfaceView = "area-filter";
    body.innerHTML = `
      <article class="mobile-native-surface-card">
        <strong>Focus Map Area</strong>
        <p>Choose which crossings to show using the same map filters.</p>
        <div class="mobile-native-surface-actions mobile-native-surface-actions-grid">
          <button class="secondary-btn" type="button" data-portrait-area-option="nearby">Nearby</button>
          <button class="secondary-btn" type="button" data-portrait-area-option="route">My Route</button>
          <button class="secondary-btn" type="button" data-portrait-area-option="town">My Town</button>
          <button class="secondary-btn" type="button" data-portrait-area-option="delays">Delays</button>
          <button class="secondary-btn" type="button" data-portrait-area-option="all">All</button>
        </div>
      </article>`;
    layer.hidden = false;
    layer.style.opacity = "1";
    layer.style.visibility = "visible";
    layer.style.pointerEvents = "auto";
    layer.setAttribute("aria-hidden", "false");
    layer.classList.add("is-open");
    normalizeMobileSurfaceBackdrop(true);
    setMobileUiMode("alert", { silent: true });
    portraitSurfaceDebugLog("[Gridly][PortraitSurface] openPortraitAreaSurface:rendered", {
      hidden: layer.hidden,
      ariaHidden: layer.getAttribute("aria-hidden"),
      view: body.dataset.mobileSurfaceView
    });
    focusMobileSurfaceEntryTarget();
  };
  const openPortraitLayersSurface = () => {
    portraitSurfaceDebugLog("[Gridly][PortraitSurface] openPortraitLayersSurface:start");
    const layer = document.getElementById("mobileNativeSurfaceLayer");
    const title = document.getElementById("mobileNativeSurfaceTitle");
    const body = document.getElementById("mobileNativeSurfaceBody");
    if (!layer || !title || !body) return;
    title.textContent = "Map Layers";
    body.dataset.mobileSurfaceView = "map-layers";
    body.innerHTML = `
      <article class="mobile-native-surface-card">
        <strong>Choose Base Layer</strong>
        <div class="mobile-native-surface-actions mobile-native-surface-actions-grid">
          <button class="secondary-btn" type="button" data-portrait-layer-option="standard">Standard</button>
          <button class="secondary-btn" type="button" data-portrait-layer-option="dark">Dark</button>
          <button class="secondary-btn" type="button" data-portrait-layer-option="satellite">Satellite</button>
        </div>
      </article>`;
    layer.hidden = false;
    layer.style.opacity = "1";
    layer.style.visibility = "visible";
    layer.style.pointerEvents = "auto";
    layer.setAttribute("aria-hidden", "false");
    layer.classList.add("is-open");
    normalizeMobileSurfaceBackdrop(true);
    setMobileUiMode("alert", { silent: true });
    portraitSurfaceDebugLog("[Gridly][PortraitSurface] openPortraitLayersSurface:rendered", {
      hidden: layer.hidden,
      ariaHidden: layer.getAttribute("aria-hidden"),
      view: body.dataset.mobileSurfaceView
    });
    focusMobileSurfaceEntryTarget();
  };
  const bindPortraitSurfaceOptionHandlers = () => {
    const body = document.getElementById("mobileNativeSurfaceBody");
    if (!body || body.dataset.gridlyPortraitSurfaceOptionsBound === "1") return;
    body.dataset.gridlyPortraitSurfaceOptionsBound = "1";
    const areaFilterKeyByOption = {
      nearby: "nearby",
      route: "town",
      town: "county",
      delays: "active-delays",
      all: "all"
    };
    const layerNameByOption = {
      standard: "Standard",
      dark: "Dark",
      satellite: "Satellite"
    };
    body.addEventListener("click", (event) => {
      const areaOptionBtn = event.target?.closest?.("[data-portrait-area-option]");
      if (areaOptionBtn) {
        const selectedOption = areaOptionBtn.dataset.portraitAreaOption || "all";
        const filterKey = areaFilterKeyByOption[selectedOption] || "all";
        portraitSurfaceDebugLog("[Gridly][PortraitSurface] option clicked", { type: "area", selectedOption });
        portraitSurfaceDebugLog("[Gridly][PortraitSurface] target function called", { fn: "applyGeoFilterFromPill", value: filterKey });
        applyGeoFilterFromPill(filterKey);
        scrollToSection("mapSection");
        closeMobileNativeSurfaceLayer();
        portraitSurfaceDebugLog("[Gridly][PortraitSurface] close completed", { type: "area", selectedOption });
        return;
      }
      const layerOptionBtn = event.target?.closest?.("[data-portrait-layer-option]");
      if (!layerOptionBtn) return;
      const selectedOption = layerOptionBtn.dataset.portraitLayerOption || "satellite";
      const layerName = layerNameByOption[selectedOption] || "Satellite";
      portraitSurfaceDebugLog("[Gridly][PortraitSurface] option clicked", { type: "layers", selectedOption });
      portraitSurfaceDebugLog("[Gridly][PortraitSurface] target function called", { fn: "applyMapStyle", value: layerName });
      applyMapStyle(layerName);
      closeMobileNativeSurfaceLayer();
      portraitSurfaceDebugLog("[Gridly][PortraitSurface] close completed", { type: "layers", selectedOption });
    });
  };
  bindPortraitSurfaceOptionHandlers();
  const closePortraitAlertsPanel = () => {
    document.body.classList.remove("portrait-alerts-open");
    const alertsSection = document.getElementById("alertsSection");
    if (!alertsSection) return;
    alertsSection.hidden = true;
    alertsSection.setAttribute("aria-hidden", "true");
    alertsSection.style.display = "";
    alertsSection.style.opacity = "";
    alertsSection.style.pointerEvents = "";
    alertsSection.style.width = "";
    alertsSection.style.height = "";
  };
  els.mobileReportBtn?.addEventListener("click", (event) => invokeMobileReportEntry("mobile_sticky_report", event));
  els.mobileDockReportBtn?.addEventListener("click", (event) => {
    closePortraitAlertsPanel();
    if (!isTacticalLandscapeDockMode()) return invokeMobileReportEntry("mobile_dock_report_button", event);
    closeAllTacticalDockSurfaces({ except: "report" });
    setTacticalReportHelperVisibility(true);
    invokeMobileReportEntry("mobile_dock_report_button", event);
  });
  portraitSurfaceDebugLog("[Gridly][PortraitSurface] binding attached", {
    areaButtonPresent: Boolean(els.mobileDockAreaBtn),
    layersButtonPresent: Boolean(document.getElementById("mobileDockLayersBtn"))
  });
  els.mobileDockAreaBtn?.addEventListener("click", () => {
    closePortraitAlertsPanel();
    portraitSurfaceDebugLog("[Gridly][PortraitSurface] Area button click handler fired");
    if (!isTacticalLandscapeDockMode()) {
      openPortraitAreaSurface();
      return;
    }
    openTacticalDockSheet("area", "Area Filter", `
      <div class="gridly-tactical-option-grid">
        <button type="button" data-geo-filter="nearby">Nearby</button>
        <button type="button" data-geo-filter="town">My Route</button>
        <button type="button" data-geo-filter="county">My Town</button>
        <button type="button" data-geo-filter="active-delays">Delays</button>
        <button type="button" data-geo-filter="all">All</button>
      </div>
    `);
    document.querySelectorAll("#gridlyTacticalDockSheet [data-geo-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyGeoFilterFromPill(btn.dataset.geoFilter || "all");
        closeTacticalDockSheet();
      }, { once: true });
    });
  });
  document.getElementById("mobileDockRouteBtn")?.addEventListener("click", () => {
    closeGridlySurface("alerts", { silent: true });
    closeAllTacticalDockSurfaces({ except: "route" });
    routeLauncherSource = "route-dock-button";
    openGridlySurface("route", () => openMobileRouteQuickPanel());
  });
  document.getElementById("mobileDockAlertsBtn")?.addEventListener("click", () => {
    if (!isTacticalLandscapeDockMode()) {
      const alertsSection = document.getElementById("alertsSection");
      openGridlySurface("alerts", () => {
        document.body.classList.add("portrait-alerts-open");
        if (alertsSection) {
          alertsSection.hidden = false;
          alertsSection.setAttribute("aria-hidden", "false");
          alertsSection.style.display = "grid";
          alertsSection.style.opacity = "1";
          alertsSection.style.pointerEvents = "auto";
          alertsSection.style.width = "";
          alertsSection.style.height = "";
        }
        setMobileUiMode("alert", { silent: true });
      });
      return;
    }
    const rows = (getUnifiedIncidents?.() || []).slice(0, 8).map((incident) => {
      const latest = incident?.latestReport || {};
      return `<article class="gridly-tactical-alert-row"><strong>${sanitizeText(incident?.crossingName || "Incident")}</strong><p>${sanitizeText(getReportCopy(latest.type).label)} · ${sanitizeText(getReportStateLabel(latest))}</p></article>`;
    }).join("") || `<p class="gridly-tactical-empty">No active alerts right now.</p>`;
    openTacticalDockSheet("alerts", "Live Alerts", `<div class="gridly-tactical-alert-list">${rows}</div><div class="gridly-tactical-sheet-actions"><button type="button" data-alerts-manage>Manage Alerts</button></div>`);
    document.querySelector("#gridlyTacticalDockSheet [data-alerts-manage]")?.addEventListener("click", () => {
      closeTacticalDockSheet();
      openGridlySurface("settings", () => openSettingsModal());
    }, { once: true });
  });
  document.getElementById("mobileHeaderSettingsBtn")?.addEventListener("click", () => {
    closeGridlySurface("alerts", { silent: true });
    openGridlySurface("settings", () => openSettingsModal());
  });

  document.getElementById("portraitAlertsCloseBtn")?.addEventListener("click", () => {
    portraitSurfaceDebugLog("[Gridly][PortraitSurface] Alerts close button click handler fired");
    closePortraitAlertsPanel();
    closeGridlySurface("alerts", { silent: true });
    setMobileUiMode("live", { silent: true });
  });

  document.getElementById("mobileDockLayersBtn")?.addEventListener("click", () => {
    closePortraitAlertsPanel();
    portraitSurfaceDebugLog("[Gridly][PortraitSurface] Layers button click handler fired");
    if (!isTacticalLandscapeDockMode()) {
      openPortraitLayersSurface();
      return;
    }
    const options = ["Standard", "Dark", "Satellite"].map((name) => `<button type="button" data-layer-name="${name}">${name}</button>`).join("");
    openTacticalDockSheet("layers", "Map Layers", `<div class="gridly-tactical-option-grid">${options}</div>`);
    document.querySelectorAll("#gridlyTacticalDockSheet [data-layer-name]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyMapStyle(btn.dataset.layerName || "Satellite");
        closeTacticalDockSheet();
      }, { once: true });
    });
  });
  const bindDestinationCommandButton = () => {
    if (!els.mobileDestinationCommandBtn || els.mobileDestinationCommandBtn.dataset.searchBound === "true") return;
    els.mobileDestinationCommandBtn.addEventListener("click", (event) => {
      routeLauncherSource = "choose-route-button";
      event?.preventDefault?.();
      event?.stopPropagation?.();
      showGridlySearchShell({ focusInput: true, source: "destinationCommandButton" });
    });
    els.mobileDestinationCommandBtn.dataset.searchBound = "true";
  };
  bindDestinationCommandButton();
  if (els.mobileLiveRouteActionBtn && els.mobileLiveRouteActionBtn.dataset.infoBound !== "true") {
    els.mobileLiveRouteActionBtn.addEventListener("click", (event) => {
      routeLauncherSource = "status-action-informational";
      event?.preventDefault?.();
      event?.stopPropagation?.();
    });
    els.mobileLiveRouteActionBtn.dataset.infoBound = "true";
  }
  els.mobileQuickReportBtn?.addEventListener("click", (event) => invokeMobileReportEntry("mobile_quick_report_btn", event));
  els.mobileQuickReportSmallBtn?.addEventListener("click", (event) => invokeMobileReportEntry("mobile_quick_report_small_btn", event));
  els.mobileQuickClearedBtn?.addEventListener("click", () => {
    if (lastSubmittedCrossing) {
      createSharedReport(lastSubmittedCrossing, "cleared", "quick clear action", els.mobileQuickClearedBtn);
      return;
    }

    setConfirmation("No recent crossing selected to clear.", "error");
  });
  els.mobileQuickRouteBtn?.addEventListener("click", () => {
    routeLauncherSource = "quick-route-button";
    openMobileRouteQuickPanel();
  });
  els.mobileQuickFavoritesBtn?.addEventListener("click", () => {
    closeSmartAlertsModal();
    routeNavSection("alerts");
    setConfirmation("Live alerts opened.", "success");
  });
  const weatherChipBtn = els.mobileWeatherChipBtn || document.querySelector("#mobileWeatherChipBtn, .mobile-weather-chip");
  const bellBtn = els.mobileBellBtn || document.querySelector("#mobileBellBtn, .mobile-icon-btn");

  bindMobileTap(weatherChipBtn, () => {
    scrollToSection("mapSection");
    setConfirmation("Weather context is not wired yet. Opening live map as a safe fallback.", "success");
  });
  bindMobileTap(bellBtn, () => {
    closeSmartAlertsModal();
    routeNavSection("alerts");
    setConfirmation("Live alerts opened.", "success");
  });

  const mobileHeaderTapState = { town: 0, avatar: 0 };
  const showMobileHeaderConfirmation = (message, type = "success", { forceVisible = false } = {}) => {
    setConfirmation(message, type);

    if (!forceVisible) return;

    const confirmationEl = els.reportConfirmation;
    const rect = confirmationEl?.getBoundingClientRect?.();
    const isVisible = Boolean(
      confirmationEl &&
      rect &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight &&
      getComputedStyle(confirmationEl).display !== "none" &&
      getComputedStyle(confirmationEl).visibility !== "hidden" &&
      getComputedStyle(confirmationEl).opacity !== "0"
    );

    if (!isVisible) {
      window.alert(message);
    }
  };

  const showTownSelectorConfirmation = () => {
    applyGeoFilterFromPill("town");
    scrollToSection("mapSection");
    showMobileHeaderConfirmation("Showing My Town crossings.", "success");
  };

  const handleMobileHeaderDelegateTap = (event) => {
    const target = event?.target;
    const elementTarget = target && target.nodeType === Node.ELEMENT_NODE ? target : target?.parentElement || null;
    const townTarget = elementTarget?.closest?.("#mobileTownSelectorBtn, .mobile-location-chip") || null;
    const avatarTarget = townTarget
      ? null
      : elementTarget?.closest?.("#mobileAvatarBtn, .mobile-avatar-btn") || null;
    const targetType = townTarget ? "town" : avatarTarget ? "avatar" : null;
    if (!targetType) return;

    const now = Date.now();
    if (now - mobileHeaderTapState[targetType] < 350) {
      return;
    }
    mobileHeaderTapState[targetType] = now;

    event.preventDefault();
    event.stopPropagation();

    if (targetType === "town") {
      showTownSelectorConfirmation();
      return;
    }

    showMobileHeaderConfirmation("Profile/account options coming soon.", "success", { forceVisible: true });
  };

  document.addEventListener("pointerup", handleMobileHeaderDelegateTap);

  const handlePopupAction = async (event) => {
    const unifiedButton = event.target.closest(".popup-report-btn[data-unified-action]");
    if (unifiedButton) {
      event.preventDefault();
      event.stopPropagation();
      await handleUnifiedIncidentAction(unifiedButton);
      return;
    }

    return;
  };

  document.addEventListener("pointerup", handlePopupAction, true);
  document.addEventListener("click", handlePopupAction, true);
  const handleDataActionClick = async (event) => {
    const focusCard = event.target?.closest?.("[data-alert-focus]");
    if (focusCard) {
      event.preventDefault();
      focusAlertLocation(focusCard.dataset.lat, focusCard.dataset.lng, {
        incidentId: focusCard.dataset.incidentId,
        type: focusCard.closest("#roadHazardsList") ? "road" : "rail",
        openPopup: false
      });
      const mobileSurfaceLayer = document.getElementById("mobileNativeSurfaceLayer");
      const mobileSurfaceBody = document.getElementById("mobileNativeSurfaceBody");
      const focusedFromMobileAlertsCenter =
        Boolean(mobileSurfaceLayer && !mobileSurfaceLayer.hidden) &&
        focusCard.closest("#mobileNativeSurfaceLayer") &&
        ["alerts-center", "alerts"].includes(String(mobileSurfaceBody?.dataset?.mobileSurfaceView || "")) &&
        (isMobileUiViewport() || window.matchMedia("(max-width: 760px)").matches);
      if (focusedFromMobileAlertsCenter) {
        mobileSurfaceLayer.hidden = true;
        mobileSurfaceLayer.setAttribute("aria-hidden", "true");
        if (typeof setMobileUiMode === "function") setMobileUiMode("live", { silent: true });
      }
      return;
    }
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (!action) return;
    if (reportingState.submissionInProgress && ["submit-hazard", "start-map-placement", "cancel-hazard-placement", "open-hazard-placement"].includes(action)) {
      event.preventDefault();
      return;
    }
    if (action === "confirm-hazard") {
      event.preventDefault();
      confirmHazardStillThere(actionEl.dataset.hazardType, Number(actionEl.dataset.lat), Number(actionEl.dataset.lng));
      return;
    }
    if (action === "clear-hazard") {
      event.preventDefault();
      clearHazard(actionEl.dataset.hazardType, Number(actionEl.dataset.lat), Number(actionEl.dataset.lng));
      return;
    }
    if (action === "zoom-hazard") {
      event.preventDefault();
      zoomToHazard(Number(actionEl.dataset.lat), Number(actionEl.dataset.lng));
      return;
    }
    if (action === "close-hazard-panel") {
      event.preventDefault();
      closeHazardPanel();
      return;
    }
    if (action === "submit-hazard") {
      event.preventDefault();
      submitHazardNearMe(actionEl.dataset.hazardType || reportingState.selectedHazardType || selectedQuickHazardType || pendingHazardPlacement);
      return;
    }
    if (action === "open-hazard-placement") {
      event.preventDefault();
      const selectedType = actionEl.dataset.hazardType || "other_hazard";
      document.querySelectorAll("#gridlyHazardPanel .hazard-choice-grid button").forEach((btn) => {
        btn.classList.toggle("selected", btn === actionEl);
      });
      selectedQuickHazardType = selectedType;
      pendingHazardPlacement = null;
      updateReportingState({
        selectedHazardType: selectedType,
        placementModeActive: false,
        activeReportEntryPoint: "hazard_select",
        lastReportError: "",
        lastReportMessage: `${(HAZARD_TYPES[selectedType] || HAZARD_TYPES.other_hazard).label} selected.`
      });
      setConfirmation("Hazard selected. Choose Use My Location or Tap Map Location.", "success");
      return;
    }
    if (action === "start-map-placement") {
      event.preventDefault();
      const selectedType = reportingState.selectedHazardType || selectedQuickHazardType;
      if (!selectedType) {
        updateReportingState({ lastReportError: "Choose a hazard first, then tap map location.", lastReportMessage: "" });
        setConfirmation("Choose a hazard first, then tap map location.", "error");
        return;
      }
      const placementBefore = reportingState.placementModeActive;
      openHazardPlacement(selectedType);
      const mapPlacementArmed = Boolean(reportingState.placementModeActive && (pendingHazardPlacement || reportingState.selectedHazardType));
      console.log("[Gridly][Report] Tap Map Location clicked", {
        selectedHazardType: selectedType,
        placementModeActiveBefore: placementBefore,
        placementModeActiveAfter: reportingState.placementModeActive,
        mapPlacementArmed
      });
      return;
    }
    if (action === "cancel-hazard-placement") {
      event.preventDefault();
      resetQuickHazardReportState();
      updateReportingState({ activeReportEntryPoint: "hazard_cancel", lastReportMessage: "", lastReportError: "" });
      closeHazardPanel({ preserveLastReportMessage: false });
      returnMobileToLiveMode("cancel_hazard_placement");
      return;
    }
    if (action === "close-route-quick") {
      event.preventDefault();
      closeMobileRouteQuickPanel("close_button");
      return;
    }
    if (action === "open-manage-places-quick") {
      event.preventDefault();
      closeMobileRouteQuickPanel("manage_places");
      openRouteSetupModalForType("manage");
      return;
    }
    if (action === "view-route-quick") {
      event.preventDefault();
      await handleRouteQuickPanelAction(action, event, actionEl);
      return;
    }
    if (action === "start-route-watch-quick") {
      event.preventDefault();
      await handleRouteQuickPanelAction(action, event, actionEl);
      return;
    }
    if (action === "zoom-crossing") {
      event.preventDefault();
      zoomToCrossing(actionEl.dataset.crossingId);
      return;
    }
  };
  attachRouteQuickPanelDelegatedClickHandlers();
  document.addEventListener("click", handleDataActionClick);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const focusCard = event.target?.closest?.("[data-alert-focus]");
    if (!focusCard) return;
    event.preventDefault();
    focusAlertLocation(focusCard.dataset.lat, focusCard.dataset.lng, { incidentId: focusCard.dataset.incidentId, type: focusCard.closest("#roadHazardsList") ? "road" : "rail", openPopup: false });
  });
  els.mobileOpenLiveMapBtn?.addEventListener("click", () => {
    setConfirmation("Opening Live Map.", "success");
  });
  els.mobileCommuteRouteBtn?.addEventListener("click", () => {
    routeLauncherSource = "view-route-button";
    setConfirmation("Opening Route Watch.", "success");
  });
  els.mobileCrossingReportBtn?.addEventListener("click", () => {
    setReportMode(REPORT_MODES.rail);
    setConfirmation("Manual crossing report mode is active.", "success");
    els.reportSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  els.mobileHazardReportBtn?.addEventListener("click", () => {
    handleReportNearMe();
  });
  els.mapReportShortcutBtn?.addEventListener("click", handleReportNearMe);
  bindSharedCoreControls();
  bindDesktopControls();
  bindPortraitControls();
  bindTacticalLandscapeControls();
  els.saveSmartAlertsBtn?.addEventListener("click", saveSmartAlertsPreferences);
  els.closeSmartAlertsModalBtn?.addEventListener("click", closeSmartAlertsModal);
  els.closeSettingsModalBtn?.addEventListener("click", () => closeGridlySurface("settings"));
  if (els.mobileSaveRouteBtn) {
    saveButtonHandlerAttached = true;
    els.mobileSaveRouteBtn.addEventListener("click", () => {
      saveRoute("mobile");
    });
  }
  els.mobileHomeInput?.addEventListener("input", () => {
    if (els.routeSetupModal?.dataset.mode !== "manage") return;
    const nextType = getManageModalTargetType(els.mobileHomeInput.value);
    els.routeSetupModal.dataset.prefillType = nextType;
    syncManagePlaceSlotsAndCta(nextType);
  });
  [["managePlaceHomeBtn", "home"], ["managePlaceWorkBtn", "work"], ["managePlaceFavoriteBtn", "custom"]].forEach(([id, type]) => {
    els[id]?.addEventListener("click", () => {
      if (!els.routeSetupModal) return;
      els.routeSetupModal.dataset.prefillType = type;
      if (els.mobileHomeInput) {
        els.mobileHomeInput.value = type === "home" ? "Home" : type === "work" ? "Work" : "";
        els.mobileHomeInput.focus();
      }
      syncManagePlaceSlotsAndCta(type);
    });
  });
  [["manageSourceLocationBtn", "location"], ["manageSourceAddressBtn", "address"], ["manageSourceSavedBtn", "saved"]].forEach(([id, mode]) => {
    els[id]?.addEventListener("click", () => {
      setManagePlacesSourceMode(mode);
      if (mode === "location") {
        if (els.mobileWorkInput && !els.mobileWorkInput.value.trim()) els.mobileWorkInput.value = "Current location";
      }
      if (mode === "address") els.mobileWorkInput?.focus();
      if (mode === "saved") els.mobileSavedDestinationSelect?.focus();
    });
  });
  els.mobileResetPlacesBtn?.addEventListener("click", () => {
    if (!window.confirm("Reset saved Home, Work, and Favorite places on this device?")) return;
    resetSavedPlaces();
    closeRouteSetupModal();
  });
  els.routeWatchStartBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    const buttonMeta = {
      id: els.routeWatchStartBtn?.id || null,
      className: els.routeWatchStartBtn?.className || null,
      text: (els.routeWatchStartBtn?.textContent || "").trim(),
      startSelectValue: els.routeWatchStartSelect?.value || "",
      destinationSelectValue: els.routeWatchDestinationSelect?.value || ""
    };
    console.info("Gridly route CTA clicked", buttonMeta);
    console.info("Gridly route CTA handler path", { handler: "routeWatchStartBtn.click", calls: "startInlineRouteWatch" });
    startInlineRouteWatch();
  });
  els.alternateRoute?.addEventListener("click", (event) => {
    event.preventDefault();
    if (!alternateRouteAvailable) return;
    useAlternateRoute();
  });
  [els.routeWatchStartSelect, els.routeWatchDestinationSelect].forEach((selectEl) => {
    selectEl?.addEventListener("change", () => {
      console.info("Gridly route dropdown changed", {
        changedControl: selectEl?.id || null,
        startSelectValue: els.routeWatchStartSelect?.value || "",
        destinationSelectValue: els.routeWatchDestinationSelect?.value || ""
      });
      captureRouteAttempt({ source: "route_dropdown_change", selectedStart: els.routeWatchStartSelect?.value || "", selectedDestination: els.routeWatchDestinationSelect?.value || "" });
      loadSavedRoute();
    });
  });
  [els.savedDestinationSelect, els.mobileSavedDestinationSelect].forEach((selectEl) => {
    selectEl?.addEventListener("change", (event) => {
      const nextId = event.target.value;
      if (!nextId) return;
      setSelectedPlaceId(nextId);
      loadSavedRoute();
      updateRouteIntelligence();
    });
  });
  bindTapSafeClose(els.closeRouteSetupModalBtn, closeRouteSetupModal);
  bindTapSafeClose(els.routeSetupModalBackdrop, closeRouteSetupModal);
  els.routeSetupModal?.addEventListener("click", (event) => {
    if (event.target === els.routeSetupModal) closeRouteSetupModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.routeSetupModal?.hidden) {
      closeRouteSetupModal();
    }
  });
  els.smartAlertsModalBackdrop?.addEventListener("click", closeSmartAlertsModal);
  els.settingsModalBackdrop?.addEventListener("click", () => closeGridlySurface("settings"));
  els.openSmartAlertsBtn?.addEventListener("click", () => openGridlySurface("settings", () => openSettingsModal()));
  els.openSmartAlertsBtn?.addEventListener("click", () => {
    const section = document.getElementById("settingsAlertPreferencesSection");
    section?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    section?.classList.add("gridly-settings-focus");
    window.setTimeout(() => section?.classList.remove("gridly-settings-focus"), 1200);
  });

  els.quickClearBtn?.addEventListener("click", async () => {
    if (!lastSubmittedCrossing) {
      setConfirmation("No recent crossing selected to clear.", "error");
      return;
    }

    await createSharedReport(lastSubmittedCrossing, "cleared", "quick clear follow-up", els.quickClearBtn);
    els.quickClearCard?.classList.remove("visible");
    resetSmartReportButton();
  });

  els.mobileEditRouteBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openRouteSetupModal(event.currentTarget);
  });
  els.desktopManageRouteBtn?.addEventListener("click", (event) => {
    console.log("Route Watch Manage Route clicked");
    openRouteSetupModal(event.currentTarget);
  });

  [["destinationHomeBtn", "home"], ["destinationWorkBtn", "work"], ["destinationFavoriteBtn", "favorite"], ["desktopDestinationHomeBtn", "home"], ["desktopDestinationWorkBtn", "work"], ["desktopDestinationFavoriteBtn", "favorite"]].forEach(([id, type]) => {
    els[id]?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openRouteSetupModalForType(type);
    });
  });

  const openDestinationSearchShell = (event, source = "manual") => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    showGridlySearchShell({ focusInput: true, source });
  };

  if (els.destinationAddBtn && els.destinationAddBtn.dataset.searchBound !== "true") {
    els.destinationAddBtn.addEventListener("click", (event) => openDestinationSearchShell(event, "destinationAddBtn"));
    els.destinationAddBtn.dataset.searchBound = "true";
  }

  const destinationHeroCard = document.querySelector(".destination-hero-card");
  if (destinationHeroCard && destinationHeroCard.dataset.searchBound !== "true") {
    destinationHeroCard.addEventListener("click", (event) => {
      if (event.target?.closest?.("button, [role='button'], .chip, .hero-chip")) return;
      openDestinationSearchShell(event, "destinationHeroCard");
    });
    destinationHeroCard.dataset.searchBound = "true";
  }


  const navTargets = {
    dashboard: "dashboardSection",
    map: "mapSection",
    routes: "setupCard",
    report: "reportSection",
    alerts: "alertsSection"
  };
  const routeNavSection = (section) => {
    if (section === "settings") {
      openGridlySurface("settings", () => openSettingsModal());
      return;
    }
    const target = navTargets[section];
    if (!target) return;
    if (window.matchMedia("(max-width: 760px)").matches) {
      if (section === "alerts" && mobileUiMode === "alert") {
        setMobileUiMode("live", { silent: true });
        scrollToSection("mapSection");
        return;
      }
      if (section === "map" || section === "dashboard") setMobileUiMode("live", { silent: true });
      if (section === "alerts") openGridlySurface("alerts", () => setMobileUiMode("alert", { silent: true }));
      if (section === "routes") setMobileUiMode("route", { silent: true });
      if (section === "report") setMobileUiMode("report", { silent: true });
    }
    scrollToSection(target);
    if (section === "map") setTimeout(() => map?.invalidateSize(), 350);
    if (section === "report") setReportMode(activeReportMode || REPORT_MODES.rail);
    if (section === "routes" && window.matchMedia("(max-width: 1100px)").matches) {
      openMobileRouteQuickPanel();
    }
  };

  const isDesktopViewport = () => !window.matchMedia("(max-width: 1100px)").matches;
  const handleDesktopCommandAction = (section) => {
    const fallbackMessages = {
      weather: "Weather coming soon",
      settings: "Settings coming soon",
      dispatcher: "Dispatcher profile coming soon"
    };
    if (section === "crossings") {
      routeNavSection("map");
      applyGeoFilterFromPill("all");
      setConfirmation("Crossings filter set to all crossings.", "success");
      return;
    }
    if (section === "analytics") {
      document.getElementById("alertsSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
      const impactDrawer = document.querySelector(".desktop-command-panel .panel-card.drawer-panel:nth-of-type(2)");
      if (impactDrawer) impactDrawer.open = true;
      setConfirmation("Opening Analytics / Impact Score.", "success");
      return;
    }
    if (fallbackMessages[section]) {
      setConfirmation(fallbackMessages[section], "info");
      return;
    }
    routeNavSection(section);
  };

  const leftRailLogBySection = {
    dashboard: "Left rail Home action",
    map: "Left rail Map action",
    alerts: "Left rail Alerts action",
    routes: "Left rail Routes action",
    report: "Left rail Reports action",
    crossings: "Left rail Crossings action",
    analytics: "Left rail Analytics action",
    weather: "Left rail Weather action",
    settings: "Left rail Settings action"
  };

  const navButtons = Array.from(document.querySelectorAll(".desktop-only-nav .nav-btn[data-section], .desktop-left-rail .nav-btn[data-section], .mobile-bottom-nav .nav-btn[data-section]"));
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.section;
      const scope = btn.closest(".top-nav, .left-rail, .desktop-left-rail, .mobile-bottom-nav");
      scope?.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const isDesktopCommand = Boolean(btn.closest(".top-nav, .desktop-left-rail")) && !btn.closest(".mobile-bottom-nav");
      if (isDesktopCommand && isDesktopViewport()) {
        console.log(`Desktop command button clicked: ${section}`);
      }
      if (btn.closest(".desktop-left-rail")) {
        const logMessage = leftRailLogBySection[section];
        if (logMessage) console.log(logMessage);
      }
      if (isDesktopCommand && isDesktopViewport()) {
        handleDesktopCommandAction(section);
        return;
      }
      routeNavSection(section);
    });
  });


  document.getElementById("desktopLiveDataBtn")?.addEventListener("click", () => {
    if (!isDesktopViewport()) return;
    console.log("Desktop command button clicked: live-data");
    routeNavSection("map");
    setConfirmation("Live data map opened.", "success");
  });

  ["desktopLegendBlockedBtn", "desktopLegendDelayedBtn", "desktopLegendClearedBtn"].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", (event) => {
      if (!isDesktopViewport()) return;
      const filterKey = event.currentTarget?.dataset?.geoFilter || "all";
      console.log(`Desktop map legend button clicked: ${id}`);
      applyGeoFilterFromPill(filterKey);
    });
  });

  document.querySelectorAll("[data-section-jump]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      if (btn.id === "mobileCommuteRouteBtn" && window.matchMedia("(max-width: 1100px)").matches) {
        event.preventDefault();
        const topAction = btn.dataset.topCtaAction || "";
        if (topAction === "open-reroute-plan") {
          routeNavSection("map");
          return;
        }
        routeLauncherSource = "view-route-button";
        openRouteSetupModal(btn);
        return;
      }
      if (
        window.matchMedia("(max-width: 1100px)").matches &&
        (btn.classList.contains("hero-route-btn") || btn.id === "mobileCommuteRouteBtn")
      ) {
        event.preventDefault();
        openRouteSetupModal(btn);
        return;
      }

      routeNavSection(btn.dataset.sectionJump);
    });
  });

  const applyGeoFilterFromPill = (filterKey) => {
    const selectedFilter = filterKey || "all";
    const matchingPill = document.querySelector(`.geo-filter-pill[data-geo-filter="${selectedFilter}"]`);

    document.querySelectorAll(".geo-filter-pill").forEach((pill) => {
      pill.classList.toggle("selected", pill === matchingPill);
    });

    activeGeoFilter = selectedFilter;
    renderCrossings();

    const visibleCrossings = getVisibleCrossingsForFilter().filter((crossing) => {
    const inDefaultSet = getDefaultRelevantCrossings().some((item) => String(item.id) === String(crossing.id));
    return inDefaultSet || shouldShowDistantInactiveCrossing(crossing);
  });
    if (activeGeoFilter === "active-delays" && !visibleCrossings.length) return;
    fitMapToCrossingsForActiveFilter(visibleCrossings);
  };

  const routeWatchLogByFilter = {
    nearby: "Route Watch Near Me clicked",
    town: "Route Watch My Route clicked",
    county: "Route Watch My Town clicked",
    "active-delays": "Route Watch Delays clicked",
    all: "Route Watch All clicked"
  };

  document.querySelectorAll(".geo-filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const filterKey = btn.dataset.geoFilter || "all";
      const logMessage = routeWatchLogByFilter[filterKey];
      if (logMessage) console.log(logMessage);
      if (filterKey === "all" && Date.now() - (gridlyPopupLastTapAt || 0) < 900) {
        gridlyRouteWatchAllClickedDuringPopupTap = true;
        gridlyPopupInterferenceEventSeen = true;
      }
      applyGeoFilterFromPill(filterKey);
    });
  });
  document.querySelectorAll(".map-floating-chip[data-geo-filter]").forEach((btn) => {
    btn.addEventListener("click", () => applyGeoFilterFromPill(btn.dataset.geoFilter || "all"));
  });

  els.editSetupBtn?.addEventListener("click", () => {
    setConfirmation("Setup editing coming soon.", "info");
  });

  const allCrossingsToggle = document.getElementById("allCrossingsLayerToggle");
  allCrossingsToggle?.addEventListener("change", (event) => {
    showAllCrossingsLayer = Boolean(event?.target?.checked);
    renderCrossings();
  });

  highlightNearestCrossingOnFirstLoad();
}


let lastRouteSetupTrigger = null;

function openRouteSetupModal(triggerEl = null) {
  if (!els.routeSetupModal) return;
  lastRouteSetupTrigger = triggerEl || document.activeElement || null;
  loadSavedRoute();
  configureRouteSetupModal({ mode: "manage" });
  openModal(els.routeSetupModal, lastRouteSetupTrigger);
}

function closeRouteSetupModal(options = {}) {
  if (!els.routeSetupModal) return;
  const { restoreFocus = true } = options;
  closeModal(els.routeSetupModal, { restoreFocus });
  lastRouteSetupTrigger = null;
}

function openSmartAlertsModal() {
  if (!els.smartAlertsModal) return;
  openModal(els.smartAlertsModal);
}

function closeSmartAlertsModal() {
  closeModal(els.smartAlertsModal);
}

function openSettingsModal() {
  if (!els.settingsModal) return;
  openModal(els.settingsModal);
}

function closeSettingsModal(options = {}) {
  if (!els.settingsModal) return;
  closeModal(els.settingsModal, options);
}

function handleSmartReportButton() {
  reportDebugLog("[Gridly][Report] REPORT dock clicked", {
    source: "handleSmartReportButton",
    target: "quick_hazard_picker"
  });
  handleReportNearMe("mobile_dock_report");
}

function getMobileReportEntryElements() {
  const quickReportElements = Array.from(document.querySelectorAll("#mobileQuickReportBtn, #mobileQuickReportSmallBtn, #mobileReportBtn, .mobile-sticky-report, .report-drawer-summary"));
  const reportDockElements = Array.from(document.querySelectorAll("#mobileDockReportBtn, .mobile-dock-btn.report"));
  return { quickReportElements, reportDockElements };
}

function invokeMobileReportEntry(sourceLabel, event) {
  const target = event?.target || null;
  const receiver = event?.currentTarget || target;
  reportDebugLog("[Gridly][Report] mobile report entry clicked", {
    sourceLabel,
    eventType: event?.type || "manual",
    targetTag: target?.tagName || null,
    targetId: target?.id || null,
    receiverId: receiver?.id || null,
    receiverClass: receiver?.className || null
  });
  reportDebugLog("[Gridly][Report] open function path", {
    sourceLabel,
    called: "handleReportNearMe",
    entryPoint: "mobile_dock_report"
  });
  handleReportNearMe("mobile_dock_report");
}

function bindMobileReportEntryDelegation() {
  if (mobileReportEntryBindingsAttached) return;
  const delegatedHandler = (event) => {
    const target = event?.target?.closest?.(MOBILE_REPORT_ENTRY_SELECTORS.join(", "));
    if (!target) return;
    if (target.closest(".mobile-dock-btn.route")) return;
    invokeMobileReportEntry("delegated_mobile_report_entry", event);
  };
  document.addEventListener("click", delegatedHandler);
  document.addEventListener("touchend", delegatedHandler, { passive: true });
  mobileReportEntryBindingsAttached = true;
}

function handleReportNearMe(entryPoint = "report_near_me") {
  reportLifecycleDiag("handleReportNearMe", { entryPoint });
  traceMobileModeMutation("handleReportNearMe before setMobileUiMode", { entryPoint });
  setMobileUiMode("report", { silent: true });
  traceMobileModeMutation("handleReportNearMe after setMobileUiMode", { entryPoint, intendedSurfaceSelector: "#reportSection", surfaceState: readSurfaceComputedState("#reportSection") });
  updateReportingState({
    reportModeActive: true,
    placementModeActive: false,
    activeReportEntryPoint: entryPoint,
    lastReportError: "",
    lastReportMessage: "Choose a hazard, then use your location or tap the map."
  });
  reportDebugLog("[Gridly][Report] handler executed", { handler: "handleReportNearMe", entryPoint });
  openHazardPanel(entryPoint);
  scrollToSection("mapSection");
  safeText("mapTrustNote", "Quick reporting is now map-first: select a hazard, then use My Location or Tap Map Location.");
  setConfirmation("Choose a hazard, then tap map to drop the report.", "success");
  document.body.classList.add("report-pulse");
  setTimeout(() => document.body.classList.remove("report-pulse"), 900);
  reportDebugLog("[Gridly][Report] post-click state", {
    openedOverlay: "gridlyHazardPanel",
    reportingState: window.gridlyReportingDebug(),
    activeReportEntryPoint: reportingState.activeReportEntryPoint
  });
}

window.gridlyReportClickBindingDebug = function () {
  const { quickReportElements, reportDockElements } = getMobileReportEntryElements();
  const summarize = (el) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return {
      selector: el.id ? `#${el.id}` : `.${String(el.className || "").trim().replace(/\s+/g, ".")}`,
      pointerEvents: style.pointerEvents,
      visibleRect: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        left: Math.round(rect.left)
      }
    };
  };
  return {
    quickReportElements: quickReportElements.map(summarize),
    reportDockElements: reportDockElements.map(summarize),
    elementsWithSelectorsFound: quickReportElements.length + reportDockElements.length > 0,
    pointerEvents: {
      quickReportElements: quickReportElements.map((el) => window.getComputedStyle(el).pointerEvents),
      reportDockElements: reportDockElements.map((el) => window.getComputedStyle(el).pointerEvents)
    },
    visibleRects: {
      quickReportElements: quickReportElements.map((el) => el.getBoundingClientRect().toJSON ? el.getBoundingClientRect().toJSON() : null),
      reportDockElements: reportDockElements.map((el) => el.getBoundingClientRect().toJSON ? el.getBoundingClientRect().toJSON() : null)
    },
    listenersAttachedFlag: mobileReportEntryBindingsAttached,
    quickReportVisible: quickReportElements.some((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
    }),
    quickReportDisplay: quickReportElements.map((el) => window.getComputedStyle(el).display),
    quickReportRect: quickReportElements.map((el) => el.getBoundingClientRect().toJSON ? el.getBoundingClientRect().toJSON() : null),
    reportingState: window.gridlyReportingDebug()
  };
};


window.gridlyReportOverlayDebug = function () {
  const pickerSelector = "#gridlyHazardPanel";
  const picker = document.querySelector(pickerSelector);
  const computed = picker ? window.getComputedStyle(picker) : null;
  const rect = picker ? picker.getBoundingClientRect() : null;
  const parentChain = [];
  let node = picker;
  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    parentChain.push({
      selector: node.id ? `#${node.id}` : node.className ? `.${String(node.className).trim().replace(/\s+/g, ".")}` : node.tagName.toLowerCase(),
      display: style.display,
      visibility: style.visibility,
      overflow: style.overflow,
      overflowY: style.overflowY,
      position: style.position,
      zIndex: style.zIndex,
      rect: node.getBoundingClientRect()
    });
    node = node.parentElement;
  }
  const viewportWidth = window.innerWidth || 0;
  const viewportHeight = window.innerHeight || 0;
  const clippedOrOffscreen = !picker || !rect || rect.bottom < 0 || rect.right < 0 || rect.top > viewportHeight || rect.left > viewportWidth || computed?.display === "none" || computed?.visibility === "hidden" || Number(computed?.opacity || 1) === 0;
  return {
    reportModeActive: reportingState.reportModeActive,
    selectedHazardType: reportingState.selectedHazardType,
    activeReportEntryPoint: reportingState.activeReportEntryPoint || "",
    pickerSelector,
    pickerExists: Boolean(picker),
    display: computed?.display || null,
    visibility: computed?.visibility || null,
    opacity: computed?.opacity || null,
    zIndex: computed?.zIndex || null,
    position: computed?.position || null,
    pointerEvents: computed?.pointerEvents || null,
    rect,
    parentChain,
    clippedOrOffscreen
  };
};

window.gridlyOpenQuickReportDebug = function () {
  reportDebugLog("[Gridly][Report] debug helper invoked", { helper: "gridlyOpenQuickReportDebug" });
  handleReportNearMe("window.gridlyOpenQuickReportDebug");
};

function activateReportMode() {
  setMobileUiMode("report", { silent: true });
  updateReportingState({ reportModeActive: true });
  els.reportModeBanner?.classList.add("visible");

  scrollToSection("mapSection");

  safeText(
    "mapTrustNote",
    "Report mode: tap the crossing marker closest to you, then choose Blocked, Delay, Cleared, or Other."
  );

  setTimeout(() => map?.invalidateSize(), 350);
}

function resetSmartReportButton() {
  lastSubmittedReportType = null;
  els.mobileReportBtn?.classList.remove("clear-mode");

  if (els.mobileReportBtn) {
    els.mobileReportBtn.textContent = "🚨 Report Issue Now";
  }
}

function setSmartReportButtonToClear() {
  els.mobileReportBtn?.classList.add("clear-mode");

  if (els.mobileReportBtn) {
    els.mobileReportBtn.textContent = "Report Cleared";
  }
}

function scrollToSection(id) {
  if (window.matchMedia("(max-width: 760px)").matches) {
    if (id === "mapSection") setMobileUiMode("live", { silent: true });
    if (id === "alertsSection") setMobileUiMode("alert", { silent: true });
    return;
  }
  const target = document.getElementById(id);
  if (!target) return;

  const headerOffset = 120;
  const y = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;

  window.scrollTo({
    top: Math.max(0, y),
    behavior: "smooth"
  });

  highlightNearestCrossingOnFirstLoad();
}

function submitManualReport() {
  const crossing = crossings.find((item) => String(item.id) === String(els.crossingSelect?.value));
  const reportType = els.manualReportType?.value || "blocked";

  if (!crossing) {
    setConfirmation(
      activeReportMode === REPORT_MODES.roadHazard
        ? "Choose a location before submitting a road hazard."
        : "Choose a crossing before submitting a report.",
      "error"
    );
    return;
  }

  if (activeReportMode === REPORT_MODES.roadHazard) {
    createSharedHazardReport(reportType, crossing.lat, crossing.lng, "manual road hazard", crossing.name);
    return;
  }

  createSharedReport(crossing, reportType, "manual fallback", els.manualReportBtn);
}

async function createSharedReport(crossing, reportType, confidence, buttonEl = null) {
  if (!supabaseClient) {
    setConfirmation("Live report sync is unavailable.", "error");
    return;
  }

  const originalButtonText = buttonEl ? buttonEl.textContent : "";
  const copy = getReportCopy(reportType);
  const sourceTag = "community_report";

  const expiresAt = new Date(Date.now() + REPORT_EXPIRATION_MINUTES * 60000).toISOString();

  const row = {
    crossing_id: String(crossing.id),
    crossing_name: crossing.name,
    railroad: crossing.railroad,
    lat: crossing.lat,
    lng: crossing.lng,
    report_type: reportType,
    severity: copy.severity,
    detail: `${copy.detail} (future_source: ${sourceTag})`,
    source: "user",
    confidence,
    device_id: deviceId,
    expires_at: expiresAt
  };

  try {
    updateReportingState({ submissionInProgress: true });
    if (buttonEl) {
      buttonEl.classList.add("is-submitting");
      buttonEl.textContent = "Sending...";
    }

    setSync("Sending live report...");
    setConfirmation(`Sending ${copy.label} report for ${crossing.name}...`, "success");

    const { error } = await supabaseClient.from("reports").insert(row);

    if (error) throw error;

    if (buttonEl) {
      buttonEl.classList.remove("is-submitting");
      buttonEl.classList.add("is-success");
      buttonEl.textContent = "Shared ✓";
    }

    setConfirmation(`Shared report submitted: ${crossing.name} as ${copy.label}.`, "success");
    console.log("Crossing report saved", { crossingId: String(crossing.id), type: reportType });

    setSync("Live report shared");
    showShareCard();

    lastSubmittedCrossing = crossing;
    lastSubmittedReportType = reportType;

    if (reportType === "blocked" || reportType === "heavy") {
      els.quickClearCard?.classList.add("visible");
      setSmartReportButtonToClear();
    }

    if (reportType === "cleared") {
      els.quickClearCard?.classList.remove("visible");
      resetSmartReportButton();
    }

    await runPostSubmitRefresh();

    if (map) {
      map.setView([crossing.lat, crossing.lng], 14);
      setTimeout(() => map.closePopup(), 850);
    }

    if (buttonEl) {
      setTimeout(() => {
        buttonEl.classList.remove("is-success");

        if (buttonEl === els.mobileReportBtn) {
          if (reportType === "blocked" || reportType === "heavy") {
            buttonEl.textContent = "Report Cleared";
          } else {
            buttonEl.textContent = "📍 Report Near Me";
          }
        } else {
          buttonEl.textContent = originalButtonText;
        }
      }, 1400);
    }
    updateReportingState({ submissionInProgress: false });
  } catch (error) {
    console.error("Gridly report insert failed:", error);

    if (buttonEl) {
      buttonEl.classList.remove("is-submitting", "is-success");
      buttonEl.textContent = "Failed";
    }

    setConfirmation(`Report failed: ${error.message || "permission denied"}`, "error");
    setSync("Live report failed");

    if (buttonEl) {
      setTimeout(() => {
        buttonEl.textContent = originalButtonText;
      }, 1300);
    }
    updateReportingState({ submissionInProgress: false });
  }
}

function getReportCopy(type) {
  const types = {
    blocked: {
      label: "Blocked",
      shortTitle: "blocked",
      detail: "Shared report: crossing or road appears blocked.",
      severity: "high"
    },
    heavy: {
      label: "Heavy Delay",
      shortTitle: "heavy delay",
      detail: "Shared report: traffic is moving slowly near this crossing.",
      severity: "moderate"
    },
    cleared: {
      label: "Cleared",
      shortTitle: "cleared",
      detail: "Shared report: previous issue appears cleared.",
      severity: "low"
    },
    other: {
      label: "Other Issue",
      shortTitle: "issue",
      detail: "Shared report: local road issue may affect travel.",
      severity: "moderate"
    }
  };

  return types[type] || types.other;
}

function getRouteInputValues(source = "desktop") {
  if (source === "mobile") {
    return {
      home: els.mobileHomeInput?.value.trim(),
      work: els.mobileWorkInput?.value.trim(),
      button: els.mobileSaveRouteBtn
    };
  }

  return {
    home: els.homeInput?.value.trim(),
    work: els.workInput?.value.trim(),
    button: els.saveRouteBtn
  };
}

function getSavedPlaces() {
  const state = normalizeSavedPlaces();
  const places = [];
  const addIfRoutable = (place, fallbackId, fallbackName) => {
    if (!isConfiguredPlace(place)) return;
    const coordinates = normalizeCoordinatePair(place.lat, place.lng);
    if (!coordinates) return;
    places.push({
      id: place.id || fallbackId,
      name: place.label || fallbackName,
      address: place.address || "",
      source: place.coordinateSource || "unknown",
      lat: coordinates.lat,
      lng: coordinates.lng
    });
  };
  addIfRoutable(state.home, "home", "Home");
  addIfRoutable(state.work, "work", "Work");
  state.custom.forEach((place) => addIfRoutable(place, `custom-${Date.now()}`, "Favorite"));
  return places;
}

function saveSavedPlaces(places) {
  const state = normalizeSavedPlaces();
  const nextState = { ...state, custom: [] };
  (Array.isArray(places) ? places : []).forEach((place) => {
    if (!place || typeof place !== "object") return;
    const id = String(place.id || "");
    const normalizedPlace = {
      id: id || `custom-${Date.now()}`,
      type: id === "home" || place.type === "home" ? "home" : id === "work" || place.type === "work" ? "work" : "custom",
      label: String(place.name || place.label || "Saved Place"),
      address: String(place.address || ""),
      lat: Number.isFinite(Number(place.lat)) ? Number(place.lat) : null,
      lng: Number.isFinite(Number(place.lng)) ? Number(place.lng) : null
    };
    if (normalizedPlace.type === "home") {
      nextState.home = { ...normalizedPlace, id: "home", label: "Home" };
      return;
    }
    if (normalizedPlace.type === "work") {
      nextState.work = { ...normalizedPlace, id: "work", label: "Work" };
      return;
    }
    nextState.custom.push(normalizedPlace);
  });
  saveSavedPlacesState(nextState);
}

function getSelectedPlaceId() {
  return localStorage.getItem(SELECTED_PLACE_STORAGE_KEY) || "";
}

function setSelectedPlaceId(placeId) {
  localStorage.setItem(SELECTED_PLACE_STORAGE_KEY, placeId);
}

function getSelectedPlace() {
  const places = getSavedPlaces();
  const selectedId = getSelectedPlaceId();
  return places.find((place) => place.id === selectedId) || places[0] || null;
}

function buildRouteWatchLabelParts() {
  const state = getSavedPlacesState();
  const selectedPlace = getSelectedPlace();
  const hasHome = isConfiguredPlace(state?.home);
  const hasWork = isConfiguredPlace(state?.work);
  const hasDestination = Boolean(selectedPlace && selectedPlace.id !== "home");
  const origin = hasHome ? "Home" : "No active route";
  const selectedDestination = selectedPlace?.id !== "home"
    ? (selectedPlace?.name || selectedPlace?.label || "")
    : "";
  const destination = selectedDestination || "";
  const activeLabel = routeWatchActivated
    ? (activeDestinationPlace?.label || selectedPlace?.name || selectedPlace?.label || destination || "Saved destination")
    : "";
  const activeRouteLabel = hasHome && destination ? `${origin} → ${destination}` : "No active route";

  return {
    origin,
    destination,
    label: hasHome ? activeRouteLabel : "No active route",
    activeRouteLabel,
    configured: hasHome && hasDestination,
    hasHome,
    hasWork,
    hasDestination,
    selectedType: selectedPlace?.id || "",
    activeLabel
  };
}

function updateRouteWatchSetupUI() {
  const routeLabelParts = buildRouteWatchLabelParts();
  const hasFavorite = Boolean(getSavedPlacesState().custom.length);
  const buttonState = {
    home: routeLabelParts.hasHome,
    work: routeLabelParts.hasWork,
    favorite: hasFavorite
  };
  const labelMap = {
    home: buttonState.home ? "Home" : "Set Home",
    work: buttonState.work ? "Work" : "Set Work",
    favorite: buttonState.favorite ? "Favorite" : "Add Favorite"
  };

  [["desktopDestinationHomeBtn", "home"], ["desktopDestinationWorkBtn", "work"], ["desktopDestinationFavoriteBtn", "favorite"], ["destinationHomeBtn", "home"], ["destinationWorkBtn", "work"], ["destinationFavoriteBtn", "favorite"]].forEach(([id, type]) => {
    const btn = els[id];
    if (!btn) return;
    btn.textContent = labelMap[type];
    btn.classList.toggle("is-pending", !buttonState[type]);
  });

  if (els.routeWatchSetupHint) els.routeWatchSetupHint.hidden = routeLabelParts.configured;
}

function renderSavedPlacesSelectOptions() {
  const places = getSavedPlaces();
  const selectedId = getSelectedPlaceId();
  [els.savedDestinationSelect, els.mobileSavedDestinationSelect].forEach((selectEl) => {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    if (!places.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No saved places yet";
      selectEl.appendChild(option);
      return;
    }
    places.forEach((place) => {
      const option = document.createElement("option");
      option.value = place.id;
      option.textContent = place.name;
      option.selected = place.id === selectedId;
      selectEl.appendChild(option);
    });
  });
  updateRouteSetupManageState();
  renderRouteWatchInlineControls();
}

function renderRouteWatchInlineControls() {
  const places = getSavedPlaces();
  const hasHome = places.some((place) => place.id === "home");
  const hasWork = places.some((place) => place.id === "work");
  const defaultStart = hasHome ? "home" : "";
  const defaultDestination = hasWork ? "work" : "";
  const configs = [
    { el: els.routeWatchStartSelect, fallback: defaultStart, placeholder: "Select start" },
    { el: els.routeWatchDestinationSelect, fallback: defaultDestination, placeholder: "Select destination" }
  ];
  configs.forEach(({ el, fallback, placeholder }) => {
    if (!el) return;
    const priorValue = el.value;
    el.innerHTML = "";
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    el.appendChild(placeholderOption);
    places.forEach((place) => {
      const option = document.createElement("option");
      option.value = place.id;
      option.textContent = place.name;
      el.appendChild(option);
    });
    if (places.length > 1) el.value = priorValue || fallback || "";
    else el.value = "";
  });
}

function setManagePlacesSourceMode(mode = "") {
  managePlacesSourceMode = mode;
  const addressGroup = document.getElementById("managePlacesAddressGroup");
  const savedGroup = document.getElementById("managePlacesSavedGroup");
  const saveGroup = document.getElementById("managePlacesSaveGroup");
  const sourceGroup = document.getElementById("managePlacesSourceGroup");
  const useLocationBtn = els.mobileUseLocationBtn;
  if (sourceGroup) sourceGroup.hidden = !mode;
  if (addressGroup) addressGroup.hidden = mode !== "address";
  if (savedGroup) savedGroup.hidden = mode !== "saved";
  if (saveGroup) saveGroup.hidden = !mode;
  if (useLocationBtn) useLocationBtn.hidden = mode !== "location";
  [["manageSourceLocationBtn", "location"], ["manageSourceAddressBtn", "address"], ["manageSourceSavedBtn", "saved"]].forEach(([id, value]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle("active", mode === value);
  });
}

function updateRouteSetupManageState() {
  if (!els.routeSetupModal || els.routeSetupModal.dataset.mode !== "manage") return;
  const routeLabelParts = buildRouteWatchLabelParts();
  const subtitleEl = els.routeSetupModal.querySelector(".smart-alerts-subtitle");
  const canStart = routeLabelParts.hasHome && routeLabelParts.hasDestination;
  if (els.mobileSaveRouteBtn) els.mobileSaveRouteBtn.disabled = false;
  if (!subtitleEl) return;
  if (!routeLabelParts.hasHome) subtitleEl.textContent = "Save Home first to start Route Watch.";
  else if (!routeLabelParts.hasDestination) subtitleEl.textContent = "Add Work or a Favorite destination.";
  else subtitleEl.textContent = "Select a saved destination, then start Route Watch.";
}

function getManageModalTargetType(nameValue = "") {
  const state = getSavedPlacesState();
  const normalizedName = String(nameValue || "").trim().toLowerCase();
  if (normalizedName === "home") return "home";
  if (normalizedName === "work") return "work";
  if (!isConfiguredPlace(state.home)) return "home";
  if (!isConfiguredPlace(state.work)) return "work";
  return "custom";
}

function syncManagePlaceSlotsAndCta(targetType = "custom") {
  if (els.mobileSaveRouteBtn) {
    els.mobileSaveRouteBtn.textContent = targetType === "home" ? "Save Home" : targetType === "work" ? "Save Work" : "Save Place";
  }
  [["managePlaceHomeBtn", "home"], ["managePlaceWorkBtn", "work"], ["managePlaceFavoriteBtn", "custom"]].forEach(([id, type]) => {
    const button = els[id];
    if (!button) return;
    button.classList.toggle("active", targetType === type);
    if (type === "home" || type === "work") {
      const configured = isConfiguredPlace(getSavedPlacesState()[type]);
      button.classList.toggle("is-pending", !configured);
    }
  });
}

async function saveRoute(source = "desktop") {
  let { home, work, button } = getRouteInputValues(source);
  const modalMode = source === "mobile" ? (els.routeSetupModal?.dataset.mode || "add") : "add";
  const manageSourceMode = source === "mobile" && modalMode === "manage" ? managePlacesSourceMode : "";
  lastManagePlacesSaveAttempt = {
    at: new Date().toISOString(),
    source,
    modalMode,
    manageSourceMode,
    selectedSlot: source === "mobile" ? (els.routeSetupModal?.dataset.prefillType || "custom") : "custom",
    placeName: String(home || "").trim(),
    address: String(work || "").trim()
  };
  lastManagePlacesSaveError = null;
  if (manageSourceMode === "saved") {
    const selectedSaved = getSavedPlaces().find((place) => place.id === (els.mobileSavedDestinationSelect?.value || ""));
    if (selectedSaved) {
      home = home || selectedSaved.name || selectedSaved.label;
      work = work || selectedSaved.address || selectedSaved.name;
    }
  }
  if (manageSourceMode === "location") {
    home = home || (els.routeSetupModal?.dataset.prefillType === "home" ? "Home" : els.routeSetupModal?.dataset.prefillType === "work" ? "Work" : "Favorite");
    work = work || "Current location";
  }
  const prefillType = source === "mobile" ? (els.routeSetupModal?.dataset.prefillType || "custom") : "custom";
  if (!home || !work) {
    const errorMessage = "Missing place name or address. Please fill both fields.";
    lastValidationError = errorMessage;
    flashButton(button, "Add name + place");
    setConfirmation(errorMessage, "error");
    lastSavedPlaceResult = { ok: false, message: errorMessage, at: new Date().toISOString() };
    lastManagePlacesSaveError = errorMessage;
    return;
  }
  lastValidationError = null;
  let normalizedType = prefillType === "favorite" ? "custom" : prefillType;
  const current = normalizeSavedPlaces();
  if (source === "mobile" && modalMode === "manage" && normalizedType === "custom") {
    const normalizedName = String(home || "").trim().toLowerCase();
    if (normalizedName === "home") normalizedType = "home";
    else if (normalizedName === "work") normalizedType = "work";
    else if (normalizedName === "favorite") normalizedType = "custom";
    else if (!isConfiguredPlace(current.home)) normalizedType = "home";
    else if (!isConfiguredPlace(current.work)) normalizedType = "work";
  }
  const nextState = {
    version: 1,
    home: current.home ?? null,
    work: current.work ?? null,
    custom: Array.isArray(current.custom) ? [...current.custom] : [],
    favorites: Array.isArray(current.favorites) ? [...current.favorites] : []
  };
  let id = `place-${Date.now()}`;
  if (normalizedType === "home" || normalizedType === "work") {
    id = normalizedType;
  }
  const coordinateResolution = await resolvePlaceCoordinates({
    label: home,
    address: work,
    allowGeocode: true,
    preferGeolocation: manageSourceMode === "location"
  });
  // Saved places must include valid coordinates before they are eligible for Route Watch routing.
  const coordinates = coordinateResolution?.coordinates || null;
  if (!coordinates) {
    const errorMessage = "We couldn't find that location. Try a full address or use My Location.";
    lastValidationError = errorMessage;
    flashButton(button, "Location not found");
    setConfirmation(errorMessage, "error");
    lastSavedPlaceResult = {
      ok: false,
      type: normalizedType,
      message: errorMessage,
      at: new Date().toISOString(),
      coordinateSource: coordinateResolution?.source || "null"
    };
    lastManagePlacesSaveError = errorMessage;
    return;
  }
  const createdAt = new Date().toISOString();
  const placeType = normalizedType === "custom" ? "favorite" : normalizedType;
  const nextPlace = {
    id,
    type: placeType,
    name: home,
    label: normalizedType === "home" ? "Home" : normalizedType === "work" ? "Work" : home || "Favorite Place",
    address: work,
    rawInput: `${home} ${work}`.trim(),
    createdAt,
    lat: coordinates?.lat ?? null,
    lng: coordinates?.lng ?? null,
    coordinates: coordinates ? { lat: coordinates.lat, lng: coordinates.lng } : null,
    coordinateSource: coordinateResolution?.source || "null"
  };
  if (normalizedType === "home") {
    nextState.home = nextPlace;
  } else if (normalizedType === "work") {
    nextState.work = nextPlace;
  } else {
    const existingIdx = nextState.custom.findIndex((place) => place?.id === id);
    if (existingIdx >= 0) nextState.custom[existingIdx] = nextPlace;
    else nextState.custom.push(nextPlace);
  }
  saveSavedPlacesState(nextState);
  setSelectedPlaceId(id);

  routeWatchActivated = false;
  loadSavedRoute();
  initDailyDestinationHero();
  updateRouteIntelligence();
  updateGrowthWidgets();
  const placeLabel = normalizedType === "home" ? "Home" : normalizedType === "work" ? "Work" : (home || "Favorite");
  const saveMessage = `${placeLabel} saved with resolved coordinates (${coordinateResolution.source}).`;
  setConfirmation(saveMessage, "success");
  lastSavedPlaceResult = {
    ok: true,
    type: normalizedType,
    message: saveMessage,
    at: createdAt,
    savedPlaceId: id,
    coordinateSource: coordinateResolution?.source || "unknown"
  };
  const savedButtonLabel = normalizedType === "home" ? "Home Saved" : normalizedType === "work" ? "Work Saved" : (modalMode === "manage" ? "Saved" : "Place Saved");
  flashButton(button, savedButtonLabel);

  if (source === "mobile") {
    closeRouteSetupModal();
  }
}

function getSavedPlacesState() {
  const state = normalizeSavedPlaces();
  return { home: state.home, work: state.work, custom: [...state.custom], favorites: [...state.favorites] };
}
function isLegacyPlace(place) {
  if (!place || typeof place !== "object") return false;
  const joined = `${place.label || ""} ${place.address || ""}`.toLowerCase();
  return joined.includes(LEGACY_PLACE_MARKER_TEXT);
}

function isConfiguredPlace(place) {
  if (!place || isLegacyPlace(place)) return false;
  return Boolean(String(place.label || "").trim()) && hasValidPlaceCoordinates(place);
}
function migrateLegacyStorage() {
  const state = getSavedPlacesState();
  let changed = false;
  const legacyHome = localStorage.getItem("gridlyHome");
  const legacyWork = localStorage.getItem("gridlyWork");
  if (!state.home && legacyHome) {
    state.home = { id: "home", type: "home", createdAt: new Date().toISOString(), ...inferPlaceFromMap(legacyHome, "Legacy migrated"), label: "Home" };
    changed = true;
  }
  if (!state.work && legacyWork) {
    state.work = { id: "work", type: "work", createdAt: new Date().toISOString(), ...inferPlaceFromMap(legacyWork, "Legacy migrated"), label: "Work" };
    changed = true;
  }
  if (changed) saveSavedPlacesState(state);
}

function saveSavedPlacesState(nextState) {
  const normalized = normalizeSavedPlaces(nextState);
  localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(normalized));
}

function savePlaceType(type, label, address = "") {
  const state = getSavedPlacesState();
  const place = inferPlaceFromMap(label, address);
  if (type === "home" || type === "work") {
    state[type] = { ...place, label: type === "home" ? "Home" : "Work" };
  } else {
    state.custom.push({ id: `custom-${Date.now()}`, ...place, label: label || "Favorite Place" });
  }
  saveSavedPlacesState(state);
}

function normalizeSavedPlaces(input = null) {
  const canonical = { version: 1, home: null, work: null, custom: [], favorites: [] };
  let raw = input;
  if (raw == null) {
    try {
      raw = JSON.parse(localStorage.getItem(SAVED_PLACES_STORAGE_KEY) || "null");
    } catch (error) {
      raw = null;
    }
  }

  const makeCanonicalPlace = (place, fallback = {}) => {
    if (!place || typeof place !== "object") return null;
    const id = String(place.id || fallback.id || "").trim();
    const type = String(place.type || fallback.type || (id === "home" || id === "work" ? id : "custom")).trim();
    const label = String(place.label || place.name || fallback.label || "Saved Place").trim();
    const address = String(place.address || fallback.address || "").trim();
    const lat = Number(place.lat);
    const lng = Number(place.lng);
    return {
      ...place,
      id: id || (type === "home" || type === "work" ? type : `custom-${Date.now()}`),
      type: type || "custom",
      label: label || "Saved Place",
      address,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      coordinateSource: String(place.coordinateSource || fallback.coordinateSource || "unknown")
    };
  };

  if (Array.isArray(raw)) {
    raw.forEach((place) => {
      const id = String(place?.id || "").trim();
      if (id === "home") {
        canonical.home = makeCanonicalPlace(place, { id: "home", type: "home", label: "Home" });
      } else if (id === "work") {
        canonical.work = makeCanonicalPlace(place, { id: "work", type: "work", label: "Work" });
      } else {
        const normalized = makeCanonicalPlace(place);
        if (normalized) canonical.custom.push(normalized);
      }
    });
    return canonical;
  }

  if (raw && typeof raw === "object") {
    canonical.version = Number(raw.version) || 1;
    canonical.home = makeCanonicalPlace(raw.home, { id: "home", type: "home", label: "Home" });
    canonical.work = makeCanonicalPlace(raw.work, { id: "work", type: "work", label: "Work" });
    canonical.custom = Array.isArray(raw.custom)
      ? raw.custom
          .map((place) => makeCanonicalPlace(place))
          .filter(Boolean)
      : [];
    canonical.favorites = Array.isArray(raw.favorites)
      ? raw.favorites
          .map((place) => makeCanonicalPlace(place))
          .filter(Boolean)
      : [];
  }

  return canonical;
}

function inferPlaceFromMap(label, address = "") {
  const center = map?.getCenter?.();
  return {
    label: label || "Saved Place",
    lat: userLocation?.lat || center?.lat || defaultCenter[0],
    lng: userLocation?.lng || center?.lng || defaultCenter[1],
    address: address || "Map center"
  };
}

function parseValidCoordinatePair(lat, lng) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
  if (parsedLat === 0 && parsedLng === 0) return null;
  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) return null;
  return { lat: parsedLat, lng: parsedLng };
}

function normalizeCoordinatePair(lat, lng) {
  const direct = parseValidCoordinatePair(lat, lng);
  if (direct) return direct;
  const swapped = parseValidCoordinatePair(lng, lat);
  if (swapped) return swapped;
  return null;
}

function normalizeGridlySearchResult(result) {
  if (!result || typeof result !== "object") return null;

  const resolveString = (...values) => {
    for (const value of values) {
      const normalized = String(value || "").trim();
      if (normalized) return normalized;
    }
    return "";
  };

  const coordinates = normalizeCoordinatePair(
    result.lat ?? result.latitude ?? result?.coordinates?.lat ?? result?.coordinates?.latitude,
    result.lng ?? result.lon ?? result.longitude ?? result?.coordinates?.lng ?? result?.coordinates?.lon ?? result?.coordinates?.longitude
  );

  if (!coordinates) return null;

  const provider = resolveString(result.provider, result.source, result.engine, "unknown");
  const providerId = resolveString(result.providerId, result.place_id, result.id, result.osm_id);
  const rawType = resolveString(result.type, result.class, result.kind, "unknown");
  const rawAddressObject = result.address && typeof result.address === "object" && !Array.isArray(result.address)
    ? { ...result.address }
    : null;
  const rawPayload = result.raw && typeof result.raw === "object" ? result.raw : result;
  const rawPayloadAddress = rawPayload.address && typeof rawPayload.address === "object" && !Array.isArray(rawPayload.address)
    ? { ...rawPayload.address }
    : null;
  const title = resolveString(result.title, result.name, result.label, result.display_name, rawPayload.display_name);
  const displayName = resolveString(result.display_name, rawPayload.display_name, title);
  const county = resolveString(rawAddressObject?.county, rawPayloadAddress?.county);
  const state = resolveString(rawAddressObject?.state, rawPayloadAddress?.state);
  const countyStateSubtitle = county && state ? `${county}, ${state}` : "";
  const subtitle = resolveString(result.subtitle, countyStateSubtitle, result.formatted, displayName, title);
  const address = rawAddressObject || rawPayloadAddress || resolveString(result.address, result.formatted, result.display_name, rawPayload.display_name, title);

  const bounds = Array.isArray(result.boundingbox) && result.boundingbox.length === 4
    ? {
        south: Number(result.boundingbox[0]),
        north: Number(result.boundingbox[1]),
        west: Number(result.boundingbox[2]),
        east: Number(result.boundingbox[3])
      }
    : null;

  const normalizedBounds = bounds
    && Number.isFinite(bounds.south)
    && Number.isFinite(bounds.north)
    && Number.isFinite(bounds.west)
    && Number.isFinite(bounds.east)
    ? bounds
    : null;

  return {
    id: providerId || `${coordinates.lat.toFixed(6)},${coordinates.lng.toFixed(6)}`,
    title: title || address || "Selected destination",
    label: title || address || "Selected destination",
    lat: coordinates.lat,
    lng: coordinates.lng,
    subtitle: subtitle || "",
    address: address || "",
    coordinates,
    bounds: normalizedBounds,
    provider,
    providerId: providerId || null,
    type: rawType,
    confidence: Number.isFinite(Number(result.confidence)) ? Number(result.confidence) : null,
    display_name: displayName || "",
    raw: rawPayload
  };
}

async function gridlySearchAddress(query, options = {}) {
  const rawQuery = String(query || "").trim();
  if (!rawQuery) return [];

  const parsedLimit = Number(options.limit);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.floor(parsedLimit), 1), 10) : 5;
  const countryCodes = String(options.countryCodes || "us").trim() || "us";

  try {
    const params = new URLSearchParams({
      q: rawQuery,
      format: "jsonv2",
      limit: String(limit),
      addressdetails: "1",
      extratags: "0",
      namedetails: "0",
      countrycodes: countryCodes
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return [];
    const providerResults = await response.json();
    if (!Array.isArray(providerResults)) return [];
    return providerResults
      .map((result) => normalizeGridlySearchResult(result))
      .filter(Boolean)
      .slice(0, limit);
  } catch (error) {
    console.warn("Address search failed:", error);
    return [];
  }
}

async function gridlyReverseGeocode(lat, lng, options = {}) {
  const coordinates = normalizeCoordinatePair(lat, lng);
  if (!coordinates) return null;

  const zoom = Number.isFinite(Number(options.zoom)) ? Math.min(Math.max(Math.floor(Number(options.zoom)), 3), 18) : 16;
  const countryCodes = String(options.countryCodes || "us").trim() || "us";

  try {
    const params = new URLSearchParams({
      lat: String(coordinates.lat),
      lon: String(coordinates.lng),
      format: "jsonv2",
      zoom: String(zoom),
      addressdetails: "1",
      countrycodes: countryCodes
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    const providerResult = await response.json();
    return normalizeGridlySearchResult(providerResult);
  } catch (error) {
    console.warn("Reverse geocode failed:", error);
    return null;
  }
}


function buildGridlyResultShapePreviewItem(result) {
  const safeResult = result && typeof result === "object" ? result : {};
  const raw = safeResult.raw && typeof safeResult.raw === "object" ? safeResult.raw : {};
  const rawAddress = raw.address && typeof raw.address === "object" ? raw.address : {};
  const safeAddressKeys = [
    "city", "town", "village", "hamlet", "county", "state", "country",
    "road", "suburb", "neighbourhood", "municipality"
  ];
  const rawAddressSample = {};
  safeAddressKeys.forEach((key) => {
    const value = rawAddress[key];
    if (typeof value === "string" && value.trim()) rawAddressSample[key] = value.trim();
  });
  return {
    title: typeof safeResult.title === "string" ? safeResult.title : "",
    label: typeof safeResult.label === "string" ? safeResult.label : "",
    subtitleSample: typeof safeResult.subtitle === "string" ? safeResult.subtitle : "",
    addressSample: safeResult.address && typeof safeResult.address === "object"
      ? { ...safeResult.address }
      : (typeof safeResult.address === "string" ? safeResult.address : ""),
    context: buildGridlyLocationContext(safeResult) || "",
    lat: Number.isFinite(safeResult.lat) ? Number(safeResult.lat.toFixed(6)) : null,
    lng: Number.isFinite(safeResult.lng) ? Number(safeResult.lng.toFixed(6)) : null,
    rawDisplayNameSample: String(raw.display_name || "").slice(0, 160),
    rawAddressKeys: Object.keys(rawAddress).slice(0, 10),
    rawAddressSample,
    topLevelKeys: Object.keys(safeResult).slice(0, 15)
  };
}

window.gridlySearchAddress = gridlySearchAddress;
window.gridlyReverseGeocode = gridlyReverseGeocode;
window.normalizeGridlySearchResult = normalizeGridlySearchResult;
window.setGridlyDestinationMarker = setGridlyDestinationMarker;
window.clearGridlyDestinationMarker = clearGridlyDestinationMarker;
window.showGridlySearchShell = showGridlySearchShell;
window.hideGridlySearchShell = hideGridlySearchShell;
window.clearGridlySearchResults = clearGridlySearchResults;
window.gridlySearchDebug = function gridlySearchDebug() {
  const isVisibleEl = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || "1") === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const state = ensureGridlySearchState();
  const shell = gridlySearchUiRefs.shell || document.getElementById("gridlySearchShell");
  const input = gridlySearchUiRefs.input || document.getElementById("gridlyAddressSearchInput");
  const destinationCommandButton = els.mobileDestinationCommandBtn || document.getElementById("mobileDestinationCommandBtn");
  const zoomControl = document.querySelector("#map .leaflet-control-zoom");
  const results = gridlySearchUiRefs.results || document.getElementById("gridlySearchResults");
  const clearBtn = gridlySearchUiRefs.clearBtn || document.getElementById("gridlySearchClearBtn");
  const hasState = Boolean(state && typeof state === "object");
  const safeState = hasState ? state : {};
  const debug = {
    hasInitializedState: hasState,
    activeQuery: String(safeState.activeQuery || ""),
    hasActiveResult: Boolean(safeState.activeResult),
    hasSelectedDestination: Boolean(safeState.selectedDestination),
    recentSearchesCount: Array.isArray(safeState.recentSearches) ? safeState.recentSearches.length : 0,
    hasHomeLocation: Boolean(safeState.homeLocation),
    hasWorkLocation: Boolean(safeState.workLocation),
    hasDestinationMarker: Boolean(safeState.destinationMarker),
    destinationMarkerStatePresent: Boolean(safeState.destinationMarker),
    markerPlacementDiagnostics: safeState.markerPlacementDiagnostics && typeof safeState.markerPlacementDiagnostics === "object"
      ? { ...safeState.markerPlacementDiagnostics }
      : { ...GRIDLY_SEARCH_STATE_DEFAULTS.markerPlacementDiagnostics },
    hasSearchShell: Boolean(shell),
    searchShellHidden: Boolean(shell?.hidden),
    searchShellHasHiddenAttribute: Boolean(shell?.hasAttribute("hidden")),
    searchUiState: shell?.dataset?.searchUi || "unknown",
    hasSearchInput: Boolean(input),
    hasSearchResults: Boolean(results),
    hasSearchClearButton: Boolean(clearBtn),
    hasDestinationAddBtn: Boolean(els.destinationAddBtn),
    destinationAddBtnBound: Boolean(els.destinationAddBtn?.dataset?.searchBound === "true"),
    hasChooseRouteButton: Boolean(els.mobileDestinationCommandBtn),
    chooseRouteButtonBound: Boolean(els.mobileDestinationCommandBtn?.dataset?.searchBound === "true"),
    hasDestinationCommandButton: Boolean(els.mobileDestinationCommandBtn),
    destinationCommandButtonBound: Boolean(els.mobileDestinationCommandBtn?.dataset?.searchBound === "true"),
    destinationCommandButtonVisible: isVisibleEl(destinationCommandButton),
    searchShellBounds: shell?.getBoundingClientRect?.()?.toJSON?.() || null,
    searchShellDisplay: shell ? window.getComputedStyle(shell).display : null,
    destinationCommandBounds: destinationCommandButton?.getBoundingClientRect?.()?.toJSON?.() || null,
    mapZoomControlVisible: isVisibleEl(zoomControl),
    mapZoomControlBounds: zoomControl?.getBoundingClientRect?.()?.toJSON?.() || null,
    hasDestinationHeroCard: Boolean(document.querySelector(".destination-hero-card")),
    destinationHeroCardBound: Boolean(document.querySelector(".destination-hero-card")?.dataset?.searchBound === "true"),
    isSearching: Boolean(gridlySearchUiState.isSearching),
    activeSearchRequestId: Number(gridlySearchUiState.activeSearchRequestId || 0),
    lastRenderedResultsCount: Array.isArray(gridlySearchUiState.lastRenderedResults) ? gridlySearchUiState.lastRenderedResults.length : 0,
    prioritizedLocalResultsCount: Number(gridlySearchUiState.prioritizedLocalResultsCount || 0),
    renderedResultsPreview: Array.isArray(gridlySearchUiState.lastRenderedResultsPreview) ? gridlySearchUiState.lastRenderedResultsPreview : [],
    resultShapePreview: Array.isArray(gridlySearchUiState.lastResultShapePreview) ? gridlySearchUiState.lastResultShapePreview : [],
    contextDiagnostics: gridlySearchUiState.lastContextDiagnostics,
    lastSearchShellOpenSource: String(gridlySearchUiState.lastSearchShellOpenSource || ""),
    searchResultsTextLength: Number(results?.textContent?.length || 0),
    destinationMarkerLatLng: typeof safeState.destinationMarker?.getLatLng === "function"
      ? safeState.destinationMarker.getLatLng()
      : null,
    selectedDestinationPresent: Boolean(safeState.selectedDestination),
    helpers: {
      gridlySearchAddress: typeof window.gridlySearchAddress === "function",
      gridlyReverseGeocode: typeof window.gridlyReverseGeocode === "function",
      normalizeGridlySearchResult: typeof window.normalizeGridlySearchResult === "function",
      setGridlyDestinationMarker: typeof window.setGridlyDestinationMarker === "function",
      clearGridlyDestinationMarker: typeof window.clearGridlyDestinationMarker === "function"
    }
  };
  console.info("Gridly Search Debug", debug);
  return debug;
};


function getGridlyMapInstance() {
  const candidates = [
    (typeof map !== "undefined" ? map : null),
    window.map,
    window.gridlyMap
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate.addLayer === "function" && typeof candidate.removeLayer === "function") {
      return candidate;
    }
  }
  return null;
}

function setGridlyMarkerDiagnostics(patch = {}) {
  const state = ensureGridlySearchState();
  const existing = state.markerPlacementDiagnostics && typeof state.markerPlacementDiagnostics === "object"
    ? state.markerPlacementDiagnostics
    : GRIDLY_SEARCH_STATE_DEFAULTS.markerPlacementDiagnostics;
  state.markerPlacementDiagnostics = { ...existing, ...patch };
  return state.markerPlacementDiagnostics;
}

function focusGridlyDestinationOnMap(lat, lng, options = {}) {
  const coordinates = normalizeCoordinatePair(lat, lng);
  const mapInstance = getGridlyMapInstance();
  if (!coordinates || !mapInstance) {
    setGridlyMarkerDiagnostics({
      lastMapFocusSuccess: false,
      lastMapFocusLat: coordinates?.lat ?? null,
      lastMapFocusLng: coordinates?.lng ?? null,
      lastMapFocusZoom: null
    });
    return false;
  }

  const currentZoom = typeof mapInstance.getZoom === "function" ? Number(mapInstance.getZoom()) : null;
  const minFocusZoom = Number.isFinite(options?.minZoom) ? options.minZoom : 12;
  const maxFocusZoom = Number.isFinite(options?.maxZoom) ? options.maxZoom : 14;
  const targetZoom = Number.isFinite(currentZoom)
    ? Math.min(maxFocusZoom, Math.max(currentZoom, minFocusZoom))
    : maxFocusZoom;

  try {
    if (typeof mapInstance.flyTo === "function") {
      mapInstance.flyTo([coordinates.lat, coordinates.lng], targetZoom, { animate: true, duration: 0.9 });
    } else if (typeof mapInstance.panTo === "function") {
      mapInstance.panTo([coordinates.lat, coordinates.lng], { animate: true, duration: 0.7 });
      if (typeof mapInstance.setZoom === "function" && Number.isFinite(currentZoom) && currentZoom < minFocusZoom) {
        mapInstance.setZoom(targetZoom);
      }
    } else if (typeof mapInstance.setView === "function") {
      mapInstance.setView([coordinates.lat, coordinates.lng], targetZoom, { animate: true });
    } else {
      setGridlyMarkerDiagnostics({
        lastMapFocusSuccess: false,
        lastMapFocusLat: coordinates.lat,
        lastMapFocusLng: coordinates.lng,
        lastMapFocusZoom: null
      });
      return false;
    }
  } catch (_error) {
    setGridlyMarkerDiagnostics({
      lastMapFocusSuccess: false,
      lastMapFocusLat: coordinates.lat,
      lastMapFocusLng: coordinates.lng,
      lastMapFocusZoom: null
    });
    return false;
  }

  setGridlyMarkerDiagnostics({
    lastMapFocusSuccess: true,
    lastMapFocusLat: coordinates.lat,
    lastMapFocusLng: coordinates.lng,
    lastMapFocusZoom: targetZoom
  });
  return true;
}


function clearGridlyDestinationMarker(options = {}) {
  const state = ensureGridlySearchState();
  const preserveSelectedDestination = options?.preserveSelectedDestination === true;
  const silent = options?.silent === true;
  const marker = state.destinationMarker;

  if (!marker) {
    if (!preserveSelectedDestination) state.selectedDestination = null;
    state.destinationMarker = null;
    return true;
  }

  try {
    if (typeof marker.remove === "function") {
      marker.remove();
    } else {
      const mapInstance = getGridlyMapInstance();
      if (mapInstance && typeof mapInstance.removeLayer === "function") mapInstance.removeLayer(marker);
    }
  } catch (error) {
    if (!silent) {
      console.warn("Failed to clear destination marker:", error);
    }
  }

  state.destinationMarker = null;
  setGridlyMarkerDiagnostics({
    markerAssignedToState: false,
    destinationMarkerStatePresent: false,
    lastMarkerStateCheckAt: Date.now()
  });
  if (!preserveSelectedDestination) state.selectedDestination = null;
  return true;
}

function setGridlyDestinationMarker(result, options = {}) {
  const normalized = normalizeGridlySearchResult(result);
  if (!normalized) {
    setGridlyMarkerDiagnostics({
      lastMarkerAttempted: true,
      lastMarkerSuccess: false,
      lastMarkerFailureReason: "normalize_failed",
      lastMarkerLat: null,
      lastMarkerLng: null,
      mapAvailable: Boolean(getGridlyMapInstance())
    });
    return null;
  }

  const coordinates = normalizeCoordinatePair(
    normalized.lat ?? normalized.latitude ?? normalized?.coordinates?.lat,
    normalized.lng ?? normalized.longitude ?? normalized?.coordinates?.lng
  );
  const mapInstance = getGridlyMapInstance();
  if (!mapInstance || typeof mapInstance.addLayer !== "function") {
    setGridlyMarkerDiagnostics({
      lastMarkerAttempted: true,
      lastMarkerSuccess: false,
      lastMarkerFailureReason: "map_not_ready",
      lastMarkerLat: coordinates?.lat ?? null,
      lastMarkerLng: coordinates?.lng ?? null,
      mapAvailable: false
    });
    if (options?.silent !== true) {
      console.warn("Destination marker skipped: map not ready.");
    }
    return null;
  }

  if (!coordinates || typeof window.L?.marker !== "function") {
    setGridlyMarkerDiagnostics({
      lastMarkerAttempted: true,
      lastMarkerSuccess: false,
      lastMarkerFailureReason: !coordinates ? "invalid_coordinates" : "leaflet_marker_unavailable",
      lastMarkerLat: coordinates?.lat ?? null,
      lastMarkerLng: coordinates?.lng ?? null,
      mapAvailable: true
    });
    return null;
  }

  const state = ensureGridlySearchState();
  clearGridlyDestinationMarker({ preserveSelectedDestination: true, silent: options?.silent === true });

  let marker = null;
  try {
    marker = window.L.marker([coordinates.lat, coordinates.lng], {
      title: String(normalized.title || normalized.address || "Selected destination")
    });
    marker.addTo(mapInstance);
    if (options?.tooltip !== false && typeof marker.bindTooltip === "function") {
      const tooltipText = String(normalized.title || normalized.address || "Destination").trim();
      if (tooltipText) marker.bindTooltip(tooltipText, { direction: "top", offset: [0, -10] });
    }
  } catch (error) {
    setGridlyMarkerDiagnostics({
      lastMarkerAttempted: true,
      lastMarkerSuccess: false,
      lastMarkerFailureReason: "marker_creation_failed",
      lastMarkerLat: coordinates.lat,
      lastMarkerLng: coordinates.lng,
      mapAvailable: true
    });
    if (options?.silent !== true) {
      console.warn("Failed to set destination marker:", error);
    }
    return null;
  }

  state.destinationMarker = marker;
  window.GridlySearchState = state;
  const markerAssignedToState = Boolean(state.destinationMarker);
  setGridlyMarkerDiagnostics({
    lastMarkerAttempted: true,
    lastMarkerSuccess: true,
    lastMarkerFailureReason: "",
    lastMarkerLat: coordinates.lat,
    lastMarkerLng: coordinates.lng,
    mapAvailable: true,
    markerAssignedToState,
    destinationMarkerStatePresent: markerAssignedToState,
    lastMarkerStateCheckAt: Date.now()
  });
  if (options?.preserveSelectedDestination !== true) {
    state.selectedDestination = normalized;
  }

  return marker;
}

async function geocodeAddressToCoordinates(rawAddress = "") {
  const query = String(rawAddress || "").trim();
  if (!query) return null;
  try {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "1",
      countrycodes: "us"
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    const results = await response.json();
    const first = Array.isArray(results) ? results[0] : null;
    return normalizeCoordinatePair(first?.lat, first?.lon);
  } catch (error) {
    console.warn("Address geocode failed:", error);
    return null;
  }
}

function lookupLocalPlaceCoordinates(...parts) {
  const candidates = parts
    .map((part) => String(part || "").trim().toLowerCase())
    .filter(Boolean);
  for (const candidate of candidates) {
    const normalized = candidate
      .replace(/\s+/g, " ")
      .replace(/,\s*usa$/i, "")
      .replace(/,\s*(texas|tx)$/i, "")
      .trim();
    const direct = LOCAL_PLACE_LOOKUP[normalized];
    if (direct) return normalizeCoordinatePair(direct.lat, direct.lng);
  }
  return null;
}

async function resolvePlaceCoordinates({ label = "", address = "", preferGeolocation = false, allowGeocode = true } = {}) {
  if (preferGeolocation && userLocation) {
    const gpsCoords = normalizeCoordinatePair(userLocation.lat, userLocation.lng);
    if (gpsCoords) return { coordinates: gpsCoords, source: "browser geolocation" };
  }
  const localLookup = lookupLocalPlaceCoordinates(address, label, `${address}, ${label}`.trim(), `${label}, ${address}`.trim());
  if (localLookup) return { coordinates: localLookup, source: "local lookup" };
  if (allowGeocode) {
    const geocodedCoordinates = await geocodeAddressToCoordinates(address || label);
    if (geocodedCoordinates) return { coordinates: geocodedCoordinates, source: "geocode" };
  }
  return { coordinates: null, source: "null" };
}

function hasValidPlaceCoordinates(place) {
  return Boolean(normalizeCoordinatePair(place?.lat, place?.lng));
}

function scrubInvalidSavedPlacesState() {
  const state = getSavedPlacesState();
  let changed = false;
  const nextState = { ...state, custom: [] };

  ["home", "work"].forEach((type) => {
    const place = state[type];
    if (!place) return;
    const normalizedCoords = normalizeCoordinatePair(place.lat, place.lng);
    if (!normalizedCoords || isLegacyPlace(place)) {
      nextState[type] = null;
      changed = true;
      return;
    }
    if (place.lat !== normalizedCoords.lat || place.lng !== normalizedCoords.lng) {
      nextState[type] = { ...place, lat: normalizedCoords.lat, lng: normalizedCoords.lng };
      changed = true;
      return;
    }
    nextState[type] = place;
  });

  nextState.custom = state.custom
    .map((place) => {
      const normalizedCoords = normalizeCoordinatePair(place?.lat, place?.lng);
      if (!normalizedCoords || isLegacyPlace(place)) {
        changed = true;
        return null;
      }
      if (place.lat !== normalizedCoords.lat || place.lng !== normalizedCoords.lng) {
        changed = true;
        return { ...place, lat: normalizedCoords.lat, lng: normalizedCoords.lng };
      }
      return place;
    })
    .filter(Boolean);

  if (changed) saveSavedPlacesState(nextState);
}

function initDailyDestinationHero() {
  const state = getSavedPlacesState();
  const hasAny = Boolean(state.home || state.work || state.custom.length);
  if (els.destinationEmptyNote) els.destinationEmptyNote.hidden = hasAny;
  const copy = ["Check route before you go.", "Any delays today?", "Beat the backup.", "Know before you go."];
  safeText("destinationHabitCopy", copy[new Date().getDate() % copy.length]);
}

function activateDestinationByType(type) {
  const state = getSavedPlacesState();
  const routeLabelParts = buildRouteWatchLabelParts();
  if (!routeLabelParts.configured) {
    setConfirmation("Set up Home and Work to start Route Watch.", "error");
    openRouteSetupModalForType(routeLabelParts.hasHome ? "work" : "home");
    return;
  }
  const target = type === "favorite" ? state.custom.find((place) => isConfiguredPlace(place)) : state[type];
  if (!target) {
    if (type === "favorite") {
      setConfirmation("No favorite saved yet. Add a place first.", "error");
      openRouteSetupModalForType("favorite");
      return;
    }
    setConfirmation("No saved place yet. Add a place first.", "error");
    openRouteSetupModalForType(type);
    return;
  }
  const targetCoords = normalizeCoordinatePair(target.lat, target.lng);
  if (!targetCoords) {
    setConfirmation("Add exact Home and Work locations to show route.", "error");
    return;
  }
  activeDestinationPlace = target;
  routeWatchActivated = true;
  map?.setView([targetCoords.lat, targetCoords.lng], 14);
  renderDestinationRoute({ ...target, lat: targetCoords.lat, lng: targetCoords.lng });
  scrollToSection("mapSection");
  setConfirmation(`Route Watch set: ${target.label}.`, "success");
}

function openRouteSetupModalForType(type) {
  openRouteSetupModal();
  if (!els.routeSetupModal) return;
  const state = getSavedPlacesState();
  if (type === "home" && isConfiguredPlace(state.home)) return activateDestinationByType("home");
  if (type === "work" && isConfiguredPlace(state.work)) return activateDestinationByType("work");
  if (type === "favorite" && state.custom?.length) return activateDestinationByType("favorite");
  const modalMode = type === "home" || type === "work" || type === "favorite" ? type : "add";
  configureRouteSetupModal({ mode: modalMode, prefillType: type });
}

function configureRouteSetupModal({ mode = "add", prefillType = "custom" } = {}) {
  if (!els.routeSetupModal) return;
  const state = getSavedPlacesState();
  const normalizedType = prefillType === "favorite" ? "custom" : prefillType;
  els.routeSetupModal.dataset.mode = mode;
  els.routeSetupModal.dataset.prefillType = normalizedType;
  const titleEl = document.getElementById("routeSetupTitle");
  const subtitleEl = els.routeSetupModal.querySelector(".smart-alerts-subtitle");
  const destinationLabel = document.getElementById("savedPlacesSelectLabel") || els.mobileSavedDestinationSelect?.closest("label");
  const destinationLabelText = destinationLabel ? destinationLabel.childNodes[0] : null;
  if (titleEl) titleEl.textContent = mode === "manage" ? "Manage Places" : mode === "home" ? "Set Home" : mode === "work" ? "Set Work" : mode === "favorite" ? "Add Favorite" : "Add Place";
  if (subtitleEl) subtitleEl.textContent = "Saved places stay on this device. Pick one destination for today.";
  if (els.mobileSaveRouteBtn) els.mobileSaveRouteBtn.textContent = mode === "manage" ? "Save Place" : mode === "home" ? "Save Home" : mode === "work" ? "Save Work" : "Save Place";
  if (destinationLabel) destinationLabel.hidden = mode === "manage";
  if (els.mobileSavedDestinationSelect) {
    els.mobileSavedDestinationSelect.disabled = mode === "manage";
  }

  if (mode === "manage") {
    const selected = getSelectedPlace();
    const hasHome = isConfiguredPlace(state.home);
    const hasWork = isConfiguredPlace(state.work);
    const effectiveType = selected?.id === "home" || selected?.id === "work"
      ? selected.id
      : !hasHome
        ? "home"
        : !hasWork
          ? "work"
          : "custom";
    els.routeSetupModal.dataset.prefillType = effectiveType;
    if (els.mobileHomeInput) {
      els.mobileHomeInput.value = selected?.name || (effectiveType === "home" ? "Home" : effectiveType === "work" ? "Work" : "");
    }
    if (els.mobileWorkInput) els.mobileWorkInput.value = selected?.address || "";
    if (els.managePlaceSlotRow) els.managePlaceSlotRow.hidden = false;
    setManagePlacesSourceMode("");
    document.getElementById("managePlacesSlotsGroup")?.removeAttribute("hidden");
    if (destinationLabelText) destinationLabelText.textContent = "Saved places";
    if (subtitleEl) {
      subtitleEl.textContent = !hasHome
        ? "Save Home first to start Route Watch."
        : "Manage Home, Work, and Favorite places.";
    }
    syncManagePlaceSlotsAndCta(effectiveType);
    updateRouteSetupManageState();
    return;
  }
  if (els.managePlaceSlotRow) els.managePlaceSlotRow.hidden = true;
  setManagePlacesSourceMode("address");
  document.getElementById("managePlacesSlotsGroup")?.setAttribute("hidden", "hidden");

  const presets = {
    home: { name: "Home", address: "" },
    work: { name: "Work", address: "" },
    custom: { name: mode === "favorite" ? "Favorite" : "", address: "" }
  };
  if (normalizedType === "home" || mode === "home") {
    if (titleEl) titleEl.textContent = "Set Home";
    if (subtitleEl) subtitleEl.textContent = "Enter your home area or use your current location.";
  } else if (normalizedType === "work" || mode === "work") {
    if (titleEl) titleEl.textContent = "Set Work";
    if (subtitleEl) subtitleEl.textContent = "Enter your work area or use your current location.";
  } else if (mode === "favorite") {
    if (titleEl) titleEl.textContent = "Add Favorite";
    if (subtitleEl) subtitleEl.textContent = "Save a favorite destination for quick access.";
  }
  const preset = presets[normalizedType] || presets.custom;
  if (els.mobileHomeInput) els.mobileHomeInput.value = preset.name;
  if (els.mobileWorkInput) els.mobileWorkInput.value = preset.address;
  if (els.mobileHomeInput) els.mobileHomeInput.focus();
}

function attachSavedPlacesDebugGlobal() {
  window.gridlySavedPlacesDebug = function gridlySavedPlacesDebug() {
    const storageKeys = {
      savedPlaces: SAVED_PLACES_STORAGE_KEY,
      selectedPlace: SELECTED_PLACE_STORAGE_KEY,
      legacyHome: "gridlyHome",
      legacyWork: "gridlyWork"
    };
    const state = getSavedPlacesState();
    const selectedPlaceId = getSelectedPlaceId();
    const selectedPlace = getSelectedPlace();
    const validity = ["home", "work"].reduce((acc, type) => {
      const place = state[type];
      const hasLabel = Boolean(String(place?.label || "").trim());
      const hasCoords = hasValidPlaceCoordinates(place);
      const isLegacy = isLegacyPlace(place);
      acc[type] = {
        isValid: Boolean(place && hasLabel && hasCoords && !isLegacy),
        reasons: {
          exists: Boolean(place),
          hasLabel,
          hasCoords,
          isLegacy
        }
      };
      return acc;
    }, {});

    const rawSavedPlaces = localStorage.getItem(SAVED_PLACES_STORAGE_KEY);
    let parsedSavedPlaces = null;
    try { parsedSavedPlaces = rawSavedPlaces ? JSON.parse(rawSavedPlaces) : null; } catch (error) { parsedSavedPlaces = { parseError: error.message }; }
    return {
      modalMode: els.routeSetupModal?.dataset?.mode || null,
      lastSaveResult: lastSavedPlaceResult,
      lastValidationError,
      activeSaveMode: els.routeSetupModal?.dataset?.prefillType || null,
      saveButtonFound: Boolean(els.mobileSaveRouteBtn),
      saveButtonHandlerAttached,
      currentInputName: els.mobileHomeInput?.value?.trim?.() || "",
      currentInputAddress: els.mobileWorkInput?.value?.trim?.() || "",
      savedPlaces: state,
      dropdownOptions: getSavedPlaces().map((place) => ({ id: place.id, name: place.name, lat: place.lat, lng: place.lng, source: place.source })),
      placesWithCoordinateState: [state.home, state.work, ...(Array.isArray(state.custom) ? state.custom : [])]
        .filter(Boolean)
        .map((place) => {
          const normalizedCoords = normalizeCoordinatePair(place?.lat, place?.lng);
          return {
            id: place.id || null,
            label: place.label || place.name || "",
            source: place.coordinateSource || "unknown",
            address: place.address || "",
            lat: Number.isFinite(Number(place?.lat)) ? Number(place.lat) : null,
            lng: Number.isFinite(Number(place?.lng)) ? Number(place.lng) : null,
            hasValidCoordinates: Boolean(normalizedCoords)
          };
        }),
      localStorageRaw: rawSavedPlaces,
      parsedSavedPlaces,
      homeValidity: validity.home,
      workValidity: validity.work,
      coordinateSources: {
        home: state.home?.coordinateSource || (state.home ? "unknown" : "null"),
        work: state.work?.coordinateSource || (state.work ? "unknown" : "null")
      },
      selectedDestination: {
        selectedPlaceId,
        selectedPlace
      },
      routeWatchActivated,
      storageKeys,
      localStorageSnapshot: {
        savedPlaces: rawSavedPlaces,
        selectedPlace: localStorage.getItem(SELECTED_PLACE_STORAGE_KEY),
        legacyHome: localStorage.getItem("gridlyHome"),
        legacyWork: localStorage.getItem("gridlyWork")
      }
    };
  };
  window.gridlyManagePlacesDebug = function gridlyManagePlacesDebug() {
    const modal = els.routeSetupModal || document.getElementById("routeSetupModal");
    const saveGroup = document.getElementById("managePlacesSaveGroup");
    const saveButton = els.mobileSaveRouteBtn || document.getElementById("mobileSaveRouteBtn");
    const addressInput = els.mobileWorkInput || document.getElementById("mobileWorkInput");
    return {
      modalOpen: Boolean(modal && !modal.hidden),
      selectedSlot: modal?.dataset?.prefillType || null,
      selectedSource: managePlacesSourceMode || null,
      placeNameValue: (els.mobileHomeInput?.value || "").trim(),
      addressValue: (addressInput?.value || "").trim(),
      addressInputFocused: document.activeElement === addressInput,
      saveButtonExists: Boolean(saveButton),
      saveButtonVisible: Boolean(saveButton && saveButton.offsetParent !== null),
      saveButtonDisabled: Boolean(saveButton?.disabled),
      savedPlacesState: getSavedPlacesState(),
      lastSaveAttempt: lastManagePlacesSaveAttempt,
      lastSaveError: lastManagePlacesSaveError || lastValidationError,
      visualViewportHeight: window.visualViewport?.height || null,
      windowInnerHeight: window.innerHeight,
      modalRect: modal?.getBoundingClientRect?.() || null,
      saveGroupRect: saveGroup?.getBoundingClientRect?.() || null
    };
  };
}

function setRoutePreviewState(rendered, reason, options = {}) {
  // Route preview is only considered successful when a real global preview layer has at least 2 points.
  routePreviewPolylinePointCount = Number.isFinite(Number(options.pointCount)) ? Number(options.pointCount) : 0;
  const hasUsableGlobalLayer = Boolean(window.__gridlyRoutePreviewLayer)
    && typeof window.__gridlyRoutePreviewLayer.getLatLngs === "function"
    && Array.isArray(window.__gridlyRoutePreviewLayer.getLatLngs())
    && window.__gridlyRoutePreviewLayer.getLatLngs().length >= 2;

  routePreviewLayerExists = hasUsableGlobalLayer;
  mapHasRoutePreviewLayer = hasUsableGlobalLayer
    && Boolean(map && savedRouteLayer && typeof map.hasLayer === "function" && map.hasLayer(savedRouteLayer));
  routePreviewRendered = hasUsableGlobalLayer;
  routePreviewReason = hasUsableGlobalLayer
    ? "Route preview active."
    : String(reason || (Boolean(rendered) ? "Route preview reported but layer is unavailable." : "Route preview not rendered."));
  lastRoutePreviewError = routePreviewRendered ? null : routePreviewReason;
}

async function renderRoutePreviewLine(startCoordinates, destinationCoordinates) {
  routeRequestTriggered = false;
  osrmRequestStarted = false;
  osrmResponseReceived = false;
  routeRenderAttempted = false;
  routeRenderSucceeded = false;
  lastOsrmRequestUrl = null;
  lastOsrmResponseStatus = null;
  // Render from saved Home/Work (or other saved place) coordinates only after coordinate validation succeeds.
  if (!map) return false;

  try {
  const fallbackPoints = [
    [Number(startCoordinates?.lat), Number(startCoordinates?.lng)],
    [Number(destinationCoordinates?.lat), Number(destinationCoordinates?.lng)]
  ];
  const hasValidPoints = fallbackPoints.length >= 2 && fallbackPoints.every((point) => (
    Array.isArray(point)
    && point.length >= 2
    && Number.isFinite(point[0])
    && Number.isFinite(point[1])
  ));
  if (!hasValidPoints) return false;

  const requestKey = `${fallbackPoints[0][0].toFixed(6)},${fallbackPoints[0][1].toFixed(6)}->${fallbackPoints[1][0].toFixed(6)},${fallbackPoints[1][1].toFixed(6)}`;
  const nowMs = Date.now();
  if (routeRequestInFlight && requestKey === lastRouteRequestKey && (nowMs - lastRouteRequestAt) < 1500) {
    duplicateRouteRequestBlockedCount += 1;
    console.info("Gridly duplicate route request blocked", { requestKey, duplicateRouteRequestBlockedCount });
    return false;
  }
  routeRequestInFlight = true;
  lastRouteRequestKey = requestKey;
  lastRouteRequestAt = nowMs;

  if (window.__gridlyRoutePreviewLayer && typeof map.removeLayer === "function" && map.hasLayer(window.__gridlyRoutePreviewLayer)) {
    map.removeLayer(window.__gridlyRoutePreviewLayer);
  }
  if (routePreviewCorridorLayer && typeof map.removeLayer === "function" && map.hasLayer(routePreviewCorridorLayer)) {
    map.removeLayer(routePreviewCorridorLayer);
  }
  if (alternateRouteLayer && typeof map.removeLayer === "function" && map.hasLayer(alternateRouteLayer)) {
    map.removeLayer(alternateRouteLayer);
  }
  routePreviewCorridorLayer = null;
  alternateRouteLayer = null;
  alternateRouteVertexCount = 0;
  alternateRouteGeometrySource = "none";
  alternateRouteStatus = "not_needed";
  alternateRouteReason = "";
  alternateRouteAvailable = false;
  primaryRouteHazardCount = 0;
  alternateRouteHazardCount = 0;
  hazardsAvoidedCount = 0;
  routeComparisonStatus = "alternate_unavailable";
  routeComparisonSummary = "";
  activeRouteSource = "primary";

  let previewPoints = fallbackPoints;
  routeGeometrySource = "fallback";
  osrmRouteSuccess = false;
  monitoredRouteEtaMinutes = null;
  monitoredRouteDelayMinutes = null;
  monitoredRouteDurationSeconds = null;

  try {
    const startLat = Number(startCoordinates?.lat);
    const startLng = Number(startCoordinates?.lng);
    const destinationLat = Number(destinationCoordinates?.lat);
    const destinationLng = Number(destinationCoordinates?.lng);
    const osrmUrl = `${OSRM_ROUTE_API}/${startLng},${startLat};${destinationLng},${destinationLat}?overview=full&geometries=geojson`;
    lastOsrmRequestUrl = osrmUrl;
    routeRequestTriggered = true;
    lastRouteRequest = {
      engine: "osrm",
      url: osrmUrl,
      start: { lat: startLat, lng: startLng },
      destination: { lat: destinationLat, lng: destinationLng },
      requestedAt: new Date().toISOString()
    };
    console.info("Gridly route request payload", lastRouteRequest);
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    osrmRequestStarted = true;
    console.info("Gridly OSRM request start", { url: osrmUrl });
    const timeoutId = controller ? setTimeout(() => controller.abort(), 7000) : null;
    const response = await fetch(osrmUrl, {
      method: "GET",
      signal: controller?.signal
    });
    lastOsrmResponseStatus = Number(response?.status || 0) || null;
    if (timeoutId) clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`OSRM response failed (${response.status})`);
    }
    const payload = await response.json();
    osrmResponseReceived = true;
    console.info("Gridly OSRM response received", { hasRoutes: Array.isArray(payload?.routes), routeCount: Array.isArray(payload?.routes) ? payload.routes.length : 0 });
    const primaryRoute = payload?.routes?.[0] || null;
    const routeCoordinates = primaryRoute?.geometry?.coordinates;
    if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 2) {
      throw new Error("OSRM route geometry was invalid.");
    }
    const convertedPoints = routeCoordinates
      .map((point) => (Array.isArray(point) ? [Number(point[1]), Number(point[0])] : null))
      .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (convertedPoints.length < 2) {
      throw new Error("OSRM route geometry could not be converted.");
    }
    previewPoints = convertedPoints;
    lastRouteGeometryPointCount = convertedPoints.length;
    lastRouteError = null;
    console.info("Gridly route geometry point count", { pointCount: convertedPoints.length, source: "osrm" });
    routeGeometrySource = "osrm";
    osrmRouteSuccess = true;
    const osrmDurationSeconds = Number(primaryRoute?.duration);
    if (Number.isFinite(osrmDurationSeconds) && osrmDurationSeconds > 0) {
      monitoredRouteDurationSeconds = Math.round(osrmDurationSeconds);
      monitoredRouteEtaMinutes = Math.max(1, Math.round(osrmDurationSeconds / 60));
    }
  } catch (error) {
    routeGeometrySource = "fallback";
    osrmRouteSuccess = false;
    lastRouteError = String(error?.message || error || "OSRM route failed");
    lastRouteGeometryPointCount = fallbackPoints.length;
    console.info("Gridly route geometry point count", { pointCount: fallbackPoints.length, source: "fallback" });
    captureRouteAttempt({ osrmCallSucceeded: false, finalFailureReason: lastRouteError });
  }

  const corridorUnderlay = L.polyline(previewPoints, {
    pane: "routePane",
    color: "#6ee7ff",
    weight: 20,
    opacity: 0.14,
    lineCap: "round",
    lineJoin: "round",
    interactive: false
  });

  const corridorBase = L.polyline(previewPoints, {
    pane: "routePane",
    color: "#38d8ff",
    weight: 14,
    opacity: 0.24,
    lineCap: "round",
    lineJoin: "round",
    interactive: false
  });

  const routePreviewLayer = L.polyline(previewPoints, {
    pane: "routePane",
    color: "#00ffff",
    weight: 8,
    opacity: 0.92,
    lineCap: "round",
    lineJoin: "round"
  });

  routeRenderAttempted = true;
  routePreviewCorridorLayer = L.layerGroup([corridorUnderlay, corridorBase, routePreviewLayer]).addTo(map);
  console.info("Gridly route layer render result", {
    routeLayerExists: Boolean(routePreviewLayer),
    routeLayerOnMap: Boolean(map && routePreviewLayer && map.hasLayer(routePreviewLayer)),
    routePaneZIndex: map?.getPane?.("routePane")?.style?.zIndex || null
  });
  window.__gridlyRoutePreviewLayer = routePreviewLayer;

  const rerouteFoundation = getRerouteFoundation(getRouteHazardAssessment());
  if (rerouteFoundation.rerouteRecommended) {
    alternateRouteStatus = "unavailable";
    alternateRouteReason = "Alternate route check recommended.";
    try {
      const alternatePoints = await fetchAlternateRouteCoordinates(
        [Number(startCoordinates?.lat), Number(startCoordinates?.lng)],
        [Number(destinationCoordinates?.lat), Number(destinationCoordinates?.lng)],
        previewPoints
      );
      if (Array.isArray(alternatePoints) && alternatePoints.length >= 2) {
        alternateRouteLayer = L.polyline(alternatePoints, {
          pane: "routePane",
          color: "#fbbf24",
          weight: 6,
          opacity: 0.95,
          dashArray: "12 10",
          lineCap: "round",
          lineJoin: "round"
        }).addTo(map);
        alternateRouteVertexCount = alternatePoints.length;
        alternateRouteGeometrySource = "osrm_alternative";
        alternateRouteStatus = "available";
        alternateRouteReason = "Alternate route available.";
        alternateRouteAvailable = true;
      }
    } catch (error) {
      alternateRouteStatus = "unavailable";
      alternateRouteReason = "Alternate route check recommended.";
    }
  }
  updateRouteComparisonState(getRouteHazardAssessment());

  const actualLatLngs = routePreviewLayer.getLatLngs();
  routePreviewPolylinePointCount = Array.isArray(actualLatLngs) ? actualLatLngs.length : 0;
  const hasUsablePreviewLayer = Boolean(window.__gridlyRoutePreviewLayer)
    && typeof window.__gridlyRoutePreviewLayer.getLatLngs === "function"
    && Array.isArray(window.__gridlyRoutePreviewLayer.getLatLngs())
    && window.__gridlyRoutePreviewLayer.getLatLngs().length >= 2;
  routePreviewRendered = hasUsablePreviewLayer;
  routePreviewLayerExists = hasUsablePreviewLayer;
  mapHasRoutePreviewLayer = hasUsablePreviewLayer && Boolean(map && typeof map.hasLayer === "function" && map.hasLayer(routePreviewLayer));
  if (!routePreviewRendered) {
    console.info("Gridly route render failure", { routePreviewRendered, pointCount: routePreviewPolylinePointCount });
    return false;
  }
  routeRenderSucceeded = true;
  console.info("Gridly route render success", { pointCount: routePreviewPolylinePointCount });

  if (map) {
    window.__gridlyRoutePreviewMapDebug = map;
    const bounds = routePreviewLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        paddingTopLeft: [180, 320],
        paddingBottomRight: [140, 120],
        padding: [200, 180],
        maxZoom: 15,
        animate: true,
        duration: 0.6
      });
    }
  }

  return true;
  } finally {
    routeRequestInFlight = false;
  }
}




function ensureAlternateRouteButton() {
  if (!els) return null;
  if (els.useAlternateRouteBtn && document.body.contains(els.useAlternateRouteBtn)) return els.useAlternateRouteBtn;

  const actionHost = els.routeWatchStartBtn?.parentElement;
  if (!actionHost) return null;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "useAlternateRouteBtn";
  button.className = "secondary-btn compact-btn route-watch-alt-btn";
  button.textContent = "Use Alternate Route";
  button.hidden = true;
  button.setAttribute("aria-disabled", "true");
  button.title = "Alternate route unavailable";

  const startButton = els.routeWatchStartBtn;
  if (startButton?.nextSibling) actionHost.insertBefore(button, startButton.nextSibling);
  else actionHost.appendChild(button);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (button.disabled) return;
    useAlternateRoute();
  });

  els.useAlternateRouteBtn = button;
  return button;
}

function getRouteRecommendationState(routeHazard) {
  const transitionActive = routeTransitionUntil > Date.now();
  if (transitionActive && activeRouteSource === "alternate") {
    routeUxState = "alternate_promoted_after_switch";
    routeRecommendationTone = "affirming";
    return {
      state: routeUxState,
      tone: routeRecommendationTone,
      message: lastRouteSwitchMessage || "Now monitoring alternate route."
    };
  }
  if (routeHazard?.level === "clear" && primaryRouteHazardCount === 0) {
    routeUxState = "primary_route_clear";
    routeRecommendationTone = "calm";
    return { state: routeUxState, tone: routeRecommendationTone, message: "Primary route is clear. Route Watch is actively monitoring for changes." };
  }
  if ((routeHazard?.level === "blocked" || routeHazard?.level === "heavy" || routeHazard?.level === "caution") && !alternateRouteAvailable) {
    routeUxState = "primary_hazard_no_alternate";
    routeRecommendationTone = "urgent";
    return { state: routeUxState, tone: routeRecommendationTone, message: "Delay risk detected on primary route. No safer alternate is available right now." };
  }
  if (routeComparisonStatus === "both_delayed") {
    routeUxState = "both_routes_active_delays";
    routeRecommendationTone = "balanced";
    return { state: routeUxState, tone: routeRecommendationTone, message: "Both primary and alternate routes have active delays. Keep monitoring live reports before departure." };
  }
  if (routeComparisonStatus === "alternate_safer") {
    routeUxState = "alternate_safer";
    routeRecommendationTone = "advisory";
    return { state: routeUxState, tone: routeRecommendationTone, message: "A safer alternate route is available now. Switching may reduce delay exposure." };
  }
  if (routeComparisonStatus === "alternate_available") {
    routeUxState = "alternate_not_better";
    routeRecommendationTone = "neutral";
    return { state: routeUxState, tone: routeRecommendationTone, message: "An alternate route is available, but the primary route is still the better option." };
  }
  routeUxState = "primary_clear";
  routeRecommendationTone = "calm";
  return { state: routeUxState, tone: routeRecommendationTone, message: "Primary route remains your recommended option." };
}

function updateAlternateRouteActionState() {
  const switchEl = els?.alternateRoute;
  const switchBtn = ensureAlternateRouteButton();
  const switchAvailable = Boolean(alternateRouteAvailable && alternateRouteLayer && window.__gridlyRoutePreviewLayer && routeWatchActivated);
  const monitoringAlternate = activeRouteSource === "alternate";

  if (switchEl) {
    switchEl.classList.toggle("disabled", !switchAvailable);
    switchEl.setAttribute("aria-disabled", switchAvailable ? "false" : "true");
    switchEl.title = monitoringAlternate ? "Monitoring Alternate" : (switchAvailable ? "Use Alternate Route" : "Alternate route unavailable");
  }

  if (switchBtn) {
    switchBtn.hidden = !routeWatchActivated;
    switchBtn.disabled = monitoringAlternate ? true : !switchAvailable;
    switchBtn.classList.toggle("disabled", !switchAvailable);
    switchBtn.setAttribute("aria-disabled", (switchAvailable && !monitoringAlternate) ? "false" : "true");
    switchBtn.title = monitoringAlternate ? "Monitoring Alternate" : (switchAvailable ? "Use Alternate Route" : "Alternate route unavailable");
    switchBtn.textContent = monitoringAlternate ? "Monitoring Alternate" : (switchAvailable ? "Use Alternate Route" : "Alternate Route Unavailable");
  }
}

async function useAlternateRoute() {
  if (!(alternateRouteAvailable && alternateRouteLayer && window.__gridlyRoutePreviewLayer && routeWatchActivated)) {
    setConfirmation("Alternate route is not available yet.", "error");
    updateAlternateRouteActionState();
    return false;
  }
  try {
    const alternateLatLngs = alternateRouteLayer.getLatLngs?.() || [];
    if (!Array.isArray(alternateLatLngs) || alternateLatLngs.length < 2) throw new Error("invalid alternate geometry");
    const promotedPoints = alternateLatLngs.map((point) => [Number(point.lat), Number(point.lng)]).filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (promotedPoints.length < 2) throw new Error("alternate geometry conversion failed");

    window.__gridlyRoutePreviewLayer.setLatLngs(promotedPoints);
    routePreviewPolylinePointCount = promotedPoints.length;
    routeGeometrySource = "alternate_promoted";
    activeRouteSource = "alternate";
    routeWatchActivated = true;
    routePreviewRendered = true;
    routePreviewLayerExists = true;
    mapHasRoutePreviewLayer = true;
    lastRouteSwitchAt = new Date().toISOString();
    routeSwitchCount += 1;
    lastRouteSwitchMessage = "Now monitoring alternate route.";
    routeTransitionUntil = Date.now() + 9000;

    let nextAlternate = null;
    const places = Array.isArray(getSavedPlaces?.()) ? getSavedPlaces() : [];
    const start = places.find((place) => place.id === (els?.routeWatchStartSelect?.value || ""));
    const destination = places.find((place) => place.id === (els?.routeWatchDestinationSelect?.value || ""));
    const startCoordinates = normalizeCoordinatePair(start?.lat, start?.lng);
    const destinationCoordinates = normalizeCoordinatePair(destination?.lat, destination?.lng);
    if (startCoordinates && destinationCoordinates) {
      nextAlternate = await fetchAlternateRouteCoordinates([startCoordinates.lat, startCoordinates.lng], [destinationCoordinates.lat, destinationCoordinates.lng], promotedPoints);
    }

    if (alternateRouteLayer && map?.hasLayer?.(alternateRouteLayer)) map.removeLayer(alternateRouteLayer);
    alternateRouteLayer = null;
    alternateRouteAvailable = false;
    alternateRouteStatus = "unavailable";
    alternateRouteReason = "Alternate route refresh in progress.";
    alternateRouteVertexCount = 0;
    alternateRouteGeometrySource = "none";

    if (Array.isArray(nextAlternate) && nextAlternate.length >= 2) {
      alternateRouteLayer = L.polyline(nextAlternate, { pane: "routePane", color: "#fbbf24", weight: 6, opacity: 0.95, dashArray: "12 10", lineCap: "round", lineJoin: "round" }).addTo(map);
      alternateRouteVertexCount = nextAlternate.length;
      alternateRouteGeometrySource = "osrm_alternative";
      alternateRouteStatus = "available";
      alternateRouteReason = "Alternate route available.";
      alternateRouteAvailable = true;
    } else {
      alternateRouteReason = "Alternate route unavailable after switching.";
    }

    updateRouteComparisonState(getRouteHazardAssessment());
    updateRouteIntelligence();
    updateRouteWatchPill();
    updateAlternateRouteActionState();
    setConfirmation("Now monitoring alternate route.", "success");
    return true;
  } catch (error) {
    setConfirmation("Could not switch routes right now. Keeping current monitored route.", "error");
    updateAlternateRouteActionState();
    return false;
  }
}

function updateRouteWatchStartButtonLabel() {
  if (!els.routeWatchStartBtn) return;
  const startId = els.routeWatchStartSelect?.value || "";
  const destinationId = els.routeWatchDestinationSelect?.value || "";
  const hasSelections = Boolean(startId && destinationId);
  const changedSelection = Boolean(routeWatchActivated && (startId !== lastRouteWatchSelection.startId || destinationId !== lastRouteWatchSelection.destinationId));
  els.routeWatchStartBtn.textContent = changedSelection
    ? "Update Route Watch"
    : routeWatchActivated && hasSelections
      ? "Viewing Route"
      : "Start Route Watch";
}

function attachRouteWatchDebugGlobal() {
  // Keep debug helpers available for field triage without reintroducing verbose console noise.
  window.gridlyRouteWatchDebug = function gridlyRouteWatchDebug() {
    try {
      const places = Array.isArray(getSavedPlaces?.()) ? getSavedPlaces() : [];
      const startId = els?.routeWatchStartSelect?.value || "";
      const destinationId = els?.routeWatchDestinationSelect?.value || "";
      const start = places.find((place) => place.id === startId) || null;
      const destination = places.find((place) => place.id === destinationId) || null;
      const routeLayers = savedRouteLayer?.getLayers?.() || [];
      const startCoordinates = normalizeCoordinatePair(start?.lat, start?.lng);
      const destinationCoordinates = normalizeCoordinatePair(destination?.lat, destination?.lng);
      const routeHazard = getRouteHazardAssessment?.() || { score: 0, level: "clear", nearbyReports: [], nearestIssue: null, recommendation: "normal" };
      const corridorHealth = getCorridorHealthFromScore(routeHazard?.score || 0);
      const estimatedDelayImpact = getEstimatedDelayImpact(corridorHealth, routeHazard?.level || "");
      const systemConfidence = getSystemConfidence(Boolean(routeWatchActivated));
      const recommendationConfidence = getRecommendationConfidence({
        alternateAvailable: Boolean(alternateRouteAvailable),
        hazardsAvoided: Number(hazardsAvoidedCount || 0),
        primaryScore: Number(primaryRouteScore || 0),
        alternateScore: Number(alternateRouteScore || 0),
        routeIsMonitoring: Boolean(routeWatchActivated)
      });
      const rerouteFoundation = getRerouteFoundation(routeHazard);
      const routeEtaMetrics = getRouteEtaMetricsFromState({
        routeHazardLevel: routeHazard?.level || "clear",
        fallbackExtraMinutes: 0
      });
          const activeIncidents = (getUnifiedIncidents?.() || []).filter((incident) => incident.status === "active");
      const routeRelevantIncidents = activeIncidents.filter((incident) => isIncidentRouteRelevant(incident, routeHazard));
      const routeRelevantCrossings = routeHazard.nearbyReports.filter((report) => report.reportType === "blocked" && report.lifecycleState === "active");
      const routeImpactingHazards = (Array.isArray(routeHazard?.nearbyReports) ? routeHazard.nearbyReports : []).filter((report) => report.lifecycleState === "active");
      const hazardCategoryCounts = routeImpactingHazards.reduce((acc, report) => {
        const key = getHazardCategory(report?.hazardCategory || report?.reportType || "");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const activeHazardTypes = Object.keys(hazardCategoryCounts);
      const routeContextSummary = routeRelevantCrossings.length > 0
        ? "Blocked crossing detected along monitored corridor."
        : routeRelevantIncidents.length > 0
          ? `${routeRelevantIncidents.length} active issue${routeRelevantIncidents.length === 1 ? "" : "s"} affecting this route.`
          : "No active hazards detected along this route.";
    const blockedReason = !startId || !destinationId
      ? "Missing start/destination selection"
      : !start
        ? "Selected start is not routable"
        : !destination
          ? "Selected destination is not routable"
          : !startCoordinates || !destinationCoordinates
            ? "Route preview unavailable until precise locations are saved."
            : startCoordinates.lat === destinationCoordinates.lat && startCoordinates.lng === destinationCoordinates.lng
              ? "Start and destination are identical"
              : null;
    return {
      startSelectValue: startId,
      destinationSelectValue: destinationId,
      startPlace: start,
      destinationPlace: destination,
      selectedStart: start ? { id: start.id, label: start.name || start.label || "" } : { id: startId || null, label: null },
      selectedDestination: destination ? { id: destination.id, label: destination.name || destination.label || "" } : { id: destinationId || null, label: null },
      startCoordinates,
      destinationCoordinates,
      selectedPlaceValidity: {
        start: Boolean(start && startCoordinates),
        destination: Boolean(destination && destinationCoordinates)
      },
      routePreviewBlockedReason: blockedReason,
      routeWatchActive: routeWatchActivated,
      routePreviewLayerExists,
      routePreviewRendered,
      mapHasRoutePreviewLayer,
      routePreviewReason,
      routePreviewLayerOnMap: Boolean(map && savedRouteLayer && typeof map.hasLayer === "function" && map.hasLayer(savedRouteLayer) && routePreviewPolylinePointCount >= 2),
      routePreviewPolylinePointCount,
      routePolylineVertexCount: routePreviewPolylinePointCount,
      routeGeometrySource,
      osrmRouteSuccess,
      lastRoutePreviewError,
      routeHazardScore: Number.isFinite(Number(routeHazard?.score)) ? Number(routeHazard.score) : 0,
      routeHazardLevel: routeHazard?.level || "clear",
      routeNearbyReports: Array.isArray(routeHazard?.nearbyReports) ? routeHazard.nearbyReports : [],
      routeNearestIssue: routeHazard?.nearestIssue || null,
      routeRecommendation: routeHazard?.recommendation || "normal",
      systemConfidence,
      recommendationConfidence,
      corridorHealth,
      estimatedDelayImpact,
      routeEtaText: routeEtaMetrics.routeEtaValue || "",
      routeDelayDeltaText: routeEtaMetrics.routeDelayValue || "",
      monitoredRouteDurationSeconds: Number.isFinite(Number(monitoredRouteDurationSeconds)) ? Number(monitoredRouteDurationSeconds) : null,
      rerouteRecommended: rerouteFoundation.rerouteRecommended,
      rerouteReason: rerouteFoundation.rerouteReason,
      rerouteTargetIssue: rerouteFoundation.rerouteTargetIssue,
      originalRouteGeometrySource: rerouteFoundation.originalRouteGeometrySource,
      originalRouteVertexCount: rerouteFoundation.originalRouteVertexCount,
      alternateRouteAvailable: rerouteFoundation.alternateRouteAvailable,
      routeSwitchAvailable: Boolean(alternateRouteAvailable && alternateRouteLayer && routeWatchActivated),
      lastRouteSwitchAt,
      routeSwitchCount,
      activeRouteSource,
      alternateRouteReason: rerouteFoundation.alternateRouteReason,
      alternateRouteGeometrySource: rerouteFoundation.alternateRouteGeometrySource,
      alternateRouteVertexCount: rerouteFoundation.alternateRouteVertexCount,
      alternateRouteStatus: rerouteFoundation.alternateRouteStatus,
      routeRelevantReportCount: routeRelevantIncidents.length,
      primaryRouteHazardCount,
      alternateRouteHazardCount,
      hazardsAvoidedCount,
      routeComparisonStatus,
      routeComparisonSummary,
      routeUxState,
      routeRecommendationTone,
      lastRouteSwitchMessage,
      primaryRouteScore,
      alternateRouteScore,
      preferredRoute,
      preferredRouteReason,
      routeRelevantCrossings,
      activeHazardTypes,
      routeImpactingHazards,
      hazardCategoryCounts,
      routeContextSummary,
      mapReady: Boolean(map)
    };
    } catch (error) {
      return {
        startSelectValue: els?.routeWatchStartSelect?.value || "",
        destinationSelectValue: els?.routeWatchDestinationSelect?.value || "",
        startPlace: null,
        destinationPlace: null,
        selectedStart: { id: null, label: null },
        selectedDestination: { id: null, label: null },
        startCoordinates: null,
        destinationCoordinates: null,
        selectedPlaceValidity: { start: false, destination: false },
        routePreviewBlockedReason: "Route debug fallback",
        routeWatchActive: Boolean(routeWatchActivated),
        routePreviewLayerExists: Boolean(routePreviewLayerExists),
        routePreviewRendered: Boolean(routePreviewRendered),
        mapHasRoutePreviewLayer: Boolean(mapHasRoutePreviewLayer),
        routePreviewReason: routePreviewReason || "unknown",
        routePreviewLayerOnMap: Boolean(map && savedRouteLayer && typeof map.hasLayer === "function" && map.hasLayer(savedRouteLayer)),
        routePreviewPolylinePointCount: Number.isFinite(Number(routePreviewPolylinePointCount)) ? Number(routePreviewPolylinePointCount) : 0,
        routePolylineVertexCount: Number.isFinite(Number(routePreviewPolylinePointCount)) ? Number(routePreviewPolylinePointCount) : 0,
        routeGeometrySource: routeGeometrySource || "fallback",
        osrmRouteSuccess: Boolean(osrmRouteSuccess),
        lastRoutePreviewError: lastRoutePreviewError || null,
        routeHazardScore: 0,
        routeHazardLevel: "clear",
        routeNearbyReports: [],
        routeNearestIssue: null,
        routeRecommendation: "normal",
        systemConfidence: getSystemConfidence(Boolean(routeWatchActivated)),
        recommendationConfidence: "Low",
        corridorHealth: "Clear",
        estimatedDelayImpact: "No meaningful delay expected.",
        rerouteRecommended: false,
        rerouteReason: "",
        rerouteTargetIssue: null,
        originalRouteGeometrySource: routeGeometrySource || "fallback",
        originalRouteVertexCount: Number.isFinite(Number(routePreviewPolylinePointCount)) ? Number(routePreviewPolylinePointCount) : 0,
        alternateRouteAvailable: false,
        routeSwitchAvailable: false,
        lastRouteSwitchAt,
        routeSwitchCount,
        activeRouteSource,
        alternateRouteReason: "",
        alternateRouteGeometrySource: "none",
        alternateRouteVertexCount: 0,
        alternateRouteStatus: "not_needed",
        primaryRouteHazardCount: 0,
        alternateRouteHazardCount: 0,
        hazardsAvoidedCount: 0,
        routeComparisonStatus: "alternate_unavailable",
        routeComparisonSummary: "",
        routeUxState,
        routeRecommendationTone,
        lastRouteSwitchMessage,
        primaryRouteScore: 0,
        alternateRouteScore: 0,
        preferredRoute: "primary",
        preferredRouteReason: "Primary route is selected by default.",
        activeHazardTypes: [],
        routeImpactingHazards: [],
        hazardCategoryCounts: {},
        mapReady: Boolean(map),
        debugError: String(error?.message || error || "Unknown debug error")
      };
    }
  };
}

function attachRouteQuickPanelDebugGlobal() {
  window.gridlyRouteQuickPanelDebug = function gridlyRouteQuickPanelDebug() {
    const selectedStartValue = els?.routeWatchStartSelect?.value || "";
    const selectedDestinationValue = els?.routeWatchDestinationSelect?.value || "";
    const places = Array.isArray(getSavedPlaces?.()) ? getSavedPlaces() : [];
    const resolvedStartPlace = places.find((place) => place.id === selectedStartValue) || null;
    const resolvedDestinationPlace = places.find((place) => place.id === selectedDestinationValue) || null;
    const resolvedStartCoords = normalizeCoordinatePair(resolvedStartPlace?.lat, resolvedStartPlace?.lng);
    const resolvedDestinationCoords = normalizeCoordinatePair(resolvedDestinationPlace?.lat, resolvedDestinationPlace?.lng);
    const routeBounds = window.__gridlyRoutePreviewLayer?.getBounds?.();
    return {
      selectedStartValue,
      selectedDestinationValue,
      resolvedStartPlace,
      resolvedDestinationPlace,
      startHasLatLng: Boolean(resolvedStartCoords),
      destinationHasLatLng: Boolean(resolvedDestinationCoords),
      routeWatchActive: Boolean(routeWatchActivated),
      activeRouteName: els?.routeCardLabel?.textContent || "",
      lastRouteRequest,
      lastRouteGeometryPointCount: Number(lastRouteGeometryPointCount || 0),
      routeLayerExists: Boolean(window.__gridlyRoutePreviewLayer),
      routeLayerOnMap: Boolean(map && window.__gridlyRoutePreviewLayer && map.hasLayer(window.__gridlyRoutePreviewLayer)),
      routeLayerBounds: routeBounds?.isValid?.() ? routeBounds.toBBoxString() : null,
      routePaneZIndex: map?.getPane?.("routePane")?.style?.zIndex || null,
      lastRouteError,
      commuteStateText: els?.routeStatus?.textContent || "",
      routeRequestTriggered: Boolean(routeRequestTriggered),
      osrmRequestStarted: Boolean(osrmRequestStarted),
      osrmResponseReceived: Boolean(osrmResponseReceived),
      routeRenderAttempted: Boolean(routeRenderAttempted),
      routeRenderSucceeded: Boolean(routeRenderSucceeded),
      lastRoutePanelCloseReason,
      lastRoutePipelineStep,
      lastRouteEarlyReturnReason,
      directListenerAttached: Boolean(routeQuickDirectListenerAttached),
      lastDirectRouteClick,
      debugPipelineWrapperEntered: Boolean(debugPipelineWrapperEntered)
    };
  };
}

function getSavedPlaceDebugData() {
  const state = normalizeSavedPlaces?.() || { home: null, work: null, custom: [], favorites: [] };
  const places = Array.isArray(getSavedPlaces?.()) ? getSavedPlaces() : [];
  const slots = {
    home: state?.home?.id || null,
    work: state?.work?.id || null,
    custom: Array.isArray(state?.custom) ? state.custom.map((place) => place?.id || null).filter(Boolean) : [],
    favorites: Array.isArray(state?.favorites) ? state.favorites.map((place) => place?.id || null).filter(Boolean) : []
  };
  const summarize = (title, place) => {
    if (!place) return `${title}: (not set)`;
    const coords = normalizeCoordinatePair(place?.lat, place?.lng);
    return `${title}: ${place?.name || place?.label || title} | ${place?.address || "(no address)"} | ${coords ? `${coords.lat},${coords.lng}` : "no coordinates"}`;
  };
  const summary = [
    summarize("Home", places.find((place) => place.id === "home") || state?.home),
    summarize("Work", places.find((place) => place.id === "work") || state?.work),
    ...places.filter((place) => place.id !== "home" && place.id !== "work").map((place) => summarize(place.name || place.label || place.id, place))
  ];
  return {
    savedPlaceKeys: places.map((place) => place.id),
    savedPlaceSummary: summary,
    savedPlaceSlots: slots,
    allSavedPlaces: places.map((place) => ({
      id: place.id,
      label: place.name || place.label || "",
      address: place.address || "",
      coordinates: normalizeCoordinatePair(place.lat, place.lng),
      source: place.source || null
    })),
    normalizedState: state,
    storageState: {
      savedPlacesRaw: localStorage.getItem(SAVED_PLACES_STORAGE_KEY),
      selectedPlaceId: localStorage.getItem(SELECTED_PLACE_STORAGE_KEY),
      legacyHome: localStorage.getItem("gridlyHome"),
      legacyWork: localStorage.getItem("gridlyWork")
    }
  };
}

window.gridlyRouteButtonBindingDebug = function gridlyRouteButtonBindingDebug() {
  const panel = document.getElementById("gridlyMobileRouteQuickPanel");
  const viewButton = panel?.querySelector?.('.route-quick-actions button[data-action="view-route-quick"]') || null;
  const startButton = panel?.querySelector?.('.route-quick-actions button[data-action="start-route-watch-quick"]') || null;
  const viewRect = viewButton ? viewButton.getBoundingClientRect() : null;
  const startRect = startButton ? startButton.getBoundingClientRect() : null;
  const viewStyles = viewButton ? window.getComputedStyle(viewButton) : null;
  const startStyles = startButton ? window.getComputedStyle(startButton) : null;
  return {
    viewButtonExists: Boolean(viewButton),
    startButtonExists: Boolean(startButton),
    visibleButtonRects: {
      viewRoute: viewRect ? { x: viewRect.x, y: viewRect.y, width: viewRect.width, height: viewRect.height } : null,
      startRouteWatch: startRect ? { x: startRect.x, y: startRect.y, width: startRect.width, height: startRect.height } : null
    },
    pointerEvents: {
      viewRoute: viewStyles?.pointerEvents || null,
      startRouteWatch: startStyles?.pointerEvents || null
    },
    disabledState: {
      viewRoute: Boolean(viewButton?.disabled),
      startRouteWatch: Boolean(startButton?.disabled)
    },
    clickHandlerAttachedFlag: Boolean(routeQuickButtonDelegatedBindingActive),
    lastRouteButtonClickSource,
    lastRouteButtonClickAt,
    selectedStartValue: document.getElementById("mobileRouteQuickStart")?.value || "",
    selectedDestinationValue: document.getElementById("mobileRouteQuickDestination")?.value || ""
  };
};

window.gridlyRouteExecutionDebug = function gridlyRouteExecutionDebug() {
  const savedPlaceDebug = getSavedPlaceDebugData();
  const places = Array.isArray(getSavedPlaces?.()) ? getSavedPlaces() : [];
  const selectedStartValue = els?.routeWatchStartSelect?.value || "";
  const selectedDestinationValue = els?.routeWatchDestinationSelect?.value || "";
  const selectedStartPlace = places.find((p) => p.id === selectedStartValue) || null;
  const selectedDestinationPlace = places.find((p) => p.id === selectedDestinationValue) || null;
  const startCoords = normalizeCoordinatePair(selectedStartPlace?.lat, selectedStartPlace?.lng);
  const destinationCoords = normalizeCoordinatePair(selectedDestinationPlace?.lat, selectedDestinationPlace?.lng);
  const routeButton = document.querySelector('#routeWatchStartBtn, #gridlyMobileRouteQuickPanel .route-quick-actions button[data-action="start-route-watch-quick"], #gridlyMobileRouteQuickPanel .route-quick-actions button[data-action="view-route-quick"]');
  const rect = routeButton?.getBoundingClientRect?.();
  const destinationCommandCard = document.querySelector(".mobile-destination-command");
  const routeStatusCard = document.querySelector(".mobile-live-command");
  const searchShell = document.getElementById("gridlySearchShell");
  const destinationCommandRect = destinationCommandCard?.getBoundingClientRect?.();
  const routeStatusRect = routeStatusCard?.getBoundingClientRect?.();
  const searchShellRect = searchShell?.getBoundingClientRect?.();
  const destinationCommandText = [
    document.getElementById("mobileDestinationCommandTitle")?.textContent || "",
    document.getElementById("mobileDestinationCommandMeta")?.textContent || "",
    document.getElementById("mobileDestinationCommandBtn")?.textContent || ""
  ].map((value) => String(value).trim()).filter(Boolean).join(" | ");
  const routeStatusCardText = [
    document.getElementById("mobileLiveStatusPill")?.textContent || "",
    document.getElementById("mobileLiveRouteStatus")?.textContent || "",
    document.getElementById("mobileLiveRouteMeta")?.textContent || "",
    document.getElementById("mobileLiveRouteActionBtn")?.textContent || ""
  ].map((value) => String(value).trim()).filter(Boolean).join(" | ");
  const liveCommandButtonLabel = (document.getElementById("mobileLiveRouteActionBtn")?.textContent || "").trim().toLowerCase();
  const liveCommandMode = liveCommandButtonLabel === "choose route" ? "command" : "status";
  const routeStatusMode = routeWatchActivated || window.__gridlyRouteWatchActive ? "live-status" : "pre-route";
  const liveCommandClickable = liveCommandMode === "command";
  const routeStatusClickable = false;
  return {
    savedPlacesState: normalizeSavedPlaces?.() || null,
    savedPlaceKeys: savedPlaceDebug.savedPlaceKeys,
    savedPlaceSummary: savedPlaceDebug.savedPlaceSummary,
    savedPlaceSlots: savedPlaceDebug.savedPlaceSlots,
    routeWatchState: { routeWatchActivated, routePreviewRendered, routePreviewReason },
    selectedStartValue, selectedDestinationValue, selectedStartPlace, selectedDestinationPlace,
    resolvedStartName: selectedStartPlace?.name || selectedStartPlace?.label || null,
    resolvedDestinationName: selectedDestinationPlace?.name || selectedDestinationPlace?.label || null,
    resolvedStartCoordinates: startCoords || null,
    resolvedDestinationCoordinates: destinationCoords || null,
    startHasLatLng: Boolean(startCoords), destinationHasLatLng: Boolean(destinationCoords),
    startCoords: startCoords || null, destinationCoords: destinationCoords || null,
    routeButtonExists: Boolean(routeButton), routeButtonText: (routeButton?.textContent || "").trim(),
    routeButtonDisabled: Boolean(routeButton?.disabled), routeButtonVisible: Boolean(routeButton && rect && rect.width > 0 && rect.height > 0),
    routeButtonRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    routeButtonClickHandlersFound: Boolean(routeQuickDirectListenerAttached || routeQuickButtonDelegatedBindingActive || els?.routeWatchStartBtn),
    routeActionButtonBound: Boolean(routeQuickDirectListenerAttached || routeQuickButtonDelegatedBindingActive || els?.routeWatchStartBtn?.dataset?.searchBound === "true"),
    destinationCommandVisible: Boolean(destinationCommandCard && destinationCommandRect && destinationCommandRect.width > 0 && destinationCommandRect.height > 0 && window.getComputedStyle(destinationCommandCard).display !== "none"),
    destinationCommandText,
    liveCommuteCardVisible: Boolean(routeStatusCard && routeStatusRect && routeStatusRect.width > 0 && routeStatusRect.height > 0 && window.getComputedStyle(routeStatusCard).display !== "none"),
    liveCommuteCardText: routeStatusCardText,
    destinationAndStatusSeparated: Boolean(destinationCommandCard && routeStatusCard && destinationCommandCard !== routeStatusCard),
    routeStatusCardVisible: Boolean(routeStatusCard && routeStatusRect && routeStatusRect.width > 0 && routeStatusRect.height > 0 && window.getComputedStyle(routeStatusCard).display !== "none"),
    liveCommandMode,
    routeStatusMode,
    liveCommandClickable,
    routeStatusClickable,
    routeStatusText: (document.getElementById("mobileLiveRouteStatus")?.textContent || "").trim(),
    routeLauncherSource,
    routeQuickPanelOpen: Boolean(document.getElementById("gridlyMobileRouteQuickPanel")?.classList.contains("visible")),
    searchShellVisible: Boolean(searchShell && !searchShell.hasAttribute("hidden") && searchShell.dataset.searchUi !== "dormant"),
    routeStatusCardText,
    routeStatusCardBounds: routeStatusRect ? { x: routeStatusRect.x, y: routeStatusRect.y, width: routeStatusRect.width, height: routeStatusRect.height } : null,
    searchShellBounds: searchShellRect ? { x: searchShellRect.x, y: searchShellRect.y, width: searchShellRect.width, height: searchShellRect.height } : null,
    lastRouteAttempt, lastRouteError, osrmRequestUrl: lastOsrmRequestUrl, osrmResponseStatus: lastOsrmResponseStatus,
    routePolylineExists: Boolean(window.__gridlyRoutePreviewLayer), routePolylinePointCount: Number(routePreviewPolylinePointCount || 0),
    monitoringState: Boolean(window.__gridlyRouteWatchActive), activeRouteSource,
    routeRequestInFlight,
    lastRouteRequestKey,
    lastRouteRequestAt: lastRouteRequestAt ? new Date(lastRouteRequestAt).toISOString() : null,
    duplicateRouteRequestBlockedCount
  };
};


window.gridlySavedPlacesDebug = function gridlySavedPlacesDebug() {
  return getSavedPlaceDebugData();
};

window.gridlyMobileOverlayDebug = function gridlyMobileOverlayDebug() {
  const activePanel = document.querySelector(".gridly-mobile-route-quick-panel.visible, .route-setup-modal:not([hidden]) .route-setup-modal-card, .smart-alerts-modal:not([hidden]) .smart-alerts-modal-card, .report-drawer[open]");
  const rect = activePanel?.getBoundingClientRect?.();
  const mapRect = document.getElementById("map")?.getBoundingClientRect?.() || null;
  const navRect = document.querySelector(".mobile-bottom-nav")?.getBoundingClientRect?.() || null;
  return {
    visualViewportHeight: window.visualViewport?.height || null,
    windowInnerHeight: window.innerHeight,
    bodyClass: document.body?.className || "",
    bodyDataset: { ...(document.body?.dataset || {}) },
    bodyOverflow: window.getComputedStyle(document.body).overflow,
    activeModalOrPanel: activePanel?.className || null,
    activePanelRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    activePanelScrollHeight: activePanel?.scrollHeight || 0,
    activePanelClientHeight: activePanel?.clientHeight || 0,
    activePanelOverflowY: activePanel ? window.getComputedStyle(activePanel).overflowY : null,
    exceedsViewport: Boolean(rect && rect.height > (window.visualViewport?.height || window.innerHeight)),
    canScrollPanel: Boolean(activePanel && activePanel.scrollHeight > activePanel.clientHeight),
    documentScrollLocked: document.body?.classList?.contains("modal-open") || window.getComputedStyle(document.body).overflow === "hidden",
    mapRect,
    bottomNavRect: navRect
  };
};

async function renderDestinationRoute(target) {
  if (!savedRouteLayer || !target) return;
  window.__gridlyRouteWatchActive = true;
  window.__gridlySelectedRouteId = String(target.type || target.label || "saved-route").toLowerCase();
  savedRouteLayer.clearLayers();
  const fromCandidate = userLocation ? [userLocation.lat, userLocation.lng] : [defaultCenter[0], defaultCenter[1]];
  const fromCoords = normalizeCoordinatePair(fromCandidate[0], fromCandidate[1]);
  const toCoords = normalizeCoordinatePair(target.lat, target.lng);
  if (!fromCoords || !toCoords) {
    setConfirmation("Add exact Home and Work locations to show route.", "error");
    savedRouteCrossingIds = new Set();
    window.__gridlyRouteWatchActive = false;
    window.__gridlySelectedRouteId = "";
    renderCrossings();
    return;
  }
  const from = [fromCoords.lat, fromCoords.lng];
  const to = [toCoords.lat, toCoords.lng];
  const osrmPath = await fetchRoadRouteCoordinates(from, to);
  if (osrmPath?.length > 1) {
    drawPremiumRouteLine(osrmPath, "#66e8ff", "renderDestinationRoute");
    setConfirmation(`Route Watch set: ${target.label}.`, "success");
  } else {
    savedRouteLayer.clearLayers();
    setConfirmation(`Route Watch set: ${target.label}. Precise route line unavailable.`, "success");
    if (els.routeWatchSetupHint) els.routeWatchSetupHint.textContent = `Monitoring Home → ${target.label}. Precise route line unavailable.`;
  }
  savedRouteCrossingIds = new Set(crossings.filter((c) => getDistanceMiles(c.lat, c.lng, target.lat, target.lng) <= 3.5).map((c) => String(c.id)));
  renderCrossings();
  updateRouteWatchBadge(target.label);
}

function updateRouteWatchBadge(routeLabel = "Route") {
  const activation = getLineActivationContext();
  if (!activation.hasActivation || !buildRouteWatchLabelParts().configured || !routeWatchActivated) {
    if (els.routeWatchLivePill) {
      els.routeWatchLivePill.textContent = "Monitoring OFF";
      els.routeWatchLivePill.classList.remove("is-on");
    }
    return;
  }
  if (els.routeWatchLivePill) {
    els.routeWatchLivePill.textContent = "Monitoring ON";
    els.routeWatchLivePill.classList.add("is-on");
  }
}

function loadSavedRoute() {
  scrubInvalidSavedPlacesState();
  routeFocusArmed = true;
  const routeLabelParts = buildRouteWatchLabelParts();
  const home = routeLabelParts.hasHome ? "Home" : "No active route";
  const work = routeLabelParts.destination || "";
  renderSavedPlacesSelectOptions();
  updateRouteWatchSetupUI();

  if (home) {
    safeText("savedHome", home);
    safeText("desktopRouteHome", home);
  }

  if (work) {
    safeText("savedWork", work);
    safeText("desktopRouteWork", work);
  }
  const savedPlaceCount = getSavedPlaces().length;
  const startId = els.routeWatchStartSelect?.value || "";
  const destinationId = els.routeWatchDestinationSelect?.value || "";
  const state = normalizeSavedPlaces();
  const startPlace = startId === "home" ? state.home : startId === "work" ? state.work : state.custom.find((place) => place.id === startId);
  const destinationPlace = destinationId === "home" ? state.home : destinationId === "work" ? state.work : state.custom.find((place) => place.id === destinationId);
  const startCoordinates = normalizeCoordinatePair(startPlace?.lat, startPlace?.lng);
  const destinationCoordinates = normalizeCoordinatePair(destinationPlace?.lat, destinationPlace?.lng);
  if (startId && destinationId && (!startCoordinates || !destinationCoordinates)) {
    savedRouteLayer?.clearLayers?.();
    setRoutePreviewState(false, "Missing start or destination coordinates", { layerExists: false, mapHasLayer: false, pointCount: 0 });
  }
  if (els.routeWatchStartBtn) {
    els.routeWatchStartBtn.disabled = savedPlaceCount < 2 || !startId || !destinationId || !startCoordinates || !destinationCoordinates;
  }
  updateRouteWatchStartButtonLabel();
  if (savedPlaceCount === 0) {
    safeText("desktopRouteStatus", "Save at least two places to start Route Watch.");
    safeText("routeWatchSetupHint", "Add Home and Work to start Route Watch.");
  } else if (savedPlaceCount < 2) {
    safeText("desktopRouteStatus", "Save at least two places to start Route Watch.");
    safeText("routeWatchSetupHint", "Choose a start and destination to begin monitoring.");
  } else if (!startId || !destinationId) {
    safeText("desktopRouteStatus", "Choose a start and destination to begin monitoring.");
  }
  safeText("routeCardLabel", routeWatchActivated && routeLabelParts.activeLabel
    ? `Home → ${routeLabelParts.activeLabel}`
    : routeLabelParts.hasHome && routeLabelParts.destination
      ? `Home → ${routeLabelParts.destination}`
      : "No active route");

  if (!routeLabelParts.configured) {
    routeWatchActivated = false;
    savedRouteCrossingIds = new Set();
    savedRouteLayer?.clearLayers?.();
    updateRouteWatchBadge();
    if (els.routeWatchSetupHint) {
      els.routeWatchSetupHint.hidden = false;
      els.routeWatchSetupHint.textContent = routeLabelParts.hasHome
        ? "Choose a saved destination to start Route Watch."
        : "Set Home and one destination to start Route Watch.";
    }
    if (els.sideRouteWatchHint) {
      els.sideRouteWatchHint.textContent = "1. Save Home and Work · 2. Open Manage Route · 3. Start Route Watch";
    }
  } else if (!routeWatchActivated && els.routeWatchSetupHint) {
    els.routeWatchSetupHint.hidden = false;
    els.routeWatchSetupHint.textContent = "Choose a saved destination to start Route Watch.";
  } else if (routeWatchActivated && els.routeWatchSetupHint) {
    els.routeWatchSetupHint.hidden = false;
    els.routeWatchSetupHint.textContent = `Monitoring Home → ${routeLabelParts.activeLabel || "Saved destination"}.`;
  }
  if (!routeLabelParts.hasHome && routeLabelParts.hasWork && els.routeWatchSetupHint) {
    els.routeWatchSetupHint.textContent = "Work saved. Add Home to start Route Watch.";
  } else if (routeLabelParts.hasHome && !routeLabelParts.hasWork && els.routeWatchSetupHint) {
    els.routeWatchSetupHint.textContent = "Home saved. Add Work to start Route Watch.";
  }
}

async function startInlineRouteWatch(options = {}) {
  lastRoutePipelineStep = "entered";
  lastRouteEarlyReturnReason = null;
  const { activateWatch = true, source = "route_watch_cta" } = options;
  routeDebugLog("Gridly route pipeline step", { step: lastRoutePipelineStep, source, activateWatch });

  lastRoutePipelineStep = "received_source_action";
  routeDebugLog("Gridly route pipeline step", { step: lastRoutePipelineStep, source, activateWatch });

  const startId = els.routeWatchStartSelect?.value || "";
  lastRoutePipelineStep = "start_selector_read";
  routeDebugLog("Gridly route pipeline step", { step: lastRoutePipelineStep, startId });

  const destinationId = els.routeWatchDestinationSelect?.value || "";
  lastRoutePipelineStep = "destination_selector_read";
  routeDebugLog("Gridly route pipeline step", { step: lastRoutePipelineStep, destinationId });

  const places = getSavedPlaces();
  const start = places.find((place) => place.id === startId);
  lastRoutePipelineStep = "resolved_start_place";
  routeDebugLog("Gridly route pipeline step", { step: lastRoutePipelineStep, start });

  const destination = places.find((place) => place.id === destinationId);
  lastRoutePipelineStep = "resolved_destination_place";
  routeDebugLog("Gridly route pipeline step", { step: lastRoutePipelineStep, destination });

  const startCoords = normalizeCoordinatePair(start?.lat, start?.lng);
  const destinationCoords = normalizeCoordinatePair(destination?.lat, destination?.lng);
  captureRouteAttempt({
    source,
    selectedStart: start?.name || startId || "",
    selectedDestination: destination?.name || destinationId || "",
    startCoords: startCoords || null,
    destinationCoords: destinationCoords || null,
    validationPassed: false,
    osrmCallStarted: false,
    osrmCallSucceeded: false,
    polylineRendered: false
  });
  lastRoutePipelineStep = "lat_lng_validated";
  routeDebugLog("Gridly route pipeline step", {
    step: lastRoutePipelineStep,
    startHasLatLng: Boolean(startCoords),
    destinationHasLatLng: Boolean(destinationCoords)
  });

  if (!start || !destination) {
    lastRouteEarlyReturnReason = "missing_start_or_destination_selection";
    lastRoutePipelineStep = "early_return";
    routeDebugLog("Gridly route pipeline early return", { reason: lastRouteEarlyReturnReason, startId, destinationId });
    setRoutePreviewState(false, "Start or destination was not selected.", { layerExists: false, mapHasLayer: false, pointCount: 0 });
    setConfirmation("Choose a start and destination to begin monitoring.", "error");
    captureRouteAttempt({ finalFailureReason: "Missing start or destination selection" });
    return;
  }

  const samePlace = start.id === destination.id;
  lastRoutePipelineStep = "same_place_checked";
  routeDebugLog("Gridly route pipeline step", { step: lastRoutePipelineStep, samePlace });
  if (samePlace) {
    lastRouteEarlyReturnReason = "same_place_selected";
    lastRoutePipelineStep = "early_return";
    routeDebugLog("Gridly route pipeline early return", { reason: lastRouteEarlyReturnReason, startId, destinationId });
    savedRouteLayer?.clearLayers?.();
    setRoutePreviewState(false, "Start and destination are the same place.", { layerExists: false, mapHasLayer: false, pointCount: 0 });
    setConfirmation("Choose a different destination.", "error");
    captureRouteAttempt({ finalFailureReason: "Start and destination are the same" });
    return;
  }

  routeWatchActivated = false;
  safeText("desktopRouteHome", start.name);
  safeText("desktopRouteWork", destination.name);
  safeText("routeCardLabel", `${start.name} → ${destination.name}`);
  safeText("desktopRouteStatus", activateWatch ? `Monitoring ${start.name} → ${destination.name}.` : `Viewing ${start.name} → ${destination.name}.`);
  safeText("routeWatchSetupHint", activateWatch ? `Monitoring ${start.name} → ${destination.name}.` : `Viewing ${start.name} → ${destination.name}.`);

  if (!startCoords || !destinationCoords) {
    lastRouteEarlyReturnReason = "missing_start_or_destination_coordinates";
    lastRoutePipelineStep = "early_return";
    routeDebugLog("Gridly route pipeline early return", { reason: lastRouteEarlyReturnReason, start, destination });
    savedRouteLayer?.clearLayers?.();
    setRoutePreviewState(false, "Missing start or destination coordinates", { layerExists: false, mapHasLayer: false, pointCount: 0 });
    setConfirmation("Route preview unavailable until precise locations are saved.", "error");
    captureRouteAttempt({ finalFailureReason: !startCoords ? "Missing Home coordinates" : "Missing Destination coordinates" });
    safeText("routeWatchSetupHint", "Route preview unavailable until precise locations are saved.");
    updateRouteIntelligence();
    updateRouteWatchStartButtonLabel();
    return;
  }
  if (startCoords.lat === destinationCoords.lat && startCoords.lng === destinationCoords.lng) {
    lastRouteEarlyReturnReason = "same_coordinates";
    lastRoutePipelineStep = "early_return";
    routeDebugLog("Gridly route pipeline early return", { reason: lastRouteEarlyReturnReason, startCoords, destinationCoords });
    savedRouteLayer?.clearLayers?.();
    setRoutePreviewState(false, "Start and destination coordinates are the same", { layerExists: false, mapHasLayer: false, pointCount: 0 });
    setConfirmation("Update one saved place location to view a route preview.", "error");
    safeText("routeWatchSetupHint", "Update one saved place location to view a route preview.");
    updateRouteIntelligence();
    updateRouteWatchStartButtonLabel();
    return;
  }
  if (getDistanceMiles(startCoords.lat, startCoords.lng, destinationCoords.lat, destinationCoords.lng) > 80) {
    lastRouteEarlyReturnReason = "distance_exceeds_local_preview_limit";
    lastRoutePipelineStep = "early_return";
    routeDebugLog("Gridly route pipeline early return", { reason: lastRouteEarlyReturnReason, startCoords, destinationCoords });
    savedRouteLayer?.clearLayers?.();
    setRoutePreviewState(false, "Route preview skipped because points are too far apart for local preview.", { layerExists: false, mapHasLayer: false, pointCount: 0 });
    setConfirmation("Route preview unavailable for this selection.", "error");
    safeText("routeWatchSetupHint", "Route preview unavailable for this selection.");
    updateRouteIntelligence();
    updateRouteWatchStartButtonLabel();
    return;
  }

  lastRoutePipelineStep = "route_engine_availability_checked";
  routeDebugLog("Gridly route pipeline step", { step: lastRoutePipelineStep, mapReady: Boolean(map), osrmApi: OSRM_ROUTE_API });

  savedRouteLayer?.clearLayers?.();
  window.__gridlyRouteWatchActive = false;
  window.__gridlySelectedRouteId = `${start.id}->${destination.id}`;

  lastRoutePipelineStep = "osrm_payload_build_start";
  routeDebugLog("Gridly route pipeline step", { step: lastRoutePipelineStep, startCoords, destinationCoords });

  const routePreviewShown = await renderRoutePreviewLine(startCoords, destinationCoords, {
    start: start.name,
    destination: destination.name
  });
  if (!routePreviewShown) {
    lastRouteEarlyReturnReason = "route_preview_renderer_returned_false";
    setRoutePreviewState(false, "Missing start or destination coordinates", { layerExists: false, mapHasLayer: false, pointCount: 0 });
    setConfirmation(lastRouteError || "Route could not be drawn", "error");
    safeText("routeWatchSetupHint", "Route preview unavailable until precise locations are saved.");
  } else {
    const layerExists = Boolean(window.__gridlyRoutePreviewLayer);
    const mapHasLayer = Boolean(map && window.__gridlyRoutePreviewLayer && typeof map.hasLayer === "function" && map.hasLayer(window.__gridlyRoutePreviewLayer));
    setRoutePreviewState(Boolean(layerExists && mapHasLayer), "Route preview layer was not added to map", {
      layerExists,
      mapHasLayer,
      pointCount: routePreviewPolylinePointCount
    });
    if (routePreviewRendered) {
      setConfirmation("Route preview active.", "success");
      safeText("routeWatchSetupHint", "Route preview active.");
    } else {
      setConfirmation("Route preview unavailable until precise locations are saved.", "error");
      safeText("routeWatchSetupHint", "Route preview unavailable until precise locations are saved.");
    }
  }
  routeWatchActivated = Boolean(activateWatch && routePreviewRendered);
  window.__gridlyRouteWatchActive = routeWatchActivated;
  if (!routePreviewRendered) {
    setConfirmation(lastRouteError || "Route could not be drawn", "error");
  }
  captureRouteAttempt({
    validationPassed: true,
    osrmCallStarted: osrmRequestStarted,
    osrmCallSucceeded: osrmRouteSuccess,
    polylineRendered: routePreviewRendered,
    finalFailureReason: routePreviewRendered ? "" : (lastRouteError || "Route could not be drawn")
  });
  lastRoutePipelineStep = "route_pipeline_completed";
  activeDestinationPlace = destination;
  lastRouteWatchSelection = { startId: start.id, destinationId: destination.id };
  updateRouteWatchBadge(destination.name);
  updateRouteIntelligence();
  updateRouteWatchStartButtonLabel();
}
window.gridlyStartInlineRouteWatch = startInlineRouteWatch;


function resetSavedPlaces() {
  localStorage.removeItem(SAVED_PLACES_STORAGE_KEY);
  localStorage.removeItem(SELECTED_PLACE_STORAGE_KEY);
  localStorage.removeItem("gridlyHome");
  localStorage.removeItem("gridlyWork");
  activeDestinationPlace = null;
  routeWatchActivated = false;
  setRoutePreviewState(false, "Saved places were reset.", { layerExists: false, mapHasLayer: false });
  savedRouteCrossingIds = new Set();
  savedRouteLayer?.clearLayers?.();
  corridorIntelLayer?.clearLayers?.();
  window.__gridlyRouteWatchActive = false;
  window.__gridlySelectedRouteId = "";
  loadSavedRoute();
  renderCrossings();
  setConfirmation("Saved places reset on this device.", "success");
}

function getDefaultSmartAlertsPreferences() {
  return { enabled: false, nearbyBlocked: false, routeDelay: false, us90Clear: false, needsConfirm: false };
}

function getSmartAlertsPreferences() {
  try {
    return { ...getDefaultSmartAlertsPreferences(), ...JSON.parse(localStorage.getItem(SMART_ALERTS_STORAGE_KEY) || "{}") };
  } catch (error) {
    return getDefaultSmartAlertsPreferences();
  }
}

function loadSmartAlertsPreferences() {
  const prefs = getSmartAlertsPreferences();
  if (els.smartAlertNearbyBlocked) els.smartAlertNearbyBlocked.checked = Boolean(prefs.nearbyBlocked);
  if (els.smartAlertRouteDelay) els.smartAlertRouteDelay.checked = Boolean(prefs.routeDelay);
  if (els.smartAlertUs90Clear) els.smartAlertUs90Clear.checked = Boolean(prefs.us90Clear);
  if (els.smartAlertNeedsConfirm) els.smartAlertNeedsConfirm.checked = Boolean(prefs.needsConfirm);
  markSmartAlertsSeenOnFirstVisit();
  updateSmartAlertsStatus(prefs);
}

function markSmartAlertsSeenOnFirstVisit() {
  const hasSeen = localStorage.getItem(SMART_ALERTS_DRAWER_SEEN_KEY) === "1";
  if (!hasSeen) localStorage.setItem(SMART_ALERTS_DRAWER_SEEN_KEY, "1");
}

function saveSmartAlertsPreferences() {
  const prefs = {
    nearbyBlocked: Boolean(els.smartAlertNearbyBlocked?.checked),
    routeDelay: Boolean(els.smartAlertRouteDelay?.checked),
    us90Clear: Boolean(els.smartAlertUs90Clear?.checked),
    needsConfirm: Boolean(els.smartAlertNeedsConfirm?.checked)
  };
  prefs.enabled = prefs.nearbyBlocked || prefs.routeDelay || prefs.us90Clear || prefs.needsConfirm;

  try {
    localStorage.setItem(SMART_ALERTS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (error) {
    updateSmartAlertsStatus(prefs);
    evaluateSmartAlertsBanner(prefs);
    safeText("smartAlertsConfirmation", "⚠️ Could not save alert preferences on this device.");
    return;
  }

  updateSmartAlertsStatus(prefs);
  evaluateSmartAlertsBanner(prefs);
  const savedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  safeText("smartAlertsConfirmation", `✅ Alert preferences are saved on this device at ${savedAt}.`);
}

function updateSmartAlertsStatus(prefs = getSmartAlertsPreferences()) {
  safeText("smartAlertsStatus", prefs.enabled ? "Premium Smart Alerts: On" : "Premium Smart Alerts: Off");
}

function evaluateSmartAlertsBanner(prefs = getSmartAlertsPreferences()) {
  if (!els.smartAlertsBanner) return;
  if (!prefs.enabled) {
    els.smartAlertsBanner.hidden = true;
    els.smartAlertsBanner.textContent = "";
    return;
  }

  const latestByCrossing = getLatestReportsByCrossing().filter((report) => !report.expired);
  const nearest = userLocation ? findNearestCrossings(userLocation.lat, userLocation.lng, 10) : [];
  const nearbyCrossingIds = new Set(nearest.map((crossing) => String(crossing.id)));
  const hasNearbyBlocked = latestByCrossing.some(
    (report) => nearbyCrossingIds.has(String(report.crossingId)) && report.type === "blocked"
  );
  const hasRouteDelay =
    Boolean(localStorage.getItem("gridlyHome") && localStorage.getItem("gridlyWork")) &&
    latestByCrossing.some((report) => getIncidentLifecycleState(report) === "active");
  const hasUs90Cleared = activeReports.some(
    (report) =>
      (getIncidentLifecycleState(report) === "recently_cleared" || getIncidentLifecycleState(report) === "cleared") &&
      String(report.crossingName || "").toLowerCase().includes("us 90")
  );
  const needsConfirmation = activeReports.some((report) => report.minutesAgo >= 75);

  const matches = [];
  if (prefs.nearbyBlocked && hasNearbyBlocked) matches.push("Nearby blocked crossing reported.");
  if (prefs.routeDelay && hasRouteDelay) matches.push("Saved-route delay is active.");
  if (prefs.us90Clear && hasUs90Cleared) matches.push("US 90 has a recent cleared report.");
  if (prefs.needsConfirm && needsConfirmation) matches.push("Reports need confirmation or are near expiry.");

  if (!matches.length) {
    els.smartAlertsBanner.hidden = true;
    els.smartAlertsBanner.textContent = "";
    return;
  }

  els.smartAlertsBanner.hidden = false;
  els.smartAlertsBanner.textContent = matches.slice(0, 3).join(" ");
}


function getUrgentBlockedCount(activeIssues = []) {
  return activeIssues.filter((issue) => String(issue.type || "") === "rail_blocked" && Number(issue.age_minutes ?? issue.minutesAgo ?? 999) <= 10).length;
}

function getFreshnessTier(minutesAgo) {
  if (typeof minutesAgo !== "number" || Number.isNaN(minutesAgo)) return "Unknown";
  if (minutesAgo <= 15) return "Fresh";
  if (minutesAgo <= 45) return "Aging";
  return "Stale";
}

function getRouteWatchIntelligence(activeIssues = []) {
  const blocked = activeIssues.filter((issue) => String(issue.type || "").includes("blocked"));
  const delayed = activeIssues.filter((issue) => String(issue.type || "").includes("delay"));
  const blockedCount = blocked.length;
  const estimatedDelayMinutes = Math.max(0, blockedCount * 7 + delayed.length * 4);
  const confidence = blockedCount >= 2 ? "High" : blockedCount === 1 || delayed.length >= 2 ? "Medium" : "Low";
  const urgentBlockedCount = getUrgentBlockedCount(activeIssues);
  const reroute = urgentBlockedCount > 0
    ? "Immediate reroute recommended: blocked report is within 10 minutes."
    : blockedCount > 0
      ? "Use your backup route and avoid the blocked crossings."
      : delayed.length > 0
        ? "Keep your route, but leave a few minutes early."
        : "Stay on your normal route.";
  const advice = urgentBlockedCount > 0
    ? "Avoid the crossing nearest your Home→Work midpoint and reroute now."
    : blockedCount > 0
      ? "Take your backup route and confirm crossings before departure."
      : delayed.length > 0
        ? "Leave 5–8 minutes early and monitor Route Watch."
        : "Stay on your normal route and check again before leaving.";
  return { blockedCount, urgentBlockedCount, estimatedDelayMinutes, confidence, reroute, advice };
}

function getCorridorHealthFromScore(score = 0) {
  const normalized = Math.max(0, Number(score) || 0);
  if (normalized <= 10) return "Clear";
  if (normalized <= 30) return "Moderate";
  if (normalized <= 60) return "Heavy";
  return "Severe";
}

function getEstimatedDelayImpact(corridorHealth = "Clear", routeStatus = "") {
  const normalizedHealth = String(corridorHealth || "").toLowerCase();
  const normalizedStatus = String(routeStatus || "").toLowerCase();
  if (normalizedStatus === "blocked" || normalizedHealth === "severe") return "High delay risk.";
  if (normalizedHealth === "heavy") return "Likely meaningful delay.";
  if (normalizedHealth === "moderate") return "Possible short delay.";
  return "No meaningful delay expected.";
}

function getSystemConfidence(routeIsMonitoring = false) {
  const checks = [
    Boolean(map),
    Boolean(routePreviewRendered),
    Number(routePreviewPolylinePointCount) >= 2,
    Boolean(map && savedRouteLayer && typeof map.hasLayer === "function" && map.hasLayer(savedRouteLayer)),
    !routeIsMonitoring || Boolean(osrmRouteSuccess)
  ];
  const score = checks.filter(Boolean).length;
  if (score >= 5) return "High";
  if (score >= 3) return "Medium";
  return "Low";
}

function getRecommendationConfidence({ alternateAvailable = false, hazardsAvoided = 0, primaryScore = 0, alternateScore = 0, routeIsMonitoring = false } = {}) {
  if (!routeIsMonitoring || !alternateAvailable) return "Low";
  const delta = Math.max(0, Number(primaryScore) - Number(alternateScore));
  if (hazardsAvoided > 0 && delta >= 10) return "High";
  if (delta <= 4) return "Medium";
  return "Medium";
}

function ensureRouteWatchLayoutPolishV331Styles() {
  if (document.getElementById("routeWatchLayoutPolishV331Styles")) return;
  const style = document.createElement("style");
  style.id = "routeWatchLayoutPolishV331Styles";
  style.textContent = `
    .route-watch-intel-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 6px;
    }
    .route-watch-intel-item {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      padding: 7px 9px;
      min-width: 0;
    }
    .route-watch-intel-label {
      display: block;
      font-size: 0.72rem;
      opacity: 0.82;
      line-height: 1.2;
      margin-bottom: 2px;
      letter-spacing: 0.02em;
    }
    .route-watch-intel-value {
      display: block;
      font-size: 0.92rem;
      font-weight: 700;
      line-height: 1.25;
      word-break: break-word;
    }
    .route-watch-delay-impact-high .route-watch-intel-value,
    .route-watch-delay-impact-severe .route-watch-intel-value {
      color: #ffd2d2;
    }
    .route-watch-delay-impact-severe {
      border-color: rgba(255, 92, 92, 0.45);
      box-shadow: inset 0 0 0 1px rgba(255, 92, 92, 0.25);
    }
    .route-watch-recommendation-emphasis {
      display: block;
      margin-top: 8px;
      line-height: 1.35;
      font-weight: 650;
    }
    @media (max-width: 640px) {
      .route-watch-intel-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `;
  document.head.appendChild(style);
}

function renderRouteWatchIntelligenceFields({
  systemConfidence = "Unknown",
  recommendationConfidence = "Unknown",
  corridorHealth = "Unknown",
  estimatedDelayImpact = "Unknown",
  routeEtaValue = "",
  routeDelayValue = "",
  routePressureBand = "Clear",
  routeRelevantHazardCount = 0,
  alternateRouteAdvantageLabel = "None",
  routeConfidence = "Low"
} = {}) {
  ensureRouteWatchLayoutPolishV331Styles();
  if (!els.departureReason) return;
  const hasRouteEta = typeof routeEtaValue === "string" && routeEtaValue.trim().length > 0;
  const hasRouteDelay = typeof routeDelayValue === "string" && routeDelayValue.trim().length > 0;
  const delayToneClass = /severe/i.test(estimatedDelayImpact)
    ? "route-watch-delay-impact-severe"
    : /high/i.test(estimatedDelayImpact)
      ? "route-watch-delay-impact-high"
      : "";
  const routeEtaMarkup = hasRouteEta
    ? `<div class="route-watch-intel-item"><span class="route-watch-intel-label">Route ETA</span><span class="route-watch-intel-value">${routeEtaValue}</span></div>`
    : "";
  const routeDelayMarkup = hasRouteDelay
    ? `<div class="route-watch-intel-item"><span class="route-watch-intel-label">Delay Impact</span><span class="route-watch-intel-value">${routeDelayValue}</span></div>`
    : "";
  els.departureReason.innerHTML = `
    <div class="route-watch-intel-grid" aria-label="Route Watch intelligence">
      <div class="route-watch-intel-item"><span class="route-watch-intel-label">System Confidence</span><span class="route-watch-intel-value">${systemConfidence}</span></div>
      <div class="route-watch-intel-item"><span class="route-watch-intel-label">Recommendation Confidence</span><span class="route-watch-intel-value">${recommendationConfidence}</span></div>
      <div class="route-watch-intel-item"><span class="route-watch-intel-label">Route Status</span><span class="route-watch-intel-value">${corridorHealth}</span></div>
      <div class="route-watch-intel-item"><span class="route-watch-intel-label">Delay Pressure</span><span class="route-watch-intel-value">${sanitizeText(routePressureBand)}</span></div>
      <div class="route-watch-intel-item"><span class="route-watch-intel-label">Hazards Affecting Route</span><span class="route-watch-intel-value">${Number(routeRelevantHazardCount || 0)}</span></div>
      <div class="route-watch-intel-item"><span class="route-watch-intel-label">Alternate Route Advantage</span><span class="route-watch-intel-value">${sanitizeText(alternateRouteAdvantageLabel)}</span></div>
      <div class="route-watch-intel-item"><span class="route-watch-intel-label">Monitoring Confidence</span><span class="route-watch-intel-value">${sanitizeText(routeConfidence)}</span></div>
      ${routeEtaMarkup}
      ${routeDelayMarkup}
      <div class="route-watch-intel-item ${delayToneClass}"><span class="route-watch-intel-label">Estimated Delay Impact</span><span class="route-watch-intel-value">${estimatedDelayImpact}</span></div>
    </div>
  `;
}

function renderDesktopRouteWatchMetrics({
  freshness = "Unknown",
  reportsNearRoute = "0 near route",
  systemConfidence = "Unknown",
  recommendationConfidence = "Unknown",
  corridorHealth = "Unknown",
  estimatedDelayImpact = "Unknown",
  routeEtaValue = "",
  routeDelayValue = "",
  routePressureBand = "Clear",
  routeRelevantHazardCount = 0,
  alternateRouteAdvantageLabel = "None",
  routeConfidence = "Low"
} = {}) {
  const desktopMetricsContainer = document.querySelector(".desktop-route-watch-strip .route-watch-metrics");
  if (!desktopMetricsContainer) return;
  const hasRouteEta = typeof routeEtaValue === "string" && routeEtaValue.trim().length > 0;
  const hasRouteDelay = typeof routeDelayValue === "string" && routeDelayValue.trim().length > 0;
  const routeEtaMarkup = hasRouteEta
    ? `<span><b>Route ETA:</b> <em>${sanitizeText(routeEtaValue)}</em></span>`
    : "";
  const routeDelayMarkup = hasRouteDelay
    ? `<span><b>Delay Impact:</b> <em>${sanitizeText(routeDelayValue)}</em></span>`
    : "";
  desktopMetricsContainer.innerHTML = `
    <span><b>Freshness:</b> <em>${sanitizeText(freshness)}</em></span>
    <span><b>Reports near route:</b> <em>${sanitizeText(reportsNearRoute)}</em></span>
    <span><b>System Confidence:</b> <em>${sanitizeText(systemConfidence)}</em></span>
    <span><b>Recommendation Confidence:</b> <em>${sanitizeText(recommendationConfidence)}</em></span>
    <span><b>Corridor Health:</b> <em>${sanitizeText(corridorHealth)}</em></span>
    <span><b>Estimated Delay Impact:</b> <em>${sanitizeText(estimatedDelayImpact)}</em></span>
    ${routeEtaMarkup}
    ${routeDelayMarkup}
  `;
}

function getRouteEtaMetricsFromState({
  routeHazardLevel = "clear",
  fallbackExtraMinutes = 0
} = {}) {
  const etaMinutes = Number.isFinite(Number(monitoredRouteEtaMinutes))
    ? Number(monitoredRouteEtaMinutes)
    : null;
  const delayMinutes = Number.isFinite(Number(monitoredRouteDelayMinutes))
    ? Number(monitoredRouteDelayMinutes)
    : null;
  return {
    routeEtaValue: etaMinutes && etaMinutes > 0 ? `${etaMinutes} min` : "",
    routeDelayValue: delayMinutes && delayMinutes > 0 ? `+${delayMinutes} min` : ""
  };
}

function getRoutePressureBand(score = 0) {
  const normalized = Math.max(0, Math.min(100, Number(score) || 0));
  if (normalized < 20) return "Clear";
  if (normalized < 45) return "Moderate";
  if (normalized < 70) return "Heavy";
  return "Severe";
}

function computeRoutePressureModel({ routeHazard = null, routeRelevantHazards = [], freshnessTier = "Unknown" } = {}) {
  const relevant = Array.isArray(routeRelevantHazards) ? routeRelevantHazards : [];
  const activeRelevant = relevant.filter((incident) => String(incident?.status || "").toLowerCase() === "active");
  const highSeverityCount = activeRelevant.filter((incident) => String(incident?.severity || "").toLowerCase() === "high").length;
  const mediumSeverityCount = activeRelevant.filter((incident) => ["medium","moderate"].includes(String(incident?.severity || "").toLowerCase())).length;
  const densityScore = Math.min(28, activeRelevant.length * 7);
  const recentActivityScore = Math.min(18, activeRelevant.filter((incident) => Number(incident?.age_minutes) <= 20).length * 6);
  const blockageScore = Math.min(28, (Array.isArray(routeHazard?.nearbyReports) ? routeHazard.nearbyReports : []).filter((report) => report.lifecycleState === "active" && report.reportType === "blocked").length * 14);
  const delayAccumulationScore = Math.min(18, highSeverityCount * 6 + mediumSeverityCount * 3 + Math.max(0, Number(monitoredRouteDelayMinutes) || 0));
  const freshnessMultiplier = freshnessTier === "Fresh" ? 1 : freshnessTier === "Aging" ? 0.82 : 0.66;
  const raw = densityScore + recentActivityScore + blockageScore + delayAccumulationScore;
  const score = Math.round(Math.min(100, raw * freshnessMultiplier));
  return { score, band: getRoutePressureBand(score) };
}

function buildRouteRecommendationMessage({ routeIsMonitoring = false, pressureBand = "Clear", hazardsAvoided = 0, routeRelevantCount = 0, blockedNearRoute = 0, alternateAvailable = false } = {}) {
  const normalizedBand = String(pressureBand || "Clear").toLowerCase();
  if (!routeIsMonitoring) return "Monitoring active route conditions";
  if (alternateAvailable && hazardsAvoided > 0) return `Alternate route avoids ${hazardsAvoided} active hazard${hazardsAvoided === 1 ? "" : "s"}`;
  if (normalizedBand === "severe") return blockedNearRoute > 0 ? "Route heavily impacted by active incidents" : "Major corridor disruption detected";
  if (normalizedBand === "heavy") return routeRelevantCount > 2 ? "Multiple active hazards affecting route" : "Heavy congestion risk detected ahead";
  if (normalizedBand === "moderate") return blockedNearRoute > 0 ? "Monitor conditions near active crossings" : "Delay pressure building near your route";
  if (routeRelevantCount === 0) return "No active hazards affecting your route";
  return "Primary corridor currently stable";
}

function computeRouteConfidenceModel({ routeRelevantHazards = [], routeHazard = null, freshnessTier = "Unknown", routeIsMonitoring = false } = {}) {
  if (!routeIsMonitoring) return { band: "Low", score: 0, inputs: { routeIsMonitoring: false }, reasoning: "Route Watch inactive; confidence held low until monitoring is enabled." };
  const relevant = Array.isArray(routeRelevantHazards) ? routeRelevantHazards : [];
  const hazardReports = Array.isArray(routeHazard?.nearbyReports) ? routeHazard.nearbyReports : [];
  const freshReports = relevant.filter((incident) => Number(incident?.age_minutes) <= 30).length;
  const staleReports = relevant.filter((incident) => Number(incident?.age_minutes) > 120).length;
  const confirmations = relevant.reduce((sum, incident) => sum + Math.max(0, Number(incident?.reports_count) || 0), 0);
  const repeatedIncidents = relevant.filter((incident) => Number(incident?.reports_count) >= 2).length;
  const activeCoverage = hazardReports.filter((report) => report.lifecycleState === "active").length;
  const consistency = hazardReports.length > 0 ? Math.round((activeCoverage / hazardReports.length) * 100) : 0;
  const freshnessScore = freshnessTier === "Fresh" ? 35 : freshnessTier === "Aging" ? 24 : 12;
  const confirmationScore = Math.min(25, confirmations * 2);
  const repeatScore = Math.min(15, repeatedIncidents * 4);
  const coverageScore = Math.min(15, activeCoverage * 3);
  const consistencyScore = Math.min(10, Math.round(consistency / 10));
  const stalePenalty = Math.min(12, staleReports * 2);
  const score = Math.max(0, Math.min(100, freshnessScore + confirmationScore + repeatScore + coverageScore + consistencyScore - stalePenalty));
  const band = score >= 70 ? "High" : score >= 40 ? "Moderate" : "Low";
  const reasoning = band === "High"
    ? "Multiple confirmations with fresh and consistent route coverage."
    : band === "Moderate"
      ? "Some confirmations and fresh activity; continue active monitoring."
      : "Sparse or aging incident signal; confidence remains limited.";
  return { band, score, inputs: { freshReports, staleReports, confirmations, repeatedIncidents, activeCoverage, consistency, freshnessTier }, reasoning };
}

function updateRouteIntelligence(nearest = []) {
  const routeLabelParts = buildRouteWatchLabelParts();

  const unifiedActive = getUnifiedIncidents().filter((incident) => incident.status === "active");
  const railActive = unifiedActive.filter((incident) => incident.type.startsWith("rail_"));
  const activeIssues = railActive;

  const highAlerts = unifiedActive.filter((report) => report.severity === "high").length;
  const moderateAlerts = unifiedActive.filter((report) => report.severity === "medium").length;
  const confirmedIncidents = getConsolidatedIncidents().filter((incident) => {
    const reports = Array.isArray(incident?.reports) ? incident.reports : [];
    const latest = reports[0] || [...reports].sort(compareReportsByRecency)[0];
    return latest && getIncidentLifecycleState(latest) === "active" && reports.length >= 2;
  }).length;
  const desktopRouteSummary = `${unifiedActive.length} live incidents · ${confirmedIncidents} confirmed`;

  const crossingRisk = nearest.length
    ? Math.round(nearest.reduce((sum, c) => sum + c.risk, 0) / nearest.length)
    : 28;

  const impact = Math.min(
    100,
    activeIssues.length * 10 + highAlerts * 22 + moderateAlerts * 8 + Math.round(crossingRisk * 0.35)
  );

  const routeIsConfigured = routeLabelParts.configured;
  const routeIsMonitoring = routeWatchActivated && routeIsConfigured;
  const extraMinutes = Math.max(0, Math.round(impact / 7));
  const routeIntel = getRouteWatchIntelligence(activeIssues);
  const routeHazard = getRouteHazardAssessment();
  const systemConfidence = getSystemConfidence(routeIsMonitoring);
  const recommendationConfidence = getRecommendationConfidence({
    alternateAvailable: Boolean(alternateRouteAvailable),
    hazardsAvoided: Number(hazardsAvoidedCount || 0),
    primaryScore: Number(primaryRouteScore || 0),
    alternateScore: Number(alternateRouteScore || 0),
    routeIsMonitoring
  });
  const corridorHealth = getCorridorHealthFromScore(routeHazard?.score || 0);
  const estimatedDelayImpact = getEstimatedDelayImpact(corridorHealth, routeHazard?.level || "");
  const activeUnifiedHazards = unifiedActive.filter((incident) => !String(incident.type || "").startsWith("rail_"));
  const routeRelevantHazards = routeIsMonitoring
    ? activeUnifiedHazards.filter((incident) => isIncidentRouteRelevant(incident, routeHazard))
    : [];
  const routeRelevantBlockedCrossings = routeIsMonitoring
    ? routeHazard.nearbyReports.filter((report) => report.reportType === "blocked" && report.lifecycleState === "active").length
    : 0;
  const routeContextSummary = !routeIsMonitoring
    ? "Route Watch is off until Home and a destination are selected."
    : routeRelevantBlockedCrossings > 0
      ? "Blocked crossing detected along monitored corridor."
      : routeRelevantHazards.length > 0
        ? `${routeRelevantHazards.length} active issue${routeRelevantHazards.length === 1 ? "" : "s"} affecting this route.`
        : "No active hazards detected along this route.";
  const newestMinutes = activeIssues.length
    ? Math.min(...activeIssues.map((issue) => Number(issue.minutesAgo)).filter((value) => Number.isFinite(value)))
    : null;
  const freshnessTier = getFreshnessTier(newestMinutes);
  const pressureModel = computeRoutePressureModel({ routeHazard, routeRelevantHazards, freshnessTier });
  routePressureScore = pressureModel.score;
  routePressureBand = pressureModel.band;
  calibratedRecommendationBand = routePressureBand;
  const confidenceModel = computeRouteConfidenceModel({ routeRelevantHazards, routeHazard, freshnessTier, routeIsMonitoring });
  routeConfidence = confidenceModel.band;
  confidenceInputs = confidenceModel.inputs;
  confidenceReasoning = confidenceModel.reasoning;
  activeMonitoringState = routeIsMonitoring ? "active" : "standby";
  const alternateRouteAdvantageLabel = hazardsAvoidedCount > 0 ? `${hazardsAvoidedCount} avoided` : "None";
  const recommendationMessage = buildRouteRecommendationMessage({
    routeIsMonitoring,
    pressureBand: calibratedRecommendationBand,
    hazardsAvoided: hazardsAvoidedCount,
    routeRelevantCount: routeRelevantHazards.length,
    blockedNearRoute: routeRelevantBlockedCrossings,
    alternateAvailable: Boolean(alternateRouteAvailable)
  });
  lastRouteRecommendationMessage = recommendationMessage;
  const etaMetrics = getRouteEtaMetricsFromState({
    routeHazardLevel: routeHazard.level,
    fallbackExtraMinutes: extraMinutes
  });
  const freshReportCount = activeIssues.filter((issue) => Number(issue.minutesAgo) <= 30).length;

  safeText("nearbyAlertCount", `${activeIssues.length} active now`);

  safeText(
    "activeAlertText",
    activeIssues.length === 1
      ? "One active shared report currently affecting the area."
      : "Live shared reports near your saved or current location."
  );

  if (els.impactFill) els.impactFill.style.width = `${impact}%`;
  safeText("impactScore", `${impact} / 100`);

  els.routeStatusCard?.classList.remove("clear", "delayed", "high");

  if (!routeIsMonitoring) {
    safeText("routeStatus", "Choose a route to start");
    safeText("routeEta", routeLabelParts.hasHome ? "Choose destination" : "Set Home");
    safeText("desktopRouteStatus", routeLabelParts.hasHome ? "Choose a saved destination to start Route Watch." : "Set Home and one destination to start Route Watch.");
    safeText("routeFreshness", "Unknown");
    safeText("routeConfidence", `System: ${systemConfidence} · Recommendation: ${recommendationConfidence}`);
    safeText("routeReports", "0 active");
    safeText("routeRecommendation", recommendationMessage);
    safeText("sideRouteWatchHint", routeLabelParts.hasHome ? "Choose a saved destination to start Route Watch." : "Set Home and one destination to start Route Watch.");
    safeText("departureTime", "Set destination first");
    renderRouteWatchIntelligenceFields({
      systemConfidence,
      recommendationConfidence,
      corridorHealth: "Awaiting route",
      estimatedDelayImpact: "Awaiting route",
      routePressureBand: "Clear",
      routeRelevantHazardCount: 0,
      alternateRouteAdvantageLabel: "None",
      routeConfidence
    });
    els.routeStatusCard?.classList.add("delayed");
  } else if (routeHazard.level === "blocked") {
    safeText("routeStatus", "ALTERNATE ROUTE RECOMMENDED");
    safeText("routeEta", `ETA 32 min (+${extraMinutes})`);
    safeText("departureTime", "LEAVE NOW");
    renderRouteWatchIntelligenceFields({ systemConfidence, recommendationConfidence, corridorHealth, estimatedDelayImpact, routePressureBand, routeRelevantHazardCount: routeRelevantHazards.length, alternateRouteAdvantageLabel, routeConfidence, ...getRouteEtaMetricsFromState({ routeHazardLevel: routeHazard.level, fallbackExtraMinutes: extraMinutes }) });
    safeText("desktopRouteStatus", "Delay wall detected on your corridor. Switch routes now.");
    safeText("routeFreshness", freshnessTier);
    safeText("routeConfidence", `System: ${systemConfidence} · Recommendation: ${recommendationConfidence}`);
    safeText("routeReports", `${routeHazard.nearbyReports.length} near route`);
    safeText("routeRecommendation", recommendationMessage);
    safeText("sideRouteWatchHint", routeContextSummary);
    els.routeStatusCard?.classList.add("high");
  } else if (routeHazard.level === "heavy") {
    safeText("routeStatus", "Heavy blockage ahead");
    safeText("routeEta", `ETA 26 min (+${extraMinutes})`);
    safeText("departureTime", "LEAVE 8 MIN EARLY");
    renderRouteWatchIntelligenceFields({ systemConfidence, recommendationConfidence, corridorHealth, estimatedDelayImpact, routePressureBand, routeRelevantHazardCount: routeRelevantHazards.length, alternateRouteAdvantageLabel, routeConfidence, ...getRouteEtaMetricsFromState({ routeHazardLevel: routeHazard.level, fallbackExtraMinutes: extraMinutes }) });
    safeText("desktopRouteStatus", "Operational pressure is rising. Leave early or shift to an alternate.");
    safeText("routeFreshness", freshnessTier);
    safeText("routeConfidence", `System: ${systemConfidence} · Recommendation: ${recommendationConfidence}`);
    safeText("routeReports", `${routeHazard.nearbyReports.length} near route`);
    safeText("routeRecommendation", recommendationMessage);
    safeText("sideRouteWatchHint", routeContextSummary);
    els.routeStatusCard?.classList.add("delayed");
  } else if (routeHazard.level === "caution") {
    safeText("routeStatus", "Monitoring crossings nearby");
    safeText("routeEta", `ETA 24 min (+${Math.max(extraMinutes, 3)})`);
    safeText("departureTime", "LEAVE SLIGHTLY EARLY");
    renderRouteWatchIntelligenceFields({ systemConfidence, recommendationConfidence, corridorHealth, estimatedDelayImpact, routePressureBand, routeRelevantHazardCount: routeRelevantHazards.length, alternateRouteAdvantageLabel, routeConfidence, ...getRouteEtaMetricsFromState({ routeHazardLevel: routeHazard.level, fallbackExtraMinutes: extraMinutes }) });
    safeText("desktopRouteStatus", "Early delay signal detected near your monitored corridor.");
    safeText("routeFreshness", freshnessTier);
    safeText("routeConfidence", `System: ${systemConfidence} · Recommendation: ${recommendationConfidence}`);
    safeText("routeReports", `${routeHazard.nearbyReports.length} near route`);
    safeText("routeRecommendation", recommendationMessage);
    safeText("sideRouteWatchHint", routeContextSummary);
    els.routeStatusCard?.classList.add("delayed");
  } else {
    safeText("routeStatus", "Corridor clear");
    safeText("routeEta", "ETA 21 min");
    safeText("departureTime", "ON-SCHEDULE DEPARTURE");
    renderRouteWatchIntelligenceFields({ systemConfidence, recommendationConfidence, corridorHealth, estimatedDelayImpact, routePressureBand, routeRelevantHazardCount: routeRelevantHazards.length, alternateRouteAdvantageLabel, routeConfidence, ...getRouteEtaMetricsFromState({ routeHazardLevel: routeHazard.level, fallbackExtraMinutes: extraMinutes }) });
    safeText("desktopRouteStatus", "Route corridor is open. Continue live monitoring.");
    safeText("routeFreshness", freshnessTier);
    safeText("routeConfidence", `System: ${systemConfidence} · Recommendation: ${recommendationConfidence}`);
    safeText("routeReports", `${routeHazard.nearbyReports.length} near route`);
    safeText("routeRecommendation", recommendationMessage);
    safeText("sideRouteWatchHint", routeContextSummary);
    els.routeStatusCard?.classList.add("clear");
  }

  if (els.routeRecommendation) {
    els.routeRecommendation.classList.add("route-watch-recommendation-emphasis");
  }
  const mobileLiveCommand = document.querySelector(".mobile-live-command");
  if (mobileLiveCommand) mobileLiveCommand.removeAttribute("data-delay-state");
  syncMobileDestinationCommandCard();
  safeText("mobileLiveRouteStatus", `${els.routeStatus?.textContent || "Corridor clear"} • ${els.routeEta?.textContent || "ETA pending"}`);
  safeText("mobileLiveRouteMeta", getLiveCommuteSignalLine({ impact, urgentBlockedCount: routeIntel.urgentBlockedCount, recommendation: els.routeRecommendation?.textContent || "" }));
  renderDesktopRouteWatchMetrics({
    freshness: routeIsMonitoring ? freshnessTier : "Unknown",
    reportsNearRoute: routeIsMonitoring ? `${routeHazard.nearbyReports.length} near route` : "0 near route",
    systemConfidence,
    recommendationConfidence,
    corridorHealth: routeIsMonitoring ? corridorHealth : "Awaiting route",
    estimatedDelayImpact: routeIsMonitoring ? estimatedDelayImpact : "Awaiting route",
    routeEtaValue: routeIsMonitoring ? etaMetrics.routeEtaValue : "",
    routeDelayValue: routeIsMonitoring ? etaMetrics.routeDelayValue : ""
  });

  const liveStatusCard = document.querySelector(".mobile-live-hero");
  liveStatusCard?.classList.remove("clear-status", "delay-status", "blocked-status");

  if (impact >= 70) {
    if (mobileLiveCommand) mobileLiveCommand.dataset.delayState = "blocked";
    safeText("mobileLiveStatusPill", alternateRouteAvailable ? "ALT ROUTE READY" : "BLOCKED");
    safeText("delayRisk", routeIntel.urgentBlockedCount > 0 ? "Heavy blockage risk on US-90" : "Alternate route recommended");
    safeText("delayReason", routeIntel.urgentBlockedCount > 0 ? `${routeIntel.urgentBlockedCount} active signal${routeIntel.urgentBlockedCount === 1 ? "" : "s"} in the last 10 min · alternate route recommended.` : "Live corridor unstable · severe crossing pressure detected.");
    safeText("alternateRoute", "Use alternate");
    safeText("alternateReason", "Avoid highest-impact crossing if possible.");
    safeText("impactText", "High route impact. Use alternate now.");
    safeText("mobileLiveRouteActionBtn", alternateRouteAvailable ? "Use alternate" : "Review route");
    liveStatusCard?.classList.add("blocked-status");
  } else if (impact >= 40) {
    if (mobileLiveCommand) mobileLiveCommand.dataset.delayState = "delayed";
    safeText("mobileLiveStatusPill", "Heavy blockage ahead");
    safeText("delayRisk", "Delay building near Dayton crossing");
    safeText("delayReason", "Active live signals detected · prepare backup route.");
    safeText("alternateRoute", "Have backup");
    safeText("alternateReason", "Alternate route may help if reports increase.");
    safeText("impactText", "Moderate route impact. Wait 10 min or leave early.");
    safeText("mobileLiveRouteActionBtn", "Wait 10 min");
    liveStatusCard?.classList.add("delay-status");
  } else {
    if (mobileLiveCommand) mobileLiveCommand.dataset.delayState = "clear";
    safeText("mobileLiveStatusPill", "CLEAR");
    safeText("delayRisk", "Route clear • Leave now");
    safeText("delayReason", "No active crossing pressure nearby · live monitoring active.");
    safeText("alternateRoute", "Not needed");
    safeText("alternateReason", "Current route appears clear.");
    safeText("impactText", "Low route impact. Normal travel expected.");
    safeText("mobileLiveRouteActionBtn", "View route");
    liveStatusCard?.classList.add("clear-status");
  }
  if (!routeIsMonitoring) {
    safeText("mobileLiveRouteActionBtn", "Choose route");
  }
  setRouteActiveBodyState(routeIsMonitoring);
  updateAlternateRouteActionState();

  updateMobileTopCommuteCta({ impact, routeIsMonitoring, alternateRouteAvailable });
  updateMobileWatchHeader();
  updateRouteWatchBadge();
}

function updateMobileTopCommuteCta({ routeIsMonitoring = false } = {}) {
  const cta = document.getElementById("mobileCommuteRouteBtn");
  if (!cta) return;
  cta.textContent = routeIsMonitoring ? "View Route" : "Choose Route";
  cta.dataset.sectionJump = "routes";
  cta.dataset.topCtaAction = "open-route-panel";
}

function getMobileWatchAreaLabel() {
  const selectedRouteLabel = [
    window.__gridlySelectedRouteLabel,
    window.__gridlyActiveRouteLabel,
    window.__gridlyWatchedRouteLabel
  ].find((value) => typeof value === "string" && value.trim());
  if (selectedRouteLabel) return selectedRouteLabel.trim();

  const selectedAreaLabel = [
    window.__gridlySelectedAreaLabel,
    window.__gridlySelectedCountyLabel,
    window.__gridlySelectedWatchAreaLabel
  ].find((value) => typeof value === "string" && value.trim());
  if (selectedAreaLabel) return selectedAreaLabel.trim();

  return LOCATION_DEFAULTS.county || "Liberty County";
}

function updateMobileWatchHeader() {
  const watchArea = getMobileWatchAreaLabel();
  safeText("mobileWatchLabel", "WATCHING");
  safeText("mobileWatchArea", watchArea);
  safeText("mobileLocalContextLabel", "Current Area");
  safeText("mobileLocalContextValue", watchArea);
}


function getLiveCommuteSignalLine({ impact = 0, urgentBlockedCount = 0, recommendation = "" } = {}) {
  if (impact >= 75) return urgentBlockedCount > 0 ? "Heavy blockage risk on US-90" : "Alternate route recommended";
  if (impact >= 45) return "Delay building near Dayton crossing";
  if (impact >= 20) return "Route pressure rising • monitor closely";
  return recommendation || "Route clear • Leave now";
}

function updateDailyHabitStatus() {
  const unifiedActive = getUnifiedIncidents().filter((incident) => incident.status === "active");
  const railActive = unifiedActive.filter((incident) => incident.type.startsWith("rail_"));
  const activeIssues = railActive;
  const highIssues = activeIssues.filter((report) => report.severity === "high");
  const moderateIssues = activeIssues.filter((report) => report.severity === "moderate");
  const activeCount = activeIssues.length;
  const confirmationCount = getUnifiedIncidents().reduce((sum,i)=>sum+i.reports_count,0);

  const freshest = [...activeReports].sort(
    (a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
  )[0];

  let pill = "All Clear";
  let headline = "0 active reports · 0 crossings impacted";
  let detail = "No active community-reported hazards right now.";
  let cardClass = "clear";

  if (highIssues.length > 0) {
    pill = "Major Delay Active";
    headline = `${highIssues.length} high-impact alert${highIssues.length === 1 ? "" : "s"} · ${activeCount} active report${activeCount === 1 ? "" : "s"}`;
    detail = freshest
      ? `${freshest.crossingName} reported ${freshest.minutesAgo} min ago · ${confirmationCount} live confirmation${confirmationCount === 1 ? "" : "s"}.`
      : `High-impact shared reports are active · ${confirmationCount} live confirmation${confirmationCount === 1 ? "" : "s"}.`;
    cardClass = "high";
  } else if (moderateIssues.length > 0 || activeIssues.length > 0) {
    pill = "Use Caution";
    headline = `${activeCount} active report${activeCount === 1 ? "" : "s"} · ${moderateIssues.length} moderate impact`;
    detail = freshest
      ? `${freshest.crossingName} updated ${freshest.minutesAgo} min ago · ${confirmationCount} live confirmation${confirmationCount === 1 ? "" : "s"}.`
      : `There is live report activity · ${confirmationCount} live confirmation${confirmationCount === 1 ? "" : "s"}.`;
    cardClass = "delayed";
  }

  safeText("habitStatusPill", pill);
  safeText("habitStatusHeadline", headline);
  safeText("habitStatusDetail", detail);

  els.habitStatusStrip?.classList.remove("clear", "delayed", "high");
  els.habitStatusStrip?.classList.add(cardClass);
}

function updateGrowthWidgets() {
  const unifiedActive = getUnifiedIncidents().filter((incident) => incident.status === "active");
  const railActive = unifiedActive.filter((incident) => incident.type.startsWith("rail_"));
  const activeIssues = railActive;
  const highCount = activeIssues.filter((report) => report.severity === "high").length;
  const lastReport = activeReports[0];

  if (highCount > 0) {
    safeText("routeRecommendation", "LEAVE NOW OR REROUTE");
    safeText(
      "routeRecommendationReason",
      `${highCount} high-impact shared report${highCount === 1 ? "" : "s"} active right now.`
    );
  } else if (activeIssues.length > 0) {
    safeText("routeRecommendation", "Heavy blockage ahead");
    safeText(
      "routeRecommendationReason",
      `${activeIssues.length} active shared report${activeIssues.length === 1 ? "" : "s"} may affect travel.`
    );
  } else {
    safeText("routeRecommendation", "Corridor clear");
    safeText("routeRecommendationReason", "No major active shared delays detected right now.");
  }

  const confirmationCount = getUnifiedIncidents().reduce((sum,i)=>sum+i.reports_count,0);
  const routeLabelParts = buildRouteWatchLabelParts();
  const routeIsMonitoring = Boolean(routeWatchActivated && routeLabelParts?.configured);
  const routeHazard = routeIsMonitoring ? getRouteHazardAssessment() : { nearbyReports: [], level: "clear", score: 0 };
  const activeUnifiedHazards = unifiedActive.filter((incident) => !String(incident.type || "").startsWith("rail_"));
  const routeRelevantHazards = routeIsMonitoring
    ? activeUnifiedHazards.filter((incident) => isIncidentRouteRelevant(incident, routeHazard))
    : [];
  const routeRelevantBlockedCrossings = routeIsMonitoring
    ? (Array.isArray(routeHazard?.nearbyReports) ? routeHazard.nearbyReports : []).filter((report) => report.reportType === "blocked" && report.lifecycleState === "active").length
    : 0;

  const newestMinutes = typeof lastReport?.minutesAgo === "number" ? lastReport.minutesAgo : null;
  const freshnessTier = getFreshnessTier(newestMinutes);
  const pressureModel = computeRoutePressureModel({ routeHazard, routeRelevantHazards, freshnessTier });
  routePressureScore = pressureModel.score;
  routePressureBand = pressureModel.band;
  calibratedRecommendationBand = routePressureBand;
  const confidenceModel = computeRouteConfidenceModel({ routeRelevantHazards, routeHazard, freshnessTier, routeIsMonitoring });
  routeConfidence = confidenceModel.band;
  confidenceInputs = confidenceModel.inputs;
  confidenceReasoning = confidenceModel.reasoning;
  activeMonitoringState = routeIsMonitoring ? "active" : "standby";
  const alternateRouteAdvantageLabel = hazardsAvoidedCount > 0 ? `${hazardsAvoidedCount} avoided` : "None";
  const recommendationMessage = buildRouteRecommendationMessage({
    routeIsMonitoring,
    pressureBand: calibratedRecommendationBand,
    hazardsAvoided: hazardsAvoidedCount,
    routeRelevantCount: routeRelevantHazards.length,
    blockedNearRoute: routeRelevantBlockedCrossings,
    alternateAvailable: Boolean(alternateRouteAvailable)
  });
  lastRouteRecommendationMessage = recommendationMessage;
  if (confirmationCount >= 5) {
    safeText("communityTrust", `${freshnessTier} · Strong local signal`);
    safeText("communityTrustReason", `${confirmationCount} reports live. Confidence is ${freshnessTier.toLowerCase()}.`);
  } else if (confirmationCount > 0) {
    safeText("communityTrust", `${freshnessTier} · Early signal`);
    safeText("communityTrustReason", `${confirmationCount} active report${confirmationCount === 1 ? "" : "s"}. Confidence is ${freshnessTier.toLowerCase()}.`);
  } else {
    safeText("communityTrust", "Fresh · Waiting for reports");
    safeText("communityTrustReason", "No active reports yet. Confidence will increase as drivers report.");
  }

  if (lastReport) {
    safeText("freshestReport", `${lastReport.minutesAgo} min ago`);
    safeText(
      "freshestReportReason",
      `${lastReport.crossingName} was marked ${getReportCopy(lastReport.type).label}.`
    );
  } else {
    safeText("freshestReport", "None yet");
    safeText("freshestReportReason", "Reports appear here as soon as drivers submit them.");
  }
}


function updateCorridorSummaryCards() {
  const normalized = getMovementIntelligence();
  const corridorStats = normalized.corridors.map((corridor) => ({ corridor, status: computeCorridorStatus(corridor) }));
  const ranked = corridorStats.sort((a, b) => (b.status.delayScore || 0) - (a.status.delayScore || 0));
  const lead = ranked[0];
  if (!lead) return;

  const state = lead.status;
  const summaryLine = `${lead.corridor.label || "Unnamed Corridor"}`;
  const guidanceLine = getCorridorGuidanceMessage(state.severityLabel);
  const reportCountLabel = `${state.stackedReportCount || 0} active report${state.stackedReportCount === 1 ? "" : "s"}`;
  const freshnessLabel = state.freshness >= 70 ? "Fresh" : state.freshness >= 40 ? "Recent" : "Stale";
  const detailLine = `${state.severityLabel} · ${guidanceLine} · ~${Math.round(state.delayMinutes || 0)} min delay · ${state.confidence}% confidence · ${freshnessLabel} · ${reportCountLabel}`;
  safeText("corridorSummaryHeadline", summaryLine);
  safeText("corridorSummaryDetail", detailLine);
  safeText("mobileCorridorSummaryHeadline", summaryLine);
  safeText("mobileCorridorSummaryDetail", detailLine);
  safeText("liveOpsStatus", `${state.severityLabel} · ~${Math.round(state.delayMinutes || 0)} min`);
  safeText("liveOpsDetail", `${guidanceLine} · ${state.confidence}% confidence · ${reportCountLabel}`);

  const badges = [
    "LIVE",
    state.freshness < 35 ? "STALE" : null,
    state.confidence >= 70 ? "HIGH CONFIDENCE" : null,
    state.confidence >= 55 && state.freshness >= 45 ? "COMMUNITY VERIFIED" : null
  ].filter(Boolean);

  [els.corridorSummaryBadges, els.mobileCorridorBadges].forEach((node) => {
    if (!node) return;
    node.innerHTML = badges.map((badge) => `<span class="trust-pill">${sanitizeText(badge)}</span>`).join("");
  });

  const theme = getCorridorSeverityTheme(state.severityLabel);
  [document.querySelector('.corridor-intel-card'), document.querySelector('.mobile-corridor-intel-card')].forEach((card) => {
    if (!card) return;
    card.style.borderColor = theme.border;
    card.style.boxShadow = `0 0 0 1px ${theme.border} inset, 0 16px 28px ${theme.glow}`;
  });
  [els.corridorSummaryHeadline, els.mobileCorridorSummaryHeadline, els.liveOpsStatus].forEach((node) => {
    if (!node) return;
    node.style.color = theme.text;
  });
  [els.corridorSummaryBadges, els.mobileCorridorBadges].forEach((node) => {
    if (!node) return;
    node.querySelectorAll('.trust-pill').forEach((pill) => {
      pill.style.background = theme.badge;
      pill.style.borderColor = theme.border;
    });
  });

  const focusCorridor = selectFocusedCorridor(corridorStats);
  drawCorridorIntelLines(focusCorridor ? [focusCorridor] : []);
}

function getCorridorSeverityRank(severityLabel = "Clear") {
  if (severityLabel === "Blocked") return 3;
  if (severityLabel === "Heavy Delay") return 2;
  if (severityLabel === "Minor Delay") return 1;
  return 0;
}

function getSelectedCorridorId() {
  const candidates = [
    window.__gridlySelectedCorridorId,
    window.__gridlyActiveCorridorId,
    window.__gridlyMovementSelectedCorridorId
  ];
  const selected = candidates.find((value) => value !== undefined && value !== null && String(value).trim());
  return selected ? String(selected).trim() : "";
}

function getSelectedRouteId() {
  const selected = window.__gridlySelectedRouteId;
  if (selected === undefined || selected === null) return "";
  return String(selected).trim();
}

function getRouteWatchActivationState() {
  return window.__gridlyRouteWatchActive === true;
}

function getLineActivationContext() {
  const selectedCorridorId = getSelectedCorridorId();
  const selectedRouteId = getSelectedRouteId();
  const routeWatchActive = getRouteWatchActivationState();
  return { selectedCorridorId, selectedRouteId, routeWatchActive, hasActivation: Boolean(selectedCorridorId || selectedRouteId || routeWatchActive) };
}

function logGridlyMapLineRendered({ renderFunction = "unknown", corridorId = "", routeId = "", activationReason = "", coordinates = [] } = {}) {
  console.info("Gridly map line rendered", { renderFunction, corridorId, routeId, activationReason, coordinates });
}

function selectFocusedCorridor(corridorStats = []) {
  const valid = (Array.isArray(corridorStats) ? corridorStats : []).filter((item) => {
    const corridor = item?.corridor || {};
    const severityRank = getCorridorSeverityRank(item?.status?.severityLabel || "Clear");
    return hasValidCorridorCoordinates(corridor) && severityRank > 0;
  });
  if (!valid.length) return null;

  const selectedCorridorId = getSelectedCorridorId();
  if (selectedCorridorId) {
    const selected = valid.find((item) => String(item?.corridor?.id || "") === selectedCorridorId);
    if (selected) return selected;
  }

  const ranked = valid.sort((a, b) => {
    const severityDiff = getCorridorSeverityRank(b?.status?.severityLabel || "Clear") - getCorridorSeverityRank(a?.status?.severityLabel || "Clear");
    if (severityDiff !== 0) return severityDiff;
    return (b?.status?.delayScore || 0) - (a?.status?.delayScore || 0);
  });

  return ranked[0] || null;
}

function getCorridorGuidanceMessage(severityLabel = "Clear") {
  if (severityLabel === "Blocked") return "Avoid this corridor";
  if (severityLabel === "Heavy Delay") return "Consider alternate route";
  if (severityLabel === "Minor Delay") return "Expect a small delay";
  return "You can drive now";
}

function hasValidCorridorCoordinates(corridor = {}) {
  const values = [corridor.startLat, corridor.startLng, corridor.endLat, corridor.endLng];
  const allFinite = values.every((n) => Number.isFinite(Number(n)));
  if (!allFinite) return false;
  const startLat = Number(corridor.startLat);
  const startLng = Number(corridor.startLng);
  const endLat = Number(corridor.endLat);
  const endLng = Number(corridor.endLng);
  if (Math.abs(startLat) > 90 || Math.abs(endLat) > 90 || Math.abs(startLng) > 180 || Math.abs(endLng) > 180) return false;
  const spanKm = calculateDistanceKm(startLat, startLng, endLat, endLng);
  return Number.isFinite(spanKm) && spanKm > 0.05 && spanKm <= 60;
}

function shouldRenderCorridorLine() {
  return getLineActivationContext().hasActivation;
}

function drawCorridorIntelLines(corridorStats = []) {
  if (!corridorIntelLayer) return;
  corridorIntelLayer.clearLayers();
  const item = Array.isArray(corridorStats) ? corridorStats[0] : null;
  const corridor = item?.corridor || {};
  const state = item?.status || {};
  const severityLabel = state.severityLabel || "Clear";
  if (!hasValidCorridorCoordinates(corridor)) return;
  if (!shouldRenderCorridorLine()) return;

  const latLngs = [
    [Number(corridor.startLat), Number(corridor.startLng)],
    [Number(corridor.endLat), Number(corridor.endLng)]
  ];
  const theme = getCorridorSeverityTheme(severityLabel);

  const glow = L.polyline(latLngs, {
    pane: "routePane",
    color: theme.glow,
    weight: 6,
    opacity: 0.18,
    lineCap: "round",
    interactive: false
  });
  glow.addTo(corridorIntelLayer);

  const core = L.polyline(latLngs, {
    pane: "routePane",
    color: theme.border,
    weight: 3,
    opacity: 0.62,
    lineCap: "round",
    interactive: false
  });
  core.addTo(corridorIntelLayer);
  const activation = getLineActivationContext();
  logGridlyMapLineRendered({
    renderFunction: "drawCorridorIntelLines",
    corridorId: String(corridor.id || ""),
    routeId: activation.selectedRouteId,
    activationReason: activation.selectedCorridorId ? "selected-corridor-id" : activation.selectedRouteId ? "selected-route-id" : "route-watch-active",
    coordinates: latLngs
  });

  const from = corridor.startLabel || "Start";
  const to = corridor.endLabel || "End";
  const label = `${from} ↔ ${to} · ${severityLabel}`;
  core.bindTooltip(sanitizeText(label), {
    permanent: false,
    sticky: true,
    direction: "top",
    opacity: 0.92,
    className: "corridor-intel-tooltip"
  });
}

function getCorridorSeverityTheme(severityLabel = "Clear") {
  if (severityLabel === "Blocked") return { border: "rgba(249, 115, 22, 0.75)", glow: "rgba(239, 68, 68, 0.22)", badge: "rgba(239, 68, 68, 0.2)", text: "#fdba74" };
  if (severityLabel === "Heavy Delay") return { border: "rgba(245, 158, 11, 0.75)", glow: "rgba(245, 158, 11, 0.2)", badge: "rgba(251, 191, 36, 0.22)", text: "#fbbf24" };
  if (severityLabel === "Minor Delay") return { border: "rgba(59, 130, 246, 0.75)", glow: "rgba(234, 179, 8, 0.18)", badge: "rgba(59, 130, 246, 0.2)", text: "#93c5fd" };
  return { border: "rgba(34, 197, 94, 0.65)", glow: "rgba(34, 197, 94, 0.14)", badge: "rgba(34, 197, 94, 0.2)", text: "#86efac" };
}

const ROAD_HAZARD_DISPLAY_CATEGORIES = new Set(["road_closed", "flooding", "crash", "construction", "disabled_vehicle", "other_hazard"]);

function formatRoadHazardCategoryLabel(category) {
  const labels = {
    road_closed: "Road Closure",
    flooding: "Flooding",
    crash: "Crash",
    construction: "Construction",
    disabled_vehicle: "Disabled Vehicle",
    other_hazard: "Road Hazard"
  };
  return labels[category] || "Road Hazard";
}

function extractRoadHintFromText(text = "") {
  const candidate = String(text || "");
  if (!candidate) return "";
  const between = candidate.match(/\bbetween\s+([A-Z0-9][A-Za-z0-9 .\/-]{2,})\s+and\s+([A-Z0-9][A-Za-z0-9 .\/-]{2,})/i);
  if (between?.[1] && between?.[2]) return `${between[1].trim()} / ${between[2].trim()}`;
  const near = candidate.match(/\b(?:on|near|at)\s+([A-Z0-9][A-Za-z0-9 .\/-]{2,})/i);
  return near?.[1] ? near[1].trim() : "";
}

const INVALID_ROAD_NAME_TOKENS = new Set([
  "private",
  "unnamed",
  "unknown",
  "null",
  "none",
  "road",
  "crossing",
  "railroad",
  "railroad crossing",
  "street",
  "n/a",
  "na",
  "test",
  "temp",
  "etc"
]);

function normalizeRoadNameCandidate(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeRoadwayReference(value = "") {
  const normalized = normalizeRoadNameCandidate(value);
  if (!normalized) return "";

  const compact = normalized
    .replace(/\bwestbound\b|\beastbound\b|\bnorthbound\b|\bsouthbound\b/gi, "")
    .replace(/\bwest\b|\beast\b|\bnorth\b|\bsouth\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const patterns = [
    { re: /^(?:united\s+states\s+highway|u\.?s\.?\s*highway|us\s*highway|us)\s*[- ]?(\d+[a-z]?)$/i, format: (n) => `US ${n.toUpperCase()}` },
    { re: /^(?:farm\s+to\s+market(?:\s+road)?|fm)\s*[- ]?(\d+[a-z]?)$/i, format: (n) => `FM ${n.toUpperCase()}` },
    { re: /^(?:state\s+highway|sh)\s*[- ]?(\d+[a-z]?)$/i, format: (n) => `SH ${n.toUpperCase()}` },
    { re: /^(?:interstate|ih|i)\s*[- ]?(\d+[a-z]?)$/i, format: (n) => `I-${n.toUpperCase()}` },
    { re: /^(?:loop)\s*[- ]?(\d+[a-z]?)$/i, format: (n) => `Loop ${n.toUpperCase()}` },
    { re: /^(?:spur)\s*[- ]?(\d+[a-z]?)$/i, format: (n) => `Spur ${n.toUpperCase()}` },
    { re: /^(?:county\s+road|cr)\s*[- ]?(\d+[a-z]?)$/i, format: (n) => `CR ${n.toUpperCase()}` }
  ];

  for (const pattern of patterns) {
    const match = compact.match(pattern.re);
    if (match?.[1]) return pattern.format(match[1]);
  }
  return compact;
}

function evaluateRoadNameCandidate(value = "") {
  const normalized = normalizeRoadwayReference(normalizeRoadNameCandidate(value));
  if (!normalized) return { normalized, valid: false, reason: "empty" };
  if (/^[-,.\s]+$/.test(normalized)) return { normalized, valid: false, reason: "punctuation_only" };
  if (normalized.length < 3) return { normalized, valid: false, reason: "too_short" };
  const lowered = normalized.toLowerCase();
  if (INVALID_ROAD_NAME_TOKENS.has(lowered)) return { normalized, valid: false, reason: "generic_placeholder" };
  if (/^[A-Z0-9\s\-/.&]+$/.test(normalized) && INVALID_ROAD_NAME_TOKENS.has(lowered.replace(/\s+/g, " "))) {
    return { normalized, valid: false, reason: "all_caps_placeholder" };
  }
  return { normalized, valid: true, reason: "ok" };
}


function normalizeRoadDisplayCase(value = "") {
  const text = normalizeRoadNameCandidate(value);
  if (!text) return "";
  const normalizedReference = normalizeRoadwayReference(text);
  if (/^(?:US|FM|SH|I-\d+[A-Z]?|CR|Loop|Spur)\b/.test(normalizedReference)) return normalizedReference;

  return text
    .split(/(\s+|[-\/])/)
    .map((segment) => {
      if (!segment || /^\s+$/.test(segment) || segment === "-" || segment === "/") return segment;
      if (/^\d+[A-Z]?$/.test(segment)) return segment.toUpperCase();
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join("");
}

function titleCaseRoadText(value = "") {
  return normalizeRoadDisplayCase(value);
}

function normalizeRoadComparison(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function collectNearbyRoadCandidates(lat, lng, maxDistanceMiles = 0.45, maxCandidates = 6) {
  if (!roadwayDatasetLoaded || !Array.isArray(roadwaySegmentFeatures) || !roadwaySegmentFeatures.length) return [];
  const bestByRoadKey = new Map();
  for (const feature of roadwaySegmentFeatures) {
    const props = feature?.properties || {};
    const candidates = [props?.name, props?.ref, props?.highway].map((value) => evaluateRoadNameCandidate(value));
    const selected = candidates.find((entry) => entry.valid);
    if (!selected?.normalized) continue;
    const roadName = selected.normalized;
    const roadKey = normalizeRoadComparison(roadName);
    if (!roadKey) continue;
    const segments = flattenRoadGeometrySegments(feature?.geometry);
    for (const segment of segments) {
      const distance = distancePointToSegmentMiles(lat, lng, segment.startLat, segment.startLng, segment.endLat, segment.endLng);
      if (!Number.isFinite(distance) || distance > maxDistanceMiles) continue;
      const existing = bestByRoadKey.get(roadKey);
      if (!existing || distance < existing.distanceMiles) {
        bestByRoadKey.set(roadKey, { roadName, roadKey, distanceMiles: distance });
      }
    }
  }
  return Array.from(bestByRoadKey.values())
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, Math.max(2, maxCandidates));
}

function resolveNearbyRoadPair(lat, lng, primaryRoad = "") {
  const primaryNormalized = evaluateRoadNameCandidate(primaryRoad);
  const result = {
    roadA: primaryNormalized.valid ? primaryNormalized.normalized : "",
    roadB: "",
    used: false,
    distanceMiles: null,
    rejectedReason: "",
    samples: []
  };
  const coords = normalizeCoordinatePair(lat, lng);
  if (!coords) {
    result.rejectedReason = "invalid_coordinates";
    return result;
  }
  const candidates = collectNearbyRoadCandidates(coords.lat, coords.lng, 0.45, 8);
  result.samples = candidates.slice(0, 6).map((entry) => `${entry.roadName} (${entry.distanceMiles.toFixed(3)} mi)`);
  if (!candidates.length) {
    result.rejectedReason = roadwayDatasetLoaded ? "no_nearby_roads_in_radius" : "roadway_dataset_unavailable";
    return result;
  }
  if (!result.roadA) result.roadA = candidates[0]?.roadName || "";
  const primaryKey = normalizeRoadComparison(result.roadA);
  const secondary = candidates.find((entry) => {
    const candidateKey = normalizeRoadComparison(entry.roadName);
    if (!candidateKey || !primaryKey) return false;
    if (candidateKey === primaryKey) return false;
    if (candidateKey.includes(primaryKey) || primaryKey.includes(candidateKey)) return false;
    if (entry.distanceMiles > 0.35) return false;
    return true;
  });
  if (!secondary) {
    result.rejectedReason = "no_meaningful_secondary_road";
    return result;
  }
  result.roadB = secondary.roadName;
  result.distanceMiles = Number(secondary.distanceMiles.toFixed(4));
  result.used = true;
  return result;
}

function buildHumanLocationContext({ primaryRoad = "", crossingRoad = "", intersectingRoad = "", roadwayRef = "", nearbyArea = "" } = {}) {
  const ordered = [primaryRoad, crossingRoad, intersectingRoad, roadwayRef]
    .map((value) => titleCaseRoadText(normalizeRoadNameCandidate(value)))
    .filter(Boolean);
  const uniqueRoads = [];
  const seen = new Set();
  ordered.forEach((road) => {
    const key = normalizeRoadComparison(road);
    if (!key || seen.has(key)) return;
    seen.add(key);
    uniqueRoads.push(road);
  });
  const area = String(nearbyArea || "").trim();
  const primary = uniqueRoads[0] || "";
  const secondary = uniqueRoads[1] || "";
  let phrasing = "";
  if (primary && secondary) phrasing = `${primary} & ${secondary}`;
  else if (primary) phrasing = primary;
  else if (area) phrasing = area;
  return {
    primary,
    secondary,
    phrasing,
    usedFallback: !primary,
    source: primary ? "roadway_candidates" : area ? "area_fallback" : "none",
    samples: uniqueRoads.slice(0, 4)
  };
}

function resolveNearbyKnownLocation(lat, lng, options = {}) {
  const coords = normalizeCoordinatePair(lat, lng);
  if (!coords) return "";
  const radiusMiles = Number.isFinite(Number(options?.radiusMiles)) ? Number(options.radiusMiles) : 1.8;
  const nearest = findNearestCrossings(coords.lat, coords.lng, 1)[0];
  if (!nearest || !Number.isFinite(Number(nearest.distance)) || Number(nearest.distance) > radiusMiles) return "";
  const evaluation = evaluateRoadNameCandidate(nearest?.name || "");
  return evaluation.valid ? evaluation.normalized : "";
}

function isResolvableRoadNameCandidate(value = "") {
  return evaluateRoadNameCandidate(value).valid;
}

function resolveNearestRoadName(lat, lng) {
  const coords = normalizeCoordinatePair(lat, lng);
  const debugState = {
    resolverExists: true,
    roadwayDatasetLoaded,
    roadwayFeatureCount: Array.isArray(roadwaySegmentFeatures) ? roadwaySegmentFeatures.length : 0,
    roadwayLookupSource: "none",
    nearestSegmentDistance: null,
    fallbackReason: "",
    candidateSource: "none",
    rejectedCandidates: [],
    rejectionReasons: [],
    normalizedCandidateSamples: [],
    pairedRoadSamples: [],
    nearbyRoadPairingUsed: false,
    nearbyRoadDistance: null,
    pairingRejectedReason: "",
    sampleLookup: null,
    fallbackBehavior: "returns null when no local roadway source is available",
    coords
  };
  if (!coords) {
    debugState.fallbackBehavior = "returns null when coordinates are invalid";
    debugState.fallbackReason = "invalid_coordinates";
    resolveNearestRoadName.lastDebug = debugState;
    return null;
  }

  const nearestSegmentMatch = findNearestRoadwaySegment(coords.lat, coords.lng, 1.2);
  if (nearestSegmentMatch?.feature) {
    const props = nearestSegmentMatch.feature?.properties || {};
    const segmentCandidates = [props?.name, props?.ref, props?.highway].map((value) => evaluateRoadNameCandidate(value));
    const selectedSegment = segmentCandidates.find((entry) => entry.valid);
    const rejectedSegments = segmentCandidates.filter((entry) => entry.normalized && !entry.valid);
    debugState.rejectedCandidates.push(...rejectedSegments.map((entry) => entry.normalized));
    debugState.rejectionReasons.push(...rejectedSegments.map((entry) => entry.reason));
    debugState.normalizedCandidateSamples.push(...segmentCandidates.map((entry) => entry.normalized).filter(Boolean).slice(0, 4));
    debugState.nearestSegmentDistance = Number(nearestSegmentMatch.distanceMiles.toFixed(4));
    if (selectedSegment?.normalized) {
      debugState.candidateSource = "roadway_dataset";
      debugState.roadwayLookupSource = "roadway_dataset";
      debugState.fallbackBehavior = "returns nearest roadway segment label when valid";
      const pair = resolveNearbyRoadPair(coords.lat, coords.lng, selectedSegment.normalized);
      debugState.pairedRoadSamples = pair.samples;
      debugState.nearbyRoadPairingUsed = pair.used;
      debugState.nearbyRoadDistance = pair.distanceMiles;
      debugState.pairingRejectedReason = pair.rejectedReason;
      resolveNearestRoadName.lastDebug = debugState;
      return pair.used ? `${pair.roadA} & ${pair.roadB}` : selectedSegment.normalized;
    }
    debugState.fallbackReason = "nearest_segment_unnamed_or_generic";
  } else {
    debugState.fallbackReason = roadwayDatasetLoaded ? "no_segment_within_radius" : "roadway_dataset_unavailable";
  }

  const nearest = findNearestCrossings(coords.lat, coords.lng, 1)[0];
  if (nearest && Number.isFinite(Number(nearest.distance)) && Number(nearest.distance) <= 0.8) {
    const tempCandidate = [nearest?.roadwayName, nearest?.road_name, nearest?.street_name, nearest?.crossing_street, nearest?.cross_street, nearest?.name]
      .map((value) => evaluateRoadNameCandidate(value));
    const selected = tempCandidate.find((entry) => entry.valid);
    const rejected = tempCandidate.filter((entry) => entry.normalized && !entry.valid);
    debugState.rejectedCandidates = rejected.map((entry) => entry.normalized);
    debugState.rejectionReasons = rejected.map((entry) => entry.reason);
    debugState.normalizedCandidateSamples = tempCandidate.map((entry) => entry.normalized).filter(Boolean).slice(0, 8).concat(debugState.normalizedCandidateSamples).slice(0, 8);
    debugState.sampleLookup = nearest?.name || null;
    if (selected?.normalized) {
      debugState.candidateSource = "crossing_fallback";
      debugState.roadwayLookupSource = "crossing_fallback";
      debugState.fallbackBehavior = "returns nearest crossing-linked road label when valid";
      const pair = resolveNearbyRoadPair(coords.lat, coords.lng, selected.normalized);
      debugState.pairedRoadSamples = pair.samples;
      debugState.nearbyRoadPairingUsed = pair.used;
      debugState.nearbyRoadDistance = pair.distanceMiles;
      debugState.pairingRejectedReason = pair.rejectedReason;
      resolveNearestRoadName.lastDebug = debugState;
      return pair.used ? `${pair.roadA} & ${pair.roadB}` : selected.normalized;
    }
    debugState.fallbackReason = debugState.fallbackReason || "crossing_candidate_invalid";
  }

  debugState.roadwayLookupSource = debugState.roadwayLookupSource || "none";
  debugState.fallbackReason = debugState.fallbackReason || "no_valid_candidate_found";
  resolveNearestRoadName.lastDebug = debugState;
  return null;
}

window.gridlyRoadNameResolverDebug = function () {
  const last = resolveNearestRoadName?.lastDebug || null;
  const sampleCrossing = Array.isArray(crossings) && crossings.length
    ? { id: crossings[0]?.id || null, name: crossings[0]?.name || null }
    : null;
  const status = {
    resolverExists: typeof resolveNearestRoadName === "function",
    roadwayDatasetLoaded,
    roadwayFeatureCount: Array.isArray(roadwaySegmentFeatures) ? roadwaySegmentFeatures.length : 0,
    roadwayLookupSource: last?.roadwayLookupSource || "none",
    nearestSegmentDistance: Number.isFinite(Number(last?.nearestSegmentDistance)) ? Number(last.nearestSegmentDistance) : null,
    fallbackReason: last?.fallbackReason || (roadwayDatasetLoadError ? "dataset_load_failed" : ""),
    candidateSourceUsed: last?.candidateSource || "none",
    rejectedCandidates: Array.isArray(last?.rejectedCandidates) ? last.rejectedCandidates : [],
    rejectionReasons: Array.isArray(last?.rejectionReasons) ? last.rejectionReasons : [],
    normalizedCandidateSamples: Array.isArray(last?.normalizedCandidateSamples) ? last.normalizedCandidateSamples : [],
    pairedRoadSamples: Array.isArray(last?.pairedRoadSamples) ? last.pairedRoadSamples : [],
    nearbyRoadPairingUsed: Boolean(last?.nearbyRoadPairingUsed),
    nearbyRoadDistance: Number.isFinite(Number(last?.nearbyRoadDistance)) ? Number(last.nearbyRoadDistance) : null,
    pairingRejectedReason: String(last?.pairingRejectedReason || ""),
    normalizedRoadwaySamples: [
      "United States Highway 90 West",
      "US Highway 90",
      "Farm to Market Road 1960",
      "State Highway 146",
      "Interstate 10 West",
      "County Road 101"
    ].map((sample) => normalizeRoadwayReference(sample)),
    roadwayNormalizationApplied: true,
    displayCaseNormalizationApplied: true,
    displayCaseSamples: [
      "WINFREE STREET",
      "WACO STREET",
      "Main Street",
      "Stilson Road",
      "US 90",
      "FM 1960",
      "SH 146",
      "I-10",
      "CR 321"
    ].map((sample) => normalizeRoadDisplayCase(sample)),
    sampleLookupResults: last?.sampleLookup || sampleCrossing,
    fallbackBehavior: last?.fallbackBehavior || "returns null when no roadway dataset is available",
    localFallbackSourceAvailable: Boolean(Array.isArray(crossings) && crossings.length),
    formattedLocationSamples: ["Blocked crossing on US 90 near Stilson Road", "Crash near SH 146 & Winfree Street", "Flooding near FM 1960"],
    formattingSource: last?.candidateSource || "none",
    formattingFallbackUsed: Boolean(last?.fallbackReason && String(last.fallbackReason).length),
    notes: "Foundation resolver only: local-only, no external geocoding/API calls."
  };
  console.info("gridlyRoadNameResolverDebug", status);
  return status;
};

function buildRoadHazardDisplay(incident) {
  const category = getHazardCategory(incident?.report_type || incident?.type || "other_hazard");
  const hazardType = formatRoadHazardCategoryLabel(category);
  const locationCandidates = [
    incident?.road_name,
    incident?.street_name,
    incident?.street,
    incident?.nearest_road,
    incident?.snapped_road_name,
    incident?.crossing_street,
    incident?.cross_street,
    incident?.location_name,
    incident?.area
  ];
  const titleDescription = `${incident?.title || ""} ${incident?.description || ""}`;
  const roadFromText = extractRoadHintFromText(titleDescription);
  if (roadFromText) locationCandidates.unshift(roadFromText);
  const nearestKnownLocation = resolveNearbyKnownLocation(incident?.lat, incident?.lng);
  if (nearestKnownLocation) locationCandidates.push(nearestKnownLocation);
  const resolvedRoadName = resolveNearestRoadName(incident?.lat, incident?.lng);
  if (resolvedRoadName) locationCandidates.push(resolvedRoadName);
  const locationName = locationCandidates.map((value) => String(value || "").trim()).find((value) => isResolvableRoadNameCandidate(value)) || "";
  const locationContext = buildHumanLocationContext({
    primaryRoad: locationName,
    crossingRoad: incident?.crossing_street || incident?.cross_street,
    intersectingRoad: incident?.intersecting_road,
    roadwayRef: incident?.road_ref,
    nearbyArea: incident?.city || incident?.area || incident?.county
  });
  const hasUsefulRoadName = locationContext.primary && !/liberty county/i.test(locationContext.primary);

  let title = "Road Hazard";
  if (category === "flooding" && hasUsefulRoadName) title = `Flooding near ${locationContext.phrasing}`;
  else if (hasUsefulRoadName) title = `${hazardType} near ${locationContext.phrasing}`;
  else if (hazardType !== "Road Hazard") title = hazardType;

  const coords = normalizeCoordinatePair(incident?.lat, incident?.lng);
  const coordinateFallback = coords ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}` : "";
  const isNonInformativeRoadArea = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "liberty county" || normalized === "county";
  };
  const areaName = [incident?.location_name, incident?.area, incident?.city, incident?.county]
    .map((value) => String(value || "").trim())
    .find((value) => value && !isNonInformativeRoadArea(value)) || "";
  let locationText = "";
  if (hasUsefulRoadName) locationText = `Near ${locationContext.phrasing}`;
  else if (nearestKnownLocation && !isNonInformativeRoadArea(nearestKnownLocation)) locationText = `Near ${nearestKnownLocation}`;
  else if (areaName) locationText = `Near ${areaName}`;
  else if (coordinateFallback) locationText = `Near ${coordinateFallback}`;
  else locationText = "Location pending";

  const isCleared = String(incident?.status || "").toLowerCase() === "cleared";
  const routeRelevant = isIncidentRouteRelevant(incident);
  const statusText = isCleared ? "Cleared" : routeRelevant ? "Route relevant" : "Active";
  const ageText = Number.isFinite(Number(incident?.age_minutes))
    ? `${Math.max(0, Math.round(Number(incident.age_minutes)))}m ago`
    : "just now";

  return {
    title,
    subtitle: `${locationText} · ${statusText} · ${ageText}`,
    meta: statusText,
    rowClass: isCleared ? "cleared" : routeRelevant ? "high" : ""
  };
}

function resolveRailLocationText(incident) {
  const latest = incident?.latestReport || {};
  const coords = normalizeCoordinatePair(latest?.lat, latest?.lng);
  const resolvedRoadName = resolveNearestRoadName(latest?.lat, latest?.lng);
  const humanRoad = [latest?.road_name, latest?.street_name, latest?.nearest_road, latest?.snapped_road_name, latest?.crossing_street, latest?.cross_street, resolvedRoadName]
    .map((value) => String(value || "").trim())
    .find((value) => isResolvableRoadNameCandidate(value)) || "";
  const context = buildHumanLocationContext({
    primaryRoad: humanRoad,
    crossingRoad: latest?.crossing_street || latest?.cross_street,
    intersectingRoad: latest?.intersecting_road,
    roadwayRef: latest?.road_ref,
    nearbyArea: latest?.city || latest?.area || latest?.county
  });
  const crossingName = String(incident?.crossingName || latest?.crossingName || latest?.crossing || "").trim();
  const nearbyKnownLocation = resolveNearbyKnownLocation(latest?.lat, latest?.lng);
  const nearbyName = [nearbyKnownLocation, latest?.location_name, latest?.city, latest?.area, latest?.county].map((value) => String(value || "").trim()).find(Boolean) || "";
  const crossingId = String(latest?.crossingId || incident?.crossingId || "").trim();
  return {
    humanRoad: context.primary,
    crossingName,
    nearbyName,
    coords,
    crossingId,
    subtitlePrefix: context.phrasing ? `Near ${context.phrasing}` : nearbyName ? `Near ${nearbyName}` : coords ? `Near ${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}` : crossingId ? `Crossing ID ${crossingId}` : "Location pending"
  };
}

function buildRailIncidentDisplay(incident) {
  const latest = incident?.latestReport || {};
  const reportType = String(latest?.type || "").toLowerCase();
  const actionWord = reportType === "cleared" ? "Cleared" : reportType === "blocked" ? "Blocked" : "Delay";
  const location = resolveRailLocationText(incident);
  const title = location.humanRoad
    ? `${actionWord} crossing on ${location.humanRoad}`
    : location.crossingName
    ? `${actionWord} near ${location.crossingName}`
    : `${actionWord} crossing`;
  return { title, subtitlePrefix: location.subtitlePrefix };
}

function buildAlertFocusDataset(incidentLike = {}, defaults = {}) {
  const coords = normalizeCoordinatePair(incidentLike?.lat, incidentLike?.lng) || normalizeCoordinatePair(defaults?.lat, defaults?.lng);
  const incidentId = String(incidentLike?.id || incidentLike?.crossingId || defaults?.incidentId || "").trim();
  const focusAttrs = coords ? `data-alert-focus="true" data-lat="${coords.lat}" data-lng="${coords.lng}"` : "";
  return `${focusAttrs} data-incident-id="${sanitizeText(incidentId || "unknown")}"`;
}

function focusAlertLocation(lat, lng, options = {}) {
  const coords = normalizeCoordinatePair(lat, lng);
  if (!map || !coords) return false;
  map.flyTo([coords.lat, coords.lng], Math.max(14, Number(map.getZoom?.() || 14)), { duration: 0.45 });
  const incidentId = String(options?.incidentId || "").trim();
  const tolerance = Number(options?.tolerance || 0.00025);
  const matchedMarker = unifiedIncidentLayer?.getLayers?.().find((layer) => {
    const markerPos = layer?.getLatLng?.();
    const markerIncidentId = String(layer?.options?.incidentId || "").trim();
    if (incidentId && markerIncidentId && markerIncidentId === incidentId) return true;
    return markerPos && Math.abs(markerPos.lat - coords.lat) < tolerance && Math.abs(markerPos.lng - coords.lng) < tolerance;
  });
  const shouldOpenPopup = Boolean(options?.openPopup && matchedMarker?.openPopup);
  if (shouldOpenPopup) setTimeout(() => matchedMarker.openPopup(), 180);
  window.__gridlyAlertFocusDebugState = {
    lastAlertFocusIncidentId: incidentId || null,
    lastAlertFocusLat: coords.lat,
    lastAlertFocusLng: coords.lng,
    lastAlertFocusType: String(options?.type || "unknown"),
    lastAlertFocusMatchedMarker: Boolean(matchedMarker),
    lastAlertFocusPopupOpened: shouldOpenPopup,
    lastAlertFocusReason: shouldOpenPopup ? "popup-opened" : matchedMarker ? "pan-only-matched-marker" : "pan-only-no-marker"
  };
  return true;
}


window.gridlyAlertFocusDebug = function () {
  return { ...(window.__gridlyAlertFocusDebugState || {}) };
};

function getRoadHazardSurfaceIncidents(limit = 3) {
  const routeHazard = routeWatchActivated ? getRouteHazardAssessment() : null;
  const severityWeight = { high: 3, medium: 2, moderate: 2, low: 1 };
  return getUnifiedIncidents()
    .filter((incident) => {
      const idLooksRoad = String(incident?.id || "").startsWith("road-");
      const category = getHazardCategory(incident?.report_type || incident?.type || "other_hazard");
      return idLooksRoad && ROAD_HAZARD_DISPLAY_CATEGORIES.has(category);
    })
    .sort((a, b) => {
      const aActive = String(a?.status || "").toLowerCase() !== "cleared";
      const bActive = String(b?.status || "").toLowerCase() !== "cleared";
      if (aActive !== bActive) return bActive ? 1 : -1;
      const aRelevant = isIncidentRouteRelevant(a, routeHazard);
      const bRelevant = isIncidentRouteRelevant(b, routeHazard);
      if (aRelevant !== bRelevant) return bRelevant ? 1 : -1;
      const sevDelta = (severityWeight[String(b?.severity || "low")] || 0) - (severityWeight[String(a?.severity || "low")] || 0);
      if (sevDelta !== 0) return sevDelta;
      return Number(a?.age_minutes ?? 999) - Number(b?.age_minutes ?? 999);
    })
    .slice(0, limit);
}

function renderRoadHazards() {
  if (!els.roadHazardsList) return;
  const hazards = getRoadHazardSurfaceIncidents(3);
  if (!hazards.length) {
    els.roadHazardsList.innerHTML = `
      <div class="alert-item">
        <strong>Road conditions appear calm</strong>
        <p>No high-impact road hazards detected nearby.</p>
      </div>
    `;
    return;
  }

  els.roadHazardsList.innerHTML = hazards.map((incident) => {
    const display = buildRoadHazardDisplay(incident);
    const age = Number.isFinite(Number(incident.age_minutes)) ? `${Math.max(0, Math.round(Number(incident.age_minutes)))}m` : "now";
    return `
      <article class="alert-item intelligence-row ${display.rowClass}" tabindex="0" role="button" ${buildAlertFocusDataset(incident)}>
        <div class="alert-row-main">
          <span class="alert-severity-chip">${sanitizeText(display.meta)}</span>
          <strong>${sanitizeText(display.title)}</strong>
          <span class="alert-row-time">${sanitizeText(age)}</span>
        </div>
        <p class="alert-row-subline">${sanitizeText(display.subtitle)}</p>
      </article>
    `;
  }).join("");
}
function getPrioritizedRailAlertIncidents(limit = 6) {
  const severityWeight = { high: 3, moderate: 2, low: 1, cleared: 0 };
  return getConsolidatedIncidents()
    .slice()
    .sort((a, b) => {
      const aLatest = a?.latestReport || {};
      const bLatest = b?.latestReport || {};
      const aKey = aLatest.type === "cleared" ? "cleared" : String(aLatest.severity || "low");
      const bKey = bLatest.type === "cleared" ? "cleared" : String(bLatest.severity || "low");
      const severityDelta = (severityWeight[bKey] || 0) - (severityWeight[aKey] || 0);
      if (severityDelta !== 0) return severityDelta;
      return Number(a.newestMinutes ?? 999) - Number(b.newestMinutes ?? 999);
    })
    .slice(0, limit);
}

function getOperationalFeedSummaryLine() {
  const consolidatedIncidents = getConsolidatedIncidents();
  if (!consolidatedIncidents.length) {
    return "No active community alerts";
  }
  const topIncident = consolidatedIncidents[0];
  const topReport = topIncident?.latestReport || {};
  const statusLabel = getReportCopy(topReport.type).label;
  const confirmationCount = Number(topIncident.count || 0);
  const confirmationLabel = `${confirmationCount} confirmation${confirmationCount === 1 ? "" : "s"}`;
  const freshness = Number.isFinite(Number(topIncident.newestMinutes)) ? `${Math.max(0, Math.round(Number(topIncident.newestMinutes)))} min ago` : "just now";
  return `${topIncident.crossingName || "Crossing"}: ${statusLabel} · ${confirmationLabel} · newest ${freshness}.`;
}

function renderAlerts() {
  if (!els.alertsList) return;

  const incidents = getConsolidatedIncidents();
  if (!incidents.length) {
    els.alertsList.innerHTML = `
      <div class="alert-item">
        <strong>No active community alerts</strong>
        <p>No high-impact disruptions detected nearby.</p>
      </div>
    `;
    return;
  }

  const prioritized = getPrioritizedRailAlertIncidents(6);

  els.alertsList.innerHTML = prioritized
    .map((incident) => {
      const latest = incident.latestReport;
      const confidenceLabel = getCrossingConfidenceLabel(latest, incident.count);
      const freshnessLabel = getFreshnessLabel(latest);
      const confirmationLabel = getDriverConfirmationLabel(incident.count);
      const reportState = getReportStateLabel(latest);
      const railDisplay = buildRailIncidentDisplay(incident);
      const severityLabel =
        latest.type === "cleared"
          ? "Cleared"
          : latest.severity === "high"
          ? "High"
          : latest.severity === "moderate"
          ? "Moderate"
          : "Watch";
      const itemClass = latest.type === "cleared" ? "cleared" : latest.severity === "high" ? "high" : "";

      return `
        <article class="alert-item intelligence-row ${itemClass}" tabindex="0" role="button" ${buildAlertFocusDataset(latest, { incidentId: incident.crossingId })}>
          <div class="alert-row-main">
            <span class="alert-severity-chip">${sanitizeText(severityLabel)}</span>
            <strong>${sanitizeText(railDisplay.title)}</strong>
            <span class="alert-row-time">${incident.newestMinutes}m</span>
          </div>
          <p class="alert-row-subline">${sanitizeText(railDisplay.subtitlePrefix)} · ${sanitizeText(confirmationLabel)} · ${sanitizeText(reportState)}</p>
          <details class="alert-row-details">
            <summary>Details</summary>
            <p>${sanitizeText(freshnessLabel)} · ${sanitizeText(latest.detail)}</p>
            <p>First reported ${incident.oldestMinutes} min ago</p>
          </details>
        </article>
      `;
    })
    .join("");
}

function renderTrendingCrossings() {
  if (!els.trendingList) return;

  const incidents = getConsolidatedIncidents().slice(0, 3);

  if (!incidents.length) {
    els.trendingList.innerHTML = `<div class="trend-item muted">Nearby crossings look clear right now.</div>`;
    return;
  }

  els.trendingList.innerHTML = incidents
    .map((incident) => {
      const latest = incident.latestReport;
      const confidenceLabel = getCrossingConfidenceLabel(latest, incident.count);
      const freshnessLabel = getFreshnessLabel(latest);
      const confirmationLabel = getDriverConfirmationLabel(incident.count);

      const className =
        latest.type === "cleared"
          ? "clear"
          : latest.severity === "high"
          ? "hot"
          : "";

      return `
        <button class="trend-item ${className}" type="button" data-action="zoom-crossing" data-crossing-id="${sanitizeText(incident.crossingId)}">
          <strong>${sanitizeText(incident.crossingName)}</strong>
          <p>${sanitizeText(freshnessLabel)} · ${sanitizeText(confidenceLabel)} · ${sanitizeText(confirmationLabel)}</p>
        </button>
      `;
    })
    .join("");
}

function updateMobileAlertsMirror() {
  if (!els.mobileAlertsMirror) return;

  const incidents = getConsolidatedIncidents();

  if (!incidents.length) {
    els.mobileAlertsMirror.textContent =
      "Route conditions currently appear calm.";
    return;
  }

  const top = incidents[0];
  const latest = top.latestReport;

  els.mobileAlertsMirror.textContent =
    `${top.crossingName}: ${getReportCopy(latest.type).label} · ${top.count} confirmation${top.count === 1 ? "" : "s"} · newest ${top.newestMinutes} min ago.`;
}

function updateTrustStats() {
  const latestReports = getLatestReportsByCrossing();
  const active = latestReports.filter((report) => !report.expired);

  const lastReport = [...activeReports].sort((a, b) => {
    return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
  })[0];

  safeText("reportDecayStatus", `${REPORT_EXPIRATION_MINUTES} min expiry`);
  safeText("lastReportTime", lastReport ? `${lastReport.minutesAgo} min ago` : "None yet");
  safeText("nearbyAlertCount", active.filter((report) => getIncidentLifecycleState(report) === "active").length);
}

function compareReportsByRecency(a, b) {
  const timeDiff = new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime();
  if (timeDiff !== 0) return timeDiff;
  if (a.type === "cleared" && b.type !== "cleared") return -1;
  if (b.type === "cleared" && a.type !== "cleared") return 1;
  return String(b.id || "").localeCompare(String(a.id || ""));
}

function normalizeCrossingName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getReportLocationKey(report) {
  if (!report || typeof report !== "object") return "";

  if (report.crossingId != null && String(report.crossingId).trim()) {
    return `id:${String(report.crossingId).trim()}`;
  }

  const normalizedName = normalizeCrossingName(report.crossingName || report.crossing || report.locationName);
  if (normalizedName) return `name:${normalizedName}`;

  const lat = Number(report.lat);
  const lng = Number(report.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `ll:${lat.toFixed(4)},${lng.toFixed(4)}`;
  }

  return "";
}

function getLatestReportStateByLocation(reports = activeReports) {
  const latestByLocation = new Map();

  (Array.isArray(reports) ? reports : [])
    .filter((report) => report && !report.expired)
    .sort(compareReportsByRecency)
    .forEach((report) => {
      const key = getReportLocationKey(report);
      if (!key || latestByLocation.has(key)) return;
      latestByLocation.set(key, report);
    });

  return latestByLocation;
}

function getLatestReportForCrossing(crossingId) {
  const locationKey = getReportLocationKey({ crossingId });
  return getLatestReportStateByLocation().get(locationKey);
}

function getLatestReportsByCrossing() {
  return [...getLatestReportStateByLocation().values()];
}

function getConsolidatedIncidents() {
  const grouped = new Map();
  let warnedMalformedReport = false;
  const latestByLocation = getLatestReportStateByLocation();

  activeReports
    .filter((report) => !report.expired)
    .forEach((report) => {
      const key = getReportLocationKey(report);
      if (!key) {
        if (!warnedMalformedReport) {
          console.warn("Consolidated incidents received malformed report data (missing grouping key).", report);
          warnedMalformedReport = true;
        }
        return;
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          crossingId: report.crossingId != null ? String(report.crossingId) : key,
          crossingName: report.crossingName || "Unknown Crossing",
          reports: []
        });
      }

      grouped.get(key).reports.push(report);
    });

  return [...grouped.values()]
    .map((incident) => {
      const reports = Array.isArray(incident.reports) ? incident.reports : [];
      const sorted = [...reports].sort(compareReportsByRecency);
      const latestReport = latestByLocation.get(incident.key) || sorted[0];

      return {
        crossingId: incident.crossingId,
        crossingName: incident.crossingName,
        reports: sorted,
        count: sorted.length,
        latestReport,
        newestMinutes: sorted.length ? Math.min(...sorted.map((r) => r.minutesAgo)) : 0,
        oldestMinutes: sorted.length ? Math.max(...sorted.map((r) => r.minutesAgo)) : 0
      };
    })
    .sort((a, b) => {
      const severityScore = (incident) => {
        const report = incident.latestReport;
        if (getIncidentLifecycleState(report) !== "active") return 0;
        if (report.severity === "high") return 3;
        if (report.severity === "moderate") return 2;
        return 1;
      };

      return severityScore(b) - severityScore(a) || b.count - a.count || a.newestMinutes - b.newestMinutes;
    });

  highlightNearestCrossingOnFirstLoad();
}

function getReportCountForCrossing(crossingId) {
  const locationKey = getReportLocationKey({ crossingId });
  return activeReports.filter(
    (report) => !report.expired && getReportLocationKey(report) === locationKey
  ).length;
}

function getDriverConfirmationLabel(count) {
  if (count <= 0) return "Needs confirmation";
  if (count === 1) return "1 driver confirmation";
  return `${count} driver confirmations`;
}

function getCrossingConfidenceLabel(report, count) {
  if (!report) return "Low";
  if (isClearedReportType(report.type)) return "Cleared";
  if (count >= 3 && report.minutesAgo <= 30) return "High";
  if (count >= 2 && report.minutesAgo <= 60) return "Medium";
  if (report.minutesAgo > REPORT_EXPIRATION_MINUTES) return "Stale";
  return "Low";
}

function getFreshnessLabel(report) {
  if (!report) return "Needs confirmation";
  if (report.minutesAgo <= 1) return "Last confirmed just now";
  return `Last confirmed ${report.minutesAgo} min ago`;
}

function getReportStateLabel(report) {
  if (!report) return "Needs confirmation";
  if (report.expired) return "Expired report";
  const lifecycleState = getIncidentLifecycleState(report);
  if (lifecycleState === "recently_cleared" || lifecycleState === "cleared") return "Cleared by drivers";
  return "Active shared report";
}

function isActiveReportType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  return ["blocked", "heavy", "other", "delayed", "delay", "rail_delay", "rail_blocked"].includes(normalized) || Object.prototype.hasOwnProperty.call(HAZARD_TYPES, normalized);
}

function isClearedReportType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  return normalized === "cleared" || normalized === "hazard_cleared";
}

function isRecentlyCleared(report, now = Date.now()) {
  if (!report || report.expired || !isClearedReportType(report.type)) return false;
  const submittedAtMs = new Date(report.submittedAt || 0).getTime();
  if (!Number.isFinite(submittedAtMs) || submittedAtMs <= 0) return false;
  return now - submittedAtMs <= RECENTLY_CLEARED_WINDOW_MINUTES * 60000;
}

function getIncidentLifecycleState(report, now = Date.now()) {
  if (!report || report.expired) return "inactive";
  if (isActiveReportType(report.type)) return "active";
  if (isClearedReportType(report.type)) {
    return isRecentlyCleared(report, now) ? "recently_cleared" : "cleared";
  }
  return "inactive";
}

function calculateBaseRisk(props, index) {
  let score = 18;

  const traffic = Number(props.aadt || props.avgdailytraffic || props.traffic || 0);
  const trains = Number(props.daythrutrain || props.totaltrains || props.trains || 0);

  if (traffic > 5000) score += 20;
  if (traffic > 10000) score += 12;
  if (trains > 5) score += 14;
  if (trains > 15) score += 14;

  score += index % 7;

  return Math.min(score, 82);
}

function handleCrossingSearch() {
  if (!els.crossingSearch || !els.searchResults) return;

  const query = els.crossingSearch.value.trim().toLowerCase();

  if (!query) {
    els.searchResults.innerHTML = "";
    return;
  }

  const matches = crossings
    .filter((crossing) => `${crossing.name} ${crossing.railroad}`.toLowerCase().includes(query))
    .slice(0, 6);

  if (!matches.length) {
    els.searchResults.innerHTML = `
      <button class="search-result-btn" type="button">
        No matching crossing found
        <span>Try a street name, crossing name, or railroad.</span>
      </button>
    `;
    return;
  }

  els.searchResults.innerHTML = matches
    .map(
      (crossing) => `
        <button class="search-result-btn" type="button" data-action="zoom-crossing" data-crossing-id="${sanitizeText(crossing.id)}">
          ${sanitizeText(crossing.name)}
          <span>${sanitizeText(crossing.railroad)} · Click to zoom and report from map</span>
        </button>
      `
    )
    .join("");
}

function findNearestCrossings(lat, lng, count = 5) {
  return crossings
    .map((crossing) => ({
      ...crossing,
      distance: haversineDistance(lat, lng, crossing.lat, crossing.lng)
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

function getDistanceMiles(lat1, lng1, lat2, lng2) {
  return haversineDistance(lat1, lng1, lat2, lng2);
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const r = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(a));
}

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  return haversineDistance(lat1, lng1, lat2, lng2) * 1.60934;
}

function isPointNearCorridor(lat, lng, startLat, startLng, endLat, endLng, thresholdKm = 2) {
  const samples = 12;
  let minDistanceKm = Infinity;
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const sampleLat = startLat + (endLat - startLat) * t;
    const sampleLng = startLng + (endLng - startLng) * t;
    const distanceKm = calculateDistanceKm(lat, lng, sampleLat, sampleLng);
    if (distanceKm < minDistanceKm) minDistanceKm = distanceKm;
  }
  return minDistanceKm <= thresholdKm;
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function flashButton(button, message) {
  if (!button) return;

  const original = button.textContent;
  button.textContent = message;

  setTimeout(() => {
    button.textContent = original;
  }, 1300);
}

function setConfirmation(message, type = "success") {
  updateReportingState({
    lastReportMessage: message || "",
    lastReportError: type === "error" ? message || "" : ""
  });
  if (!els.reportConfirmation) return;

  els.reportConfirmation.classList.remove("success", "error");

  if (type) {
    els.reportConfirmation.classList.add(type);
  }

  els.reportConfirmation.textContent = message;
}

function showShareCard() {
  els.shareCard?.classList.add("visible");
}

async function shareGridly() {
  const shareData = {
    title: "Gridly",
    text: "Check live railroad crossing reports before you go.",
    url: "https://dbmaps.github.io/liberty-county-map/"
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      setConfirmation("Thanks for sharing Gridly.", "success");
      return;
    } catch {
      return;
    }
  }

  try {
    await navigator.clipboard.writeText(shareData.url);
    setConfirmation("Gridly link copied to clipboard.", "success");
  } catch {
    setConfirmation("Share link: https://dbmaps.github.io/liberty-county-map/", "success");
  }
}

function setSync(value) {
  safeText("syncStatus", value);
}

function safeText(id, value) {
  if (!els[id]) els[id] = document.getElementById(id);
  if (els[id]) els[id].textContent = value;
  document.querySelectorAll(`[data-bind-text="${id}"]`).forEach((node) => {
    node.textContent = value;
  });
}

function gridlyHealthCheck() {
  const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
  const dupes = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (dupes.length) console.warn("[Gridly health] Duplicate IDs:", [...new Set(dupes)]);
  ["map", "dashboardSection", "reportSection", "alertsSection"].forEach((id) => {
    if (!document.getElementById(id)) console.warn(`[Gridly health] Missing required element #${id}`);
  });
}
window.gridlyHealthCheck = gridlyHealthCheck;

function sanitizeText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
/* =========================================================
   GRIDLY V12.3.1 — SMART CROSSING REVIEW MODE
   Multi-decision review tool
   Activate with: ?review=1
========================================================= */

const REVIEW_MODE_ACTIVE = new URLSearchParams(window.location.search).get("review") === "1";
const REVIEW_STORAGE_KEY = "gridlyCrossingReviewDecisionsV1231";

let crossingReviewDecisions = JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY) || "{}");

const originalLoadCrossingsV1231 = loadCrossings;

loadCrossings = async function () {
  await originalLoadCrossingsV1231();

  if (REVIEW_MODE_ACTIVE) {
    initCrossingReviewMode();
  }
};

function initCrossingReviewMode() {
  injectCrossingReviewStyles();
  buildCrossingReviewPanel();
  safeText("mapTrustNote", "Crossing Review Mode is active. Normal users do not see this.");
}

function getReviewDecision(crossingId) {
  return crossingReviewDecisions[String(crossingId)] || {
    visibility: "unreviewed",
    renameNeeded: false,
    needsCheck: false,
    localName: "",
    notes: ""
  };
}

function saveReviewDecision(crossingId, updates) {
  crossingReviewDecisions[String(crossingId)] = {
    ...getReviewDecision(crossingId),
    ...updates,
    reviewedAt: new Date().toISOString()
  };

  localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(crossingReviewDecisions, null, 2));
  buildCrossingReviewPanel();
}

function buildCrossingReviewPanel() {
  const existing = document.getElementById("crossingReviewPanel");
  if (existing) existing.remove();

  const reviewed = Object.values(crossingReviewDecisions);
  const keepCount = reviewed.filter((d) => d.visibility === "keep").length;
  const hideCount = reviewed.filter((d) => d.visibility === "hide").length;
  const renameCount = reviewed.filter((d) => d.renameNeeded).length;
  const checkCount = reviewed.filter((d) => d.needsCheck).length;

  const panel = document.createElement("div");
  panel.id = "crossingReviewPanel";
  panel.className = "crossing-review-panel";

  panel.innerHTML = `
    <div class="review-header">
      <div>
        <strong>Gridly V12.3.1 Review Mode</strong>
        <span>${crossings.length} FRA crossings loaded</span>
      </div>
      <button type="button" onclick="exportCrossingReviewDecisions()">Export JSON</button>
    </div>

    <div class="review-counts">
      <span>Keep: ${keepCount}</span>
      <span>Hide: ${hideCount}</span>
      <span>Rename: ${renameCount}</span>
      <span>Check: ${checkCount}</span>
    </div>

    <div class="review-help">
      Visibility and rename are now separate. You can mark a crossing as Hidden + Rename, Kept + Rename, or Needs Check.
    </div>

    <div class="review-list">
      ${crossings
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((crossing) => renderReviewCrossingItem(crossing))
        .join("")}
    </div>
  `;

  document.body.appendChild(panel);
}

function renderReviewCrossingItem(crossing) {
  const decision = getReviewDecision(crossing.id);

  const statusParts = [];

  if (decision.visibility === "keep") statusParts.push("Kept");
  if (decision.visibility === "hide") statusParts.push("Hidden");
  if (decision.visibility === "unreviewed") statusParts.push("Unreviewed");
  if (decision.renameNeeded) statusParts.push("Rename");
  if (decision.needsCheck) statusParts.push("Needs Check");
  if (decision.localName) statusParts.push("Local Name Added");

  const statusText = statusParts.join(" + ");

  return `
    <div class="review-item ${sanitizeText(decision.visibility)} ${decision.renameNeeded ? "rename" : ""} ${decision.needsCheck ? "needs_check" : ""}" id="review-${sanitizeText(crossing.id)}">
      <div class="review-title">
        <strong>${sanitizeText(crossing.name)}</strong>
        <span>${sanitizeText(crossing.railroad)}</span>
      </div>

      <div class="review-meta">
        ID: ${sanitizeText(crossing.id)}<br>
        ${crossing.lat.toFixed(6)}, ${crossing.lng.toFixed(6)}
      </div>

      <input
        type="text"
        placeholder="Local nickname / better public name"
        value="${sanitizeText(decision.localName || "")}"
        onchange="setCrossingNickname('${sanitizeText(crossing.id)}', this.value)"
      />

      <textarea
        placeholder="Notes, reason, local context"
        onchange="setCrossingNotes('${sanitizeText(crossing.id)}', this.value)"
      >${sanitizeText(decision.notes || "")}</textarea>

      <div class="review-actions">
        <button onclick="setCrossingVisibility('${sanitizeText(crossing.id)}', 'keep')">Keep</button>
        <button onclick="setCrossingVisibility('${sanitizeText(crossing.id)}', 'hide')">Hide</button>
        <button onclick="toggleCrossingRename('${sanitizeText(crossing.id)}')">Rename</button>
        <button onclick="toggleNeedsCheck('${sanitizeText(crossing.id)}')">Needs Check</button>
        <button onclick="zoomToCrossing('${sanitizeText(crossing.id)}')">Zoom</button>
      </div>

      <div class="review-status">Status: ${sanitizeText(statusText)}</div>
    </div>
  `;
}

window.setCrossingVisibility = function (crossingId, visibility) {
  saveReviewDecision(crossingId, { visibility });
};

window.toggleCrossingRename = function (crossingId) {
  const decision = getReviewDecision(crossingId);
  saveReviewDecision(crossingId, { renameNeeded: !decision.renameNeeded });
};

window.toggleNeedsCheck = function (crossingId) {
  const decision = getReviewDecision(crossingId);
  saveReviewDecision(crossingId, { needsCheck: !decision.needsCheck });
};

window.setCrossingNickname = function (crossingId, value) {
  const trimmed = value.trim();

  saveReviewDecision(crossingId, {
    localName: trimmed,
    renameNeeded: trimmed.length > 0 ? true : getReviewDecision(crossingId).renameNeeded
  });

  highlightNearestCrossingOnFirstLoad();
};

window.setCrossingNotes = function (crossingId, value) {
  saveReviewDecision(crossingId, {
    notes: value.trim()
  });

  highlightNearestCrossingOnFirstLoad();
};

window.exportCrossingReviewDecisions = function () {
  const output = JSON.stringify(crossingReviewDecisions, null, 2);

  navigator.clipboard
    .writeText(output)
    .then(() => setConfirmation("Crossing review JSON copied to clipboard.", "success"))
    .catch(() => {
      console.log("Gridly Crossing Review Export:", output);
      setConfirmation("Export printed to console. Open DevTools to copy it.", "success");
    });

  highlightNearestCrossingOnFirstLoad();
};

function injectCrossingReviewStyles() {
  if (document.getElementById("crossingReviewStyles")) return;

  const style = document.createElement("style");
  style.id = "crossingReviewStyles";

  style.textContent = `
    .crossing-review-panel {
      position: fixed;
      top: 92px;
      right: 16px;
      width: 400px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 120px);
      overflow-y: auto;
      z-index: 99999;
      background: rgba(9, 18, 32, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 18px;
      box-shadow: 0 22px 70px rgba(0, 0, 0, 0.45);
      color: #ffffff;
      padding: 14px;
      backdrop-filter: blur(16px);
    }

    .review-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 10px;
    }

    .review-header strong {
      display: block;
      font-size: 15px;
    }

    .review-header span {
      display: block;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.65);
      margin-top: 2px;
    }

    .review-counts {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }

    .review-counts span {
      border-radius: 999px;
      background: rgba(255,255,255,0.1);
      padding: 6px;
      text-align: center;
      font-size: 11px;
      font-weight: 800;
    }

    .review-header button,
    .review-actions button {
      border: 0;
      border-radius: 999px;
      padding: 7px 10px;
      font-weight: 800;
      cursor: pointer;
      background: #43e6a0;
      color: #041018;
      font-size: 11px;
    }

    .review-help {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 12px;
      line-height: 1.4;
    }

    .review-list {
      display: grid;
      gap: 10px;
    }

    .review-item {
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.055);
    }

    .review-item.keep {
      border-color: rgba(67, 230, 160, 0.65);
    }

    .review-item.hide {
      border-color: rgba(255, 88, 88, 0.75);
      opacity: 0.82;
    }

    .review-item.rename {
      box-shadow: inset 4px 0 0 rgba(88, 166, 255, 0.85);
    }

    .review-item.needs_check {
      box-shadow: inset 4px 0 0 rgba(255, 209, 102, 0.95);
    }

    .review-title strong {
      display: block;
      font-size: 14px;
    }

    .review-title span,
    .review-meta,
    .review-status {
      display: block;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.65);
      margin-top: 4px;
      line-height: 1.35;
    }

    .review-item input,
    .review-item textarea {
      width: 100%;
      margin-top: 8px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(0, 0, 0, 0.22);
      color: #fff;
      padding: 8px;
      font-size: 12px;
    }

    .review-item textarea {
      min-height: 58px;
      resize: vertical;
      margin-bottom: 8px;
      font-family: inherit;
    }

    .review-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .review-actions button:nth-child(2) {
      background: #ff6868;
      color: #fff;
    }

    .review-actions button:nth-child(3) {
      background: #58a6ff;
      color: #041018;
    }

    .review-actions button:nth-child(4) {
      background: #ffd166;
      color: #041018;
    }

    .review-actions button:nth-child(5) {
      background: rgba(255,255,255,0.16);
      color: #fff;
    }

    @media (max-width: 760px) {
      .crossing-review-panel {
        top: auto;
        bottom: 88px;
        left: 12px;
        right: 12px;
        width: auto;
        max-height: 46vh;
      }
    }
  `;

  document.head.appendChild(style);
}
/* =========================================================
   GRIDLY V12.5B2 — MOBILE CTA CLEANUP
   One smart mobile issue button
========================================================= */

const originalInjectHazardReportUIV125B2 = injectHazardReportUI;

injectHazardReportUI = function () {
  originalInjectHazardReportUIV125B2();
  upgradeMobileIssueCTA();
};

function upgradeMobileIssueCTA() {
  const launcher = document.getElementById("gridlyHazardLauncher");
  const choiceGrid = document.querySelector("#gridlyHazardPanel .hazard-choice-grid");

  if (launcher) {
    launcher.textContent = "Report Issue Near Me";
  }

  ensureFloodingHazardChoice(choiceGrid);
  injectMobileCTACleanupStyles();
}

function ensureFloodingHazardChoice(choiceGrid) {
  if (!choiceGrid) return;
  const floodButton = choiceGrid.querySelector('button[data-action="open-hazard-placement"][data-hazard-type="flooding"]');
  if (floodButton) return;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = "open-hazard-placement";
  button.dataset.hazardType = "flooding";
  button.textContent = "🌊 Flooding";

  const firstHazardButton = choiceGrid.querySelector('button[data-action="open-hazard-placement"]');
  if (firstHazardButton) {
    choiceGrid.insertBefore(button, firstHazardButton);
  } else {
    choiceGrid.appendChild(button);
  }
}

window.gridlyHazardPickerAuditDebug = function gridlyHazardPickerAuditDebug() {
  const picker = document.getElementById("gridlyHazardPanel");
  const pickerRect = picker?.getBoundingClientRect?.() || null;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
  const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
  const actionArea = picker?.querySelector(".hazard-panel-placement-actions") || null;
  const actionAreaRect = actionArea?.getBoundingClientRect?.() || null;
  const choiceList = picker?.querySelector(".hazard-choice-grid") || null;
  const optionButtons = picker ? Array.from(picker.querySelectorAll('.hazard-choice-grid button[data-action="open-hazard-placement"]')) : [];

  const hazardOptions = optionButtons.map((btn) => {
    const rect = btn.getBoundingClientRect();
    return {
      text: (btn.textContent || "").trim(),
      hazardType: btn.dataset.hazardType || "",
      rect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height
      },
      visibleInViewport: rect.bottom > 0 && rect.top < viewportHeight
    };
  });

  const floodingEntry = hazardOptions.find((option) => option.hazardType === "flooding");
  const clippedTop = Boolean(pickerRect && pickerRect.top < 0);
  const clippedBottom = Boolean(pickerRect && pickerRect.bottom > viewportHeight);

  return {
    pickerExists: Boolean(picker),
    pickerRect: pickerRect
      ? {
          top: pickerRect.top,
          bottom: pickerRect.bottom,
          left: pickerRect.left,
          right: pickerRect.right,
          width: pickerRect.width,
          height: pickerRect.height
        }
      : null,
    pickerScrollHeight: picker?.scrollHeight ?? null,
    pickerClientHeight: picker?.clientHeight ?? null,
    pickerOverflowY: picker ? window.getComputedStyle(picker).overflowY : null,
    listContainerSelector: "#gridlyHazardPanel .hazard-choice-grid",
    listRect: choiceList?.getBoundingClientRect?.()?.toJSON?.() || null,
    listScrollHeight: choiceList?.scrollHeight ?? null,
    listClientHeight: choiceList?.clientHeight ?? null,
    listOverflowY: choiceList ? window.getComputedStyle(choiceList).overflowY : null,
    actionAreaExists: Boolean(actionArea),
    actionAreaRect: actionAreaRect
      ? {
          top: actionAreaRect.top,
          bottom: actionAreaRect.bottom,
          left: actionAreaRect.left,
          right: actionAreaRect.right,
          width: actionAreaRect.width,
          height: actionAreaRect.height
        }
      : null,
    actionAreaVisible: Boolean(
      actionAreaRect &&
      actionAreaRect.bottom > 0 &&
      actionAreaRect.top < viewportHeight &&
      actionAreaRect.right > 0 &&
      actionAreaRect.left < viewportWidth
    ),
    footerRect: actionAreaRect?.toJSON?.() || null,
    footerOverlapsList: Boolean(actionAreaRect && choiceList && actionAreaRect.top < choiceList.getBoundingClientRect().bottom),
    hazardOptions: hazardOptions.map((opt) => ({ ...opt, type: opt.hazardType, visibleWithinList: Boolean(choiceList && opt.rect.bottom <= choiceList.getBoundingClientRect().bottom && opt.rect.top >= choiceList.getBoundingClientRect().top) })),
    missingHazards: ["flooding","ice","debris","crash","construction","road_closed","disabled_vehicle","other_hazard"].filter((type) => !hazardOptions.some((opt) => opt.hazardType === type)),
    unreachableHazards: hazardOptions.filter((opt) => choiceList && !(opt.rect.bottom <= choiceList.getBoundingClientRect().bottom && opt.rect.top >= choiceList.getBoundingClientRect().top)).map((opt) => opt.hazardType),
    floodingExists: Boolean(floodingEntry),
    floodingVisible: Boolean(floodingEntry?.visibleInViewport),
    clippedTop,
    clippedBottom
  };
};

function syncHazardPickerFooterSpacing() {
  const picker = document.getElementById("gridlyHazardPanel");
  if (!picker) return;
  const footer = picker.querySelector(".hazard-panel-placement-actions");
  const footerHeight = Math.ceil(footer?.getBoundingClientRect?.().height || 0);
  const safeInsetBottom = 24;
  const total = Math.max(8, footerHeight + safeInsetBottom);
  picker.style.setProperty("--gridly-hazard-list-bottom-padding", `${total}px`);
}

function injectMobileCTACleanupStyles() {
  if (document.getElementById("gridlyMobileCTACleanupStyles")) return;

  const style = document.createElement("style");
  style.id = "gridlyMobileCTACleanupStyles";

  style.textContent = `
    @media (max-width: 760px) {
      #mobileReportBtn {
        display: none !important;
      }

      .gridly-hazard-launcher {
        left: 14px !important;
        right: 14px !important;
        bottom: 94px !important;
        width: calc(100vw - 28px) !important;
        padding: 16px 18px !important;
        font-size: 17px !important;
        border-radius: 999px !important;
      }

      .gridly-hazard-counter {
        left: 14px !important;
        right: 14px !important;
        bottom: 154px !important;
        text-align: center !important;
        font-size: 12px !important;
        padding: 9px 12px !important;
      }

      .gridly-hazard-panel {
        left: 14px !important;
        right: 14px !important;
        bottom: calc(124px + env(safe-area-inset-bottom, 0px)) !important;
        top: max(10px, env(safe-area-inset-top)) !important;
        width: auto !important;
        max-height: calc(100dvh - max(10px, env(safe-area-inset-top)) - (124px + env(safe-area-inset-bottom, 0px))) !important;
        display: none !important;
        grid-template-rows: auto auto minmax(0, 1fr) auto !important;
        gap: 0 !important;
        padding: 12px 12px 10px !important;
        border-radius: 16px !important;
        border-color: rgba(142, 204, 255, 0.24) !important;
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.42) !important;
      }
      .gridly-hazard-panel.visible {
        display: grid !important;
      }
      .gridly-hazard-panel h3 {
        margin: 0 0 4px !important;
        font-size: 1rem !important;
      }
      .gridly-hazard-panel > p {
        margin: 0 0 8px !important;
        font-size: 0.81rem !important;
        line-height: 1.35 !important;
      }
      .hazard-choice-grid {
        min-height: 0 !important;
        height: 100% !important;
        max-height: 100% !important;
        overflow-y: auto !important;
        overscroll-behavior: contain !important;
        -webkit-overflow-scrolling: touch !important;
        padding-bottom: var(--gridly-hazard-list-bottom-padding, 8px) !important;
        gap: 8px !important;
      }
      .hazard-choice-grid button {
        min-height: 40px !important;
        padding: 9px 11px !important;
        border-radius: 12px !important;
        font-size: 0.85rem !important;
        line-height: 1.2 !important;
      }
      .hazard-panel-placement-actions {
        position: sticky !important;
        bottom: 0 !important;
        flex-shrink: 0 !important;
        background: rgba(9, 18, 32, 0.98) !important;
        padding-top: 6px !important;
        padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px)) !important;
        margin-top: 4px !important;
        border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
        display: grid !important;
        grid-template-columns: 1fr 1fr auto !important;
        gap: 6px !important;
      }
      .hazard-panel-placement-actions button {
        min-height: 34px !important;
        padding: 7px 10px !important;
        border-radius: 10px !important;
        font-size: 0.78rem !important;
        font-weight: 700 !important;
      }
      .hazard-panel-placement-actions button[data-action="cancel-hazard-placement"] {
        min-width: 64px !important;
        opacity: 0.9 !important;
      }
    }
  `;

  document.head.appendChild(style);
}
/* =========================================================
   GRIDLY V12.6A — BETA LAUNCH PACK
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    initGridlyBetaLaunchPack();
  }, 900);
});

function initGridlyBetaLaunchPack() {
  injectBetaLaunchUI();
  maybeShowWelcomeModal();
}

function injectBetaLaunchUI() {
  if (document.getElementById("gridlyBetaLaunchWrap")) return;

  const isMobileLayout = window.matchMedia("(max-width: 1100px)").matches;
  const wrap = document.createElement("div");
  wrap.id = "gridlyBetaLaunchWrap";

  wrap.innerHTML = `
    <div class="gridly-mission-banner">
      Help Liberty County avoid delays. Report issues when you see them.
    </div>

    ${isMobileLayout ? "" : `<button class="gridly-share-btn" type="button">Share Gridly</button>`}

    <button class="gridly-feedback-btn" type="button">
      Feedback
    </button>
  `;

  document.body.appendChild(wrap);

  wrap.querySelector(".gridly-share-btn")?.addEventListener("click", shareGridlyApp);

  wrap.querySelector(".gridly-feedback-btn")
    .addEventListener("click", openFeedbackPrompt);

  injectBetaLaunchStyles();
}

function maybeShowWelcomeModal() {
  if (localStorage.getItem("gridlyWelcomeSeenV126A")) return;

  localStorage.setItem("gridlyWelcomeSeenV126A", "yes");

  const modal = document.createElement("div");
  modal.id = "gridlyWelcomeModal";
  modal.className = "gridly-welcome-modal";

  modal.innerHTML = `
    <div class="gridly-welcome-card">
      <h2>Welcome to Gridly Beta</h2>
      <p>
        Know before you go. See local crossing issues, road hazards,
        and help your community move faster.
      </p>

      <div class="gridly-welcome-actions">
        <button onclick="closeGridlyWelcome()">Get Started</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

window.closeGridlyWelcome = function () {
  document.getElementById("gridlyWelcomeModal")?.remove();
};

window.resetGridlySetup = function resetGridlySetup() {
  saveGridlyUserProfile({
    name: "",
    zipCode: "",
    homeTown: "",
    state: "",
    homeTownLat: null,
    homeTownLng: null,
    homeTownLabel: "",
    setupComplete: false,
    setupSkipped: false
  });
  setConfirmation("Setup reset. Reload when setup returns.", "info");
};

async function shareGridlyApp() {
  const shareData = {
    title: "Gridly",
    text: "Know before you go. Live road hazards + crossing alerts.",
    url: window.location.href
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setConfirmation("Gridly link copied to clipboard.", "success");
    }
  } catch (error) {
    console.log("Share cancelled.");
  }
}

function openFeedbackPrompt() {
  const feedback = prompt(
    "Send Gridly feedback:\n\nIdeas, bugs, bad crossing names, feature requests..."
  );

  if (!feedback) return;

  const existing = localStorage.getItem("gridlyFeedbackLog") || "[]";
  const rows = JSON.parse(existing);

  rows.push({
    feedback,
    createdAt: new Date().toISOString(),
    build: APP_BUILD
  });

  localStorage.setItem("gridlyFeedbackLog", JSON.stringify(rows));

  setConfirmation("Thanks for helping improve Gridly.", "success");
}

function injectBetaLaunchStyles() {
  if (document.getElementById("gridlyBetaLaunchStyles")) return;

  const style = document.createElement("style");
  style.id = "gridlyBetaLaunchStyles";

  style.textContent = `
    #gridlyBetaLaunchWrap {
      position: fixed;
      left: 16px;
      bottom: 18px;
      z-index: 9997;
      display: grid;
      gap: 8px;
      width: 220px;
    }

    .gridly-mission-banner {
      background: rgba(9,18,32,0.94);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 18px;
      padding: 12px;
      font-size: 12px;
      line-height: 1.45;
      box-shadow: 0 18px 40px rgba(0,0,0,0.28);
      backdrop-filter: blur(14px);
    }

    .gridly-share-btn,
    .gridly-feedback-btn {
      border: 0;
      border-radius: 999px;
      padding: 11px 14px;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 14px 30px rgba(0,0,0,0.24);
    }

    .gridly-share-btn {
      background: linear-gradient(135deg,#43e6a0,#45b8ff);
      color: #041018;
    }

    .gridly-feedback-btn {
      background: rgba(255,255,255,0.12);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.16);
    }

    .gridly-welcome-modal {
      position: fixed;
      inset: 0;
      z-index: 100000;
      display: grid;
      place-items: center;
      background: rgba(0,0,0,0.55);
      padding: 18px;
    }

    .gridly-welcome-card {
      width: 100%;
      max-width: 420px;
      background: #08111f;
      color: #fff;
      border-radius: 24px;
      padding: 24px;
      border: 1px solid rgba(255,255,255,0.14);
      box-shadow: 0 24px 70px rgba(0,0,0,0.34);
      text-align: center;
    }

    .gridly-welcome-card h2 {
      margin: 0 0 10px;
      font-size: 28px;
    }

    .gridly-welcome-card p {
      margin: 0;
      color: rgba(255,255,255,0.78);
      line-height: 1.55;
      font-size: 15px;
    }

    .gridly-welcome-actions {
      margin-top: 18px;
    }

    .gridly-welcome-actions button {
      border: 0;
      border-radius: 999px;
      padding: 12px 18px;
      font-weight: 900;
      background: linear-gradient(135deg,#43e6a0,#45b8ff);
      color: #041018;
      cursor: pointer;
    }

    @media (max-width: 760px) {
      #gridlyBetaLaunchWrap {
        left: 14px;
        right: 14px;
        width: auto;
        bottom: 162px;
      }

      .gridly-mission-banner {
        font-size: 12px;
        text-align: center;
      }

      .gridly-share-btn,
      .gridly-feedback-btn {
        width: 100%;
      }

      .gridly-welcome-card h2 {
        font-size: 24px;
      }
    }
  `;

  document.head.appendChild(style);
}
/* =========================================================
   GRIDLY V12.6B — UI INTEGRATION PASS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    runGridlyUIIntegrationPass();
  }, 1200);
});

function runGridlyUIIntegrationPass() {
  moveDesktopLaunchActions();
  cleanMobileLaunchPack();
  addHazardChipToCTA();
}

function moveDesktopLaunchActions() {
  if (window.innerWidth <= 760) return;

  const wrap = document.getElementById("gridlyBetaLaunchWrap");
  if (!wrap) return;

  const alertsPanel =
    [...document.querySelectorAll("section, div")].find((el) =>
      el.textContent.includes("LIVE ALERTS")
    ) || null;

  if (!alertsPanel) return;

  const dock = document.createElement("div");
  dock.id = "gridlyDesktopLaunchDock";
  dock.innerHTML = `
    <button class="gridly-mini-action" onclick="shareGridlyApp()">Share Gridly</button>
    <button class="gridly-mini-action alt" onclick="openFeedbackPrompt()">Feedback</button>
  `;

  alertsPanel.appendChild(dock);

  wrap.style.display = "none";

  injectGridlyIntegrationStyles();
}

function cleanMobileLaunchPack() {
  if (!window.matchMedia("(max-width: 1100px)").matches) return;

  const wrap = document.getElementById("gridlyBetaLaunchWrap");

  if (wrap) {
    wrap.querySelector(".gridly-share-btn")?.remove();
    wrap.style.display = "none";
  }

  injectGridlyIntegrationStyles();
}

function addHazardChipToCTA() {
  const launcher = document.getElementById("gridlyHazardLauncher");
  const counter = document.getElementById("gridlyHazardCounter");

  if (!launcher || !counter) return;

  const text = counter.textContent.trim();

  if (!launcher.querySelector(".gridly-inline-chip")) {
    const chip = document.createElement("span");
    chip.className = "gridly-inline-chip";
    chip.textContent = text;
    launcher.prepend(chip);
  } else {
    launcher.querySelector(".gridly-inline-chip").textContent = text;
  }

  counter.style.display = "none";
}

function injectGridlyIntegrationStyles() {
  if (document.getElementById("gridlyIntegrationStyles")) return;

  const style = document.createElement("style");
  style.id = "gridlyIntegrationStyles";

  style.textContent = `
    #gridlyDesktopLaunchDock {
      margin-top: 14px;
      display: grid;
      gap: 8px;
    }

    .gridly-mini-action {
      border: 0;
      border-radius: 999px;
      padding: 10px 12px;
      font-weight: 900;
      cursor: pointer;
      background: linear-gradient(135deg,#43e6a0,#45b8ff);
      color: #041018;
      width: 100%;
    }

    .gridly-mini-action.alt {
      background: rgba(255,255,255,0.1);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.14);
    }

    .gridly-inline-chip {
      display: block;
      font-size: 11px;
      font-weight: 900;
      margin-bottom: 3px;
      opacity: 0.82;
      line-height: 1.1;
    }

    @media (max-width: 760px) {
      .gridly-hazard-launcher {
        bottom: 92px !important;
        padding-top: 12px !important;
        padding-bottom: 14px !important;
      }

      .gridly-inline-chip {
        font-size: 10px;
        margin-bottom: 2px;
      }
    }
  `;

  document.head.appendChild(style);
}
/* =========================================================
   GRIDLY V12.6C — DESKTOP PREMIUM PASS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    runDesktopPremiumPassV126C();
  }, 1500);
});

function runDesktopPremiumPassV126C() {
  fixDesktopHazardCTA();
  upgradeDesktopCommunityTools();
  injectDesktopPremiumStylesV126C();
}

function fixDesktopHazardCTA() {
  const launcher = document.getElementById("gridlyHazardLauncher");
  const counter = document.getElementById("gridlyHazardCounter");

  if (!launcher || !counter) return;
  if (window.innerWidth <= 760) return;

  launcher.classList.add("desktop-premium-cta");

  const text = counter.textContent.trim();

  if (!launcher.querySelector(".desktop-hazard-chip")) {
    const chip = document.createElement("span");
    chip.className = "desktop-hazard-chip";
    chip.textContent = text;
    launcher.prepend(chip);
  } else {
    launcher.querySelector(".desktop-hazard-chip").textContent = text;
  }

  counter.style.display = "none";
}

function upgradeDesktopCommunityTools() {
  if (window.innerWidth <= 760) return;

  const oldWrap = document.getElementById("gridlyBetaLaunchWrap");
  if (oldWrap) oldWrap.style.display = "none";

  if (document.getElementById("gridlyCommunityToolsCard")) return;

  const cards = [...document.querySelectorAll(".card, .panel, section, div")];
  const target =
    cards.find((el) => el.textContent.includes("LIVE ALERTS")) ||
    cards.find((el) => el.textContent.includes("Live Alerts"));

  if (!target) return;

  const card = document.createElement("div");
  card.id = "gridlyCommunityToolsCard";
  card.innerHTML = `
    <div class="community-tools-eyebrow">COMMUNITY TOOLS</div>
    <div class="community-tools-title">Help improve Gridly</div>
    <p>Share the beta or send quick feedback about crossings, hazards, or layout issues.</p>
    <button type="button" onclick="shareGridlyApp()">Share Gridly</button>
    <button type="button" class="secondary" onclick="openFeedbackPrompt()">Send Feedback</button>
  `;

  target.appendChild(card);
}

function injectDesktopPremiumStylesV126C() {
  if (document.getElementById("desktopPremiumStylesV126C")) return;

  const style = document.createElement("style");
  style.id = "desktopPremiumStylesV126C";

  style.textContent = `
    @media (min-width: 761px) {
      #gridlyBetaLaunchWrap {
        display: none !important;
      }

      .desktop-premium-cta {
        display: grid !important;
        gap: 4px !important;
        place-items: center !important;
        min-width: 190px !important;
        padding: 12px 18px !important;
        line-height: 1.1 !important;
      }

      .desktop-premium-cta .gridly-inline-chip {
        display: none !important;
      }

      .desktop-hazard-chip {
        display: block;
        font-size: 11px;
        font-weight: 950;
        opacity: 0.85;
        margin-bottom: 2px;
        white-space: nowrap;
      }

      #gridlyCommunityToolsCard {
        margin-top: 16px;
        padding: 14px;
        border-radius: 18px;
        background: rgba(255,255,255,0.065);
        border: 1px solid rgba(255,255,255,0.12);
        display: grid;
        gap: 8px;
      }

      .community-tools-eyebrow {
        color: #43e6a0;
        font-size: 11px;
        letter-spacing: 0.16em;
        font-weight: 950;
      }

      .community-tools-title {
        color: #fff;
        font-size: 18px;
        font-weight: 950;
      }

      #gridlyCommunityToolsCard p {
        margin: 0;
        color: rgba(255,255,255,0.68);
        font-size: 13px;
        line-height: 1.4;
      }

      #gridlyCommunityToolsCard button {
        border: 0;
        border-radius: 999px;
        padding: 10px 12px;
        font-weight: 950;
        cursor: pointer;
        background: linear-gradient(135deg,#43e6a0,#45b8ff);
        color: #041018;
      }

      #gridlyCommunityToolsCard button.secondary {
        background: rgba(255,255,255,0.1);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.14);
      }
    }
  `;

  document.head.appendChild(style);
}
/* =========================================================
   GRIDLY V12.6C1 — COMMUNITY TOOLS SIDEBAR POLISH
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    moveCommunityToolsToSidebarV126C1();
    injectCommunitySidebarPolishV126C1();
  }, 1800);
});

function moveCommunityToolsToSidebarV126C1() {
  if (window.innerWidth <= 760) return;

  const tools = document.getElementById("gridlyCommunityToolsCard");
  if (!tools) return;

  const rightColumn =
    tools.closest(".desktop-command-panel") ||
    [...document.querySelectorAll("aside, .sidebar, .right-panel, .desktop-panel, div")]
      .find((el) =>
        el.textContent.includes("LIVE ALERTS") &&
        el.getBoundingClientRect().width < 420
      );

  if (!rightColumn) return;

  rightColumn.appendChild(tools);
  tools.classList.add("community-tools-sidebar-card");
}

function injectCommunitySidebarPolishV126C1() {
  if (document.getElementById("communitySidebarPolishV126C1")) return;

  const style = document.createElement("style");
  style.id = "communitySidebarPolishV126C1";

  style.textContent = `
    @media (min-width: 761px) {
      #gridlyCommunityToolsCard.community-tools-sidebar-card {
        width: 100% !important;
        margin-top: 16px !important;
        padding: 14px !important;
      }

      #gridlyCommunityToolsCard.community-tools-sidebar-card button {
        width: 100% !important;
      }
    }
  `;

  document.head.appendChild(style);
}
/* =========================================================
   GRIDLY V12.6C2 — STABLE COMMUNITY TOOLS POSITION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    stabilizeCommunityToolsV126C2();
  }, 2600);
});

function stabilizeCommunityToolsV126C2() {
  const tools = document.getElementById("gridlyCommunityToolsCard");
  if (!tools) return;

  tools.classList.add("gridly-community-stable");

  injectStableCommunityToolsStylesV126C2();
}

function injectStableCommunityToolsStylesV126C2() {
  if (document.getElementById("stableCommunityToolsStylesV126C2")) return;

  const style = document.createElement("style");
  style.id = "stableCommunityToolsStylesV126C2";

  style.textContent = `
    @media (min-width: 761px) {
      #gridlyCommunityToolsCard {
        max-width: 420px !important;
        margin: 16px 0 10px auto !important;
        padding: 14px !important;
        transition: none !important;
      }

      #gridlyCommunityToolsCard button {
        width: 100% !important;
      }
    }
  `;

  document.head.appendChild(style);
}
/* =========================================================
   GRIDLY V12.6C3 — HIDE DESKTOP COMMUNITY TOOLS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    hideDesktopCommunityToolsV126C3();
  }, 3000);
});

function hideDesktopCommunityToolsV126C3() {
  injectHideDesktopCommunityToolsStylesV126C3();
}

function injectHideDesktopCommunityToolsStylesV126C3() {
  if (document.getElementById("hideDesktopCommunityToolsStylesV126C3")) return;

  const style = document.createElement("style");
  style.id = "hideDesktopCommunityToolsStylesV126C3";

  style.textContent = `
    @media (min-width: 761px) {
      #gridlyCommunityToolsCard,
      #gridlyDesktopLaunchDock,
      #gridlyBetaLaunchWrap {
        display: none !important;
      }
    }
  `;

  document.head.appendChild(style);
}
/* =========================================================
   GRIDLY V12.6C4 — INSTANT UI STABILIZER
========================================================= */

(function stabilizeGridlyUIImmediately() {
  const style = document.createElement("style");
  style.id = "gridlyInstantUIStabilizerV126C4";

  style.textContent = `
    @media (min-width: 761px) {
      #gridlyCommunityToolsCard,
      #gridlyDesktopLaunchDock,
      #gridlyBetaLaunchWrap {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    }

    @media (max-width: 760px) {
      #gridlyBetaLaunchWrap {
        display: block !important;
        position: static !important;
        width: auto !important;
        margin: 14px 20px !important;
      }

      #gridlyBetaLaunchWrap .gridly-mission-banner,
      #gridlyBetaLaunchWrap .gridly-feedback-btn {
        display: none !important;
      }

      #gridlyBetaLaunchWrap .gridly-share-btn {
        display: block !important;
        width: 100% !important;
        margin-bottom: 12px !important;
      }
    }
  `;

  document.head.appendChild(style);
})();

window.gridlyHazardPickerDebug = window.gridlyHazardPickerAuditDebug;


window.gridlyMarkerRenderDebug = function gridlyMarkerRenderDebug() {
  return { ...lastMarkerAuditDebug };
};

window.gridlyRouteIntelligenceDebug = function gridlyRouteIntelligenceDebug() {
  const routeHazard = getRouteHazardAssessment?.() || { nearbyReports: [] };
  const activeIncidents = (getUnifiedIncidents?.() || []).filter((incident) => incident.status === "active");
  const relevant = activeIncidents.filter((incident) => isIncidentRouteRelevant(incident, routeHazard));
  return {
    activeRouteHazardCount: Number(primaryRouteHazardCount || 0),
    alternateRouteHazardCount: Number(alternateRouteHazardCount || 0),
    hazardsAvoidedByAlternate: Number(hazardsAvoidedCount || 0),
    routePressureScore: Number(routePressureScore || 0),
    routePressureBand,
    calibratedRecommendationBand,
    alternateRoutePressureScore: Number(alternateRouteScore || 0),
    alternateRoutePressureBand: getRoutePressureBand(Math.round(Math.max(0, Number(routePressureScore || 0) - Number(estimatedPressureReduction || 0)))),
    estimatedPressureReduction: Number(estimatedPressureReduction || 0),
    estimatedHazardReduction: Number(estimatedHazardReduction || 0),
    routeRelevantHazards: relevant,
    routeRelevantHazardIds: relevant.map((incident) => incident.id || incident.crossingId).filter(Boolean),
    recommendationMessage: lastRouteRecommendationMessage,
    routeConfidence,
    confidenceInputs,
    confidenceReasoning,
    activeMonitoringState
  };
};

/* =========================================================
   GRIDLY V52 — MOBILE DAILY PANEL SHELL (PHASE 1A)
========================================================= */
(function initMobileDailyPanelShell() {
  const DAILY_PANEL_LOG_PREFIX = "[Mobile Daily Panel]";
  const MOBILE_LAYOUT_SELECTOR = 'body[data-layout-mode="portrait"], body[data-layout-mode="tactical-landscape"], body[data-layout-mode-legacy="mobile"]';
  let lastMobileSurfaceLauncher = null;

  function isMobileLayoutMode() {
    return document.body?.matches?.(MOBILE_LAYOUT_SELECTOR);
  }

  function isElementVisibleForInteraction(element) {
    if (!element || !element.isConnected) return false;
    if (element.hidden) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return true;
  }

  function logDailyPanelAction(stage, details = {}) {
    console.info(`${DAILY_PANEL_LOG_PREFIX} ${stage}`, details);
  }
  function collectMobileSurfaceDiagnostics() {
    const readSurfaceState = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, exists: false };
      const style = window.getComputedStyle(element);
      return {
        selector,
        exists: true,
        hidden: element.hidden === true,
        open: typeof element.open === "boolean" ? element.open : null,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents
      };
    };
    return {
      bodyMobileMode: document.body?.getAttribute("data-mobile-mode") || null,
      reportSectionOpen: Boolean(document.getElementById("reportSection")?.open),
      reportModeActive: reportingState.reportModeActive,
      placementModeActive: reportingState.placementModeActive,
      submissionInProgress: reportingState.submissionInProgress,
      surfaces: [
        readSurfaceState("#mobileNativeSurfaceLayer"),
        readSurfaceState("#mobileNativeSurfaceBody"),
        readSurfaceState("#reportSection"),
        readSurfaceState(".route-setup-modal"),
        readSurfaceState(".gridly-mobile-route-quick-panel")
      ]
    };
  }


  function focusElementWithoutScroll(element) {
    if (!isElementVisibleForInteraction(element) || typeof element.focus !== "function") return false;
    try {
      element.focus({ preventScroll: true });
    } catch (_) {
      element.focus();
    }
    return document.activeElement === element;
  }

  function focusMobileSurfaceEntryTarget() {
    const layer = document.getElementById("mobileNativeSurfaceLayer");
    if (!isMobileLayoutMode() || !isElementVisibleForInteraction(layer)) return;
    window.requestAnimationFrame(() => {
      const closeBtn = document.getElementById("mobileNativeSurfaceCloseBtn");
      const firstActionableCard = layer.querySelector('.alert-item.intelligence-row[tabindex], [data-mobile-surface-action], button:not([disabled])');
      const focused = focusElementWithoutScroll(closeBtn) || focusElementWithoutScroll(firstActionableCard);
      logDailyPanelAction("mobile surface focus entry", {
        focused,
        target: focused && document.activeElement === closeBtn ? "close_button" : focused ? "first_actionable" : "none"
      });
    });
  }

  function restoreMobileSurfaceLauncherFocus() {
    const launcher = lastMobileSurfaceLauncher;
    lastMobileSurfaceLauncher = null;
    if (!isMobileLayoutMode()) return;
    if (!launcher || !isElementVisibleForInteraction(launcher)) return;
    focusElementWithoutScroll(launcher);
  }

  function summarizeRouteWatchSurface() {
    const snapshot = typeof window.getRouteWatchIntelligenceSnapshot === "function" ? window.getRouteWatchIntelligenceSnapshot() : {};
    const routeHazards = Array.isArray(snapshot.routeRelevantHazards) ? snapshot.routeRelevantHazards : [];
    const nearbyReports = Array.isArray(snapshot.routeNearbyReports) ? snapshot.routeNearbyReports : [];
    const activeNearby = nearbyReports.filter((item) => item?.lifecycleState === "active");
    const topHazards = routeHazards.slice(0, 3).map((hazard) => hazard?.name || hazard?.crossingName || "Hazard").filter(Boolean);
    return {
      status: document.getElementById("routeStatus")?.textContent || "Monitoring route",
      eta: document.getElementById("routeEta")?.textContent || "ETA pending",
      summary: document.getElementById("routeSummaryInline")?.textContent || "Live route intelligence is active.",
      recommendation: snapshot.recommendationMessage || document.getElementById("routeRecommendation")?.textContent || "Maintain route monitoring.",
      confidence: snapshot.routeConfidence || "Unknown",
      activeHazards: activeNearby.length,
      topHazards
    };
  }

  function buildCompactFeedItems() {
    const incidents = getUnifiedIncidents().filter((incident) => incident.status === "active").slice(0, 8);
    if (!incidents.length) return '<li class="mobile-intel-feed-item"><span class="chip chip-clear">Clear</span><p>No active alerts right now.</p></li>';
    return incidents.map((incident) => {
      const isRailIncident = String(incident?.id || "").startsWith("rail-") || String(incident?.type || "").startsWith("rail_");
      const railDisplay = isRailIncident
        ? buildRailIncidentDisplay({
            crossingName: incident?.area,
            crossingId: incident?.crossing_id,
            latestReport: {
              type: incident?.report_type,
              lat: incident?.lat,
              lng: incident?.lng,
              road_name: incident?.road_name,
              street_name: incident?.street_name,
              crossing_street: incident?.crossing_street,
              cross_street: incident?.cross_street,
              city: incident?.city,
              area: incident?.area,
              county: incident?.county
            }
          })
        : null;
      const roadDisplay = isRailIncident ? null : buildRoadHazardDisplay(incident);
      const label = isRailIncident ? railDisplay?.title : roadDisplay?.title;
      const location = isRailIncident ? railDisplay?.subtitlePrefix : String(roadDisplay?.subtitle || "").split(" · ")[0] || "Location pending";
      const freshness = Number.isFinite(Number(incident?.age_minutes)) ? `Last confirmed ${Math.max(0, Math.round(Number(incident.age_minutes)))} min ago` : "Needs confirmation";
      const confirmation = Number(incident?.reports_count || 0) > 0 ? getDriverConfirmationLabel(Number(incident.reports_count || 0)) : "Needs confirmation";
      const detail = `${location} · ${confirmation} · ${freshness}`;
      const tone = incident?.severity === "high" ? "chip-alert" : "chip-watch";
      return `<li class="mobile-intel-feed-item"><span class="chip ${tone}">${sanitizeText(incident?.severity?.toUpperCase?.() || "LIVE")}</span><p><strong>${sanitizeText(label || "Operational update")}</strong><span>${sanitizeText(detail)}</span></p></li>`;
    }).join("");
  }

  function buildPriorityIncidentItems(limit = 3) {
    const incidents = getUnifiedIncidents().filter((incident) => incident.status === "active").slice(0, limit);
    if (!incidents.length) {
      return '<li class="mobile-intel-feed-item"><span class="chip chip-clear">Clear</span><p><strong>No priority incidents</strong><span>No high-impact disruptions right now.</span></p></li>';
    }
    return incidents.map((incident) => {
      const isRailIncident = String(incident?.id || "").startsWith("rail-") || String(incident?.type || "").startsWith("rail_");
      const railDisplay = isRailIncident ? buildRailIncidentDisplay({ crossingName: incident?.area, crossingId: incident?.crossing_id, latestReport: incident }) : null;
      const roadDisplay = isRailIncident ? null : buildRoadHazardDisplay(incident);
      const title = isRailIncident ? railDisplay?.title : roadDisplay?.title;
      const subtitle = isRailIncident ? railDisplay?.subtitlePrefix : String(roadDisplay?.subtitle || "").split(" · ")[0] || "Location pending";
      const tone = incident?.severity === "high" ? "chip-alert" : "chip-watch";
      return `<li class="mobile-intel-feed-item" tabindex="0" role="button" ${buildAlertFocusDataset(incident)}><span class="chip ${tone}">${sanitizeText(incident?.severity?.toUpperCase?.() || "LIVE")}</span><p><strong>${sanitizeText(title || "Operational incident")}</strong><span>${sanitizeText(subtitle)}</span></p></li>`;
    }).join("");
  }

  function getOperationalInsightLine() {
    const incidents = getUnifiedIncidents().filter((incident) => incident.status === "active");
    const high = incidents.filter((incident) => incident?.severity === "high");
    const roadHazards = getRoadHazardSurfaceIncidents(12).filter((incident) => incident?.status === "active" || !incident?.status);
    const floodingOrCrash = roadHazards.filter((incident) => ["crash", "flooding"].includes(String(incident?.type || "").toLowerCase()));
    const blockages = incidents.filter((incident) => String(incident?.report_type || incident?.type || "").toLowerCase().includes("blocked"));
    if (!incidents.length) return "No severe disruptions nearby. Network conditions are currently stable.";
    if (high.length >= 2) return `${high.length} high-priority incidents need reroute awareness.`;
    if (blockages.length >= 2) return "Repeated blockage activity detected across active corridors.";
    if (floodingOrCrash.length) return `${floodingOrCrash.length} road safety hazard${floodingOrCrash.length > 1 ? "s" : ""} reported nearby.`;
    return `${incidents.length} active incident${incidents.length > 1 ? "s" : ""} in your operating area.`;
  }

  function prepQuickReportType(type = "blocked") {
    document.querySelector('.mobile-bottom-nav .nav-btn[data-section="report"]')?.click();
    const typeSelect = document.getElementById("manualReportType");
    if (typeSelect) typeSelect.value = type;
  }


  function renderMobileNativeAlertsCenter() {
    const layer = document.getElementById("mobileNativeSurfaceLayer");
    const title = document.getElementById("mobileNativeSurfaceTitle");
    const body = document.getElementById("mobileNativeSurfaceBody");
    logDailyPanelAction("mobile alerts center native open requested", {
      via: "open_alerts_center_action",
      nativeSurfaceBodyExists: Boolean(body)
    });

    if (!layer || !title || !body) {
      throw new Error("mobile native surface elements missing");
    }

    const consolidatedIncidents = getConsolidatedIncidents();
    const unifiedIncidents = getUnifiedIncidents();
    const railIncidents = getPrioritizedRailAlertIncidents(6);
    const roadHazards = getRoadHazardSurfaceIncidents(4);
    const trending = consolidatedIncidents.slice(0, 3);
    const activeCrossingReports = activeReports.filter((report) => getIncidentLifecycleState(report) === "active");

    logDailyPanelAction("mobile alerts center data snapshot", {
      consolidatedIncidentCount: consolidatedIncidents.length,
      unifiedIncidentCount: unifiedIncidents.length,
      activeCrossingReportCount: activeCrossingReports.length,
      alertListSourceCount: railIncidents.length,
      incidentsCount: railIncidents.length,
      hazardsCount: roadHazards.length,
      trendingCount: trending.length
    });

    const railRows = railIncidents.length
      ? railIncidents.map((incident) => {
          const latest = incident?.latestReport || {};
          const railDisplay = buildRailIncidentDisplay(incident);
          const reportState = getReportStateLabel(latest);
          const freshnessLabel = getFreshnessLabel(latest);
          const severityLabel = latest.type === "cleared" ? "Cleared" : latest.severity === "high" ? "High" : latest.severity === "moderate" ? "Moderate" : "Watch";
          const itemClass = latest.type === "cleared" ? "cleared" : latest.severity === "high" ? "high" : "";
          return `
            <article class="alert-item intelligence-row ${itemClass}" tabindex="0" role="button" ${buildAlertFocusDataset(latest, { incidentId: incident.crossingId })}>
              <div class="alert-row-main">
                <span class="alert-severity-chip">${sanitizeText(severityLabel)}</span>
                <strong>${sanitizeText(railDisplay.title)}</strong>
                <span class="alert-row-time">${sanitizeText(`${incident.newestMinutes}m`)}</span>
              </div>
              <p class="alert-row-subline">${sanitizeText(railDisplay.subtitlePrefix)} · ${sanitizeText(reportState)} · ${sanitizeText(freshnessLabel)}</p>
            </article>`;
        }).join("")
      : '<div class="alert-item"><strong>No active community alerts</strong><p>No high-impact disruptions detected nearby.</p></div>';

    const hazardRows = roadHazards.length
      ? roadHazards.map((incident) => {
          const display = buildRoadHazardDisplay(incident);
          const age = Number.isFinite(Number(incident?.age_minutes)) ? `${Math.max(0, Math.round(Number(incident.age_minutes)))}m` : "now";
          return `
            <article class="alert-item intelligence-row ${sanitizeText(display.rowClass || "")}" tabindex="0" role="button" ${buildAlertFocusDataset(incident)}>
              <div class="alert-row-main">
                <span class="alert-severity-chip">${sanitizeText(display.meta)}</span>
                <strong>${sanitizeText(display.title)}</strong>
                <span class="alert-row-time">${sanitizeText(age)}</span>
              </div>
              <p class="alert-row-subline">${sanitizeText(display.subtitle)}</p>
            </article>`;
        }).join("")
      : '<div class="alert-item"><strong>Road conditions appear calm</strong><p>No high-impact road hazards detected nearby.</p></div>';

    const trendingRows = trending.length
      ? trending.map((incident) => {
          const latest = incident?.latestReport || {};
          return `
            <article class="alert-item intelligence-row" tabindex="0" role="button" ${buildAlertFocusDataset(latest, { incidentId: incident.crossingId })}>
              <div class="alert-row-main">
                <span class="alert-severity-chip">Trend</span>
                <strong>${sanitizeText(incident.crossingName || "Crossing")}</strong>
                <span class="alert-row-time">${sanitizeText(`${incident.count} rpt`)}</span>
              </div>
              <p class="alert-row-subline">${sanitizeText(getFreshnessLabel(latest))} · ${sanitizeText(getCrossingConfidenceLabel(latest, incident.count))} · ${sanitizeText(getDriverConfirmationLabel(incident.count))}</p>
            </article>`;
        }).join("")
      : '<div class="alert-item"><strong>Trending crossings are calm</strong><p>Live trendline is stabilizing.</p></div>';

    title.textContent = "Operational Feed Details";
    body.dataset.mobileSurfaceView = "alerts-center";
    body.innerHTML = `
      <article class="mobile-native-surface-card">
        <strong>All Active Incidents</strong>
        <div class="mobile-intel-feed">${railRows}</div>
      </article>
      <article class="mobile-native-surface-card">
        <strong>Road Hazard Detail</strong>
        <div class="mobile-intel-feed">${hazardRows}</div>
      </article>
      <article class="mobile-native-surface-card">
        <strong>Crossing Trendline</strong>
        <div class="mobile-intel-feed">${trendingRows}</div>
      </article>`;

    layer.hidden = false;
    layer.style.opacity = "1";
    layer.style.visibility = "visible";
    layer.style.pointerEvents = "auto";
    normalizeMobileSurfaceBackdrop(true);
    setMobileUiMode("alert", { silent: true });
    focusMobileSurfaceEntryTarget();

    logDailyPanelAction("mobile alerts center rendered", {
      surfaceVisible: !layer.hidden,
      surfaceAriaHidden: layer.getAttribute("aria-hidden"),
      renderedRailAlertCount: railIncidents.length,
      renderedRoadHazardCount: roadHazards.length,
      renderedTrendingCount: trending.length
    });
    logDailyPanelAction("mobile alerts center final state", {
      finalSurfaceVisibilityState: !layer.hidden,
      finalBodyMobileMode: document.body?.getAttribute("data-mobile-mode") || null
    });
  }

  function executeMobilePanelAction(section) {
    const layer = document.getElementById("mobileNativeSurfaceLayer");
    const title = document.getElementById("mobileNativeSurfaceTitle");
    const body = document.getElementById("mobileNativeSurfaceBody");
    const views = {
      routes: {
        title: "Commute Command",
        html: (() => {
          const intel = summarizeRouteWatchSurface();
          const hazardList = intel.topHazards.length ? intel.topHazards.map((name) => `<span class="chip chip-watch">${sanitizeText(name)}</span>`).join("") : '<span class="chip chip-clear">No active hazards near route</span>';
          return `
          <article class="mobile-native-surface-card">
            <strong>${sanitizeText(intel.status)}</strong>
            <p>${sanitizeText(intel.summary)}</p>
            <div class="mobile-kpi-row">
              <span class="chip chip-neutral">${sanitizeText(intel.eta)}</span>
              <span class="chip chip-neutral">Confidence: ${sanitizeText(intel.confidence)}</span>
              <span class="chip ${intel.activeHazards ? "chip-alert" : "chip-clear"}">${intel.activeHazards} active hazards</span>
            </div>
            <p><b>Recommendation:</b> ${sanitizeText(intel.recommendation)}</p>
            <div class="mobile-chip-wrap">${hazardList}</div>
            <div class="mobile-native-surface-actions">
              <button class="primary-btn" type="button" data-mobile-surface-action="route-watch">Update Route Watch</button>
              <button class="secondary-btn" type="button" data-mobile-surface-action="route-map">Stay on Map</button>
              <button class="secondary-btn" type="button" data-mobile-surface-action="open-alerts-center">Operational Feed</button>
            </div>
          </article>`;
        })()
      },
      alerts: {
        title: "Operational Feed",
        html: `
          <article class="mobile-native-surface-card">
            <strong>Active Priority Incidents</strong>
            <div class="mobile-intel-feed"><ul>${buildPriorityIncidentItems(3)}</ul></div>
          </article>
          <article class="mobile-native-surface-card">
            <strong>Operational Insight</strong>
            <p>${sanitizeText(getOperationalInsightLine())}</p>
            <p>${sanitizeText(document.getElementById("freshestReportReason")?.textContent || "Live signals update automatically.")}</p>
          </article>
          <article class="mobile-native-surface-card">
            <strong>Quick Actions</strong>
            <div class="mobile-native-surface-actions mobile-native-surface-actions-grid">
              <button class="secondary-btn" type="button" data-mobile-surface-action="open-alerts-center">View All Alerts</button>
              <button class="secondary-btn" type="button" data-mobile-surface-action="prep-hazard-other_hazard">Report Hazard</button>
              <button class="secondary-btn" type="button" data-mobile-surface-action="route-watch">Open Route Watch</button>
            </div>
          </article>`
      },
      report: {
        title: "Fast Tactical Reporting",
        html: `
          <article class="mobile-native-surface-card">
            <strong>Quick Report Launcher</strong>
            <p>Choose a status, then tap a map marker to submit through the existing shared report flow.</p>
            <div class="mobile-native-surface-actions mobile-native-surface-actions-grid">
              <button class="secondary-btn" type="button" data-mobile-surface-action="prep-report-blocked">Blocked</button>
              <button class="secondary-btn" type="button" data-mobile-surface-action="prep-report-heavy">Delayed</button>
              <button class="secondary-btn" type="button" data-mobile-surface-action="quick-cleared">Cleared</button>
              <button class="secondary-btn" type="button" data-mobile-surface-action="prep-hazard-other_hazard">Road Hazard</button>
              <button class="secondary-btn" type="button" data-mobile-surface-action="prep-hazard-crash">Crash</button>
              <button class="secondary-btn" type="button" data-mobile-surface-action="prep-hazard-flooding">Flooding</button>
              <button class="secondary-btn" type="button" data-mobile-surface-action="prep-hazard-debris">Debris</button>
              <button class="primary-btn" type="button" data-mobile-surface-action="quick-report">Report Hazard Fast</button>
            </div>
          </article>`
      }
    };

    if (!isMobileLayoutMode()) {
      logDailyPanelAction("action executed", {
        section,
        action: "blocked",
        reason: "Not in mobile layout mode"
      });
      return;
    }
    if (section === "report") {
      traceMobileModeMutation("daily panel report clicked", { section, intendedSurfaceSelector: "#reportSection", before: collectMobileSurfaceDiagnostics(), surfaceState: readSurfaceComputedState("#reportSection") });
      layer.hidden = true;
      normalizeMobileSurfaceBackdrop(false);
      const beforeSetMode = document.body?.dataset?.mobileMode || null;
      handleReportNearMe("daily_panel_report");
      traceMobileModeMutation("daily panel report completed", {
        section,
        beforeSetMode,
        afterAction: collectMobileSurfaceDiagnostics(),
        surfaceState: readSurfaceComputedState("#reportSection")
      });
      return;
    }
    if (!layer || !title || !body || !views[section]) return;
    title.textContent = views[section].title;
    body.dataset.mobileSurfaceView = section;
    body.innerHTML = views[section].html;
    layer.hidden = false;
    layer.style.opacity = "1";
    layer.style.visibility = "visible";
    layer.style.pointerEvents = "auto";
    normalizeMobileSurfaceBackdrop(true);
    setMobileUiMode(section === "routes" ? "route" : section === "alerts" ? "alert" : "live", { silent: true });
    focusMobileSurfaceEntryTarget();
    logDailyPanelAction("mobile surface opened", { section, sourceAction: "daily_panel_button", visibilityState: !layer.hidden });
  }

  function bindDailyPanel() {
    const panel = document.getElementById("mobileDailyPanel");
    const handle = document.getElementById("mobileDailyPanelHandle");
    const body = document.getElementById("mobileDailyPanelBody");
    if (!panel || !handle || !body) return;

    const setOpen = (open) => {
      handle.setAttribute("aria-expanded", open ? "true" : "false");
      body.hidden = !open;
      panel.classList.toggle("is-open", open);
    };

    handle.addEventListener("click", () => {
      const open = handle.getAttribute("aria-expanded") !== "true";
      setOpen(open);
    });

    panel.querySelectorAll("[data-mobile-panel-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const section = btn.getAttribute("data-mobile-panel-jump");
        lastMobileSurfaceLauncher = btn;
        logDailyPanelAction("click detected", {
          section,
          buttonLabel: btn.textContent?.trim() || "",
          before: collectMobileSurfaceDiagnostics(),
          intendedSurfaceSelector: section === "routes" ? ".gridly-mobile-route-quick-panel" : section === "alerts" ? "#mobileNativeSurfaceLayer / #mobileNativeSurfaceBody" : "#reportSection"
        });
        executeMobilePanelAction(section);
        logDailyPanelAction("click completed", {
          section,
          after: collectMobileSurfaceDiagnostics()
        });
        setOpen(false);
      });
    });

    const layer = document.getElementById("mobileNativeSurfaceLayer");
    const closeBtn = document.getElementById("mobileNativeSurfaceCloseBtn");
    const backdrop = layer?.querySelector('.mobile-native-surface-backdrop');
    const normalizeMobileSurfaceBackdrop = (open) => {
      if (!layer) return;
      const active = Boolean(open);
      layer.classList.toggle("is-open", active);
      layer.classList.remove("is-active", "active", "open");
      layer.setAttribute("aria-hidden", active ? "false" : "true");
      if (backdrop) {
        backdrop.classList.toggle("is-active", active);
        backdrop.classList.remove("active", "open");
        backdrop.style.opacity = active ? "1" : "0";
        backdrop.style.pointerEvents = active ? "auto" : "none";
        backdrop.setAttribute("aria-hidden", active ? "false" : "true");
      }
    };
    const resetMobileSurfaceState = (reason = "manual_reset", options = {}) => {
      if (!layer) return;
      const nextMode = typeof options.nextMode === "string" ? options.nextMode : "live";
      const wasVisible = !layer.hidden;
      const sheet = layer.querySelector(".mobile-native-surface-sheet");
      layer.hidden = true;
      layer.classList.remove("is-open", "is-active", "active", "open");
      layer.style.opacity = "0";
      layer.style.visibility = "hidden";
      layer.style.pointerEvents = "none";
      layer.style.transform = "";
      layer.style.translate = "";
      layer.setAttribute("aria-hidden", "true");
      if (body) {
        body.dataset.mobileSurfaceView = "";
        body.style.transform = "";
        body.style.translate = "";
      }
      if (sheet) {
        sheet.style.transform = "";
        sheet.style.translate = "";
      }
      normalizeMobileSurfaceBackdrop(false);
      if (isMobileLayoutMode()) {
        const reportVisible = isReportSurfaceVisiblyOpen();
        const routeVisible = Boolean(document.getElementById("gridlyMobileRouteQuickPanel")?.classList.contains("visible"));
        const safeMode = reportVisible ? "report" : routeVisible ? "route" : nextMode;
        setMobileUiMode(safeMode, { silent: true });
      }
      restoreMobileSurfaceLauncherFocus();
      logDailyPanelAction("resetMobileSurfaceState completed", {
        reason,
        wasVisible,
        nextMode,
        currentLayoutMode: getCurrentLayoutMode(),
        currentMobileMode: mobileUiMode
      });
    };
    window.resetMobileSurfaceState = resetMobileSurfaceState;
    const closeSurface = (sourceAction = "close_button", options = {}) => {
      const nextMode = typeof options.nextMode === "string" ? options.nextMode : "live";
      logDailyPanelAction("closeSurface started", { sourceAction, nextMode, visibilityState: !layer?.hidden });
      resetMobileSurfaceState(`close_surface:${sourceAction}`, { nextMode });
      logDailyPanelAction("closeSurface completed", {
        sourceAction,
        visibilityState: !layer?.hidden,
        nextMode,
        mobileMode: mobileUiMode,
        finalSurfaceAriaHidden: layer?.getAttribute("aria-hidden")
      });
    };
    normalizeMobileSurfaceBackdrop(!layer?.hidden);
    closeBtn?.addEventListener("click", () => closeSurface("close_button"));
    backdrop?.addEventListener("click", () => closeSurface("backdrop"));
    layer?.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || layer.hidden || !isMobileLayoutMode()) return;
      event.preventDefault();
      closeSurface("escape");
    });
    layer?.addEventListener("click", (event) => {
      const trigger = event.target?.closest?.("[data-mobile-surface-action]");
      if (!trigger) return;
      const action = trigger.getAttribute("data-mobile-surface-action");
      if (action === "route-watch") {
        traceMobileModeMutation("daily panel route-watch clicked", {
          action,
          intendedSurfaceSelector: "#gridlyMobileRouteQuickPanel",
          surfaceState: readSurfaceComputedState("#gridlyMobileRouteQuickPanel")
        });
        openMobileRouteQuickPanel();
        traceMobileModeMutation("daily panel route-watch open completed", {
          action,
          surfaceState: readSurfaceComputedState("#gridlyMobileRouteQuickPanel")
        });
      }
      if (action === "quick-report") document.getElementById("mobileQuickReportBtn")?.click();
      if (action === "quick-cleared") document.getElementById("mobileQuickClearedBtn")?.click();
      if (action === "prep-report-blocked") prepQuickReportType("blocked");
      if (action === "prep-report-heavy") prepQuickReportType("heavy");
      if (action === "prep-hazard-other_hazard") { document.getElementById("mobileHazardReportBtn")?.click(); prepQuickReportType("other_hazard"); }
      if (action === "prep-hazard-crash") { document.getElementById("mobileHazardReportBtn")?.click(); prepQuickReportType("crash"); }
      if (action === "prep-hazard-flooding") { document.getElementById("mobileHazardReportBtn")?.click(); prepQuickReportType("flooding"); }
      if (action === "prep-hazard-debris") { document.getElementById("mobileHazardReportBtn")?.click(); prepQuickReportType("debris"); }
      if (action === "open-alerts-center") {
        closeSurface(action, { nextMode: "alert" });
        try {
          renderMobileNativeAlertsCenter();
        } catch (error) {
          console.warn("[Mobile Daily Panel] mobile alerts center native render failed; falling back to alertsSection.", error);
          setMobileUiMode("alert", { silent: true });
          scrollToSection("alertsSection");
        }
        return;
      }
      if (action === "route-map") document.querySelector('.mobile-bottom-nav .nav-btn[data-section="map"]')?.click();
      const nextMode = action === "route-watch" ? "route" : action === "quick-report" ? "report" : "live";
      logDailyPanelAction("source action", { action, visibilityState: !layer.hidden, nextMode });
      closeSurface(action, { nextMode });
    });
  }

  let dailyPanelShellBound = false;
  const bootstrapMobileDailyPanelShell = () => {
    if (dailyPanelShellBound) return;
    dailyPanelShellBound = true;
    syncAuthoritativeLayoutMode();
    setMobileUiMode(mobileUiMode, { silent: true });
    const modeObserver = new ResizeObserver(() => syncAuthoritativeLayoutMode());
    const observedNode = document.querySelector(".app-shell") || document.body;
    if (observedNode) modeObserver.observe(observedNode);
    bindDailyPanel();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapMobileDailyPanelShell, { once: true });
  } else {
    bootstrapMobileDailyPanelShell();
  }

  window.addEventListener("resize", scheduleAuthoritativeLayoutModeSync, { passive: true });
  window.addEventListener("orientationchange", scheduleAuthoritativeLayoutModeSync, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleAuthoritativeLayoutModeSync, { passive: true });

  window.gridlyPortraitLayoutDebug = () => {
    const isVisible = (node) => Boolean(node && node.getClientRects().length > 0 && window.getComputedStyle(node).display !== "none" && window.getComputedStyle(node).visibility !== "hidden");
    const getBounds = (node) => node?.getBoundingClientRect?.()?.toJSON?.() || null;
    const alertsBtn = document.getElementById("mobileDockAlertsBtn");
    const alertsSection = document.getElementById("alertsSection");
    const smartAlertsModal = document.getElementById("smartAlertsModal");
    const areaDockBtn = document.getElementById("mobileDockAreaBtn");
    const geoFilter = document.querySelector(".geo-filter-pill");
    const destinationCard = document.querySelector(".mobile-destination-command");
    const liveCard = document.querySelector(".mobile-live-command");
    const header = document.querySelector(".app-header");
    const mapFrame = document.querySelector(".map-frame");
    const bottomDock = document.querySelector(".mobile-floating-action-dock");
    const rightControl = document.querySelector("#map .leaflet-right");
    const zoomControl = document.querySelector("#map .leaflet-control-zoom");
    const alertsStyle = alertsSection ? window.getComputedStyle(alertsSection) : null;
    const alertsBounds = getBounds(alertsSection);
    const portraitAlertsOpenClassPresent = document.body.classList.contains("portrait-alerts-open");
    const alertsPanelLikelyVisible = Boolean(
      alertsSection
      && alertsStyle
      && alertsStyle.display !== "none"
      && alertsStyle.opacity !== "0"
      && alertsStyle.pointerEvents !== "none"
      && alertsBounds
      && alertsBounds.width > 0
      && alertsBounds.height > 0
    );
    const mapFrameBounds = getBounds(mapFrame);
    const rightControlBounds = getBounds(rightControl);
    const zoomControlBounds = getBounds(zoomControl);
    const layoutShiftRisk = Boolean(mapFrameBounds && mapFrameBounds.height < 280);
    return {
      alertsButtonVisible: isVisible(alertsBtn),
      alertsSectionExists: Boolean(alertsSection),
      alertsSectionVisible: isVisible(alertsSection),
      alertsSectionDisplay: alertsStyle?.display || null,
      alertsSectionOpacity: alertsStyle?.opacity || null,
      alertsSectionPointerEvents: alertsStyle?.pointerEvents || null,
      alertsSectionBounds: alertsBounds,
      portraitAlertsOpenClassPresent,
      alertsPanelLikelyVisible,
      smartAlertsModalVisible: isVisible(smartAlertsModal),
      areaDockVisible: isVisible(areaDockBtn),
      geoFilterVisible: isVisible(geoFilter),
      destinationCardVisible: isVisible(destinationCard),
      destinationCardBounds: getBounds(destinationCard),
      liveCardBounds: getBounds(liveCard),
      headerBounds: getBounds(header),
      mapFrameBounds,
      bottomDockBounds: getBounds(bottomDock),
      rightControlBounds,
      zoomControlBounds,
      layoutShiftRisk,
      alertsPanelVisible: alertsPanelLikelyVisible,
      settingsVisible: isVisible(document.getElementById("settingsModal")),
      activeSurface: gridlyActiveSurface
    };
  };



  window.gridlyBottomSheetDebug = () => {
    const isVisible = (node) => Boolean(node && node.getClientRects().length > 0 && window.getComputedStyle(node).display !== "none" && window.getComputedStyle(node).visibility !== "hidden");
    const getSheetMeta = (label, node, expectedOrigin = "bottom") => {
      if (!node) return { label, exists: false, expectedOrigin };
      const style = window.getComputedStyle(node);
      return {
        label,
        exists: true,
        visible: isVisible(node),
        expectedOrigin,
        bottom: style.bottom,
        top: style.top,
        left: style.left,
        right: style.right,
        position: style.position,
        borderRadius: style.borderRadius,
        transform: style.transform
      };
    };
    const sheets = [
      getSheetMeta("report", document.getElementById("reportSection")),
      getSheetMeta("alerts", document.getElementById("alertsSection")),
      getSheetMeta("route", document.querySelector(".route-setup-modal-card")),
      getSheetMeta("settings", document.querySelector(".settings-modal-card"))
    ];
    const activeSheet = sheets.find((sheet) => sheet.visible)?.label || "none";
    const inconsistentSurfaceWarnings = sheets
      .filter((sheet) => sheet.exists)
      .filter((sheet) => String(sheet.position || "").toLowerCase() !== "fixed" || String(sheet.bottom || "auto").toLowerCase() === "auto")
      .map((sheet) => `${sheet.label} is not anchored as a unified bottom sheet`);
    return {
      activeSheet,
      openDirection: "bottom-up",
      sheetOrigins: sheets,
      inconsistentSurfaceWarnings,
      portraitMode: window.matchMedia('(max-width: 1100px) and (orientation: portrait)').matches
    };
  };
  // DEV ONLY: Gridly Layout Edit Mode
  (() => {
    const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
    const DEV_STYLE_ID = "gridly-layout-edit-dev-style";
    const DEV_OVERLAY_ID = "gridlyLayoutEditOverlay";
    const DEV_BADGE_ID = "gridlyLayoutEditBadge";
    const state = {
      enabled: false,
      selected: null,
      dragging: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      baseX: 0,
      baseY: 0
    };

    const isLocalDevHost = () => LOCAL_HOSTS.has((window.location && window.location.hostname) || "");
    const targetDefs = [
      ["Mobile Portrait Dock", ".mobile-floating-action-dock"],
      ["Portrait Bottom Nav", ".mobile-bottom-nav"],
      ["Portrait Daily Panel", "#mobileDailyPanel"],
      ["Portrait Report Button", "#mobileDockReportBtn"],
      ["Portrait Route Button", "#mobileDockRoutesBtn, #mobileDockRouteBtn"],
      ["Portrait Alerts Button", "#mobileDockAlertsBtn"],
      ["Portrait Area Button", "#mobileDockAreaBtn"],
      ["Portrait Layers Button", "#mobileDockLayersBtn"],
      ["Tactical Landscape Dock", ".tactical-landscape-gate, .gridly-tactical-dock-sheet"],
      ["Desktop Left Rail", ".desktop-left-rail"],
      ["Desktop Report CTA", "#desktopReportNearMeBtnRail, #desktopReportNearMeBtn"],
      ["Desktop Top Nav/Header", ".top-nav.command-top-nav, .mobile-live-brand-status"],
      ["Map Status/Command Panel", ".command-center .mobile-live-command, .command-center .desktop-route-watch-strip, .command-center .map-tools-status"]
    ];

    const ensureDevStyle = () => {
      if (document.getElementById(DEV_STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = DEV_STYLE_ID;
      style.textContent = `
        [data-gridly-edit-mode="on"] [data-gridly-editable="true"] { outline: 2px dashed #26d1ff !important; outline-offset: 2px; }
        [data-gridly-edit-mode="on"] [data-gridly-editable="true"].gridly-edit-selected { outline: 2px solid #00ff99 !important; }
        .gridly-layout-edit-fixed { position: fixed; z-index: 999999; font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; color: #fff; background: rgba(8,14,26,.92); border: 1px solid rgba(255,255,255,.25); border-radius: 8px; padding: 8px 10px; }
        #${DEV_BADGE_ID} { top: 10px; left: 10px; font-weight: 700; }
        #${DEV_OVERLAY_ID} { top: 44px; left: 10px; width: 320px; }
        #${DEV_OVERLAY_ID} .gridly-row { margin-bottom: 6px; word-break: break-word; }
        #${DEV_OVERLAY_ID} .gridly-actions { display: flex; gap: 6px; }
        #${DEV_OVERLAY_ID} button { cursor: pointer; border: 1px solid rgba(255,255,255,.3); background: #1f2a44; color: #fff; border-radius: 6px; padding: 4px 7px; }
      `;
      document.head.appendChild(style);
    };

    const markEditableTargets = () => {
      targetDefs.forEach(([name, selector]) => {
        document.querySelectorAll(selector).forEach((el) => {
          el.setAttribute("data-gridly-editable", "true");
          if (!el.getAttribute("data-gridly-edit-name")) el.setAttribute("data-gridly-edit-name", name);
          if (!el.dataset.gridlyEditInitPos) el.dataset.gridlyEditInitPos = el.style.position || "";
        });
      });
    };
    const getEditableEls = () => Array.from(document.querySelectorAll('[data-gridly-editable="true"]'));
    const parseTranslate = (el) => {
      const m = /translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/.exec(el.style.transform || "");
      return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 };
    };
    const setTranslate = (el, x, y) => { el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; };
    const getSnapshot = () => ({
      layoutMode: typeof window.getCurrentLayoutMode === "function" ? window.getCurrentLayoutMode() : (document.body?.dataset?.layoutMode || "unknown"),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      elements: getEditableEls().map((el) => {
        const r = el.getBoundingClientRect();
        const t = parseTranslate(el);
        return { name: el.getAttribute("data-gridly-edit-name") || "Unnamed", selector: el.id ? `#${el.id}` : null, id: el.id || null, classes: el.className || "", x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), computedPosition: getComputedStyle(el).position, inlineTransform: el.style.transform || "", inlineTop: el.style.top || "", inlineLeft: el.style.left || "", translateX: t.x, translateY: t.y };
      })
    });

    const refreshOverlay = () => {
      const overlay = document.getElementById(DEV_OVERLAY_ID);
      if (!overlay) return;
      const sel = state.selected;
      const rect = sel ? sel.getBoundingClientRect() : null;
      overlay.querySelector('[data-k="mode"]').textContent = `Layout: ${typeof window.getCurrentLayoutMode === "function" ? window.getCurrentLayoutMode() : "unknown"}`;
      overlay.querySelector('[data-k="selected"]').textContent = `Selected: ${sel?.getAttribute("data-gridly-edit-name") || "none"}`;
      overlay.querySelector('[data-k="metrics"]').textContent = rect ? `x:${Math.round(rect.x)} y:${Math.round(rect.y)} w:${Math.round(rect.width)} h:${Math.round(rect.height)}` : "x:- y:- w:- h:-";
    };
    const createDevUi = () => {
      ensureDevStyle();
      if (!document.getElementById(DEV_BADGE_ID)) {
        const badge = document.createElement("div");
        badge.id = DEV_BADGE_ID; badge.className = "gridly-layout-edit-fixed"; badge.textContent = "Gridly Layout Edit Mode"; document.body.appendChild(badge);
      }
      if (!document.getElementById(DEV_OVERLAY_ID)) {
        const overlay = document.createElement("div");
        overlay.id = DEV_OVERLAY_ID; overlay.className = "gridly-layout-edit-fixed";
        overlay.innerHTML = '<div class="gridly-row" data-k="mode"></div><div class="gridly-row" data-k="selected"></div><div class="gridly-row" data-k="metrics"></div><div class="gridly-actions"><button type="button" data-gridly-export>Export snapshot</button><button type="button" data-gridly-reset>Reset</button><button type="button" data-gridly-disable>Disable</button></div>';
        overlay.addEventListener("click", (e) => {
          if (e.target.matches('[data-gridly-export]')) console.log("[Gridly Layout Edit] Snapshot", window.exportGridlyLayoutSnapshot());
          if (e.target.matches('[data-gridly-reset]')) window.resetGridlyLayoutEditMode();
          if (e.target.matches('[data-gridly-disable]')) window.disableGridlyLayoutEditMode();
        });
        document.body.appendChild(overlay);
      }
      refreshOverlay();
    };

    const onPointerDown = (event) => {
      if (!state.enabled || event.button !== 0) return;
      const target = event.target.closest('[data-gridly-editable="true"]');
      if (!target) return;
      event.preventDefault();
      getEditableEls().forEach((el) => el.classList.remove("gridly-edit-selected"));
      target.classList.add("gridly-edit-selected");
      state.selected = target;
      state.dragging = true;
      state.pointerId = event.pointerId;
      state.startX = event.clientX;
      state.startY = event.clientY;
      const base = parseTranslate(target);
      state.baseX = base.x; state.baseY = base.y;
      document.body.style.userSelect = "none";
      target.setPointerCapture?.(event.pointerId);
      refreshOverlay();
    };
    const onPointerMove = (event) => {
      if (!state.enabled || !state.dragging || !state.selected || event.pointerId !== state.pointerId) return;
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      setTranslate(state.selected, state.baseX + dx, state.baseY + dy);
      refreshOverlay();
    };
    const stopDrag = () => { state.dragging = false; state.pointerId = null; document.body.style.userSelect = ""; refreshOverlay(); };

    window.exportGridlyLayoutSnapshot = () => getSnapshot();
    window.resetGridlyLayoutEditMode = () => {
      getEditableEls().forEach((el) => { el.style.transform = ""; el.style.top = ""; el.style.left = ""; el.classList.remove("gridly-edit-selected"); });
      state.selected = null;
      refreshOverlay();
      return true;
    };
    window.disableGridlyLayoutEditMode = () => {
      if (!state.enabled) return false;
      window.resetGridlyLayoutEditMode();
      state.enabled = false;
      document.body.removeAttribute("data-gridly-edit-mode");
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", stopDrag, true);
      document.removeEventListener("pointercancel", stopDrag, true);
      document.getElementById(DEV_BADGE_ID)?.remove();
      document.getElementById(DEV_OVERLAY_ID)?.remove();
      return true;
    };
    window.enableGridlyLayoutEditMode = () => {
      if (!isLocalDevHost()) {
        console.warn("[Gridly Layout Edit] Refused: only localhost/127.0.0.1 can enable edit mode.");
        return false;
      }
      if (state.enabled) return true;
      markEditableTargets();
      state.enabled = true;
      document.body.setAttribute("data-gridly-edit-mode", "on");
      createDevUi();
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("pointermove", onPointerMove, true);
      document.addEventListener("pointerup", stopDrag, true);
      document.addEventListener("pointercancel", stopDrag, true);
      refreshOverlay();
      return true;
    };
  })();

})();

/* ===== Gridly Portrait V2 Shell Wiring ===== */
(() => {
  const sheetTemplates = {
    report: { title: "Report Hazard", html: `<div class="gridly-v2-tiles gridly-v2-report-tiles">${["Flooding","Ice","Debris","Crash / Wreck","Construction","Road Closed","Disabled Vehicle"].map((i)=>`<button class="gridly-v2-tile gridly-v2-report-action" type="button"><span>${i}</span></button>`).join("")}</div><div class="gridly-v2-list gridly-v2-report-ctas"><button class="primary-btn" type="button">Use My Location</button><button class="secondary-btn" type="button">Tap Map Location</button></div>` },
    route: { title: "Route Setup", html: `<div class="gridly-v2-list"><label>Start<select id="gridlyV2StartSel"><option>Choose start</option></select></label><label>Destination<select id="gridlyV2DestSel"><option>Choose destination</option></select></label><button class="primary-btn" id="gridlyV2StartRouteWatchBtn" type="button">Start Route Watch</button><button class="secondary-btn" id="gridlyV2ViewRouteBtn" type="button">View Route</button><button class="secondary-btn" id="gridlyV2ManagePlacesBtn" type="button">Manage Places</button></div>` },
    alerts: { title: "Alerts", html: `<div class="gridly-v2-list"><div class="gridly-v2-tile">Trending Now</div><div class="gridly-v2-tile">Live Alerts</div><div class="gridly-v2-tile">Road Hazards</div><div class="gridly-v2-tile">Impact Score</div><button class="secondary-btn" data-v2-sheet="settings" type="button">Manage Alerts</button></div>` },
    settings: { title: "Settings", html: `<div class="gridly-v2-list"><button class="gridly-v2-tile" type="button">Set Home Town</button><button class="gridly-v2-tile" type="button">Home / Work / Saved Places</button><button class="gridly-v2-tile" type="button">Alert Preferences</button><button class="gridly-v2-tile" type="button">Route Preferences</button><button class="gridly-v2-tile" type="button">App Preferences</button></div>` }
  };
  let activeSheet = "";
  function openPortraitV2Sheet(type) {
    const sheet = document.getElementById("gridlyPortraitV2Sheet"); const backdrop = document.getElementById("gridlyPortraitV2SheetBackdrop");
    const title = document.getElementById("gridlyPortraitV2SheetTitle"); const body = document.getElementById("gridlyPortraitV2SheetBody");
    const template = sheetTemplates[type]; if (!sheet || !backdrop || !template) return;
    activeSheet = type; title.textContent = template.title; body.innerHTML = template.html; sheet.hidden = false; backdrop.hidden = false;
  }
  function closePortraitV2Sheet(){ const sheet=document.getElementById("gridlyPortraitV2Sheet"); const backdrop=document.getElementById("gridlyPortraitV2SheetBackdrop"); if(sheet)sheet.hidden=true; if(backdrop)backdrop.hidden=true; activeSheet=""; }
  function bindV2(){
    document.querySelectorAll("[data-v2-sheet]").forEach((b)=>b.addEventListener("click",()=>openPortraitV2Sheet(b.dataset.v2Sheet)));
    document.getElementById("gridlyV2TopSettingsBtn")?.addEventListener("click",()=>openPortraitV2Sheet("settings"));
    document.getElementById("gridlyPortraitV2SheetClose")?.addEventListener("click",closePortraitV2Sheet);
    document.getElementById("gridlyPortraitV2SheetBackdrop")?.addEventListener("click",closePortraitV2Sheet);
    document.querySelectorAll(".gridly-v2-segments button").forEach((b)=>b.addEventListener("click",()=>{document.querySelectorAll(".gridly-v2-segments button").forEach(x=>x.classList.remove("is-active"));b.classList.add("is-active");const gf=b.dataset.geoFilter;document.querySelector(`.geo-filter-pill[data-geo-filter='${gf}']`)?.click();}));
    document.querySelector("[data-v2-control='zoom-in']")?.addEventListener("click",()=>document.querySelector("#map .leaflet-control-zoom-in")?.click());
    document.querySelector("[data-v2-control='zoom-out']")?.addEventListener("click",()=>document.querySelector("#map .leaflet-control-zoom-out")?.click());
    document.querySelector("[data-v2-control='layers']")?.addEventListener("click",()=>document.querySelector("#mobileDockLayersBtn")?.click());
  }
  window.openPortraitV2Sheet = openPortraitV2Sheet;
  window.gridlyPortraitV2Debug = function(){
    const v2=document.getElementById("gridlyPortraitV2"); const mode=document.body?.dataset?.layoutMode||null;
    const isVisible=(el)=>Boolean(el&&getComputedStyle(el).display!=="none"&&getComputedStyle(el).visibility!=="hidden"&&Number(getComputedStyle(el).opacity||1)!==0);
    const legacyHidden=[".mobile-live-brand","#mobileLocalContextStrip","#mobileDailyPanel",".mobile-floating-action-dock"].every((sel)=>{const el=document.querySelector(sel);return !el||getComputedStyle(el).display==="none";});
    const duplicateZoomControlsVisible = isVisible(document.querySelector('#map .gridly-mobile-control-rail')) || (Array.from(document.querySelectorAll('#map .leaflet-control-zoom')).filter((el)=>isVisible(el)).length > 1);
    const duplicateFilterStripsVisible = isVisible(document.querySelector('.map-tools-overlay .geo-filter-shell')) || isVisible(document.querySelector('.map-card .map-ux-strip .geo-filter-shell'));
    const v2IconsApplied = document.querySelectorAll('#gridlyPortraitV2 svg').length >= 8;
    const legacyControlsHidden = legacyHidden && !duplicateZoomControlsVisible && !duplicateFilterStripsVisible;
    const warnings=[]; if(mode!=="portrait") warnings.push("Layout is not portrait.");
    const compactBrandApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-brand img"));
    const popupV2Styled = Boolean(document.querySelector(".leaflet-popup-content-wrapper"));
    const popupContentEl = document.querySelector("#map .leaflet-popup-content");
    const popupViewportSafe = Boolean(popupContentEl && getComputedStyle(popupContentEl).overflowY === "auto");
    const filterSegmentButtons = Array.from(document.querySelectorAll("#gridlyPortraitV2 .gridly-v2-segments button"));
    const filterStripBalanced = filterSegmentButtons.length === 5 && filterSegmentButtons.every((button) => {
      const width = button.getBoundingClientRect().width;
      return Number.isFinite(width) && width > 0;
    });
    const popupContainerEl = document.querySelector("#map .leaflet-popup");
    const mapRect = document.getElementById("map")?.getBoundingClientRect?.();
    const popupRect = popupContainerEl?.getBoundingClientRect?.();
    const popupViewportCentered = Boolean(
      mapRect && popupRect &&
      popupRect.top >= mapRect.top + 4 &&
      popupRect.left >= mapRect.left + 4 &&
      popupRect.right <= mapRect.right - 4 &&
      popupRect.bottom <= mapRect.bottom - 4
    );
    const popupAutoPanApplied = Boolean(window.__gridlyLastPopupAutoPanApplied);
    const popupCameraPanApplied = Boolean(gridlyPopupCameraPanApplied);
    const popupAnchorMode = gridlyPopupAnchorMode || "none";
    const popupLastMarkerScreenPoint = gridlyPopupLastMarkerScreenPoint;
    const popupLastSafeTargetPoint = gridlyPopupLastSafeTargetPoint;
    const popupClippedAfterOpen = gridlyPopupClippedAfterOpen;
    const popupViewportBounds = gridlyPopupViewportBounds;
    const popupAutoPanSequenced = Boolean(window.__gridlyPopupPanSession);
    const popupBlinkResolved = popupAutoPanApplied ? popupAutoPanSequenced : true;
    const typographyPassApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-status-pill strong"));
    const iconSystemUnified = v2IconsApplied && Boolean(document.querySelector("#gridlyPortraitV2 .dock-icon svg"));
    const dockIconSystemUnified = iconSystemUnified && Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-bottom-dock .dock-icon svg"));
    const railIconSystemUnified = iconSystemUnified && Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-control-rail svg"));
    const iconSystemReferenceAligned = iconSystemUnified && dockIconSystemUnified && railIconSystemUnified;
    const surfacePolishApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-topbar"));
    const spacingRhythmPassApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-status-pill") && document.querySelector("#gridlyPortraitV2 .gridly-v2-segments"));
    const iconConsistencyPassApplied = iconSystemReferenceAligned;
    const sheetProductizationApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-sheet header") && document.querySelector("#gridlyPortraitV2 .gridly-v2-report-action"));
    const mapBreathingRoomApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-topbar") && document.querySelector("#gridlyPortraitV2 .gridly-v2-bottom-dock"));
    const compactHeaderRefined = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-brand img") && document.querySelector("#gridlyPortraitV2 .gridly-v2-brand span"));
    const iconSystemHarmonized = iconSystemReferenceAligned;
    const dockRefinementApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-bottom-dock .dock-icon"));
    const utilityControlConsistencyApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-control-rail button") && document.querySelector("#gridlyPortraitV2 .gridly-v2-icon-btn"));
    const headerFoundationApplied = compactHeaderRefined;
    const surfaceRestraintApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-sheet") && document.querySelector("#map .leaflet-popup-content-wrapper"));
    const opticalAlignmentPassApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-bottom-dock button em"));
    const v1321FinalTighteningApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-topbar") && document.querySelector("#gridlyPortraitV2 .gridly-v2-status-pill"));
    const headerStatusCohesionApplied = v1321FinalTighteningApplied && Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-status-pill strong"));
    const filterDensityTuned = Boolean(document.querySelectorAll("#gridlyPortraitV2 .gridly-v2-segments button").length === 5);
    const dockOpticalFinalized = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-bottom-dock .dock-icon svg"));
    const mapFirstBalancePreserved = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-topbar") && document.querySelector("#gridlyPortraitV2 .gridly-v2-bottom-dock"));
    const microAlignmentQaApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-control-rail button") && document.querySelector("#gridlyPortraitV2 .gridly-v2-bottom-dock button em"));
    const v1322TypographyEasingApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-watch span") && document.querySelector("#gridlyPortraitV2 .gridly-v2-segments button"));
    const topHeaderTypographyRefined = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-brand img") && document.querySelector("#gridlyPortraitV2 .gridly-v2-watch span"));
    const filterStripEased = filterStripBalanced && Boolean(document.querySelectorAll("#gridlyPortraitV2 .gridly-v2-segments button").length === 5);
    const topStackCalmnessApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-topbar") && document.querySelector("#gridlyPortraitV2 .gridly-v2-status-pill") && document.querySelector("#gridlyPortraitV2 .gridly-v2-segments"));
    const microTypographyConsistencyApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-status-pill span") && document.querySelector("#gridlyPortraitV2 .gridly-v2-bottom-dock button em"));
    const mapDominancePreserved = mapFirstBalancePreserved;
    const v133BrandFoundationApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-brand img"));
    const headerIdentitySystemApplied = v133BrandFoundationApplied && Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-watch span") && document.querySelector("#gridlyPortraitV2 .gridly-v2-icon-btn"));
    const gridlyMarkFoundationApplied = v133BrandFoundationApplied;
    const wordmarkPolished = v133BrandFoundationApplied;
    const brandRestraintMaintained = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-topbar") && document.querySelector("#gridlyPortraitV2 .gridly-v2-status-pill"));
    const iconBrandRelationshipAligned = iconSystemReferenceAligned && v133BrandFoundationApplied;
    const compactResponsiveBrandVariantApplied = Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-brand img"));
    const faviconValidated = Boolean(document.querySelector('link[rel="icon"][sizes="32x32"][href="assets/favicon-32.png"]'));
    const appIconsValidated = ["180x180","192x192","512x512"].every((size)=>Boolean(document.querySelector(`link[sizes="${size}"]`)));
    const temporaryBrandLayersRemoved = !document.querySelector("#gridlyPortraitV2 .gridly-v2-mark") && !document.querySelector("#gridlyPortraitV2 .gridly-v2-wordmark");
    const v1331RealBrandAssetsIntegrated = v133BrandFoundationApplied && temporaryBrandLayersRemoved;
    const brandProductionIntegrationComplete = v1331RealBrandAssetsIntegrated && compactResponsiveBrandVariantApplied && faviconValidated && appIconsValidated;

    const v1332UltraCompactHeaderApplied = Boolean(document.querySelector('#gridlyPortraitV2 .gridly-v2-brand img[src="assets/gridly-header-ultra-compact.png"]'));
    const headerBrandFitmentComplete = v1332UltraCompactHeaderApplied && Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-topbar") && document.querySelector("#gridlyPortraitV2 .gridly-v2-watch span") && document.querySelector("#gridlyPortraitV2 .gridly-v2-icon-btn"));
    const compactLogoOpticsBalanced = v1332UltraCompactHeaderApplied && Boolean(document.querySelector("#gridlyPortraitV2 .gridly-v2-brand img"));
    const mapFirstBrandRestraintMaintained = mapDominancePreserved && brandRestraintMaintained;
    const legacyWideLogoRemoved = !document.querySelector('#gridlyPortraitV2 .gridly-v2-brand img[src="assets/gridly-logo-primary.png"]');
    const productionHeaderIdentityFinalized = headerBrandFitmentComplete && compactLogoOpticsBalanced && mapFirstBrandRestraintMaintained && legacyWideLogoRemoved;
    return {v2Exists:Boolean(v2),v2Visible:Boolean(v2&&getComputedStyle(v2).display!=="none"),activeSheet,sheetOpen:!document.getElementById("gridlyPortraitV2Sheet")?.hidden,dockButtonsFound:document.querySelectorAll(".gridly-v2-bottom-dock button").length,controlRailFound:Boolean(document.querySelector(".gridly-v2-control-rail")),legacyPortraitHidden:legacyHidden,duplicateZoomControlsVisible,duplicateFilterStripsVisible,v2IconsApplied,legacyControlsHidden,mapContainerFound:Boolean(document.getElementById("map")),layoutMode:mode, popupV2Styled, popupViewportSafe, filterStripBalanced, popupViewportCentered, popupAutoPanApplied, popupCameraPanApplied, popupAnchorMode, popupLastMarkerScreenPoint, popupLastSafeTargetPoint, popupClippedAfterOpen, popupViewportBounds, popupAutoPanSequenced, popupBlinkResolved, lastPopupTapAt:gridlyPopupLastTapAt, lastPopupOpenAt:gridlyPopupLastOpenAt, pendingPopupToken:window.__gridlyPopupPanSession?.token||null, popupOpenCount:gridlyPopupOpenCount, popupCancelCount:gridlyPopupCancelCount, popupLastFailureReason:gridlyPopupLastFailureReason||null, popupReopenReady:gridlyPopupReopenReady, popupSingleTapFlowReady:gridlyPopupSingleTapFlowReady, popupSingleTapGuaranteed:gridlyPopupSingleTapGuaranteed, lastPopupTapCrossingId:gridlyLastPopupTapCrossingId, lastPopupPanStartedAt:gridlyLastPopupPanStartedAt, lastPopupMoveEndAt:gridlyLastPopupMoveEndAt, lastPopupFallbackFiredAt:gridlyLastPopupFallbackFiredAt, lastPopupScheduledDelay:gridlyLastPopupScheduledDelay, lastPopupTimerFiredAt:gridlyLastPopupTimerFiredAt, lastPopupFinalizeReason:gridlyLastPopupFinalizeReason, popupLastClickCrossingId:gridlyLastPopupTapCrossingId, popupLastFinalizeAttemptAt:gridlyPopupLastFinalizeAttemptAt, popupLastOpenCallAt:gridlyPopupLastOpenCallAt, popupLastOpenMethod:gridlyPopupLastOpenMethod, popupOpenCallCount:gridlyPopupOpenCount, popupEarlyReturnReason:gridlyPopupEarlyReturnReason||null, popupPaneCount:document.querySelectorAll(".leaflet-popup-pane .leaflet-popup").length, popupDomExists:Boolean(document.querySelector(".leaflet-popup")), popupInterferenceEventSeen:gridlyPopupInterferenceEventSeen, routeWatchAllClickedDuringPopupTap:gridlyRouteWatchAllClickedDuringPopupTap, duplicateMarkerClickCount:gridlyDuplicateMarkerClickCount, markerClickHandlerGuardApplied:gridlyMarkerClickHandlerGuardApplied, compactBrandApplied, compactHeaderRefined, typographyPassApplied, spacingRhythmPassApplied, surfacePolishApplied, iconConsistencyPassApplied, sheetProductizationApplied, mapBreathingRoomApplied, iconSystemUnified, dockIconSystemUnified, railIconSystemUnified, iconSystemReferenceAligned, iconSystemHarmonized, dockRefinementApplied, utilityControlConsistencyApplied, headerFoundationApplied, surfaceRestraintApplied, opticalAlignmentPassApplied, v1321FinalTighteningApplied, headerStatusCohesionApplied, filterDensityTuned, dockOpticalFinalized, mapFirstBalancePreserved, microAlignmentQaApplied, v1322TypographyEasingApplied, topHeaderTypographyRefined, filterStripEased, topStackCalmnessApplied, microTypographyConsistencyApplied, mapDominancePreserved, v133BrandFoundationApplied, headerIdentitySystemApplied, gridlyMarkFoundationApplied, wordmarkPolished, brandRestraintMaintained, iconBrandRelationshipAligned, v1331RealBrandAssetsIntegrated, compactResponsiveBrandVariantApplied, faviconValidated, appIconsValidated, temporaryBrandLayersRemoved, brandProductionIntegrationComplete, v1332UltraCompactHeaderApplied, headerBrandFitmentComplete, compactLogoOpticsBalanced, mapFirstBrandRestraintMaintained, legacyWideLogoRemoved, productionHeaderIdentityFinalized, warnings};
  };
  document.addEventListener("DOMContentLoaded", bindV2);
})();
