/* Liberty County Spatial Intelligence System — V4
   Pure HTML/CSS/JS + Leaflet
   Boundary file is loaded but never modified.
*/

const APP_VERSION = "4.0.0";

const DATA_PATHS = {
  boundary: "data/liberty-county-boundary.geojson",
  crossings: "data/liberty-county-rail-crossings.geojson"
};

const STORAGE_KEYS = {
  events: "lcsi_v40_events",
  savedLocations: "lcsi_v40_saved_locations",
  alertPrefs: "lcsi_v40_alert_preferences"
};

const REGION_DEFAULT = {
  country: "US",
  state: "TX",
  county: "Liberty",
  city: "Dayton"
};

const ALERT_DEFAULTS = {
  localVisualAlerts: true,
  browserNotifications: false
};

let map;
let boundaryLayer;
let crossingLayer;
let userLocationMarker;
let selectedCrossing = null;

let crossings = [];
let crossingMarkers = new Map();
let recentlyCleared = new Map();

let events = loadFromStorage(STORAGE_KEYS.events, []);
let savedLocations = loadFromStorage(STORAGE_KEYS.savedLocations, []);
let alertPrefs = loadFromStorage(STORAGE_KEYS.alertPrefs, ALERT_DEFAULTS);

const els = {
  useLocationBtn: document.getElementById("useLocationBtn"),
  locationStatus: document.getElementById("locationStatus"),
  selectedCrossingName: document.getElementById("selectedCrossingName"),
  selectedCrossingMeta: document.getElementById("selectedCrossingMeta"),
  confirmBlockedBtn: document.getElementById("confirmBlockedBtn"),
  reportClearedBtn: document.getElementById("reportClearedBtn"),

  impactInsight: document.getElementById("impactInsight"),

  localAlertsToggle: document.getElementById("localAlertsToggle"),
  enableBrowserAlertsBtn: document.getElementById("enableBrowserAlertsBtn"),
  alertStatus: document.getElementById("alertStatus"),

  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  searchStatus: document.getElementById("searchStatus"),

  eventSummary: document.getElementById("eventSummary"),
  clearEventsBtn: document.getElementById("clearEventsBtn"),

  saveViewBtn: document.getElementById("saveViewBtn"),
  savedLocationsList: document.getElementById("savedLocationsList"),

  toastStack: document.getElementById("toastStack")
};

init();

async function init() {
  initMap();
  bindUi();
  hydrateAlertUi();

  await loadBoundary();
  await loadCrossings();

  normalizeStoredEvents();

  renderSavedLocations();
  renderEventSummary();
  renderImpactInsight();
  refreshCrossingMarkerStyles();
}

function initMap() {
  map = L.map("map", {
    zoomControl: true
  }).setView([30.0466, -94.8852], 11);

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

async function loadCrossings() {
  try {
    const response = await fetch(DATA_PATHS.crossings);
    const geojson = await response.json();

    crossings = normalizeCrossings(geojson);
  } catch (error) {
    console.error("Crossing load failed:", error);
    crossings = getFallbackCrossings();
    showToast("Crossing fallback loaded", "Using built-in crossing examples because the crossing file did not load.");
  }

  crossingLayer = L.layerGroup().addTo(map);

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

function normalizeCrossings(geojson) {
  if (!geojson || !Array.isArray(geojson.features)) {
    return getFallbackCrossings();
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
        region: {
          country: cleanText(p.country || REGION_DEFAULT.country),
          state: cleanText(p.state || REGION_DEFAULT.state),
          county: cleanText(p.county || REGION_DEFAULT.county),
          city: cleanText(p.city || REGION_DEFAULT.city)
        },
        asset: {
          assetId,
          assetType: "rail_crossing",
          officialName,
          communityName,
          roadName: cleanText(p.roadName || p.road || officialName),
          railroad: cleanText(p.railroad || p.railroadName || "Unknown Railroad"),
          source: {
            type: cleanText(p.sourceType || "local"),
            provider: cleanText(p.provider || "liberty-county-map"),
            sourceId: cleanText(p.sourceId || assetId)
          }
        },
        expansion: {
          scaleReady: true,
          hierarchy: "Region → Asset → Event → Observation"
        }
      };
    })
    .filter(Boolean);
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
      source: {
        type: "local",
        provider: "liberty-county-map",
        sourceId: assetId
      }
    },
    expansion: {
      scaleReady: true,
      hierarchy: "Region → Asset → Event → Observation"
    }
  };
}

