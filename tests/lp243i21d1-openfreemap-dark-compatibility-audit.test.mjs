import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const audit = readFileSync(new URL("../LP243.I2.1D1-OPENFREEMAP-DARK-COMPATIBILITY-EVALUATION.md", import.meta.url), "utf8");

test("audit makes one bounded decision without activating the candidate", () => {
  assert.match(audit, /Decision:\*\* `REMOVE_DARK_FROM_GRIDLY`/);
  assert.match(audit, /no production activation/i);
  assert.doesNotMatch(app, /openfreemap|maplibre/i);
  assert.equal(pkg.dependencies?.["maplibre-gl"], undefined);
  assert.equal(pkg.dependencies?.["@maplibre/maplibre-gl-leaflet"], undefined);
});

test("current basemap and persistence authorities remain unchanged", () => {
  assert.match(app, /const baseLayers = \{\s*Standard: standardLayer,\s*Dark: darkLayer,\s*Satellite: satelliteHybrid\s*\}/);
  assert.match(app, /const MAP_STYLE_STORAGE_KEY = "gridlyMapStyleV1"/);
  assert.match(app, /https:\/\/\{s\}\.tile\.openstreetmap\.org/);
  assert.match(app, /World_Imagery\/MapServer\/tile/);
});

test("audit covers required evidence gaps and the removal migration", () => {
  for (const viewport of ["390×844", "932×430", "844×390"]) assert.match(audit, new RegExp(viewport));
  for (const subject of ["readability", "attribution", "WebGL", "Capacitor", "privacy", "persistence", "gridlyMapStyleV1", "Standard → Satellite → Standard"]) {
    assert.match(audit, new RegExp(subject, "i"), subject);
  }
  assert.match(audit, /stored `gridlyMapStyleV1 === "Dark"` must deterministically migrate to `Standard`/);
});

test("frozen feature and presentation authorities are explicitly protected", () => {
  for (const subject of ["DriveTexas", "crossings", "hazards", "weather", "reports", "routes", "Location Context", "Home Area", "Awareness Area", "POI", "Supabase", "KBYG", "Search"]) {
    assert.match(audit, new RegExp(subject, "i"), subject);
  }
});
