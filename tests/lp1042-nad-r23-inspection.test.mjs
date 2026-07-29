import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { archiveInventory } from '../tools/lp104/inspect-nad-r23.mjs';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function fixtureZip(files) {
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
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralData.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralData, end]);
}

test('inventory is complete and leaves the master archive unchanged', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lp1042-'));
  const archive = path.join(directory, 'nad-r23.zip');
  const original = fixtureZip([
    ['NAD_R23/readme.txt', 'documentation'],
    ['NAD_R23/NAD.gdb/a00000001.gdbtable', 'table'],
  ]);
  await writeFile(archive, original);
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

test('invalid input is rejected as a non-ZIP archive', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lp1042-invalid-'));
  const archive = path.join(directory, 'not-a.zip');
  await writeFile(archive, 'not a zip');
  await assert.rejects(archiveInventory(archive), /Not a ZIP archive/);
});
