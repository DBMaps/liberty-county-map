/* =========================================================
   GRIDLY V9.1
   Full Replacement js/app.js
   Focus: Report Buttons + Shared Sync + Strong Debug
   Pure HTML / CSS / JS
========================================================= */

/* -----------------------------
   CONFIG
----------------------------- */
const SUPABASE_URL = "https://nhwhkbkludzkuyxmkkcj.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO";

const REPORT_EXP_MINUTES = 90;
const POLL_MS = 15000;

/* -----------------------------
   GLOBALS
----------------------------- */
let supabaseClient = null;
let realtimeChannel = null;
let crossings = [];
let reports = [];
let map = null;
let crossingLayer = null;

const els = {};

/* -----------------------------
   STARTUP
----------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  hydrate();
  initSupabase();
  initMap();
  bindButtons();
  setDebug("Booting Gridly V9.1");

  await loadCrossings();
  await loadReports();
  startPolling();
});

/* -----------------------------
   ELEMENTS
----------------------------- */
function hydrate() {
  [
    "reportConfirmation",
    "crossingSelect",
    "manualReportType",
    "manualReportBtn",
    "clearReportsBtn",
    "syncStatus",
    "alertsList"
  ].forEach(id => {
    els[id] = document.getElementById(id);
  });
}

/* -----------------------------
   DEBUG
----------------------------- */
function setDebug(msg) {
  if (els.syncStatus) els.syncStatus.textContent = msg;
}

/* -----------------------------
   SUPABASE
----------------------------- */
function initSupabase() {
  try {
    if (!window.supabase) {
      setDebug("Supabase JS missing");
      return;
    }

    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY
    );

    setDebug("Supabase connected");

    realtimeChannel = supabaseClient
      .channel("gridly-reports-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reports"
        },
        payload => {
          console.log("Realtime event:", payload);
          loadReports();
        }
      )
      .subscribe(status => {
        setDebug("Realtime: " + status);
      });

  } catch (err) {
    console.error(err);
    setDebug("Supabase failed");
  }
}

/* -----------------------------
   MAP
----------------------------- */
function initMap() {
  map = L.map("map").setView([30.0466, -94.8852], 11);

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }
  ).addTo(map);

  crossingLayer = L.layerGroup().addTo(map);
}

/* -----------------------------
   LOAD CROSSINGS
----------------------------- */
async function loadCrossings() {
  try {
    const url =
      "https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=LIBERTY";

    const res = await fetch(url);
    const data = await res.json();

    crossings = (data.features || [])
  .filter(f =>
    f &&
    f.geometry &&
    Array.isArray(f.geometry.coordinates)
  )
  .map((f, i) => {
      const p = f.properties || {};
      const [lng, lat] = f.geometry.coordinates;

      return {
        id: p.crossingid || "x" + i,
        name:
          p.street ||
          p.roadwayname ||
          "Crossing",
        railroad:
          p.railroad ||
          "Railroad",
        lat,
        lng
      };
    });

    populateCrossingSelect();
    renderCrossings();

  } catch (err) {
    console.error(err);
    setDebug("Crossings failed");
  }
}

/* -----------------------------
   SELECT MENU
----------------------------- */
function populateCrossingSelect() {
  if (!els.crossingSelect) return;

  els.crossingSelect.innerHTML =
    `<option value="">Choose crossing</option>` +
    crossings.map(c =>
      `<option value="${c.id}">
        ${escapeHtml(c.name)} · ${escapeHtml(c.railroad)}
      </option>`
    ).join("");
}

/* -----------------------------
   RENDER MAP MARKERS
----------------------------- */
function renderCrossings() {
  if (!crossingLayer) return;

  crossingLayer.clearLayers();

  crossings.forEach(c => {
    const report = latestReport(c.id);

    const marker = L.circleMarker(
      [c.lat, c.lng],
      {
        radius: 8,
        color: reportColor(report),
        fillColor: reportColor(report),
        fillOpacity: 0.9
      }
    );

    marker.bindPopup(buildPopup(c, report));
    marker.addTo(crossingLayer);
  });
}

