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

test("active portrait ownership does not suppress the destination command", () => {
  const portraitDisplayNoneRules = Array.from(css.matchAll(/([^{}]+)\{[^{}]*display:\s*none\s*!?important?\s*;?[^{}]*\}/g), (match) => match[1]);
  assert.equal(
    portraitDisplayNoneRules.some((selectors) => selectors.includes('body[data-layout-mode="portrait"] .mobile-destination-command,')),
    false,
    "the active portrait suppression group must not force the destination command to display:none"
  );
  assert.doesNotMatch(css, /body\[data-layout-mode="portrait"\] #mapSection > \.map-card > :not\(\.map-frame\)\s*,/);
  assert.match(css, /body\[data-layout-mode="portrait"\] #mapSection > \.map-card > :not\(\.map-frame\):not\(\.mobile-destination-command\)\s*,/);
  assert.match(css, /body\[data-layout-mode="portrait"\] \.mobile-destination-command\s*\{[^}]*display:\s*grid/);
  assert.match(app, /"#mapSection > \.map-card > :not\(\.map-frame\):not\(\.mobile-destination-command\)"/);
  assert.doesNotMatch(app, /"#mapSection > \.map-card > :not\(\.map-frame\)"/);
  assert.doesNotMatch(app, /mobile-destination-command[\s\S]{0,160}setAttribute\("inert", ""\)/);
});

test("destination command retains the existing Destination Search shell binding", () => {
  assert.match(app, /mobileDestinationCommandBtn\.addEventListener\("click"[\s\S]*?openGridlyDestinationSearchSurface\(\{ source: "destinationCommandButton" \}\)/);
  assert.match(app, /function showGridlySearchShell\(/);
  assert.match(html, /id="gridlySearchShell"[\s\S]*?data-search-ui="dormant"/);
});
