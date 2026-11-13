import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const destination = process.argv[2];
if (!destination) throw Error('Pass the disposable Harness directory');
const reference = new URL('../../../ios-arcgis-labels-integration/', import.meta.url);
const web = join(destination, 'Web');
mkdirSync(join(web, 'vendor'), { recursive: true });
for (const file of ['imagery.svg', 'vendor/leaflet.css', 'vendor/leaflet.js', 'vendor/LICENSE']) {
  copyFileSync(new URL('Web/' + file, reference), join(web, file));
}
copyFileSync(new URL('Tests/TileCoreTests/Fixtures/valid.png', reference), join(destination, 'valid.png'));
const overlay = readFileSync(new URL('../../leaflet-overlay.mjs', import.meta.url), 'utf8');
const html = readFileSync(new URL('Web/map.html', reference), 'utf8')
  .replace("script-src 'self';", "script-src 'self' capacitor:;")
  .replace("style-src 'self'", "style-src 'self' capacitor:")
  .replace("img-src 'self'", "img-src 'self' capacitor:")
  .replace('base-uri', "frame-src 'none'; base-uri");
writeFileSync(join(web, 'map.html'), html);
writeFileSync(join(web, 'map.js'), `(() => {
  'use strict';
  ${overlay.replace('export function', 'function')}
  const bounds = [[29.99, -94.98], [30.12, -94.79]];
  const map = L.map('map', { minZoom: 12, maxZoom: 20, maxBounds: bounds, maxBoundsViscosity: 1 })
    .setView([30.0466, -94.8852], 15);
  map.attributionControl.setPrefix(false);
  const imagery = L.imageOverlay('imagery.svg', bounds, { interactive: false });
  const satellite = L.layerGroup([imagery]);
  const pane = map.createPane('arcgisImageryLabelsPane');
  pane.style.zIndex = '450'; // Harness uses a local image overlay in pane 400.
  pane.style.pointerEvents = 'none';
  const toggle = document.getElementById('labels');
  const status = document.getElementById('status');
  const rendered = new Set();
  let announced = false;
  function mark(kind) {
    rendered.add(kind);
    if (!announced && rendered.has('imagery') && rendered.has('labels')) {
      announced = true;
      status.textContent = 'Pilot labels loaded';
      const marker = document.createElement('img');
      marker.hidden = true;
      document.body.appendChild(marker);
      marker.src = 'capacitor://localhost/ready';
    }
  }
  imagery.on('load', () => mark('imagery'));
  const harnessLeaflet = { tileLayer(url, options) {
    return L.tileLayer(url, options).on('tileload', () => mark('labels'));
  }};
  const labels = attachPilotLabels({ L: harnessLeaflet, satellite, nativeEnabled: true,
    attribution: 'Synthetic imagery and labels' });
  let visible = true;
  toggle.addEventListener('click', () => {
    visible = !visible;
    toggle.setAttribute('aria-pressed', String(visible));
    if (visible) labels.resume(); else labels.suspend();
  });
  satellite.addTo(map);
})();\n`);
