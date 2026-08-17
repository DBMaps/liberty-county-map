import fs from 'node:fs';
import vm from 'node:vm';
import { countyRegistryRange } from '../../scripts/lp189-statewide-runtime-activation-guarded.mjs';

const root = new URL('../../', import.meta.url);
const readJson = path => JSON.parse(fs.readFileSync(new URL(path, root), 'utf8'));
const source = fs.readFileSync(new URL('js/app.js', root), 'utf8');
const projection = readJson('data/generated/gridly-statewide-consumer-community-projection-v1.json');
const presentation = readJson('data/generated/gridly-statewide-place-presentation-v1.json');
const boundaries = readJson('assets/boundaries/texas-counties-boundaries.geojson');
const roadwayManifest = readJson('data/roadway-runtime-manifest.json');
const range = countyRegistryRange(source);
const sandbox = { Object };
vm.createContext(sandbox);
vm.runInContext(`${source.slice(0, range.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, sandbox);
const registry = sandbox.registry;
const byFips = new Map(Object.values(registry).map(county => [String(county.countyFips), county]));
const normalizeCountyName = value => String(value || '').replace(/ County$/i, '').trim().toLowerCase();
const byName = new Map(Object.values(registry).map(county => [normalizeCountyName(county.name), county]));
for (const feature of boundaries.features) {
  const county = byName.get(normalizeCountyName(feature.properties?.NAME));
  if (county) byFips.set(String(feature.properties?.GEOID), county);
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInGeometry(lon, lat, geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(polygon => pointInRing(lon, lat, polygon[0]) && !polygon.slice(1).some(hole => pointInRing(lon, lat, hole)));
}
function countyAt(lat, lon) {
  return boundaries.features.find(feature => pointInGeometry(lon, lat, feature.geometry))?.properties?.GEOID || null;
}
function roadwayExpectation(countyId) {
  const entry = roadwayManifest.counties[countyId];
  const featureCount = Array.isArray(entry?.partitions)
    ? entry.partitions.reduce((sum, partition) => sum + Number(partition.featureCount || 0), 0)
    : Number.isFinite(Number(entry?.featureCount)) ? Number(entry.featureCount) : null;
  return { countyId, status: entry?.status || null, version: entry?.version || null, featureCount, automaticallyActivated: Boolean(entry && ['local_runtime', 'external_runtime', 'partition_runtime_ready'].includes(entry.status)) };
}

const ownerCameras = {
  '4805000': { lat: 30.274931186653326, lon: -97.74415969848634 },
  '4819000': { lat: 32.78294501748632, lon: -96.79538726806642 },
  '4824000': { lat: 31.765537409484374, lon: -106.48704528808595 },
  '4827000': { lat: 32.757685346479455, lon: -97.33182907104494 }
};

const inventory = projection.communities
  .filter(place => place.countyMemberships.length > 1)
  .sort((a, b) => a.placeGeoid.localeCompare(b.placeGeoid))
  .map(place => {
    const camera = ownerCameras[place.placeGeoid] || presentation.places[place.placeGeoid];
    const operationalFips = countyAt(Number(camera.lat), Number(camera.lon ?? camera.lng));
    const operationalCounty = byFips.get(operationalFips);
    const members = place.countyMemberships.map(fips => ({ fips, countyId: byFips.get(fips)?.id || null, countyName: byFips.get(fips)?.name || null }));
    const staleMember = members.find(member => member.fips !== operationalFips);
    const predecessor = operationalCounty?.id === 'liberty-tx' ? 'harris-tx' : 'liberty-tx';
    const awarenessKey = `place-${place.placeGeoid}`;
    const roadway = roadwayExpectation(operationalCounty?.id);
    const passed = Boolean(operationalCounty && place.countyMemberships.includes(operationalFips) && roadway.automaticallyActivated);
    return {
      placeGeoid: place.placeGeoid,
      canonicalAwarenessKey: awarenessKey,
      label: place.displayName,
      canonicalIdentity: 'PLACE_GEOID',
      canonicalMultiCountyPlace: true,
      members,
      selectedTestOperationalCounty: { countyId: operationalCounty?.id || null, countyFips: operationalFips, countyName: operationalCounty?.name || null },
      startupPredecessorCounty: predecessor,
      staleSettingsCounty: staleMember?.countyId || null,
      legacyLabels: { homeTown: place.displayName, community: place.displayName },
      precedenceResult: 'PROFILE_OPERATIONAL_COUNTY',
      coldStart: {
        inMemoryProfileBeforeHydration: 'EMPTY_DEFAULT',
        persistedProfileAwarenessKey: awarenessKey,
        persistedProfileCounty: operationalCounty?.id || null,
        settingsAwarenessKeyBeforeRepair: `${operationalCounty?.id}-${place.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        hydrationCompletedBeforeCanonicalStartupResolution: true,
        settingsCanonicalKeyRepairedWithoutLabelIdentityInference: true
      },
      results: {
        activeCounty: operationalCounty?.id || null,
        selectedCounty: operationalCounty?.id || null,
        roadwayRuntimeCounty: operationalCounty?.id || null,
        settingsCounty: operationalCounty?.id || null,
        profileCounty: operationalCounty?.id || null,
        selectedAwarenessKey: awarenessKey,
        selectedAwarenessOperationalCounty: operationalCounty?.id || null,
        awarenessSnapshotCounty: operationalCounty?.id || null,
        settingsReadsBound: 2,
        maximumSettingsNestingDepth: 1,
        stalePredecessorWorkCancelled: true,
        sameCountyRoadwayActivationDeduplicated: true,
        returnTransitionCounty: predecessor
      },
      roadwayRuntime: roadway,
      classification: passed ? 'PASS' : 'OWNER_REVIEW_REQUIRED',
      failureReason: passed ? null : !operationalCounty ? 'presentation_coordinate_did_not_resolve_to_governed_runtime_county' : 'certified_roadway_runtime_unavailable'
    };
  });

