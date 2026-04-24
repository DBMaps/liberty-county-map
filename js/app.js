/* Liberty County Spatial Intelligence System — V5.0
   Pure HTML/CSS/JS + Leaflet + Supabase
   Boundary file is loaded but never modified.

   V5.0 goals:
   - Preserve V4.4 official FRA crossing data
   - Show all open FRA crossings with review labels
   - Store reports in Supabase so multiple phones share live state
   - Keep localStorage fallback if Supabase is unavailable
*/

const APP_VERSION = "5.0.0";

const SUPABASE_URL = "https://nhwhkbkludzkuyxmkkcj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO";
const SUPABASE_REPORTS_TABLE = "crossing_reports";

const FRA_CROSSING_DATASET_ID = "m2f8-22s6";
const FRA_CROSSING_SOURCE_LABEL = "USDOT FRA Crossing Inventory";
const FRA_BASE_URL =
  "https://data.transportation.gov/resource/m2f8-22s6.geojson";

const REGIONS = {
  "US-TX-Liberty": {
    id: "US-TX-Liberty",
    label: "Liberty County, Texas",
    country: "US",
    state: "TX",
    county: "Liberty",
    defaultCity: "Dayton",
    mapCenter: [30.0466, -94.8852],
    defaultZoom: 11,
    boundaryPath: "data/liberty-county-boundary.geojson",
    legacyCrossingsPath: "data/liberty-county-rail-crossings.geojson",
    fraFilter: {
      statename: "TEXAS",
      countyname: "LIBERTY"
    }
  }
};

let currentRegionId = "US-TX-Liberty";
let currentRegion = REGIONS[currentRegionId];

const DATA_PATHS = {
  get boundary() {
    return currentRegion.boundaryPath;
  },
  get legacyCrossings() {
    return currentRegion.legacyCrossingsPath;
  }
};

const STORAGE_KEYS = {
  fallbackEvents: "lcsi_v50_fallback_events",
  savedLocations: "lcsi_v50_saved_locations",
  alertPrefs: "lcsi_v50_alert_preferences",
  clientId: "lcsi_v50_client_id",

  legacyEvents: "lcsi_v44_events",
  legacySavedLocations: "lcsi_v44_saved_locations",
  legacyAlertPrefs: "lcsi_v44_alert_preferences",

  olderEvents: "lcsi_v43_events",
  olderSavedLocations: "lcsi_v43_saved_locations",
  olderAlertPrefs: "lcsi_v43_alert_preferences"
};

const ALERT_DEFAULTS = {
  localVisualAlerts: true,
  browserNotifications: false
};

const REGION_DEFAULT = {
  country: currentRegion.country,
  state: currentRegion.state,
  county: currentRegion.county,
  city: currentRegion.defaultCity
};

const REPORT_COOLDOWN_MS = 2500;
const SAME_ACTION_COOLDOWN_MS = 10000;
const REPORT_REFRESH_MS = 10000;

let map;
let boundaryLayer;
let crossingLayer;
let userLocationMarker;
let selectedCrossing = null;

let allOfficialCrossings = [];
let hiddenOfficialCrossings = [];
let crossings = [];
let crossingMarkers = new Map();

let events = [];
let fallbackEvents = loadWithMigrationChain(STORAGE_KEYS.fallbackEvents, [
  STORAGE_KEYS.legacyEvents,
  STORAGE_KEYS.olderEvents
], []);

let savedLocations = loadWithMigrationChain(STORAGE_KEYS.savedLocations, [
  STORAGE_KEYS.legacySavedLocations,
  STORAGE_KEYS.olderSavedLocations
], []);

let alertPrefs = {
  ...ALERT_DEFAULTS,
  ...loadWithMigrationChain(STORAGE_KEYS.alertPrefs, [
    STORAGE_KEYS.legacyAlertPrefs,
    STORAGE_KEYS.olderAlertPrefs
  ], ALERT_DEFAULTS)
};

let recentlyCleared = new Map();
let recentReportActions = new Map();
let lastReportSubmittedAt = null;

let supabaseClient = null;
let realtimeChannel = null;
let usingSupabase = false;

let clientId = getOrCreateClientId();

let crossingQualityCounts = {
  totalOfficial: 0,
  reportable: 0,
  hidden: 0,
  privateHidden: 0,
  needsReviewHidden: 0,
  closedHidden: 0,
  fallback: 0
};

let crossingSourceState = {
  mode: "loading",
  provider: FRA_CROSSING_SOURCE_LABEL,
  datasetId: FRA_CROSSING_DATASET_ID,
  loadedCount: 0,
  fallback: false,
  message: "Loading official USDOT FRA crossing data..."
};

let liveSyncState = {
  mode: "connecting",
  message: "Connecting to shared report database...",
  lastSyncAt: "",
  activeCount: 0
};

const els = {
  useLocationBtn: document.getElementById("useLocationBtn"),
  locationStatus: document.getElementById("locationStatus"),
  reportQualityStatus: document.getElementById("reportQualityStatus"),
  lastReportStatus: document.getElementById("lastReportStatus"),
  selectedCrossingName: document.getElementById("selectedCrossingName"),
  selectedCrossingMeta: document.getElementById("selectedCrossingMeta"),
  confirmBlockedBtn: document.getElementById("confirmBlockedBtn"),
  reportClearedBtn: document.getElementById("reportClearedBtn"),

  liveSyncBadge: document.getElementById("liveSyncBadge"),
  liveSyncStatus: document.getElementById("liveSyncStatus"),
  liveSyncMode: document.getElementById("liveSyncMode"),
  liveActiveCount: document.getElementById("liveActiveCount"),
  lastSyncTime: document.getElementById("lastSyncTime"),

  crossingSourceBadge: document.getElementById("crossingSourceBadge"),
  crossingSourceStatus: document.getElementById("crossingSourceStatus"),
  crossingCounts: document.getElementById("crossingCounts"),

  impactInsight: document.getElementById("impactInsight"),

  localAlertsToggle: document.getElementById("localAlertsToggle"),
  enableBrowserAlertsBtn: document.getElementById("enableBrowserAlertsBtn"),
  alertStatus: document.getElementById("alertStatus"),
  localVisualAlertStatus: document.getElementById("localVisualAlertStatus"),
  browserNotificationStatus: document.getElementById("browserNotificationStatus"),

  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  searchStatus: document.getElementById("searchStatus"),

  eventSummary: document.getElementById("eventSummary"),
  refreshReportsBtn: document.getElementById("refreshReportsBtn"),

  saveViewBtn: document.getElementById("saveViewBtn"),
  savedLocationsList: document.getElementById("savedLocationsList"),

  toastStack: document.getElementById("toastStack")
};

init().catch((error) => {
  console.error("App initialization failed:", error);
  showToast("Startup warning", "The app loaded with a recoverable startup issue.");
});

async function init() {
  initMap();
  bindUi();
  hydrateAlertUi();
  renderCrossingSourceStatus();
  renderCrossingCounts();
  renderLiveSyncStatus();

  await loadBoundary();
  await loadOfficialCrossings();

  initSupabase();
  await loadReports();

  subscribeToReports();

  renderSavedLocations();
  renderEventSummary();
  renderImpactInsight();
  refreshCrossingMarkerStyles();

  setInterval(loadReports, REPORT_REFRESH_MS);
  setInterval(() => {
    renderEventSummary();
    renderImpactInsight();
  }, 60000);
}

function initMap() {
  map = L.map("map", {
    zoomControl: true
  }).setView(currentRegion.mapCenter, currentRegion.defaultZoom);

  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors"
  });

  const cartoLight = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap &copy; CARTO"
    }
  );

  const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution: "&copy; OpenTopoMap contributors"
  });

  osm.addTo(map);

  L.control.layers(
    {
      "Street Map": osm,
      "Light Map": cartoLight,
      "Topo Map": topo
    },
    {},
    { collapsed: true }
  ).addTo(map);

  map.on("click", (e) => {
    const nearest = findNearestCrossing(e.latlng.lat, e.latlng.lng);

    if (nearest && nearest.distanceMiles <= 0.75) {
      selectCrossing(nearest.crossing.asset.assetId);
    }
  });
}

async function loadBoundary() {
  try {
    const response = await fetch(DATA_PATHS.boundary);
    if (!response.ok) throw new Error(`Boundary HTTP ${response.status}`);

    const geojson = await response.json();

    boundaryLayer = L.geoJSON(geojson, {
      style: {
        color: "#8a5a2b",
        weight: 3,
        fillColor: "#c9a66b",
        fillOpacity: 0.08
      }
    }).addTo(map);

    map.fitBounds(boundaryLayer.getBounds(), {
      padding: [20, 20]
    });
  } catch (error) {
    console.error("Boundary load failed:", error);
    showToast("Boundary warning", "The Liberty County boundary file did not load.");
  }
}

