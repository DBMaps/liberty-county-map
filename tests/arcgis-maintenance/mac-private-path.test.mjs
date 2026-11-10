import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { macEffectiveVolume, macPrivatePathVerified } from '../../tools/arcgis-maintenance/mac-private-path.mjs';

const source = '/dev/disk3s5';
const mountpoint = '/System/Volumes/Data';
const df = 'Filesystem 512-blocks Used Available Capacity Mounted on\n' +
  source + ' 2000 1000 1000 50% ' + mountpoint + '\n';
const system = '/dev/disk3s1s1 on / (apfs, sealed, local, read-only)\n';
const data = source + ' on ' + mountpoint + ' (apfs, local, journaled)';

test('selects the exact writable APFS Data mount reported for the path', () => {
  assert.equal(macEffectiveVolume(df, system + data + '\n'), data);
  assert.equal(macEffectiveVolume(df, 'unrelated unrecognized mount row\n' + data), data);
  assert.equal(macEffectiveVolume(df, data + '\n' + data), null);
  assert.equal(macEffectiveVolume(df, system), null);
  assert.equal(macEffectiveVolume(df, source + ' on ' + mountpoint + ' (other) (apfs, local)'), null);
});

test('rejects remote, noowners, and read-only effective mounts', () => {
  for (const options of ['smbfs, local', 'apfs, journaled', 'apfs, local, noowners', 'apfs, local, read-only']) {
    assert.equal(macEffectiveVolume(df, system + source + ' on ' + mountpoint + ' (' + options + ')'), null);
  }
});

test('verifies synthetic private paths on the macOS runner volume', { skip: process.platform !== 'darwin' }, async () => {
  const parent = await realpath(process.env.RUNNER_TEMP || tmpdir());
  const root = await mkdtemp(join(parent, 'gridly-volume-regression-'));
  try {
    const provider = join(root, 'native-provider-config.json');
    await writeFile(provider, 'SYNTHETIC_ONLY', { mode: 0o600, flag: 'wx' });
    assert.equal(await macPrivatePathVerified(root, 'Directory', { authorizedRoot: root }), true);
    assert.equal(await macPrivatePathVerified(provider, 'File', { authorizedRoot: root }), true);
    assert.equal(await macPrivatePathVerified(provider, 'File', { authorizedRoot: parent }), false);
    const link = join(root, 'linked');
    await symlink(root, link);
    assert.equal(await macPrivatePathVerified(link, 'Directory', { authorizedRoot: link }), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
