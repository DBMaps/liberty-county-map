import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const finalAuthority = css.slice(css.indexOf("/* LP243.H10B FINAL SHORT-LANDSCAPE AUTHORITY"));

test("superseded milestone geometry defers to the one H10B authority", () => {
  assert.equal((css.match(/LP243\.H10B FINAL SHORT-LANDSCAPE AUTHORITY/g) || []).length, 1);
  assert.match(finalAuthority, /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.doesNotMatch(finalAuthority, /126px|128px|min\(720px|transform:\s*scale\(/);
});

test("final invariants preserve mounted owners, accessibility, and presentation-local state", () => {
  assert.match(finalAuthority, /grid-template-rows:[^;]*minmax\(0, 1fr\)/);
  assert.match(finalAuthority, /gridly-landscape-command-handle[\s\S]*?pointer-events: auto/);
  assert.match(finalAuthority, /gridly-v2-bottom-region[\s\S]*?position: fixed/);
  assert.match(finalAuthority, /gridly-brief-interaction-panel\[data-gridly-brief-expanded="true"\][\s\S]*?width: 100vw[\s\S]*?height: 100dvh/);
  assert.match(app, /gridlyLandscapeCommandDisclosureAudit/);
  assert.doesNotMatch(app.slice(app.indexOf("// LP243.H8 is presentation-local"), app.indexOf("const MOBILE_REPORT_ENTRY_SELECTORS")), /localStorage|sessionStorage|fetch\(|Supabase|setView\(/);
});