function buildFraCrossingsUrl(regionFilter) {
  const params = new URLSearchParams({
    "$limit": "5000",
    statename: regionFilter.statename,
    countyname: regionFilter.countyname
  });

  return `${FRA_BASE_URL}?${params.toString()}`;
}

async function loadOfficialCrossings() {
  setCrossingSourceState({
    mode: "loading",
    loadedCount: 0,
    fallback: false,
    message: "Loading official USDOT FRA crossing data..."
  });

  try {
    const url = buildFraCrossingsUrl(currentRegion.fraFilter);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`FRA crossing data failed: ${response.status}`);
    }

    const geojson = await response.json();
    const normalized = normalizeFraCrossings(geojson);

    allOfficialCrossings = normalized.allCrossings;
    hiddenOfficialCrossings = normalized.hiddenCrossings;
    crossings = normalized.reportableCrossings;
    crossingQualityCounts = normalized.counts;

    if (!crossings.length) {
      throw new Error("No open FRA crossings returned after filtering.");
    }

    setCrossingSourceState({
      mode: "official",
      loadedCount: crossings.length,
      fallback: false,
      message: `${crossings.length} open FRA crossings shown for ${currentRegion.label}.`
    });

    renderCrossingMarkers();
    renderCrossingCounts();

    showToast(
      "Official crossings loaded",
      `${crossings.length} open FRA crossings shown.`
    );
  } catch (error) {
    console.error("Official crossing load failed:", error);

    setCrossingSourceState({
      mode: "fallback",
      loadedCount: 0,
      fallback: true,
      message: "Official FRA data could not be loaded. Trying local fallback crossing file."
    });

    await loadFallbackCrossings();
  }
}

async function loadFallbackCrossings() {
  try {
    const response = await fetch(DATA_PATHS.legacyCrossings);
    if (!response.ok) throw new Error(`Fallback crossings HTTP ${response.status}`);

    const geojson = await response.json();
    crossings = normalizeLegacyCrossings(geojson);

    if (!crossings.length) {
      throw new Error("No fallback crossings returned after filtering.");
    }

    crossingQualityCounts = {
      totalOfficial: 0,
      reportable: crossings.length,
      hidden: 0,
      privateHidden: 0,
      needsReviewHidden: 0,
      closedHidden: 0,
      fallback: crossings.length
    };

    setCrossingSourceState({
      mode: "fallback",
      loadedCount: crossings.length,
      fallback: true,
      message: `${crossings.length} local fallback crossings loaded. Official FRA data is unavailable.`
    });

    renderCrossingMarkers();
    renderCrossingCounts();

    showToast(
      "Crossing fallback loaded",
      "Using local crossing file because official FRA data did not load."
    );
  } catch (error) {
    console.error("Fallback crossing load failed:", error);

    crossings = getFallbackCrossings();

    crossingQualityCounts = {
      totalOfficial: 0,
      reportable: crossings.length,
      hidden: 0,
      privateHidden: 0,
      needsReviewHidden: 0,
      closedHidden: 0,
      fallback: crossings.length
    };

    setCrossingSourceState({
      mode: "fallback",
      loadedCount: crossings.length,
      fallback: true,
      message: `${crossings.length} built-in emergency fallback crossings loaded. Official FRA data is unavailable.`
    });

    renderCrossingMarkers();
    renderCrossingCounts();

    showToast(
      "Emergency fallback loaded",
      "Using built-in crossing examples because all crossing sources failed."
    );
  }
}

function renderCrossingMarkers() {
  if (crossingLayer) {
    crossingLayer.clearLayers();
  } else {
    crossingLayer = L.layerGroup().addTo(map);
  }

  crossingMarkers.clear();

  crossings.forEach((crossing) => {
    const marker = L.circleMarker([crossing.lat, crossing.lng], {
      radius: 8,
      color: "#1d4ed8",
      weight: 2,
      fillColor: "#2563eb",
      fillOpacity: 0.86
    });

    marker.bindPopup(buildCrossingPopup(crossing));
    marker.on("click", () => selectCrossing(crossing.asset.assetId));
    marker.addTo(crossingLayer);

    crossingMarkers.set(crossing.asset.assetId, marker);
  });
}

function initSupabase() {
  try {
    if (!window.supabase || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Supabase library or credentials missing.");
    }

    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

    usingSupabase = true;

    setLiveSyncState({
      mode: "connected",
      message: "Connected to shared report database."
    });
  } catch (error) {
    console.error("Supabase init failed:", error);
    usingSupabase = false;
    events = fallbackEvents;

    setLiveSyncState({
      mode: "fallback",
      message: "Shared database unavailable. Using this device only."
    });
  }
}

async function loadReports() {
  if (!usingSupabase || !supabaseClient) {
    events = fallbackEvents;
    setLiveSyncState({
      mode: "fallback",
      message: "Using device-only fallback reports.",
      activeCount: events.filter((event) => event.status === "active").length,
      lastSyncAt: new Date().toISOString()
    });
    renderEventSummary();
    renderImpactInsight();
    refreshCrossingMarkerStyles();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_REPORTS_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    events = buildEventsFromReportRows(data || []);

    setLiveSyncState({
      mode: "connected",
      message: "Shared reports loaded.",
      activeCount: events.filter((event) => event.status === "active").length,
      lastSyncAt: new Date().toISOString()
    });

    renderEventSummary();
    renderImpactInsight();
    refreshCrossingMarkerStyles();
  } catch (error) {
    console.error("Report load failed:", error);
    events = fallbackEvents;

    setLiveSyncState({
      mode: "fallback",
      message: "Shared report load failed. Using this device only.",
      activeCount: events.filter((event) => event.status === "active").length,
      lastSyncAt: new Date().toISOString()
    });

    renderEventSummary();
    renderImpactInsight();
    refreshCrossingMarkerStyles();
  }
}

function subscribeToReports() {
  if (!usingSupabase || !supabaseClient) return;

  try {
    realtimeChannel = supabaseClient
      .channel("crossing_reports_live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: SUPABASE_REPORTS_TABLE
        },
        () => {
          loadReports();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setLiveSyncState({
            mode: "live",
            message: "Live updates are active."
          });
        }
      });
  } catch (error) {
    console.error("Realtime subscription failed:", error);
  }
}

function buildEventsFromReportRows(rows) {
  const grouped = new Map();

  rows
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach((row) => {
      const crossingId = row.crossing_id;
      if (!crossingId) return;

      const crossing = findCrossingById(crossingId);

      if (!grouped.has(crossingId)) {
        grouped.set(crossingId, {
          id: `evt_${crossingId}`,
          lat: Number(row.lat || (crossing && crossing.lat) || 0),
          lng: Number(row.lng || (crossing && crossing.lng) || 0),
          region: crossing ? { ...crossing.region } : { ...REGION_DEFAULT },
          asset: crossing
            ? JSON.parse(JSON.stringify(crossing.asset))
            : {
                assetId: crossingId,
                fraCrossingId: crossingId,
                assetType: "rail_crossing",
                officialName: row.road_name || `Crossing ${crossingId}`,
                communityName: row.road_name || `Crossing ${crossingId}`,
                roadName: row.road_name || "Unknown Road",
                railroad: row.railroad || "Unknown Railroad",
                city: row.city || REGION_DEFAULT.city,
                county: row.county || REGION_DEFAULT.county,
                state: row.state || REGION_DEFAULT.state,
                country: "US",
                source: {
                  type: "official",
                  provider: FRA_CROSSING_SOURCE_LABEL,
                  datasetId: FRA_CROSSING_DATASET_ID,
                  sourceId: crossingId
                }
              },
          status: "active",
          severity: "moderate",
          impact: "moderate",
          confidence: "community",
          confidenceLabel: "Low confidence",
          firstReportedAt: row.created_at,
          lastReportedAt: row.created_at,
          createdAt: row.created_at,
          updatedAt: row.created_at,
          reportCount: 0,
          reports: [],
          impactModel: {
            version: "V5.0",
            factors: {
              reportCount: 0,
              durationMinutes: 0,
              spilloverRisk: "localized",
              routeImportance: getRouteImportance(row.road_name),
              confidenceLabel: "Low confidence"
            },
            explanation: "Moderate impact based on community report."
          },
          expansion: {
            regionId: currentRegionId,
            hierarchy: "Region → Asset → Event → Observation",
            nationalReady: true
          }
        });
      }

      const event = grouped.get(crossingId);

      event.reports.push({
        id: row.id,
        type: row.report_type,
        reportedAt: row.created_at,
        source: row.source || "community_report",
        confidence: row.confidence || "community",
        notes: row.notes || "",
        clientId: row.client_id || ""
      });

      if (row.report_type === "cleared" || row.status === "resolved") {
        event.status = "resolved";
        event.impact = "cleared";
        event.severity = "low";
        event.resolvedAt = row.resolved_at || row.created_at;
      } else {
        event.status = "active";
        event.lastReportedAt = row.created_at;
        event.updatedAt = row.created_at;
      }
    });

  const built = Array.from(grouped.values()).filter((event) => {
    const latestReport = event.reports[event.reports.length - 1];
    return latestReport && latestReport.type !== "cleared" && event.status === "active";
  });

  built.forEach(applyImpactModel);

  return built;
}function findCrossingById(assetId) {
  return crossings.find((item) => item.asset.assetId === assetId) ||
    allOfficialCrossings.find((item) => item.asset.assetId === assetId) ||
    null;
}

