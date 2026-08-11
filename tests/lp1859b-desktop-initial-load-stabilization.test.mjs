import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const start = html.indexOf("      function ensureStartupLayoutOwnership()");
const end = html.indexOf("      function release()", start);
assert.notEqual(start, -1);
assert.notEqual(end, -1);
const ownershipSource = html.slice(start, end);

function runOwnership({ width, height, finePointer, coarsePointer, existingMode = "", bodyAvailable = true }) {
  const attributes = new Map(existingMode ? [["data-layout-mode", existingMode]] : []);
  const rootClasses = new Set();
  const body = {
    hasAttribute: (name) => attributes.has(name),
    getAttribute: (name) => attributes.get(name) || null,
    setAttribute: (name, value) => attributes.set(name, value)
  };
  const context = {
    document: {
      body: bodyAvailable ? body : null,
      documentElement: {
        clientWidth: width,
        clientHeight: height,
        classList: { toggle: (name, force) => force ? rootClasses.add(name) : rootClasses.delete(name) }
      }
    },
    window: {
      innerWidth: width,
      innerHeight: height,
      matchMedia: (query) => ({ matches: query === "(pointer: fine)" ? finePointer : coarsePointer })
    }
  };
  vm.createContext(context);
  vm.runInContext(`${ownershipSource}\nthis.ensure = ensureStartupLayoutOwnership;`, context);
  context.ensure();
  return { attributes, rootClasses };
}

test("watchdog establishes 832x571 desktop ownership before visible release", () => {
  const { attributes: attrs, rootClasses } = runOwnership({ width: 832, height: 571, finePointer: true, coarsePointer: false });
  assert.equal(attrs.get("data-layout-mode"), "desktop");
  assert.equal(attrs.get("data-layout-mode-legacy"), "desktop");
  assert.equal(rootClasses.has("gridly-desktop-startup-containment"), true);
  assert.ok(html.indexOf("ensureStartupLayoutOwnership();", html.indexOf("function release()")) < html.indexOf("classList.remove(\"gridly-prepaint-lock\")"));
});

test("inline containment, not delayed application CSS, owns the desktop watchdog frame", () => {
  assert.match(html, /html\.gridly-desktop-startup-containment body > :not\(\.gridly-desktop-gate\):not\(script\):not\(style\)[\s\S]*?display: none !important;/);
  assert.match(html, /html\.gridly-desktop-startup-containment \.gridly-desktop-gate\s*\{[\s\S]*?display: grid !important;/);
  assert.ok(html.indexOf("gridly-desktop-startup-containment body") < html.indexOf("function ensureStartupLayoutOwnership"));
  assert.ok(html.indexOf('classList.toggle("gridly-desktop-startup-containment"') < html.indexOf('classList.remove("gridly-prepaint-lock")'));
});

test("watchdog remains fail-closed when it fires before body parsing", () => {
  const { attributes, rootClasses } = runOwnership({ width: 832, height: 571, finePointer: true, coarsePointer: false, bodyAvailable: false });
  assert.equal(attributes.has("data-layout-mode"), false);
  assert.equal(rootClasses.has("gridly-desktop-startup-containment"), true);
  assert.match(html, /gridly-desktop-startup-containment body > :not\(\.gridly-desktop-gate\)/);
});

test("desktop application CSS retains settled gate ownership", () => {
  assert.match(css, /\.gridly-desktop-gate\s*\{\s*display:\s*none;/);
  assert.match(css, /body\[data-layout-mode="desktop"\] > :not\(\.gridly-desktop-gate\)[\s\S]*?display:\s*none !important;/);
  assert.match(css, /body\[data-layout-mode="desktop"\] \.gridly-desktop-gate\s*\{[\s\S]*?display:\s*grid;/);
  assert.match(css, /#gridlyPortraitV2\s*\{\s*display:none;/);
  assert.match(html, /<section id="gridlyPortraitV2"[^>]* hidden>/);
});

test("valid Mobile Portrait remains authorized by the fallback", () => {
  const { attributes: attrs, rootClasses } = runOwnership({ width: 430, height: 932, finePointer: false, coarsePointer: true });
  assert.equal(attrs.get("data-layout-mode"), "portrait");
  assert.equal(attrs.get("data-layout-mode-legacy"), "mobile");
  assert.equal(rootClasses.has("gridly-desktop-startup-containment"), false);
});

test("watchdog release remains independent of application initialization", () => {
  assert.match(html, /window\.setTimeout\(release, 1400\);/);
  assert.doesNotMatch(ownershipSource, /Supabase|geolocation|fetch|map|hydration/i);
  const { attributes: attrs } = runOwnership({ width: 1366, height: 768, finePointer: true, coarsePointer: false });
  assert.equal(attrs.get("data-layout-mode"), "desktop");
});

test("authoritative application ownership is not overwritten", () => {
  const { attributes: attrs, rootClasses } = runOwnership({ width: 832, height: 571, finePointer: true, coarsePointer: false, existingMode: "portrait" });
  assert.equal(attrs.get("data-layout-mode"), "portrait");
  assert.equal(rootClasses.has("gridly-desktop-startup-containment"), false);
});

test("authoritative applyLayoutMode retires only the temporary containment class", () => {
  assert.match(fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8"), /syncTacticalMapSurfaceVisibility\(\);\s*document\.documentElement\?\.classList\.remove\("gridly-desktop-startup-containment"\);/);
});
