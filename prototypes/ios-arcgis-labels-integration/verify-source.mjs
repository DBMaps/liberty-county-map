import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

const read = (path, root = './') => readFileSync(new URL(root + path, import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = read('source-copies.sha256').toString('utf8').trimEnd().split(/\r?\n/);
assert.equal(manifest.length, 14);
let exact = 0;
const adapted = [];
for (const line of manifest) {
  const [sourceHash, copyHash, path] = line.split('  ');
  assert.match(path, /^(?:App|Sources|Tests|Web|LabelTileHarness\.xcodeproj)\/[a-zA-Z0-9._/-]+$|^Package\.swift$/);
  assert.ok(!path.split('/').includes('..'));
  assert.equal(hash(read(path, '../ios-arcgis-labels/')), sourceHash, path);
  assert.equal(hash(read(path)), copyHash, path);
  if (sourceHash === copyHash) exact++;
  else adapted.push(path);
}
assert.equal(exact, 11);
assert.deepEqual(adapted.sort(), ['App/LabelTileHarness.swift', 'LabelTileHarness.xcodeproj/project.pbxproj', 'Package.swift']);

const project = read('LabelTileHarness.xcodeproj/project.pbxproj').toString('utf8');
for (const [, path] of project.matchAll(/path = ([^;]+); sourceTree = "<group>"/g)) {
  assert.ok(statSync(new URL(path, import.meta.url)), path);
}
assert.equal((project.match(/PRODUCT_BUNDLE_IDENTIFIER = com\.gridlygo\.prototype\.labeltiles\.integration;/g) ?? []).length, 2);
assert.doesNotMatch(project, /CODE_SIGN_ENTITLEMENTS|DEVELOPMENT_TEAM|com\.gridlygo\.gridly|shellScript/);
const app = read('App/LabelTileHarness.swift').toString('utf8');
assert.match(app, /let transport = GatewayLabelTransport\(\)/);
assert.equal((app.match(/\.setURLSchemeHandler\(/g) ?? []).length, 1);
assert.match(app, /websiteDataStore = \.nonPersistent\(\)/);
assert.doesNotMatch(app, /addScriptMessageHandler|addUserScript/);
for (const file of ['App/GatewayLabelTransport.swift', 'Sources/TileCore/MockGateway.swift']) {
  assert.doesNotMatch(read(file).toString('utf8'), /URLSession|arcgis\.com|supabase|Keychain|SecItem|StoreKit|DeviceCheck/i, file);
}
console.log('Source verification PASS: 11 byte-identical copies, 3 pinned adaptations, isolated Xcode target and WebKit route.');
