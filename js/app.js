const SUPABASE_URL = "https://nhwhkbkludzkuyxmkkcj.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO";

const FRA_URL =
  "https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=LIBERTY";

const defaultCenter = [30.0466, -94.8852];
const REPORT_EXPIRATION_MINUTES = 90;
const REPORT_STALE_MINUTES = 45;
const LIVE_REFRESH_MS = 30000;

let supabaseClient = null;
let realtimeChannel = null;

let map;
let crossingLayer;
let userMarker;
let crossings = [];
let activeReports = [];
let userLocation = null;
let deviceId = null;

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  hydrateElements();
  initDeviceId();
  initSupabase();
  initGreeting();
  updateLastUpdated();
  initMap();
  loadSavedRoute();
  bindEvents();
  loadCrossings();
  loadSharedReports();
  startLiveRefresh();
});

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
    "homeInput",
    "workInput",
    "saveRouteBtn",
    "useLocationBtn",
    "refreshBtn",
    "simulateDelayBtn",
    "alertsList",
    "impactFill",
    "impactScore",
    "impactText",
    "crossingSelect",
    "crossingSearch",
    "searchResults",
    "manualReportType",
    "manualReportBtn",
    "clearReportsBtn",
    "reportConfirmation",
    "lastUpdated",
    "dataStatus",
    "syncStatus",
    "crossingCount",
    "reportDecayStatus",
    "lastReportTime",
    "mapTrustNote"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function initDeviceId() {
  const stored = localStorage.getItem("gridlyDeviceId");

  if (stored) {
    deviceId = stored;
    return;
  }

  deviceId = `device-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
  localStorage.setItem("gridlyDeviceId", deviceId);
}

function initSupabase() {
  if (!window.supabase) {
    safeText("syncStatus", "Live reports: unavailable");
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
  safeText("syncStatus", "Live reports: connected");

  try {
    realtimeChannel = supabaseClient
      .channel("gridly-live-reports")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reports"
        },
        () => {
          loadSharedReports();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          safeText("syncStatus", "Live reports: realtime on");
        }
      });
  } catch {
    safeText("syncStatus", "Live reports: polling");
  }
}

window.reportCrossingFromPopup = function (crossingId, reportType) {
  const crossing = crossings.find((item) => item.id === crossingId);
  if (!crossing) return;

  createSharedReport(crossing, reportType, "exact map marker");
};

window.zoomToCrossing = function (crossingId) {
  const crossing = crossings.find((item) => item.id === crossingId);
  if (!crossing) return;

  map.setView([crossing.lat, crossing.lng], 15);

  crossingLayer.eachLayer((layer) => {
    const latLng = layer.getLatLng();

    if (
      Number(latLng.lat).toFixed(6) === Number(crossing.lat).toFixed(6) &&
      Number(latLng.lng).toFixed(6) === Number(crossing.lng).toFixed(6)
    ) {
      layer.openPopup();
    }
  });
};

function initGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    setGreeting(
      "Good Morning",
      "Morning Route Intelligence",
      "Check your work route before leaving. Gridly watches crossings, route risk, and shared live reports.",
      "Work Route"
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
      "Check your route home before you leave. Gridly watches for crossing delays and local traffic impacts.",
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
  const now = new Date();

  safeText(
    "lastUpdated",
    `Last updated: ${now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    })}`
  );
}

function initMap() {
  map = L.map("map", { zoomControl: false }).setView(defaultCenter, 11);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  crossingLayer = L.layerGroup().addTo(map);
}

async function loadCrossings() {
  try {
    safeText("dataStatus", "Crossing data: loading");
    safeText("mapTrustNote", "Loading known public crossings from FRA data...");

    const response = await fetch(FRA_URL);

    if (!response.ok) {
      throw new Error(`FRA feed returned ${response.status}`);
    }

    const data = await response.json();

    crossings = (data.features || [])
      .filter((feature) => feature.geometry && feature.geometry.coordinates)
      .map((feature, index) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties || {};

        return {
          id: props.crossingid || props.crossing_id || `crossing-${index}`,
          name:
            props.street ||
            props.roadwayname ||
            props.highwayname ||
            props.road ||
            "Railroad Crossing",
          railroad:
            props.railroad ||
            props.railroadname ||
            props.railroad_company ||
            "Rail line",
          lat,
          lng,
          risk: calculateBaseRisk(props, index),
          props
        };
      });

    populateCrossingSelect();
    renderCrossings();
    updateRouteIntelligence();
    updateTrustStats();
    updateLastUpdated();

    safeText("dataStatus", `Crossing data: ${crossings.length} known crossings loaded`);
    safeText("crossingCount", `${crossings.length}`);
    safeText("mapTrustNote", `${crossings.length} known public crossings loaded from FRA data.`);
  } catch (error) {
    console.error("Gridly crossing load failed:", error);
    showFallbackAlert();

    safeText("dataStatus", "Crossing data: unavailable");
    safeText("crossingCount", "Unavailable");
    safeText("mapTrustNote", "Unable to load FRA crossing data. Try refreshing.");
  }
}

async function loadSharedReports() {
  if (!supabaseClient) {
    safeText("syncStatus", "Live reports: unavailable");
    return;
  }

  try {
    safeText("syncStatus", "Live reports: syncing");

    const nowIso = new Date().toISOString();

    const { data, error } = await supabaseClient
      .from("reports")
      .select("*")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(150);

    if (error) {
      throw error;
    }

    activeReports = normalizeReports(data || []);

    renderAlerts();
    renderCrossings();
    updateRouteIntelligence();
    updateTrustStats();
    updateLastUpdated();

    safeText("syncStatus", "Live reports: synced");
  } catch (error) {
    console.error("Gridly report sync failed:", error);
    safeText("syncStatus", "Live reports: sync failed");
    showFallbackAlert();
  }
}

function normalizeReports(rows) {
  return rows.map((row) => {
    const createdAt = row.created_at || new Date().toISOString();
    const minutesAgo = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));

    return {
      id: row.id,
      crossingId: row.crossing_id,
      crossingName: row.crossing_name,
      railroad: row.railroad,
      lat: row.lat,
      lng: row.lng,
      type: row.report_type,
      severity: row.severity,
      title: `${row.crossing_name} ${getReportCopy(row.report_type).shortTitle}`,
      detail: row.detail || "Shared Gridly report.",
      source: row.source || "user",
      confidence: row.confidence || "shared live report",
      deviceId: row.device_id,
      submittedAt: createdAt,
      expiresAt: row.expires_at,
      minutesAgo,
      expired: new Date(row.expires_at).getTime() <= Date.now()
    };
  });
}

function startLiveRefresh() {
  setInterval(() => {
    loadSharedReports();
  }, LIVE_REFRESH_MS);
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

function populateCrossingSelect() {
  if (!els.crossingSelect) return;

  const sorted = [...crossings].sort((a, b) => a.name.localeCompare(b.name));

  els.crossingSelect.innerHTML = `
    <option value="">Choose a crossing</option>
    ${sorted
      .map(
        (crossing) =>
          `<option value="${crossing.id}">${sanitizeText(crossing.name)} · ${sanitizeText(crossing.railroad)}</option>`
      )
      .join("")}
  `;
}

function renderCrossings() {
  if (!crossingLayer) return;

  crossingLayer.clearLayers();

  crossings.forEach((crossing) => {
    const report = getLatestReportForCrossing(crossing.id);
    const hasActiveIssue = report && report.type !== "cleared" && !report.expired;
    const isCleared = report && report.type === "cleared";
    const isExpired = report && report.expired;

    const icon = L.divIcon({
      className: "",
      html: `<div class="gridly-marker ${hasActiveIssue ? "alert" : ""} ${isCleared ? "cleared" : ""} ${isExpired ? "expired" : ""}"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    L.marker([crossing.lat, crossing.lng], { icon })
      .bindPopup(buildPopup(crossing, report), { maxWidth: 330 })
      .addTo(crossingLayer);
  });
}

