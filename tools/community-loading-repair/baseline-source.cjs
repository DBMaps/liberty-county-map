// Test-only source substitution. Never edits the checkout or loads into Gridly.
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { execFileSync } = require('node:child_process');
const target = path.resolve('js/app.js').toLowerCase();
const original = fs.readFileSync;
const bytes = execFileSync('git', ['show', '9c28c0020aa6ae57882328cf88f6bef40c80359e:js/app.js'], { maxBuffer: 16 * 1024 * 1024 });
const matches = file => {
  try { return path.resolve(file instanceof URL ? fileURLToPath(file) : String(file)).toLowerCase() === target; }
  catch { return false; }
};
const value = options => {
  const encoding = typeof options === 'string' ? options : options?.encoding;
  return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
};
fs.readFileSync = function (file, options) { return matches(file) ? value(options) : original.apply(this, arguments); };
const asyncOriginal = fs.promises.readFile;
fs.promises.readFile = async function (file, options) { return matches(file) ? value(options) : asyncOriginal.apply(this, arguments); };
require('node:module').syncBuiltinESMExports();