function bindUi() {
  els.useLocationBtn.addEventListener("click", useMyLocation);
  els.confirmBlockedBtn.addEventListener("click", () => createObservation("blocked"));
  els.reportClearedBtn.addEventListener("click", () => createObservation("cleared"));

  els.searchBtn.addEventListener("click", runSearch);
  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  els.saveViewBtn.addEventListener("click", saveCurrentView);
  els.clearEventsBtn.addEventListener("click", clearLocalEvents);

  els.localAlertsToggle.addEventListener("change", () => {
    alertPrefs.localVisualAlerts = els.localAlertsToggle.checked;
    saveToStorage(STORAGE_KEYS.alertPrefs, alertPrefs);
    hydrateAlertUi();
  });

  els.enableBrowserAlertsBtn.addEventListener("click", requestBrowserNotifications);
}

function hydrateAlertUi() {
  els.localAlertsToggle.checked = Boolean(alertPrefs.localVisualAlerts);

  if (!("Notification" in window)) {
    els.alertStatus.textContent = "Browser notifications are not supported in this browser.";
    return;
  }

  if (Notification.permission === "granted") {
    alertPrefs.browserNotifications = true;
    els.alertStatus.textContent = "Browser notifications enabled.";
  } else if (Notification.permission === "denied") {
    alertPrefs.browserNotifications = false;
    els.alertStatus.textContent = "Browser notifications blocked in browser settings.";
  } else {
    alertPrefs.browserNotifications = false;
    els.alertStatus.textContent = "Browser notifications not enabled.";
  }

  saveToStorage(STORAGE_KEYS.alertPrefs, alertPrefs);
}

