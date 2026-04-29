const SUPABASE_URL = "https://nhwhkbkludzkuyxmkkcj.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO";

const FRA_URL =
  "https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=LIBERTY";

const defaultCenter = [30.0466, -94.8852];
const REPORT_EXPIRATION_MINUTES = 90;
const LIVE_REFRESH_MS = 15000;
const APP_BUILD = "V12.2";

let supabaseClient = null;
let realtimeChannel = null;
let map;
let crossingLayer;
let crossingMarkers = new Map();
let crossings = [];
let activeReports = [];
let userLocation = null;
let userMarker = null;
let nearbyReportCrossingIds = new Set();
let lastSubmittedCrossing = null;
let lastSubmittedReportType = null;

let deviceId =
  localStorage.getItem("gridlyDeviceId") ||
  `device-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;

localStorage.setItem("gridlyDeviceId", deviceId);

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  hydrateElements();
  initGreeting();
  updateLastUpdated();
  initMap();
  initSupabase();
  bindEvents();
  loadSavedRoute();

  await loadCrossings();
  await loadSharedReports();

  setInterval(loadSharedReports, LIVE_REFRESH_MS);
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
    "mapTrustNote",
    "routeRecommendation",
    "routeRecommendationReason",
    "communityTrust",
    "communityTrustReason",
    "freshestReport",
    "freshestReportReason",
    "trendingList",
    "shareCard",
    "shareGridlyBtn",
    "quickClearCard",
    "quickClearBtn",
    "mobileReportBtn",
    "desktopReportNearMeBtn",
    "reportModeBanner",
    "mobileAlertsMirror",
    "habitStatusStrip",
    "habitStatusPill",
    "habitStatusHeadline",
    "habitStatusDetail"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
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
      .filter((feature) => {
        if (!feature || !feature.geometry) return false;
        if (!Array.isArray(feature.geometry.coordinates)) return false;

        const [lng, lat] = feature.geometry.coordinates;
        return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
      })
      .map((feature, index) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties || {};

        return {
          id: String(
            props.crossingid ||
              props.crossing_id ||
              props.crossing ||
              `crossing-${index}`
          ),
          name:
            props.street ||
            props.roadwayname ||
            props.highwayname ||
            props.road ||
            props.crossingname ||
            "Railroad Crossing",
          railroad:
            props.railroad ||
            props.railroadname ||
            props.railroad_company ||
            props.rrname ||
            "Rail line",
          lat: Number(lat),
          lng: Number(lng),
          risk: calculateBaseRisk(props, index),
          props
        };
      });

    populateCrossingSelect();
    renderCrossings();
    updateRouteIntelligence();
    updateTrustStats();
    updateGrowthWidgets();
    updateDailyHabitStatus();
    updateLastUpdated();

    safeText("dataStatus", `${crossings.length} known crossings loaded`);
    safeText("crossingCount", crossings.length);

    safeText(
      "mapTrustNote",
      `${crossings.length} known public crossings loaded from FRA data. Tap a marker to report or clear a crossing.`
    );
  } catch (error) {
    console.error("Gridly crossing load failed:", error);
    safeText("dataStatus", "Crossing data failed");
    safeText("crossingCount", "Failed");
    safeText("mapTrustNote", "Unable to load FRA crossing data. Refresh and try again.");
  }
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
      .limit(200);

    if (error) throw error;

    activeReports = normalizeReports(data || []);

    renderAlerts();
    renderTrendingCrossings();
    renderCrossings();
    updateRouteIntelligence();
    updateTrustStats();
    updateGrowthWidgets();
    updateDailyHabitStatus();
    updateMobileAlertsMirror();
    updateLastUpdated();

    setSync(`${activeReports.length} live reports synced`);
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

    return {
      id: row.id,
      crossingId: String(row.crossing_id),
      crossingName: row.crossing_name || "Unknown crossing",
      railroad: row.railroad || "Rail line",
      lat: Number(row.lat),
      lng: Number(row.lng),
      type: row.report_type || "other",
      severity: row.severity || getReportCopy(row.report_type).severity,
      title: `${row.crossing_name || "Crossing"} ${getReportCopy(row.report_type).shortTitle}`,
      detail: row.detail || getReportCopy(row.report_type).detail,
      source: row.source || "user",
      confidence: row.confidence || "shared live report",
      deviceId: row.device_id,
      submittedAt: createdAt,
      expiresAt: row.expires_at,
      minutesAgo,
      expired: row.expires_at ? new Date(row.expires_at).getTime() <= Date.now() : false
    };
  });
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

function renderCrossings() {
  if (!crossingLayer || !crossings.length) return;

  crossingLayer.clearLayers();
  crossingMarkers.clear();

  crossings.forEach((crossing) => {
    const report = getLatestReportForCrossing(crossing.id);
    const hasActiveIssue = report && report.type !== "cleared" && !report.expired;
    const isCleared = report && report.type === "cleared";
    const isNearby = nearbyReportCrossingIds.has(String(crossing.id));

    const icon = L.divIcon({
      className: "",
      html: `<div class="gridly-marker ${hasActiveIssue ? "alert" : ""} ${isCleared ? "cleared" : ""} ${isNearby ? "nearby" : ""}"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const marker = L.marker([crossing.lat, crossing.lng], { icon })
      .bindPopup(buildPopup(crossing, report), { maxWidth: 350 })
      .addTo(crossingLayer);

    crossingMarkers.set(String(crossing.id), marker);
  });
}