function buildPopup(crossing, report) {
  const status = report
    ? report.expired
      ? "Expired report"
      : report.type === "cleared"
      ? "Recently cleared"
      : report.title
    : "No active report";

  const source = report ? getSourceLabel(report.source) : "FRA crossing inventory";
  const age = report ? `${report.minutesAgo} min ago` : "No recent report";
  const freshness = report ? getFreshnessLabel(report) : "Verified crossing";

  return `
    <div class="gridly-popup">
      <strong>${sanitizeText(crossing.name)}</strong>
      <span>${sanitizeText(crossing.railroad)}</span><br />
      <span>Status: ${sanitizeText(status)}</span><br />
      <span>Risk Score: ${crossing.risk}/100</span><br />
      <span>Source: ${sanitizeText(source)}</span><br />
      <span>Freshness: ${sanitizeText(freshness)} · ${sanitizeText(age)}</span>

      <div class="popup-report-grid">
        <button class="popup-report-btn danger" onclick="reportCrossingFromPopup('${crossing.id}', 'blocked')">Blocked</button>
        <button class="popup-report-btn warning" onclick="reportCrossingFromPopup('${crossing.id}', 'heavy')">Delay</button>
        <button class="popup-report-btn blue" onclick="reportCrossingFromPopup('${crossing.id}', 'cleared')">Cleared</button>
        <button class="popup-report-btn neutral" onclick="reportCrossingFromPopup('${crossing.id}', 'other')">Other</button>
      </div>
    </div>
  `;
}

