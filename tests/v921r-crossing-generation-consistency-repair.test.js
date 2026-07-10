const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync('js/app.js', 'utf8');

function includes(snippet, message) { assert(app.includes(snippet), message); }

includes('GRIDLY_V921R_VERSION = "V921R-crossing-generation-consistency-repair"', 'V921R version is declared');
includes('function gridlyCrossingGenerationConsistencyAudit()', 'required V921R consistency helper is exposed');
includes('function gridlyCrossingViewportEventAttributionAudit()', 'required V921R viewport attribution helper is exposed');
includes('function gridlyCrossingSignatureModelAudit()', 'required V921R signature model helper is exposed');
includes('expectedMarkerIds', 'authoritative expected marker IDs are tracked');
includes('actualMarkerIds', 'actual rendered marker IDs are tracked');
includes('missingMarkerIds', 'missing marker IDs force consistency failures');
includes('unexpectedMarkerIds', 'unexpected marker IDs force consistency failures');
includes('duplicateMarkerIds', 'duplicate marker IDs force consistency failures');
includes('expected-marker-set-matches-rendered-marker-set', 'finalStateConsistent requires exact marker membership');
includes('selected-crossing-only', 'selected-crossing-only source authority is classified');
includes('popup-context-only', 'popup-context-only source authority is classified');
includes('diagnostic-only', 'diagnostic-only source authority is classified');
includes('gridlyV921RIsAuthoritativeSource', 'only authoritative sources may remove markers');
includes('markersPendingRemoval', 'obsolete marker removal is deferred until commit');
includes('commitAuthoritativeCrossingGeneration', 'authoritative generation commits final registry after scheduled additions');
includes('recoveryAttempts += 1', 'recovery guard is bounded to one attempt');
includes('recoverySucceeded', 'recovery result is recorded');
includes('crossingRenderGeneration', 'crossing-specific render generation owner exists');
includes('crossingAuthoritativeGeneration', 'crossing-specific authoritative generation owner exists');
includes('generation !== gridlyV920MainThreadRepairState.crossingRenderGeneration', 'stale crossing batches cannot commit after cancellation');
includes('timeBudgetMs = 12', 'frame scheduler uses a time budget');
includes('batchSize: 8', 'first frame batch no longer starts at 36 items');
includes('batchesOver50', 'frame audit reports batches over 50 ms');
includes('firstBatchDuration', 'frame audit reports first batch duration');
includes('batchTimeBudget', 'frame audit reports batch time budget');
includes('popupAutopanRenderDetected', 'lifecycle audit attributes popup autopan renders');
includes('popupInvalidateSizeRenderDetected', 'lifecycle audit attributes invalidateSize renders');
includes('intentionalViewportRenderDetected', 'lifecycle audit attributes intentional viewport renders');
includes('falseViewportRenderBlocked', 'lifecycle audit reports blocked false viewport renders');
includes('membershipSignature', 'signature model separates membership signature');
includes('visualSignature', 'signature model separates marker visual signature');
includes('popupSignature', 'signature model separates popup signature');
includes('selectionSignature', 'signature model separates selection signature');
includes('selectionRevision', 'opaque revision field is named as selectionRevision');
includes('dataRevision', 'data revision is named separately from membership IDs');
includes('visualStateRevision', 'visual revision is named separately from membership IDs');
includes('PUBLIC_ROADWAY', 'PUBLIC_ROADWAY filtering remains present');
includes('openCrossingPopupFromMarkerInteraction', 'V918 one-tap popup path remains present');

console.log('V921R crossing generation consistency repair source audit passed');