function requestBrowserNotifications() {
  if (!("Notification" in window)) {
    els.alertStatus.textContent = "Browser notifications are not supported in this browser.";
    return;
  }

  Notification.requestPermission().then((permission) => {
    if (permission === "granted") {
      alertPrefs.browserNotifications = true;
      els.alertStatus.textContent = "Browser notifications enabled.";
      showToast("Alerts enabled", "This browser can now show local rail blockage alerts.");
    } else {
      alertPrefs.browserNotifications = false;
      els.alertStatus.textContent = "Browser notifications were not enabled.";
    }

    saveToStorage(STORAGE_KEYS.alertPrefs, alertPrefs);
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
        els.locationStatus.textContent = "Location found, but no known crossings are loaded.";
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
  const crossing = crossings.find((item) => item.asset.assetId === assetId);
  if (!crossing) return;

  selectedCrossing = crossing;

  els.selectedCrossingName.textContent = crossing.asset.communityName;
  els.selectedCrossingMeta.textContent =
    `${crossing.asset.roadName} • ${crossing.region.city}, ${crossing.region.state}`;

  els.confirmBlockedBtn.disabled = false;
  els.reportClearedBtn.disabled = false;

  const marker = crossingMarkers.get(assetId);
  if (marker) {
    marker.openPopup();
    map.panTo(marker.getLatLng());
  }

  renderImpactInsight();
  refreshCrossingMarkerStyles();
}

function createObservation(type) {
  if (!selectedCrossing) return;

  const now = new Date().toISOString();
  const assetId = selectedCrossing.asset.assetId;

  let event = events.find(
    (item) =>
      item.asset.assetId === assetId &&
      item.status === "active"
  );

  if (type === "blocked") {
    recentlyCleared.delete(assetId);

    if (!event) {
      event = createEventRecord(selectedCrossing, now);
      events.push(event);
    }

    event.reports.push(makeObservation(type, now));
    event.reportCount = event.reports.filter((report) => report.type === "blocked").length;
    event.lastReportedAt = now;

    applyImpactModel(event);

    els.locationStatus.textContent =
      `${selectedCrossing.asset.communityName} marked blocked. Impact: ${event.impact}.`;

    triggerAlertsForEvent(event);
  }

  if (type === "cleared") {
    if (!event) {
      event = createEventRecord(selectedCrossing, now);
      event.status = "resolved";
      event.severity = "low";
      event.impact = "cleared";
      event.resolvedAt = now;
      event.reports.push(makeObservation(type, now));
      events.push(event);
    } else {
      event.reports.push(makeObservation(type, now));
      event.status = "resolved";
      event.impact = "cleared";
      event.severity = "low";
      event.lastReportedAt = now;
      event.resolvedAt = now;
      event.resolution = {
        clearedBy: "community_report",
        clearedAt: now,
        method: "quick_report"
      };
    }

    recentlyCleared.set(assetId, Date.now());

    els.locationStatus.textContent =
      `${selectedCrossing.asset.communityName} marked cleared. Active event removed from summary.`;

    showToast("Crossing cleared", `${selectedCrossing.asset.communityName} is now marked recently cleared.`);

    setTimeout(() => {
      recentlyCleared.delete(assetId);
      refreshCrossingMarkerStyles();
      renderImpactInsight();
    }, 12000);
  }

  saveToStorage(STORAGE_KEYS.events, events);
  renderEventSummary();
  renderImpactInsight();
  refreshCrossingMarkerStyles();

  const marker = crossingMarkers.get(assetId);
  if (marker) {
    marker.setPopupContent(buildCrossingPopup(selectedCrossing));
    marker.openPopup();
  }
}

function createEventRecord(crossing, timestamp) {
  return {
    id: `evt_${crossing.asset.assetId}_${Date.now()}`,
    lat: crossing.lat,
    lng: crossing.lng,
    region: { ...crossing.region },
    asset: JSON.parse(JSON.stringify(crossing.asset)),
    status: "active",
    severity: "moderate",
    impact: "moderate",
    confidence: "community",
    firstReportedAt: timestamp,
    lastReportedAt: timestamp,
    reportCount: 0,
    reports: [],
    impactModel: {
      version: "V4",
      factors: {
        reportCount: 0,
        durationMinutes: 0,
        spilloverRisk: "localized",
        routeImportance: getRouteImportance(crossing.asset.roadName)
      }
    },
    expansion: {
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
    notes: ""
  };
}

function applyImpactModel(event) {
  const blockedReports = event.reports.filter((report) => report.type === "blocked").length;
  const durationMinutes = getDurationMinutes(event.firstReportedAt, event.lastReportedAt);
  const routeImportance = getRouteImportance(event.asset.roadName);
  const spilloverRisk = calculateSpilloverRisk(event.asset.roadName, blockedReports, durationMinutes);

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

  if (durationMinutes >= 30 && impact === "moderate") {
    impact = "heavy";
    severity = "high";
  }

  if (durationMinutes >= 60 || blockedReports >= 6) {
    impact = "critical";
    severity = "critical";
  }

  if (routeImportance === "major" && impact === "heavy" && durationMinutes >= 20) {
    impact = "severe";
    severity = "high";
  }

  event.reportCount = blockedReports;
  event.impact = impact;
  event.severity = severity;
  event.impactModel = {
    version: "V4",
    factors: {
      reportCount: blockedReports,
      durationMinutes,
      spilloverRisk,
      routeImportance
    },
    explanation: buildImpactExplanation(impact, blockedReports, durationMinutes, spilloverRisk, routeImportance)
  };
}

function buildImpactExplanation(impact, reportCount, durationMinutes, spilloverRisk, routeImportance) {
  const parts = [];

  parts.push(`${reportCount} blocked ${reportCount === 1 ? "report" : "reports"}`);

  if (durationMinutes > 0) {
    parts.push(`${durationMinutes} min duration`);
  }

  if (routeImportance === "major") {
    parts.push("major road crossing");
  }

  if (spilloverRisk !== "localized") {
    parts.push(`${spilloverRisk} spillover risk`);
  }

  return `${capitalize(impact)} impact based on ${parts.join(", ")}.`;
}

function getRouteImportance(roadName) {
  const road = String(roadName || "").toLowerCase();

  if (
    road.includes("hwy") ||
    road.includes("highway") ||
    road.includes("us ") ||
    road.includes("fm ") ||
    road.includes("state")
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
  const activeEvents = events
    .filter((event) => event.status === "active")
    .sort((a, b) => new Date(b.lastReportedAt) - new Date(a.lastReportedAt));

  if (!activeEvents.length) {
    els.eventSummary.innerHTML = "No active reports yet.";
    return;
  }

  els.eventSummary.innerHTML = activeEvents.map((event) => {
    applyImpactModel(event);

    const duration = formatDuration(event.firstReportedAt, new Date().toISOString());
    const reportLabel = event.reportCount === 1 ? "report" : "reports";
    const explanation = event.impactModel && event.impactModel.explanation
      ? event.impactModel.explanation
      : "";

    return `
      <article class="eventCard">
        <div class="eventCardHeader">
          <h3>${escapeHtml(event.asset.communityName)}</h3>
          <span class="pill ${escapeHtml(event.impact)}">${escapeHtml(event.impact)}</span>
        </div>

        <div class="eventMeta">
          <div><strong>${event.reportCount}</strong> ${reportLabel}</div>
          <div>Duration: ${duration}</div>
          <div>Road: ${escapeHtml(event.asset.roadName)}</div>
          <div>Spillover: ${escapeHtml(event.impactModel.factors.spilloverRisk)}</div>
          <div>${escapeHtml(explanation)}</div>
          <div>Last report: ${formatTime(event.lastReportedAt)}</div>
        </div>
      </article>
    `;
  }).join("");

  saveToStorage(STORAGE_KEYS.events, events);
}

function renderImpactInsight() {
  if (!selectedCrossing) {
    els.impactInsight.innerHTML = "No current crossing selected.";
    return;
  }

  const event = events.find(
    (item) =>
      item.asset.assetId === selectedCrossing.asset.assetId &&
      item.status === "active"
  );

  const wasRecentlyCleared = recentlyCleared.has(selectedCrossing.asset.assetId);

  if (wasRecentlyCleared) {
    els.impactInsight.innerHTML = `
      <div class="impactTitle">
        <strong>${escapeHtml(selectedCrossing.asset.communityName)}</strong>
        <span class="pill cleared">Cleared</span>
      </div>
      This crossing was recently marked cleared. Active impact has been removed.
    `;
    return;
  }

  if (!event) {
    const routeImportance = getRouteImportance(selectedCrossing.asset.roadName);

    els.impactInsight.innerHTML = `
      <div class="impactTitle">
        <strong>${escapeHtml(selectedCrossing.asset.communityName)}</strong>
        <span class="pill moderate">Ready</span>
      </div>
      No active blockage reported.
      <div class="impactDetails">
        <div class="metricBox">
          <span>Road Type</span>
          <strong>${escapeHtml(routeImportance)}</strong>
        </div>
        <div class="metricBox">
          <span>Spillover</span>
          <strong>localized</strong>
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

    ${escapeHtml(event.impactModel.explanation)}

    <div class="impactDetails">
      <div class="metricBox">
        <span>Reports</span>
        <strong>${event.reportCount}</strong>
      </div>
      <div class="metricBox">
        <span>Duration</span>
        <strong>${formatDuration(event.firstReportedAt, new Date().toISOString())}</strong>
      </div>
      <div class="metricBox">
        <span>Route</span>
        <strong>${escapeHtml(event.impactModel.factors.routeImportance)}</strong>
      </div>
      <div class="metricBox">
        <span>Spillover</span>
        <strong>${escapeHtml(event.impactModel.factors.spilloverRisk)}</strong>
      </div>
    </div>
  `;
}

function refreshCrossingMarkerStyles() {
  crossingMarkers.forEach((marker, assetId) => {
    const activeEvent = events.find(
      (event) =>
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
        weight: isSelected ? 4 : 3
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
        weight: isSelected ? 3 : 2
      });
    }

    const crossing = crossings.find((item) => item.asset.assetId === assetId);

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
      event.asset.assetId === crossing.asset.assetId &&
      event.status === "active"
  );

  const wasRecentlyCleared = recentlyCleared.has(crossing.asset.assetId);

  let statusHtml = `<p><strong>Status:</strong> No active blockage</p>`;

  if (activeEvent) {
    applyImpactModel(activeEvent);

    statusHtml = `
      <p><strong>Status:</strong> Active blockage</p>
      <p><strong>Impact:</strong> ${escapeHtml(activeEvent.impact)}</p>
      <p><strong>Reports:</strong> ${activeEvent.reportCount}</p>
      <p><strong>Spillover:</strong> ${escapeHtml(activeEvent.impactModel.factors.spilloverRisk)}</p>
    `;
  }

  if (wasRecentlyCleared) {
    statusHtml = `
      <p><strong>Status:</strong> Recently cleared</p>
      <p><strong>Result:</strong> Active blockage resolved</p>
    `;
  }

  return `
    <div class="crossingPopup">
      <h3>${escapeHtml(crossing.asset.communityName)}</h3>
      <p><strong>Official:</strong> ${escapeHtml(crossing.asset.officialName)}</p>
      <p><strong>Road:</strong> ${escapeHtml(crossing.asset.roadName)}</p>
      ${statusHtml}
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
      els.searchStatus.textContent = "Search complete. No nearby known crossing auto-selected.";
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

function clearLocalEvents() {
  events = [];
  recentlyCleared.clear();

  saveToStorage(STORAGE_KEYS.events, events);

  renderEventSummary();
  renderImpactInsight();
  refreshCrossingMarkerStyles();

  showToast("Local events cleared", "All locally stored crossing events have been cleared.");
}

function normalizeStoredEvents() {
  events = events.filter((event) => {
    return (
      event &&
      event.asset &&
      event.asset.assetId &&
      isValidCoordinate(Number(event.lat), Number(event.lng))
    );
  });

  events.forEach((event) => {
    if (!event.region) event.region = { ...REGION_DEFAULT };
    if (!event.reports) event.reports = [];
    if (!event.status) event.status = "active";
    if (!event.firstReportedAt) event.firstReportedAt = new Date().toISOString();
    if (!event.lastReportedAt) event.lastReportedAt = event.firstReportedAt;

    if (event.status === "active") {
      applyImpactModel(event);
    }
  });

  saveToStorage(STORAGE_KEYS.events, events);
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

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString();
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

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) return JSON.parse(JSON.stringify(fallback));

    return JSON.parse(raw);
  } catch {
    return JSON.parse(JSON.stringify(fallback));
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

window.LCSI = {
  selectAndReport(assetId, type) {
    selectCrossing(assetId);
    createObservation(type);
  },

  goToSavedLocation,

  getEvents() {
    return events;
  },

  clearLocalEvents,

  getCrossings() {
    return crossings;
  },

  version: APP_VERSION
};