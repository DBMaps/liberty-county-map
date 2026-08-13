import fs from "node:fs";
import vm from "node:vm";

const legacySource = fs.readFileSync("tools/build-gridly-zip-source.js", "utf8");
const legacyMainStart = legacySource.indexOf("fs.mkdirSync(sourceDir,");
if (legacyMainStart < 0) throw new Error("legacy ZIP parser boundary not found");
const prefix = legacySource.slice(0, legacyMainStart);
const context = { require: (await import("node:module")).createRequire(import.meta.url), console };
vm.createContext(context);
vm.runInContext(`${prefix};this.detectArtifact=detectArtifact;this.field=field;this.GOVERNED_ROWS=GOVERNED_ROWS`, context);

const app = fs.readFileSync("js/app.js", "utf8");
const { countyRegistryRange } = await import("../scripts/lp189-statewide-runtime-activation-guarded.mjs");
const registryRange = countyRegistryRange(app);
const registryContext = {};
vm.createContext(registryContext);
vm.runInContext(`${app.slice(0, registryRange.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, registryContext);
const counties = new Map(Object.values(registryContext.registry).map((county) => [county.countyFips, {
  countyId: county.id,
  countyFips: county.countyFips,
  countyName: county.name,
  communities: (county.consumerAwarenessAreas || []).map((community) => ({ placeGeoid: community.placeGeoid, displayName: community.displayName }))
}]));
const geometryRegistry = JSON.parse(fs.readFileSync("assets/location-resolution/gridly-authoritative-county-geometry-v1.json", "utf8"));
for (const county of geometryRegistry.counties) {
  if (!counties.has(county.countyFips)) counties.set(county.countyFips, { countyId: county.countyId, countyFips: county.countyFips, countyName: county.name, communities: [] });
}

const source = context.detectArtifact("ZIP-COUNTY_032026.xlsx");
const evidence = source.rows.map((row) => ({
  zip: context.field(row, ["zip"]).padStart(5, "0"),
  countyFips: context.field(row, ["geoid"]).padStart(5, "0"),
  residentialRatio: Number(context.field(row, ["resratio"])),
  businessRatio: Number(context.field(row, ["busratio"])),
  otherRatio: Number(context.field(row, ["othratio"])),
  totalRatio: Number(context.field(row, ["totratio"]))
})).filter((row) => row.countyFips.startsWith("48"))
  .sort((a, b) => a.zip.localeCompare(b.zip) || a.countyFips.localeCompare(b.countyFips));

const grouped = Map.groupBy(evidence, (row) => row.zip);
const records = [...grouped].map(([zip, rows]) => ({
  zip,
  countySelectionRequired: rows.length > 1,
  countyCandidates: rows.map((row) => ({ ...counties.get(row.countyFips), evidence: row }))
})).sort((a, b) => a.zip.localeCompare(b.zip));

const artifact = {
  version: "gridly-statewide-consumer-zip-index-v1",
  authority: { countyIdentity: "FIPS", communityIdentity: "PLACE_GEOID", zipCountyEvidence: "HUD USPS ZIP Code Crosswalk 03/2026", zipPlaceClaimed: false },
  counts: { texasZips: records.length, evidenceRows: evidence.length, singleCountyZips: records.filter((r) => r.countyCandidates.length === 1).length, multiCountyZips: records.filter((r) => r.countyCandidates.length > 1).length },
  records
};

const legacyOverrides = context.GOVERNED_ROWS.map(([zip, zipType, resolutionStatus, countyId, countyName, communityKey, communityLabel, awarenessAreaKey, consumerLabel, resolutionMethod]) => ({ zip, zipType, resolutionStatus, countyId, countyName, communityKey, communityLabel, awarenessAreaKey, consumerLabel, resolutionMethod }));
legacyOverrides.push({ zip: "75801", zipType: "standard_geographic", resolutionStatus: "resolved", countyId: "anderson-tx", countyName: "Anderson County", communityKey: "4854708", communityLabel: "Palestine", awarenessAreaKey: "anderson-tx-palestine", consumerLabel: "Palestine", resolutionMethod: "LP189.2_PLACE_GEOID_override" });
legacyOverrides.sort((a, b) => a.zip.localeCompare(b.zip));

fs.mkdirSync("data/generated", { recursive: true });
fs.writeFileSync("data/generated/gridly-statewide-consumer-zip-index-v1.json", `${JSON.stringify(artifact, null, 2)}\n`);
fs.writeFileSync("data/gridly-consumer-zip-overrides-v1.json", `${JSON.stringify({ version: "gridly-consumer-zip-overrides-v1", records: legacyOverrides }, null, 2)}\n`);
console.log(JSON.stringify({ ...artifact.counts, overrides: legacyOverrides.length }));
