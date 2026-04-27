/*
  Liberty County Spatial Intelligence System
  V5.1 shared live reporting cleanup
  Pure HTML/CSS/Vanilla JS/Leaflet
*/

const APP_VERSION = "V5.1 shared report display cleanup";
const FRA_URL = "https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=LIBERTY";
const BOUNDARY_URL = "data/liberty-county-boundary.geojson";
const SUPABASE_URL = "https://nhwhkbkludzkuyxmkkcj.supabase.co";
const SUPABASE_KEY = "sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO";

console.log("App Version:", APP_VERSION);

const state = {
  map: null,
  supabase: null,
  crossings: [],
  crossingById: new Map(),
  reports: [],
  activeByCrossingId: new Map(),
  selectedCrossing: null,
  layers: {
    boundary: null,
    crossings: null,
    activeReports: null,
    userLocation: null,
  },
};

const el = {
  openCrossingCount: document.getElementById("openCrossingCount"),
  activeReportCount: document.getElementById("activeReportCount"),
  reviewCount: document.getElementById("reviewCount"),
  hiddenCount: document.getElementById("hiddenCount"),
  selectedBadge: document.getElementById("selectedBadge"),
  selectedCrossing: document.getElementById("selectedCrossing"),
  reportBlockedBtn: document.getElementById("reportBlockedBtn"),
  reportClearedBtn: document.getElementById("reportClearedBtn"),
  reportNotes: document.getElementById("reportNotes"),
  reportStatus: document.getElementById("reportStatus"),
  activeSummary: document.getElementById("activeSummary"),
  lastUpdated: document.getElementById("lastUpdated"),
  locateBtn: document.getElementById("locateBtn"),
  refreshReportsBtn: document.getElementById("refreshReportsBtn"),
  toggleDebugBtn: document.getElementById("toggleDebugBtn"),
  debugPanel: document.getElementById("debugPanel"),
  debugVersion: document.getElementById("debugVersion"),
  debugFra: document.getElementById("debugFra"),
  debugBoundary: document.getElementById("debugBoundary"),
  debugSupabase: document.getElementById("debugSupabase"),
  debugSelected: document.getElementById("debugSelected"),
};

function init() {
  el.debugVersion.textContent = APP_VERSION;

  state.map = L.map("map", {
    zoomControl: true,
    preferCanvas: true,
  }).setView([30.057, -94.795], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(state.map);

  state.layers.crossings = L.layerGroup().addTo(state.map);
  state.layers.activeReports = L.layerGroup().addTo(state.map);

  initSupabase();
  bindEvents();
  loadBoundary();
  loadFraCrossings();
  loadReports();
}

function initSupabase() {
  try {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase CDN client not available");
    }
    state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    el.debugSupabase.textContent = "Client ready";
  } catch (error) {
    state.supabase = null;
    el.debugSupabase.textContent = "Offline fallback active";
    console.warn("Supabase fallback enabled:", error);
  }
}

function bindEvents() {
  el.reportBlockedBtn.addEventListener("click", () => submitReport("blocked"));
  el.reportClearedBtn.addEventListener("click", () => submitReport("cleared"));
  el.refreshReportsBtn.addEventListener("click", loadReports);
  el.locateBtn.addEventListener("click", locateUser);
  el.toggleDebugBtn.addEventListener("click", () => {
    el.debugPanel.hidden = !el.debugPanel.hidden;
    el.toggleDebugBtn.textContent = el.debugPanel.hidden ? "Show Diagnostics" : "Hide Diagnostics";
  });

  window.selectCrossingById = (crossingId) => {
    const crossing = state.crossingById.get(String(crossingId));
    if (crossing) selectCrossing(crossing, true);
  };

  window.reportCrossingFromPopup = (crossingId, type) => {
    const crossing = state.crossingById.get(String(crossingId));
    if (crossing) {
      selectCrossing(crossing, false);
      submitReport(type);
    }
  };
}

