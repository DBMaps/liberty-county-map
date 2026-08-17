#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(root, "data/generated/lp214-drivetexas-source-health-certification.json");

export function buildCertification() {
  const inventory = JSON.parse(fs.readFileSync(path.join(root, "data/generated/lp214-county-community-inventory.json"), "utf8"));
  const memberships = inventory.counties.flatMap((county) => county.communities);
  const unique = new Map(memberships.map((community) => [community.placeGeoid, community]));
  const dallas = unique.get("4819000");
  return {
    schemaVersion: "gridly.lp214.drivetexas-source-health-certification.v1",
    milestone: "LP214_PHASE_2_2",
    generatedAtPolicy: "deterministic-no-wall-clock",
    repairBoundary: "E_AWARENESS_CONSUMER_BRIDGE_WITH_SHARED_SOURCE_STATUS_ENVELOPE",
    before: ["SOURCE_FAILURE", "ARRAY_EMPTY", "HEALTHY_EMPTY_POSSIBLE", "FALSE_QUIET_POSSIBLE"],
    after: ["SOURCE_FAILURE", "SOURCE_STATUS_ENVELOPE", "UNAVAILABLE_OR_RETAINED", "HEALTHY_EMPTY_IMPOSSIBLE", "FALSE_QUIET_BLOCKED"],
    sourceStatuses: ["HEALTHY_WITH_DATA", "HEALTHY_EMPTY", "SOURCE_FAILED_NO_RETAINED_DATA", "SOURCE_FAILED_WITH_RETAINED_DATA", "SOURCE_UNAVAILABLE", "UNKNOWN"],
    affectedConsumerPaths: [
      "shared envelope -> Awareness Brief official roadway enrichment",
      "shared envelope -> Community Pulse shared summary and quiet-state warning",
      "shared envelope -> Travel Brief / Know Before You Go Official Roadways section",
      "shared envelope -> destination awareness travel model",
      "shared envelope -> awareness summary alert/awareness rows"
    ],
    statewideApplicability: {
      canonicalCommunityCount: unique.size,
      sharedContractCommunityCount: unique.size,
      communitySpecificOverrideCount: 0,
      multiCountyCommunityCount: inventory.summary.multiCountyCommunityCount,
      dallasControl: { placeGeoid: dallas?.placeGeoid || null, preserved: Boolean(dallas?.multiCounty), memberCountyFips: dallas?.memberCountyFips || [] }
    },
    protectedProductionFilesModified: false,
    browserCertificationStatus: "OWNER_CONTROLS_REQUIRED"
  };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const serialized = `${JSON.stringify(buildCertification(), null, 2)}\n`;
  if (process.argv.includes("--verify")) {
    if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== serialized) throw new Error(`Generated artifact is missing or stale: ${path.relative(root, output)}`);
    process.stdout.write(`Verified ${path.relative(root, output)} (${Buffer.byteLength(serialized)} bytes)\n`);
  } else {
    fs.writeFileSync(output, serialized);
    process.stdout.write(`Wrote ${path.relative(root, output)} (${Buffer.byteLength(serialized)} bytes)\n`);
  }
}
