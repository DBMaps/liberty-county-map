const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyConfig().crossingsPath;');
assert.ok(cutoff > 0, 'runtime county registry block is present before active URL binding');

const sandbox = { Object, String, Boolean };
vm.createContext(sandbox);
vm.runInContext(`${source.slice(0, cutoff)}\nthis.api = { GRIDLY_DEFAULT_COUNTY_ID, GRIDLY_COUNTY_REGISTRY, GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY, gridlyNormalizeCountyId, gridlyIsKnownCountyId, gridlyIsCountyOperational, gridlyGetCountyRuntimeStatus, gridlyGetCountyRuntimeSources, gridlyValidateCountyContainment, gridlyReportMatchesActiveCounty, gridlyGetCountyScopedReportMetadata };`, sandbox);

const api = sandbox.api;
const registry = api.GRIDLY_COUNTY_REGISTRY;
const sourceRegistry = api.GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY;
const liberty = registry['liberty-tx'];
const montgomery = registry['montgomery-tx'];
const sanJacinto = registry['san-jacinto-tx'];

assert.ok(liberty, 'Liberty remains registered');
assert.ok(montgomery, 'Montgomery remains registered');
assert.ok(sanJacinto, 'San Jacinto registration exists for V640 validation');

// County Registration Audit + Non-Activation Audit.
assert.strictEqual(sanJacinto.id, 'san-jacinto-tx', 'San Jacinto countyId ownership is stable');
assert.strictEqual(sanJacinto.stage, 'runtime-onboarded', 'San Jacinto stage remains runtime-onboarded');
assert.strictEqual(sanJacinto.operational, false, 'San Jacinto is not operational');
assert.strictEqual(sanJacinto.productionEnabled, false, 'San Jacinto is not production enabled');
assert.strictEqual(sanJacinto.selectable, false, 'San Jacinto is not selectable');
assert.strictEqual(sanJacinto.productionActivationBlocked, true, 'San Jacinto production activation remains blocked');
assert.strictEqual(api.gridlyIsKnownCountyId('san-jacinto-tx'), true, 'San Jacinto is known for registry audit only');
assert.strictEqual(api.gridlyIsCountyOperational('san-jacinto-tx'), false, 'Known San Jacinto county cannot become operational');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('san-jacinto-tx'))), {
  known: true,
  countyId: 'san-jacinto-tx',
  operational: false,
  stage: 'runtime-onboarded',
  productionEnabled: false,
  selectable: false
}, 'San Jacinto runtime status is complete and blocked');

// County Ownership Audit.
const sanSources = sourceRegistry['san-jacinto-tx'];
assert.ok(sanSources, 'San Jacinto source registry entry exists');
assert.strictEqual(sanSources.countyId, 'san-jacinto-tx', 'San Jacinto source registry is county-owned');
assert.strictEqual(sanSources.owner, 'san-jacinto-owned', 'San Jacinto source registry does not use fallback ownership');
assert.strictEqual(sanJacinto.runtimeSourceOwner, 'san-jacinto-owned', 'San Jacinto runtime owner metadata is explicit');
assert.strictEqual(sanSources.boundarySource, 'assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson', 'San Jacinto boundary ownership is explicit');
assert.strictEqual(sanSources.roadSource, 'assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.shp', 'San Jacinto roadway ownership is explicit');
assert.strictEqual(sanSources.crossingSource, 'assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-rail-crossings.geojson', 'San Jacinto crossing ownership is explicit');
assert.strictEqual(sanSources.crossingOverridesSource, 'assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-crossing-review-overrides.json', 'San Jacinto crossing review ownership is explicit');
assert.deepStrictEqual(JSON.parse(JSON.stringify(sanSources.defaultAwarenessAreas)), [], 'San Jacinto has no active awareness ownership paths');
assert.ok(Array.isArray(sanJacinto.awarenessAreaCandidates), 'San Jacinto awareness candidates are metadata only');
assert.ok(sanJacinto.awarenessAreaCandidates.includes('Coldspring'), 'San Jacinto awareness candidate metadata is auditable');

// Containment Audit + Fail-Closed Audit.
assert.strictEqual(api.gridlyNormalizeCountyId('liberty-tx'), 'liberty-tx', 'Liberty context remains Liberty');
assert.strictEqual(api.gridlyNormalizeCountyId('montgomery-tx'), 'montgomery-tx', 'Montgomery context remains Montgomery');
assert.strictEqual(api.gridlyNormalizeCountyId('san-jacinto-tx'), 'liberty-tx', 'San Jacinto cannot normalize into active runtime before activation');
assert.strictEqual(api.gridlyNormalizeCountyId('unknown-county'), 'liberty-tx', 'Unknown county normalization fails closed to default active county');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'liberty-tx' }, 'liberty-tx').allowed, true, 'Liberty rows remain allowed in Liberty context');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'montgomery-tx').allowed, true, 'Montgomery rows remain allowed in Montgomery context');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'san-jacinto-tx' }, 'san-jacinto-tx').allowed, false, 'San Jacinto self-context remains isolated because county is not operational');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'san-jacinto-tx' }, 'liberty-tx').allowed, false, 'San Jacinto cannot contaminate Liberty');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'san-jacinto-tx' }, 'montgomery-tx').allowed, false, 'San Jacinto cannot contaminate Montgomery');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'unknown-county' }, 'liberty-tx').allowed, false, 'Unknown explicit counties fail closed');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'unknown-county' }, 'montgomery-tx').allowed, false, 'Unknown explicit counties fail closed under Montgomery');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'san-jacinto-tx' }, 'liberty-tx'), false, 'San Jacinto reports are blocked from Liberty');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'san-jacinto-tx' }, 'montgomery-tx'), false, 'San Jacinto reports are blocked from Montgomery');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'unknown-county' }, 'liberty-tx'), false, 'Unknown report county is not exposed through fallback');

