/* =========================================================
   Liberty County Spatial Intelligence System – V5.0 (FIXED)
   ========================================================= */

// ===== APP CONFIG =====
const APP_VERSION = "5.0.1";

// ===== SUPABASE CONFIG =====
const SUPABASE_URL = "https://nhwhkbkludzkuyxmkkcj.supabase.co";
const SUPABASE_KEY = "sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO";
const SUPABASE_TABLE = "crossing_reports";

// Create Supabase client
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ===== GLOBAL STATE =====
let map;
let selectedCrossing = null;
let crossingsLayer = null;
let activeReports = {};

// ===== INIT =====
document.addEventListener("DOMContentLoaded", init);

async function init() {
  console.log("App Version:", APP_VERSION);

  initMap();
  await loadCrossings();
  await loadReports();

  setInterval(loadReports, 10000); // polling fallback
}

// ===== MAP =====
function initMap() {
  map = L.map("map").setView([30.0466, -94.8852], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
}

// ===== LOAD CROSSINGS =====
async function loadCrossings() {
  const url =
    "https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=LIBERTY";

  const res = await fetch(url);
  const geojson = await res.json();

  crossingsLayer = L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => {
      return L.circleMarker(latlng, {
        radius: 6,
        color: "#1d4ed8",
        fillColor: "#3b82f6",
        fillOpacity: 0.8,
      });
    },
    onEachFeature: (feature, layer) => {
      layer.on("click", () => selectCrossing(feature, layer));
    },
  }).addTo(map);
}

// ===== SELECT CROSSING =====
function selectCrossing(feature, layer) {
  selectedCrossing = feature;

  layer.setStyle({
    color: "#111827",
    fillColor: "#2563eb",
  });

  showPopup(feature, layer);
}

// ===== POPUP =====
function showPopup(feature, layer) {
  const p = feature.properties || {};

  layer.bindPopup(`
    <strong>${p.highwayname || "Crossing"}</strong><br>
    ID: ${p.crossingid || "N/A"}<br><br>
    <button onclick="reportBlocked()">Blocked</button>
    <button onclick="reportCleared()">Cleared</button>
  `).openPopup();
}

// ===== REPORT BLOCKED =====
async function reportBlocked() {
  if (!selectedCrossing) return;

  const p = selectedCrossing.properties;

  const payload = {
    crossing_id: p.crossingid,
    report_type: "blocked",
    status: "active",
    road_name: p.highwayname || null,
    railroad: p.railroadname || null,
    city: p.cityname || null,
    county: p.countyname || null,
    state: p.statename || null,
    lat: selectedCrossing.geometry.coordinates[1],
    lng: selectedCrossing.geometry.coordinates[0],
  };

  console.log("Sending blocked report:", payload);

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .insert([payload]);

  if (error) {
    console.error("Insert failed:", error);
    alert("❌ Failed to send report");
    return;
  }

  console.log("Insert success:", data);
  alert("✅ Report sent!");

  loadReports();
}

// ===== REPORT CLEARED =====
async function reportCleared() {
  if (!selectedCrossing) return;

  const p = selectedCrossing.properties;

  const payload = {
    crossing_id: p.crossingid,
    report_type: "cleared",
    status: "resolved",
    road_name: p.highwayname || null,
    railroad: p.railroadname || null,
    city: p.cityname || null,
    county: p.countyname || null,
    state: p.statename || null,
    lat: selectedCrossing.geometry.coordinates[1],
    lng: selectedCrossing.geometry.coordinates[0],
  };

  const { error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .insert([payload]);

  if (error) {
    console.error(error);
    alert("❌ Failed to clear");
    return;
  }

  alert("✅ Cleared!");
  loadReports();
}

// ===== LOAD REPORTS =====
async function loadReports() {
  console.log("Loading reports...");

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Load failed:", error);
    return;
  }

  console.log("Reports loaded:", data.length);
}