async function submitSharedReport(type, crossing) {
  if (!usingSupabase || !supabaseClient) {
    createFallbackObservation(type, crossing);
    return;
  }

  const status = type === "cleared" ? "resolved" : "active";

  const payload = {
    crossing_id: crossing.asset.assetId,
    report_type: type,
    status,
    road_name: crossing.asset.roadName || crossing.asset.communityName || "",
    railroad: crossing.asset.railroad || "",
    city: crossing.region.city || crossing.asset.city || "",
    county: crossing.region.county || crossing.asset.county || "",
    state: crossing.region.state || crossing.asset.state || "",
    lat: crossing.lat,
    lng: crossing.lng,
    confidence: "community",
    source: "community_report",
    resolved_at: type === "cleared" ? new Date().toISOString() : null,
    client_id: clientId,
    notes: ""
  };

  const { error } = await supabaseClient
    .from(SUPABASE_REPORTS_TABLE)
    .insert(payload);

  if (error) {
    console.error("Shared report insert failed:", error);
    createFallbackObservation(type, crossing);
    setLiveSyncState({
      mode: "fallback",
      message: "Shared report failed. Saved on this device only."
    });
    throw error;
  }

  await loadReports();
}

function createFallbackObservation(type, crossing) {
  const now = new Date().toISOString();
  const assetId = crossing.asset.assetId;

  let event = fallbackEvents.find(
    (item) =>
      item.asset &&
      item.asset.assetId === assetId &&
      item.status === "active"
  );

  if (type === "blocked") {
    if (!event) {
      event = createEventRecord(crossing, now);
      fallbackEvents.push(event);
    }

    event.reports.push(makeObservation(type, now));
    event.reportCount = event.reports.filter((report) => report.type === "blocked").length;
    event.lastReportedAt = now;
    event.updatedAt = now;
    event.status = "active";

    applyImpactModel(event);
  }

  if (type === "cleared") {
    if (!event) {
      event = createEventRecord(crossing, now);
      fallbackEvents.push(event);
    }

    event.reports.push(makeObservation(type, now));
    event.status = "resolved";
    event.impact = "cleared";
    event.severity = "low";
    event.lastReportedAt = now;
    event.updatedAt = now;
    event.resolvedAt = now;
  }

  saveToStorage(STORAGE_KEYS.fallbackEvents, fallbackEvents);
  events = fallbackEvents.filter((item) => item.status === "active");
}

function bindUi() {
  els.useLocationBtn.addEventListener("click", useMyLocation);
  els.confirmBlockedBtn.addEventListener("click", () => createObservation("blocked"));
  els.reportClearedBtn.addEventListener("click", () => createObservation("cleared"));

  if (els.refreshReportsBtn) {
    els.refreshReportsBtn.addEventListener("click", loadReports);
  }

  if (els.searchBtn) {
    els.searchBtn.addEventListener("click", runSearch);
  }

  if (els.searchInput) {
    els.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runSearch();
    });
  }

  if (els.saveViewBtn) {
    els.saveViewBtn.addEventListener("click", saveCurrentView);
  }

  if (els.localAlertsToggle) {
    els.localAlertsToggle.addEventListener("change", () => {
      alertPrefs.localVisualAlerts = els.localAlertsToggle.checked;
      saveToStorage(STORAGE_KEYS.alertPrefs, alertPrefs);
      hydrateAlertUi();
    });
  }

  if (els.enableBrowserAlertsBtn) {
    els.enableBrowserAlertsBtn.addEventListener("click", requestBrowserNotifications);
  }
}

function hydrateAlertUi() {
  if (!els.localAlertsToggle) return;

  els.localAlertsToggle.checked = Boolean(alertPrefs.localVisualAlerts);

  if (els.localVisualAlertStatus) {
    els.localVisualAlertStatus.textContent = alertPrefs.localVisualAlerts ? "On" : "Off";
  }

  if (!("Notification" in window)) {
    alertPrefs.browserNotifications = false;

    if (els.alertStatus) {
      els.alertStatus.textContent =
        "Browser notifications: Not supported. Local visual alerts can still work while this page is open.";
    }

    if (els.browserNotificationStatus) {
      els.browserNotificationStatus.textContent = "Not supported";
    }

    saveToStorage(STORAGE_KEYS.alertPrefs, alertPrefs);
    return;
  }

  if (Notification.permission === "granted") {
    alertPrefs.browserNotifications = true;

    if (els.alertStatus) {
      els.alertStatus.textContent =
        "Browser notifications: Enabled for this browser. Server push alerts are a future phase.";
    }

    if (els.browserNotificationStatus) {
      els.browserNotificationStatus.textContent = "Enabled";
    }
  } else if (Notification.permission === "denied") {
    alertPrefs.browserNotifications = false;

    if (els.alertStatus) {
      els.alertStatus.textContent =
        "Browser notifications: Blocked in browser settings. Local visual alerts can still work while this page is open.";
    }

    if (els.browserNotificationStatus) {
      els.browserNotificationStatus.textContent = "Blocked";
    }
  } else {
    alertPrefs.browserNotifications = false;

    if (els.alertStatus) {
      els.alertStatus.textContent =
        "Browser notifications: Not enabled. Local visual alerts only work while this page is open.";
    }

    if (els.browserNotificationStatus) {
      els.browserNotificationStatus.textContent = "Not enabled";
    }
  }

  saveToStorage(STORAGE_KEYS.alertPrefs, alertPrefs);
}

function requestBrowserNotifications() {
  if (!("Notification" in window)) {
    if (els.alertStatus) {
      els.alertStatus.textContent =
        "Browser notifications are not supported in this browser.";
    }

    hydrateAlertUi();
    return;
  }

  Notification.requestPermission().then((permission) => {
    if (permission === "granted") {
      alertPrefs.browserNotifications = true;
      showToast(
        "Browser notifications enabled",
        "This browser can now show local rail blockage notices while allowed by the browser."
      );
    } else if (permission === "denied") {
      alertPrefs.browserNotifications = false;
      showToast(
        "Browser notifications blocked",
        "You can still use local visual alerts while the page is open."
      );
    } else {
      alertPrefs.browserNotifications = false;
    }

    saveToStorage(STORAGE_KEYS.alertPrefs, alertPrefs);
    hydrateAlertUi();
  });
}

function useMyLocation() {
  if (!navigator.geolocation) {
    els.locationStatus.textContent = "Geolocation is not supported in this browser.";
    return;
  }

  els.locationStatus.textContent = "Finding your location...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (!isValidCoordinate(lat, lng)) {
        els.locationStatus.textContent = "Invalid location received.";
        return;
      }

      const latlng = [lat, lng];

      if (userLocationMarker) {
        userLocationMarker.setLatLng(latlng);
      } else {
        userLocationMarker = L.circleMarker(latlng, {
          radius: 9,
          color: "#166534",
          weight: 3,
          fillColor: "#22c55e",
          fillOpacity: 0.88
        }).addTo(map);
      }

      userLocationMarker.bindPopup("<strong>Your Location</strong>").openPopup();
      map.setView(latlng, 15);

      const nearest = findNearestCrossing(lat, lng);

      if (!nearest) {
        els.locationStatus.textContent = "Location found, but no FRA crossings are loaded.";
        return;
      }

      selectCrossing(nearest.crossing.asset.assetId);

      els.locationStatus.textContent =
        `Nearest crossing selected: ${nearest.crossing.asset.communityName} ` +
        `(${nearest.distanceMiles.toFixed(2)} mi away).`;
    },
    (error) => {
      els.locationStatus.textContent = getLocationErrorMessage(error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    }
  );
}

function getLocationErrorMessage(error) {
  if (!error) return "Unable to get location.";
  if (error.code === 1) return "Location permission denied.";
  if (error.code === 2) return "Location unavailable.";
  if (error.code === 3) return "Location request timed out.";
  return "Unable to get location.";
}

