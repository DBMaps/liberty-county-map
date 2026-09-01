#!/usr/bin/env node
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const sources = Object.freeze({
  icon: 'assets/store/icons/gridly-icon-master-1024.png',
  splash: 'assets/store/branding/Splash/gridly-splash-portrait.png'
});
export const outputs = Object.freeze({
  icon: [
    'android/app/src/main/res/mipmap-anydpi/ic_launcher.png',
    'android/app/src/main/res/mipmap-anydpi/ic_launcher_logo.png',
    'android/app/src/main/res/mipmap-anydpi/ic_launcher_round.png',
    'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'
  ],
  splash: [
    'android/app/src/main/res/drawable/splash.png',
    'ios/App/App/Assets.xcassets/Splash.imageset/splash.png'
  ]
});

export async function generateNativeAssets(outputRoot = repository) {
  for (const [family, paths] of Object.entries(outputs)) {
    const source = resolve(repository, sources[family]);
    await readFile(source);
    for (const path of paths) {
      const destination = resolve(outputRoot, path);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }
  }
}

const outputFlag = process.argv.indexOf('--output-root');
const outputRoot = outputFlag === -1 ? repository : resolve(process.argv[outputFlag + 1]);
await generateNativeAssets(outputRoot);
console.log(`Generated ${Object.values(outputs).flat().length} native raster assets from approved tracked Gridly artwork.`);
