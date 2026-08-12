import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const packageLock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url)));

assert.equal(packageLock.lockfileVersion, 3, 'package-lock.json must use lockfileVersion 3');

const lockedRoot = packageLock.packages?.[''];
assert.ok(lockedRoot, 'package-lock.json must contain its root package record');
assert.deepEqual(lockedRoot.dependencies ?? {}, packageJson.dependencies ?? {}, 'runtime dependencies drifted');
assert.deepEqual(lockedRoot.devDependencies ?? {}, packageJson.devDependencies ?? {}, 'development dependencies drifted');
assert.deepEqual(lockedRoot.optionalDependencies ?? {}, packageJson.optionalDependencies ?? {}, 'optional dependencies drifted');

const missingOptionalPackages = [];
for (const [packagePath, metadata] of Object.entries(packageLock.packages)) {
  for (const dependencyName of Object.keys(metadata.optionalDependencies ?? {})) {
    const dependencyPath = `node_modules/${dependencyName}`;
    if (!packageLock.packages[dependencyPath]) {
      missingOptionalPackages.push(`${packagePath || '<root>'} -> ${dependencyName}`);
    }
  }
}

assert.deepEqual(
  missingOptionalPackages,
  [],
  `package-lock.json omits optional dependency package records:\n${missingOptionalPackages.join('\n')}`,
);

console.log('package.json and package-lock.json contain a complete portable dependency tree');
