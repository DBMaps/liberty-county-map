const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const auditDoc = fs.readFileSync('docs/audits/GRIDLY-V918-CROSSING-POPUP-OPENING-EXPERIENCE.md', 'utf8');

assert(appSource.includes('function gridlyCrossingPopupOpeningAudit()'), 'V918 exposes a crossing popup opening audit helper');
assert(appSource.includes('window.gridlyCrossingPopupOpeningAudit = gridlyCrossingPopupOpeningAudit'), 'V918 audit helper is available on window');
assert(appSource.includes('version: "V918"'), 'V918 audit reports the V918 version');
assert(appSource.includes('popupLifecycleDetected'), 'V918 audit reports popup lifecycle detection');
assert(appSource.includes('markerRecreatedDuringOpen'), 'V918 audit reports marker recreation during open');
assert(appSource.includes('popupClosedBeforeOpen'), 'V918 audit reports pre-open popup close cycles');
assert(appSource.includes('popupReopened'), 'V918 audit reports repeated popup opens');
assert(appSource.includes('leafletAutoPanTriggered'), 'V918 audit reports Leaflet autopan detection');
assert(appSource.includes('markerClassChanged'), 'V918 audit reports marker class changes');
assert(appSource.includes('cssTransitionDetected'), 'V918 audit reports CSS transition detection');
assert(appSource.includes('domReplacementDetected'), 'V918 audit reports DOM replacement detection');
assert(appSource.includes('zIndexPromotionDetected'), 'V918 audit reports z-index promotion detection');
assert(appSource.includes('flashObserved'), 'V918 audit reports flash observation');
assert(appSource.includes('protectedSystemsUnchanged: true'), 'V918 audit confirms protected systems unchanged');
assert(appSource.includes('duplicateOpenSuppressed'), 'V918 audit reports suppressed duplicate marker.openPopup attempts');
assert(appSource.includes('retryOpenSkippedBecauseAlreadyVisible'), 'V918 audit reports visible popup retry skips');
assert(appSource.includes('safeZoneRetryObserved'), 'V918 audit reports safe-zone visibility retry observation');

assert(appSource.includes('function gridlyCrossingPopupClickTrace()'), 'V918 exposes crossing popup click trace helper');
assert(appSource.includes('window.gridlyCrossingPopupClickTrace = gridlyCrossingPopupClickTrace'), 'V918 click trace helper is available on window');
assert(appSource.includes('window.gridlyResetCrossingPopupClickTrace = gridlyResetCrossingPopupClickTrace'), 'V918 click trace reset helper is available on window');
assert(appSource.includes('GRIDLY_CROSSING_POPUP_CLICK_TRACE_LIMIT = 25'), 'V918 click trace is capped to 25 events');
[
  'timestamp',
  'eventType',
  'crossingId',
  'clickCountForCrossing',
  'openPopupCallCount',
  'popupOpenEventCount',
  'popupCloseEventCount',
  'openReason',
  'duplicateOpenSuppressed',
  'retryOpenSkippedBecauseAlreadyVisible',
  'safeZoneRetryObserved',
  'opensDirectlyOnClick',
  'safeZoneMoveBeforeOpen',
  'safeZonePositioningOnly',
  'retryUsedAsFallbackOnly',
  'markerDomPresent',
  'popupDomPresent',
  'flashObserved',
  'marker_click',
  'popup_open_requested',
  'popup_opened',
  'safe_zone_positioning',
  'popup_closed',
  'second_click_same_crossing'
].forEach((traceToken) => assert(appSource.includes(traceToken), `V918 click trace includes ${traceToken}`));

const openingFunctionStart = appSource.indexOf('function openCrossingPopupFromMarkerInteraction');
const openingFunctionEnd = appSource.indexOf('function getGridlyCrossingMarkerTouchPoint', openingFunctionStart);
const openingFunction = appSource.slice(openingFunctionStart, openingFunctionEnd);
assert(!openingFunction.includes('closePopup?.()'), 'V918 removes explicit pre-open closePopup from crossing marker opening path');
assert(openingFunction.includes('marker.openPopup() owns any necessary replacement without a close/open flash'), 'V918 documents why pre-open closePopup stays removed');
assert(appSource.includes('gridlyCrossingPopupOpeningAuditState.renderDuringOpenCount += 1'), 'V918 instruments render attempts during popup opening');
assert(appSource.includes('gridlyCrossingPopupOpeningAuditState.openPopupCallCount += 1'), 'V918 instruments marker.openPopup calls');
assert(appSource.includes('gridlyCrossingPopupOpeningAuditState.popupCloseEventCount += 1'), 'V918 instruments popup close events');
assert(appSource.includes('openDirectlyOnClick("direct-click")'), 'V918 opens crossing popups directly on marker click before safe-zone positioning');
assert(appSource.includes('safeZonePositioningOnly'), 'V918 records safe-zone movement as positioning only after the direct open');
assert(!openingFunction.includes('safe_zone_moveend'), 'V918 no longer uses safe-zone moveend as the routine first open trigger');
assert(!openingFunction.includes('post-pan-fallback'), 'V918 no longer schedules routine delayed post-pan popup opens');
assert(appSource.includes('visibility-retry-already-visible'), 'V918 keeps visible retry suppression only as a fallback if verification still needs it');

[
  'Executive summary',
  'Popup opening lifecycle',
  'Marker lifecycle',
  'Leaflet interaction sequence',
  'CSS transition review',
  'Popup timing review',
  'Z-index review',
  'DOM replacement review',
  'Marker recreation review',
  'Render ownership',
  'Root cause',
  'Fix implemented',
  'Final recommendation'
].forEach((heading) => assert(auditDoc.includes(heading), `V918 audit doc includes ${heading}`));
