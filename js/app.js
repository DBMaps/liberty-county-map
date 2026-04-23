const LIBERTY_BOUNDARY_FILE = './data/liberty-county-boundary.geojson';
const RAIL_CROSSINGS_FILE = './data/liberty-county-rail-crossings.geojson';

const SAVED_PLACES_KEY = 'liberty_county_saved_places_v39_locked';
const CROSSING_EVENTS_KEY = 'liberty_crossing_events_v39_locked';

const DAYTON_ANCHOR = {
  name: 'Dayton, TX',
  lat: 30.046605,
  lng: -94.885202
};

const CROSSING_MATCH_RADIUS_MILES = 0.08;
const KNOWN_CROSSING_MATCH_RADIUS_MILES = 0.20;

const CROSSING_NICKNAMES = {
  'LC-003': 'The Damn Dayton Train',
  'LC-001': 'Downtown Crossing',
  'LC-002': 'Clayton Crossing',
  'LC-004': 'Backroad Crossing',
  'LC-005': '1960 Crossing'
};

let map;
let cartoLayer;
let esriLayer;
let libertyBoundaryLayer = null;
let libertyBoundaryFeature = null;
let searchMarker = null;
let clickMarker = null;
let savedPlacesLayer = null;
let crossingEventsLayer = null;
let knownCrossingsLayer = null;

let savedPlaces = [];
let crossingEvents = [];
let filteredCrossingEvents = [];
let knownCrossings = [];
let selectedExistingCrossingId = null;
let selectedKnownCrossing = null;

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
  loadCrossingEvents();
  await loadKnownCrossings();
  applyCrossingFilters();
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
  crossingEventsLayer = L.layerGroup().addTo(map);
  knownCrossingsLayer = L.layerGroup().addTo(map);

  const daytonMarker = L.circleMarker([DAYTON_ANCHOR.lat, DAYTON_ANCHOR.lng], {
    radius: 7,
    color: '#1d4ed8',
    weight: 2,
    fillColor: '#5cc8ff',
    fillOpacity: 0.95
  }).addTo(map);

  daytonMarker.bindPopup(
    `<strong>${DAYTON_ANCHOR.name}</strong><br />Reference anchor for distance calculations.`
  );

  map.on('click', handleMapClick);
}

