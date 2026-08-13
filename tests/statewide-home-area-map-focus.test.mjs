import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { countyRegistryRange } from "../scripts/lp189-statewide-runtime-activation-guarded.mjs";

const source = fs.readFileSync("js/app.js", "utf8");
const range = countyRegistryRange(source);
const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(0, range.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, context);
const registry = context.registry;

const required = new Map([
  ["Dallas", ["dallas-tx", "48113", "4819000", 32.7767, -96.7970]],
  ["San Antonio", ["bexar-tx", "48029", "4865000", 29.4241, -98.4936]],
  ["Austin", ["travis-tx", "48453", "4805000", 30.2672, -97.7431]],
  ["Liberty", ["liberty-tx", "48291", "4842568", 30.0579, -94.7955]],
  ["Palestine", ["anderson-tx", "48001", "4854708", 31.7621, -95.6308]],
  ["Brownsville", ["cameron-tx", "48061", "4810768", 25.9017, -97.4975]],
  ["Odessa", ["ector-tx", "48135", "4853388", 31.8457, -102.3676]],
  ["Midland", ["midland-tx", "48329", "4848072", 31.9973, -102.0779]],
  ["Marfa", ["presidio-tx", "48377", "4846620", 30.3095, -104.0206]],
  ["Abilene", ["taylor-tx", "48441", "4801000", 32.4487, -99.7331]]
]);

function select(name, map) {
  const [countyId, countyFips, placeGeoid, lat, lng] = required.get(name);
  const community = registry[countyId].consumerAwarenessAreas.find((row) => row.placeGeoid === placeGeoid);
  assert.equal(registry[countyId].countyFips ?? countyFips, countyFips, `${name} county FIPS`);
  assert.equal(community.canonicalIdentity, "PLACE_GEOID", `${name} identity authority`);
  assert.equal(community.displayName, name);
  assert.deepEqual([community.focus.lat, community.focus.lng], [lat, lng], `${name} focus`);
  const before = { ...map.center };
  map.setView([community.focus.lat, community.focus.lng], community.focus.startupZoom);
  return { before, after: { ...map.center }, expected: { lat, lng } };
}

test("every governed statewide community has canonical identity and legacy focus metadata remains presentation-only", () => {
  const governed = Object.values(registry).flatMap((county) => county.consumerAwarenessAreas || []);
  assert.equal(governed.length, 2058);
  for (const community of governed) {
    assert.match(community.placeGeoid, /^48\d{5}$/);
    assert.equal(community.canonicalIdentity, "PLACE_GEOID");
    if (community.focus) {
      assert.ok(Number.isFinite(community.focus.lat), community.displayName);
      assert.ok(Number.isFinite(community.focus.lng), community.displayName);
      assert.equal(community.focus.source, "governed statewide community focus bridge");
    }
  }
  assert.equal(governed.filter((community) => community.focus).length, 12);
});

test("required identities focus the Leaflet camera at their governed coordinates", () => {
  for (const name of required.keys()) {
    const map = { center: { lat: 27, lng: -100 }, zoom: 8, setView([lat, lng], zoom) { this.center = { lat, lng }; this.zoom = zoom; } };
    const result = select(name, map);
    assert.deepEqual(result.after, result.expected);
    assert.notDeepEqual(result.before, result.after, `${name} map moved`);
    assert.equal(map.zoom, 13);
  }
});

test("successive selections never reuse the previous map target", () => {
  const map = { center: { lat: 30, lng: -95 }, setView([lat, lng]) { this.center = { lat, lng }; } };
  for (const sequence of [["Liberty", "Dallas"], ["Dallas", "San Antonio"], ["San Antonio", "Laredo"], ["Laredo", "Palestine"]]) {
    select(sequence[0], map);
    const result = select(sequence[1], map);
    assert.notDeepEqual(result.before, result.after, sequence.join(" -> "));
    assert.deepEqual(result.after, result.expected, sequence.join(" -> "));
  }
});

