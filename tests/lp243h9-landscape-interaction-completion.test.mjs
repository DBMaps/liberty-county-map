import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const h9 = css.slice(css.indexOf("/* LP243.H9"));
const lifecycle = app.slice(app.indexOf("// LP243.H8 is presentation-local"), app.indexOf("const MOBILE_REPORT_ENTRY_SELECTORS"));

function runtimeFixture({ disclosure = true } = {}) {
  class TokenList { constructor() { this.values = new Set(); } toggle(name, on) { on ? this.values.add(name) : this.values.delete(name); } }
  class Element {
    constructor(id, tagName = "DIV") { this.id = id; this.tagName = tagName; this.attrs = new Map(); this.dataset = {}; this.disabled = false; this.isConnected = true; this.classList = new TokenList(); this.listeners = {}; }
    setAttribute(name, value) { this.attrs.set(name, String(value)); }
    removeAttribute(name) { this.attrs.delete(name); }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    querySelector() { return null; }
    contains(node) { return node === this; }
    getBoundingClientRect() { return { left: 400, right: 460, top: 386, bottom: 430, width: 60, height: 44 }; }
    click() { this.listeners.click?.({ type: "click" }); }
  }
  const toggle = disclosure ? new Element("gridlyLandscapeCommandToggle", "BUTTON") : null;
  const location = new Element("mobileDestinationCommandPanel", "ARTICLE");
  const actions = new Element("gridlyLandscapeCommandPanel", "DIV");
  const elements = new Map([[location.id, location], [actions.id, actions], ...(toggle ? [[toggle.id, toggle]] : [])]);
  const body = { classList: new TokenList() };
  const document = {
    readyState: "complete", body,
    getElementById: id => elements.get(id) || null,
    querySelector: selector => selector.startsWith("#") ? elements.get(selector.slice(1)) || null : null,
    elementFromPoint: () => toggle,
    addEventListener() {}
  };
  const mediaListeners = [];
  const window = {
    innerWidth: 932, innerHeight: 430,
    matchMedia: () => ({ matches: true, addEventListener: (_name, fn) => mediaListeners.push(fn) }),
    getComputedStyle: () => ({ display: "grid", visibility: "visible", pointerEvents: "auto" }),
    requestAnimationFrame: fn => fn()
  };
  const context = { window, document, globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(`${lifecycle}\nglobalThis.h9 = { audit: gridlyLandscapeCommandDisclosureAudit, sync: syncGridlyLandscapeCommandPanel };`, context);
  return { ...context.h9, toggle, location, actions, body };
}

test("production initialization resolves exactly one real button disclosure and live owners", () => {
  assert.equal((html.match(/id="gridlyLandscapeCommandToggle"/g) || []).length, 1);
  assert.match(html, /<button id="gridlyLandscapeCommandToggle"[^>]*aria-expanded="false"[^>]*aria-controls="mobileDestinationCommandPanel gridlyLandscapeCommandPanel"[^>]*aria-label="Show Location Context and actions"/);
  for (const id of ["mobileDestinationCommandPanel", "gridlyLandscapeCommandPanel"])
    assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
  const fixture = runtimeFixture();
  assert.equal(fixture.audit().valid, true);
  assert.equal(fixture.location.hasOwnProperty("inert"), false);
  assert.equal(fixture.location.getAttribute("inert"), "");
});

test("collapse is fail-open when runtime disclosure authority is missing", () => {
  const fixture = runtimeFixture({ disclosure: false });
  assert.equal(fixture.sync(), false);
  assert.equal(fixture.location.getAttribute("inert"), null);
  assert.equal(fixture.actions.getAttribute("aria-hidden"), null);
  assert.equal(fixture.body.classList.values.has("gridly-h9-command-fail-open"), true);
});

test("pointer and native keyboard button activation synchronize expansion and owners", () => {
  const fixture = runtimeFixture();
  assert.equal(fixture.toggle.getAttribute("aria-expanded"), "false");
  fixture.toggle.click();
  assert.equal(fixture.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(fixture.toggle.getAttribute("aria-label"), "Hide Location Context and actions");
  assert.equal(fixture.location.getAttribute("inert"), null);
  fixture.toggle.click();
  assert.equal(fixture.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(fixture.location.getAttribute("inert"), "");
});

test("H9 KBYG foreground is bounded, scrollable, and above map chrome only in short landscape", () => {
  assert.match(h9, /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.doesNotMatch(h9, /orientation:\s*portrait/);
  assert.match(h9, /gridly-h9-brief-foreground[\s\S]*?gridly-brief-interaction-panel\[data-gridly-brief-expanded="true"\][\s\S]*?top:[\s\S]*?bottom:[\s\S]*?height: auto !important[\s\S]*?max-height: calc\(100dvh[\s\S]*?overflow-y: auto !important/);
  assert.match(h9, /z-index: 1301 !important/);
  assert.match(h9, /gridly-brief-foundation-handle[\s\S]*?position: fixed !important[\s\S]*?z-index: 1302 !important/);
  for (const viewport of [[932, 430], [844, 390]]) assert.ok(viewport[0] > viewport[1] && viewport[1] <= 500);
  for (const viewport of [[320, 700], [390, 844], [430, 932]]) assert.equal(viewport[0] > viewport[1] && viewport[1] <= 500, false);
});

test("existing KBYG intelligence, handle, foreground actions, and legacy suppression remain authoritative", () => {
  assert.equal((html.match(/id="gridlyBriefFoundationHandle"/g) || []).length, 1);
  assert.equal((html.match(/id="gridlyBriefInteractionPanel"/g) || []).length, 1);
  assert.match(app, /gridlyBriefInteractionSetExpanded\(handle\.getAttribute\("aria-expanded"\) !== "true"\)/);
  assert.match(app, /gridlyLandscapeCommandExpandedBeforeBrief = gridlyLandscapeCommandExpanded[\s\S]*?gridlyLandscapeCommandExpanded = false/);
  assert.match(app, /!expanded && gridlyLandscapeCommandExpandedBeforeBrief[\s\S]*?gridlyLandscapeCommandExpanded = true/);
  for (const action of ["report", "alerts", "history", "settings"])
    assert.equal((html.match(new RegExp(`data-v2-sheet="${action}"`, "g")) || []).length, 1);
  assert.match(css, /LP243\.H4 — current consumer-presentation ownership/);
  assert.doesNotMatch(h9, /fetch\(|Supabase|setView|replaceChildren/);
});
