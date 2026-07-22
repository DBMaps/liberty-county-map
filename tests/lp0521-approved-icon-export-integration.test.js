const assert = require('assert');
const fs = require('fs');

const manifestText = fs.readFileSync('manifest.json', 'utf8');
const manifest = JSON.parse(manifestText);
const index = fs.readFileSync('index.html', 'utf8');

assert.strictEqual(manifest.name, 'Gridly', 'manifest name is Gridly');
assert.strictEqual(manifest.short_name, 'Gridly', 'manifest short_name is Gridly');
assert.strictEqual(manifest.description, 'Know Before You Go', 'manifest description is launch tagline');
assert(!manifestText.includes('Beta Complete'), 'Beta Complete is absent from manifest.json');
assert(!/preparing for launch/i.test(manifestText), 'preparing for launch is absent from manifest.json');

const expectedManifestIcons = [
  { src: './assets/icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: './assets/icon-512.png', sizes: '512x512', type: 'image/png' },
  { src: './assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
];
assert.deepStrictEqual(manifest.icons, expectedManifestIcons, 'manifest remains limited to 192/512 plus maskable contract');

[
  'assets/store/icons/gridly-icon-master-1024.png',
  'assets/icons/incoming/gridly-icon-master-167.png',
  'assets/icons/incoming/gridly-icon-master-152.png',
  'assets/icons/incoming/gridly-icon-master-128.png',
  'assets/icons/incoming/gridly-icon-master-96.png',
  'assets/icons/incoming/gridly-icon-master-72 .png',
  'assets/icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png'
].forEach((assetPath) => assert(fs.existsSync(assetPath), `${assetPath} exists`));

['167x167', '152x152', '128x128', '96x96', '72x72'].forEach((size) => {
  assert(index.includes(`sizes="${size}"`), `${size} icon link remains integrated`);
});