function selectCrossing(assetId) {
  const crossing = findCrossingById(assetId);
  if (!crossing) return;

  selectedCrossing = crossing;

  els.selectedCrossingName.textContent = crossing.asset.communityName;
  els.selectedCrossingMeta.textContent =
    `${crossing.asset.roadName} • ${crossing.region.city}, ${crossing.region.state}`;

  els.confirmBlockedBtn.disabled = false;
  els.reportClearedBtn.disabled = false;

  const sourceText =
    crossing.asset.source && crossing.asset.source.type === "official"
      ? `Ready to report against official FRA Crossing ID ${crossing.asset.assetId}.`
      : `Ready to report for ${crossing.asset.communityName}.`;

  updateReportQualityStatus(sourceText);

  const marker = crossingMarkers.get(assetId);
  if (marker) {
    marker.openPopup();
    map.panTo(marker.getLatLng());
  }

  renderImpactInsight();
  refreshCrossingMarkerStyles();
}

async function createObservation(type) {
  if (!selectedCrossing) return;

  const nowMs = Date.now();
  const assetId = selectedCrossing.asset.assetId;

  if (!assetId || !isValidCoordinate(selectedCrossing.lat, selectedCrossing.lng)) {
    showToast("Report blocked", "This crossing is missing a valid asset ID or coordinate.");
    updateLastReportStatus("Report blocked because this crossing is missing valid data.", "warning");
    return;
  }

  const duplicateCheck = checkDuplicateReport(assetId, type, nowMs);

  if (!duplicateCheck.allowed) {
    updateLastReportStatus(duplicateCheck.message, "warning");
    showToast("Duplicate prevented", duplicateCheck.message);
    brieflyDisableReportButtons();
    return;
  }

  rememberReportAction(assetId, type, nowMs);
  brieflyDisableReportButtons();

  try {
    await submitSharedReport(type, selectedCrossing);

    if (type === "blocked") {
      recentlyCleared.delete(assetId);

      const event = events.find(
        (item) =>
          item.asset &&
          item.asset.assetId === assetId &&
          item.status === "active"
      );

      const statusMessage =
        `Blocked report submitted for ${selectedCrossing.asset.communityName}. ` +
        `${usingSupabase ? "Shared live with other users." : "Saved on this device only."}`;

      els.locationStatus.textContent = statusMessage;
      updateLastReportStatus(statusMessage, "success");
      showToast("Blocked report submitted", `${selectedCrossing.asset.communityName}`);
      if (event) triggerAlertsForEvent(event);
    }

    if (type === "cleared") {
      recentlyCleared.set(assetId, nowMs);

      const statusMessage =
        `Cleared report submitted for ${selectedCrossing.asset.communityName}. ` +
        `${usingSupabase ? "Shared live with other users." : "Saved on this device only."}`;

      els.locationStatus.textContent = statusMessage;
      updateLastReportStatus(statusMessage, "success");
      showToast("Crossing cleared", selectedCrossing.asset.communityName);

      setTimeout(() => {
        recentlyCleared.delete(assetId);
        refreshCrossingMarkerStyles();
        renderImpactInsight();
      }, 12000);
    }

    lastReportSubmittedAt = new Date(nowMs).toISOString();

    renderEventSummary();
    renderImpactInsight();
    refreshCrossingMarkerStyles();

    const marker = crossingMarkers.get(assetId);
    if (marker) {
      marker.setPopupContent(buildCrossingPopup(selectedCrossing));
      marker.openPopup();
    }
  } catch (error) {
    console.error(error);
    updateLastReportStatus(
      "Report could not be shared live. It was saved locally if fallback was available.",
      "warning"
    );
  }
}

function checkDuplicateReport(assetId, type, nowMs) {
  const globalLast = lastReportSubmittedAt
    ? new Date(lastReportSubmittedAt).getTime()
    : 0;

  if (globalLast && nowMs - globalLast < REPORT_COOLDOWN_MS) {
    return {
      allowed: false,
      message: "Report held for a moment to prevent accidental double-clicks."
    };
  }

  const actionKey = `${assetId}:${type}`;
  const lastSameAction = recentReportActions.get(actionKey) || 0;

  if (lastSameAction && nowMs - lastSameAction < SAME_ACTION_COOLDOWN_MS) {
    return {
      allowed: false,
      message: "Same report was just submitted. Wait a few seconds before sending it again."
    };
  }

  return {
    allowed: true,
    message: ""
  };
}

function rememberReportAction(assetId, type, nowMs) {
  recentReportActions.set(`${assetId}:${type}`, nowMs);
}

function brieflyDisableReportButtons() {
  els.confirmBlockedBtn.disabled = true;
  els.reportClearedBtn.disabled = true;

  setTimeout(() => {
    if (selectedCrossing) {
      els.confirmBlockedBtn.disabled = false;
      els.reportClearedBtn.disabled = false;
    }
  }, REPORT_COOLDOWN_MS);
}

function updateReportQualityStatus(message) {
  if (!els.reportQualityStatus) return;
  els.reportQualityStatus.textContent = message;
}

function updateLastReportStatus(message, state = "") {
  if (!els.lastReportStatus) return;

  els.lastReportStatus.textContent = message;
  els.lastReportStatus.className = "lastReportStatus";

  if (state) {
    els.lastReportStatus.classList.add(state);
  }
}

function createEventRecord(crossing, timestamp) {
  return {
    id: `evt_${crossing.asset.assetId}_${Date.now()}`,
    lat: crossing.lat,
    lng: crossing.lng,
    region: { ...crossing.region },
    asset: JSON.parse(JSON.stringify(crossing.asset)),
    dataQuality: crossing.dataQuality ? JSON.parse(JSON.stringify(crossing.dataQuality)) : {},
    status: "active",
    severity: "moderate",
    impact: "moderate",
    confidence: "community",
    confidenceLabel: "Low confidence",
    firstReportedAt: timestamp,
    lastReportedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    reportCount: 0,
    reports: [],
    impactModel: {
      version: "V5.0",
      factors: {
        reportCount: 0,
        durationMinutes: 0,
        spilloverRisk: "localized",
        routeImportance: getRouteImportance(crossing.asset.roadName),
        confidenceLabel: "Low confidence"
      },
      explanation: "Moderate impact based on initial community report."
    },
    expansion: {
      regionId: currentRegionId,
      hierarchy: "Region → Asset → Event → Observation",
      nationalReady: true
    }
  };
}

