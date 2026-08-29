import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../css/styles.css", import.meta.url), "utf8");
const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");

test("portrait restores the original destination command Search entry", () => {
  assert.equal((html.match(/id="mobileDestinationCommandBtn"/g) || []).length, 1);
  assert.match(html, /<article class="mobile-destination-command"[^>]*>[\s\S]*?mobile-destination-command-actions[\s\S]*?id="mobileDestinationCommandBtn"[\s\S]*?aria-controls="gridlySearchShell"/);
  assert.doesNotMatch(html, /gridly-v2-header-right[\s\S]*?id="mobileDestinationCommandBtn"/);
  assert.doesNotMatch(html, /mobile-destination-command[^>]*(?:hidden|is-command-card-suppressed)/);
  assert.match(css, /\.gridly-v2-header-right\s*\{[\s\S]*?display:\s*none/);
});

test("destination command retains the existing Destination Search shell binding", () => {
  assert.match(app, /mobileDestinationCommandBtn\.addEventListener\("click"[\s\S]*?openGridlyDestinationSearchSurface\(\{ source: "destinationCommandButton" \}\)/);
  assert.match(app, /function showGridlySearchShell\(/);
  assert.match(html, /id="gridlySearchShell"[\s\S]*?data-search-ui="dormant"/);
});