function buildPopup(crossing, report) {
  const status = report
    ? report.type === "cleared"
      ? "Recently cleared"
      : report.title
    : "No active report";

  const freshness = report ? `${report.minutesAgo} min ago` : "No recent report";
  const trustCount = getReportCountForCrossing(crossing.id);

  const trustLabel =
    trustCount >= 3
      ? `${trustCount} confirmations`
      : trustCount === 1
      ? "1 shared report"
      : trustCount > 1
      ? `${trustCount} shared reports`
      : "No community reports yet";

  return `
    <div class="gridly-popup">
      <strong>${sanitizeText(crossing.name)}</strong>
      <span>${sanitizeText(crossing.railroad)}</span><br />
      <span>Status: ${sanitizeText(status)}</span><br />
      <span>Freshness: ${sanitizeText(freshness)}</span><br />
      <span>Trust: ${sanitizeText(trustLabel)}</span><br />
      <span>Risk Score: ${crossing.risk}/100</span>

      <div class="popup-report-grid">
        <button class="popup-report-btn danger" onclick="reportCrossingFromPopup('${sanitizeText(crossing.id)}', 'blocked', this)">Blocked</button>
        <button class="popup-report-btn warning" onclick="reportCrossingFromPopup('${sanitizeText(crossing.id)}', 'heavy', this)">Delay</button>
        <button class="popup-report-btn blue" onclick="reportCrossingFromPopup('${sanitizeText(crossing.id)}', 'cleared', this)">Cleared</button>
        <button class="popup-report-btn neutral" onclick="reportCrossingFromPopup('${sanitizeText(crossing.id)}', 'other', this)">Other</button>
      </div>
    </div>
  `;
}

window.reportCrossingFromPopup = async function (crossingId, reportType, buttonEl) {
  const crossing = crossings.find((item) => String(item.id) === String(crossingId));

  if (!crossing) {
    setConfirmation("Crossing not found. Try refreshing.", "error");
    return;
  }

  await createSharedReport(crossing, reportType, "exact map marker", buttonEl);
};

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

