const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

[
  'gridlyRenderPipelineAttributionAudit',
  'gridlyCrossingRenderSignatureDiffAudit',
  'gridlyFrameSchedulingAudit',
  'gridlyMarkerReuseAudit',
  'gridlyPanelPaintTimingAudit'
].forEach((helper) => assert(appSource.includes(`window.${helper}`) || appSource.includes(helper), `${helper} must be exposed`));

assert(appSource.includes('GRIDLY_V921_VERSION = "V921-render-pipeline-attribution-frame-scheduling"'), 'V921 audit version is present');
assert(appSource.includes('gridlyV921RenderPipelineState'), 'render pipeline attribution state exists');
assert(appSource.includes('input record acquisition'), 'crossing input acquisition phase is measured');
assert(appSource.includes('awareness/public-roadway/visibility/bounds filtering'), 'crossing filtering phases are attributed');
assert(appSource.includes('render-signature construction'), 'crossing signature construction is attributed');
assert(appSource.includes('previous-signature comparison'), 'signature comparison phase is attributed');
assert(appSource.includes('gridlyV921NormalizeRenderReason'), 'render reasons are normalized');
assert(appSource.includes('selected-crossing-change'), 'state-change render reasons become meaningful categories');
assert(appSource.includes('gridlyV921RecordSignatureDiff'), 'signature diff diagnostic exists');
assert(appSource.includes('changedFields'), 'signature diff reports field-level changes');
assert(appSource.includes('volatileOnlyChanges'), 'volatile-only signature changes are classified');
assert(appSource.includes('fullRebuildRequired'), 'signature diff reports full rebuild requirement');
assert(appSource.includes('gridlyV921MarkerSignature'), 'stable crossing IDs support marker reuse inventory');
assert(appSource.includes('reusableCrossingIds'), 'unchanged crossing markers can be reused');
assert(appSource.includes('crossingLayer.removeLayer?.(marker); crossingMarkers.delete(String(id));'), 'removed markers do not remain visible');
assert(appSource.includes('crossingsNeedingMarkers'), 'new and changed markers are identified for insertion');
assert(appSource.includes('gridlyV921ScheduleBatches'), 'frame batching helper exists');
assert(appSource.includes('generation !== gridlyV920MainThreadRepairState.renderGeneration'), 'stale render generations cannot commit');
assert(appSource.includes('completedGenerations'), 'frame batches terminate and are recorded');
assert(appSource.includes('cancelledGenerations'), 'stale batch cancellations are recorded');
assert(!appSource.includes('gridlyV920Measure("crossingLayer.clearLayers"'), 'full crossing layer clear is superseded by diff reconciliation');
assert(appSource.includes('popupPreserved: true'), 'frame scheduling audit tracks popup preservation');
assert(appSource.includes('selectedMarkerPreserved: true'), 'frame scheduling audit tracks selected marker preservation');
assert(appSource.includes('isGridlyPublicRoadwayCrossing(crossing)'), 'PUBLIC_ROADWAY filtering remains in the render path');
assert(appSource.includes('gridlyV921AlertCall') && appSource.includes('signatureComparedBeforeDomReplacement'), 'alerts render attribution and early DOM guard are tracked');
assert(appSource.includes('communityPulseCalls'), 'Community Pulse attribution surface exists');
assert(appSource.includes('acknowledgement') && appSource.includes('shellVisible') && appSource.includes('contentFirstPaint') && appSource.includes('contentReady') && appSource.includes('fullInteractionCompletion'), 'panel paint timing reports separate phases');
assert(appSource.includes('noProductionWrites') || appSource.includes('production report writes') || appSource.includes('read-only'), 'simulation/read-only protections remain documented in source');
assert(appSource.includes('safeForPatch: true'), 'instrumentation remains lightweight and patch-scoped');
assert(appSource.includes('wireCrossingMarkerEarlyTapOpen(marker, crossing)'), 'V918 one-tap popup path is preserved');
assert(appSource.includes('stateChangeRenderBlockedDuringPopupOpen'), 'V918 no popup-triggered crossing rebuild guard is preserved');

console.log('V921 render pipeline attribution and frame scheduling static checks passed');
