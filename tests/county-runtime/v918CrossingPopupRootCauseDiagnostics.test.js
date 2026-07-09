const fs = require('fs');
const assert = require('assert');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const auditDoc = fs.readFileSync('docs/audits/GRIDLY-V918-CROSSING-POPUP-OPENING-EXPERIENCE.md', 'utf8');

assert(appSource.includes('function gridlyCrossingPopupRootCauseAudit()'), 'V918 root-cause audit helper exists');
assert(appSource.includes('window.gridlyCrossingPopupRootCauseAudit = gridlyCrossingPopupRootCauseAudit'), 'V918 root-cause helper is exposed on window');
assert(appSource.includes('function gridlyCrossingPopupTapPointAudit()'), 'V918 tap-point audit helper exists');
assert(appSource.includes('window.gridlyCrossingPopupTapPointAudit = gridlyCrossingPopupTapPointAudit'), 'V918 tap-point helper is exposed on window');
assert(appSource.includes('version: "V918-root-cause"'), 'V918 root-cause audit reports diagnostic version');
[
  'firstClickDetected',
  'firstClickMarkerResolved',
  'firstClickMarkerHasPopup',
  'firstClickOpenAttempted',
  'firstClickOpenSucceeded',
  'firstClickConsumedByMap',
  'firstClickConsumedBySafeZone',
  'firstClickBlockedByOverlay',
  'firstClickMarkerDomReady',
  'firstClickPopupDomCreated',
  'secondClickRequired',
  'secondClickReason',
  'flickerObserved',
  'flickerLikelyCause',
  'markerHandleStable',
  'duplicateMarkerHandlesDetected',
  'crossingLayerStable',
  'crossingRenderDuringClick',
  'mapMoveBeforeOpen',
  'safeZoneMoveBeforeOpen',
  'rootCause',
  'recommendedFix',
  'protectedSystemsUnchanged'
].forEach((token) => assert(appSource.includes(token), `root-cause audit includes ${token}`));
[
  'eventTargetClassName',
  'leafletMarkerHandlerFired',
  'appCrossingHandlerFired',
  'crossingIdResolved',
  'markerStableId',
  'popupBoundBeforeOpen',
  'openPopupCalled',
  'popupDomExistsAfterOpenAttempt',
  'mapMovedBeforePopupAppeared',
  'markerWasRemovedOrRecreatedDuringClick',
  'overlayElementAtTapPoint'
].forEach((token) => assert(appSource.includes(token), `click trace includes ${token}`));
assert(auditDoc.includes('First-click failure investigation'), 'doc includes first-click failure investigation');
assert(auditDoc.includes('Flicker investigation'), 'doc includes flicker investigation');
assert(auditDoc.includes('Hypotheses tested'), 'doc includes hypotheses tested');
assert(auditDoc.includes('Confirmed root cause'), 'doc includes confirmed root cause section');
assert(auditDoc.includes('window.gridlyCrossingPopupRootCauseAudit?.()'), 'doc includes root-cause helper command');
assert(auditDoc.includes('window.gridlyCrossingPopupTapPointAudit?.()'), 'doc includes tap-point helper command');
