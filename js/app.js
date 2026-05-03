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

let supabaseClient = null;
let realtimeChannel = null;
let map;
let crossingLayer;
let crossingMarkers = new Map();
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

let deviceId =
  localStorage.getItem("gridlyDeviceId") ||
  `device-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;

localStorage.setItem("gridlyDeviceId", deviceId);

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  hydrateElements();
  setManualFallbackDefaultState();
  initGreeting();
  updateLastUpdated();
  initMap();
  initSupabase();
  bindEvents();
  setReportMode(REPORT_MODES.rail);
  closeRouteSetupModal({ restoreFocus: false });
  injectHazardReportUI();
  loadSavedRoute();
  loadSmartAlertsPreferences();

  await loadCrossings();
  await loadSharedReports();

  setInterval(loadSharedReports, LIVE_REFRESH_MS);
});




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
    "desktopManageRouteBtn",
    "sideRouteWatchHint",
    "homeInput",
    "workInput",
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
    "trendingList",
    "shareCard",
    "shareGridlyBtn",
    "headerShareGridlyBtn",
    "quickClearCard",
    "quickClearBtn",
    "mobileReportBtn",
    "desktopReportNearMeBtn",
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
    "mobileSaveRouteBtn",
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
    "mapReportShortcutBtn"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });

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
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    setGreeting(
      "Good Morning",
      "Morning Route Intelligence",
      "Check your route before leaving. Gridly watches crossings, live reports, and local impact.",
      "Route Status"
    );
  } else if (hour >= 12 && hour < 17) {
    setGreeting(
      "Good Afternoon",
      "Midday Mobility Check",
      "Heading out soon? Gridly checks nearby crossings, slowdowns, and active road issues.",
      "Current Route"
    );
  } else if (hour >= 17 && hour < 22) {
    setGreeting(
      "Good Evening",
      "Evening Commute Intelligence",
      "Check your route home before you leave. Gridly watches for crossing delays and local impacts.",
      "Commute Home"
    );
  } else {
    setGreeting(
      "Late Night Check",
      "After-Hours Route Watch",
      "Quiet roads are still worth checking. Gridly looks for late-night rail delays and blocked crossings.",
      "Night Route"
    );
  }
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
  map = L.map("map", { zoomControl: false, preferCanvas: true }).setView(defaultCenter, 13);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  map.createPane("roadsPane");
  map.getPane("roadsPane").style.zIndex = 410;

  map.createPane("railPane");
  map.getPane("railPane").style.zIndex = 420;

  map.createPane("labelsPane");
  map.getPane("labelsPane").style.zIndex = 640;

  const darkBaseLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  });

  const secondaryRoadLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 20,
    pane: "roadsPane",
    opacity: 0.9,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  });

  const highwayLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 20,
    pane: "roadsPane",
    opacity: 1,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  });

  const railCorridorLayer = L.tileLayer("https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png", {
    subdomains: "abc",
    maxZoom: 19,
    pane: "railPane",
    opacity: 0.02,
    attribution: "Map style: OpenRailwayMap"
  });

  const premiumLabelLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 20,
    pane: "labelsPane",
    opacity: 0.78,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  });

  darkBaseLayer.addTo(map);
  secondaryRoadLayer.addTo(map);
  highwayLayer.addTo(map);
  railCorridorLayer.addTo(map);
  premiumLabelLayer.addTo(map);

  crossingLayer = L.layerGroup().addTo(map);
  unifiedIncidentLayer = L.layerGroup().addTo(map);

  map.on("zoomend moveend", () => {
    if (!crossings.length) return;
    renderCrossings();
  });

  centerMapOnUserIfAllowed();
  highlightNearestCrossingOnFirstLoad();
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
    },
    () => {}
  );
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
async function runPostSubmitRefresh() {
  console.debug("Post-submit refresh started");
  await loadSharedReports();
  renderUnifiedIncidents();
  renderCrossings();
  updateRouteIntelligence();
  updateMobileAlertsMirror();
  updateLastUpdated();
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

    renderAlerts();
    renderTrendingCrossings();
    renderCrossings();
    renderUnifiedIncidents();
    updateRouteIntelligence();
    updateTrustStats();
    updateGrowthWidgets();
    updateDailyHabitStatus();
    updateMobileAlertsMirror();
    evaluateSmartAlertsBanner();
    updateLastUpdated();

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

    const reportType = row.report_type || "other";
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
      .bindPopup(buildPopup(crossing, report), { maxWidth: 350 })
      .addTo(crossingLayer);

    crossingMarkers.set(String(crossing.id), marker);
  });

  highlightNearestCrossingOnFirstLoad();
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

  const count = visibleCrossings.length;
  const crossingLabel = count === 1 ? "crossing" : "crossings";
  let message = "All crossings visible: tap markers to confirm route status.";

  if (activeGeoFilter === "nearby") {
    message = count ? `Act now: review ${count} nearby ${crossingLabel} before departure.` : "Action needed: switch filters or zoom to find crossings.";
  } else if (activeGeoFilter === "town") {
    message = count ? `Dayton focus: check ${count} ${crossingLabel} for delays.` : "No Dayton crossings in view. Try County or All.";
  } else if (activeGeoFilter === "county") {
    message = count ? "County sweep: scan crossings and tap any issue marker." : "No county crossings visible. Reset map view.";
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
      (crossing) => String(crossing.city || "").toLowerCase() === "dayton"
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

  incidents.forEach((incident) => {
    if (!Number.isFinite(incident.lat) || !Number.isFinite(incident.lng)) return;

    const distanceFromUser = userLocation
      ? getDistanceMiles(userLocation.lat, userLocation.lng, incident.lat, incident.lng)
      : null;
    const isNearbyPriority = Number.isFinite(distanceFromUser) && distanceFromUser <= PRIORITY_NEARBY_MILES;
    const ageClass =
      incident.age_minutes <= 15 ? "fresh" : incident.age_minutes <= 60 ? "aging" : "old";
    const proximityClass = isNearbyPriority ? "nearby-priority" : "far-faded";

    const icon = L.divIcon({
      className: "",
      html: `
        <div class="gridly-hazard-marker ${sanitizeText(getMapSeverityClass(incident))} ${ageClass} ${proximityClass}">
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
        <button class="popup-report-btn warning" onclick="confirmHazardStillThere('${sanitizeText(hazard.type)}', ${hazard.lat}, ${hazard.lng})">Still There</button>
        <button class="popup-report-btn blue" onclick="clearHazard('${sanitizeText(hazard.type)}', ${hazard.lat}, ${hazard.lng})">Cleared</button>
      `
    : `
        <button class="popup-report-btn warning" onclick="confirmHazardStillThere('${sanitizeText(hazard.type)}', ${hazard.lat}, ${hazard.lng})">Confirm Now</button>
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
        <button class="popup-report-btn neutral" onclick="zoomToHazard(${hazard.lat}, ${hazard.lng})">View Area</button>
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
      <button type="button" onclick="closeHazardPanel()">×</button>
    </div>
    <p>Gridly will use your current GPS location for the hazard report.</p>
    <div class="hazard-choice-grid">
      <button type="button" onclick="submitHazardNearMe('flooding')">🌊 Flooding</button>
      <button type="button" onclick="submitHazardNearMe('debris')">⚠️ Debris</button>
      <button type="button" onclick="submitHazardNearMe('crash')">🚗 Crash / Wreck</button>
      <button type="button" onclick="submitHazardNearMe('construction')">🚧 Construction</button>
      <button type="button" onclick="submitHazardNearMe('other_hazard')">❗ Other Hazard</button>
    </div>
  `;

  document.body.appendChild(counter);
  document.body.appendChild(launcher);
  document.body.appendChild(panel);
  injectHazardStyles();
}

function openHazardPanel() {
  document.getElementById("gridlyHazardPanel")?.classList.add("visible");
}

window.closeHazardPanel = function () {
  document.getElementById("gridlyHazardPanel")?.classList.remove("visible");
};

window.submitHazardNearMe = function (hazardType) {
  if (!navigator.geolocation) {
    setConfirmation("Location is unavailable. Hazard reports need GPS for V12.5A.", "error");
    return;
  }

  const hazardCopy = HAZARD_TYPES[hazardType] || HAZARD_TYPES.other_hazard;

  setConfirmation(`Finding your location for ${hazardCopy.label} report...`, "success");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      await createSharedHazardReport(hazardType, lat, lng, "gps hazard report");

      if (map) {
        map.setView([lat, lng], 16);
      }

      closeHazardPanel();
    },
    () => {
      setConfirmation("Location permission was blocked. Hazard report not submitted.", "error");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 15000
    }
  );
};

async function createSharedHazardReport(hazardType, lat, lng, confidence, locationName = "") {
  if (!supabaseClient) {
    setConfirmation("Live hazard sync is unavailable.", "error");
    return;
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
    setSync("Sending hazard report...");
    setConfirmation(`Sending ${copy.label} hazard report...`, "success");

    const { error } = await supabaseClient.from("reports").insert(row);

    if (error) throw error;

    setConfirmation(`${copy.icon} ${copy.label} hazard report shared.`, "success");
    setSync("Hazard report shared");

    await runPostSubmitRefresh();
  } catch (error) {
    console.error("Gridly hazard insert failed:", error);
    setConfirmation(`Hazard report failed: ${error.message || "permission denied"}`, "error");
    setSync("Hazard report failed");
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
      right: 18px;
      bottom: 150px;
      width: 320px;
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
      grid-template-columns: 1fr;
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

    @media (max-width: 760px) {
      .gridly-hazard-launcher {
        left: 14px;
        right: 14px;
        bottom: 150px;
        width: calc(100vw - 28px);
      }
      .gridly-hazard-counter {
        left: 14px;
        right: 14px;
        bottom: 205px;
        text-align: center;
      }
      .gridly-hazard-panel {
        left: 14px;
        right: 14px;
        bottom: 210px;
        width: auto;
      }
    }
  `;

  document.head.appendChild(style);
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
    showMobileHeaderConfirmation("Showing Dayton crossings.", "success");
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

    const crossingButton = event.target.closest(".popup-report-btn[data-crossing-id][data-report-type]");
    if (!crossingButton) return;

    const crossingId = crossingButton.getAttribute("data-crossing-id");
    const reportType = crossingButton.getAttribute("data-report-type");
    if (!crossingId || !reportType || typeof window.reportCrossingFromPopup !== "function") return;

    event.preventDefault();
    event.stopPropagation();
    console.debug("Popup report clicked", crossingId, reportType);
    await window.reportCrossingFromPopup(crossingId, reportType, crossingButton);
  };

  document.addEventListener("pointerup", handlePopupAction);
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
  els.saveSmartAlertsBtn?.addEventListener("click", saveSmartAlertsPreferences);
  els.closeSmartAlertsModalBtn?.addEventListener("click", closeSmartAlertsModal);
  els.mobileSaveRouteBtn?.addEventListener("click", () => saveRoute("mobile"));
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
    const hasSavedRoute = Boolean(localStorage.getItem("gridlyHome") && localStorage.getItem("gridlyWork"));
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
    openRouteSetupModal(event.currentTarget);
  });


  els.routeStatusCard?.addEventListener("click", handleRouteCardInteraction);
  els.routeStatusCard?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRouteCardInteraction();
    }
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const targets = {
        dashboard: "dashboardSection",
        map: "mapSection",
        routes: "setupCard",
        report: "reportSection",
        alerts: "alertsSection"
      };

      scrollToSection(targets[btn.dataset.section]);

      if (btn.dataset.section === "alerts") {
        openSmartAlertsModal();
      }

      if (btn.dataset.section === "map") {
        setTimeout(() => map?.invalidateSize(), 350);
      }
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

      const targets = {
        dashboard: "dashboardSection",
        map: "mapSection",
        routes: "setupCard",
        report: "reportSection",
        alerts: "alertsSection"
      };

      const targetId = targets[btn.dataset.sectionJump];
      if (!targetId) return;

      scrollToSection(targetId);

      if (btn.dataset.sectionJump === "map") {
        setTimeout(() => map?.invalidateSize(), 350);
      }
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

  document.querySelectorAll(".geo-filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyGeoFilterFromPill(btn.dataset.geoFilter || "all");
    });
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
  els.routeSetupModal.hidden = false;
  els.routeSetupModal.style.display = "";
  els.routeSetupModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  document.body.classList.add("route-setup-open");
}