function bindEvents() {
  els.saveRouteBtn?.addEventListener("click", saveRoute);
  els.useLocationBtn?.addEventListener("click", handleReportNearMe);

  els.refreshBtn?.addEventListener("click", async () => {
    await loadSharedReports();
    flashButton(els.refreshBtn, "Updated");
  });

  els.manualReportBtn?.addEventListener("click", submitManualReport);
  els.clearReportsBtn?.addEventListener("click", loadSharedReports);
  els.crossingSearch?.addEventListener("input", handleCrossingSearch);
  els.shareGridlyBtn?.addEventListener("click", shareGridly);

  els.mobileReportBtn?.addEventListener("click", handleSmartReportButton);
  els.desktopReportNearMeBtn?.addEventListener("click", handleReportNearMe);

  els.quickClearBtn?.addEventListener("click", async () => {
    if (!lastSubmittedCrossing) {
      setConfirmation("No recent crossing selected to clear.", "error");
      return;
    }

    await createSharedReport(lastSubmittedCrossing, "cleared", "quick clear follow-up", els.quickClearBtn);
    els.quickClearCard?.classList.remove("visible");
    resetSmartReportButton();
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

      if (btn.dataset.section === "map") {
        setTimeout(() => map?.invalidateSize(), 350);
      }
    });
  });

  document.querySelectorAll("[data-section-jump]").forEach((btn) => {
    btn.addEventListener("click", () => {
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

      if (userMarker) map.removeLayer(userMarker);

      userMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 9,
        color: "#43e6a0",
        fillColor: "#43e6a0",
        fillOpacity: 0.85
      })
        .bindPopup("Your current location")
        .addTo(map);

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
    els.mobileReportBtn.textContent = "Report Near Me";
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
}

function submitManualReport() {
  const crossing = crossings.find((item) => String(item.id) === String(els.crossingSelect?.value));
  const reportType = els.manualReportType?.value || "blocked";

  if (!crossing) {
    setConfirmation("Choose a crossing before submitting a report.", "error");
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

  const expiresAt = new Date(Date.now() + REPORT_EXPIRATION_MINUTES * 60000).toISOString();

  const row = {
    crossing_id: String(crossing.id),
    crossing_name: crossing.name,
    railroad: crossing.railroad,
    lat: crossing.lat,
    lng: crossing.lng,
    report_type: reportType,
    severity: copy.severity,
    detail: copy.detail,
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

    await loadSharedReports();

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
            buttonEl.textContent = "Report Near Me";
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

function saveRoute() {
  const home = els.homeInput?.value.trim();
  const work = els.workInput?.value.trim();

  if (!home || !work) {
    flashButton(els.saveRouteBtn, "Add Home + Work");
    return;
  }

  localStorage.setItem("gridlyHome", home);
  localStorage.setItem("gridlyWork", work);

  loadSavedRoute();
  updateRouteIntelligence();
  updateGrowthWidgets();
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
    safeText("departureReason", "Home and Work unlock personalized route intelligence.");
    els.routeStatusCard?.classList.add("delayed");
  } else if (impact >= 70) {
    safeText("routeStatus", "Delayed");
    safeText("routeEta", `ETA 32 min (+${extraMinutes})`);
    safeText("departureTime", "Leave now");
    safeText("departureReason", "High shared route impact detected.");
    els.routeStatusCard?.classList.add("high");
  } else if (impact >= 40) {
    safeText("routeStatus", "Watch");
    safeText("routeEta", `ETA 26 min (+${extraMinutes})`);
    safeText("departureTime", "Leave 8 min early");
    safeText("departureReason", "Moderate shared report risk detected.");
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
    safeText("delayReason", "Major crossing blockage detected.");
    safeText("alternateRoute", "Use alternate");
    safeText("alternateReason", "Avoid highest-impact crossing if possible.");
    safeText("impactText", "High route impact. Leave now or reroute.");
  } else if (impact >= 40) {
    safeText("delayRisk", "Moderate");
    safeText("delayReason", "Some crossing or traffic risk detected.");
    safeText("alternateRoute", "Have backup");
    safeText("alternateReason", "Alternate route may help if reports increase.");
    safeText("impactText", "Moderate route impact. Watch before leaving.");
  } else {
    safeText("delayRisk", "Low");
    safeText("delayReason", "No major live reports affecting the area.");
    safeText("alternateRoute", "Not needed");
    safeText("alternateReason", "Current route appears clear.");
    safeText("impactText", "Low route impact. Normal travel expected.");
  }
}

function updateDailyHabitStatus() {
  const latestReports = getLatestReportsByCrossing();
  const activeIssues = latestReports.filter((report) => !report.expired && report.type !== "cleared");
  const highIssues = activeIssues.filter((report) => report.severity === "high");
  const moderateIssues = activeIssues.filter((report) => report.severity === "moderate");

  const freshest = [...activeReports].sort(
    (a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
  )[0];

  let pill = "All Clear";
  let headline = "No major rail delays reported right now";
  let detail = "Gridly is quiet. Check again before you leave, and report anything you see.";
  let cardClass = "clear";

  if (highIssues.length > 0) {
    pill = "Major Delay Active";
    headline = `${highIssues.length} high-impact crossing alert${highIssues.length === 1 ? "" : "s"} active`;
    detail = freshest
      ? `Freshest report: ${freshest.crossingName} · ${freshest.minutesAgo} min ago.`
      : "High-impact shared reports are active. Check the map before leaving.";
    cardClass = "high";
  } else if (moderateIssues.length > 0 || activeIssues.length > 0) {
    pill = "Use Caution";
    headline = `${activeIssues.length} active crossing report${activeIssues.length === 1 ? "" : "s"} nearby`;
    detail = freshest
      ? `Latest driver signal: ${freshest.crossingName} · ${freshest.minutesAgo} min ago.`
      : "There is some live report activity. Check the map before choosing your route.";
    cardClass = "delayed";
  }

  safeText("habitStatusPill", pill);
  safeText("habitStatusHeadline", headline);
  safeText("habitStatusDetail", detail);

  els.habitStatusStrip?.classList.remove("clear", "delayed", "high");
  els.habitStatusStrip?.classList.add(cardClass);
}

function updateGrowthWidgets() {
  const latestReports = getLatestReportsByCrossing();
  const activeIssues = latestReports.filter((report) => !report.expired && report.type !== "cleared");
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
    safeText("routeRecommendation", "Route looks clear");
    safeText("routeRecommendationReason", "No major active shared delays detected right now.");
  }

  const confirmationCount = activeReports.length;

  if (confirmationCount >= 5) {
    safeText("communityTrust", "Strong local signal");
    safeText("communityTrustReason", `${confirmationCount} fresh reports are helping drivers right now.`);
  } else if (confirmationCount > 0) {
    safeText("communityTrust", "Early signal active");
    safeText("communityTrustReason", `${confirmationCount} fresh report${confirmationCount === 1 ? "" : "s"} currently active.`);
  } else {
    safeText("communityTrust", "Waiting for reports");
    safeText("communityTrustReason", "The first shared report helps everyone nearby.");
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
    .slice(0, 8)
    .map((incident) => {
      const latest = incident.latestReport;

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
          <p>${label} · newest ${incident.newestMinutes} min ago</p>
          <p>${sanitizeText(latest.detail)}</p>
          <div class="alert-meta">
            <span class="alert-count-pill">${incident.count} confirmation${incident.count === 1 ? "" : "s"}</span>
            <span class="source-pill">First reported ${incident.oldestMinutes} min ago</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTrendingCrossings() {
  if (!els.trendingList) return;

  const incidents = getConsolidatedIncidents().slice(0, 5);

  if (!incidents.length) {
    els.trendingList.innerHTML = `<div class="trend-item muted">Waiting for shared reports...</div>`;
    return;
  }

  els.trendingList.innerHTML = incidents
    .map((incident) => {
      const latest = incident.latestReport;

      const className =
        latest.type === "cleared"
          ? "clear"
          : latest.severity === "high"
          ? "hot"
          : "";

      return `
        <button class="trend-item ${className}" type="button" onclick="zoomToCrossing('${sanitizeText(incident.crossingId)}')">
          <strong>${sanitizeText(incident.crossingName)}</strong>
          <p>${incident.count} confirmation${incident.count === 1 ? "" : "s"} · newest ${incident.newestMinutes} min ago</p>
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
  safeText("nearbyAlertCount", active.filter((report) => report.type !== "cleared").length);
}

function getLatestReportForCrossing(crossingId) {
  return activeReports
    .filter((report) => String(report.crossingId) === String(crossingId))
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

function getConsolidatedIncidents() {
  const grouped = new Map();

  activeReports
    .filter((report) => !report.expired)
    .forEach((report) => {
      const key = String(report.crossingId);

      if (!grouped.has(key)) {
        grouped.set(key, {
          crossingId: key,
          crossingName: report.crossingName,
          reports: []
        });
      }

      grouped.get(key).reports.push(report);
    });

  return [...grouped.values()]
    .map((incident) => {
      const sorted = incident.reports.sort(
        (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
      );

      return {
        crossingId: incident.crossingId,
        crossingName: incident.crossingName,
        count: sorted.length,
        latestReport: sorted[0],
        newestMinutes: Math.min(...sorted.map((r) => r.minutesAgo)),
        oldestMinutes: Math.max(...sorted.map((r) => r.minutesAgo))
      };
    })
    .sort((a, b) => {
      const severityScore = (incident) => {
        const report = incident.latestReport;
        if (report.type === "cleared") return 0;
        if (report.severity === "high") return 3;
        if (report.severity === "moderate") return 2;
        return 1;
      };

      return severityScore(b) - severityScore(a) || b.count - a.count || a.newestMinutes - b.newestMinutes;
    });
}

function getReportCountForCrossing(crossingId) {
  return activeReports.filter(
    (report) => String(report.crossingId) === String(crossingId) && !report.expired
  ).length;
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
   GRIDLY V12.3 — CROSSING REVIEW MODE
   Safe temporary review tool
   Activate with: ?review=1
========================================================= */

const REVIEW_MODE_ACTIVE = new URLSearchParams(window.location.search).get("review") === "1";
const REVIEW_STORAGE_KEY = "gridlyCrossingReviewDecisionsV123";

let crossingReviewDecisions = JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY) || "{}");

const originalLoadCrossingsV123 = loadCrossings;

loadCrossings = async function () {
  await originalLoadCrossingsV123();

  if (REVIEW_MODE_ACTIVE) {
    initCrossingReviewMode();
  }
};

function initCrossingReviewMode() {
  injectCrossingReviewStyles();
  buildCrossingReviewPanel();
  safeText("mapTrustNote", "Crossing Review Mode is active. Normal users do not see this.");
}

function buildCrossingReviewPanel() {
  const existing = document.getElementById("crossingReviewPanel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "crossingReviewPanel";
  panel.className = "crossing-review-panel";

  panel.innerHTML = `
    <div class="review-header">
      <div>
        <strong>Gridly V12.3 Review Mode</strong>
        <span>${crossings.length} FRA crossings loaded</span>
      </div>
      <button type="button" onclick="exportCrossingReviewDecisions()">Export JSON</button>
    </div>

    <div class="review-help">
      Mark crossings as Keep, Hide, Rename, or Needs Check. Nothing is permanently changed.
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
  const decision = crossingReviewDecisions[String(crossing.id)] || {};
  const status = decision.action || "unreviewed";
  const nickname = decision.localName || "";

  return `
    <div class="review-item ${status}" id="review-${sanitizeText(crossing.id)}">
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
        placeholder="Local nickname / better name"
        value="${sanitizeText(nickname)}"
        onchange="setCrossingNickname('${sanitizeText(crossing.id)}', this.value)"
      />

      <div class="review-actions">
        <button onclick="setCrossingReview('${sanitizeText(crossing.id)}', 'keep')">Keep</button>
        <button onclick="setCrossingReview('${sanitizeText(crossing.id)}', 'hide')">Hide</button>
        <button onclick="setCrossingReview('${sanitizeText(crossing.id)}', 'rename')">Rename</button>
        <button onclick="setCrossingReview('${sanitizeText(crossing.id)}', 'needs_check')">Needs Check</button>
        <button onclick="zoomToCrossing('${sanitizeText(crossing.id)}')">Zoom</button>
      </div>

      <div class="review-status">Status: ${sanitizeText(status)}</div>
    </div>
  `;
}

window.setCrossingReview = function (crossingId, action) {
  crossingReviewDecisions[String(crossingId)] = {
    ...(crossingReviewDecisions[String(crossingId)] || {}),
    action,
    reviewedAt: new Date().toISOString()
  };

  localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(crossingReviewDecisions, null, 2));
  buildCrossingReviewPanel();
};

window.setCrossingNickname = function (crossingId, value) {
  crossingReviewDecisions[String(crossingId)] = {
    ...(crossingReviewDecisions[String(crossingId)] || {}),
    localName: value.trim(),
    reviewedAt: new Date().toISOString()
  };

  localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(crossingReviewDecisions, null, 2));
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
      width: 380px;
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
      opacity: 0.78;
    }

    .review-item.rename {
      border-color: rgba(88, 166, 255, 0.75);
    }

    .review-item.needs_check {
      border-color: rgba(255, 204, 102, 0.8);
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

    .review-item input {
      width: 100%;
      margin-top: 8px;
      margin-bottom: 8px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(0, 0, 0, 0.22);
      color: #fff;
      padding: 8px;
      font-size: 12px;
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