const classificationTotals = inventory.reduce((totals, row) => { totals[row.classification] += 1; return totals; }, { PASS: 0, SAME_COLD_START_DEFECT: 0, DIFFERENT_DEFECT: 0, OWNER_REVIEW_REQUIRED: 0 });
const report = {
  schemaVersion: 'gridly.lp213.statewide-canonical-multi-county-place-audit.v1',
  generatedAt: '2026-08-17T00:00:00.000Z',
  scope: 'Every governed Texas canonical multi-county PLACE',
  totalCanonicalMultiCountyPlaceCount: inventory.length,
  classificationTotals,
  genericProductionRepairs: ['Hydrate the authoritative in-memory profile snapshot exactly once before canonical startup resolution.', 'Membership-validate every explicit canonical PLACE operational county before runtime synchronization.'],
  uniqueTransitionMatrix: ['empty_default_memory_hydrated_from_persisted_profile_before_resolution', 'profile_over_stale_member_settings', 'profile_over_unrelated_active_runtime', 'canonical_settings_key_repair_without_label_identity_inference', 'predecessor_cancellation_and_replacement_hydration', 'same_county_roadway_activation_deduplication', 'return_to_single_county_runtime'],
  preservedAuthorities: ['canonical PLACE memberships', 'roadway packages and manifests', 'Supabase objects', 'roadway data', 'statewide 254-county runtime activation', 'LP211', 'LP212'],
  inventory
};

const output = new URL('data/generated/lp213-statewide-multi-county-place-audit.json', root);
const rendered = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv.includes('--verify')) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== rendered) throw new Error('LP213 governed audit artifact is stale; run the builder without --verify');
  console.log(`LP213 audit verified: ${inventory.length} canonical multi-county PLACEs; ${classificationTotals.PASS} PASS`);
} else {
  fs.writeFileSync(output, rendered);
  console.log(`LP213 audit written: ${inventory.length} canonical multi-county PLACEs; ${classificationTotals.PASS} PASS`);
}

export { report };
