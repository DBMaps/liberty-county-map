const LIBERTY_BOUNDARY_FILE = './data/liberty-county-boundary.geojson';
const SAVED_PLACES_KEY = 'liberty_county_saved_places_v34';
const TRAIN_DELAY_STORE_KEY = 'liberty_train_delay_reports_v1';

const DAYTON_ANCHOR = {
  name: 'Dayton, TX',
  lat: 30.046605,
  lng: -94.885202
};

let map;
let cartoLayer;
let esriLayer;
let libertyBoundaryLayer = null;
let libertyBoundaryFeature = null;
let libertyBoundaryData = null;
let searchMarker = null;
let clickMarker = null;
let savedPlacesLayer = null;
let tempSearchLatLng = null;

let savedPlaces = [];

const debugState = {
  filePath: LIBERTY_BOUNDARY_FILE,
  featureCount: '--',
  selectedFeature: '--',
  geometryType: '--',
  bounds: '--',
  loadStatus: 'Waiting for boundary file...'
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  initMap();
  initUi();
  renderDebugPanel();
  setSystemStatus('Loading Liberty County boundary from local GeoJSON...');
  loadSavedPlaces();
  await loadBoundary();
}

function initMap() {
  map = L.map('map', {
    center: [DAYTON_ANCHOR.lat, DAYTON_ANCHOR.lng],
    zoom: 11,
    zoomControl: true
  });

  cartoLayer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }
  );

  esriLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri'
    }
  );

  cartoLayer.addTo(map);

  savedPlacesLayer = L.layerGroup().addTo(map);

  const daytonMarker = L.circleMarker([DAYTON_ANCHOR.lat, DAYTON_ANCHOR.lng], {
    radius: 7,
    color: '#1d4ed8',
    weight: 2,
    fillColor: '#5cc8ff',
    fillOpacity: 0.95
  }).addTo(map);

  daytonMarker.bindPopup(`<strong>${DAYTON_ANCHOR.name}</strong><br />Reference anchor for distance calculations.`);

  map.on('click', handleMapClick);
}

