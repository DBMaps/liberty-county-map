import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = name => readFileSync(new URL(`./Web/${name}`, import.meta.url), 'utf8');

// Use the real Leaflet URL generator and map script. The host stands in for DOM
// events and WebKit, and forwards each generated URL through the gateway.
export function createMapFixture(session) {
  const window = { screen: {}, devicePixelRatio: 1 };
  const context = vm.createContext({ window, navigator: { userAgent: 'portable test', platform: '' },
    document: { documentElement: { style: {} }, createElement: () => ({ style: {} }) }, console });
  vm.runInContext(read('vendor/leaflet.js'), context);
  const leaflet = window.L;
  const active = new Set();
  const panes = new Map();
  const status = { textContent: '' };
  const button = { listener: null, addEventListener(_, listener) { this.listener = listener; }, setAttribute() {} };
  const map = {
    setView() { return this; }, attributionControl: { setPrefix() {} },
    hasLayer: layer => active.has(layer), removeLayer: layer => active.delete(layer),
    createPane(name) { const pane = { style: {} }; panes.set(name, pane); return pane; }
  };
  const imagery = { url: null, addTo() { active.add(this); return this; } };
  let labels, realLayer, requests = 0, labelCreations = 0;
  const events = new Map();
  vm.runInNewContext(read('map.js'), {
    window, document: { getElementById: name => name === 'labels' ? button : status },
    L: { map: () => map, imageOverlay: url => { imagery.url = url; return imagery; },
      tileLayer(url, options) {
        labelCreations++;
        realLayer = leaflet.tileLayer(url, options);
        labels = { options, addTo() { active.add(this); return this; }, redraw() {},
          on(type, handler) { events.set(type, handler); } };
        return labels;
      } }
  });
  function tileURL(latitude, longitude, zoom) {
    const pixel = leaflet.CRS.EPSG3857.latLngToPoint(leaflet.latLng(latitude, longitude), zoom);
    realLayer._tileZoom = zoom;
    return realLayer.getTileUrl({ x: Math.floor(pixel.x / 512), y: Math.floor(pixel.y / 512), z: zoom });
  }
  return Object.freeze({
    tileURL,
    toggle: () => button.listener(),
    async move(latitude = 30.0466, longitude = -94.8852, zoom = 13, signal) {
      if (!active.has(labels)) return null;
      requests++;
      const response = await session.load(tileURL(latitude, longitude, zoom), { signal });
      if (response.status !== 499) events.get(response.status === 200 ? 'tileload' : 'tileerror')?.();
      return response;
    },
    state: () => ({ requests, labelCreations, imagery: active.has(imagery), labels: active.has(labels),
      imageryURL: imagery.url, labelPane: panes.get('mockLabels').style.zIndex,
      tileSize: realLayer.getTileSize().x, zoomOffset: labels.options.zoomOffset, status: status.textContent,
      signingExposed: Object.keys(window).some(key => /sign|lease|key/i.test(key)) })
  });
}
