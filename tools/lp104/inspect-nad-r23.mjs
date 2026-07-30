#!/usr/bin/env node

/** Read-only inventory helper for a locally supplied NAD R23 ZIP archive. */

import { createHash } from 'node:crypto';
import { constants as fsConstants, createReadStream } from 'node:fs';
import { access, mkdir, open, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { delimiter, dirname, extname, isAbsolute, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const CP437_HIGH = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

class Zip64StructureError extends Error {
  constructor(message, diagnostic) {
    super(message);
    this.diagnostic = diagnostic;
  }
}

function safeNumber(value, label) {
  if (value > MAX_SAFE_BIGINT) throw new Error(`${label} exceeds JavaScript's safe integer range`);
  return Number(value);
}

function decodeName(bytes, utf8) {
  if (utf8) return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return Array.from(bytes, byte => byte < 128 ? String.fromCharCode(byte) : CP437_HIGH[byte - 128]).join('');
}

async function readAt(handle, length, position, archiveSize) {
  const start = typeof position === 'bigint' ? position : BigInt(position);
  if (start < 0n || BigInt(length) > archiveSize - start) throw new Error('Unexpected end of ZIP archive');
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, safeNumber(start, 'ZIP read position'));
  if (bytesRead !== length) throw new Error('Unexpected end of ZIP archive');
  return buffer;
}

function zip64Values(extra, needs) {
  let cursor = 0;
  while (cursor + 4 <= extra.length) {
    const id = extra.readUInt16LE(cursor);
    const size = extra.readUInt16LE(cursor + 2);
    const body = extra.subarray(cursor + 4, cursor + 4 + size);
    if (cursor + 4 + size > extra.length) throw new Error('Invalid ZIP extra field');
    if (id === 0x0001) {
      let at = 0;
      const result = {};
      for (const key of ['extracted', 'compressed', 'offset', 'disk']) {
        if (!needs[key]) continue;
        const width = key === 'disk' ? 4 : 8;
        if (at + width > body.length) throw new Error('Incomplete ZIP64 extra field');
        result[key] = width === 8 ? body.readBigUInt64LE(at) : BigInt(body.readUInt32LE(at));
        at += width;
      }
      return result;
    }
    cursor += 4 + size;
  }
  throw new Error('ZIP64 metadata is missing');
}

export async function centralDirectoryLocation(handle, archiveSize) {
  const tailLength = Number(archiveSize < 65_557n ? archiveSize : 65_557n);
  const tailStart = archiveSize - BigInt(tailLength);
  const tail = await readAt(handle, tailLength, tailStart, archiveSize);
  let index = -1;
  for (let candidate = tail.length - 22; candidate >= 0; candidate -= 1) {
    if (tail.readUInt32LE(candidate) !== EOCD_SIGNATURE || candidate + 22 + tail.readUInt16LE(candidate + 20) !== tail.length) continue;
    const sentinel = tail.readUInt16LE(candidate + 8) === 0xffff || tail.readUInt16LE(candidate + 10) === 0xffff
      || tail.readUInt32LE(candidate + 12) === 0xffffffff || tail.readUInt32LE(candidate + 16) === 0xffffffff;
    const ordinaryEnd = BigInt(tail.readUInt32LE(candidate + 12)) + BigInt(tail.readUInt32LE(candidate + 16));
    const absoluteCandidate = tailStart + BigInt(candidate);
    if (sentinel || ordinaryEnd === absoluteCandidate) { index = candidate; break; }
  }
  if (index < 0) throw new Error('Not a ZIP archive: end-of-central-directory record not found');
  const disk = tail.readUInt16LE(index + 4);
  const centralDisk = tail.readUInt16LE(index + 6);
  const entries = tail.readUInt16LE(index + 10);
  const centralSize = tail.readUInt32LE(index + 12);
  const centralOffset = tail.readUInt32LE(index + 16);
  const zip64Required = entries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff || disk === 0xffff || centralDisk === 0xffff;
  if (!zip64Required) {
    if (disk !== 0 || centralDisk !== 0 || tail.readUInt16LE(index + 8) !== entries) throw new Error('Multi-disk ZIP archives are not supported');
    return { entries, size: BigInt(centralSize), offset: BigInt(centralOffset) };
  }
  const eocdPosition = tailStart + BigInt(index);
  const diagnostic = {
    archiveSizeBytes: archiveSize.toString(), eocdOffset: eocdPosition.toString(), zip64Required,
    zip64LocatorOffset: eocdPosition >= 20n ? (eocdPosition - 20n).toString() : null,
    locatorSignatureObserved: null, zip64EocdOffset: null, diskNumber: disk,
    zip64EocdStartDisk: null, totalDisks: null, failureStage: null,
  };
  const fail = (stage, message) => { diagnostic.failureStage = stage; throw new Zip64StructureError(message, diagnostic); };
  if (eocdPosition < 20n) fail('locator-bounds', 'ZIP64 locator is missing or truncated');
  const locator = await readAt(handle, 20, eocdPosition - 20n, archiveSize).catch(() => fail('locator-read', 'ZIP64 locator is missing or truncated'));
  diagnostic.locatorSignatureObserved = `0x${locator.readUInt32LE(0).toString(16).padStart(8, '0')}`;
  diagnostic.zip64EocdStartDisk = locator.readUInt32LE(4);
  diagnostic.zip64EocdOffset = locator.readBigUInt64LE(8).toString();
  diagnostic.totalDisks = locator.readUInt32LE(16);
  if (locator.readUInt32LE(0) !== ZIP64_LOCATOR_SIGNATURE) fail('locator-signature', 'Invalid ZIP64 locator signature');
  if (diagnostic.zip64EocdStartDisk !== 0 || diagnostic.totalDisks !== 1) fail('locator-disk-fields', 'Multi-disk ZIP archives are not supported');
  const recordOffset = locator.readBigUInt64LE(8);
  if (recordOffset > archiveSize - 56n) fail('zip64-eocd-bounds', 'ZIP64 end-of-central-directory record is outside the archive');
  const record = await readAt(handle, 56, recordOffset, archiveSize);
  if (record.readUInt32LE(0) !== ZIP64_EOCD_SIGNATURE) fail('zip64-eocd-signature', 'Invalid ZIP64 end-of-central-directory signature');
  const recordLength = record.readBigUInt64LE(4) + 12n;
  if (recordLength < 56n || recordOffset + recordLength > eocdPosition - 20n) fail('zip64-eocd-size', 'Invalid ZIP64 end-of-central-directory size');
  const recordDisk = record.readUInt32LE(16);
  const recordCentralDisk = record.readUInt32LE(20);
  diagnostic.diskNumber = recordDisk;
  if (recordDisk !== 0 || recordCentralDisk !== 0) fail('zip64-eocd-disk-fields', 'Multi-disk ZIP archives are not supported');
  const entriesOnDisk = record.readBigUInt64LE(24);
  const totalEntries = record.readBigUInt64LE(32);
  if (entriesOnDisk !== totalEntries) fail('zip64-eocd-entry-counts', 'Multi-disk ZIP archives are not supported');
  return {
    entries: safeNumber(totalEntries, 'ZIP member count'),
    size: record.readBigUInt64LE(40),
    offset: record.readBigUInt64LE(48),
  };
}

async function readMembers(handle, archiveSize) {
  const central = await centralDirectoryLocation(handle, archiveSize);
  if (central.offset > archiveSize || central.size > archiveSize - central.offset) throw new Error('Central directory extends beyond the archive');
  const data = await readAt(handle, safeNumber(central.size, 'central directory size'), central.offset, archiveSize);
  const members = [];
  let cursor = 0;
  for (let index = 0; index < central.entries; index += 1) {
    if (cursor + 46 > data.length || data.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) throw new Error('Invalid ZIP central-directory entry');
    const flags = data.readUInt16LE(cursor + 8);
    const nameLength = data.readUInt16LE(cursor + 28);
    const extraLength = data.readUInt16LE(cursor + 30);
    const commentLength = data.readUInt16LE(cursor + 32);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > data.length) throw new Error('Truncated ZIP central-directory entry');
    const path = decodeName(data.subarray(cursor + 46, cursor + 46 + nameLength), Boolean(flags & 0x0800));
    let compressed = BigInt(data.readUInt32LE(cursor + 20));
    let extracted = BigInt(data.readUInt32LE(cursor + 24));
    const localOffset = data.readUInt32LE(cursor + 42);
    const disk = data.readUInt16LE(cursor + 34);
    const needs = { extracted: extracted === 0xffffffffn, compressed: compressed === 0xffffffffn, offset: localOffset === 0xffffffff, disk: disk === 0xffff };
    if (Object.values(needs).some(Boolean)) {
      const values = zip64Values(data.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength), needs);
      if (needs.extracted) extracted = values.extracted;
      if (needs.compressed) compressed = values.compressed;
      if (needs.disk && values.disk !== 0n) throw new Error('Multi-disk ZIP archives are not supported');
    }
    members.push({
      path,
      directory: path.endsWith('/'),
      compressedBytes: safeNumber(compressed, `compressed size for ${path}`),
      extractedBytes: safeNumber(extracted, `extracted size for ${path}`),
      crc32: data.readUInt32LE(cursor + 16).toString(16).padStart(8, '0'),
    });
    cursor = end;
  }
  if (cursor !== data.length) throw new Error('Central-directory member count or size is inconsistent');
  return members;
}