// Boundary Foundation Audit.
assert.ok(source.includes('const GRIDLY_COUNTY_BOUNDARY_OVERLAY_COUNTY_IDS = Object.freeze(["liberty-tx", "montgomery-tx", "san-jacinto-tx"]);'), 'Boundary overlay foundation recognizes San Jacinto while preserving active-only evaluation');
assert.ok(source.includes('"san-jacinto-tx": "48407"'), 'San Jacinto GEOID 48407 is registered');
assert.strictEqual(sanSources.availability.boundary, 'identified', 'San Jacinto boundary foundation is identified, not activated');
assert.strictEqual(sanJacinto.boundarySource.includes('48407'), true, 'San Jacinto boundary source metadata names GEOID 48407');

const manifest = JSON.parse(fs.readFileSync('assets/county-implementation/san-jacinto/manifests/san-jacinto-runtime-onboarding-v639.json', 'utf8'));
const registryArtifact = JSON.parse(fs.readFileSync('assets/county-implementation/san-jacinto/registry/san-jacinto-county-runtime-registry-v639.json', 'utf8'));
const inventory = JSON.parse(fs.readFileSync('assets/county-implementation/san-jacinto/inventory/san-jacinto-source-inventory-v639.json', 'utf8'));
assert.strictEqual(manifest.countyId, 'san-jacinto-tx', 'San Jacinto manifest ownership is auditable');
assert.strictEqual(registryArtifact.boundaryFoundation.standardTexasBoundaryGeoid, '48407', 'San Jacinto registry artifact carries boundary GEOID');
assert.strictEqual(registryArtifact.boundaryFoundation.activeOnlyBoundaryArchitecturePreserved, true, 'Boundary active-only architecture remains compatible');
assert.strictEqual(inventory.countyBoundarySource.activation, false, 'San Jacinto boundary inventory does not activate county');
assert.strictEqual(inventory.awarenessAreaCandidates.activation, false, 'San Jacinto awareness inventory does not activate county');

// Production-facing selection paths remain limited to activated counties.
const homeOptionsBlock = source.slice(source.indexOf('const GRIDLY_HOME_AREA_OPTIONS_BY_COUNTY'), source.indexOf('const GRIDLY_TOWN_STARTUP_ZOOM'));
const awarenessDefinitionsBlock = source.slice(source.indexOf('const GRIDLY_AWARENESS_AREA_DEFINITIONS'), source.indexOf('const GRIDLY_AWARENESS_AREA_BY_KEY'));
const countySelectMarkup = source.slice(source.indexOf('id="gridlyWelcomeCountySelect"') - 500, source.indexOf('id="gridlyWelcomeCountySelect"') + 1000);
assert.strictEqual(homeOptionsBlock.includes('san-jacinto-tx'), false, 'San Jacinto is absent from production home-area filters');
assert.strictEqual(awarenessDefinitionsBlock.includes('countyId: "san-jacinto-tx"'), false, 'San Jacinto has no active awareness definitions');
assert.strictEqual(countySelectMarkup.includes('San Jacinto'), false, 'San Jacinto is absent from onboarding county selector markup');

// Regression Audit.
assert.strictEqual(liberty.operational, true, 'Liberty remains operational');
assert.strictEqual(liberty.productionEnabled, true, 'Liberty remains production enabled');
assert.strictEqual(liberty.selectable, true, 'Liberty remains selectable');
assert.strictEqual(montgomery.operational, true, 'Montgomery remains operational');
assert.strictEqual(montgomery.productionEnabled, true, 'Montgomery remains production enabled');
assert.strictEqual(montgomery.selectable, true, 'Montgomery remains selectable');
assert.strictEqual(api.gridlyGetCountyScopedReportMetadata('liberty-tx').county_id, 'liberty-tx', 'Liberty report metadata remains Liberty-owned');
assert.strictEqual(api.gridlyGetCountyScopedReportMetadata('montgomery-tx').county_id, 'montgomery-tx', 'Montgomery report metadata remains Montgomery-owned');
assert.strictEqual(api.gridlyGetCountyScopedReportMetadata('san-jacinto-tx').county_id, 'liberty-tx', 'San Jacinto cannot request production-scoped report metadata before activation');

console.log('sanJacintoRuntimeValidationV640.test.js passed');
