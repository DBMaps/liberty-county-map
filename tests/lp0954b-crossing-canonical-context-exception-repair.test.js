const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const app = fs.readFileSync("js/app.js", "utf8");
const source = app.match(/function gridlyLp0954bResolveCrossingCanonicalContext[\s\S]*?\n}/)?.[0] || "";
assert(source, "canonical crossing context resolver exists");

function run({ crossing, alert = {}, markerOptions = {}, selected = null }) {
  const events = [];
  const context = {
    crossings: crossing ? [crossing] : [],
    GRIDLY_COUNTY_REGISTRY: {
      "liberty-tx": { id: "liberty-tx", name: "Liberty County" },
      "montgomery-tx": { id: "montgomery-tx", name: "Montgomery County" }
    },
    gridlySelectedAwarenessAreaResolutionCache: selected ? { area: selected } : undefined,
    gridlyLp019SafeText: (value) => String(value || "").trim(),
    gridlyLp0953Record: (name, detail, result) => events.push({ name, detail, result }),
    gridlyLp0546ResolveAwarenessAreaIdentity: (input = {}) => {
      const raw = String(input.countyId || input.awarenessAreaId || "").toLowerCase().replace(/ county$/, "").replace(/-county$/, "").replace(/-tx$/, "");
      return { canonicalCountyKey: raw ? `${raw}-tx` : "" };
    }
  };
  vm.runInNewContext(source, context);
  const record = { crossingId: crossing?.id || "FRA-TEST", ...alert };
  const marker = { options: markerOptions };
  return { result: context.gridlyLp0954bResolveCrossingCanonicalContext(record, marker), events };
}

let check = run({ crossing: { id: "FRA-TEST", canonicalCountyKey: "liberty-tx" }, selected: { countyId: "liberty-tx" } });
assert.equal(check.result.focusAllowed, true, "canonicalCountyKey completes");
assert.equal(check.result.source, "crossing_record");
check = run({ crossing: { id: "FRA-TEST", county: "Liberty County" }, selected: { countyId: "liberty-tx" } });
assert.equal(check.result.focusAllowed, true, "alternate county field normalizes");
check = run({ crossing: { id: "FRA-TEST" }, selected: null });
assert.equal(check.result.optional, true, "missing context is optional for an existing crossing and marker");
assert.equal(check.result.focusAllowed, true);
check = run({ crossing: { id: "FRA-TEST", countyId: "montgomery-tx" }, selected: { countyId: "liberty-tx" } });
assert.equal(check.result.focusAllowed, false, "out-of-scope crossing fails closed");
assert(check.events.some((event) => event.name === "Context incompatibility terminal failure"));

for (const token of ["Canonical context lookup entered", "Context source inspected", "Context compatibility evaluated", "Focus call continued"]) assert(app.includes(token), `trace includes ${token}`);
assert(!source.includes("FRA-762784H") && !source.includes('"liberty-tx"'), "resolver contains no crossing/county hardcode");
const focus = app.match(/function focusGridlyAlertIncident[\s\S]*?function focusAlertLocation/)?.[0] || "";
assert.equal((focus.match(/openCrossingPopupFromMarkerInteraction\(/g) || []).length, 1, "canonical popup dispatch remains singular");
assert(focus.includes("else marker.openPopup()"), "hazard popup path is unchanged");
assert(focus.includes("officialMarkerMatched"), "official focus path is unchanged");
const handler = app.match(/function gridlyLp019BindAlertFocusHandlers[\s\S]*?\n}/)?.[0] || "";
assert(handler.includes("gridlyLp0954bResolveCrossingCanonicalContext(record, marker)"), "handler resolves context before dispatch");
const audit = app.match(/function gridlyLp0954CrossingFocusCompletionAudit[\s\S]*?\n}/)?.[0] || "";
for (const key of ["canonicalCrossingContextResolverAvailable", "undefinedCanonicalContextGuarded", "countyContainmentPreserved", "postDispatchExceptionPathAbsent", "liveCertificationRequired"]) assert(audit.includes(key), `audit includes ${key}`);
assert(audit.includes("required.every"), "audit remains fail-closed");

console.log("LP095.4B canonical context exception regression checks passed.");