async function sha256(path) {
  const digest = createHash('sha256');
  for await (const block of createReadStream(path, { highWaterMark: 8 * 1024 * 1024 })) digest.update(block);
  return digest.digest('hex');
}

export async function archiveInventory(archive) {
  const archivePath = resolve(archive);
  const before = await stat(archivePath, { bigint: true });
  if (!before.isFile()) throw new Error(`Archive not found: ${archive}`);
  const handle = await open(archivePath, 'r');
  let members;
  try { members = await readMembers(handle, before.size); } finally { await handle.close(); }
  const digest = await sha256(archivePath);
  const after = await stat(archivePath, { bigint: true });
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error('Master archive changed during inspection');
  const roots = new Set();
  const gdbs = new Set();
  const extensions = new Map();
  for (const member of members) {
    const parts = member.path.split('/').filter(Boolean);
    if (parts.length) roots.add(parts[0]);
    parts.forEach((part, index) => { if (part.toLowerCase().endsWith('.gdb')) gdbs.add(parts.slice(0, index + 1).join('/')); });
    if (!member.directory) {
      const extension = extname(member.path).toLowerCase() || '[none]';
      extensions.set(extension, (extensions.get(extension) || 0) + 1);
    }
  }
  return {
    archive: archivePath,
    archiveType: 'ZIP',
    compressedBytesOnDisk: safeNumber(before.size, 'archive size'),
    sha256: digest,
    memberCount: members.length,
    memberCompressedBytes: members.reduce((sum, item) => sum + item.compressedBytes, 0),
    estimatedExtractedBytes: members.reduce((sum, item) => sum + item.extractedBytes, 0),
    topLevelEntries: [...roots].sort(),
    geodatabases: [...gdbs].sort(),
    extensions: Object.fromEntries([...extensions].sort(([a], [b]) => a.localeCompare(b))),
    members,
  };
}