test("home personalization consumes governed focus before legacy county-center fallback", () => {
  assert.match(source, /const governedFocus = canonicalCommunity\?\.focus \|\| null/);
  assert.match(source, /const lat = Number\.isFinite\(Number\(governedFocus\?\.lat\)\)/);
  assert.match(source, /mapFocused = Boolean\(gridlyFocusConfirmedHomeSelection\?\.\(validation\.area, record\.countyId\)\)/);
  assert.match(source, /map\.setView\(\[Number\(center\.lat\), Number\(center\.lng\)\]/);
});

const geometryPackage = JSON.parse(fs.readFileSync("assets/location-resolution/gridly-authoritative-county-geometry-v1.json", "utf8"));
const historicalBoundsCountyIds = new Set([
  "liberty-tx", "montgomery-tx", "san-jacinto-tx", "chambers-tx", "jefferson-tx", "hardin-tx", "polk-tx", "walker-tx", "harris-tx", "orange-tx", "jasper-tx", "newton-tx", "tyler-tx", "galveston-tx", "brazoria-tx", "fort-bend-tx", "waller-tx", "austin-tx", "washington-tx", "brazos-tx", "grimes-tx", "wharton-tx", "colorado-tx", "fayette-tx", "lavaca-tx", "jackson-tx", "matagorda-tx", "calhoun-tx"
]);

function geometryBounds(countyId) {
  const county = geometryPackage.counties.find((row) => row.countyId === countyId);
  const points = [];
  const visit = (value) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) points.push([Number(value[1]), Number(value[0])]);
    else value.forEach(visit);
  };
  visit(county?.geometry?.coordinates);
  return { south: Math.min(...points.map(([lat]) => lat)), north: Math.max(...points.map(([lat]) => lat)), west: Math.min(...points.map(([, lng]) => lng)), east: Math.max(...points.map(([, lng]) => lng)) };
}

test("all 254 operational counties have non-default authoritative geometry focus", () => {
  const operational = Object.values(registry).filter((county) => county.operational && county.selectable);
  assert.equal(operational.length, 254);
  assert.equal(geometryPackage.counties.length, 254);
  for (const county of operational) {
    const bounds = geometryBounds(county.id);
    assert.ok([bounds.south, bounds.north, bounds.west, bounds.east].every(Number.isFinite), county.id);
    const center = [(bounds.south + bounds.north) / 2, (bounds.west + bounds.east) / 2];
    assert.notDeepEqual(center.map((value) => Number(value.toFixed(4))), [30.2, -94.9], county.id);
  }
});

test("diverse counties outside both legacy focus cohorts use selected geometry bounds", () => {
  for (const countyId of ["el-paso-tx", "potter-tx", "nueces-tx", "bowie-tx", "webb-tx"]) {
    assert.equal(historicalBoundsCountyIds.has(countyId), false, countyId);
    assert.equal(Boolean(registry[countyId].consumerAwarenessAreas?.some((community) => community.focus)), false, countyId);
    const bounds = geometryBounds(countyId);
    assert.ok(bounds.west < bounds.east && bounds.south < bounds.north, countyId);
  }
  assert.match(source, /function gridlyFocusConfirmedHomeSelection\(area, countyId\)/);
  assert.match(source, /const bounds = gridlyGetAuthoritativeCountyGeometryFocusBounds\(normalized\)/);
  assert.match(source, /map\.fitBounds\(bounds/);
  assert.match(source, /gridlyNormalizeCountyId\(current\?\.countyId \|\| ""\) === normalized/);
  const focusStart = source.indexOf("function gridlyFocusConfirmedHomeSelection");
  const focusEnd = source.indexOf("\n}\n", focusStart) + 2;
  assert.doesNotMatch(source.slice(focusStart, focusEnd), /30\.2|-94\.9/);
});

test("unresolved statewide PLACE presentation never manufactures a southeast-Texas camera target", () => {
  const builderStart = source.indexOf("function gridlyBuildRegistryCommunityAwarenessArea");
  const builderEnd = source.indexOf("\n}\n", builderStart) + 2;
  const builder = source.slice(builderStart, builderEnd);
  assert.match(builder, /bounds \? \(Number\(bounds\.south\) \+ Number\(bounds\.north\)\) \/ 2 : null/);
  assert.match(builder, /bounds \? \(Number\(bounds\.west\) \+ Number\(bounds\.east\)\) \/ 2 : null/);
  assert.doesNotMatch(builder, /30\.2|-94\.9/);

  const focusStart = source.indexOf("function gridlyFocusConfirmedHomeSelection");
  const focusEnd = source.indexOf("\n}\n", focusStart) + 2;
  const focus = source.slice(focusStart, focusEnd);
  assert.match(focus, /if \(applyGeometryFocus\(\)\) return true/);
  assert.match(focus, /return false;\n}/, "a deferred geometry request is not reported as a completed Leaflet invocation");
});

test("El Paso authoritative county fallback resolves to El Paso County rather than the prior Palestine camera", () => {
  const bounds = geometryBounds("el-paso-tx");
  const center = { lat: (bounds.south + bounds.north) / 2, lng: (bounds.west + bounds.east) / 2 };
  assert.ok(center.lat > 31.5 && center.lat < 32.1, center);
  assert.ok(center.lng < -105.9 && center.lng > -106.8, center);
  assert.ok(Math.abs(center.lat - 31.7621) > 0.1 || Math.abs(center.lng + 95.6308) > 0.1);
});