function initUi() {
  byId('searchBtn')?.addEventListener('click', handleSearch);
  byId('searchInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  byId('fitCountyBtn')?.addEventListener('click', fitCountyView);
  byId('fitDaytonBtn')?.addEventListener('click', () => {
    map.setView([DAYTON_ANCHOR.lat, DAYTON_ANCHOR.lng], 12);
  });
  byId('fitSavedBtn')?.addEventListener('click', fitSavedPlacesView);
  byId('clearTempBtn')?.addEventListener('click', clearSearchResult);

  byId('exportSavedBtn')?.addEventListener('click', exportSavedPlaces);
  byId('clearSavedBtn')?.addEventListener('click', clearSavedPlaces);

  byId('submitCrossingReportBtn')?.addEventListener('click', handleSubmitCrossingReport);
  byId('clearTrainFormBtn')?.addEventListener('click', clearCrossingForm);
  byId('fitTrainReportsBtn')?.addEventListener('click', fitVisibleCrossingsView);
  byId('clearTrainReportsBtn')?.addEventListener('click', clearAllCrossingEvents);

  byId('applyFiltersBtn')?.addEventListener('click', applyCrossingFilters);
  byId('resetFiltersBtn')?.addEventListener('click', resetCrossingFilters);

  byId('filterSeverity')?.addEventListener('change', applyCrossingFilters);
  byId('filterStatus')?.addEventListener('change', applyCrossingFilters);
  byId('filterCounty')?.addEventListener('change', applyCrossingFilters);

  byId('cartoBtn')?.addEventListener('click', () => switchBasemap('carto'));
  byId('esriBtn')?.addEventListener('click', () => switchBasemap('esri'));
}

function byId(id) {
  return document.getElementById(id);
}

function setSystemStatus(message) {
  const el = byId('systemStatus');
  if (!el) return;
  el.innerHTML = `<strong>System status</strong><br />${escapeHtml(message)}`;
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
    validateBoundaryGeoJson(data);

    const selectedFeature = chooseBoundaryFeature(data.features);
    if (!selectedFeature) {
      throw new Error('No valid Polygon or MultiPolygon feature found.');
    }

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
    debugState.selectedFeature = getBoundaryFeatureName(selectedFeature);
    debugState.geometryType = selectedFeature.geometry?.type || '--';
    debugState.bounds = formatBounds(bounds);
    debugState.loadStatus = 'Loaded successfully';

    renderDebugPanel();
    redrawKnownCrossingMarkers();
    redrawCrossingMarkers();
    renderCrossingRegistry();
    updateFilterSummary();

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

async function loadKnownCrossings() {
  try {
    const response = await fetch(RAIL_CROSSINGS_FILE, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      throw new Error('Known crossings file is not a valid FeatureCollection.');
    }

    knownCrossings = data.features
      .filter((feature) => feature?.geometry?.type === 'Point')
      .map((feature) => {
        const props = feature.properties || {};
        const coords = feature.geometry.coordinates || [];
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        const crossingId = props.crossing_id || cryptoRandomId();
        const crossingName = props.name || props.road_name || 'Unnamed Crossing';

        return {
          crossingId,
          crossingName,
          crossingRoadName: props.road_name || '',
          crossingRailroad: props.railroad || '',
          crossingNickname: CROSSING_NICKNAMES[crossingId] || '',
          lat,
          lng
        };
      })
      .filter((crossing) => Number.isFinite(crossing.lat) && Number.isFinite(crossing.lng));

    redrawKnownCrossingMarkers();
  } catch (error) {
    console.error('Known crossings load error:', error);
    setSystemStatus(`Known crossings load failed: ${error.message}`);
  }
}

function redrawKnownCrossingMarkers() {
  if (!knownCrossingsLayer) return;

  knownCrossingsLayer.clearLayers();

  knownCrossings.forEach((crossing) => {
    const marker = L.circleMarker([crossing.lat, crossing.lng], {
      radius: 4,
      color: '#9cdcff',
      weight: 1,
      fillColor: '#9cdcff',
      fillOpacity: 0.45
    });

    marker.bindPopup(`
      <strong>${escapeHtml(crossing.crossingName)}</strong><br />
      ${crossing.crossingNickname ? `"${escapeHtml(crossing.crossingNickname)}"<br />` : ''}
      ${crossing.crossingRoadName ? `${escapeHtml(crossing.crossingRoadName)}<br />` : ''}
      ${crossing.crossingRailroad ? `Railroad: ${escapeHtml(crossing.crossingRailroad)}` : ''}
    `);

    marker.on('click', () => {
      selectedKnownCrossing = crossing;
      selectedExistingCrossingId = null;
      populateCrossingFormLocation(crossing.lat, crossing.lng);
      setSystemStatus(`Known crossing selected: ${crossing.crossingName}${crossing.crossingNickname ? ` ("${crossing.crossingNickname}")` : ''}.`);
      renderInsight({
        lat: crossing.lat,
        lng: crossing.lng,
        title: crossing.crossingName,
        subtitle: crossing.crossingNickname || crossing.crossingRoadName || 'Known crossing selected'
      });
    });

    marker.addTo(knownCrossingsLayer);
  });
}

function validateBoundaryGeoJson(data) {
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

  if (!validFeatures.length) return null;

  const namedLiberty = validFeatures.find((feature) =>
    getBoundaryFeatureName(feature).toLowerCase().includes('liberty')
  );

  return namedLiberty || validFeatures[0];
}

function getBoundaryFeatureName(feature) {
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

function fitVisibleCrossingsView() {
  if (!filteredCrossingEvents.length) {
    alert('No visible crossing events found.');
    return;
  }

  const bounds = L.latLngBounds(filteredCrossingEvents.map((event) => [event.lat, event.lng]));
  map.fitBounds(bounds, { padding: [30, 30] });
}

function clearSearchResult() {
  if (searchMarker) {
    map.removeLayer(searchMarker);
    searchMarker = null;
  }
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
      headers: { Accept: 'application/json' }
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
  clickMarker.bindPopup(
    `<strong>Selected location</strong><br />${lat.toFixed(6)}, ${lng.toFixed(6)}`
  ).openPopup();

  populateCrossingFormLocation(lat, lng);

  const nearbyKnownCrossing = findNearbyKnownCrossing(lat, lng);
  const nearbyEvent = findNearbyCrossingEvent(lat, lng);

  selectedKnownCrossing = nearbyKnownCrossing || null;
  selectedExistingCrossingId = nearbyEvent ? nearbyEvent.id : null;

  if (nearbyEvent) {
    setSystemStatus(
      `Existing crossing event selected: ${getCrossingDisplayTitle(nearbyEvent)} (${nearbyEvent.reportCount} reports).`
    );
  } else if (nearbyKnownCrossing) {
    setSystemStatus(
      `Known crossing selected: ${nearbyKnownCrossing.crossingName}${nearbyKnownCrossing.crossingNickname ? ` ("${nearbyKnownCrossing.crossingNickname}")` : ''}.`
    );
  } else {
    setSystemStatus('No nearby known crossing matched. Click a known crossing marker before saving.');
  }

  renderInsight({
    lat,
    lng,
    title: nearbyKnownCrossing ? nearbyKnownCrossing.crossingName : 'Clicked location',
    subtitle: getNearestCrossingInsightText(lat, lng)
  });
}

function populateCrossingFormLocation(lat, lng) {
  const latEl = byId('reportLat');
  const lngEl = byId('reportLng');

  if (latEl) latEl.value = Number(lat).toFixed(6);
  if (lngEl) lngEl.value = Number(lng).toFixed(6);
}

function clearCrossingForm() {
  selectedExistingCrossingId = null;
  selectedKnownCrossing = null;

  if (byId('reportLat')) byId('reportLat').value = '';
  if (byId('reportLng')) byId('reportLng').value = '';
  if (byId('reportActionType')) byId('reportActionType').value = 'blocked';
  if (byId('reportDescription')) byId('reportDescription').value = '';

  setSystemStatus('Crossing event form cleared.');
}

function handleSubmitCrossingReport() {
  const lat = Number(byId('reportLat')?.value);
  const lng = Number(byId('reportLng')?.value);
  const reportType = byId('reportActionType')?.value || 'blocked';
  const description = (byId('reportDescription')?.value || '').trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    alert('Click the map or a known crossing marker first.');
    return;
  }

  let crossingEvent = null;

  if (selectedExistingCrossingId) {
    crossingEvent =
      crossingEvents.find((event) => event.id === selectedExistingCrossingId) || null;
  }

  if (!crossingEvent) {
    crossingEvent = findNearbyCrossingEvent(lat, lng);
  }

  const matchedKnownCrossing = selectedKnownCrossing || findNearbyKnownCrossing(lat, lng);

  if (!crossingEvent && !matchedKnownCrossing) {
    alert('No known crossing matched this location. Please click a known crossing marker before saving a report.');
    setSystemStatus('Report blocked: no known crossing matched this location.');
    return;
  }

  const insideCounty = isInsideLibertyCounty({ lat, lng });

  if (!crossingEvent) {
    crossingEvent = createCrossingEvent(lat, lng, insideCounty, matchedKnownCrossing);
    crossingEvents.unshift(crossingEvent);
  }

  addReportToCrossingEvent(crossingEvent, {
    lat,
    lng,
    reportType,
    description
  });

  recalculateCrossingEvent(crossingEvent);
  persistCrossingEvents();
  clearCrossingForm();
  applyCrossingFilters();

  setSystemStatus(
    reportType === 'cleared'
      ? `Cleared update saved to ${getCrossingDisplayTitle(crossingEvent)}.`
      : `Blocked update saved to ${getCrossingDisplayTitle(crossingEvent)}.`
  );
}

function createCrossingEvent(lat, lng, insideCounty, knownCrossing) {
  const now = new Date().toISOString();

  return {
    id: cryptoRandomId(),
    lat: Number(knownCrossing.lat),
    lng: Number(knownCrossing.lng),
    insideCounty: Boolean(insideCounty),
    createdAt: now,
    firstReportedAt: now,
    lastReportedAt: now,
    reportCount: 0,
    blockedCount: 0,
    clearedCount: 0,
    severity: 'low',
    status: 'active',
    latestNote: '',
    reports: [],
    crossingId: knownCrossing.crossingId,
    crossingName: knownCrossing.crossingName,
    crossingRoadName: knownCrossing.crossingRoadName || '',
    crossingRailroad: knownCrossing.crossingRailroad || '',
    crossingNickname: knownCrossing.crossingNickname || ''
  };
}

function addReportToCrossingEvent(crossingEvent, report) {
  const entry = {
    id: cryptoRandomId(),
    lat: Number(report.lat),
    lng: Number(report.lng),
    type: report.reportType,
    description: report.description,
    createdAt: new Date().toISOString()
  };

  crossingEvent.reports.unshift(entry);
  crossingEvent.lastReportedAt = entry.createdAt;

  if (!crossingEvent.firstReportedAt) {
    crossingEvent.firstReportedAt = entry.createdAt;
  }
}

function recalculateCrossingEvent(crossingEvent) {
  const reports = crossingEvent.reports || [];

  crossingEvent.reportCount = reports.length;
  crossingEvent.blockedCount = reports.filter((r) => r.type === 'blocked').length;
  crossingEvent.clearedCount = reports.filter((r) => r.type === 'cleared').length;

  const latestReport = reports[0] || null;

  if (latestReport) {
    crossingEvent.latestNote = latestReport.description || '';
    crossingEvent.status = latestReport.type === 'cleared' ? 'cleared' : 'active';
    crossingEvent.lastReportedAt = latestReport.createdAt;
  }

  crossingEvent.severity = deriveSeverityFromCount(crossingEvent.reportCount);
}

function deriveSeverityFromCount(reportCount) {
  if (reportCount >= 6) return 'high';
  if (reportCount >= 3) return 'medium';
  return 'low';
}

function findNearbyCrossingEvent(lat, lng) {
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const event of crossingEvents) {
    const distance = getDistanceMiles(lat, lng, event.lat, event.lng);
    if (distance <= CROSSING_MATCH_RADIUS_MILES && distance < bestDistance) {
      bestDistance = distance;
      bestMatch = event;
    }
  }

  return bestMatch;
}

function findNearbyKnownCrossing(lat, lng) {
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const crossing of knownCrossings) {
    const distance = getDistanceMiles(lat, lng, crossing.lat, crossing.lng);
    if (distance <= KNOWN_CROSSING_MATCH_RADIUS_MILES && distance < bestDistance) {
      bestDistance = distance;
      bestMatch = crossing;
    }
  }

  return bestMatch;
}

