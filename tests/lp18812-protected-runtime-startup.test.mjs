import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync("js/app.js", "utf8");
const snapshotSource = source.match(/function gridlyLp019ReadCrossingVisibilitySnapshot[\s\S]*?\n}\n\nfunction gridlyOfficialConsumerNormalizeRouteIdentifier/)?.[0]
  .replace(/\n\nfunction gridlyOfficialConsumerNormalizeRouteIdentifier$/, "");

assert.ok(snapshotSource, "LP019 crossing visibility snapshot is available to exercise");

function readSnapshot({ countyId = null, crossings = [] } = {}) {
  const context = {
    activeReports: [],
    crossingLayer: null,
    crossingMarkers: new Map(),
    crossings,
    getGridlySelectedAwarenessArea: () => null,
    gridlyCrossingSampleMatchesCounty: (crossing, activeCountyId) => crossing.countyId === activeCountyId,
    gridlyGetActiveCountyId: () => countyId,
    gridlyLp019SafeText: (value) => String(value || "").trim(),
    isActiveTrainDelayCrossing: () => true,
    map: null
  };
  vm.runInNewContext(`${snapshotSource}; result = gridlyLp019ReadCrossingVisibilitySnapshot("protected_clean_start");`, context);
  return context.result;
}

test("LP019 protected clean start is truthful and does not require a county identity", () => {
  const snapshot = readSnapshot();
  assert.equal(snapshot.selectedAwarenessArea, null);
  assert.equal(snapshot.activeBlockedCrossingRecordCount, 0);
  assert.deepEqual(Array.from(snapshot.crossingRecordsPassingAreaFilter), []);
});

test("LP019 preserves active operational county filtering", () => {
  const snapshot = readSnapshot({
    countyId: "harris-tx",
    crossings: [
      { id: "harris-crossing", countyId: "harris-tx" },
      { id: "liberty-crossing", countyId: "liberty-tx" }
    ]
  });
  assert.equal(snapshot.selectedAwarenessArea, "harris-tx");
  assert.deepEqual(Array.from(snapshot.crossingRecordsPassingAreaFilter), ["harris-crossing"]);
  assert.deepEqual(Array.from(snapshot.crossingRecordsRejectedByAreaFilter), ["liberty-crossing"]);
});
