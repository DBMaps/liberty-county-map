import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { buildCertification } from "../tools/lp214/build-drivetexas-source-health-certification.mjs";

const artifact = JSON.parse(fs.readFileSync("data/generated/lp214-drivetexas-source-health-certification.json", "utf8"));

test("Phase 2.2 certification is deterministic and current", () => {
  assert.deepEqual(artifact, buildCertification());
  execFileSync(process.execPath, ["tools/lp214/build-drivetexas-source-health-certification.mjs", "--verify"]);
});

test("shared repair covers the statewide denominator and preserves identity controls", () => {
  assert.equal(artifact.statewideApplicability.canonicalCommunityCount, 1859);
  assert.equal(artifact.statewideApplicability.sharedContractCommunityCount, 1859);
  assert.equal(artifact.statewideApplicability.communitySpecificOverrideCount, 0);
  assert.equal(artifact.statewideApplicability.multiCountyCommunityCount, 163);
  assert.equal(artifact.statewideApplicability.dallasControl.placeGeoid, "4819000");
  assert.equal(artifact.statewideApplicability.dallasControl.preserved, true);
});

test("post-repair evidence blocks failure-to-quiet collapse on every affected path", () => {
  assert.deepEqual(artifact.after, ["SOURCE_FAILURE", "SOURCE_STATUS_ENVELOPE", "UNAVAILABLE_OR_RETAINED", "HEALTHY_EMPTY_IMPOSSIBLE", "FALSE_QUIET_BLOCKED"]);
  assert.equal(artifact.affectedConsumerPaths.length, 5);
  assert.equal(artifact.browserCertificationStatus, "OWNER_CONTROLS_REQUIRED");
});
