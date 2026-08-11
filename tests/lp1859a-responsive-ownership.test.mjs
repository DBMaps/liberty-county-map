import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const extract = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.notEqual(from, -1, `${start} exists`);
  assert.notEqual(to, -1, `${end} exists after ${start}`);
  return source.slice(from, to);
};

const resolverSource = extract("function resolveLayoutMode(", "\nfunction evaluateLayoutMode()");
const lifecycleSource = extract("function deactivateGridlyPortraitV2Owner()", "\nfunction applyLayoutMode(");
const sheetOpenSource = extract("  function openGridlyPortraitV2Sheet(", "\n  function openPortraitV2Sheet(");

const resolve = (signals, active = "portrait") => {
  const context = { activeLayoutMode: active };
  vm.createContext(context);
  vm.runInContext(`${resolverSource}\nthis.resolve = resolveLayoutMode;`, context);
  return context.resolve(signals).nextMode;
};

const signals = (viewportWidth, viewportHeight, overrides = {}) => ({
  viewportWidth,
  viewportHeight,
  shellWidth: viewportWidth,
  commandWidth: viewportWidth,
  hasHorizontalOverflow: false,
  coarsePointer: false,
  finePointer: true,
  orientationLandscape: viewportWidth > viewportHeight,
  ...overrides
});

test("fine-pointer desktop landscape owns every reproduced window size", () => {
  for (const [width, height] of [[832, 571], [900, 650], [980, 700], [1100, 700]]) {
    assert.equal(resolve(signals(width, height)), "desktop", `${width}x${height}`);
  }
});

test("accepted Mobile Portrait widths remain portrait", () => {
  for (const [width, height] of [[390, 844], [430, 932]]) {
    assert.equal(resolve(signals(width, height, { finePointer: false, coarsePointer: true })), "portrait", `${width}x${height}`);
  }
});

test("existing tactical short-landscape rule retains priority", () => {
  assert.equal(resolve(signals(900, 500, { finePointer: false, coarsePointer: true })), "tactical-landscape");
  assert.equal(resolve(signals(900, 500)), "tactical-landscape", "fine pointer does not change the established short-height band");
});

test("1100 desktop ownership is independent of resize history", () => {
  const final = signals(1100, 700);
  assert.equal(resolve(final, resolve(signals(1400, 700), "portrait")), "desktop");
  assert.equal(resolve(final, resolve(signals(900, 650), "portrait")), "desktop");
  assert.equal(resolve(final, "portrait"), "desktop");
});

function node() {
  const classes = new Set(["is-open", "active", "open", "visible"]);
  return {
    hidden: false,
    attributes: new Map(),
    style: {},
    classList: { remove: (...names) => names.forEach((name) => classes.delete(name)), contains: (name) => classes.has(name) },
    setAttribute(name, value) { this.attributes.set(name, value); if (name === "hidden") this.hidden = true; },
    removeAttribute(name) { this.attributes.delete(name); if (name === "hidden") this.hidden = false; }
  };
}

test("Portrait V2 mode exit restores hidden ownership and clears visible sheet state", () => {
  const elements = Object.fromEntries(["gridlyPortraitV2", "gridlyPortraitV2Sheet", "gridlyPortraitV2SheetBody", "gridlyPortraitV2SheetBackdrop"].map((id) => [id, node()]));
  elements.gridlyPortraitV2Sheet.attributes.set("data-active-sheet", "alerts");
  elements.gridlyPortraitV2Sheet.removeAttribute = function (name) { this.attributes.delete(name); };
  const body = node();
  const context = { document: { body, getElementById: (id) => elements[id] } };
  vm.createContext(context);
  vm.runInContext(`${lifecycleSource}\nthis.deactivate = deactivateGridlyPortraitV2Owner;`, context);
  context.deactivate();
  assert.equal(elements.gridlyPortraitV2.hidden, true);
  assert.equal(elements.gridlyPortraitV2Sheet.hidden, true);
  assert.equal(elements.gridlyPortraitV2Sheet.attributes.has("data-active-sheet"), false);
  assert.equal(elements.gridlyPortraitV2Sheet.classList.contains("is-open"), false);
  assert.equal(elements.gridlyPortraitV2SheetBackdrop.hidden, true);
});

test("sheet opening is authorization-gated before any V2 root unhide or product action", () => {
  const guard = sheetOpenSource.slice(0, sheetOpenSource.indexOf("gridlyLp017AuditRecordSheetOpen"));
  assert.match(guard, /getGridlyPortraitCleanupGateState\(getCanonicalGridlyPortraitLayoutMode\(\)\)/);
  assert.match(guard, /if \(!portraitAuthorization\.isStrictPortraitMobile\)/);
  assert.match(guard, /deactivateGridlyPortraitV2Owner\(\);\s*return false;/);
  assert.ok(sheetOpenSource.indexOf("isStrictPortraitMobile") < sheetOpenSource.indexOf('shell?.removeAttribute("hidden")'));
});

test("valid Mobile Portrait authorization can unhide the V2 owner again", () => {
  assert.match(source, /if \(activeLayoutMode === "portrait"[\s\S]{0,180}activateGridlyPortraitV2StartupOwner\("applyLayoutMode"\)/);
  assert.match(source, /if \(!cleanupGate\.portraitCleanupGateActive\)[\s\S]{0,600}shell\.removeAttribute\("hidden"\)/);
});
