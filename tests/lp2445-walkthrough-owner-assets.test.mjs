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
const gateMarker = "/* LP244.5 portrait-only walkthrough orientation gate.";
const gateCss = css.slice(css.indexOf(gateMarker), css.indexOf("/* LP244.5 Task B", css.indexOf(gateMarker)));
const landscapeCss = css.slice(css.indexOf("/* LP244.5 Task B"), css.indexOf("/* End LP244.5 Task B landscape refinement. */"));

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

test("mobile landscape uses a semantic portrait gate and desktop is excluded", () => {
  assert.match(app, /data-gridly-walkthrough-orientation-gate role="status" aria-live="polite"[\s\S]*Rotate your phone[\s\S]*designed for portrait viewing/);
  assert.match(app, /isNativeApp\(\)[\s\S]*\(hover: none\) and \(pointer: coarse\) and \(max-width: 1100px\)/);
  assert.match(app, /\(orientation: landscape\)/);
  assert.match(app, /!overlay\.hidden && isLandscape && isMobileWalkthroughDevice\(\)/);
  assert.doesNotMatch(gateCss, /@media \(orientation: landscape\)/);
});

test("gate makes the underlying walkthrough inert without recreating page or setup state", () => {
  assert.match(app, /onboardingPager\.inert = shouldGate/);
  assert.match(app, /onboardingPager\.setAttribute\("aria-hidden", shouldGate \? "true" : "false"\)/);
  assert.match(gateCss, /data-gridly-walkthrough-orientation-gated="true"[\s\S]*display: none !important[\s\S]*pointer-events: none !important/);
  assert.match(app, /let activePageIndex = 0;[\s\S]*syncWalkthroughOrientationGate[\s\S]*setActiveOnboardingPage/);
  assert.doesNotMatch(app.slice(app.indexOf("const syncWalkthroughOrientationGate"), app.indexOf("const orientationMedia")), /activePageIndex\s*=|\.value\s*=/);
  assert.match(app, /preGateFocus[\s\S]*orientationGate\.focus[\s\S]*preGateFocus\?\.isConnected/);
  assert.match(app, /gridly-v950-page-indicators[\s\S]*>Skip<[\s\S]*>Back<[\s\S]*>Next<[\s\S]*>Finish/);
});

test("superseded walkthrough landscape composition is retired without changing app landscape", () => {
  assert.match(landscapeCss, /Walkthrough landscape composition retired by the portrait-only gate/);
  assert.doesNotMatch(landscapeCss, /gridly-v950-(?:feature|welcome|setup)-page|walkthrough-landscape-focus|object-fit:\s*cover/);
  assert.match(landscapeCss, /#mapSection\.command-center[\s\S]*width: 100vw !important/);
  assert.match(landscapeCss, /gridly-h8-command-expanded[\s\S]*gridly-v2-control-rail/);
});

test("manifest declares portrait authority and supersedes landscape cropping", () => {
  assert.equal(manifest.orientationAuthority, "portrait");
  assert.equal(manifest.landscapeBehavior, "rotate_to_portrait_gate");
  assert.equal(manifest.landscapeFeatureCropping, "superseded_by_portrait_only_walkthrough_decision");
});

test("FM 1409 is an explicit immutable owner-reference contract", () => {
  assert.match(manifest.slides.find((slide) => slide.id === "nearby").landscapeFocus, /immutable FM 1409 label/);
});
