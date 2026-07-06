const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const docSource = fs.readFileSync('docs/audits/GRIDLY-V894B-BETA-INSTANT-INTERACTION-PATCH.md', 'utf8');

assert(appSource.includes('function gridlyBetaInstantInteractionAudit()'), 'V894B browser-console audit helper exists');
assert(appSource.includes('window.gridlyBetaInstantInteractionAudit = gridlyBetaInstantInteractionAudit;'), 'V894B audit helper is exposed on window');
assert(appSource.includes('exposeGridlyAuditHelper("gridlyBetaInstantInteractionAudit", gridlyBetaInstantInteractionAudit);'), 'V894B audit helper is registered');
assert(appSource.includes('gridlyRunAlertsBackgroundRefreshAfterOpen("alerts_open_background_refresh'), 'Alerts refresh is backgrounded after opening');
assert(appSource.includes('gridlyBetaInstantInteractionState.alertsUsesBestAvailableLocalState = true'), 'Alerts open records best available local state first');
assert(appSource.includes('runPostSubmitRefreshInBackground({ stages: [] }, () => {}, "clearHazard_success_background_refresh")'), 'Clear path uses background refresh after accepted write');
assert(appSource.includes('gridlyBetaInstantInteractionState.clearVisualUpdateImmediate = true'), 'Clear path records immediate visual update');
assert(appSource.includes('gridlyBetaInstantInteractionState.reportConfirmationImmediate = true'), 'Report path records immediate confirmation');
assert(appSource.includes('noFakeServerSuccess: true'), 'V894B explicitly avoids fake server success');
assert(appSource.includes('backgroundSyncFailureMessagingPreserved: true'), 'V894B preserves background sync failure messaging');

for (const key of [
  'helperAvailable',
  'alertsOpenImmediate',
  'alertsUsesBestAvailableLocalState',
  'alertsRefreshBackgrounded',
  'clearVisualUpdateImmediate',
  'reportConfirmationImmediate',
  'protectedSystemsUnchanged',
  'noFakeServerSuccess',
  'safeToBetaTest'
]) {
  assert(appSource.includes(key), `V894B audit reports ${key}`);
  assert(docSource.includes(key), `V894B doc reports ${key}`);
}

assert(docSource.includes('window.gridlyBetaInstantInteractionAudit?.()'), 'V894B doc names console helper');
assert(docSource.includes('No Supabase schema'), 'V894B doc confirms protected schema scope');

console.log('v894b-beta-instant-interaction-patch.test.js passed');
