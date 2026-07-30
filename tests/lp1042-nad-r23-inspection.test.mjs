import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, open, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { archiveInventory, centralDirectoryLocation } from '../tools/lp104/inspect-nad-r23.mjs';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function fixtureZip(files, {
  comment = Buffer.alloc(0), zip64 = false, legacyDisk = 0, legacyCentralDisk = 0,
  locatorStartDisk = 0, totalDisks = 1, recordDisk = 0, recordCentralDisk = 0,
} = {}) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [nameText, contentText] of files) {
    const name = Buffer.from(nameText);
    const content = Buffer.from(contentText);
    const crc = crc32(content);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x0800, 6);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(content.length, 18); header.writeUInt32LE(content.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, content);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(content.length, 20); entry.writeUInt32LE(content.length, 24); entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += header.length + name.length + content.length;
  }
  const centralData = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(legacyDisk, 4); end.writeUInt16LE(legacyCentralDisk, 6); end.writeUInt16LE(comment.length, 20);
  if (!zip64) {
    end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralData.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...local, centralData, end, comment]);
  }
  end.writeUInt16LE(0xffff, 8); end.writeUInt16LE(0xffff, 10);
  end.writeUInt32LE(0xffffffff, 12); end.writeUInt32LE(0xffffffff, 16);
  const recordOffset = offset + centralData.length;
  const record = Buffer.alloc(56);
  record.writeUInt32LE(0x06064b50, 0); record.writeBigUInt64LE(44n, 4); record.writeUInt16LE(45, 12); record.writeUInt16LE(45, 14);
  record.writeUInt32LE(recordDisk, 16); record.writeUInt32LE(recordCentralDisk, 20);
  record.writeBigUInt64LE(BigInt(files.length), 24); record.writeBigUInt64LE(BigInt(files.length), 32);
  record.writeBigUInt64LE(BigInt(centralData.length), 40); record.writeBigUInt64LE(BigInt(offset), 48);
  const locator = Buffer.alloc(20);
  locator.writeUInt32LE(0x07064b50, 0); locator.writeUInt32LE(locatorStartDisk, 4);
  locator.writeBigUInt64LE(BigInt(recordOffset), 8); locator.writeUInt32LE(totalDisks, 16);
  return Buffer.concat([...local, centralData, record, locator, end, comment]);
}

const sampleFiles = [
  ['NAD_R23/readme.txt', 'documentation'],
  ['NAD_R23/NAD.gdb/a00000001.gdbtable', 'table'],
];

async function temporaryArchive(prefix, contents) {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  const archive = path.join(directory, 'nad-r23.zip');
  await writeFile(archive, contents);
  return { directory, archive };
}

test('standard ZIP inventory is complete and leaves the master archive unchanged', async t => {
  const original = fixtureZip(sampleFiles);
  const { directory, archive } = await temporaryArchive('lp1042-', original);
  const before = await stat(archive);
  const report = await archiveInventory(archive);
  assert.equal(report.archiveType, 'ZIP');
  assert.equal(report.memberCount, 2);
  assert.equal(report.memberCompressedBytes, 18);
  assert.equal(report.estimatedExtractedBytes, 18);
  assert.equal(report.sha256, createHash('sha256').update(original).digest('hex'));
  assert.deepEqual(report.geodatabases, ['NAD_R23/NAD.gdb']);
  assert.deepEqual(report.topLevelEntries, ['NAD_R23']);
  assert.deepEqual(report.extensions, { '.gdbtable': 1, '.txt': 1 });
  assert.deepEqual(await readFile(archive), original);
  assert.equal((await stat(archive)).mtimeMs, before.mtimeMs);

  await t.test('CLI writes the same JSON report atomically', async () => {
    const output = path.join(directory, 'reports', 'inventory.json');
    execFileSync(process.execPath, ['tools/lp104/inspect-nad-r23.mjs', archive, '--output', output], { cwd: path.resolve(import.meta.dirname, '..') });
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), report);
    assert.deepEqual(await readFile(archive), original);
  });
  await t.test('CLI refuses to overwrite the archive', () => {
    assert.throws(() => execFileSync(process.execPath, ['tools/lp104/inspect-nad-r23.mjs', archive, '--output', archive], { cwd: path.resolve(import.meta.dirname, '..'), stdio: 'pipe' }));
  });
});