async function executableOnPath(name) {
  const suffixes = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];
  for (const folder of (process.env.PATH || '').split(delimiter)) {
    for (const suffix of suffixes) {
      const candidate = resolve(folder || '.', `${name}${suffix}`);
      try { await access(candidate, fsConstants.X_OK); return candidate; } catch { /* keep looking */ }
    }
  }
  return null;
}

export async function inspectSchemas(archive, geodatabases) {
  const ogrinfo = await executableOnPath('ogrinfo');
  if (!ogrinfo) throw new Error('--schema requires GDAL ogrinfo on PATH');
  const archivePath = resolve(archive).replaceAll('\\', '/');
  return geodatabases.map(geodatabase => {
    const datasource = `/vsizip/${archivePath}/${geodatabase}`;
    const run = spawnSync(ogrinfo, ['-ro', '-so', '-al', '-json', datasource], { encoding: 'utf8', windowsHide: true });
    if (run.error) throw run.error;
    if (run.status !== 0) throw new Error(`ogrinfo failed for ${geodatabase}: ${(run.stderr || '').trim()}`);
    return { geodatabase, datasource, ogrinfo: JSON.parse(run.stdout) };
  });
}

function usage() {
  return 'Usage: node tools/lp104/inspect-nad-r23.mjs <archive.zip> [--output <report.json>] [--schema]';
}

function parseArguments(argv) {
  let archive;
  let output;
  let schema = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--schema') schema = true;
    else if (argument === '--output') {
      output = argv[++index];
      if (!output) throw new Error('--output requires a path');
    } else if (argument.startsWith('--')) throw new Error(`Unknown option: ${argument}`);
    else if (archive) throw new Error(`Unexpected argument: ${argument}`);
    else archive = argument;
  }
  if (!archive) throw new Error('Archive path is required');
  return { archive, output, schema };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const archivePath = resolve(options.archive);
  if (options.output && resolve(options.output) === archivePath) throw new Error('Output must not overwrite the master archive');
  const report = await archiveInventory(archivePath);
  if (options.schema) report.schemas = await inspectSchemas(archivePath, report.geodatabases);
  const rendered = `${JSON.stringify(report, null, 2)}\n`;
  if (!options.output) process.stdout.write(rendered);
  else {
    const output = resolve(options.output);
    await mkdir(dirname(output), { recursive: true });
    const temporary = `${output}.tmp`;
    await writeFile(temporary, rendered, 'utf8');
    try { await rename(temporary, output); } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    if (error.diagnostic) process.stderr.write(`${JSON.stringify(error.diagnostic, null, 2)}\n`);
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
  });
}
