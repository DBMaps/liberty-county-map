const assert = require('assert');
const fs = require('fs');
const source = fs.readFileSync('js/app.js', 'utf8');

assert.match(source, /function gridlyLp0546ResolveCurrentAwarenessContext\(options = \{\}\)/, 'LP054.6C has one injected current-awareness boundary');
assert.match(source, /options\.currentAwarenessContext \|\| options\.awarenessAreaOverride \|\| options\.currentAwarenessArea/, 'current awareness injection accepts governed option names');
assert.match(source, /gridlyLp0546AwarenessCompatibilityDetails\(selection\.awarenessAreaId, resolvedIdentity\.awarenessAreaId, currentAwareness\.record\)/, 'crossing resolver consumes injected awareness through production compatibility helper');
assert.match(source, /awareness_area_change_to_other_county[\s\S]*montgomery-county[\s\S]*montgomery-tx/, 'awareness change fixture injects Montgomery County context');
assert.match(source, /resolverConsumedInjectedAwareness/, 'diagnostics prove resolver consumed injected awareness');
assert.match(source, /currentAwarenessOverridePersisted:\s*false/, 'injected awareness context remains in-memory and non-persistent');
assert.match(source, /same_community_compatibility/, 'LP054.6C includes same-community scoped fixture');
assert.match(source, /incompatible_community_scope/, 'LP054.6C includes incompatible community scoped fixture');

assert.match(source, /function gridlyLp0546CrossingAliasDetails\(record = \{\}\)/, 'alias provenance details are generated at resolution time');
assert.match(source, /sourceField, rawAlias, authority/, 'alias details carry source field and authority provenance');
assert.match(source, /productionCrossingId: "prod-waco-US 90"/, 'production-style Waco fixture carries the production identity on canonical record');
assert.match(source, /canonicalCrossingId: "FRA-WACO-US 90"/, 'production-style Waco fixture carries the FRA canonical identity on same record');
assert.match(source, /lookupMatchedBy: "canonical_alias"/, 'alias lookup reports canonical alias matching');
assert.match(source, /matchingCrossingAliasSelectedSource: matchingSelectedSource/, 'identity agreement reports selected alias source');
assert.match(source, /matchingCrossingAliasResolvedSource: matchingResolvedSource/, 'identity agreement reports resolved alias source');
assert.match(source, /conflictingAuthoritativeIdsDetected/, 'conflicting authoritative ids are diagnosed');
assert.match(source, /controlled_road_identity_fallback/, 'road fallback is controlled and separately reasoned');
assert.doesNotMatch(source, /prod-waco-US 90[\s\S]{0,80}FRA-WACO-US 90[\s\S]{0,80}=>|FRA-WACO-US 90[\s\S]{0,80}prod-waco-US 90[\s\S]{0,80}=>/, 'no hard-coded production-to-FRA string mapping is introduced');
assert.match(source, /different_crossing_sharing_us90[\s\S]*shared_route_identity_false_positive/, 'shared US 90 remains protected from false identity agreement');
assert.match(source, /window\.gridlyLp0546cCrossingAwarenessAndAliasCertificationAudit = gridlyLp0546cCrossingAwarenessAndAliasCertificationAudit/, 'LP054.6C browser certification helper is exposed');
assert.match(source, /safeToMergeLp0546c: allCasesPassed/, 'LP054.6C aggregate safe-to-merge gate is exposed');

console.log('LP054.6C awareness override and alias provenance static coverage passed');
