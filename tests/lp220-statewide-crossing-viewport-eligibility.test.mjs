import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
const app = fs.readFileSync("js/app.js", "utf8");
const walker = readJson("Crossing-Packages/walker/Production/walker-production-crossings.geojson");
const eastland = readJson("Crossing-Packages/eastland/Production/eastland-production-crossings.geojson");
const presentations = readJson("data/generated/gridly-statewide-place-presentation-v1.json").places;

const normalize = (feature, countyId) => ({
  id: feature.properties.CROSSING || feature.properties.id,
  countyId,
  lat: feature.geometry.coordinates[1],
  lng: feature.geometry.coordinates[0]
});
const contains = (bounds, crossing) => crossing.lat >= bounds.south && crossing.lat <= bounds.north && crossing.lng >= bounds.west && crossing.lng <= bounds.east;
const eligible = (inventory, countyId, bounds) => inventory.filter((crossing) => crossing.countyId === countyId && contains(bounds, crossing));

test("production predicate is live Leaflet geographic bounds with [lat,lng] operands", () => {
  assert.match(app, /const bounds = map\?\.getBounds\?\.\(\);/);
  assert.match(app, /bounds\.contains\?\.\(\[crossing\.lat, crossing\.lng\]\)/);
  assert.match(app, /viewportAuthority: "live_leaflet_map_getBounds"/);
  assert.match(app, /predicate: "map\.getBounds\(\)\.contains\(\[crossing\.lat, crossing\.lng\]\)"/);
});

test("Huntsville fixture preserves identity and admits a real Walker crossing in authoritative bounds", () => {
  const inventory = walker.features.map((feature) => normalize(feature, "walker-tx"));
  assert.equal(inventory.length, 36);
  assert.deepEqual(presentations["4835528"], { lat: 30.7235263, lon: -95.5507771 });
  const viewport = { south: 30.69, west: -95.52, north: 30.74, east: -95.48 };
  const visible = eligible(inventory, "walker-tx", viewport);
  assert.ok(visible.length >= 1);
  assert.ok(visible.every((crossing) => contains(viewport, crossing)));
});

test("Eastland stays filtered, distant and foreign-county crossings stay excluded", () => {
  const inventory = eastland.features.map((feature) => normalize(feature, "eastland-tx"));
  assert.equal(inventory.length, 34);
  const viewport = { south: 32.38, west: -98.85, north: 32.43, east: -98.78 };
  const visible = eligible(inventory, "eastland-tx", viewport);
  assert.ok(visible.length > 0 && visible.length < inventory.length);
  assert.equal(eligible([{ id: "distant", countyId: "eastland-tx", lat: 31, lng: -97 }], "eastland-tx", viewport).length, 0);
  assert.equal(eligible([{ id: "foreign", countyId: "walker-tx", lat: 32.4, lng: -98.82 }], "eastland-tx", viewport).length, 0);
});

test("GeoJSON and Leaflet coordinate order is conserved on fresh load and transition", () => {
  const source = walker.features[0].geometry.coordinates;
  const normalized = normalize(walker.features[0], "walker-tx");
  assert.deepEqual([normalized.lng, normalized.lat], source);
  assert.deepEqual([normalized.lat, normalized.lng], [source[1], source[0]]);
  const huntsvilleViewport = { south: 30.69, west: -95.52, north: 30.74, east: -95.48 };
  const eastlandViewport = { south: 32.38, west: -98.85, north: 32.43, east: -98.78 };
  assert.ok(eligible(walker.features.map((f) => normalize(f, "walker-tx")), "walker-tx", huntsvilleViewport).length > 0);
  assert.ok(eligible(eastland.features.map((f) => normalize(f, "eastland-tx")), "eastland-tx", eastlandViewport).length > 0);
  assert.equal(eligible(walker.features.map((f) => normalize(f, "walker-tx")), "eastland-tx", eastlandViewport).length, 0);
});