function bindEvents() {
  els.saveRouteBtn?.addEventListener("click", saveRoute);
  els.useLocationBtn?.addEventListener("click", useMyLocation);
  els.refreshBtn?.addEventListener("click", refreshReports);
  els.simulateDelayBtn?.addEventListener("click", simulateDelay);
  els.manualReportBtn?.addEventListener("click", submitManualReport);
  els.clearReportsBtn?.addEventListener("click", loadSharedReports);
  els.crossingSearch?.addEventListener("input", handleCrossingSearch);

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

      const target = document.getElementById(targets[btn.dataset.section]);

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function saveRoute() {
  const home = els.homeInput.value.trim();
  const work = els.workInput.value.trim();

  if (!home || !work) {
    flashButton(els.saveRouteBtn, "Add Home + Work");
    return;
  }

  localStorage.setItem("gridlyHome", home);
  localStorage.setItem("gridlyWork", work);

  loadSavedRoute();
  updateRouteIntelligence();
  flashButton(els.saveRouteBtn, "Route Saved");
}

function loadSavedRoute() {
  const home = localStorage.getItem("gridlyHome");
  const work = localStorage.getItem("gridlyWork");

  if (home) {
    safeText("savedHome", home);
    if (els.homeInput) els.homeInput.value = home;
  }

  if (work) {
    safeText("savedWork", work);
    if (els.workInput) els.workInput.value = work;
  }
}

function useMyLocation() {
  if (!navigator.geolocation) {
    flashButton(els.useLocationBtn, "Unavailable");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      if (userMarker) map.removeLayer(userMarker);

      userMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 9,
        color: "#43e6a0",
        fillColor: "#43e6a0",
        fillOpacity: 0.85
      })
        .bindPopup("Your current location")
        .addTo(map);

      map.setView([userLocation.lat, userLocation.lng], 13);

      const nearest = findNearestCrossings(userLocation.lat, userLocation.lng, 5);
      updateRouteIntelligence(nearest);

      safeText(
        "reportConfirmation",
        nearest.length > 0
          ? `Location found. Nearest crossing: ${nearest[0].name}.`
          : "Location found, but no nearby crossing was matched."
      );

      flashButton(els.useLocationBtn, "Location Found");
    },
    () => {
      safeText(
        "reportConfirmation",
        "Location permission was blocked. Use map popup reporting, search, or manual fallback."
      );
      flashButton(els.useLocationBtn, "Location Blocked");
    }
  );
}