for (const totalDisks of [0, 1]) {
  test(`single-disk ZIP64 locator totalDisks ${totalDisks} inventories normally without changing the archive`, async () => {
    const original = fixtureZip(sampleFiles, { zip64: true, totalDisks });
    const { archive } = await temporaryArchive('lp1042-zip64-', original);
    const before = await stat(archive);
    const report = await archiveInventory(archive);
    assert.equal(report.memberCount, 2);
    assert.equal(report.compressedBytesOnDisk, original.length);
    assert.deepEqual(await readFile(archive), original);
    assert.equal((await stat(archive)).mtimeMs, before.mtimeMs);
  });
}

test('archive comments and false EOCD signatures before the real EOCD are handled', async () => {
  const falseRecord = Buffer.alloc(22);
  falseRecord.writeUInt32LE(0x06054b50, 0);
  const original = fixtureZip(sampleFiles, { comment: Buffer.concat([Buffer.from('comment:'), falseRecord]) });
  const { archive } = await temporaryArchive('lp1042-comment-', original);
  assert.equal((await archiveInventory(archive)).memberCount, 2);
});

test('ZIP64 offsets remain BigInt and support a sparse archive beyond 4 GiB', async () => {
  const { archive } = await temporaryArchive('lp1042-sparse-', Buffer.alloc(0));
  const recordOffset = 0x1_0000_1000n;
  const centralOffset = 0x1_0000_0000n;
  const record = Buffer.alloc(56);
  record.writeUInt32LE(0x06064b50, 0); record.writeBigUInt64LE(44n, 4);
  record.writeBigUInt64LE(0n, 24); record.writeBigUInt64LE(0n, 32);
  record.writeBigUInt64LE(0x1000n, 40); record.writeBigUInt64LE(centralOffset, 48);
  const locator = Buffer.alloc(20);
  locator.writeUInt32LE(0x07064b50, 0); locator.writeBigUInt64LE(recordOffset, 8); locator.writeUInt32LE(1, 16);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0xffff, 8); end.writeUInt16LE(0xffff, 10);
  end.writeUInt32LE(0xffffffff, 12); end.writeUInt32LE(0xffffffff, 16);
  const handle = await open(archive, 'w+');
  try {
    await handle.write(record, 0, record.length, Number(recordOffset));
    await handle.write(locator, 0, locator.length, Number(recordOffset + 56n));
    await handle.write(end, 0, end.length, Number(recordOffset + 76n));
    const size = recordOffset + 98n;
    const location = await centralDirectoryLocation(handle, size);
    assert.deepEqual(location, { entries: 0, size: 0x1000n, offset: centralOffset });
  } finally { await handle.close(); }
});

test('official-sized NAD ZIP64 structure is accepted without allocating the archive size', async () => {
  const { archive } = await temporaryArchive('lp1042-official-size-', Buffer.alloc(0));
  const archiveSize = 9_733_944_292n;
  const recordOffset = archiveSize - 98n;
  const centralSize = 4096n;
  const record = Buffer.alloc(56);
  record.writeUInt32LE(0x06064b50, 0); record.writeBigUInt64LE(44n, 4);
  record.writeBigUInt64LE(centralSize, 40); record.writeBigUInt64LE(recordOffset - centralSize, 48);
  const locator = Buffer.alloc(20);
  locator.writeUInt32LE(0x07064b50, 0); locator.writeBigUInt64LE(recordOffset, 8); locator.writeUInt32LE(0, 16);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0xffff, 8); end.writeUInt16LE(0xffff, 10);
  end.writeUInt32LE(0xffffffff, 12); end.writeUInt32LE(0xffffffff, 16);
  const handle = await open(archive, 'w+');
  try {
    await handle.write(record, 0, record.length, Number(recordOffset));
    await handle.write(locator, 0, locator.length, Number(recordOffset + 56n));
    await handle.write(end, 0, end.length, Number(recordOffset + 76n));
    assert.deepEqual(await centralDirectoryLocation(handle, archiveSize), {
      entries: 0, size: centralSize, offset: recordOffset - centralSize,
    });
  } finally { await handle.close(); }
});

