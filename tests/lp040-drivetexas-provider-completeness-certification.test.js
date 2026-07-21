const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const connectorSource = fs.readFileSync("js/gridlyDriveTexasLiveConnector.js", "utf8");
const providerSource = fs.readFileSync("js/gridlyDriveTexasProvider.js", "utf8");
const docSource = fs.readFileSync("LP040-DRIVETEXAS-PROVIDER-COMPLETENESS-CERTIFICATION.md", "utf8");

assert(connectorSource.includes("function lp040DriveTexasProviderCompletenessAudit"), "LP040 passive helper exists");
assert(connectorSource.includes("globalScope.gridlyLp040DriveTexasProviderCompletenessAudit = lp040DriveTexasProviderCompletenessAudit"), "LP040 helper is exposed on window/global scope");
const lp040Body = connectorSource.slice(connectorSource.indexOf("function lp040DriveTexasProviderCompletenessAudit"), connectorSource.indexOf("function runtimeAudit", connectorSource.indexOf("function lp040DriveTexasProviderCompletenessAudit")));
assert(!lp040Body.includes("fetch("), "LP040 helper does not fetch");
assert(!lp040Body.includes("setItem"), "LP040 helper does not write storage");
assert(!lp040Body.includes("startPolling"), "LP040 helper does not start polling");

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  AbortController,
  GRIDLY_CONFIG: { driveTexas: { apiKey: "test-key" } },
  gridlyPackageRegistry: { getPackage: () => ({ packageType: "intelligence", intelligence: { providerId: "drivetexas" } }) },
  getGridlySelectedAwarenessArea: () => ({ countyId: "liberty-tx", label: "Dayton", lat: 30.0466, lng: -94.8852, radiusMiles: 12 }),
  getDistanceMiles: () => 1,
  fetch: () => { throw new Error("LP040 audit must be passive"); }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(providerSource, sandbox, { filename: "js/gridlyDriveTexasProvider.js" });
vm.runInContext(connectorSource, sandbox, { filename: "js/gridlyDriveTexasLiveConnector.js" });

assert.strictEqual(typeof sandbox.gridlyLp040DriveTexasProviderCompletenessAudit, "function", "helper exists at runtime");
const audit = sandbox.gridlyLp040DriveTexasProviderCompletenessAudit();
assert.strictEqual(audit.passive, true, "helper reports passive mode");
assert.strictEqual(audit.fetchPerformed, false, "helper performs no fetches");
assert.strictEqual(audit.writesPerformed, false, "helper performs no writes");
assert(audit.recordCounts && Object.prototype.hasOwnProperty.call(audit.recordCounts, "normalizedCount"), "reports provider/record counts");
assert(audit.pagination && Object.prototype.hasOwnProperty.call(audit.pagination, "implemented"), "reports pagination");
assert(Array.isArray(audit.filterInventory) && audit.filterInventory.length >= 5, "reports filters");
assert(audit.categoryInventory && Array.isArray(audit.categoryInventory.configuredCategories), "reports categories");
assert(audit.geometryPreservation && audit.geometryPreservation.lineGeometryPreserved === false, "reports geometry preservation");
assert(Array.isArray(audit.hardLimits) && audit.hardLimits.some((entry) => entry.item === "MAX_ATTEMPTS"), "reports hard limits");
assert(audit.providerCompleteness && audit.providerCompleteness.overallProviderCompleteness.includes("FAIL"), "reports completeness decision");
assert.strictEqual(typeof sandbox.gridlyDriveTexasConnector.fetchNow, "function", "production fetch API remains available");
assert.strictEqual(sandbox.gridlyDriveTexasConnector.refreshIntervalMs, 180000, "no production refresh behavior changed");

[
  "Executive Summary",
  "Pipeline Diagram",
  "Provider Requests",
  "Pagination",
  "Filtering Inventory",
  "Field Inventory",
  "Category Inventory",
  "Construction Review",
  "Geometry Review",
  "Record Count Trace",
  "Hard Limits",
  "Completeness Certification",
  "Recommendations",
  "Non-Recommendations",
  "Next Milestone"
].forEach((heading) => assert(docSource.includes(heading), `documentation includes ${heading}`));

console.log("LP040 DriveTexas provider completeness certification checks passed");