function initUi() {
  byId('searchBtn')?.addEventListener('click', handleSearch);
  byId('searchInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });

  byId('fitCountyBtn')?.addEventListener('click', fitCountyView);
  byId('fitDaytonBtn')?.addEventListener('click', () => {
    map.setView([DAYTON_ANCHOR.lat, DAYTON_ANCHOR.lng], 12);
  });
  byId('fitSavedBtn')?.addEventListener('click', fitSavedPlacesView);
  byId('clearTempBtn')?.addEventListener('click', clearSearchResult);

  byId('exportSavedBtn')?.addEventListener('click', exportSavedPlaces);
  byId('clearSavedBtn')?.addEventListener('click', clearSavedPlaces);

  byId('cartoBtn')?.addEventListener('click', () => switchBasemap('carto'));
  byId('esriBtn')?.addEventListener('click', () => switchBasemap('esri'));
}

function byId(id) {
  return document.getElementById(id);
}

function setSystemStatus(message) {
  const el = byId('systemStatus');
  if (el) {
    el.innerHTML = `<strong>System status</strong><br />${escapeHtml(message)}`;
  }
}

function renderDebugPanel() {
  const panel = byId('debugPanel');
  if (!panel) return;

  panel.innerHTML =
    `<strong>Loaded file path:</strong> ${escapeHtml(debugState.filePath)}\n` +
    `<strong>Feature count:</strong> ${escapeHtml(String(debugState.featureCount))}\n` +
    `<strong>Selected feature name:</strong> ${escapeHtml(debugState.selectedFeature)}\n` +
    `<strong>Geometry type:</strong> ${escapeHtml(debugState.geometryType)}\n` +
    `<strong>Bounds:</strong> ${escapeHtml(debugState.bounds)}\n` +
    `<strong>Load status:</strong> ${escapeHtml(debugState.loadStatus)}`;
}

async function loadBoundary() {
  try {
    const response = await fetch(LIBERTY_BOUNDARY_FILE, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    validateGeoJson(data);

    const selectedFeature = chooseBoundaryFeature(data.features);
    if (!selectedFeature) {
      throw new Error('No valid Polygon or MultiPolygon feature found.');
    }

    libertyBoundaryData = data;
    libertyBoundaryFeature = selectedFeature;

    if (libertyBoundaryLayer) {
      map.removeLayer(libertyBoundaryLayer);
    }

    libertyBoundaryLayer = L.geoJSON(selectedFeature, {
      style: {
        color: '#2b8cc4',
        weight: 3,
        opacity: 1,
        fillColor: '#5cc8ff',
        fillOpacity: 0.08
      }
    }).addTo(map);

    const bounds = libertyBoundaryLayer.getBounds();

    debugState.featureCount = data.features.length;
    debugState.selectedFeature = getFeatureName(selectedFeature);
    debugState.geometryType = selectedFeature.geometry?.type || '--';
    debugState.bounds = formatBounds(bounds);
    debugState.loadStatus = 'Loaded successfully';

    renderDebugPanel();
    setSystemStatus('Liberty County boundary loaded successfully.');
    map.fitBounds(bounds, { padding: [20, 20] });
  } catch (error) {
    console.error('Boundary load error:', error);

    debugState.featureCount = 0;
    debugState.selectedFeature = '--';
    debugState.geometryType = '--';
    debugState.bounds = '--';
    debugState.loadStatus = `Load failed: ${error.message}`;

    renderDebugPanel();
    setSystemStatus(`Boundary load failed: ${error.message}`);
  }
}

function validateGeoJson(data) {
  if (!data || data.type !== 'FeatureCollection') {
    throw new Error('Boundary file is not a valid FeatureCollection.');
  }

  if (!Array.isArray(data.features) || data.features.length === 0) {
    throw new Error('Boundary file contains no features.');
  }

  const valid = data.features.some((feature) => {
    const type = feature?.geometry?.type;
    return type === 'Polygon' || type === 'MultiPolygon';
  });

  if (!valid) {
    throw new Error('Boundary file contains no Polygon or MultiPolygon geometry.');
  }
}

function chooseBoundaryFeature(features) {
  const validFeatures = features.filter((feature) => {
    const type = feature?.geometry?.type;
    return type === 'Polygon' || type === 'MultiPolygon';
  });

  if (!validFeatures.length) {
    return null;
  }

  const namedLiberty = validFeatures.find((feature) =>
    getFeatureName(feature).toLowerCase().includes('liberty')
  );

  return namedLiberty || validFeatures[0];
}

function getFeatureName(feature) {
  if (!feature?.properties) return 'Unnamed feature';

  return (
    feature.properties.NAME ||
    feature.properties.name ||
    feature.properties.NAMELSAD ||
    feature.properties.COUNTY ||
    feature.properties.county ||
    feature.properties.County ||
    'Unnamed feature'
  );
}

function formatBounds(bounds) {
  if (!bounds) return '--';

  return [
    `W: ${bounds.getWest().toFixed(6)}`,
    `S: ${bounds.getSouth().toFixed(6)}`,
    `E: ${bounds.getEast().toFixed(6)}`,
    `N: ${bounds.getNorth().toFixed(6)}`
  ].join(' | ');
}

function fitCountyView() {
  if (libertyBoundaryLayer) {
    map.fitBounds(libertyBoundaryLayer.getBounds(), { padding: [20, 20] });
  }
}

function fitSavedPlacesView() {
  if (!savedPlaces.length) {
    alert('No saved places found.');
    return;
  }

  const bounds = L.latLngBounds(savedPlaces.map((p) => [p.lat, p.lng]));
  map.fitBounds(bounds, { padding: [30, 30] });
}

function clearSearchResult() {
  if (searchMarker) {
    map.removeLayer(searchMarker);
    searchMarker = null;
  }
  tempSearchLatLng = null;
  setSystemStatus('Temporary search result cleared.');
}

async function handleSearch() {
  const input = byId('searchInput');
  if (!input) return;

  const query = input.value.trim();
  if (!query) {
    alert('Enter a place or address to search.');
    return;
  }

  setSystemStatus(`Searching for "${query}"...`);

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Search request failed with HTTP ${response.status}`);
    }

    const results = await response.json();

    if (!Array.isArray(results) || results.length === 0) {
      setSystemStatus(`No results found for "${query}".`);
      alert('No search results found.');
      return;
    }

    const result = results[0];
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    tempSearchLatLng = { lat, lng };

    if (searchMarker) {
      map.removeLayer(searchMarker);
    }

    searchMarker = L.marker([lat, lng]).addTo(map);
    searchMarker.bindPopup(
      `<strong>${escapeHtml(result.display_name)}</strong><br />${getCountyStatusText({ lat, lng })}`
    ).openPopup();

    map.setView([lat, lng], 14);
    renderInsight({
      lat,
      lng,
      title: 'Search result',
      subtitle: result.display_name
    });

    setSystemStatus(`Search completed for "${query}".`);
  } catch (error) {
    console.error('Search error:', error);
    setSystemStatus(`Search failed: ${error.message}`);
    alert(`Search failed: ${error.message}`);
  }
}

function handleMapClick(e) {
  const { lat, lng } = e.latlng;

  if (clickMarker) {
    map.removeLayer(clickMarker);
  }

  clickMarker = L.marker([lat, lng]).addTo(map);
  clickMarker.bindPopup(`<strong>Selected location</strong><br />${lat.toFixed(6)}, ${lng.toFixed(6)}`).openPopup();

  renderInsight({
    lat,
    lng,
    title: 'Clicked location',
    subtitle: 'Interactive map inspection'
  });
}

function renderInsight({ lat, lng, title, subtitle }) {
  const insightPanel = byId('insightPanel');
  if (!insightPanel) return;

  const insideCounty = isInsideLibertyCounty({ lat, lng });
  const milesFromDayton = getDistanceMiles(lat, lng, DAYTON_ANCHOR.lat, DAYTON_ANCHOR.lng);

  insightPanel.innerHTML = `
    <strong>Location insight</strong><br />
    <div style="margin-top:8px;">
      <div><strong>${escapeHtml(title)}</strong></div>
      <div class="tiny">${escapeHtml(subtitle)}</div>
      <div style="margin-top:8px;"><strong>Latitude:</strong> ${lat.toFixed(6)}</div>
      <div><strong>Longitude:</strong> ${lng.toFixed(6)}</div>
      <div><strong>County status:</strong> ${insideCounty ? 'Inside Liberty County' : 'Outside Liberty County'}</div>
      <div><strong>Distance from Dayton anchor:</strong> ${milesFromDayton.toFixed(2)} miles</div>
      <div style="margin-top:10px;">
        <button id="saveCurrentPlaceBtn" class="btn btn-primary btn-small">Save this place</button>
      </div>
    </div>
  `;

  const saveBtn = byId('saveCurrentPlaceBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      savePlace({
        name: title === 'Search result' ? subtitle : `Saved Place ${savedPlaces.length + 1}`,
        lat,
        lng,
        insideCounty
      });
    });
  }
}

function savePlace(place) {
  const entry = {
    id: cryptoRandomId(),
    name: place.name || `Saved Place ${savedPlaces.length + 1}`,
    lat: Number(place.lat),
    lng: Number(place.lng),
    insideCounty: Boolean(place.insideCounty),
    createdAt: new Date().toISOString()
  };

  savedPlaces.unshift(entry);
  persistSavedPlaces();
  renderSavedPlaces();
  redrawSavedPlaceMarkers();
  setSystemStatus(`Saved place: ${entry.name}`);
}

function loadSavedPlaces() {
  try {
    const raw = localStorage.getItem(SAVED_PLACES_KEY);
    savedPlaces = raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn('Could not load saved places.', error);
    savedPlaces = [];
  }

  renderSavedPlaces();
  redrawSavedPlaceMarkers();
}

function persistSavedPlaces() {
  localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(savedPlaces));
}

function renderSavedPlaces() {
  const list = byId('savedList');
  if (!list) return;

  if (!savedPlaces.length) {
    list.innerHTML = `<div class="tiny">No saved places yet.</div>`;
    return;
  }

  list.innerHTML = savedPlaces
    .map((place) => {
      return `
        <div class="saved-item">
          <div class="saved-item-title">${escapeHtml(place.name)}</div>
          <div class="saved-item-meta">
            ${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}<br />
            ${place.insideCounty ? 'Inside Liberty County' : 'Outside Liberty County'}<br />
            ${new Date(place.createdAt).toLocaleString()}
          </div>
          <div class="saved-item-actions">
            <button class="btn btn-light btn-small" data-action="zoom" data-id="${place.id}">Zoom</button>
            <button class="btn btn-ghost btn-small" data-action="delete" data-id="${place.id}">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');

  list.querySelectorAll('[data-action="zoom"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = savedPlaces.find((p) => p.id === btn.dataset.id);
      if (!item) return;
      map.setView([item.lat, item.lng], 15);
      renderInsight({
        lat: item.lat,
        lng: item.lng,
        title: item.name,
        subtitle: 'Saved place'
      });
    });
  });

  list.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteSavedPlace(btn.dataset.id);
    });
  });
}

