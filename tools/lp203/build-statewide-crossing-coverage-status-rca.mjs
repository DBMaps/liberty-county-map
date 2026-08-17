import fs from "node:fs";
import vm from "node:vm";
import { countyRegistryRange } from "../../scripts/lp189-statewide-runtime-activation-guarded.mjs";

const root = new URL("../../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8").replace(/^\uFEFF/, "");
const appSource = read("js/app.js");
const range = countyRegistryRange(appSource);
const context = { Object };
vm.createContext(context);
vm.runInContext(`${appSource.slice(0, range.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, context);

const countyRegistry = context.registry;
const production = JSON.parse(read("Crossing-Packages/production-crossing-manifest.json"));
const runtimeRegistry = JSON.parse(read("assets/package-registry/runtime-package-registry.json"));
const texasCounties = JSON.parse(read("data/lp104/texas-counties.json"));
const normalizeName = (value) => String(value || "").replace(/\s+County$/i, "").trim().toLowerCase();
const productionByName = new Map(production.records.map((record) => [normalizeName(record.county), record]));
const fipsByName = new Map(texasCounties.counties.map((county) => [normalizeName(county.countyName), county.fips]));
const runtimeCrossingNames = new Set(runtimeRegistry.packages
  .filter((entry) => entry.packageType === "Crossing")
  .map((entry) => normalizeName(entry.county)));

export function buildLp203Rca() {
  const counties = Object.values(countyRegistry).map((county) => {
    const governed = productionByName.get(normalizeName(county.name));
    if (!governed) throw new Error(`Missing production crossing record for ${county.id}`);
    const governedCount = Number(governed.crossingCount);
    const governedState = governedCount === 0 ? "ACTIVE_EMPTY" : "ACTIVE_POSITIVE";
    const legacyAvailabilityValue = county.runtimeSourceAvailability?.crossings ?? null;
    const legacyBannerClassification = legacyAvailabilityValue === "available" ? "AVAILABLE" : "UNAVAILABLE";
    const runtimeRegistryAvailability = runtimeCrossingNames.has(normalizeName(county.name));
    const expectedModernAvailabilityClassification = governedState === "ACTIVE_EMPTY"
      ? "AVAILABLE_NO_CROSSINGS"
      : "AVAILABLE_CROSSINGS";
    const mismatch = legacyBannerClassification === "UNAVAILABLE";
    return {
      countyId: county.id,
      countyName: county.name,
      countyFips: county.countyFips || fipsByName.get(normalizeName(county.name)),
      governedCrossingState: governedState,
      governedCount,
      currentLegacyBannerAvailabilityClassification: legacyBannerClassification,
      legacyAvailabilityValue,
      legacyLocalCrossingsPath: county.localCrossingsPath || null,
      legacyCrossingsPath: county.crossingsPath || null,
      runtimeRegistryAvailability,
      expectedModernAvailabilityClassification,
      mismatch,
      mismatchReason: mismatch
        ? "Legacy inline runtimeSourceAvailability.crossings is not 'available' although the governed runtime registry contains a valid Crossing entry."
        : null
    };
  }).sort((a, b) => a.countyFips.localeCompare(b.countyFips));

  const count = (predicate) => counties.filter(predicate).length;
  const controls = Object.fromEntries([
    ["shermanGrayson", "grayson-tx"], ["dallas", "dallas-tx"], ["elPaso", "el-paso-tx"],
    ["wacoMcLennan", "mclennan-tx"], ["tylerSmith", "smith-tx"], ["liberty", "liberty-tx"],
    ["activeEmptyAndrews", "andrews-tx"], ["activeEmptyArcher", "archer-tx"], ["activeEmptyBandera", "bandera-tx"]
  ].map(([key, id]) => [key, counties.find((county) => county.countyId === id)]));

  return {
    milestone: "LP203",
    scope: "Observational RCA only; no production behavior changed.",
    authoritativeState: { governedCounties: counties.length, activePositive: count((c) => c.governedCrossingState === "ACTIVE_POSITIVE"), activeEmpty: count((c) => c.governedCrossingState === "ACTIVE_EMPTY"), governedIdentities: counties.reduce((sum, c) => sum + c.governedCount, 0), runtimeCrossingRegistryEntries: runtimeCrossingNames.size },
    exactBannerOwner: {
      renderingPath: "refreshPortraitV2LocalizedIntelligence -> buildGridlyCommunityPulseModel/getGridlyQuietAwarenessBriefCopy -> getGridlyHomeCommunityPulseCopy -> getGridlyAwarenessCoverageState",
      decisionFunction: "getGridlyAwarenessCoverageState (js/app.js)",
      stateObjectProperty: "GRIDLY_COUNTY_REGISTRY[gridlyNormalizeCountyId(activeCountyId)].runtimeSourceAvailability.crossings",
      firstIncorrectCondition: "countyConfig.runtimeSourceAvailability.crossings === 'available'",
      limitedCopyCondition: "No active awareness evidence (quiet/zero count) AND coverage.state === 'limited'",
      countyIdentity: "gridlyGetActiveCountyId(), normalized through gridlyNormalizeCountyId",
      reads: { GRIDLY_COUNTY_REGISTRY: true, runtimeSourceAvailabilityCrossings: true, localCrossingsPathOrCrossingsPath: false, GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY: false, authoritativeRuntimePackageRegistry: false, activeRuntimeInventoryOwnership: false, hydrationState: false, awarenessCrossingCount: false },
      distinguishesActivePositiveAndActiveEmpty: false
    },
    timingAndRefresh: {
      calculatedOnceAtStartup: false,
      recalculatedOnCommunityPulseOrPortraitRender: true,
      activeCountySwitchRefreshesVisibleSurfaces: true,
      governedPackageLoadChangesAuthority: false,
      awarenessAreaChangeCanRerender: true,
      independentlyCached: false,
      staleTimingIsRootCause: false,
      explanation: "The function recomputes from active county inline metadata. Re-rendering faithfully repeats the wrong static classification; hydration completion is never consulted."
    },
    transitionResults: ["liberty-tx", "grayson-tx", "dallas-tx", "andrews-tx", "smith-tx"].map((id) => {
      const county = counties.find((item) => item.countyId === id);
      return { countyId: id, bannerClassificationAfterRefresh: county.currentLegacyBannerAvailabilityClassification, headlineWhenQuiet: county.mismatch ? "Limited local coverage" : "Your area is clear right now", governedCrossingState: county.governedCrossingState, governedCount: county.governedCount };
    }),
    controls,
    statewideResults: {
      evaluated: counties.length,
      correctBannerClassifications: count((c) => !c.mismatch),
      falseUnavailableClassifications: count((c) => c.mismatch),
      activePositiveFalselyUnavailable: count((c) => c.mismatch && c.governedCrossingState === "ACTIVE_POSITIVE"),
      activeEmptyFalselyUnavailable: count((c) => c.mismatch && c.governedCrossingState === "ACTIVE_EMPTY"),
      otherMismatches: 0,
      legacyInlineAvailable: count((c) => c.legacyAvailabilityValue === "available"),
      legacyInlineNotAvailable: count((c) => c.legacyAvailabilityValue !== "available")
    },
    activeEmptySemantics: "The existing unavailable copy is semantically incorrect for ACTIVE_EMPTY: a governed intentional zero proves coverage and should be distinguishable from missing data.",
    criticalStateDistinctions: ["DATA_UNAVAILABLE", "ACTIVE_EMPTY_COUNTY", "POSITIVE_COUNTY_ZERO_LOCAL_AWARENESS_COUNT", "POSITIVE_COUNTY_NONZERO_LOCAL_COUNT", "HYDRATION_IN_PROGRESS", "HYDRATION_FAILURE"],
    rootCauseClassification: ["LEGACY_RUNTIME_SOURCE_AVAILABILITY", "STALE_INLINE_COUNTY_METADATA", "ACTIVE_EMPTY_MISCLASSIFICATION", "WRONG_AVAILABILITY_AUTHORITY"],
    explicitlyNotRootCause: ["COVERAGE_STATE_NOT_REFRESHED", "STARTUP_TIMING_STALE_STATE", "ZERO_LOCAL_COUNT_MISCLASSIFICATION", "HYDRATION_STATE_MISCLASSIFICATION"],
    smallestRecommendedRepair: "In a later production patch, derive coverage from the governed Crossing resolver/registry state for the active county, then combine that source fact with inventory hydration progress/failure and local awareness count. Do not use local count or intentional zero as source-unavailable evidence.",
    proposedConsumerSemanticStates: ["normal local crossing coverage", "no crossings in this area", "crossing information loading", "crossing information temporarily unavailable"],
    legacyContext: {
      conclusion: "The banner authority is inline county metadata from the pre-statewide activation model. The governed loader was modernized by LP202.1, but this presentation helper was not.",
      bannerFunctionCommit: "06934449",
      laterRuntimeAuthorityCommits: ["0374d89 (LP202.1 governed runtime source resolution)", "28af61b and successors (LP202.2 synchronization/hydration/ownership)"],
      oldInlineAvailableCohort: count((c) => c.legacyAvailabilityValue === "available")
    },
    counties
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = buildLp203Rca();
  const target = new URL("reports/lp203/statewide-crossing-coverage-status-rca.json", root);
  fs.mkdirSync(new URL("reports/lp203/", root), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${target.pathname}: ${report.statewideResults.evaluated} counties, ${report.statewideResults.falseUnavailableClassifications} false unavailable.`);
}
