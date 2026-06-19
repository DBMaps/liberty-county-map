const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert(source.includes('function gridlyCanonicalReportIdForRecord(record = {}, fallback = "")'), 'Canonical report id helper exists');
assert(source.includes('function gridlyRegisterAcceptedLocalHazard(localHazardEntry = {}, submittedReportId = "")'), 'Accepted local hazard registration helper exists');
assert(source.includes('gridlyRegisterAcceptedLocalHazard(localHazardEntry, row.crossing_id);'), 'Accepted road hazard registers with submitted crossing_id');
assert(source.includes('activeHazards = [localHazardEntry, ...activeHazards.filter((hazard) => gridlyCanonicalReportIdForRecord(hazard) !== gridlyCanonicalReportIdForRecord(localHazardEntry))]'), 'Accepted road hazard is inserted into activeHazards by canonical id');
assert(source.includes('function gridlyMergeAcceptedLocalHazardsIntoActiveInventory(reason = "unspecified")'), 'Local accepted hazard merge helper exists');
assert(source.includes('const localAcceptedHazardsRestored = gridlyMergeAcceptedLocalHazardsIntoActiveInventory(`loadSharedReports:${reason}`);'), 'loadSharedReports restores accepted local hazards after refresh overwrite');
assert(source.includes('gridlyReportSubmissionOwnershipState.lastRefreshResetDetected = localAcceptedHazardsRestored > 0;'), 'Audit can detect activeHazards reset/overwrite after registration');
assert(source.includes('submittedReportId'), 'Audit exposes submittedReportId');
assert(source.includes('canonicalReportId'), 'Audit exposes canonicalReportId');
assert(source.includes('possibleIdMismatch'), 'Audit exposes possible ID mismatch');
assert(source.includes('idMatchedBy'), 'Audit reports which ID matched');
assert(source.includes('asyncRegistrationPending'), 'Audit reports async registration pending state');
assert(source.includes('activeHazardIdsSample'), 'Audit samples active hazard IDs');
assert(source.includes('activeReportIdsSample'), 'Audit samples active report IDs');
assert(source.includes('sharedReportIdsSample'), 'Audit samples shared report IDs');
assert(!/montgomery-tx/i.test(source.slice(source.indexOf('function gridlyMergeAcceptedLocalHazardsIntoActiveInventory'), source.indexOf('function gridlyRecordReportSubmissionOwnershipAttempt'))), 'Registration fix is generalized and not Montgomery hardcoded');
assert(source.includes('historicalReadsEnabled: false') || source.includes('historyUiEnabled: false') || source.includes('GRIDLY_HISTORICAL_READS_ENABLED = false'), 'Historical protected boundary remains explicitly disabled somewhere in source');

console.log('reportRegistrationRootCauseV622_1.test.js passed');