function makeObservation(type, timestamp) {
  return {
    id: `obs_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    type,
    reportedAt: timestamp,
    source: "user_report",
    confidence: "community",
    notes: "",
    submittedLabel: formatRelativeTime(timestamp),
    clientId
  };
}

function applyImpactModel(event) {
  const blockedReports = event.reports.filter((report) => report.type === "blocked").length;
  const durationMinutes = getDurationMinutes(event.firstReportedAt, event.lastReportedAt);
  const routeImportance = getRouteImportance(event.asset.roadName);
  const spilloverRisk = calculateSpilloverRisk(
    event.asset.roadName,
    blockedReports,
    durationMinutes
  );
  const confidenceLabel = getConfidenceLabel(blockedReports);

  let impact = "moderate";
  let severity = "moderate";

  if (blockedReports >= 2) {
    impact = "heavy";
    severity = "high";
  }

  if (blockedReports >= 4) {
    impact = "severe";
    severity = "high";
  }

  if (durationMinutes >= 20 && routeImportance === "major" && impact === "moderate") {
    impact = "heavy";
    severity = "high";
  }

  if (durationMinutes >= 30 && impact === "moderate") {
    impact = "heavy";
    severity = "high";
  }

  if (routeImportance === "major" && impact === "heavy" && durationMinutes >= 20) {
    impact = "severe";
    severity = "high";
  }

  if (durationMinutes >= 60 || blockedReports >= 6) {
    impact = "critical";
    severity = "critical";
  }

  event.reportCount = blockedReports;
  event.impact = impact;
  event.severity = severity;
  event.confidence = "community";
  event.confidenceLabel = confidenceLabel;
  event.impactModel = {
    version: "V5.0",
    factors: {
      reportCount: blockedReports,
      durationMinutes,
      spilloverRisk,
      routeImportance,
      confidenceLabel
    },
    explanation: buildImpactExplanation(
      impact,
      blockedReports,
      durationMinutes,
      spilloverRisk,
      routeImportance,
      confidenceLabel
    )
  };
}

function buildImpactExplanation(
  impact,
  reportCount,
  durationMinutes,
  spilloverRisk,
  routeImportance,
  confidenceLabel
) {
  const parts = [];

  parts.push(`${reportCount} blocked ${reportCount === 1 ? "report" : "reports"}`);

  if (durationMinutes > 0) {
    parts.push(`${durationMinutes} min active duration`);
  } else {
    parts.push("newly reported");
  }

  if (routeImportance === "major") {
    parts.push("major road crossing");
  } else {
    parts.push("local road crossing");
  }

  if (spilloverRisk !== "localized") {
    parts.push(`${spilloverRisk} spillover risk`);
  } else {
    parts.push("localized spillover risk");
  }

  parts.push(`${confidenceLabel.toLowerCase()}`);

  return `${capitalize(impact)} impact because of ${parts.join(", ")}.`;
}

function getConfidenceLabel(reportCount) {
  if (reportCount >= 4) return "High confidence";
  if (reportCount >= 2) return "Medium confidence";
  return "Low confidence";
}

function getRouteImportance(roadName) {
  const road = String(roadName || "").toLowerCase();

  if (
    road.includes("hwy") ||
    road.includes("highway") ||
    road.includes("us ") ||
    road.includes("fm ") ||
    road.includes("state") ||
    road.includes("interstate") ||
    road.includes("i-")
  ) {
    return "major";
  }

  return "local";
}

function calculateSpilloverRisk(roadName, reportCount, durationMinutes) {
  const routeImportance = getRouteImportance(roadName);

  if (routeImportance === "major" && (reportCount >= 4 || durationMinutes >= 30)) {
    return "regional";
  }

  if (routeImportance === "major" || reportCount >= 2 || durationMinutes >= 15) {
    return "nearby-road";
  }

  return "localized";
}

function triggerAlertsForEvent(event) {
  if (!event || event.status !== "active") return;

  const shouldAlert =
    event.impact === "severe" ||
    event.impact === "critical" ||
    event.impactModel.factors.spilloverRisk === "regional";

  if (!shouldAlert) return;

  const title = `${capitalize(event.impact)} rail blockage`;
  const message =
    `${event.asset.communityName} may affect ${event.asset.roadName}. ` +
    `${event.impactModel.explanation}`;

  if (alertPrefs.localVisualAlerts) {
    showToast(title, message);
  }

  if (
    alertPrefs.browserNotifications &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    new Notification(title, {
      body: message
    });
  }
}

function renderEventSummary() {
  if (!els.eventSummary) return;

  const activeEvents = events
    .filter((event) => event.status === "active")
    .sort((a, b) => new Date(b.lastReportedAt) - new Date(a.lastReportedAt));

  if (!activeEvents.length) {
    els.eventSummary.innerHTML = "No active reports yet.";
    updateLiveActiveCount(0);
    return;
  }

  updateLiveActiveCount(activeEvents.length);

  els.eventSummary.innerHTML = activeEvents.map((event) => {
    applyImpactModel(event);

    const duration = formatDuration(event.firstReportedAt, new Date().toISOString());
    const reportLabel = event.reportCount === 1 ? "report" : "reports";
    const explanation = event.impactModel && event.impactModel.explanation
      ? event.impactModel.explanation
      : "";
    const sourceId =
      event.asset && event.asset.source && event.asset.source.sourceId
        ? event.asset.source.sourceId
        : event.asset.assetId;

    return `
      <article class="eventCard liveEvent">
        <div class="eventCardHeader">
          <h3>${escapeHtml(event.asset.communityName)}</h3>
          <span class="pill ${escapeHtml(event.impact)}">${escapeHtml(event.impact)}</span>
        </div>

        <div class="eventMeta">
          <div><strong>${event.reportCount}</strong> ${reportLabel}</div>
          <div>Road: ${escapeHtml(event.asset.roadName)}</div>
          <div>DOT/FRA ID: ${escapeHtml(sourceId)}</div>
          <div>Sync: ${usingSupabase ? "Shared live" : "Device only"}</div>
          <div>Duration: ${duration}</div>
          <div>Age: ${escapeHtml(formatRelativeTime(event.firstReportedAt))}</div>
          <div>Spillover: ${escapeHtml(event.impactModel.factors.spilloverRisk)}</div>
          <div>Confidence: ${escapeHtml(event.confidenceLabel)}</div>
          <div>Why: ${escapeHtml(explanation)}</div>

          <div class="eventTimeGrid">
            <div class="eventTimeBox">
              <span>First reported</span>
              <strong>${escapeHtml(formatClockTime(event.firstReportedAt))}</strong>
            </div>
            <div class="eventTimeBox">
              <span>Last report</span>
              <strong>${escapeHtml(formatClockTime(event.lastReportedAt))}</strong>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderImpactInsight() {
  if (!els.impactInsight) return;

  if (!selectedCrossing) {
    els.impactInsight.innerHTML = "No crossing selected.";
    return;
  }

  const event = events.find(
    (item) =>
      item.asset &&
      item.asset.assetId === selectedCrossing.asset.assetId &&
      item.status === "active"
  );

  const wasRecentlyCleared = recentlyCleared.has(selectedCrossing.asset.assetId);

  if (wasRecentlyCleared) {
    const clearedAt = recentlyCleared.get(selectedCrossing.asset.assetId);

    els.impactInsight.innerHTML = `
      <div class="impactTitle">
        <strong>${escapeHtml(selectedCrossing.asset.communityName)}</strong>
        <span class="pill cleared">Cleared</span>
      </div>

      <div class="impactExplanation">
        <strong>Result</strong>
        This crossing was recently marked cleared ${escapeHtml(formatRelativeTime(new Date(clearedAt).toISOString()))}. Shared active impact has been removed.
      </div>
    `;
    return;
  }

  if (!event) {
    const routeImportance = getRouteImportance(selectedCrossing.asset.roadName);
    const sourceId =
      selectedCrossing.asset.source && selectedCrossing.asset.source.sourceId
        ? selectedCrossing.asset.source.sourceId
        : selectedCrossing.asset.assetId;

    els.impactInsight.innerHTML = `
      <div class="impactTitle">
        <strong>${escapeHtml(selectedCrossing.asset.communityName)}</strong>
        <span class="pill ready">Ready</span>
      </div>

      No active shared blockage reported.

      <div class="impactExplanation">
        <strong>Why this status?</strong>
        No active shared event exists for this crossing. Reporting will attach to asset ID ${escapeHtml(sourceId)}.
      </div>

      <div class="impactDetails">
        <div class="metricBox">
          <span>Road Type</span>
          <strong>${escapeHtml(routeImportance)}</strong>
        </div>
        <div class="metricBox">
          <span>Quality</span>
          <strong>${escapeHtml(selectedCrossing.dataQuality.status)}</strong>
        </div>
        <div class="metricBox">
          <span>Sync</span>
          <strong>${usingSupabase ? "Shared live" : "Device only"}</strong>
        </div>
        <div class="metricBox">
          <span>DOT/FRA ID</span>
          <strong>${escapeHtml(sourceId)}</strong>
        </div>
      </div>
    `;
    return;
  }

  applyImpactModel(event);

  els.impactInsight.innerHTML = `
    <div class="impactTitle">
      <strong>${escapeHtml(event.asset.communityName)}</strong>
      <span class="pill ${escapeHtml(event.impact)}">${escapeHtml(event.impact)}</span>
    </div>

    <div class="impactExplanation">
      <strong>Why this impact?</strong>
      ${escapeHtml(event.impactModel.explanation)}
    </div>

    <div class="impactDetails">
      <div class="metricBox">
        <span>Reports</span>
        <strong>${event.reportCount}</strong>
      </div>
      <div class="metricBox">
        <span>Sync</span>
        <strong>${usingSupabase ? "Shared live" : "Device only"}</strong>
      </div>
      <div class="metricBox">
        <span>Duration</span>
        <strong>${formatDuration(event.firstReportedAt, new Date().toISOString())}</strong>
      </div>
      <div class="metricBox">
        <span>Last Report</span>
        <strong>${escapeHtml(formatRelativeTime(event.lastReportedAt))}</strong>
      </div>
      <div class="metricBox">
        <span>Route</span>
        <strong>${escapeHtml(event.impactModel.factors.routeImportance)}</strong>
      </div>
      <div class="metricBox">
        <span>Spillover</span>
        <strong>${escapeHtml(event.impactModel.factors.spilloverRisk)}</strong>
      </div>
      <div class="metricBox">
        <span>Confidence</span>
        <strong>${escapeHtml(event.confidenceLabel)}</strong>
      </div>
      <div class="metricBox">
        <span>Model</span>
        <strong>${escapeHtml(event.impactModel.version)}</strong>
      </div>
    </div>
  `;
}

function refreshCrossingMarkerStyles() {
  crossingMarkers.forEach((marker, assetId) => {
    const activeEvent = events.find(
      (event) =>
        event.asset &&
        event.asset.assetId === assetId &&
        event.status === "active"
    );

    const isSelected =
      selectedCrossing &&
      selectedCrossing.asset.assetId === assetId;

    const wasRecentlyCleared = recentlyCleared.has(assetId);

    if (activeEvent) {
      applyImpactModel(activeEvent);

      const color = getImpactColor(activeEvent.impact);

      marker.setStyle({
        radius: isSelected ? 13 : 10,
        color: color.stroke,
        fillColor: color.fill,
        fillOpacity: 0.92,
        weight: isSelected ? 4 : 3,
        className: ""
      });
    } else if (wasRecentlyCleared) {
      marker.setStyle({
        radius: 12,
        color: "#14532d",
        fillColor: "#22c55e",
        fillOpacity: 0.94,
        weight: 4,
        className: "clearedPulse"
      });
    } else {
      marker.setStyle({
        radius: isSelected ? 10 : 8,
        color: isSelected ? "#5f3c1d" : "#1d4ed8",
        fillColor: isSelected ? "#f59e0b" : "#2563eb",
        fillOpacity: 0.86,
        weight: isSelected ? 3 : 2,
        className: ""
      });
    }

    const crossing = findCrossingById(assetId);

    if (crossing) {
      marker.setPopupContent(buildCrossingPopup(crossing));
    }
  });
}

function getImpactColor(impact) {
  if (impact === "critical") {
    return { stroke: "#4c1d95", fill: "#7c3aed" };
  }

  if (impact === "severe") {
    return { stroke: "#991b1b", fill: "#ef4444" };
  }

  if (impact === "heavy") {
    return { stroke: "#9a3412", fill: "#f97316" };
  }

  return { stroke: "#92400e", fill: "#f59e0b" };
}

function buildCrossingPopup(crossing) {
  const activeEvent = events.find(
    (event) =>
      event.asset &&
      event.asset.assetId === crossing.asset.assetId &&
      event.status === "active"
  );

  const wasRecentlyCleared = recentlyCleared.has(crossing.asset.assetId);
  const source = crossing.asset.source || {};
  const sourceId = source.sourceId || crossing.asset.assetId;

  let statusHtml = `<p><strong>Status:</strong> No active shared blockage</p>`;

  if (activeEvent) {
    applyImpactModel(activeEvent);

    statusHtml = `
      <p><strong>Status:</strong> Active shared blockage</p>
      <p><strong>Impact:</strong> ${escapeHtml(activeEvent.impact)}</p>
      <p><strong>Reports:</strong> ${activeEvent.reportCount}</p>
      <p><strong>Age:</strong> ${escapeHtml(formatRelativeTime(activeEvent.firstReportedAt))}</p>
      <p><strong>Confidence:</strong> ${escapeHtml(activeEvent.confidenceLabel)}</p>
      <p><strong>Spillover:</strong> ${escapeHtml(activeEvent.impactModel.factors.spilloverRisk)}</p>
    `;
  }

  if (wasRecentlyCleared) {
    statusHtml = `
      <p><strong>Status:</strong> Recently cleared</p>
      <p><strong>Result:</strong> Shared blockage resolved</p>
    `;
  }

  return `
    <div class="crossingPopup">
      <h3>${escapeHtml(crossing.asset.communityName)}</h3>
      <p><strong>DOT/FRA ID:</strong> ${escapeHtml(sourceId)}</p>
      <p><strong>Official:</strong> ${escapeHtml(crossing.asset.officialName)}</p>
      <p><strong>Road:</strong> ${escapeHtml(crossing.asset.roadName)}</p>
      <p><strong>Railroad:</strong> ${escapeHtml(crossing.asset.railroad || "N/A")}</p>
      <p><strong>City:</strong> ${escapeHtml(crossing.region.city || "N/A")}</p>
      <p><strong>County:</strong> ${escapeHtml(crossing.region.county || "N/A")}</p>
      <p><strong>State:</strong> ${escapeHtml(crossing.region.state || "N/A")}</p>
      <p><strong>Crossing Type:</strong> ${escapeHtml(crossing.asset.crossingType || "N/A")}</p>
      <p><strong>Public/Private:</strong> ${escapeHtml(crossing.asset.publicPrivate || "N/A")}</p>
      <p><strong>AADT:</strong> ${escapeHtml(crossing.asset.annualAverageDailyTraffic || "N/A")}</p>
      <p><strong>Quality:</strong> ${escapeHtml(crossing.dataQuality.status)} — ${escapeHtml(crossing.dataQuality.reason)}</p>
      ${statusHtml}
      <div class="popupSource">
        Source: ${escapeHtml(source.provider || "Unknown")} ${source.datasetId ? `• Dataset ${escapeHtml(source.datasetId)}` : ""}
      </div>
      <div class="popupActions">
        <button onclick="window.LCSI.selectAndReport('${escapeAttr(crossing.asset.assetId)}','blocked')">
          Blocked
        </button>
        <button onclick="window.LCSI.selectAndReport('${escapeAttr(crossing.asset.assetId)}','cleared')">
          Cleared
        </button>
      </div>
    </div>
  `;
}

function findNearestCrossing(lat, lng) {
  if (!crossings.length) return null;

  let nearest = null;

  crossings.forEach((crossing) => {
    const distanceMiles = haversineMiles(lat, lng, crossing.lat, crossing.lng);

    if (!nearest || distanceMiles < nearest.distanceMiles) {
      nearest = {
        crossing,
        distanceMiles
      };
    }
  });

  return nearest;
}

async function runSearch() {
  if (!els.searchInput || !els.searchStatus) return;

  const query = els.searchInput.value.trim();

  if (!query) {
    els.searchStatus.textContent = "Enter a place, road, or address first.";
    return;
  }

  els.searchStatus.textContent = "Searching...";

  try {
    const url =
      "https://nominatim.openstreetmap.org/search" +
      `?format=json&q=${encodeURIComponent(query + ", Liberty County, Texas")}`;

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Search HTTP ${response.status}`);
    }

    const results = await response.json();

    if (!Array.isArray(results) || results.length === 0) {
      els.searchStatus.textContent = "No search result found.";
      return;
    }

    const first = results[0];
    const lat = Number(first.lat);
    const lng = Number(first.lon);

    if (!isValidCoordinate(lat, lng)) {
      els.searchStatus.textContent = "Search returned invalid coordinates.";
      return;
    }

    map.setView([lat, lng], 15);

    const nearest = findNearestCrossing(lat, lng);

    if (nearest && nearest.distanceMiles <= 1.5) {
      selectCrossing(nearest.crossing.asset.assetId);

      els.searchStatus.textContent =
        `Nearest crossing selected: ${nearest.crossing.asset.communityName} ` +
        `(${nearest.distanceMiles.toFixed(2)} mi away).`;
    } else {
      els.searchStatus.textContent = "Search complete. No nearby crossing auto-selected.";
    }
  } catch (error) {
    console.error(error);
    els.searchStatus.textContent = "Search failed. Try again.";
  }
}

function saveCurrentView() {
  const center = map.getCenter();
  const zoom = map.getZoom();

  const item = {
    id: `view_${Date.now()}`,
    label: `Saved View ${savedLocations.length + 1}`,
    regionId: currentRegionId,
    lat: center.lat,
    lng: center.lng,
    zoom,
    savedAt: new Date().toISOString()
  };

  savedLocations.push(item);
  saveToStorage(STORAGE_KEYS.savedLocations, savedLocations);
  renderSavedLocations();
}

function renderSavedLocations() {
  if (!els.savedLocationsList) return;

  if (!savedLocations.length) {
    els.savedLocationsList.innerHTML = `<div class="muted">No saved locations yet.</div>`;
    return;
  }

  els.savedLocationsList.innerHTML = savedLocations.map((item) => `
    <div class="savedItem">
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <div class="muted smallText">${Number(item.lat).toFixed(4)}, ${Number(item.lng).toFixed(4)}</div>
      </div>
      <button onclick="window.LCSI.goToSavedLocation('${escapeAttr(item.id)}')">Go</button>
    </div>
  `).join("");
}

function goToSavedLocation(id) {
  const item = savedLocations.find((location) => location.id === id);

  if (!item) return;

  map.setView([item.lat, item.lng], item.zoom || 14);
}

function normalizeFraCrossings(geojson) {
  const counts = {
    totalOfficial: 0,
    reportable: 0,
    hidden: 0,
    privateHidden: 0,
    needsReviewHidden: 0,
    closedHidden: 0,
    fallback: 0
  };

  if (!geojson || !Array.isArray(geojson.features)) {
    return {
      allCrossings: [],
      reportableCrossings: [],
      hiddenCrossings: [],
      counts
    };
  }

  const allCrossings = [];
  const reportableCrossings = [];
  const hiddenCrossings = [];

  geojson.features.forEach((feature, index) => {
    counts.totalOfficial += 1;

    const crossing = normalizeFraFeature(feature, index);

    if (!crossing) {
      counts.hidden += 1;
      counts.needsReviewHidden += 1;
      return;
    }

    allCrossings.push(crossing);

    if (crossing.dataQuality.visibleByDefault) {
      reportableCrossings.push(crossing);
      counts.reportable += 1;

      if (crossing.dataQuality.status === "private_visible") {
        counts.privateHidden += 1;
      }

      if (crossing.dataQuality.status === "needs_review_visible") {
        counts.needsReviewHidden += 1;
      }
    } else {
      hiddenCrossings.push(crossing);
      counts.hidden += 1;

      if (crossing.dataQuality.status === "closed_hidden") {
        counts.closedHidden += 1;
      } else {
        counts.needsReviewHidden += 1;
      }
    }
  });

  return {
    allCrossings,
    reportableCrossings,
    hiddenCrossings,
    counts
  };
}

function normalizeFraFeature(feature, index) {
  const p = feature.properties || {};
  const coords = feature.geometry && feature.geometry.coordinates;

  if (!coords || coords.length < 2) return null;

  const lng = Number(coords[0]);
  const lat = Number(coords[1]);

  if (!isValidCoordinate(lat, lng)) return null;

  const crossingId = cleanText(
    p.crossingid ||
    p.crossing_id ||
    p.crossingnumber ||
    p.dotnumber ||
    p.crossing ||
    `FRA-${String(index + 1).padStart(5, "0")}`
  );

  if (!crossingId) return null;

  const roadName = cleanText(
    p.highwayname ||
    p.street ||
    p.roadname ||
    p.road ||
    p.streetname ||
    p.crossingstreet ||
    "Unknown Road"
  );

  const railroadName = cleanText(
    p.railroadname ||
    p.railroad ||
    p.railroadcompany ||
    p.rrname ||
    "Unknown Railroad"
  );

  const cityName = cleanText(p.cityname || p.city || currentRegion.defaultCity);
  const countyName = cleanText(p.countyname || p.county || currentRegion.county);
  const stateName = cleanText(p.statename || p.state || currentRegion.state);

  const crossingType = cleanText(
    p.crossingtype ||
    p.crossing_type ||
    p.type ||
    "N/A"
  );

  const publicPrivate = cleanText(
    p.publicprivate ||
    p.public_private ||
    p.publicorprivate ||
    p.public_private_indicator ||
    "N/A"
  );

  const aadt = cleanText(
    p.annualaveragedailytrafficcount ||
    p.aadt ||
    p.trafficcount ||
    "N/A"
  );

  const closedValue = cleanText(
    p.crossingclosed ||
    p.crossing_closed ||
    p.closed ||
    ""
  );

  const classification = classifyFraCrossing({
    roadName,
    publicPrivate,
    closedValue,
    crossingType
  });

  const officialName =
    roadName && roadName !== "Unknown Road"
      ? `${roadName} Crossing`
      : `FRA Crossing ${crossingId}`;

  return {
    id: crossingId,
    lat,
    lng,
    region: {
      country: "US",
      state: stateName,
      county: countyName,
      city: cityName
    },
    asset: {
      assetId: crossingId,
      fraCrossingId: crossingId,
      assetType: "rail_crossing",
      officialName,
      communityName: officialName,
      roadName,
      railroad: railroadName,
      city: cityName,
      county: countyName,
      state: stateName,
      country: "US",
      crossingType,
      publicPrivate,
      annualAverageDailyTraffic: aadt,
      crossingClosed: closedValue,
      source: {
        type: "official",
        provider: FRA_CROSSING_SOURCE_LABEL,
        datasetId: FRA_CROSSING_DATASET_ID,
        sourceId: crossingId
      }
    },
    dataQuality: {
      status: classification.status,
      reason: classification.reason,
      reportable: classification.reportable,
      visibleByDefault: classification.visibleByDefault,
      coordinateSource: "FRA",
      reviewedByLocalUser: false,
      lastReviewedAt: ""
    },
    expansion: {
      regionId: currentRegionId,
      scaleReady: true,
      hierarchy: "Region → Asset → Event → Observation"
    }
  };
}

function classifyFraCrossing({ roadName, publicPrivate, closedValue }) {
  const road = normalizeForClassification(roadName);
  const access = normalizeForClassification(publicPrivate);
  const closed = normalizeForClassification(closedValue);

  if (
    closed === "yes" ||
    closed === "y" ||
    closed === "true" ||
    closed === "closed"
  ) {
    return {
      status: "closed_hidden",
      reportable: false,
      visibleByDefault: false,
      reason: "Crossing marked closed"
    };
  }

  const isPrivate =
    access.includes("private") ||
    access === "p" ||
    access === "priv" ||
    road.includes("private");

  const weakRoadName =
    !road ||
    road === "unknown road" ||
    road === "unknown" ||
    road === "n/a" ||
    road === "na" ||
    road === "none" ||
    road === "st 0000" ||
    road === "street 0000" ||
    /^st\s*0+$/i.test(road) ||
    /^street\s*0+$/i.test(road) ||
    /^rd\s*0+$/i.test(road) ||
    /^road\s*0+$/i.test(road);

  if (isPrivate) {
    return {
      status: "private_visible",
      reportable: true,
      visibleByDefault: true,
      reason: "Private crossing shown for map completeness"
    };
  }

  if (weakRoadName) {
    return {
      status: "needs_review_visible",
      reportable: true,
      visibleByDefault: true,
      reason: "Weak road name but shown for map completeness"
    };
  }

  return {
    status: "reportable_public",
    reportable: true,
    visibleByDefault: true,
    reason: "Open crossing with usable road name"
  };
}

function normalizeForClassification(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLegacyCrossings(geojson) {
  if (!geojson || !Array.isArray(geojson.features)) {
    return [];
  }

  return geojson.features
    .map((feature, index) => {
      const coords = feature.geometry && feature.geometry.coordinates;
      if (!coords || coords.length < 2) return null;

      const lng = Number(coords[0]);
      const lat = Number(coords[1]);

      if (!isValidCoordinate(lat, lng)) return null;

      const p = feature.properties || {};
      const assetId = cleanText(
        p.assetId ||
        p.id ||
        p.crossingId ||
        p.name ||
        `LC-${String(index + 1).padStart(3, "0")}`
      );

      if (!assetId) return null;

      const officialName = cleanText(
        p.officialName ||
        p.name ||
        p.crossingName ||
        p.roadName ||
        `Crossing ${assetId}`
      );

      const communityName = cleanText(
        p.communityName ||
        p.nickname ||
        p.localName ||
        officialName
      );

      return {
        id: assetId,
        lat,
        lng,
        region: normalizeRegion(p),
        asset: {
          assetId,
          assetType: "rail_crossing",
          officialName,
          communityName,
          roadName: cleanText(p.roadName || p.road || officialName),
          railroad: cleanText(p.railroad || p.railroadName || "Unknown Railroad"),
          city: cleanText(p.city || currentRegion.defaultCity),
          county: cleanText(p.county || currentRegion.county),
          state: cleanText(p.state || currentRegion.state),
          country: cleanText(p.country || currentRegion.country),
          crossingType: cleanText(p.crossingType || "N/A"),
          publicPrivate: cleanText(p.publicPrivate || "N/A"),
          annualAverageDailyTraffic: cleanText(p.annualAverageDailyTraffic || "N/A"),
          source: {
            type: cleanText(p.sourceType || "local_fallback"),
            provider: cleanText(p.provider || "liberty-county-map"),
            sourceId: cleanText(p.sourceId || assetId)
          }
        },
        dataQuality: {
          status: "fallback_local",
          reason: "Local fallback record",
          reportable: true,
          visibleByDefault: true,
          coordinateSource: "local",
          reviewedByLocalUser: false,
          lastReviewedAt: ""
        },
        expansion: {
          regionId: currentRegionId,
          scaleReady: true,
          hierarchy: "Region → Asset → Event → Observation"
        }
      };
    })
    .filter(Boolean);
}

function normalizeRegion(properties = {}) {
  return {
    country: cleanText(properties.country || currentRegion.country),
    state: cleanText(properties.state || currentRegion.state),
    county: cleanText(properties.county || currentRegion.county),
    city: cleanText(properties.city || currentRegion.defaultCity)
  };
}

function getFallbackCrossings() {
  return [
    makeCrossing("LC-001", 30.0479, -94.8857, "Hwy 90 Crossing", "The Damn Dayton Train", "US Hwy 90"),
    makeCrossing("LC-002", 30.0465, -94.8892, "N Winfree St Crossing", "N Winfree St Crossing", "N Winfree St"),
    makeCrossing("LC-003", 30.0442, -94.8874, "W Clayton St Crossing", "W Clayton St Crossing", "W Clayton St"),
    makeCrossing("LC-004", 30.0928, -94.8664, "CR 676 Crossing", "CR 676 Crossing", "CR 676"),
    makeCrossing("LC-005", 30.0305, -94.7938, "FM 1960 Crossing", "FM 1960 Crossing", "FM 1960")
  ];
}

function makeCrossing(assetId, lat, lng, officialName, communityName, roadName) {
  return {
    id: assetId,
    lat,
    lng,
    region: { ...REGION_DEFAULT },
    asset: {
      assetId,
      assetType: "rail_crossing",
      officialName,
      communityName,
      roadName,
      railroad: "Unknown Railroad",
      city: REGION_DEFAULT.city,
      county: REGION_DEFAULT.county,
      state: REGION_DEFAULT.state,
      country: REGION_DEFAULT.country,
      crossingType: "N/A",
      publicPrivate: "N/A",
      annualAverageDailyTraffic: "N/A",
      source: {
        type: "emergency_fallback",
        provider: "liberty-county-map",
        sourceId: assetId
      }
    },
    dataQuality: {
      status: "emergency_fallback",
      reason: "Built-in fallback record",
      reportable: true,
      visibleByDefault: true,
      coordinateSource: "built_in",
      reviewedByLocalUser: false,
      lastReviewedAt: ""
    },
    expansion: {
      regionId: currentRegionId,
      scaleReady: true,
      hierarchy: "Region → Asset → Event → Observation"
    }
  };
}

function setCrossingSourceState(nextState) {
  crossingSourceState = {
    ...crossingSourceState,
    ...nextState
  };

  renderCrossingSourceStatus();
}

function renderCrossingSourceStatus() {
  if (!els.crossingSourceStatus || !els.crossingSourceBadge) return;

  els.crossingSourceBadge.className = "miniBadge";

  if (crossingSourceState.mode === "official") {
    els.crossingSourceBadge.textContent = "Official";
    els.crossingSourceBadge.classList.add("good");
    els.crossingSourceStatus.className = "sourceStatusBox good";
  } else if (crossingSourceState.mode === "fallback") {
    els.crossingSourceBadge.textContent = "Fallback";
    els.crossingSourceBadge.classList.add("warn");
    els.crossingSourceStatus.className = "sourceStatusBox warn";
  } else if (crossingSourceState.mode === "error") {
    els.crossingSourceBadge.textContent = "Error";
    els.crossingSourceBadge.classList.add("error");
    els.crossingSourceStatus.className = "sourceStatusBox error";
  } else {
    els.crossingSourceBadge.textContent = "Loading";
    els.crossingSourceStatus.className = "sourceStatusBox";
  }

  els.crossingSourceStatus.innerHTML = `
    <strong>${escapeHtml(crossingSourceState.message)}</strong><br>
    Provider: ${escapeHtml(crossingSourceState.provider)}<br>
    Dataset ID: ${escapeHtml(crossingSourceState.datasetId)}<br>
    Crossings shown: ${Number(crossingSourceState.loadedCount || 0)}
  `;
}

function renderCrossingCounts() {
  if (!els.crossingCounts) return;

  els.crossingCounts.innerHTML = `
    <strong>Crossing quality labels</strong><br>
    Official records loaded: ${Number(crossingQualityCounts.totalOfficial || 0)}<br>
    Open crossings shown: ${Number(crossingQualityCounts.reportable || 0)}<br>
    Hidden closed/invalid: ${Number(crossingQualityCounts.hidden || 0)}<br>
    Private shown/labeled: ${Number(crossingQualityCounts.privateHidden || 0)}<br>
    Needs review shown/labeled: ${Number(crossingQualityCounts.needsReviewHidden || 0)}<br>
    Closed hidden: ${Number(crossingQualityCounts.closedHidden || 0)}
  `;
}

function setLiveSyncState(nextState) {
  liveSyncState = {
    ...liveSyncState,
    ...nextState
  };

  renderLiveSyncStatus();
}

function renderLiveSyncStatus() {
  if (!els.liveSyncStatus || !els.liveSyncBadge) return;

  els.liveSyncBadge.className = "miniBadge";

  if (liveSyncState.mode === "live") {
    els.liveSyncBadge.textContent = "Live";
    els.liveSyncBadge.classList.add("live");
    els.liveSyncStatus.className = "sourceStatusBox live";
  } else if (liveSyncState.mode === "connected") {
    els.liveSyncBadge.textContent = "Shared";
    els.liveSyncBadge.classList.add("good");
    els.liveSyncStatus.className = "sourceStatusBox good";
  } else if (liveSyncState.mode === "fallback") {
    els.liveSyncBadge.textContent = "Device Only";
    els.liveSyncBadge.classList.add("warn");
    els.liveSyncStatus.className = "sourceStatusBox warn";
  } else {
    els.liveSyncBadge.textContent = "Connecting";
    els.liveSyncStatus.className = "sourceStatusBox";
  }

  els.liveSyncStatus.innerHTML = `
    <strong>${escapeHtml(liveSyncState.message)}</strong><br>
    Reports are stored in ${usingSupabase ? "Supabase shared database" : "this browser only"}.<br>
    Last sync: ${liveSyncState.lastSyncAt ? escapeHtml(formatClockTime(liveSyncState.lastSyncAt)) : "Not yet"}
  `;

  if (els.liveSyncMode) {
    els.liveSyncMode.textContent = usingSupabase ? "Shared" : "Device only";
  }

  if (els.lastSyncTime) {
    els.lastSyncTime.textContent = liveSyncState.lastSyncAt
      ? formatClockTime(liveSyncState.lastSyncAt)
      : "Not yet";
  }

  updateLiveActiveCount(liveSyncState.activeCount || 0);
}

function updateLiveActiveCount(count) {
  liveSyncState.activeCount = count;

  if (els.liveActiveCount) {
    els.liveActiveCount.textContent = String(count);
  }
}

function getOrCreateClientId() {
  const existing = loadFromStorage(STORAGE_KEYS.clientId, null);

  if (existing) return existing;

  const created = `client_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  saveToStorage(STORAGE_KEYS.clientId, created);
  return created;
}

function showToast(title, message) {
  if (!els.toastStack) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <small>${escapeHtml(message)}</small>
  `;

  els.toastStack.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 5200);
}

function isValidCoordinate(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function getDurationMinutes(startIso, endIso) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;

  return Math.max(0, Math.round((end - start) / 60000));
}

function formatDuration(startIso, endIso) {
  const minutes = getDurationMinutes(startIso, endIso);

  if (minutes < 1) return "Less than 1 minute";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function formatRelativeTime(iso) {
  const then = new Date(iso).getTime();
  const now = Date.now();

  if (!Number.isFinite(then)) return "unknown time";

  const diffSeconds = Math.max(0, Math.round((now - then) / 1000));

  if (diffSeconds < 10) return "just now";
  if (diffSeconds < 60) return `${diffSeconds} sec ago`;

  const diffMinutes = Math.round(diffSeconds / 60);

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function formatClockTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "Unknown";
  }
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function capitalize(value) {
  const text = String(value || "");
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function cloneFallback(fallback) {
  return JSON.parse(JSON.stringify(fallback));
}

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) return cloneFallback(fallback);

    return JSON.parse(raw);
  } catch {
    return cloneFallback(fallback);
  }
}

function loadWithMigrationChain(newKey, legacyKeys, fallback) {
  const current = loadFromStorage(newKey, null);

  if (current !== null) {
    return current;
  }

  for (const key of legacyKeys) {
    const legacy = loadFromStorage(key, null);

    if (legacy !== null) {
      saveToStorage(newKey, legacy);
      return legacy;
    }
  }

  return cloneFallback(fallback);
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Unable to save ${key}:`, error);
  }
}

window.LCSI = {
  selectAndReport(assetId, type) {
    selectCrossing(assetId);
    createObservation(type);
  },

  goToSavedLocation,

  loadReports,

  getEvents() {
    return events;
  },

  getCrossings() {
    return crossings;
  },

  getAllOfficialCrossings() {
    return allOfficialCrossings;
  },

  getHiddenOfficialCrossings() {
    return hiddenOfficialCrossings;
  },

  getCrossingQualityCounts() {
    return crossingQualityCounts;
  },

  getCrossingSourceState() {
    return crossingSourceState;
  },

  getLiveSyncState() {
    return liveSyncState;
  },

  getRegions() {
    return REGIONS;
  },

  getCurrentRegion() {
    return currentRegion;
  },

  version: APP_VERSION
};