function closeRouteSetupModal(options = {}) {
  if (!els.routeSetupModal) return;
  const { restoreFocus = true } = options;
  els.routeSetupModal.hidden = true;
  els.routeSetupModal.style.display = "none";
  els.routeSetupModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  document.body.classList.remove("route-setup-open");

  if (restoreFocus && lastRouteSetupTrigger && typeof lastRouteSetupTrigger.focus === "function") {
    lastRouteSetupTrigger.focus();
  }
  lastRouteSetupTrigger = null;
}

function openSmartAlertsModal() {
  if (!els.smartAlertsModal) return;
  els.smartAlertsModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeSmartAlertsModal() {
  if (!els.smartAlertsModal) return;
  els.smartAlertsModal.hidden = true;
  document.body.classList.remove("modal-open");
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
  activateReportMode();

  if (!navigator.geolocation) {
    setConfirmation("Location is unavailable. Tap the closest crossing marker on the map, then choose a report type.", "error");
    return;
  }

  setConfirmation("Finding your location so you can report the nearest crossing...", "success");
  safeText("mapTrustNote", "Report mode: finding your location...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      renderUserLocationDot();

      const nearest = findNearestCrossings(userLocation.lat, userLocation.lng, 5);
      nearbyReportCrossingIds = new Set(nearest.map((crossing) => String(crossing.id)));

      renderCrossings();
      scrollToSection("mapSection");

      if (nearest.length) {
        map.setView([nearest[0].lat, nearest[0].lng], 15);

        setConfirmation(`Nearest crossing opened: ${nearest[0].name}. Confirm it is correct, then report.`, "success");

        safeText(
          "mapTrustNote",
          `Report mode: nearest crossing opened automatically. Confirm it is correct, then choose Blocked, Delay, Cleared, or Other.`
        );

        setTimeout(() => {
          map?.invalidateSize();
          crossingMarkers.get(String(nearest[0].id))?.openPopup();
        }, 500);
      } else {
        map.setView([userLocation.lat, userLocation.lng], 14);
        setConfirmation("Location found, but no nearby crossing was matched. Tap a crossing marker manually.", "error");
      }
    },
    () => {
      scrollToSection("mapSection");

      setConfirmation("Location permission was blocked. Tap the closest crossing marker on the map instead.", "error");

      safeText(
        "mapTrustNote",
        "Report mode: location blocked. Tap the closest crossing marker on the map."
      );

      setTimeout(() => map?.invalidateSize(), 350);
    }
  );
}