async function loadBoundary() {
  try {
    const response = await fetch(BOUNDARY_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Boundary HTTP ${response.status}`);
    const geojson = await response.json();

    state.layers.boundary = L.geoJSON(geojson, {
      style: {
        color: "#38c172",
        weight: 3,
        opacity: 0.95,
        fillColor: "#38c172",
        fillOpacity: 0.04,
      },
    }).addTo(state.map);

    state.map.fitBounds(state.layers.boundary.getBounds(), { padding: [20, 20] });
    el.debugBoundary.textContent = "Loaded from data/liberty-county-boundary.geojson";
  } catch (error) {
    console.error("Boundary load failed:", error);
    el.debugBoundary.textContent = "Failed to load";
  }
}

async function loadFraCrossings() {
  try {
    el.debugFra.textContent = "Loading";
    const response = await fetch(FRA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`FRA HTTP ${response.status}`);
    const geojson = await response.json();

    const normalized = (geojson.features || []).map(normalizeFraFeature).filter(Boolean);
    const visible = [];
    let hiddenClosed = 0;

    normalized.forEach((crossing) => {
      if (crossing.visibility === "closed_hidden") hiddenClosed += 1;
      else visible.push(crossing);
    });

    state.crossings = visible;
    state.crossingById = new Map(visible.map((crossing) => [crossing.id, crossing]));

    renderCrossings();
    updateDashboardCounts(hiddenClosed);
    el.debugFra.textContent = `Loaded ${visible.length} visible / ${hiddenClosed} hidden closed`;
  } catch (error) {
    console.error("FRA crossings load failed:", error);
    el.debugFra.textContent = "Failed to load";
  }
}

function normalizeFraFeature(feature, index) {
  const p = feature.properties || {};
  const coords = extractCoordinates(feature, p);
  const id = firstText(p, ["crossingid", "crossing_id", "crossing", "crossingnumber", "crossing_no", "objectid"]) || `fra-${index}`;
  const roadName = firstText(p, ["street", "streetname", "roadname", "highway", "crossingstreet", "publicroadname"]) || "Unnamed Road";
  const railroad = firstText(p, ["railroad", "rrname", "railroadname", "company", "operatingrr"] ) || "Railroad not listed";
  const city = firstText(p, ["city", "cityname"]) || "Liberty County";
  const county = firstText(p, ["countyname", "county"]) || "LIBERTY";
  const stateName = firstText(p, ["statename", "state"]) || "TEXAS";

  const statusText = firstText(p, ["crossingstatus", "status", "positionalaccuracy", "recordstatus", "crossingposition"]);
  const typeText = firstText(p, ["crossingtype", "type", "publicprivate", "public_private"]);
  const isClosed = containsAny(statusText, ["closed", "abandoned", "out of service", "inactive"]) || containsAny(typeText, ["closed", "abandoned"]);

  if (isClosed) {
    return { id: String(id), visibility: "closed_hidden" };
  }

  if (!coords) {
    return {
      id: String(id),
      visibility: "needs_review_visible",
      needsReviewReason: "Missing valid coordinates",
      roadName,
      railroad,
      city,
      county,
      stateName,
      raw: p,
    };
  }

  let visibility = "open_visible";
  let needsReviewReason = "";

  if (containsAny(typeText, ["private"])) {
    visibility = "private_visible";
    needsReviewReason = "Private crossing visible for review";
  } else if (containsAny(statusText, ["unknown", "pending", "review", "unverified"])) {
    visibility = "needs_review_visible";
    needsReviewReason = "FRA status needs review";
  }

  return {
    id: String(id),
    roadName,
    railroad,
    city,
    county,
    stateName,
    lat: coords.lat,
    lng: coords.lng,
    visibility,
    needsReviewReason,
    raw: p,
  };
}

function extractCoordinates(feature, properties) {
  if (feature.geometry && Array.isArray(feature.geometry.coordinates)) {
    const [lng, lat] = feature.geometry.coordinates;
    if (isValidLatLng(lat, lng)) return { lat: Number(lat), lng: Number(lng) };
  }

  const lat = firstNumber(properties, ["latitude", "lat", "y", "position_y"]);
  const lng = firstNumber(properties, ["longitude", "lon", "lng", "x", "position_x"]);
  if (isValidLatLng(lat, lng)) return { lat: Number(lat), lng: Number(lng) };
  return null;
}

function isValidLatLng(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return Number.isFinite(nLat) && Number.isFinite(nLng) && nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180 && !(nLat === 0 && nLng === 0);
}

function firstText(obj, keys) {
  for (const key of keys) {
    const found = findCaseInsensitive(obj, key);
    if (found !== undefined && found !== null && String(found).trim() !== "") return String(found).trim();
  }
  return "";
}

function firstNumber(obj, keys) {
  for (const key of keys) {
    const found = findCaseInsensitive(obj, key);
    if (found !== undefined && found !== null && String(found).trim() !== "") return Number(found);
  }
  return NaN;
}

function findCaseInsensitive(obj, key) {
  const target = key.toLowerCase();
  const actualKey = Object.keys(obj || {}).find((candidate) => candidate.toLowerCase() === target);
  return actualKey ? obj[actualKey] : undefined;
}

function containsAny(value, needles) {
  const haystack = String(value || "").toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

function renderCrossings() {
  state.layers.crossings.clearLayers();

  state.crossings.forEach((crossing) => {
    if (!isValidLatLng(crossing.lat, crossing.lng)) return;

    const marker = L.circleMarker([crossing.lat, crossing.lng], {
      radius: crossing.visibility === "open_visible" ? 5 : 7,
      color: getCrossingColor(crossing),
      weight: 2,
      fillColor: getCrossingColor(crossing),
      fillOpacity: 0.76,
    });

    marker.bindPopup(buildCrossingPopup(crossing));
    marker.on("click", () => selectCrossing(crossing, false));
    marker.addTo(state.layers.crossings);
  });
}

function getCrossingColor(crossing) {
  if (crossing.visibility === "private_visible") return "#b589ff";
  if (crossing.visibility === "needs_review_visible") return "#f5b942";
  return "#46a3ff";
}

function buildCrossingPopup(crossing) {
  const active = state.activeByCrossingId.get(crossing.id);
  const activeHtml = active ? `<p><strong>Active status:</strong> Blocked since ${formatDateTime(active.created_at)}</p>` : "";
  const reviewHtml = crossing.needsReviewReason ? `<p><strong>Review flag:</strong> ${escapeHtml(crossing.needsReviewReason)}</p>` : "";

  return `
    <div class="crossing-popup">
      <h3>${escapeHtml(crossing.roadName)}</h3>
      <p><strong>Crossing ID:</strong> ${escapeHtml(crossing.id)}</p>
      <p><strong>Railroad:</strong> ${escapeHtml(crossing.railroad)}</p>
      <p><strong>City:</strong> ${escapeHtml(crossing.city)}</p>
      <p><strong>Visibility:</strong> ${escapeHtml(crossing.visibility)}</p>
      ${reviewHtml}
      ${activeHtml}
      <div class="popup-actions">
        <button onclick="window.reportCrossingFromPopup('${escapeJs(crossing.id)}','blocked')" style="background:#ff4d4f;color:white;">Blocked</button>
        <button onclick="window.reportCrossingFromPopup('${escapeJs(crossing.id)}','cleared')" style="background:#38c172;color:white;">Cleared</button>
      </div>
    </div>
  `;
}

async function loadReports() {
  console.log("Loading reports");
  el.reportStatus.textContent = "Loading shared reports...";

  if (!state.supabase) {
    state.reports = [];
    buildActiveReportState();
    renderActiveReports();
    renderActiveSummary();
    el.debugSupabase.textContent = "Offline fallback: no Supabase client";
    el.reportStatus.textContent = "Shared reports unavailable. Map is running in local fallback mode.";
    console.warn("Reports loaded: 0 - Supabase unavailable");
    return;
  }

  try {
    const { data, error } = await state.supabase
      .from("crossing_reports")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    state.reports = Array.isArray(data) ? data : [];
    console.log("Reports loaded:", state.reports.length);
    el.debugSupabase.textContent = `Reports loaded: ${state.reports.length}`;
    el.reportStatus.textContent = `Shared reports loaded: ${state.reports.length}`;
    el.lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;

    buildActiveReportState();
    renderActiveReports();
    renderActiveSummary();
    updateDashboardCounts();
  } catch (error) {
    console.error("Reports load failed:", error);
    state.reports = [];
    buildActiveReportState();
    renderActiveReports();
    renderActiveSummary();
    updateDashboardCounts();
    el.debugSupabase.textContent = "Read failed; fallback active";
    el.reportStatus.textContent = "Shared report read failed. Map is still usable.";
  }
}

function buildActiveReportState() {
  const active = new Map();
  const ordered = [...state.reports].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  ordered.forEach((report) => {
    const crossingId = String(report.crossing_id || "");
    if (!crossingId) return;

    if (report.report_type === "blocked" && report.status === "active") {
      active.set(crossingId, report);
    }

    if (report.report_type === "cleared" || report.status === "resolved") {
      active.delete(crossingId);
    }
  });

  state.activeByCrossingId = active;
}

function renderActiveReports() {
  state.layers.activeReports.clearLayers();

  state.activeByCrossingId.forEach((report, crossingId) => {
    const crossing = state.crossingById.get(String(crossingId));
    const lat = Number(report.lat || crossing?.lat);
    const lng = Number(report.lng || crossing?.lng);
    if (!isValidLatLng(lat, lng)) return;

    const marker = L.circleMarker([lat, lng], {
      radius: 11,
      color: "#ffffff",
      weight: 2,
      fillColor: "#ff4d4f",
      fillOpacity: 0.94,
    });

    marker.bindPopup(`
      <div class="crossing-popup">
        <h3>Active Blocked Crossing</h3>
        <p><strong>Road:</strong> ${escapeHtml(report.road_name || crossing?.roadName || "Unknown road")}</p>
        <p><strong>Crossing ID:</strong> ${escapeHtml(crossingId)}</p>
        <p><strong>Reported:</strong> ${formatDateTime(report.created_at)}</p>
        <p><strong>Notes:</strong> ${escapeHtml(report.notes || "No notes")}</p>
      </div>
    `);

    marker.on("click", () => {
      if (crossing) selectCrossing(crossing, false);
    });
    marker.addTo(state.layers.activeReports);
  });
}

function renderActiveSummary() {
  const activeReports = Array.from(state.activeByCrossingId.entries()).map(([crossingId, report]) => ({
    crossingId,
    report,
    crossing: state.crossingById.get(String(crossingId)),
  }));

  el.activeReportCount.textContent = String(activeReports.length);

  if (!activeReports.length) {
    el.activeSummary.className = "active-summary empty-state";
    el.activeSummary.textContent = "No active blocked crossings right now.";
    return;
  }

  el.activeSummary.className = "active-summary";
  el.activeSummary.innerHTML = activeReports
    .sort((a, b) => new Date(b.report.created_at || 0) - new Date(a.report.created_at || 0))
    .map(({ crossingId, report, crossing }) => {
      const road = report.road_name || crossing?.roadName || "Unknown road";
      const railroad = report.railroad || crossing?.railroad || "Railroad not listed";
      return `
        <button class="summary-item" type="button" onclick="window.selectCrossingById('${escapeJs(crossingId)}')">
          <strong>${escapeHtml(road)}</strong>
          <span>${escapeHtml(railroad)} · ID ${escapeHtml(crossingId)} · ${formatDateTime(report.created_at)}</span>
        </button>
      `;
    })
    .join("");
}

function updateDashboardCounts(hiddenClosedOverride) {
  const visible = state.crossings.length;
  const review = state.crossings.filter((crossing) => crossing.visibility === "needs_review_visible" || crossing.visibility === "private_visible").length;
  const hiddenClosed = Number.isFinite(hiddenClosedOverride) ? hiddenClosedOverride : Number(el.hiddenCount.textContent || 0);

  el.openCrossingCount.textContent = String(visible);
  el.reviewCount.textContent = String(review);
  el.hiddenCount.textContent = String(hiddenClosed);
  el.activeReportCount.textContent = String(state.activeByCrossingId.size);
}

function selectCrossing(crossing, panTo) {
  state.selectedCrossing = crossing;
  el.selectedBadge.textContent = crossing.visibility;
  el.debugSelected.textContent = crossing.id;
  el.reportBlockedBtn.disabled = false;
  el.reportClearedBtn.disabled = false;

  const active = state.activeByCrossingId.get(crossing.id);
  el.selectedCrossing.className = "";
  el.selectedCrossing.innerHTML = `
    <strong>${escapeHtml(crossing.roadName)}</strong><br />
    Crossing ID: ${escapeHtml(crossing.id)}<br />
    Railroad: ${escapeHtml(crossing.railroad)}<br />
    City: ${escapeHtml(crossing.city)}<br />
    Status: ${active ? "<strong style='color:#ffb3b3;'>Active blocked report</strong>" : "No active blocked report"}
    ${crossing.needsReviewReason ? `<br />Review: ${escapeHtml(crossing.needsReviewReason)}` : ""}
  `;

  if (panTo && isValidLatLng(crossing.lat, crossing.lng)) {
    state.map.setView([crossing.lat, crossing.lng], Math.max(state.map.getZoom(), 15), { animate: true });
  }
}

async function submitReport(type) {
  const crossing = state.selectedCrossing;
  if (!crossing) return;

  const now = new Date().toISOString();
  const payload = {
    crossing_id: crossing.id,
    report_type: type,
    status: type === "blocked" ? "active" : "resolved",
    road_name: crossing.roadName,
    railroad: crossing.railroad,
    city: crossing.city,
    county: crossing.county || "LIBERTY",
    state: crossing.stateName || "TEXAS",
    lat: Number.isFinite(Number(crossing.lat)) ? Number(crossing.lat) : null,
    lng: Number.isFinite(Number(crossing.lng)) ? Number(crossing.lng) : null,
    confidence: crossing.visibility === "open_visible" ? "community" : crossing.visibility,
    source: "community_report",
    resolved_at: type === "cleared" ? now : null,
    client_id: getClientId(),
    notes: el.reportNotes.value.trim() || null,
  };

  el.reportStatus.textContent = type === "blocked" ? "Sending blocked report..." : "Sending cleared report...";

  if (!state.supabase) {
    applyLocalReport({ ...payload, id: `local-${Date.now()}`, created_at: now });
    console.warn("Insert failure: Supabase unavailable. Applied local fallback report.");
    el.reportStatus.textContent = "Supabase unavailable. Local fallback applied for this browser session.";
    return;
  }

  try {
    const { data, error } = await state.supabase
      .from("crossing_reports")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    console.log("Insert success:", data);
    el.reportStatus.textContent = type === "blocked" ? "Report sent! Crossing marked blocked." : "Report sent! Crossing marked cleared.";
    el.reportNotes.value = "";

    applyLocalReport(data || { ...payload, id: `fallback-${Date.now()}`, created_at: now });
    await loadReports();
  } catch (error) {
    console.error("Insert failure:", error);
    applyLocalReport({ ...payload, id: `local-${Date.now()}`, created_at: now });
    el.reportStatus.textContent = "Report could not be saved to Supabase. Local fallback applied temporarily.";
  }
}

function applyLocalReport(report) {
  state.reports.push(report);
  buildActiveReportState();
  renderActiveReports();
  renderActiveSummary();
  renderCrossings();
  updateDashboardCounts();
  if (state.selectedCrossing) selectCrossing(state.selectedCrossing, false);
}

function getClientId() {
  const key = "lcsi_client_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `client-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function locateUser() {
  if (!navigator.geolocation) {
    el.reportStatus.textContent = "Location is not available in this browser.";
    return;
  }

  el.reportStatus.textContent = "Finding your location...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const nearest = findNearestCrossing(lat, lng);

      if (state.layers.userLocation) state.layers.userLocation.remove();
      state.layers.userLocation = L.circleMarker([lat, lng], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#38c172",
        fillOpacity: 0.85,
      }).addTo(state.map).bindPopup("Your location");

      state.map.setView([lat, lng], 14);

      if (nearest) {
        selectCrossing(nearest.crossing, false);
        el.reportStatus.textContent = `Nearest crossing selected: ${nearest.crossing.roadName} (${nearest.distanceMiles.toFixed(2)} miles away).`;
      } else {
        el.reportStatus.textContent = "Location found, but no nearby crossing could be selected.";
      }
    },
    (error) => {
      console.warn("Location failed:", error);
      el.reportStatus.textContent = "Could not access location. Check browser permissions.";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

function findNearestCrossing(lat, lng) {
  let best = null;
  state.crossings.forEach((crossing) => {
    if (!isValidLatLng(crossing.lat, crossing.lng)) return;
    const miles = haversineMiles(lat, lng, crossing.lat, crossing.lng);
    if (!best || miles < best.distanceMiles) best = { crossing, distanceMiles: miles };
  });
  return best;
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const radius = 3958.8;
  const toRad = (degree) => degree * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDateTime(value) {
  if (!value) return "unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown time";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJs(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

document.addEventListener("DOMContentLoaded", init);