/* -----------------------------
   POPUP HTML
----------------------------- */
function buildPopup(c, report) {
  return `
    <div style="min-width:220px">
      <strong>${escapeHtml(c.name)}</strong><br>
      <small>${escapeHtml(c.railroad)}</small><br><br>

      Status:
      ${report ? report.report_type : "No active report"}<br><br>

      <button onclick="popupReport('${c.id}','blocked')">Blocked</button>
      <button onclick="popupReport('${c.id}','heavy')">Delay</button>
      <button onclick="popupReport('${c.id}','cleared')">Cleared</button>
      <button onclick="popupReport('${c.id}','other')">Other</button>
    </div>
  `;
}

/* -----------------------------
   GLOBAL POPUP HANDLER
----------------------------- */
window.popupReport = async function(id, type) {
  const crossing = crossings.find(x => x.id === id);
  if (!crossing) return;

  await submitReport(crossing, type);
};

/* -----------------------------
   BUTTONS
----------------------------- */
function bindButtons() {
  els.manualReportBtn?.addEventListener("click", async () => {
    const id = els.crossingSelect.value;
    const type = els.manualReportType.value;

    const crossing = crossings.find(x => x.id === id);

    if (!crossing) {
      confirmMsg("Choose a crossing first");
      return;
    }

    await submitReport(crossing, type);
  });

  els.clearReportsBtn?.addEventListener("click", loadReports);
}

/* -----------------------------
   SUBMIT REPORT
----------------------------- */
async function submitReport(crossing, type) {
  if (!supabaseClient) {
    confirmMsg("Supabase not connected");
    return;
  }

  try {
    setDebug("Sending report...");

    const expires = new Date(
      Date.now() + REPORT_EXP_MINUTES * 60000
    ).toISOString();

    const row = {
      crossing_id: crossing.id,
      crossing_name: crossing.name,
      railroad: crossing.railroad,
      lat: crossing.lat,
      lng: crossing.lng,
      report_type: type,
      created_at: new Date().toISOString(),
      expires_at: expires
    };

    const { error } =
      await supabaseClient
        .from("reports")
        .insert(row);

    if (error) throw error;

    confirmMsg(
      `${crossing.name}: ${type} submitted`
    );

    setDebug("Write success");

    await loadReports();

  } catch (err) {
    console.error(err);
    confirmMsg("Submit failed");
    setDebug("Write failed");
  }
}

/* -----------------------------
   LOAD REPORTS
----------------------------- */
async function loadReports() {
  if (!supabaseClient) return;

  try {
    const now = new Date().toISOString();

    const { data, error } =
      await supabaseClient
        .from("reports")
        .select("*")
        .gt("expires_at", now)
        .order("created_at", {
          ascending: false
        });

    if (error) throw error;

    reports = data || [];

    renderAlerts();
    renderCrossings();

    setDebug(
      "Reports synced: " + reports.length
    );

  } catch (err) {
    console.error(err);
    setDebug("Read failed");
  }
}

/* -----------------------------
   ALERT PANEL
----------------------------- */
function renderAlerts() {
  if (!els.alertsList) return;

  if (!reports.length) {
    els.alertsList.innerHTML =
      "<div>No active reports</div>";
    return;
  }

  els.alertsList.innerHTML =
    reports.slice(0, 8).map(r => `
      <div class="alert-item">
        <strong>${escapeHtml(r.crossing_name)}</strong>
        <p>${r.report_type}</p>
      </div>
    `).join("");
}

/* -----------------------------
   HELPERS
----------------------------- */
function latestReport(id) {
  return reports.find(r => r.crossing_id === id);
}

function reportColor(r) {
  if (!r) return "#4da3ff";
  if (r.report_type === "blocked") return "#ff5c7a";
  if (r.report_type === "cleared") return "#43e6a0";
  if (r.report_type === "heavy") return "#ffd166";
  return "#999";
}

function confirmMsg(msg) {
  if (els.reportConfirmation) {
    els.reportConfirmation.textContent = msg;
  }
}

function startPolling() {
  setInterval(loadReports, POLL_MS);
}

function escapeHtml(v) {
  return String(v || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}