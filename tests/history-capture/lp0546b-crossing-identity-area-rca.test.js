const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'app.js'), 'utf8');

function includes(text, message) {
  assert.ok(source.includes(text), message);
}

includes('function gridlyLp0546ResolveAwarenessAreaIdentity', 'LP054.6B has one canonical awareness area identity resolver');
includes('GRIDLY_AWARENESS_AREA_DEFINITIONS', 'awareness identity resolver uses existing Gridly awareness governance registry');
includes('GRIDLY_COUNTY_REGISTRY', 'awareness identity resolver uses county registry for canonical county ids');
includes('liberty-county', 'LP054.6B documents crossing-package/countywide awareness key liberty-county');
includes('liberty-tx', 'LP054.6B documents canonical Liberty county runtime id liberty-tx');
includes('canonical_area_alias', 'equivalent awareness aliases produce explicit canonical_area_alias reason');
includes('countywide_parent_match', 'countywide awareness preserves in-county crossings by parent county');
includes('incompatible_community', 'community-scoped mismatches are explicitly rejected');
includes('incompatible_county', 'different counties are explicitly rejected');
includes('function gridlyLp0546CrossingAliases', 'LP054.6B has one crossing alias-set resolver');
includes('productionCrossingId', 'production crossing IDs participate in alias sets');
includes('fraCrossingId', 'FRA crossing IDs participate in alias sets');
includes('canonical_alias_intersection', 'alias-set intersection produces identity agreement');
includes('different_crossing_sharing_us90', 'shared US 90 route text alone is certified as insufficient');
includes('window.gridlyLp0546bCrossingIdentityRcaAudit = gridlyLp0546bCrossingIdentityRcaAudit', 'RCA browser helper is exposed');
includes('window.gridlyLp0546bCrossingIdentityAndAreaCertificationAudit = gridlyLp0546bCrossingIdentityAndAreaCertificationAudit', 'final LP054.6B certification helper is exposed');
includes('fixturePersistenceDetected: false', 'fixture persistence remains guarded false');
includes('historyWriteAttemptDetected: false', 'history write attempts remain guarded false');
includes('activeStateMutationDetected: false', 'active-state mutation remains guarded false');
includes('safeToMergeLp0546b', 'LP054.6B aggregate exposes safe-to-merge status');

console.log('LP054.6B crossing identity and awareness area RCA tests passed');