function getNearestCrossingInsightText(lat, lng) {
  const nearest = findNearbyKnownCrossing(lat, lng);
  if (!nearest) return 'No nearby known crossing found';

  const distance = getDistanceMiles(lat, lng, nearest.lat, nearest.lng);

  return `${nearest.crossingName}${nearest.crossingNickname ? ` — "${nearest.crossingNickname}"` : ''} | ${distance.toFixed(2)} mi away`;
}

function getCrossingDisplayTitle(event) {
  return event.crossingName || 'Unnamed Crossing';
}

function getCrossingDisplaySubtitle(event) {
  if (event.crossingNickname) {
    return `"${event.crossingNickname}"`;
  }

  if (event.crossingRoadName) {
    return event.crossingRoadName;
  }

  return `${event.lat.toFixed(6)}, ${event.lng.toFixed(6)}`;
}

function getCrossingStatusNote(event) {
  if (event.status === 'cleared') {
    return 'Traffic flowing again.';
  }
  return event.latestNote || 'Crossing still blocked.';
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
    .map((place) => `
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
    `)
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

  if (!confirm('Clear all saved places?')) return;

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

function loadCrossingEvents() {
  try {
    const raw = localStorage.getItem(CROSSING_EVENTS_KEY);
    crossingEvents = raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn('Could not load crossing events.', error);
    crossingEvents = [];
  }

  crossingEvents = crossingEvents.filter((event) => {
    return (
      Number.isFinite(Number(event.lat)) &&
      Number.isFinite(Number(event.lng)) &&
      Number(event.lat) !== 0 &&
      Number(event.lng) !== 0 &&
      event.crossingId
    );
  });

  for (const event of crossingEvents) {
    recalculateCrossingEvent(event);
  }

  persistCrossingEvents();
}

function persistCrossingEvents() {
  localStorage.setItem(CROSSING_EVENTS_KEY, JSON.stringify(crossingEvents));
}

function getActiveFilters() {
  return {
    severity: byId('filterSeverity')?.value || 'all',
    status: byId('filterStatus')?.value || 'all',
    county: byId('filterCounty')?.value || 'all'
  };
}

function applyCrossingFilters() {
  const filters = getActiveFilters();

  filteredCrossingEvents = crossingEvents
    .filter((event) => {
      const severityMatch = filters.severity === 'all' || event.severity === filters.severity;
      const statusMatch = filters.status === 'all' || event.status === filters.status;
      const countyMatch =
        filters.county === 'all' ||
        (filters.county === 'inside' && event.insideCounty) ||
        (filters.county === 'outside' && !event.insideCounty);

      return severityMatch && statusMatch && countyMatch;
    })
    .sort((a, b) => new Date(b.lastReportedAt).getTime() - new Date(a.lastReportedAt).getTime());

  renderCrossingRegistry();
  redrawCrossingMarkers();
  updateFilterSummary();
}

function resetCrossingFilters() {
  if (byId('filterSeverity')) byId('filterSeverity').value = 'all';
  if (byId('filterStatus')) byId('filterStatus').value = 'all';
  if (byId('filterCounty')) byId('filterCounty').value = 'all';

  applyCrossingFilters();
  setSystemStatus('Crossing filters reset.');
}

function updateFilterSummary() {
  const el = byId('filterSummary');
  if (!el) return;
  el.textContent = `Showing ${filteredCrossingEvents.length} of ${crossingEvents.length} crossing events.`;
}

function renderCrossingRegistry() {
  const list = byId('trainReportList');
  if (!list) return;

  if (!filteredCrossingEvents.length) {
    list.innerHTML = `<div class="tiny">No crossing events match the current filters.</div>`;
    return;
  }

  list.innerHTML = filteredCrossingEvents
    .map((event) => {
      const duration = getDurationText(event.firstReportedAt, event.lastReportedAt, event.status);

      return `
        <div class="saved-item">
          <div class="saved-item-title">${escapeHtml(getCrossingDisplayTitle(event))}</div>
          <div class="saved-item-meta">
            ${escapeHtml(getCrossingDisplaySubtitle(event))}<br />
            ${event.crossingRailroad ? `${escapeHtml(event.crossingRailroad)}<br />` : ''}
            ${event.insideCounty ? 'Inside Liberty County' : 'Outside Liberty County'}<br />
            ${escapeHtml(getCrossingStatusNote(event))}
          </div>

          <div class="badge-row">
            <span class="badge badge-${escapeHtml(event.severity)}">${escapeHtml(event.severity.toUpperCase())}</span>
            <span class="badge badge-status">${escapeHtml(event.status.toUpperCase())}</span>
            <span class="badge badge-county">${event.insideCounty ? 'INSIDE COUNTY' : 'OUTSIDE COUNTY'}</span>
          </div>

          <div class="summary-grid">
            <div class="summary-cell">
              <div class="summary-label">Reports</div>
              <div class="summary-value">${event.reportCount}</div>
            </div>
            <div class="summary-cell">
              <div class="summary-label">Duration</div>
              <div class="summary-value">${escapeHtml(duration)}</div>
            </div>
            <div class="summary-cell">
              <div class="summary-label">First reported</div>
              <div class="summary-value">${formatShortDateTime(event.firstReportedAt)}</div>
            </div>
            <div class="summary-cell">
              <div class="summary-label">Last update</div>
              <div class="summary-value">${formatShortDateTime(event.lastReportedAt)}</div>
            </div>
          </div>

          <div class="saved-item-actions">
            <button class="btn btn-light btn-small" data-crossing-action="zoom" data-id="${event.id}">Zoom</button>
            <button class="btn btn-light btn-small" data-crossing-action="blocked" data-id="${event.id}">Confirm Blocked</button>
            <button class="btn btn-light btn-small" data-crossing-action="cleared" data-id="${event.id}">Report Cleared</button>
          </div>
        </div>
      `;
    })
    .join('');

  list.querySelectorAll('[data-crossing-action="zoom"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const event = crossingEvents.find((item) => item.id === btn.dataset.id);
      if (!event) return;

      map.setView([event.lat, event.lng], 16);
      renderInsight({
        lat: event.lat,
        lng: event.lng,
        title: getCrossingDisplayTitle(event),
        subtitle: `${event.reportCount} reports | ${event.status}`
      });
    });
  });

  list.querySelectorAll('[data-crossing-action="blocked"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      quickUpdateCrossing(btn.dataset.id, 'blocked');
    });
  });

  list.querySelectorAll('[data-crossing-action="cleared"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      quickUpdateCrossing(btn.dataset.id, 'cleared');
    });
  });
}

