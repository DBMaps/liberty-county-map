const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/gridlyUnifiedIntelligencePrototype.js", "utf8");

const context = { window: {}, globalThis: {}, console };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "js/gridlyUnifiedIntelligencePrototype.js" });

assert.strictEqual(typeof context.gridlyUnifiedIntelligenceScenarioAudit, "function", "scenario audit is exposed");
assert.strictEqual(typeof context.gridlyUnifiedIntelligenceAwarenessPrototypeAudit, "undefined", "scenario audit does not create Awareness Brief renderer");

const before = JSON.stringify(context.gridlyUnifiedIntelligencePrototypeSnapshot());
const audit = context.gridlyUnifiedIntelligenceScenarioAudit();
const after = JSON.stringify(context.gridlyUnifiedIntelligencePrototypeSnapshot());

assert.strictEqual(audit.auditVersion, "V854.unified_intelligence.live_scenario_validation");
assert.strictEqual(audit.readOnly, true, "audit is read-only");
assert.strictEqual(before, after, "scenario audit does not commit synthetic scenario state");
assert.strictEqual(audit.scenarioCount, 9, "all required scenarios are represented");
assert.strictEqual(audit.allScenariosPass, true, "all scenarios pass");
assert.strictEqual(audit.pass, true, "scenario audit passes");
assert.strictEqual(audit.consumerContractSatisfied, true, "consumer contract remains satisfied for every scenario");
assert.strictEqual(audit.silenceBehaviorValidated, true, "silence behavior is validated");
assert.strictEqual(audit.communityRemainsPrimary, true, "community remains primary");
assert.strictEqual(audit.unifiedIntelligenceSupporting, true, "Unified Intelligence remains supporting");
assert.strictEqual(audit.runtimeContainment.providerActivationPerformed, false, "no provider activation occurs");
assert.strictEqual(audit.runtimeContainment.pollingPerformed, false, "no polling occurs");
assert.strictEqual(audit.runtimeContainment.renderingOutsideAwarenessBrief, false, "no rendering outside Awareness Brief occurs");

const scenarios = Object.fromEntries(audit.scenarios.map((scenario) => [scenario.id, scenario]));
["A", "B", "C", "D", "E", "F", "G", "H", "I"].forEach((id) => {
  assert(scenarios[id], `scenario ${id} exists`);
  assert.strictEqual(scenarios[id].passed, true, `scenario ${id} passes`);
  assert.strictEqual(scenarios[id].consumerContractSatisfied, true, `scenario ${id} satisfies consumer contract`);
  assert.strictEqual(scenarios[id].runtimeContainment.providerActivationPerformed, true, `scenario ${id} has no provider activation`);
  assert.strictEqual(scenarios[id].runtimeContainment.pollingPerformed, true, `scenario ${id} has no polling`);
  assert.strictEqual(scenarios[id].runtimeContainment.renderingOutsideAwarenessBrief, true, `scenario ${id} has no rendering outside Awareness Brief`);
  assert.strictEqual(scenarios[id].runtimeContainment.communityRemainsPrimary, true, `scenario ${id} keeps community primary`);
  assert.strictEqual(scenarios[id].runtimeContainment.officialProvidersSupporting, true, `scenario ${id} keeps official providers supporting`);
  assert.strictEqual(scenarios[id].consumerEvaluation.avoidsTechnicalLanguage, true, `scenario ${id} avoids technical language`);
  assert.strictEqual(scenarios[id].consumerEvaluation.avoidsInformationOverload, true, `scenario ${id} avoids information overload`);
});

assert.strictEqual(scenarios.A.observed.unifiedSilent, true, "scenario A remains silent");
assert.strictEqual(scenarios.A.silenceEvaluation.silent, true, "scenario A documents preferred silence");
assert.strictEqual(scenarios.C.observed.avoidsCommunityInvention, true, "DriveTexas-only scenario invents no community wording");
assert.strictEqual(scenarios.D.observed.avoidsRoadwayAssumptions, true, "weather-only scenario makes no roadway assumptions");
assert.strictEqual(scenarios.H.observed.reinforcingEvidence, true, "three-provider scenario identifies reinforcing evidence");
assert.strictEqual(scenarios.I.observed.uncertaintyCommunicated, true, "conflicting scenario communicates uncertainty");

console.log("V854 unified intelligence scenario audit passed");