function activateReportMode() {
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
            buttonEl.textContent = "🚨 Report Near Me";
          }
        } else {
          buttonEl.textContent = originalButtonText;
        }
      }, 1400);
    }
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

function saveRoute(source = "desktop") {
  const { home, work, button } = getRouteInputValues(source);

  if (!home || !work) {
    flashButton(button, "Add Home + Work");
    return;
  }

  localStorage.setItem("gridlyHome", home);
  localStorage.setItem("gridlyWork", work);

  loadSavedRoute();
  updateRouteIntelligence();
  updateGrowthWidgets();
  flashButton(button, "Route Saved");

  if (source === "mobile") {
    closeRouteSetupModal();
  }
}

function loadSavedRoute() {
  const home = localStorage.getItem("gridlyHome");
  const work = localStorage.getItem("gridlyWork");

  if (home) {
    safeText("savedHome", home);
    safeText("desktopRouteHome", home);
    if (els.homeInput) els.homeInput.value = home;
    if (els.mobileHomeInput) els.mobileHomeInput.value = home;
  }

  if (work) {
    safeText("savedWork", work);
    safeText("desktopRouteWork", work);
    if (els.workInput) els.workInput.value = work;
    if (els.mobileWorkInput) els.mobileWorkInput.value = work;
  }
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

function updateRouteIntelligence(nearest = []) {
  const savedHome = localStorage.getItem("gridlyHome");
  const savedWork = localStorage.getItem("gridlyWork");

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

  const extraMinutes = Math.max(0, Math.round(impact / 7));
  const routeIntel = getRouteWatchIntelligence(activeIssues);

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

  if (!savedHome || !savedWork) {
    safeText("routeStatus", "Set Route");
    safeText("routeEta", "Save Home + Work");
    safeText("desktopRouteStatus", "Set Home + Work to monitor live hazards and confirmations.");
    safeText("sideRouteWatchHint", "Primary route watch is pinned above the live map.");
    safeText("departureTime", "Set route first");
    safeText("departureReason", "Home and Work unlock personalized route intelligence.");
    els.routeStatusCard?.classList.add("delayed");
  } else if (impact >= 70) {
    safeText("routeStatus", "Saved · Delayed");
    safeText("routeEta", `ETA 32 min (+${extraMinutes})`);
    safeText("departureTime", "Leave now");
    safeText("departureReason", `${routeIntel.blockedCount} blocked crossing${routeIntel.blockedCount === 1 ? "" : "s"} on route watch · est +${routeIntel.estimatedDelayMinutes} min.`);
    safeText("desktopRouteStatus", `${desktopRouteSummary} · ${routeIntel.advice}`);
    safeText("sideRouteWatchHint", `Route Watch: ${routeIntel.blockedCount} blocked · est +${routeIntel.estimatedDelayMinutes} min · ${routeIntel.reroute} Confidence ${routeIntel.confidence}.`);
    els.routeStatusCard?.classList.add("high");
  } else if (impact >= 40) {
    safeText("routeStatus", "Saved · Watch");
    safeText("routeEta", `ETA 26 min (+${extraMinutes})`);
    safeText("departureTime", "Leave 8 min early");
    safeText("departureReason", `${routeIntel.blockedCount} blocked crossing${routeIntel.blockedCount === 1 ? "" : "s"} on route watch · est +${routeIntel.estimatedDelayMinutes} min.`);
    safeText("desktopRouteStatus", `${desktopRouteSummary} · ${routeIntel.advice}`);
    safeText("sideRouteWatchHint", `Route Watch: ${routeIntel.blockedCount} blocked · est +${routeIntel.estimatedDelayMinutes} min · ${routeIntel.reroute} Confidence ${routeIntel.confidence}.`);
    els.routeStatusCard?.classList.add("delayed");
  } else {
    safeText("routeStatus", "Saved · Clear");
    safeText("routeEta", "ETA 21 min");
    safeText("departureTime", "Normal departure");
    safeText("departureReason", "No major active shared delay detected.");
    safeText("desktopRouteStatus", `${desktopRouteSummary} · ${routeIntel.advice}`);
    safeText("sideRouteWatchHint", `Route Watch: ${routeIntel.blockedCount} blocked · est +${routeIntel.estimatedDelayMinutes} min · ${routeIntel.reroute} Confidence ${routeIntel.confidence}.`);
    els.routeStatusCard?.classList.add("clear");
  }

  const liveStatusCard = document.querySelector(".mobile-live-hero");
  liveStatusCard?.classList.remove("clear-status", "delay-status", "blocked-status");

  if (impact >= 70) {
    safeText("delayRisk", routeIntel.urgentBlockedCount > 0 ? "Urgent Blocked Now" : "Delay Risk Rising");
    safeText("delayReason", routeIntel.urgentBlockedCount > 0 ? `${routeIntel.urgentBlockedCount} blocked report${routeIntel.urgentBlockedCount === 1 ? "" : "s"} posted within 10 min. Reroute immediately.` : "Major crossing blockage detected. Check the live map before departure.");
    safeText("alternateRoute", "Use alternate");
    safeText("alternateReason", "Avoid highest-impact crossing if possible.");
    safeText("impactText", "High route impact. Leave now or reroute.");
    liveStatusCard?.classList.add("blocked-status");
  } else if (impact >= 40) {
    safeText("delayRisk", "Morning Commute Watch");
    safeText("delayReason", "Crossing activity is building. Keep a backup route ready.");
    safeText("alternateRoute", "Have backup");
    safeText("alternateReason", "Alternate route may help if reports increase.");
    safeText("impactText", "Moderate route impact. Watch before leaving.");
    liveStatusCard?.classList.add("delay-status");
  } else {
    const hour = new Date().getHours();
    safeText("delayRisk", hour >= 21 || hour < 5 ? "Late Night Check" : "All Clear");
    safeText("delayReason", "No rail or road incidents reported nearby. Live watch stays on if conditions change.");
    safeText("alternateRoute", "Not needed");
    safeText("alternateReason", "Current route appears clear.");
    safeText("impactText", "Low route impact. Normal travel expected.");
    liveStatusCard?.classList.add("clear-status");
  }
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
    safeText("routeRecommendation", "Leave early or reroute");
    safeText(
      "routeRecommendationReason",
      `${highCount} high-impact shared report${highCount === 1 ? "" : "s"} active right now.`
    );
  } else if (activeIssues.length > 0) {
    safeText("routeRecommendation", "Watch your route");
    safeText(
      "routeRecommendationReason",
      `${activeIssues.length} active shared report${activeIssues.length === 1 ? "" : "s"} may affect travel.`
    );
  } else {
    safeText("routeRecommendation", "You can drive now");
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
        <button class="trend-item ${className}" type="button" onclick="zoomToCrossing('${sanitizeText(incident.crossingId)}')">
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
  return ["blocked", "heavy", "other"].includes(String(type || "").trim().toLowerCase());
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
        <button class="search-result-btn" type="button" onclick="zoomToCrossing('${sanitizeText(crossing.id)}')">
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
}

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
