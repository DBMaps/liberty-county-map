import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../assets/walkthrough/walkthrough-assets.json", import.meta.url), "utf8"));
const featureMarkup = app.slice(app.indexOf('data-gridly-approved-slide="kbyg"'), app.indexOf('data-gridly-onboarding-page="setup"'));
const portraitMarker = "/* LP244.5 owner-approved walkthrough portrait contract. */";
const portraitCss = css.slice(css.indexOf(portraitMarker), css.indexOf("/* LP244.5 Task B", css.indexOf(portraitMarker)));
const landscapeCss = css.slice(css.indexOf("@media (orientation: landscape) and (max-height: 500px)", css.indexOf("/* LP244.5 Task B")), css.indexOf("/* End LP244.5 Task B landscape refinement. */"));

const expected = {
  kbyg: "assets/walkthrough/gridly-walkthrough-kbyg.png",
  nearby: "assets/walkthrough/gridly-walkthrough-nearby.png",
  alerts: "assets/walkthrough/gridly-walkthrough-alerts.png",
  report: "assets/walkthrough/gridly-walkthrough-report.png",
  settings: "assets/walkthrough/gridly-walkthrough-settings.png"
};

test("exactly five immutable approved assets map to the five feature slides", () => {
  assert.deepEqual(Object.fromEntries(manifest.slides.map(({ id, productionAsset }) => [id, productionAsset])), expected);
  assert.equal((featureMarkup.match(/<img /g) || []).length, 5);
  for (const [id, path] of Object.entries(expected)) {
    assert.match(featureMarkup, new RegExp(`data-gridly-approved-slide="${id}"[\\s\\S]*?src="${path.replaceAll("/", "\\/")}"`));
    const asset = readFileSync(new URL(`../${path}`, import.meta.url));
    const declaredHash = manifest.slides.find((slide) => slide.id === id).sha256;
    assert.equal(createHash("sha256").update(asset).digest("hex"), declaredHash);
  }
});

test("reference, Welcome, setup, and superseded assets cannot enter runtime feature mapping", () => {
  assert.equal(manifest.runtimeReferenceCompositeAllowed, false);
  assert.doesNotMatch(app, /<img[^>]+gridly-walkthrough-owner-approved-reference/);
  assert.doesNotMatch(featureMarkup, /assets\/onboarding\/(?:awareness|map|alerts|report|settings)-hero\.png/);
  const welcome = app.slice(app.indexOf('data-gridly-onboarding-page="welcome"'), app.indexOf('data-gridly-onboarding-page="awareness"'));
  const setup = app.slice(app.indexOf('data-gridly-onboarding-page="setup"'), app.indexOf("const pageTrack"));
  assert.doesNotMatch(welcome, /data-gridly-onboarding-image|assets\/walkthrough/);
  assert.doesNotMatch(setup, /<img|assets\/walkthrough/);
  assert.match(setup, /gridlyV858UseLocationBtn[\s\S]*gridlyV858ManualLocationForm/);
});

test("portrait is protected and preserves complete intrinsic artwork ratios", () => {
  assert.match(portraitCss, /object-fit:\s*contain/);
  assert.match(portraitCss, /object-position:\s*50% 50%/);
  assert.match(portraitCss, /transform:\s*none/);
  assert.doesNotMatch(portraitCss, /object-fit:\s*cover|overflow:\s*hidden/);
});

test("short landscape uses per-slide focal cropping with bounded artwork", () => {
  assert.match(landscapeCss, /\.gridly-v950-feature-page \.gridly-v896-shot-frame[\s\S]*overflow:\s*hidden/);
  assert.match(landscapeCss, /object-fit:\s*cover/);
  assert.doesNotMatch(landscapeCss, /\.gridly-v950-feature-page \.gridly-v896-shot-frame img\s*\{[^}]*object-fit:\s*contain/);
  for (const id of Object.keys(expected)) assert.match(landscapeCss, new RegExp(`data-gridly-approved-slide="${id}"`));
});

test("875x400 composition protects copy, progress, navigation, and live setup", () => {
  assert.match(landscapeCss, /gridly-v950-feature-page \.gridly-v950-page-copy[\s\S]*overflow:\s*visible/);
  assert.match(landscapeCss, /gridly-v950-feature-page \.gridly-v950-page-copy h3[\s\S]*line-height:\s*1\.08/);
  assert.match(landscapeCss, /gridly-v950-setup-page[\s\S]*overflow-y:\s*hidden/);
  assert.match(landscapeCss, /gridly-v950-setup-page \.gridly-v858-location-panel[\s\S]*overflow-y:\s*visible/);
  assert.match(app, /gridly-v950-page-indicators[\s\S]*gridly-v950-page-actions/);
  assert.match(app, />Skip<[\s\S]*>Back<[\s\S]*>Next<[\s\S]*>Finish</);
  assert.match(css, /grid-template-rows:\s*minmax\(0, 1fr\) auto auto auto/);
});

test("FM 1409 is an explicit immutable owner-reference contract", () => {
  assert.match(manifest.slides.find((slide) => slide.id === "nearby").landscapeFocus, /immutable FM 1409 label/);
});