function submitManualReport() {
  const crossing = crossings.find((item) => item.id === els.crossingSelect.value);
  const reportType = els.manualReportType.value;

  if (!crossing) {
    safeText("reportConfirmation", "Choose a crossing before submitting a manual report.");
    return;
  }

  createSharedReport(crossing, reportType, "manual fallback");
}

async function createSharedReport(crossing, reportType, confidence) {
  if (!supabaseClient) {
    safeText("reportConfirmation", "Live report sync is unavailable. Try again in a moment.");
    return;
  }

  const copy = getReportCopy(reportType);

  const row = {
    crossing_id: crossing.id,
    crossing_name: crossing.name,
    railroad: crossing.railroad,
    lat: crossing.lat,
    lng: crossing.lng,
    report_type: reportType,
    severity: copy.severity,
    detail: copy.detail,
    source: "user",
    confidence,
    device_id: deviceId
  };

  try {
    safeText("syncStatus", "Live reports: sending");

    const { error } = await supabaseClient.from("reports").insert(row);

    if (error) {
      throw error;
    }

    await loadSharedReports();

    map.setView([crossing.lat, crossing.lng], 14);

    safeText(
      "reportConfirmation",
      `Shared report submitted: ${crossing.name} as ${copy.label}. Confidence: ${confidence}.`
    );

    safeText("syncStatus", "Live reports: synced");
  } catch (error) {
    console.error("Gridly report insert failed:", error);
    safeText("syncStatus", "Live reports: submit failed");
    safeText("reportConfirmation", "Report could not be submitted. Check Supabase table policies and try again.");
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

async function refreshReports() {
  await loadSharedReports();
  flashButton(els.refreshBtn, "Updated");
}

async function simulateDelay() {
  if (!crossings.length) return;

  const crossing = crossings[Math.floor(Math.random() * crossings.length)];

  await createSharedReport(crossing, "blocked", "simulated demo action");
  flashButton(els.simulateDelayBtn, "Delay Added");
}

function updateRouteIntelligence(nearest = []) {
  const savedHome = localStorage.getItem("gridlyHome");
  const savedWork = localStorage.getItem("gridlyWork");

  const latestReports = getLatestReportsByCrossing();
  const activeIssues = latestReports.filter((report) => !report.expired && report.type !== "cleared");
  const highAlerts = activeIssues.filter((report) => report.severity === "high").length;
  const moderateAlerts = activeIssues.filter((report) => report.severity === "moderate").length;

  const crossingRisk = nearest.length
    ? Math.round(nearest.reduce((sum, c) => sum + c.risk, 0) / nearest.length)
    : 28;

  const impact = Math.min(
    100,
    activeIssues.length * 10 + highAlerts * 22 + moderateAlerts * 8 + Math.round(crossingRisk * 0.35)
  );

  const extraMinutes = Math.max(0, Math.round(impact / 7));

  safeText("nearbyAlertCount", activeIssues.length);
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
    safeText("departureTime", "Set route first");
    safeText("departureReason", "Home and Work unlock personalized daily route intelligence.");
    els.routeStatusCard?.classList.add("delayed");
  } else if (impact >= 70) {
    safeText("routeStatus", "Delayed");
    safeText("routeEta", `ETA 32 min (+${extraMinutes})`);
    safeText("departureTime", "Leave now");
    safeText("departureReason", "High shared route impact detected near your commute window.");
    els.routeStatusCard?.classList.add("high");
  } else if (impact >= 40) {
    safeText("routeStatus", "Watch");
    safeText("routeEta", `ETA 26 min (+${extraMinutes})`);
    safeText("departureTime", "Leave 8 min early");
    safeText("departureReason", "Moderate shared report risk near one or more crossings.");
    els.routeStatusCard?.classList.add("delayed");
  } else {
    safeText("routeStatus", "Clear");
    safeText("routeEta", "ETA 21 min");
    safeText("departureTime", "Normal departure");
    safeText("departureReason", "No major active shared delay detected.");
    els.routeStatusCard?.classList.add("clear");
  }

  if (impact >= 70) {
    safeText("delayRisk", "High");
    safeText("delayReason", "Multiple shared reports or one major crossing blockage detected.");
    safeText("alternateRoute", "Use alternate");
    safeText("alternateReason", "Avoid the highest-impact crossing if possible.");
    safeText("impactText", "High route impact. Gridly recommends leaving now or rerouting.");
  } else if (impact >= 40) {
    safeText("delayRisk", "Moderate");
    safeText("delayReason", "Some nearby crossing or traffic risk detected.");
    safeText("alternateRoute", "Have backup");
    safeText("alternateReason", "Alternate route may help if reports increase.");
    safeText("impactText", "Moderate route impact. Watch your commute before leaving.");
  } else {
    safeText("delayRisk", "Low");
    safeText("delayReason", "No major live reports affecting the area.");
    safeText("alternateRoute", "Not needed");
    safeText("alternateReason", "Current route appears clear.");
    safeText("impactText", "Low route impact. Normal travel expected.");
  }
}

function renderAlerts() {
  if (!els.alertsList) return;

  const latestReports = getLatestReportsByCrossing();

  if (!latestReports.length) {
    els.alertsList.innerHTML = `
      <div class="alert-item">
        <strong>No active shared alerts</strong>
        <p>Your saved route looks quiet right now.</p>
      </div>
    `;
    return;
  }

  els.alertsList.innerHTML = latestReports
    .slice(0, 8)
    .map((report) => {
      const label =
        report.expired
          ? "Expired"
          : report.type === "cleared"
          ? "Cleared"
          : report.severity === "high"
          ? "High Impact"
          : report.severity === "moderate"
          ? "Moderate"
          : "Watch";

      return `
        <div class="alert-item">
          <strong>${sanitizeText(report.title)}</strong>
          <p>${label} · ${report.minutesAgo} min ago · ${sanitizeText(getFreshnessLabel(report))}</p>
          <p>${sanitizeText(report.detail)}</p>
          <span class="source-pill">${sanitizeText(getSourceLabel(report.source))}</span>
        </div>
      `;
    })
    .join("");
}

function updateTrustStats() {
  const latestReports = getLatestReportsByCrossing();
  const active = latestReports.filter((report) => !report.expired);
  const lastReport = [...activeReports].sort((a, b) => {
    return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
  })[0];

  safeText("reportDecayStatus", `${REPORT_EXPIRATION_MINUTES} min expiry`);
  safeText("lastReportTime", lastReport ? `${lastReport.minutesAgo} min ago` : "None yet");
  safeText("nearbyAlertCount", active.filter((report) => report.type !== "cleared").length);
}

function getLatestReportForCrossing(crossingId) {
  return activeReports
    .filter((report) => report.crossingId === crossingId)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
}

function getLatestReportsByCrossing() {
  const mapByCrossing = new Map();

  activeReports
    .filter((report) => !report.expired)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .forEach((report) => {
      if (!mapByCrossing.has(report.crossingId)) {
        mapByCrossing.set(report.crossingId, report);
      }
    });

  return [...mapByCrossing.values()];
}

function getFreshnessLabel(report) {
  if (report.expired) return "Expired";
  if (report.minutesAgo >= REPORT_STALE_MINUTES) return "Stale soon";
  if (report.minutesAgo >= 15) return "Recent";
  return "Fresh";
}

function getSourceLabel(source) {
  return {
    user: "Shared user report",
    demo: "Demo report",
    simulated: "Simulated report"
  }[source] || "Shared report";
}

function handleCrossingSearch() {
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
        <button class="search-result-btn" type="button" onclick="zoomToCrossing('${crossing.id}')">
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

function haversineDistance(lat1, lng1, lat2, lng2) {
  const r = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(a));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function showFallbackAlert() {
  if (!els.alertsList) return;

  els.alertsList.innerHTML = `
    <div class="alert-item">
      <strong>Crossing data or live reports unavailable</strong>
      <p>Gridly could not load one of its feeds. Try refreshing the page.</p>
    </div>
  `;
}

function flashButton(button, message) {
  if (!button) return;

  const original = button.textContent;
  button.textContent = message;

  setTimeout(() => {
    button.textContent = original;
  }, 1300);
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