for (const [name, options, stage] of [
  ['locator start disk', { locatorStartDisk: 1, totalDisks: 0 }, 'locator-disk-fields'],
  ['ZIP64 current disk', { recordDisk: 1, totalDisks: 0 }, 'zip64-eocd-disk-fields'],
  ['ZIP64 central-directory disk', { recordCentralDisk: 1, totalDisks: 0 }, 'zip64-eocd-disk-fields'],
  ['contradictory legacy current disk', { legacyDisk: 1, totalDisks: 0 }, 'legacy-disk-fields'],
  ['contradictory legacy central-directory disk', { legacyCentralDisk: 1, totalDisks: 0 }, 'legacy-disk-fields'],
]) {
  test(`totalDisks zero with ${name} is rejected`, async () => {
    const { archive } = await temporaryArchive('lp1042-disk-conflict-', fixtureZip(sampleFiles, { zip64: true, ...options }));
    await assert.rejects(archiveInventory(archive), error => error.diagnostic?.failureStage === stage);
  });
}

for (const [name, mutate, stage] of [
  ['true multi-disk locator', buffer => buffer.writeUInt32LE(2, buffer.length - 22 - 4), 'locator-disk-fields'],
  ['invalid ZIP64 EOCD signature', buffer => buffer.writeUInt32LE(0, buffer.length - 22 - 20 - 56), 'zip64-eocd-signature'],
  ['unequal ZIP64 entry counts', buffer => buffer.writeBigUInt64LE(1n, buffer.length - 98 + 24), 'zip64-eocd-entry-counts'],
  ['central directory not ending at ZIP64 EOCD', buffer => buffer.writeBigUInt64LE(1n, buffer.length - 98 + 40), 'central-directory-bounds'],
]) {
  test(`${name} is rejected with a redacted structural diagnostic`, async () => {
    const original = fixtureZip(sampleFiles, { zip64: true }); mutate(original);
    const { archive } = await temporaryArchive('lp1042-invalid64-', original);
    await assert.rejects(archiveInventory(archive), error => error.diagnostic?.failureStage === stage && !JSON.stringify(error.diagnostic).includes('NAD_R23'));
  });
}

test('a companion split-disk file is rejected as additional disk evidence', async () => {
  const original = fixtureZip(sampleFiles, { zip64: true, totalDisks: 0 });
  const { directory, archive } = await temporaryArchive('lp1042-split-evidence-', original);
  await writeFile(path.join(directory, 'nad-r23.z01'), Buffer.from('split disk evidence'));
  await assert.rejects(archiveInventory(archive), /Additional split ZIP disk files/);
  assert.deepEqual(await readFile(archive), original);
});

test('a truncated/missing locator is rejected with a diagnostic', () => {
  const original = fixtureZip(sampleFiles, { zip64: true });
  const withoutLocator = Buffer.concat([original.subarray(0, original.length - 42), original.subarray(original.length - 22)]);
  return temporaryArchive('lp1042-truncated-', withoutLocator).then(({ archive }) => {
    const run = spawnSync(process.execPath, ['tools/lp104/inspect-nad-r23.mjs', archive], { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /"failureStage": "locator-signature"/);
    assert.doesNotMatch(run.stderr, /NAD_R23/);
  });
});

test('invalid input is rejected as a non-ZIP archive', async () => {
  const { archive } = await temporaryArchive('lp1042-invalid-', Buffer.from('not a zip'));
  await assert.rejects(archiveInventory(archive), /Not a ZIP archive/);
});
