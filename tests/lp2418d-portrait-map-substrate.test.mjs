import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ROOT } from '../tools/lp1831/prepare-cloudflare-preview-artifact.mjs';

const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test('LP241.8D retains the complete structural map ancestry in portrait', () => {
  assert.match(html, /<main class="app-shell[^>]*>[\s\S]*?<div class="main-column">[\s\S]*?<section class="command-center" id="mapSection">[\s\S]*?<section class="map-card">[\s\S]*?<div class="map-frame">[\s\S]*?<div id="map"/);
  assert.match(css, /\.app-shell > :not\(\.main-column\)/);
  assert.match(css, /\.app-shell > \.main-column > :not\(#mapSection\)/);
  assert.doesNotMatch(css, /\.app-shell > :not\(#mapSection\)/);
  assert.match(css, /body\[data-layout-mode="portrait"\] \.app-shell \{[\s\S]*?min-height: 100dvh/);
  assert.match(css, /body\[data-layout-mode="portrait"\] \.dashboard,[\s\S]*?\.command-center,[\s\S]*?\.map-card,[\s\S]*?\.map-frame \{[\s\S]*?height: 100dvh !important/);
  assert.match(css, /body\[data-layout-mode="portrait"\] #map,[\s\S]*?#map\.leaflet-container \{[\s\S]*?height: 100dvh !important/);
});

test('LP241.8D suppresses presentation siblings without suppressing the map host', () => {
  assert.match(app, /"\.app-shell > :not\(\.main-column\)"/);
  assert.match(app, /"\.app-shell > \.main-column > :not\(#mapSection\)"/);
  assert.match(app, /"#mapSection > :not\(\.map-card\)"/);
  assert.match(app, /"#mapSection > \.map-card > :not\(\.map-frame\)"/);
  assert.match(app, /"#mapSection > \.map-card > \.map-frame > :not\(#map\)"/);
  assert.match(app, /legacyDashboard\?\.setAttribute\("inert", ""\)/);
  assert.match(app, /legacyDashboard\?\.setAttribute\("aria-hidden", "true"\)/);
});

test('LP241.8D audit and lifecycle require a rendered Leaflet substrate', () => {
  for (const field of ['mapContainerRect', 'mapAncestorRects', 'leafletInstanceAvailable', 'leafletPaneCount', 'tileLayerCount', 'mapRenderable', 'mapSuppressionConflict']) {
    assert.match(app, new RegExp(`\\b${field}\\b`), field);
  }
  assert.match(app, /const sharedMapRequired = mapRenderable/);
  assert.match(app, /portraitActive && sharedMapRequired/);
  assert.match(app, /syncGridlyPortraitMapSubstrateAfterLayout\(\)/);
  assert.match(app, /mapInstance\.invalidateSize\(\{ pan: false, animate: false, debounceMoveend: true \}\)/);
  assert.match(app, /mapInstance\.getContainer\(\) === map/);
  assert.match(app, /tileLayerCount > 0 \|\| mapRenderStateValid/);
});
