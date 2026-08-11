import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lightPath = "assets/gridly-logo-horizontal-lite-mode.png";
const darkPath = "assets/store/branding/Logos/gridly-logo-horizontal.png";
const lightAsset = readFileSync(new URL(`../${lightPath}`, import.meta.url));
const darkAsset = readFileSync(new URL(`../${darkPath}`, import.meta.url));

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "IHDR");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function ruleFor(selector) {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `missing CSS selector: ${selector}`);
  return css.slice(start, css.indexOf("}", start) + 1);
}

const portraitTag = html.match(/<img[^>]+data-gridly-theme-logo[^>]*>/)?.[0] || "";
const lightRule = ruleFor('#gridlyPortraitV2 .gridly-v2-brand img[data-gridly-logo-theme="light"]');
const switchContract = app.slice(
  app.indexOf('document.querySelectorAll("[data-gridly-theme-logo]")'),
  app.indexOf("try {", app.indexOf('document.querySelectorAll("[data-gridly-theme-logo]")')),
);

test("LP185.8 binds Portrait V2 to the exact Light and unchanged Dark sources", () => {
  assert.match(portraitTag, new RegExp(`data-gridly-light-logo="${lightPath.replaceAll("/", "\\/")}"`));
  assert.match(portraitTag, new RegExp(`data-gridly-dark-logo="${darkPath.replaceAll("/", "\\/")}"`));
  assert.equal((html.match(/data-gridly-theme-logo/g) || []).length, 1);
});

test("both protected horizontal assets are unchanged 2000 by 600 PNG artwork", () => {
  assert.deepEqual(pngDimensions(lightAsset), [2000, 600]);
  assert.deepEqual(pngDimensions(darkAsset), [2000, 600]);
  assert.equal(createHash("sha256").update(lightAsset).digest("hex"), "fa0a02d27ee1cab21add0828aaf916d971f831345eec0f4021a4a538e54fc56a");
  assert.equal(createHash("sha256").update(darkAsset).digest("hex"), "06ce945d6aec3a2877d52f0ad3f83b066a28ff80a86902f0718d8c1412a8e5ea");
});

test("Light wordmark is fully contained and left-centered without crop or image treatment", () => {
  assert.match(lightRule, /object-fit:\s*contain/);
  assert.match(lightRule, /object-position:\s*left center/);
  assert.doesNotMatch(lightRule, /object-fit:\s*cover|50%\s+13%|clip-path|filter|invert|transform|(?:color|background|mix-blend-mode)\s*:/i);
  assert.doesNotMatch(css, /existing vertical bitmap is clipped|object-position:\s*50%\s+13%/);
});

test("existing explicit and System theme selection contract remains intact", () => {
  assert.match(app, /effectiveTheme = normalized\.theme === "system" \? \(systemLight \? "light" : "dark"\) : normalized\.theme/);
  assert.match(switchContract, /effectiveTheme === "light" \? logo\.dataset\.gridlyLightLogo : logo\.dataset\.gridlyDarkLogo/);
  assert.match(switchContract, /logo\.setAttribute\("src", nextAsset\)/);
  assert.match(switchContract, /logo\.dataset\.gridlyLogoTheme = effectiveTheme/);
});

test("System live switching reuses the single established appearance listener", () => {
  assert.equal((app.match(/appearanceQuery\.addEventListener\?\.\("change"/g) || []).length, 1);
  assert.match(app, /current\.display\.theme === "system"\) applyGridlySettingsDisplayPreferences\(current\.display, "system_appearance_change"\)/);
  assert.match(app, /window\.__gridlyThemeLogoMediaBound = true/);
  assert.equal((app.match(/__gridlyThemeLogoMediaBound/g) || []).length, 2);
});

test("Portrait V2 remains sole visible portrait owner and desktop branding is untouched", () => {
  assert.match(css, /body\[data-layout-mode="portrait"\] \.mobile-live-brand,[\s\S]*?body\[data-layout-mode="portrait"\] \.mobile-live-command \{ display:none !important; \}/);
  assert.match(html, /<header class="app-header"[\s\S]*?assets\/store\/branding\/Logos\/gridly-logo-horizontal\.png/);
  assert.equal((html.match(/data-gridly-light-logo=/g) || []).length, 1);
});

test("LP185.8 changes no header geometry and leaves protected product surfaces outside its rule", () => {
  assert.doesNotMatch(lightRule, /(?:^|[;{]\s*)(?:width|height|max-height|padding|margin|gap|top|right|bottom|left|inset|display|position)\s*:/m);
  assert.doesNotMatch(lightRule, /awareness|brief|filter|map|dock|desktop|safe-area/);
  const lp1857 = css.slice(css.indexOf("/* LP185.7"));
  assert.match(lp1857, /LP185\.7 Phase 3/);
  assert.doesNotMatch(lightRule, /--gridly-|background|border|box-shadow/);
});

test("LP185.8 test command is registered", () => {
  assert.equal(packageJson.scripts["test:lp1858"], "node --test tests/lp1858-light-wordmark.test.mjs");
});
