// Test-only source substitution. Never edits the checkout or loads into Gridly.
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { execFileSync } = require('node:child_process');
const target = path.resolve('js/app.js').toLowerCase();
const original = fs.readFileSync;
const baselineRef = process.env.REPAIR_BASELINE_REF || 'faac47368da3137b50d53813b7f0299a2f4b1830';
const bytes = execFileSync('git', ['show', `${baselineRef}:js/app.js`], { maxBuffer: 16 * 1024 * 1024 });
const sources = new Map([[target, bytes]]);
for (const name of ['js/gridlyWeatherLiveConnector.js', 'js/gridlyWeatherAuthoritySourceIntegration.js', 'js/gridlyAlertsWeatherAuthorityHandoff.js']) {
  sources.set(path.resolve(name).toLowerCase(), execFileSync('git', ['show', `${baselineRef}:${name}`]));
}
const matches = file => {
  try { return sources.get(path.resolve(file instanceof URL ? fileURLToPath(file) : String(file)).toLowerCase()); }
  catch { return false; }
};
const value = (bytes, options) => {
  const encoding = typeof options === 'string' ? options : options?.encoding;
  return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
};
fs.readFileSync = function (file, options) { const source = matches(file); return source ? value(source, options) : original.apply(this, arguments); };
const asyncOriginal = fs.promises.readFile;
fs.promises.readFile = async function (file, options) { const source = matches(file); return source ? value(source, options) : asyncOriginal.apply(this, arguments); };
require('node:module').syncBuiltinESMExports();
