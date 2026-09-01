import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

test("startup and runtime keep the real application as responsive authority", () => {
  assert.match(html, /var mode = existingMode \|\| "portrait"/);
  assert.match(app, /nextMode: "portrait"/);
  assert.match(app, /forcedPortrait: true/);
  assert.match(app, /forcedDesktop: false/);
  assert.doesNotMatch(html, /validatedMobile \? "portrait" : "desktop"/);
});

test("the retained promo is unreachable but not deleted", () => {
  assert.match(html, /id="gridlyDesktopGate" class="gridly-desktop-gate"/);
  assert.match(css, /\.gridly-desktop-gate \{\s*display: none;/);
  assert.match(app, /developmentGate\?\.setAttribute\("inert", ""\)/);
});

test("wide containment is additive and excludes protected phone portrait", () => {
  const marker = "/* LP243.H — additive non-portrait containment";
  const scoped = css.slice(css.indexOf(marker), css.indexOf("/* GRIDLY V272.2"));
  assert.match(scoped, /@media \(orientation: landscape\), \(min-width: 761px\)/);
  assert.match(scoped, /max-height: calc\(100dvh - 104px\)/);
  assert.match(scoped, /overflow-y: auto/);
  assert.doesNotMatch(scoped, /max-width:\s*760px\) and \(orientation:\s*portrait\)/);
});

test("resize remains layout-only and preserves application state authority", () => {
  assert.match(app, /addEventListener\("orientationchange", scheduleAuthoritativeLayoutModeSync/);
  assert.match(app, /addEventListener\("resize", scheduleAuthoritativeLayoutModeSync/);
  const resolver = app.slice(app.indexOf("function resolveLayoutMode"), app.indexOf("function evaluateLayoutMode"));
  assert.doesNotMatch(resolver, /localStorage|sessionStorage|selectedHome|activeArea|renderAlerts|searchState/);
});

test("LP243.H asset identities advance through H4", () => {
  assert.match(html, /css\/styles\.css\?v=243h10h-measured-landscape-closure/);
  assert.match(html, /js\/app\.js\?v=243h10h-measured-landscape-closure/);
});
