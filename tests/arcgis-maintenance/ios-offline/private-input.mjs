import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { macMountRows, macPrivatePathVerified } from '../../../tools/arcgis-maintenance/mac-private-path.mjs';
import { readMaintenanceProviderInputs } from '../../../tools/arcgis-maintenance/staging.mjs';
import { candidateBytes, originalBytes } from '../fixtures.mjs';

const inputName = 'native-provider-config.json';
const command = (program, args) => execFileSync(program, args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000
});
const chown = (owner, path) => command('/usr/bin/sudo', ['-n', '/usr/sbin/chown', String(owner), path]);

async function testVolumeOwnership(root) {
    const mountpoint = join(root, 'volume');
    const image = join(root, 'fixture.dmg');
    await mkdir(mountpoint, { mode: 0o700 });
    command('/usr/bin/hdiutil', ['create', '-size', '32m', '-fs', 'HFS+', '-volname', 'GridlySynthetic', '-format', 'UDRW', image]);
    try {
        command('/usr/bin/hdiutil', ['attach', '-nobrowse', '-noautoopen', '-owners', 'off', '-mountpoint', mountpoint, image]);
        const mount = macMountRows(command('/sbin/mount', [])).find(row => row.mountpoint === mountpoint);
        assert.ok(mount?.options.includes('noowners') && mount.options.includes('local'));
        const privateRoot = join(mountpoint, 'private');
        await mkdir(privateRoot, { mode: 0o700 });
        const file = join(privateRoot, inputName);
        await writeFile(file, candidateBytes, { mode: 0o600 });
        assert.equal((await lstat(file)).dev, (await lstat(mountpoint)).dev);
        assert.equal(await macPrivatePathVerified(file, 'File', { authorizedRoot: privateRoot }), false);
    } finally {
        // A partial attach is still a mount. Detach only this owned mountpoint.
        if ((await lstat(mountpoint)).dev !== (await lstat(root)).dev) {
            command('/usr/bin/hdiutil', ['detach', mountpoint]);
        }
    }
}

async function checkPrivateInput(root) {
    const privateRoot = join(root, 'candidate');
    const file = join(privateRoot, inputName);
    const original = join(root, 'synthetic-original.json');
    const owner = process.getuid();
    await mkdir(privateRoot, { mode: 0o700 });
    await writeFile(file, candidateBytes, { mode: 0o600 });
    await writeFile(original, originalBytes, { mode: 0o600 });
    const verified = (path = file, kind = 'File') => macPrivatePathVerified(path, kind, { authorizedRoot: privateRoot });
    assert.equal(await verified(), true);
    assert.equal(await verified(privateRoot, 'Directory'), true);

    for (const [path, kind] of [[file, 'File'], [privateRoot, 'Directory']]) {
        try {
            chown(0, path);
            assert.equal((await lstat(path)).uid, 0);
            assert.equal(await verified(path, kind), false);
        } finally {
            chown(owner, path);
        }
    }

    await chmod(file, 0o644);
    assert.equal(await verified(), false);
    await chmod(file, 0o600);
    await chmod(privateRoot, 0o755);
    assert.equal(await verified(privateRoot, 'Directory'), false);
    assert.equal(await verified(), false);
    await chmod(privateRoot, 0o700);

    command('/bin/chmod', ['+a', 'everyone allow read', file]);
    try {
        assert.match(command('/bin/ls', ['-ldeO', file]), /group:everyone allow read/);
        assert.equal(await verified(), false);
    } finally {
        command('/bin/chmod', ['-a', 'everyone allow read', file]);
    }
    assert.equal(await verified(), true);

    const saved = join(privateRoot, 'saved');
    await rename(file, saved);
    await symlink(saved, file);
    assert.equal(await verified(), false);
    await rm(file);
    await rename(saved, file);
    const linkedRoot = join(root, 'linked');
    await symlink(privateRoot, linkedRoot);
    assert.equal(await macPrivatePathVerified(join(linkedRoot, inputName), 'File', { authorizedRoot: linkedRoot }), false);
    assert.equal(await verified(join(privateRoot, 'child') + '/../' + inputName), false);

    const repositoryMarker = join(privateRoot, '.git');
    await writeFile(repositoryMarker, 'SYNTHETIC_REPOSITORY');
    assert.equal(await verified(), false);
    await rm(repositoryMarker);
    assert.equal(await verified(), true);

    const readInputs = options => readMaintenanceProviderInputs({
        candidateFile: file, originalFile: original, verifyPrivateFile: verified, ...options
    });
    await readInputs();
    await assert.rejects(() => readInputs({ candidateFile: undefined }), /MAINTENANCE_EXPLICIT_PRIVATE_INPUTS_REQUIRED/);
    await assert.rejects(() => readInputs({ candidateFile: original }), /MAINTENANCE_CANDIDATE_EQUALS_ORIGINAL/);
    await writeFile(file, originalBytes);
    await assert.rejects(() => readInputs(), /MAINTENANCE_CANDIDATE_EQUALS_ORIGINAL/);
}

async function main() {
    assert.ok(process.platform === 'darwin' && process.getuid() !== 0);
    const home = await realpath(homedir());
    const root = await mkdtemp(join(home, '.gridly-arcgis-acl-fixture-'));
    try {
        await checkPrivateInput(root);
        await testVolumeOwnership(root);
    } finally {
        // Never walk a mounted filesystem on a failure path.
        const volume = await lstat(join(root, 'volume')).catch(error => {
            if (error.code !== 'ENOENT') throw error;
        });
        assert.ok(!volume || volume.dev === (await lstat(root)).dev);
        await rm(root, { recursive: true });
    }
    console.log('MAC_PRIVATE_INPUT_PASS');
}

main().catch(() => {
    console.log('MAC_PRIVATE_INPUT_BLOCKED');
    process.exitCode = 1;
});
