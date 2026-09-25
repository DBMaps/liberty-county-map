// Deterministic source derivative only. Does not touch native generated trees.
// Uses the PNG codec already bundled with the pinned Playwright dependency.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { PNG } = require(resolve(require.resolve('playwright-core/package.json'), '..', 'lib/utilsBundle.js'));
export const masterPath = 'assets/store/icons/gridly-icon-master-1024.png';
export const iconPath = 'assets/store/icons/gridly-ios-appicon-1024.png';
export const background = Object.freeze([7, 24, 38]); // #071826, approved portrait splash background.
export function opaqueIOSIcon(root) {
  const source = PNG.sync.read(readFileSync(resolve(root, masterPath)));
  if (source.width !== 1024 || source.height !== 1024) throw new Error('Expected approved 1024px icon master.');
  const splash = PNG.sync.read(readFileSync(resolve(root, 'assets/store/branding/Splash/gridly-splash-portrait.png')));
  if (background.some((value, channel) => splash.data[channel] !== value) || splash.data[3] !== 255) throw new Error('Approved splash background changed; review icon background.');
  for (let offset = 0; offset < source.data.length; offset += 4) {
    const alpha = source.data[offset + 3];
    for (let channel = 0; channel < 3; channel++) {
      source.data[offset + channel] = Math.round((source.data[offset + channel] * alpha + background[channel] * (255 - alpha)) / 255);
    }
    source.data[offset + 3] = 255;
  }
  return PNG.sync.write(source, { colorType: 2 });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  const bytes = opaqueIOSIcon(root);
  if (process.argv.includes('--verify')) {
    if (!bytes.equals(readFileSync(resolve(root, iconPath)))) throw new Error('iOS icon derivative is stale.');
    console.log('Opaque iOS icon derivative verified.');
  } else if (process.argv.includes('--write')) {
    writeFileSync(resolve(root, iconPath), bytes);
    console.log(`Wrote ${iconPath}; native trees unchanged.`);
  } else throw new Error('Use --verify or --write.');
}