function deleteSavedPlace(id) {
  savedPlaces = savedPlaces.filter((p) => p.id !== id);
  persistSavedPlaces();
  renderSavedPlaces();
  redrawSavedPlaceMarkers();
  setSystemStatus('Saved place removed.');
}

function clearSavedPlaces() {
  if (!savedPlaces.length) {
    alert('No saved places to clear.');
    return;
  }

  const confirmed = confirm('Clear all saved places?');
  if (!confirmed) return;

  savedPlaces = [];
  persistSavedPlaces();
  renderSavedPlaces();
  redrawSavedPlaceMarkers();
  setSystemStatus('All saved places cleared.');
}

function exportSavedPlaces() {
  const data = {
    exportedAt: new Date().toISOString(),
    count: savedPlaces.length,
    savedPlaces
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'liberty-county-saved-places.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  setSystemStatus('Saved places exported.');
}

function redrawSavedPlaceMarkers() {
  savedPlacesLayer.clearLayers();

  savedPlaces.forEach((place) => {
    const marker = L.circleMarker([place.lat, place.lng], {
      radius: 6,
      color: place.insideCounty ? '#60d394' : '#ffd166',
      weight: 2,
      fillColor: place.insideCounty ? '#60d394' : '#ffd166',
      fillOpacity: 0.85
    });

    marker.bindPopup(`
      <strong>${escapeHtml(place.name)}</strong><br />
      ${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}<br />
      ${place.insideCounty ? 'Inside Liberty County' : 'Outside Liberty County'}
    `);

    marker.addTo(savedPlacesLayer);
  });
}

function switchBasemap(mode) {
  if (mode === 'carto') {
    if (map.hasLayer(esriLayer)) map.removeLayer(esriLayer);
    if (!map.hasLayer(cartoLayer)) cartoLayer.addTo(map);
    byId('cartoBtn')?.classList.add('active-map-btn');
    byId('esriBtn')?.classList.remove('active-map-btn');
    setSystemStatus('Basemap switched to CARTO.');
    return;
  }

  if (mode === 'esri') {
    if (map.hasLayer(cartoLayer)) map.removeLayer(cartoLayer);
    if (!map.hasLayer(esriLayer)) esriLayer.addTo(map);
    byId('esriBtn')?.classList.add('active-map-btn');
    byId('cartoBtn')?.classList.remove('active-map-btn');
    setSystemStatus('Basemap switched to Esri.');
  }
}

function getCountyStatusText(latlng) {
  return isInsideLibertyCounty(latlng) ? 'Inside Liberty County' : 'Outside Liberty County';
}

function isInsideLibertyCounty(latlng) {
  if (!libertyBoundaryFeature?.geometry) return false;

  const point = [Number(latlng.lng ?? latlng.lon ?? latlng[1]), Number(latlng.lat ?? latlng[0])];
  const geometry = libertyBoundaryFeature.geometry;

  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry.coordinates);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygonCoords) => pointInPolygon(point, polygonCoords));
  }

  return false;
}

function pointInPolygon(point, polygonCoords) {
  if (!polygonCoords?.length) return false;

  const outerRing = polygonCoords[0];
  if (!pointInRing(point, outerRing)) return false;

  for (let i = 1; i < polygonCoords.length; i++) {
    if (pointInRing(point, polygonCoords[i])) {
      return false;
    }
  }

  return true;
}

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersects =
      ((yi > y) !== (yj > y)) &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function getDistanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* -----------------------------------------
   Train delay prep scaffold for next phase
------------------------------------------ */

function getStoredTrainDelayReports() {
  try {
    return JSON.parse(localStorage.getItem(TRAIN_DELAY_STORE_KEY) || '[]');
  } catch (error) {
    console.warn('Could not parse train delay reports.', error);
    return [];
  }
}

function saveStoredTrainDelayReports(reports) {
  localStorage.setItem(TRAIN_DELAY_STORE_KEY, JSON.stringify(reports));
}

function createTrainDelayReport({ lat, lng, description = '', severity = 'medium' }) {
  return {
    id: cryptoRandomId(),
    lat: Number(lat),
    lng: Number(lng),
    description: String(description).trim(),
    severity,
    status: 'reported',
    createdAt: new Date().toISOString()
  };
}