import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const harness = read("Web/map.js");

function fixture() {
  const members = new Set();
  const calls = [];
  const layers = [];
  const elements = {
    labels: {
      listeners: {},
      setAttribute(key, value) { this[key] = value; },
      addEventListener(type, callback) { this.listeners[type] = callback; }
    },
    status: { textContent: "" }
  };
  const map = {
    setView() { return this; },
    attributionControl: { setPrefix() {} },
    hasLayer: layer => members.has(layer),
    createPane(name) {
      const pane = { style: {} };
      this.panes[name] = pane;
      return pane;
    },
    panes: {},
    removeLayer(layer) { members.delete(layer); calls.push(["remove", layer.name]); },
    move() {
      for (const layer of members) if (layer.name === "labels") calls.push(["request", layer.name]);
    }
  };
  function layer(name, url, options) {
    const listeners = new Map();
    const instance = {
      name, url, options,
      addTo() {
        assert.ok(!members.has(this), "duplicate addition");
        members.add(this);
        calls.push(["add", name]);
        if (name === "labels") calls.push(["request", name]);
        return this;
      },
      redraw() { calls.push(["request", name]); },
      on(type, fn) { listeners.set(type, fn); },
      emit(type) { listeners.get(type)?.(); }
    };
    layers.push(instance);
    return instance;
  }
  const window = {};
  vm.runInNewContext(harness, {
    window,
    document: { getElementById: name => elements[name] },
    L: {
      map: () => map,
      imageOverlay: (url, bounds, options) => layer("imagery", url, options),
      tileLayer: (url, options) => layer("labels", url, options)
    }
  });
  return { map, layers, calls, members, elements, window };
}

function loadLeaflet() {
  const window = { screen: {}, devicePixelRatio: 1 };
  const context = vm.createContext({
    window, navigator: { userAgent: "portable test", platform: "" },
    document: { documentElement: { style: {} }, createElement: () => ({ style: {} }) },
    console
  });
  vm.runInContext(read("Web/vendor/leaflet.js"), context);
  return window.L;
}

test("pinned Leaflet itself generates level/row/column with the 512px scale", () => {
  const L = loadLeaflet();
  assert.equal(L.version, "1.9.4");
  const { layers } = fixture();
  const model = layers[1];
  const real = L.tileLayer(model.url, model.options);
  real._tileZoom = 13;
  const pixel = L.CRS.EPSG3857.latLngToPoint(L.latLng(30.0466, -94.8852), 13);
  const tile = { x: Math.floor(pixel.x / 512), y: Math.floor(pixel.y / 512), z: 13 };
  assert.equal(real.getTileUrl(tile), "gridly-label://mock/tile/12/1689/968");
  assert.equal(real.getTileSize().x, 512);
});

test("a single label pane is above the imagery overlay and is non-interactive", () => {
  const { map, layers, members } = fixture();
  assert.equal(layers[0].url, "imagery.svg");
  assert.deepEqual([...members].map(x => x.name), ["imagery", "labels"]);
  assert.equal(layers[1].options.pane, "mockLabels");
  assert.ok(Number(map.panes.mockLabels.style.zIndex) > 400);
  assert.equal(map.panes.mockLabels.style.pointerEvents, "none");
});

test("disabled labels request nothing during pan, zoom, or manual redraw", () => {
  const { map, layers, calls, members, elements, window } = fixture();
  elements.labels.listeners.click();
  const count = calls.length;
  map.move();
  map.move();
  window.redrawMockLabels();
  assert.equal(calls.length, count);
  assert.equal(elements.labels["aria-pressed"], "false");
  assert.deepEqual([...members], [layers[0]]);
});

test("repeated toggling uses one layer and restores the original overlay", () => {
  const { layers, members, elements, calls } = fixture();
  for (let i = 0; i < 12; i++) elements.labels.listeners.click();
  assert.equal(layers.length, 2);
  assert.deepEqual([...members], layers);
  assert.equal(calls.filter(x => x[0] === "add" && x[1] === "imagery").length, 1);
  assert.equal(elements.labels["aria-pressed"], "true");
});

test("tile failure preserves imagery, and late events after disabling do not replace status", () => {
  const { layers, members, elements } = fixture();
  layers[1].emit("tileerror");
  assert.deepEqual([...members], layers);
  assert.equal(elements.status.textContent, "A label tile failed");
  elements.labels.listeners.click();
  layers[1].emit("tileload");
  assert.equal(elements.status.textContent, "Labels off");
  assert.deepEqual([...members], [layers[0]]);
});

test("rapid simulated pan and zoom retain one label layer", () => {
  const { map, layers, members, calls } = fixture();
  for (let i = 0; i < 30; i++) map.move();
  assert.deepEqual([...members], layers);
  assert.equal(calls.filter(x => x[0] === "add" && x[1] === "labels").length, 1);
});

test("the app's sources contain only local map resources and closed network surfaces", () => {
  const html = read("Web/map.html");
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /img-src 'self' gridly-label: data:/);
  for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    assert.doesNotMatch(match[1], /^(?:[a-z]+:|\/\/)/i);
  }
  assert.doesNotMatch(harness, /\b(?:fetch|XMLHttpRequest)\s*\(|https?:/);
  const swift = read("App/GridlyLabelTileSchemeHandler.swift") + read("App/LabelTileHarness.swift")
    + read("Sources/TileCore/LabelTileCore.swift");
  assert.doesNotMatch(swift, /URLSession|Referer|apiKey|Authorization|https?:\/\/|\b(?:print|NSLog)\s*\(/i);
  assert.equal((swift.match(/\.setURLSchemeHandler\(/g) || []).length, 1);
});
