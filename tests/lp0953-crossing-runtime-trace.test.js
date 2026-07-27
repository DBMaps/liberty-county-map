const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const docs = fs.readFileSync("docs/LP095.3-CROSSING-RUNTIME-TRACE.md", "utf8");

assert.match(app, /window\.gridlyLp0953CrossingTrace = function/);
assert.match(app, /window\.gridlyLp0953RuntimeTraceAudit = \(\) => Object\.freeze/);
for (const stage of ["Tap received", "Delegated handler", "Alert row identified", "Alert record lookup", "Alert type determined", "Crossing resolver executed", "Crossing record lookup", "Marker lookup", "Coordinates", "Map focus requested", "Map focus completed", "Popup request issued", "Popup suppression evaluated", "Popup open requested", "Popup opened", "Final result"]) assert.ok(app.includes(`"${stage}"`), `missing trace stage: ${stage}`);
assert.match(app, /document\.addEventListener\("click",[\s\S]*\}, true\)/);
const tapCapture = app.slice(app.indexOf("function gridlyLp0953InstallTapCapture"), app.indexOf("if (typeof window", app.indexOf("function gridlyLp0953InstallTapCapture")));
assert.doesNotMatch(tapCapture, /preventDefault|stopPropagation|dispatchEvent|\.click\(/);
assert.match(docs, /Protected systems confirmation/);
assert.match(docs, /Historical Intelligence remains inactive/);
console.log("LP095.3 passive crossing runtime trace contract checks passed.");
