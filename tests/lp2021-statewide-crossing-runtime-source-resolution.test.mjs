import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const json = async (path) => JSON.parse((await readFile(new URL(path, root), "utf8")).replace(/^\uFEFF/, ""));

async function bridge(overrides = {}) {
  const window = {};
  const context = vm.createContext({
    window,
    Response,
    fetch: async (path) => {
      if (Object.hasOwn(overrides, path)) {
        const value = overrides[path];
        if (value instanceof Error) throw value;
        return new Response(JSON.stringify(value), { status: 200 });
      }
      try { return new Response(await readFile(new URL(path, root)), { status: 200 }); }
      catch { return new Response("not found", { status: 404 }); }
    }
  });
  vm.runInContext(await readFile(new URL("js/gridlyRuntimeSourceRegistryBridge.js", root), "utf8"), context);
  return window.gridlyRuntimeSourceRegistryBridge;
}

test("all 254 governed counties resolve with statewide conservation", async () => {
  const resolver = await bridge();
  const production = await json("Crossing-Packages/production-crossing-manifest.json");
  const registry = await json("assets/package-registry/runtime-package-registry.json");
  const crossingEntries = registry.packages.filter((entry) => entry.packageType === "Crossing");
  assert.equal(crossingEntries.length, 254);
  const resolved = await Promise.all(production.records.map((record) =>
    resolver.resolveGovernedCrossingSource({ county: record.county })));
  assert.equal(resolved.filter((item) => item.state === "ACTIVE_POSITIVE").length, 202);
  assert.equal(resolved.filter((item) => item.state === "ACTIVE_EMPTY").length, 52);
  assert.equal(resolved.reduce((sum, item) => sum + item.governedCount, 0), 16099);
  assert.equal(resolved.filter((item) => item.state === "ACTIVE_POSITIVE" && item.packageFile).length, 202);
});

test("Dallas and Liberty select governed production packages over inline metadata", async () => {
  const resolver = await bridge();
  const dallas = await resolver.resolveGovernedCrossingSource({ county: "Dallas", countyFips: "48113" });
  const liberty = await resolver.resolveGovernedCrossingSource({ county: "Liberty", countyFips: "48291" });
  assert.deepEqual([dallas.state, dallas.governedCount], ["ACTIVE_POSITIVE", 789]);
  assert.match(dallas.packageFile, /dallas\/Production\/dallas-production-crossings\.geojson$/);
  assert.deepEqual([liberty.state, liberty.governedCount], ["ACTIVE_POSITIVE", 115]);
  assert.match(liberty.packageFile, /liberty\/Production\/liberty-production-crossings\.geojson$/);
  assert.equal(liberty.legacyInlineSourceBypassed, true);
  for (const item of [dallas, liberty]) {
    const payload = await json(item.packageFile);
    assert.equal(payload.features.length, item.governedCount);
  }
  const payload = await json(liberty.packageFile);
  const counts = payload.features.reduce((out, feature) => {
    const key = feature.properties.gridlyClassification;
    out[key] = (out[key] || 0) + 1; return out;
  }, {});
  assert.deepEqual(counts, { PUBLIC_ROADWAY: 80, PRIVATE_ROAD: 28, INDUSTRIAL: 5, RAIL_YARD: 1, TEMPORARY_ACCESS: 1 });
});

test("ACTIVE_EMPTY counties are healthy intentional zero states", async () => {
  const resolver = await bridge();
  for (const county of ["Andrews", "Archer", "Bandera"]) {
    const result = await resolver.resolveGovernedCrossingSource({ county });
    assert.equal(result.state, "ACTIVE_EMPTY");
    assert.equal(result.governedCount, 0);
  }
});

test("resolver fails closed for registry, manifest, packageFile, and ownership defects", async () => {
  const registry = await json("assets/package-registry/runtime-package-registry.json");
  await assert.rejects(() => bridge({
    "assets/package-registry/runtime-package-registry.json": { ...registry, packages: registry.packages.filter((e) => !(e.packageType === "Crossing" && e.county === "Dallas")) }
  }).then((b) => b.resolveGovernedCrossingSource({ county: "Dallas" })), /entry not found/);
  await assert.rejects(() => bridge({ "Crossing-Packages/dallas/package-manifest.json": new Error("missing") }).then((b) => b.resolveGovernedCrossingSource({ county: "Dallas" })), /missing/);
  await assert.rejects(() => bridge({ "Crossing-Packages/dallas/package-manifest.json": { packageType: "Crossing", county: "Liberty" } }).then((b) => b.resolveGovernedCrossingSource({ county: "Dallas" })), /ownership mismatch/);
  const production = await json("Crossing-Packages/production-crossing-manifest.json");
  const broken = { ...production, records: production.records.map((r) => r.county === "Dallas" ? { ...r, packageFile: null } : r) };
  await assert.rejects(() => bridge({ "Crossing-Packages/production-crossing-manifest.json": broken }).then((b) => b.resolveGovernedCrossingSource({ county: "Dallas" })), /packageFile/);
});

test("county switching is county-safe and clears positive source for ACTIVE_EMPTY", async () => {
  const resolver = await bridge();
  const sequence = await Promise.all(["Liberty", "Dallas", "Liberty", "Dallas", "Tarrant", "Andrews", "Dallas"].map((county) =>
    resolver.resolveGovernedCrossingSource({ county })));
  assert.deepEqual(sequence.map((item) => item.governedCount), [115, 789, 115, 789, 615, 0, 789]);
  assert.equal(sequence[5].state, "ACTIVE_EMPTY");
  assert.notEqual(sequence[0].packageFile, sequence[1].packageFile);
});
