import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");

function productionFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const brace = app.indexOf("{", app.indexOf(")", start));
  let depth = 0;
  for (let index = brace; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const context = { evaluateRoadNameCandidate(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  const valid = normalized.length >= 3 && !new Set(["road", "unknown", "unnamed"]).has(normalized.toLowerCase());
  return { normalized, valid, reason: valid ? "ok" : (normalized ? "generic_placeholder" : "empty") };
} };
vm.createContext(context);
vm.runInContext(`${productionFunction("getRoadwayFeatureNameCandidates")};globalThis.candidates=getRoadwayFeatureNameCandidates`, context);

const resolve = (properties) => context.candidates({ properties }).find((candidate) => candidate.valid)?.normalized || null;

test("LP212 roadway identity schema compatibility preserves precedence and validates FULLNAME", () => {
  assert.equal(resolve({ name: "US 90" }), "US 90");
  assert.equal(resolve({ ref: "FM 1960" }), "FM 1960");
  assert.equal(resolve({ FULLNAME: "W Palestine Ave" }), "W Palestine Ave");
  assert.equal(resolve({ FULLNAME: "" }), null);
  assert.equal(resolve({ FULLNAME: null }), null);
  assert.equal(resolve({ FULLNAME: "Road" }), null);
  assert.equal(resolve({ name: "US 90", ref: "FM 1960", highway: "primary", FULLNAME: "W Palestine Ave" }), "US 90");
});
