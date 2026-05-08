const SUPABASE_URL = "https://nhwhkbkludzkuyxmkkcj.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO";

const FRA_URL =
  "https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=LIBERTY";
const CROSSING_REVIEW_OVERRIDES_URL = "data/gridly-crossing-review-overrides.json";
const HAZARD_REPORT_EXPIRATION_MINUTES = 180;

const HAZARD_TYPES = {
  flooding: {
    label: "Flooding",
    icon: "🌊",
    severity: "high",
    detail: "Shared report: flooding may affect travel."
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
let showAllCrossingsLayer = false;
let savedRouteCrossingIds = new Set();
let activeDestinationPlace = null;
let routeWatchActivated = false;
let lastSavedPlaceResult = null;
let lastValidationError = null;
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
let lastRouteSwitchMessage = "";
let routeUxState = "primary_clear";
let routeRecommendationTone = "calm";
let routeTransitionUntil = 0;
let routePreviewReason = "Route preview has not been requested.";
let lastRoutePreviewError = null;
let routeGeometrySource = "fallback";
let osrmRouteSuccess = false;
let monitoredRouteEtaMinutes = null;
let monitoredRouteDelayMinutes = null;
let monitoredRouteDurationSeconds = null;
let pendingHazardPlacement = null;
let selectedQuickHazardType = null;
let mobileUiMode = "live";

const reportingState = {
  selectedHazardType: null,
  reportModeActive: false,
  placementModeActive: false,
  submissionInProgress: false,
  lastReportMessage: "",
  lastReportError: "",
  activeReportEntryPoint: ""
};

function updateReportingState(patch = {}) {
  Object.assign(reportingState, patch);
  const isReportingLive = Boolean(reportingState.reportModeActive || reportingState.placementModeActive || reportingState.submissionInProgress);
  document.body?.classList.toggle("reporting-live", isReportingLive);
  const mapFrame = document.querySelector(".map-frame");
  if (mapFrame) mapFrame.dataset.reportingState = isReportingLive ? "active" : "idle";
  if (window.matchMedia("(max-width: 760px)").matches) {
    setMobileUiMode(isReportingLive ? "report" : mobileUiMode === "report" ? "live" : mobileUiMode, { silent: true });
  }
}

function setMobileUiMode(mode = "live", options = {}) {
  const nextMode = ["live", "route", "report", "alert"].includes(mode) ? mode : "live";
  mobileUiMode = nextMode;
  document.body?.setAttribute("data-mobile-mode", nextMode);
  document.querySelectorAll(".mobile-dock-btn").forEach((btn) => {
    const btnMode = btn.dataset.mode;
    btn.classList.toggle("active", btnMode === nextMode);
  });
  if (!options.silent) {
    const labels = { live: "Live mode active.", route: "Route mode active.", report: "Report mode active.", alert: "Alert mode active." };
    setConfirmation(labels[nextMode], "info");
  }
}

window.gridlyReportingDebug = function () {
  return {
    selectedHazardType: reportingState.selectedHazardType,
    reportModeActive: reportingState.reportModeActive,
    placementModeActive: reportingState.placementModeActive,
    submissionInProgress: reportingState.submissionInProgress,
    lastReportMessage: reportingState.lastReportMessage,
    lastReportError: reportingState.lastReportError,
    activeReportEntryPoint: reportingState.activeReportEntryPoint || ""
  };
};

const LOCAL_PLACE_LOOKUP = {
  dayton: { lat: 30.0466, lng: -94.8852 },
  crosby: { lat: 29.9111, lng: -95.0622 },
  baytown: { lat: 29.7355, lng: -94.9774 },
  liberty: { lat: 30.0572, lng: -94.795 },
  cleveland: { lat: 30.3413, lng: -95.0858 }
};
let lastRouteWatchSelection = { startId: "", destinationId: "" };
let gridlyUserProfile = getGridlyUserProfile();
let movementIntelligence = getMovementIntelligence();
let mapBaseLayersByName = {};
let mapStyleClassByName = {};
let currentMapStyle = "Satellite";
const LEGACY_PLACE_MARKER_TEXT = "legacy migrated";

let deviceId =
  localStorage.getItem("gridlyDeviceId") ||
  `device-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;

localStorage.setItem("gridlyDeviceId", deviceId);

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  hydrateElements();
  gridlyHealthCheck();
  setManualFallbackDefaultState();
  ensureSeededMovementIntelligence();
  attachGridlyMovementDebugGlobal();
  attachSavedPlacesDebugGlobal();
  attachRouteWatchDebugGlobal();
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
  updateProfileUI();
  maybeOpenFirstRunSetup();

  await loadCrossings();
  await loadSharedReports();

  setInterval(loadSharedReports, LIVE_REFRESH_MS);
});

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
    console.log("[Map click diagnostic]", {
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
  els.reportSection.open = !isDesktop;
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
  baseLayers[initialStyle].addTo(map);
  map.getContainer().classList.add(styleClassByName[initialStyle]);

  L.control.layers(baseLayers, null, { position: "bottomright", collapsed: true }).addTo(map);

  map.on("baselayerchange", (event) => {
    const selectedName = event?.name;
    if (!styleClassByName[selectedName]) return;
    Object.values(styleClassByName).forEach((className) => map.getContainer().classList.remove(className));
    map.getContainer().classList.add(styleClassByName[selectedName]);
    currentMapStyle = selectedName;
    localStorage.setItem(MAP_STYLE_STORAGE_KEY, selectedName);
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
    });

    debounceId = setTimeout(() => {
      map.invalidateSize({ pan: false, debounceMoveend: true });
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

    marker.on("click", () => {
      console.log("Crossing marker clicked", String(crossing.id));
    });

    marker.on("popupopen", () => {
      console.log("Crossing popup opened", String(crossing.id));
      const popupEl = marker.getPopup()?.getElement?.();
      if (popupEl) wirePopupReportButtons(popupEl);
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
    crash: 14, flooding: 14, debris: 8, construction: 7, road_closed: 18, disabled_vehicle: 7, rail_blockage_delay: 16, other_hazard: 6
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

  incidents.forEach((incident) => {
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

    const icon = L.divIcon({
      className: "",
      html: `
        <div class="gridly-hazard-marker ${sanitizeText(getMapSeverityClass(incident))} ${ageClass} ${proximityClass} ${routeRelevanceClass}">
          <span>${sanitizeText(getUnifiedIncidentIcon(incident))}</span>
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

  updateHazardCounter(incidents);
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
  const map = { crash: "wreck", flooding: "flooding", construction: "construction", debris: "debris", road_closed: "closure", disabled_vehicle: "wreck", hazard_cleared: "cleared" };
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
      area: "Liberty County",
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
counter.textContent = "No live road hazards";
  launcher.addEventListener("click", openHazardPanel);

  const panel = document.createElement("div");
  panel.id = "gridlyHazardPanel";
  panel.className = "gridly-hazard-panel";
  panel.innerHTML = `
    <div class="hazard-panel-header">
      <strong>Report Road Hazard</strong>
      <button type="button" data-action="close-hazard-panel">×</button>
    </div>
    <p>Choose a hazard, then use your location or tap the map.</p>
    <div class="hazard-choice-grid">
      <button type="button" data-action="open-hazard-placement" data-hazard-type="flooding">🌊 Flooding</button>
      <button type="button" data-action="open-hazard-placement" data-hazard-type="debris">⚠️ Debris</button>
      <button type="button" data-action="open-hazard-placement" data-hazard-type="crash">🚗 Crash / Wreck</button>
      <button type="button" data-action="open-hazard-placement" data-hazard-type="construction">🚧 Construction</button>
      <button type="button" data-action="open-hazard-placement" data-hazard-type="road_closed">⛔ Road Closed</button>
      <button type="button" data-action="open-hazard-placement" data-hazard-type="disabled_vehicle">🚙 Disabled Vehicle</button>
      <button type="button" data-action="open-hazard-placement" data-hazard-type="rail_blockage_delay">🚆 Rail Issue</button>
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

function openHazardPanel() {
  updateReportingState({ reportModeActive: true, activeReportEntryPoint: "report_near_me" });
  document.getElementById("gridlyHazardPanel")?.classList.add("visible");
}

window.closeHazardPanel = function () {
  updateReportingState({ reportModeActive: false, placementModeActive: false });
  document.getElementById("gridlyHazardPanel")?.classList.remove("visible");
};

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
  const selectedType = hazardType || reportingState.selectedHazardType || selectedQuickHazardType || pendingHazardPlacement;
  if (!selectedType) {
    updateReportingState({ lastReportError: "Choose a hazard first, then use My Location.", lastReportMessage: "" });
    setConfirmation("Choose a hazard first, then use My Location.", "error");
    return;
  }

  if (!navigator.geolocation) {
    updateReportingState({ lastReportError: "Location is unavailable. Select a spot on the map to submit this hazard.", lastReportMessage: "" });
    setConfirmation("Location is unavailable. Select a spot on the map to submit this hazard.", "error");
    return;
  }

  const hazardCopy = HAZARD_TYPES[selectedType] || HAZARD_TYPES.other_hazard;

  updateReportingState({
    activeReportEntryPoint: "hazard_use_my_location",
    lastReportError: "",
    lastReportMessage: `Finding your location for ${hazardCopy.label} report...`
  });
  setConfirmation(`Finding your location for ${hazardCopy.label} report...`, "success");

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
  pendingHazardPlacement = hazardType || reportingState.selectedHazardType || selectedQuickHazardType || "other_hazard";
  selectedQuickHazardType = pendingHazardPlacement;
  updateReportingState({
    selectedHazardType: pendingHazardPlacement,
    placementModeActive: true,
    activeReportEntryPoint: "hazard_tap_map"
  });
  updateReportingState({
    lastReportError: "",
    lastReportMessage: "Tap the map where the issue is located."
  });
  setConfirmation("Tap the map where the issue is located.", "success");
}

async function handleHazardPlacementMapClick(event) {
  if (!pendingHazardPlacement && !reportingState.selectedHazardType) return;
  const lat = event?.latlng?.lat;
  const lng = event?.latlng?.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const selectedType = pendingHazardPlacement || reportingState.selectedHazardType;
  const submitted = await createSharedHazardReport(selectedType, lat, lng, "tap map placement");
  if (!submitted) return;
  resetQuickHazardReportState();
  closeHazardPanel();
}

async function createSharedHazardReport(hazardType, lat, lng, confidence, locationName = "") {
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
    updateReportingState({ submissionInProgress: true });
    setSync("Sending hazard report...");
    updateReportingState({ lastReportError: "", lastReportMessage: `Sending ${copy.label} hazard report...` });
    setConfirmation(`Sending ${copy.label} hazard report...`, "success");

    const { error } = await supabaseClient.from("reports").insert(row);

    if (error) throw error;

    updateReportingState({ lastReportError: "", lastReportMessage: `${copy.label} report shared.` });
    setConfirmation(`${copy.label} report shared.`, "success");
    setSync("Hazard report shared");

    await runPostSubmitRefresh();
    updateReportingState({ submissionInProgress: false, reportModeActive: false, placementModeActive: false });
    if (window.matchMedia("(max-width: 760px)").matches) setMobileUiMode("live", { silent: true });
    return true;
  } catch (error) {
    console.error("Gridly hazard insert failed:", error);
    updateReportingState({ lastReportError: `Hazard report failed: ${error.message || "permission denied"}` });
    setConfirmation(`Hazard report failed: ${error.message || "permission denied"}`, "error");
    setSync("Hazard report failed");
    updateReportingState({ submissionInProgress: false });
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
      width: 28px;
      height: 28px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      position: relative;
      background: rgba(8, 16, 24, 0.96);
      border: 2px solid rgba(255, 209, 102, 0.95);
      box-shadow: 0 0 0 2px rgba(255,255,255,0.18), 0 0 16px rgba(255, 209, 102, 0.34);
      animation: gridlyHazardPulse 1.7s infinite;
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
      font-size: 0;
      line-height: 1;
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
      opacity: 0.55;
      animation: none;
    }

    .gridly-hazard-marker.route-relevant {
      transform: scale(1.08);
      filter: saturate(1.14) brightness(1.08);
      box-shadow: 0 0 0 3px rgba(255,255,255,0.2), 0 0 22px rgba(255, 209, 102, 0.56);
    }

    .gridly-hazard-marker.high.route-relevant {
      box-shadow: 0 0 0 3px rgba(255,255,255,0.2), 0 0 24px rgba(255, 78, 111, 0.62);
    }

    .gridly-hazard-marker.moderate.route-relevant {
      box-shadow: 0 0 0 3px rgba(255,255,255,0.2), 0 0 24px rgba(57, 200, 255, 0.62);
    }

    .gridly-hazard-marker.route-deemphasized {
      opacity: 0.48;
      filter: saturate(0.78) brightness(0.9);
      animation-duration: 3.2s;
    }

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
    }

    .gridly-hazard-panel.visible {
      display: block;
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
        bottom: 8px;
        transform: none;
        width: auto;
      }
      .hazard-choice-grid {
        grid-template-columns: 1fr;
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
  updateReportingState({ reportModeActive: true, activeReportEntryPoint: "manual_mode_toggle" });

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

  els.mobileReportBtn?.addEventListener("click", handleSmartReportButton);
  els.mobileDockReportBtn?.addEventListener("click", handleSmartReportButton);
  els.mobileLiveRouteActionBtn?.addEventListener("click", () => routeNavSection("map"));
  els.mobileQuickReportBtn?.addEventListener("click", handleReportNearMe);
  els.mobileQuickReportSmallBtn?.addEventListener("click", handleReportNearMe);
  els.mobileQuickClearedBtn?.addEventListener("click", () => {
    if (lastSubmittedCrossing) {
      createSharedReport(lastSubmittedCrossing, "cleared", "quick clear action", els.mobileQuickClearedBtn);
      return;
    }

    setConfirmation("No recent crossing selected to clear.", "error");
  });
  els.mobileQuickRouteBtn?.addEventListener("click", (event) => openRouteSetupModal(event.currentTarget));
  els.mobileQuickFavoritesBtn?.addEventListener("click", () => {
    openSmartAlertsModal();
    setConfirmation("Smart Alerts opened.", "success");
  });
  const weatherChipBtn = els.mobileWeatherChipBtn || document.querySelector("#mobileWeatherChipBtn, .mobile-weather-chip");
  const bellBtn = els.mobileBellBtn || document.querySelector("#mobileBellBtn, .mobile-icon-btn");

  bindMobileTap(weatherChipBtn, () => {
    scrollToSection("mapSection");
    setConfirmation("Weather context is not wired yet. Opening live map as a safe fallback.", "success");
  });
  bindMobileTap(bellBtn, () => {
    openSmartAlertsModal();
    setConfirmation("Smart Alerts opened.", "success");
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
  const handleDataActionClick = (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (!action) return;
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
      openHazardPlacement(selectedType);
      return;
    }
    if (action === "cancel-hazard-placement") {
      event.preventDefault();
      pendingHazardPlacement = null;
      selectedQuickHazardType = null;
      updateReportingState({ selectedHazardType: null, placementModeActive: false, activeReportEntryPoint: "hazard_cancel" });
      closeHazardPanel();
      return;
    }
    if (action === "zoom-crossing") {
      event.preventDefault();
      zoomToCrossing(actionEl.dataset.crossingId);
    }
  };
  document.addEventListener("click", handleDataActionClick);
  els.mobileOpenLiveMapBtn?.addEventListener("click", () => {
    setConfirmation("Opening Live Map.", "success");
  });
  els.mobileCommuteRouteBtn?.addEventListener("click", () => {
    setConfirmation("Opening Route Watch.", "success");
  });
  els.mobileCrossingReportBtn?.addEventListener("click", () => {
    setReportMode(REPORT_MODES.rail);
    setConfirmation("Railroad crossing report mode is active below.", "success");
    els.reportSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  els.mobileHazardReportBtn?.addEventListener("click", () => {
    setReportMode(REPORT_MODES.roadHazard);
    setConfirmation("Road hazard report mode is active below.", "success");
    els.reportSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  els.mapReportShortcutBtn?.addEventListener("click", handleReportNearMe);
  els.desktopReportNearMeBtn?.addEventListener("click", handleReportNearMe);
  els.desktopReportNearMeBtnRail?.addEventListener("click", handleReportNearMe);
  els.saveSmartAlertsBtn?.addEventListener("click", saveSmartAlertsPreferences);
  els.closeSmartAlertsModalBtn?.addEventListener("click", closeSmartAlertsModal);
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
  els.openSmartAlertsBtn?.addEventListener("click", openSmartAlertsModal);

  els.quickClearBtn?.addEventListener("click", async () => {
    if (!lastSubmittedCrossing) {
      setConfirmation("No recent crossing selected to clear.", "error");
      return;
    }

    await createSharedReport(lastSubmittedCrossing, "cleared", "quick clear follow-up", els.quickClearBtn);
    els.quickClearCard?.classList.remove("visible");
    resetSmartReportButton();
  });

  const handleRouteCardInteraction = () => {
    const hasSavedRoute = getSavedPlaces().length > 0;
    const isMobile = window.matchMedia("(max-width: 1100px)").matches;

    if (isMobile) {
      if (!hasSavedRoute) openRouteSetupModal();
      return;
    }

    scrollToSection("setupCard");
  };

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

  els.routeStatusCard?.addEventListener("click", handleRouteCardInteraction);
  els.routeStatusCard?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRouteCardInteraction();
    }
  });

  const navTargets = {
    dashboard: "dashboardSection",
    map: "mapSection",
    routes: "setupCard",
    report: "reportSection",
    alerts: "alertsSection"
  };
  const routeNavSection = (section) => {
    if (section === "settings") {
      setConfirmation("Settings are coming soon.", "info");
      return;
    }
    const target = navTargets[section];
    if (!target) return;
    if (window.matchMedia("(max-width: 760px)").matches) {
      if (section === "map" || section === "dashboard") setMobileUiMode("live", { silent: true });
      if (section === "alerts") setMobileUiMode("alert", { silent: true });
      if (section === "routes") setMobileUiMode("route", { silent: true });
      if (section === "report") setMobileUiMode("report", { silent: true });
    }
    scrollToSection(target);
    if (section === "map") setTimeout(() => map?.invalidateSize(), 350);
    if (section === "report") setReportMode(activeReportMode || REPORT_MODES.rail);
    if (section === "routes" && window.matchMedia("(max-width: 1100px)").matches) {
      openRouteSetupModal();
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

  const navButtons = Array.from(document.querySelectorAll(".nav-btn[data-section]"));
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

  document.getElementById("desktopDispatcherBtn")?.addEventListener("click", () => {
    if (!isDesktopViewport()) return;
    console.log("Desktop command button clicked: dispatcher");
    handleDesktopCommandAction("dispatcher");
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

function handleSmartReportButton() {
  if (
    lastSubmittedCrossing &&
    (lastSubmittedReportType === "blocked" || lastSubmittedReportType === "heavy")
  ) {
    createSharedReport(lastSubmittedCrossing, "cleared", "mobile quick clear", els.mobileReportBtn);
    return;
  }

  handleReportNearMe();
}

function handleReportNearMe() {
  setMobileUiMode("report", { silent: true });
  updateReportingState({
    reportModeActive: true,
    placementModeActive: false,
    activeReportEntryPoint: "report_near_me",
    lastReportError: "",
    lastReportMessage: "Choose a hazard, then use your location or tap the map."
  });
  openHazardPanel();
  scrollToSection("mapSection");
  safeText("mapTrustNote", "Quick reporting is now map-first: select a hazard, then use My Location or Tap Map Location.");
  setConfirmation("Choose a hazard, then tap map to drop the report.", "success");
  document.body.classList.add("report-pulse");
  setTimeout(() => document.body.classList.remove("report-pulse"), 900);
}

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
  const { home, work, button } = getRouteInputValues(source);
  const modalMode = source === "mobile" ? (els.routeSetupModal?.dataset.mode || "add") : "add";
  const prefillType = source === "mobile" ? (els.routeSetupModal?.dataset.prefillType || "custom") : "custom";
  if (!home || !work) {
    const errorMessage = "Missing place name or address. Please fill both fields.";
    lastValidationError = errorMessage;
    flashButton(button, "Add name + place");
    setConfirmation(errorMessage, "error");
    lastSavedPlaceResult = { ok: false, message: errorMessage, at: new Date().toISOString() };
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
    allowGeocode: true
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
  const destinationLabel = els.mobileSavedDestinationSelect?.closest("label");
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
  // Render from saved Home/Work (or other saved place) coordinates only after coordinate validation succeeds.
  if (!map) return false;

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
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 7000) : null;
    const response = await fetch(osrmUrl, {
      method: "GET",
      signal: controller?.signal
    });
    if (timeoutId) clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`OSRM response failed (${response.status})`);
    }
    const payload = await response.json();
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

  routePreviewCorridorLayer = L.layerGroup([corridorUnderlay, corridorBase, routePreviewLayer]).addTo(map);
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
    return false;
  }

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
    els.routeWatchStartBtn.disabled = savedPlaceCount < 2 || !startId || !destinationId;
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

async function startInlineRouteWatch() {
  const startId = els.routeWatchStartSelect?.value || "";
  const destinationId = els.routeWatchDestinationSelect?.value || "";
  const places = getSavedPlaces();
  const start = places.find((place) => place.id === startId);
  const destination = places.find((place) => place.id === destinationId);
  if (!start || !destination) {
    setRoutePreviewState(false, "Start or destination was not selected.", { layerExists: false, mapHasLayer: false, pointCount: 0 });
    setConfirmation("Choose a start and destination to begin monitoring.", "error");
    return;
  }
  if (start.id === destination.id) {
    savedRouteLayer?.clearLayers?.();
    setRoutePreviewState(false, "Start and destination are the same place.", { layerExists: false, mapHasLayer: false, pointCount: 0 });
    setConfirmation("Choose a different destination.", "error");
    return;
  }
  routeWatchActivated = true;
  safeText("desktopRouteHome", start.name);
  safeText("desktopRouteWork", destination.name);
  safeText("routeCardLabel", `${start.name} → ${destination.name}`);
  safeText("desktopRouteStatus", `Monitoring ${start.name} → ${destination.name}.`);
  safeText("routeWatchSetupHint", `Monitoring ${start.name} → ${destination.name}.`);

  const state = normalizeSavedPlaces();
  const fromPlace = start.id === "home" ? state.home : start.id === "work" ? state.work : state.custom.find((place) => place.id === start.id);
  const toPlace = destination.id === "home" ? state.home : destination.id === "work" ? state.work : state.custom.find((place) => place.id === destination.id);
  const fromCoords = normalizeCoordinatePair(fromPlace?.lat, fromPlace?.lng);
  const toCoords = normalizeCoordinatePair(toPlace?.lat, toPlace?.lng);
  if (!fromCoords || !toCoords) {
    savedRouteLayer?.clearLayers?.();
    setRoutePreviewState(false, "Missing start or destination coordinates", { layerExists: false, mapHasLayer: false, pointCount: 0 });
    setConfirmation("Route preview unavailable until precise locations are saved.", "error");
    safeText("routeWatchSetupHint", "Route preview unavailable until precise locations are saved.");
    updateRouteIntelligence();
    updateRouteWatchStartButtonLabel();
    return;
  }
  if (fromCoords.lat === toCoords.lat && fromCoords.lng === toCoords.lng) {
    savedRouteLayer?.clearLayers?.();
    setRoutePreviewState(false, "Start and destination coordinates are the same", { layerExists: false, mapHasLayer: false, pointCount: 0 });
    setConfirmation("Update one saved place location to view a route preview.", "error");
    safeText("routeWatchSetupHint", "Update one saved place location to view a route preview.");
    updateRouteIntelligence();
    updateRouteWatchStartButtonLabel();
    return;
  }
  if (getDistanceMiles(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng) > 80) {
    savedRouteLayer?.clearLayers?.();
    setRoutePreviewState(false, "Route preview skipped because points are too far apart for local preview.", { layerExists: false, mapHasLayer: false, pointCount: 0 });
    setConfirmation("Route preview unavailable for this selection.", "error");
    safeText("routeWatchSetupHint", "Route preview unavailable for this selection.");
    updateRouteIntelligence();
    updateRouteWatchStartButtonLabel();
    return;
  }
  savedRouteLayer?.clearLayers?.();
  window.__gridlyRouteWatchActive = true;
  window.__gridlySelectedRouteId = `${start.id}->${destination.id}`;
  const routePreviewShown = await renderRoutePreviewLine(fromCoords, toCoords, {
    start: start.name,
    destination: destination.name
  });
  if (!routePreviewShown) {
    setRoutePreviewState(false, "Missing start or destination coordinates", { layerExists: false, mapHasLayer: false, pointCount: 0 });
    setConfirmation("Route preview unavailable until precise locations are saved.", "error");
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
  activeDestinationPlace = toPlace;
  lastRouteWatchSelection = { startId: start.id, destinationId: destination.id };
  updateRouteWatchBadge(destination.name);
  updateRouteIntelligence();
  updateRouteWatchStartButtonLabel();
}

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
  routeDelayValue = ""
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
      <div class="route-watch-intel-item"><span class="route-watch-intel-label">Corridor Health</span><span class="route-watch-intel-value">${corridorHealth}</span></div>
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
  routeDelayValue = ""
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
    safeText("routeStatus", "No active route selected");
    safeText("routeEta", routeLabelParts.hasHome ? "Choose destination" : "Set Home");
    safeText("desktopRouteStatus", routeLabelParts.hasHome ? "Choose a saved destination to start Route Watch." : "Set Home and one destination to start Route Watch.");
    safeText("routeFreshness", "Unknown");
    safeText("routeConfidence", `System: ${systemConfidence} · Recommendation: ${recommendationConfidence}`);
    safeText("routeReports", "0 active");
    safeText("routeRecommendation", "Awaiting route selection");
    safeText("sideRouteWatchHint", routeLabelParts.hasHome ? "Choose a saved destination to start Route Watch." : "Set Home and one destination to start Route Watch.");
    safeText("departureTime", "Set destination first");
    renderRouteWatchIntelligenceFields({
      systemConfidence,
      recommendationConfidence,
      corridorHealth: "Awaiting route",
      estimatedDelayImpact: "Awaiting route"
    });
    els.routeStatusCard?.classList.add("delayed");
  } else if (routeHazard.level === "blocked") {
    safeText("routeStatus", "ALTERNATE ROUTE RECOMMENDED");
    safeText("routeEta", `ETA 32 min (+${extraMinutes})`);
    safeText("departureTime", "LEAVE NOW");
    renderRouteWatchIntelligenceFields({ systemConfidence, recommendationConfidence, corridorHealth, estimatedDelayImpact, ...getRouteEtaMetricsFromState({ routeHazardLevel: routeHazard.level, fallbackExtraMinutes: extraMinutes }) });
    safeText("desktopRouteStatus", "Delay wall detected on your corridor. Switch routes now.");
    safeText("routeFreshness", freshnessTier);
    safeText("routeConfidence", `System: ${systemConfidence} · Recommendation: ${recommendationConfidence}`);
    safeText("routeReports", `${routeHazard.nearbyReports.length} near route`);
    { const rec = getRouteRecommendationState(routeHazard); safeText("routeRecommendation", rec.message); }
    safeText("sideRouteWatchHint", routeContextSummary);
    els.routeStatusCard?.classList.add("high");
  } else if (routeHazard.level === "heavy") {
    safeText("routeStatus", "DELAY BUILDING");
    safeText("routeEta", `ETA 26 min (+${extraMinutes})`);
    safeText("departureTime", "LEAVE 8 MIN EARLY");
    renderRouteWatchIntelligenceFields({ systemConfidence, recommendationConfidence, corridorHealth, estimatedDelayImpact, ...getRouteEtaMetricsFromState({ routeHazardLevel: routeHazard.level, fallbackExtraMinutes: extraMinutes }) });
    safeText("desktopRouteStatus", "Operational pressure is rising. Leave early or shift to an alternate.");
    safeText("routeFreshness", freshnessTier);
    safeText("routeConfidence", `System: ${systemConfidence} · Recommendation: ${recommendationConfidence}`);
    safeText("routeReports", `${routeHazard.nearbyReports.length} near route`);
    { const rec = getRouteRecommendationState(routeHazard); safeText("routeRecommendation", rec.message); }
    safeText("sideRouteWatchHint", routeContextSummary);
    els.routeStatusCard?.classList.add("delayed");
  } else if (routeHazard.level === "caution") {
    safeText("routeStatus", "WATCH CORRIDOR");
    safeText("routeEta", `ETA 24 min (+${Math.max(extraMinutes, 3)})`);
    safeText("departureTime", "LEAVE SLIGHTLY EARLY");
    renderRouteWatchIntelligenceFields({ systemConfidence, recommendationConfidence, corridorHealth, estimatedDelayImpact, ...getRouteEtaMetricsFromState({ routeHazardLevel: routeHazard.level, fallbackExtraMinutes: extraMinutes }) });
    safeText("desktopRouteStatus", "Early delay signal detected near your monitored corridor.");
    safeText("routeFreshness", freshnessTier);
    safeText("routeConfidence", `System: ${systemConfidence} · Recommendation: ${recommendationConfidence}`);
    safeText("routeReports", `${routeHazard.nearbyReports.length} near route`);
    { const rec = getRouteRecommendationState(routeHazard); safeText("routeRecommendation", rec.message); }
    safeText("sideRouteWatchHint", routeContextSummary);
    els.routeStatusCard?.classList.add("delayed");
  } else {
    safeText("routeStatus", "CLEAR TO LEAVE");
    safeText("routeEta", "ETA 21 min");
    safeText("departureTime", "ON-SCHEDULE DEPARTURE");
    renderRouteWatchIntelligenceFields({ systemConfidence, recommendationConfidence, corridorHealth, estimatedDelayImpact, ...getRouteEtaMetricsFromState({ routeHazardLevel: routeHazard.level, fallbackExtraMinutes: extraMinutes }) });
    safeText("desktopRouteStatus", "Route corridor is open. Continue live monitoring.");
    safeText("routeFreshness", freshnessTier);
    safeText("routeConfidence", `System: ${systemConfidence} · Recommendation: ${recommendationConfidence}`);
    safeText("routeReports", `${routeHazard.nearbyReports.length} near route`);
    { const rec = getRouteRecommendationState(routeHazard); safeText("routeRecommendation", rec.message); }
    safeText("sideRouteWatchHint", routeContextSummary);
    els.routeStatusCard?.classList.add("clear");
  }

  if (els.routeRecommendation) {
    els.routeRecommendation.classList.add("route-watch-recommendation-emphasis");
  }
  const mobileLiveCommand = document.querySelector(".mobile-live-command");
  if (mobileLiveCommand) mobileLiveCommand.removeAttribute("data-delay-state");
  safeText("mobileLiveRouteStatus", `${els.routeStatus?.textContent || "CLEAR TO LEAVE"} • ${els.routeEta?.textContent || "ETA pending"}`);
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
    safeText("mobileLiveRouteActionBtn", alternateRouteAvailable ? "Use alternate" : "Report issue");
    liveStatusCard?.classList.add("blocked-status");
  } else if (impact >= 40) {
    if (mobileLiveCommand) mobileLiveCommand.dataset.delayState = "delayed";
    safeText("mobileLiveStatusPill", "DELAY BUILDING");
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
    safeText("mobileLiveRouteActionBtn", "Leave now");
    liveStatusCard?.classList.add("clear-status");
  }
  updateAlternateRouteActionState();

  safeText("mobileCommuteRouteBtn", impact >= 70 ? "Open Reroute Plan" : "Open Commute Plan");
  updateRouteWatchBadge();
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
  let detail = "No active reports right now. Live watch remains on for new driver confirmations.";
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
    safeText("routeRecommendation", "DELAY BUILDING");
    safeText(
      "routeRecommendationReason",
      `${activeIssues.length} active shared report${activeIssues.length === 1 ? "" : "s"} may affect travel.`
    );
  } else {
    safeText("routeRecommendation", "CLEAR TO LEAVE");
    safeText("routeRecommendationReason", "No major active shared delays detected right now.");
  }

  const confirmationCount = getUnifiedIncidents().reduce((sum,i)=>sum+i.reports_count,0);

  const newestMinutes = typeof lastReport?.minutesAgo === "number" ? lastReport.minutesAgo : null;
  const freshnessTier = getFreshnessTier(newestMinutes);
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

function renderAlerts() {
  if (!els.alertsList) return;

  const incidents = getConsolidatedIncidents();
  if (!incidents.length) {
    els.alertsList.innerHTML = `
      <div class="alert-item">
        <strong>No active shared alerts</strong>
        <p>Your saved route looks quiet right now.</p>
      </div>
    `;
    return;
  }

  els.alertsList.innerHTML = incidents
    .slice(0, 3)
    .map((incident) => {
      const latest = incident.latestReport;
      const confidenceLabel = getCrossingConfidenceLabel(latest, incident.count);
      const freshnessLabel = getFreshnessLabel(latest);
      const confirmationLabel = getDriverConfirmationLabel(incident.count);
      const reportState = getReportStateLabel(latest);

      const label =
        latest.type === "cleared"
          ? "Cleared"
          : latest.severity === "high"
          ? "High Impact"
          : latest.severity === "moderate"
          ? "Moderate"
          : "Watch";

      const itemClass =
        latest.type === "cleared"
          ? "cleared"
          : latest.severity === "high"
          ? "high"
          : "";

      return `
        <div class="alert-item ${itemClass}">
          <strong>${sanitizeText(incident.crossingName)}</strong>
          <p>${label} · ${incident.newestMinutes}m · ${sanitizeText(confidenceLabel)}</p>
          <p>${sanitizeText(freshnessLabel)} · ${sanitizeText(latest.detail)}</p>
          <div class="alert-meta">
            <span class="alert-count-pill">${sanitizeText(confirmationLabel)}</span>
            <span class="trust-pill">${sanitizeText(reportState)}</span>
            <span class="source-pill">First reported ${incident.oldestMinutes} min ago</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTrendingCrossings() {
  if (!els.trendingList) return;

  const incidents = getConsolidatedIncidents().slice(0, 3);

  if (!incidents.length) {
    els.trendingList.innerHTML = `<div class="trend-item muted">Waiting for shared reports...</div>`;
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
      "No active shared alerts right now. Tap the map if you see a blocked crossing.";
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

  if (choiceGrid && !document.getElementById("gridlyRailIssueChoice")) {
    const railButton = document.createElement("button");
    railButton.id = "gridlyRailIssueChoice";
    railButton.type = "button";
    railButton.textContent = "🚆 Rail Crossing Issue";
    railButton.addEventListener("click", startRailIssueFromUnifiedPanel);

    choiceGrid.prepend(railButton);
  }

  injectMobileCTACleanupStyles();
}

function startRailIssueFromUnifiedPanel() {
  closeHazardPanel();
  handleReportNearMe();
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
        bottom: 164px !important;
        width: auto !important;
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
