// Capacitor 8.3.4 emits only the major iOS version when regenerating SPM.
// Restore the owner-approved minor floor after iOS sync; never stage assets.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function alignIOSDeploymentFloor(root) {
  const project = await readFile(resolve(root, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const floors = [...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g)].map(match => match[1]);
  if (floors.length !== 4 || floors.some(floor => floor !== '16.4')) throw new Error('Expected all four Gridly Xcode deployment targets to be 16.4.');
  const path = resolve(root, 'ios/App/CapApp-SPM/Package.swift');
  const source = await readFile(path, 'utf8');
  if ((source.match(/platforms:\s*\[\.iOS\((?:\.v16|"16\.4")\)\]/g) || []).length !== 1) throw new Error('Unexpected SPM platform declaration; review instead of overwriting.');
  const result = source.replace('platforms: [.iOS(.v16)]', 'platforms: [.iOS("16.4")]');
  if (result !== source) await writeFile(path, result);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    && process.env.CAPACITOR_PLATFORM_NAME === 'ios') {
  await alignIOSDeploymentFloor(resolve(import.meta.dirname, '..'));
  console.log('Gridly iOS deployment floor aligned to 16.4.');
}
