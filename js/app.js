const FRA_URL =
  "https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=LIBERTY";

const defaultCenter = [30.0466, -94.8852];
const REPORT_EXPIRATION_MINUTES = 90;
const REPORT_STALE_MINUTES = 45;

let map;
let crossingLayer;
let userMarker;
let crossings = [];
let activeReports = [];
let userLocation = null;

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  hydrateElements();
  initGreeting();
  updateLastUpdated();
  initMap();
  loadSavedRoute();
  loadStoredReports();
  expireOldReports();
  bindEvents();
  loadCrossings();
  updateRouteIntelligence();
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
    "crossingCount",
    "reportDecayStatus",
    "lastReportTime",
    "mapTrustNote"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

window.reportCrossingFromPopup = function (crossingId, reportType) {
  const crossing = crossings.find((item) => item.id === crossingId);
  if (!crossing) return;
  createReport(crossing, reportType, "exact map marker");
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
      "Check your work route before leaving. Gridly watches crossings, route risk, and delay reports.",
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

    if (!activeReports.length) {
      seedDemoReports();
    }

    renderAlerts();
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
  crossingLayer.clearLayers();

  crossings.forEach((crossing) => {
    const report = getReportForCrossing(crossing.id);
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

function seedDemoReports() {
  if (!crossings.length) return;

  activeReports = crossings
    .filter((_, index) => index % 17 === 0)
    .slice(0, 2)
    .map((crossing, index) => ({
      id: `demo-${index}`,
      crossingId: crossing.id,
      type: index === 0 ? "blocked" : "heavy",
      title: index === 0 ? `${crossing.name} blocked` : `${crossing.name} heavy delay`,
      detail:
        index === 0
          ? "Demo report: possible blockage affecting local traffic."
          : "Demo report: slowdown near rail crossing.",
      severity: index === 0 ? "high" : "moderate",
      submittedAt: new Date(Date.now() - (index + 1) * 8 * 60000).toISOString(),
      minutesAgo: 8 + index * 8,
      source: "demo"
    }));

  saveStoredReports();
}

function bindEvents() {
  els.saveRouteBtn?.addEventListener("click", saveRoute);
  els.useLocationBtn?.addEventListener("click", useMyLocation);
  els.refreshBtn?.addEventListener("click", refreshReports);
  els.simulateDelayBtn?.addEventListener("click", simulateDelay);
  els.manualReportBtn?.addEventListener("click", submitManualReport);
  els.clearReportsBtn?.addEventListener("click", clearUserReports);
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

  createReport(crossing, reportType, "manual fallback");
}

function createReport(crossing, reportType, confidence) {
  const copy = getReportCopy(reportType);

  activeReports = activeReports.filter((report) => report.crossingId !== crossing.id);

  activeReports.unshift({
    id: `user-${Date.now()}`,
    crossingId: crossing.id,
    type: reportType,
    title: `${crossing.name} ${copy.shortTitle}`,
    detail: copy.detail,
    severity: copy.severity,
    submittedAt: new Date().toISOString(),
    minutesAgo: 0,
    source: "user",
    confidence
  });

  activeReports = activeReports.slice(0, 12);

  saveStoredReports();
  renderCrossings();
  renderAlerts();
  updateRouteIntelligence();
  updateTrustStats();
  updateLastUpdated();

  map.setView([crossing.lat, crossing.lng], 14);

  safeText(
    "reportConfirmation",
    `Reported ${crossing.name} as ${copy.label}. Confidence: ${confidence}.`
  );
}

function getReportCopy(type) {
  const types = {
    blocked: {
      label: "Blocked",
      shortTitle: "blocked",
      detail: "User report: crossing or road appears blocked.",
      severity: "high"
    },
    heavy: {
      label: "Heavy Delay",
      shortTitle: "heavy delay",
      detail: "User report: traffic is moving slowly near this crossing.",
      severity: "moderate"
    },
    cleared: {
      label: "Cleared",
      shortTitle: "cleared",
      detail: "User report: previous issue appears cleared.",
      severity: "low"
    },
    other: {
      label: "Other Issue",
      shortTitle: "issue",
      detail: "User report: local road issue may affect travel.",
      severity: "moderate"
    }
  };

  return types[type] || types.other;
}

function clearUserReports() {
  activeReports = activeReports.filter((report) => report.source !== "user");
  saveStoredReports();
  renderCrossings();
  renderAlerts();
  updateRouteIntelligence();
  updateTrustStats();
  updateLastUpdated();

  safeText("reportConfirmation", "Your reports were cleared. Demo reports may remain and are labeled clearly.");
  flashButton(els.clearReportsBtn, "Cleared");
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

function refreshReports() {
  expireOldReports();
  recalculateReportAges();

  renderAlerts();
  renderCrossings();
  updateRouteIntelligence();
  updateTrustStats();
  updateLastUpdated();

  flashButton(els.refreshBtn, "Updated");
}

function simulateDelay() {
  if (!crossings.length) return;

  const crossing = crossings[Math.floor(Math.random() * crossings.length)];

  activeReports.unshift({
    id: `sim-${Date.now()}`,
    crossingId: crossing.id,
    type: "blocked",
    title: `${crossing.name} blocked`,
    detail: "Simulated report: train blocking traffic near this crossing.",
    severity: "high",
    submittedAt: new Date().toISOString(),
    minutesAgo: 0,
    source: "simulated"
  });

  activeReports = activeReports.slice(0, 12);

  saveStoredReports();
  renderCrossings();
  renderAlerts();
  updateRouteIntelligence();
  updateTrustStats();
  updateLastUpdated();

  flashButton(els.simulateDelayBtn, "Delay Added");
}

function updateRouteIntelligence(nearest = []) {
  const savedHome = localStorage.getItem("gridlyHome");
  const savedWork = localStorage.getItem("gridlyWork");

  const activeIssues = activeReports.filter((report) => !report.expired && report.type !== "cleared");
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
  safeText("activeAlertText", activeIssues.length === 1 ? "One active report currently affecting the area." : "Live reports near your saved or current location.");

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
    safeText("departureReason", "High route impact detected near your commute window.");
    els.routeStatusCard?.classList.add("high");
  } else if (impact >= 40) {
    safeText("routeStatus", "Watch");
    safeText("routeEta", `ETA 26 min (+${extraMinutes})`);
    safeText("departureTime", "Leave 8 min early");
    safeText("departureReason", "Moderate risk near one or more crossings.");
    els.routeStatusCard?.classList.add("delayed");
  } else {
    safeText("routeStatus", "Clear");
    safeText("routeEta", "ETA 21 min");
    safeText("departureTime", "Normal departure");
    safeText("departureReason", "No major active delay detected.");
    els.routeStatusCard?.classList.add("clear");
  }

  if (impact >= 70) {
    safeText("delayRisk", "High");
    safeText("delayReason", "Multiple reports or one major crossing blockage detected.");
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
  recalculateReportAges();

  if (!activeReports.length) {
    els.alertsList.innerHTML = `
      <div class="alert-item">
        <strong>No active alerts</strong>
        <p>Your saved route looks quiet right now.</p>
      </div>
    `;
    return;
  }

  els.alertsList.innerHTML = activeReports
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

function recalculateReportAges() {
  activeReports = activeReports.map((report) => {
    const submittedAt = report.submittedAt ? new Date(report.submittedAt).getTime() : Date.now();
    const minutesAgo = Math.max(0, Math.floor((Date.now() - submittedAt) / 60000));

    return {
      ...report,
      minutesAgo,
      expired: minutesAgo >= REPORT_EXPIRATION_MINUTES
    };
  });

  saveStoredReports();
}

function expireOldReports() {
  recalculateReportAges();

  activeReports = activeReports.filter((report) => {
    if (report.source === "demo") return true;
    return report.minutesAgo < REPORT_EXPIRATION_MINUTES + 30;
  });

  saveStoredReports();
}

function updateTrustStats() {
  const active = activeReports.filter((report) => !report.expired);
  const lastReport = [...activeReports].sort((a, b) => {
    return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
  })[0];

  safeText("reportDecayStatus", `${REPORT_EXPIRATION_MINUTES} min expiry`);
  safeText("lastReportTime", lastReport ? `${lastReport.minutesAgo} min ago` : "None yet");
}

function getFreshnessLabel(report) {
  if (report.expired) return "Expired";
  if (report.minutesAgo >= REPORT_STALE_MINUTES) return "Stale soon";
  if (report.minutesAgo >= 15) return "Recent";
  return "Fresh";
}

function getReportForCrossing(crossingId) {
  return activeReports.find((report) => report.crossingId === crossingId);
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

function getSourceLabel(source) {
  return {
    user: "User report",
    demo: "Demo report",
    simulated: "Simulated report"
  }[source] || "Unknown source";
}

function loadStoredReports() {
  try {
    activeReports = JSON.parse(localStorage.getItem("gridlyReports")) || [];
  } catch {
    activeReports = [];
  }
}

function saveStoredReports() {
  localStorage.setItem("gridlyReports", JSON.stringify(activeReports));
}

function showFallbackAlert() {
  if (!els.alertsList) return;

  els.alertsList.innerHTML = `
    <div class="alert-item">
      <strong>Crossing data unavailable</strong>
      <p>Gridly could not load the FRA crossing feed. Try refreshing the page.</p>
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