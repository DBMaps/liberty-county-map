import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const h8 = css.slice(css.indexOf("/* LP243.H8"));

test("H8 is short-landscape only; portrait and tall-wide controls cannot match", () => {
  assert.match(h8, /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.doesNotMatch(h8, /orientation:\s*portrait|transform:\s*scale\(/);
  const matches = (width, height) => width > height && height <= 500;
  for (const viewport of [[932, 430], [844, 390]]) assert.equal(matches(...viewport), true);
  for (const viewport of [[320, 700], [390, 844], [430, 932], [1440, 900]]) assert.equal(matches(...viewport), false);
});

test("one existing owner remains authoritative for every command", () => {
  assert.equal((html.match(/class="mobile-destination-command"/g) || []).length, 1);
  assert.equal((html.match(/id="mobileDestinationCommandBtn"/g) || []).length, 1);
  for (const action of ["report", "alerts", "history", "settings"])
    assert.equal((html.match(new RegExp(`data-v2-sheet="${action}"`, "g")) || []).length, 1);
  assert.equal((html.match(/class="gridly-v2-segments"/g) || []).length, 1);
  assert.equal((html.match(/class="gridly-v2-control-rail"/g) || []).length, 1);
  assert.equal((html.match(/id="gridlyBriefFoundationHandle"/g) || []).length, 1);
});

test("collapsed-by-default handle exposes complete accessible disclosure state", () => {
  assert.match(html, /id="gridlyLandscapeCommandHandle"[^>]*aria-expanded="false"[^>]*aria-controls="mobileDestinationCommandPanel gridlyLandscapeCommandPanel"[^>]*aria-label="Show Location Context and actions"/);
  assert.match(app, /let gridlyLandscapeCommandExpanded = false/);
  assert.match(app, /setAttribute\("inert", ""\)/);
  assert.match(app, /setAttribute\("aria-hidden", "true"\)/);
  assert.match(app, /"Hide Location Context and actions" : "Show Location Context and actions"/);
});

test("expanded composition reveals reused Location Context, Search, and action row", () => {
  assert.match(h8, /gridly-h8-command-expanded[\s\S]*?mobile-destination-command[\s\S]*?visibility: visible/);
  assert.match(h8, /gridly-h8-command-expanded[\s\S]*?gridly-v2-bottom-dock/);
  assert.match(app, /mobileDestinationCommandBtn\.addEventListener\("click"[\s\S]*?openGridlyDestinationSearchSurface/);
  assert.match(app, /gridlyShortLandscapeQuery\.addEventListener\?\.\("change"/);
});

test("map remains mounted and receives the collapsed majority", () => {
  assert.equal((html.match(/id="map"/g) || []).length, 1);
  assert.match(h8, /--lp243h8-top-reserve: 112px/);
  assert.match(h8, /--lp243h8-handle-height: 24px/);
  assert.doesNotMatch(app, /gridlyLandscapeCommand[\s\S]{0,300}(?:removeChild|appendChild|replaceChildren|setView)/);
});

test("existing foreground, close, H4 suppression, and protected authorities remain", () => {
  assert.match(css, /LP243\.H4 — current consumer-presentation ownership/);
  assert.match(css, /LP243\.H5 — bounded short-landscape composition authority/);
  assert.match(h8, /:has\(#gridlySearchShell:not\(\[hidden\]\)\)[\s\S]*?visibility: hidden/);
  assert.match(app, /sheet\.hidden = true;[\s\S]*?sheet\.removeAttribute\("data-active-sheet"\)/);
  assert.doesNotMatch(h8, /fetch\(|Supabase|Home Area|Awareness Area|applyGeoFilter|setView/);
  assert.doesNotMatch(app.slice(app.indexOf("// LP243.H8"), app.indexOf("const MOBILE_REPORT_ENTRY_SELECTORS")), /localStorage|sessionStorage|fetch\(|Supabase/);
});
