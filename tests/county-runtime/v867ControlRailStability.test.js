const fs = require('fs');
const assert = require('assert');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const cssSource = fs.readFileSync('css/styles.css', 'utf8');

const syncStart = appSource.indexOf('function gridlyPortraitSpatialOwnershipSync()');
const syncEnd = appSource.indexOf('if (document.readyState === "loading")', syncStart);
assert(syncStart > -1 && syncEnd > syncStart, 'spatial ownership sync is present');
const syncSource = appSource.slice(syncStart, syncEnd);

assert(!/\.appendChild\(rail\)|\.insertBefore\(rail\)|moveChild\(rail\)/.test(syncSource), 'V867 sync does not re-parent the Portrait V2 control rail');
assert(!/previousVisibleParent|restoreParent|LastVisibleControlRailParent|RestoreControlRail/.test(appSource), 'V867 removes previous-parent tracking and rail restoration logic');

assert(appSource.includes('zoomVisible: Boolean(zoomInVisible && zoomOutVisible)'), 'portrait spatial audit reports zoom control visibility');
assert(appSource.includes('layersVisible: gridlyPortraitControlButtonVisible'), 'portrait spatial audit reports layer control visibility');
assert(appSource.includes('locationVisible: gridlyPortraitControlButtonVisible'), 'portrait spatial audit reports location control visibility');
assert(appSource.includes('controlsReachable: gridlyPortraitControlReachable(controlRail)'), 'portrait spatial audit reports control reachability');
assert(appSource.includes('controlsDoNotOverlapFilter:'), 'portrait spatial audit reports filter-strip overlap');
assert(appSource.includes('mapVisibleCollapsed:'), 'portrait spatial audit reports collapsed map visibility');
assert(appSource.includes('mapVisibleExpanded:'), 'portrait spatial audit reports expanded map visibility');
assert(!appSource.includes('controlRailParentInsideMapToolsOverlay'), 'portrait spatial audit no longer requires map-tools-overlay DOM ownership');

assert(cssSource.includes('V867 — Stable visual map-control ownership without DOM moves'), 'V867 CSS stability block is present');
assert(cssSource.includes('position: fixed !important;'), 'V867 positions the naturally-owned rail without moving its DOM node');
assert(cssSource.includes('z-index: 650 !important;'), 'V867 stacks controls above the map while preserving reachability');

console.log('v867ControlRailStability.test.js passed');