function quickUpdateCrossing(eventId, reportType) {
  const event = crossingEvents.find((item) => item.id === eventId);
  if (!event) return;

  const now = new Date().toISOString();

  event.status = reportType === 'cleared' ? 'cleared' : 'active';
  event.lastReportedAt = now;
  event.latestNote =
    reportType === 'cleared' ? 'Traffic flowing again.' : 'Crossing still blocked.';

  persistCrossingEvents();
  applyCrossingFilters();

  setSystemStatus(
    reportType === 'cleared'
      ? `${getCrossingDisplayTitle(event)} marked cleared.`
      : `${getCrossingDisplayTitle(event)} blockage confirmed.`
  );
}

function redrawCrossingMarkers() {
  crossingEventsLayer.clearLayers();

  filteredCrossingEvents.forEach((event) => {
    const icon = L.divIcon({
      className: '',
      html: `
        <div class="crossing-marker ${escapeHtml(event.severity)} ${event.status === 'cleared' ? 'cleared' : ''}">
          <span>${escapeHtml(String(Math.min(event.reportCount, 99)))}</span>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    const marker = L.marker([event.lat, event.lng], { icon });

    marker.bindPopup(buildCrossingPopupHtml(event));
    marker.on('click', () => {
      selectedExistingCrossingId = event.id;
      selectedKnownCrossing = knownCrossings.find((crossing) => crossing.crossingId === event.crossingId) || null;
      populateCrossingFormLocation(event.lat, event.lng);
      setSystemStatus(`${getCrossingDisplayTitle(event)} selected: ${event.reportCount} total reports.`);
    });

    marker.addTo(crossingEventsLayer);
  });
}

function buildCrossingPopupHtml(event) {
  const duration = getDurationText(event.firstReportedAt, event.lastReportedAt, event.status);

  return `
    <strong>${escapeHtml(getCrossingDisplayTitle(event))}</strong><br />
    ${event.crossingNickname ? `"${escapeHtml(event.crossingNickname)}"<br />` : ''}
    ${event.crossingRoadName ? `${escapeHtml(event.crossingRoadName)}<br />` : ''}
    ${event.crossingRailroad ? `Railroad: ${escapeHtml(event.crossingRailroad)}<br />` : ''}
    Status: ${escapeHtml(event.status.toUpperCase())}<br />
    Severity: ${escapeHtml(event.severity.toUpperCase())}<br />
    Reports: ${event.reportCount}<br />
    Duration: ${escapeHtml(duration)}<br />
    Last update: ${formatShortDateTime(event.lastReportedAt)}<br />
    ${escapeHtml(getCrossingStatusNote(event))}
  `;
}

function clearAllCrossingEvents() {
  if (!crossingEvents.length) {
    alert('No crossing events to clear.');
    return;
  }

  if (!confirm('Clear all crossing events?')) return;

  crossingEvents = [];
  persistCrossingEvents();
  applyCrossingFilters();
  setSystemStatus('All crossing events cleared.');
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

function renderInsight({ lat, lng, title, subtitle }) {
  const insightPanel = byId('insightPanel');
  if (!insightPanel) return;

  const insideCounty = isInsideLibertyCounty({ lat, lng });
  const milesFromDayton = getDistanceMiles(lat, lng, DAYTON_ANCHOR.lat, DAYTON_ANCHOR.lng);
  const nearest = findNearbyKnownCrossing(lat, lng);
  const nearestDistance = nearest ? getDistanceMiles(lat, lng, nearest.lat, nearest.lng) : null;

  insightPanel.innerHTML = `
    <strong>Location insight</strong><br />
    <div style="margin-top:8px;">
      <div><strong>${escapeHtml(title)}</strong></div>
      <div class="tiny">${escapeHtml(subtitle)}</div>
      ${
        nearest
          ? `<div style="margin-top:8px;"><strong>Nearest crossing:</strong> ${escapeHtml(nearest.crossingName)}</div>
             <div>${nearest.crossingNickname ? `"${escapeHtml(nearest.crossingNickname)}"` : escapeHtml(nearest.crossingRoadName || '')}</div>
             <div><strong>Match distance:</strong> ${nearestDistance.toFixed(2)} miles</div>`
          : `<div style="margin-top:8px;"><strong>Nearest crossing:</strong> None matched</div>`
      }
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

function getCountyStatusText(latlng) {
  return isInsideLibertyCounty(latlng) ? 'Inside Liberty County' : 'Outside Liberty County';
}

function isInsideLibertyCounty(latlng) {
  if (!libertyBoundaryFeature?.geometry) return false;

  const point = [
    Number(latlng.lng ?? latlng.lon ?? latlng[1]),
    Number(latlng.lat ?? latlng[0])
  ];

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

function getDurationText(firstReportedAt, lastReportedAt, status) {
  if (!firstReportedAt) return '--';

  const start = new Date(firstReportedAt).getTime();
  const end = status === 'active' ? Date.now() : new Date(lastReportedAt).getTime();
  const minutes = Math.max(0, Math.round((end - start) / 60000));

  if (minutes < 1) return 'Just started';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (remainder === 0) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

function formatShortDateTime(isoString) {
  if (!isoString) return '--';

  return new Date(isoString).toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
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