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

function safeNumber(value, label) {
  if (value > MAX_SAFE_BIGINT) throw new Error(`${label} exceeds JavaScript's safe integer range`);
  return Number(value);
}

function decodeName(bytes, utf8) {
  if (utf8) return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return Array.from(bytes, byte => byte < 128 ? String.fromCharCode(byte) : CP437_HIGH[byte - 128]).join('');
}

async function readAt(handle, length, position) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
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

async function centralDirectoryLocation(handle, archiveSize) {
  const tailLength = Math.min(archiveSize, 65_557);
  const tailStart = archiveSize - tailLength;
  const tail = await readAt(handle, tailLength, tailStart);
  let index = -1;
  for (let candidate = tail.length - 22; candidate >= 0; candidate -= 1) {
    if (tail.readUInt32LE(candidate) === EOCD_SIGNATURE && candidate + 22 + tail.readUInt16LE(candidate + 20) === tail.length) {
      index = candidate;
      break;
    }
  }
  if (index < 0) throw new Error('Not a ZIP archive: end-of-central-directory record not found');
  const disk = tail.readUInt16LE(index + 4);
  const centralDisk = tail.readUInt16LE(index + 6);
  if (disk !== 0 || centralDisk !== 0) throw new Error('Multi-disk ZIP archives are not supported');
  const entries = tail.readUInt16LE(index + 10);
  const centralSize = tail.readUInt32LE(index + 12);
  const centralOffset = tail.readUInt32LE(index + 16);
  if (entries !== 0xffff && centralSize !== 0xffffffff && centralOffset !== 0xffffffff) {
    return { entries, size: centralSize, offset: centralOffset };
  }
  const eocdPosition = tailStart + index;
  if (eocdPosition < 20) throw new Error('ZIP64 locator is missing');
  const locator = await readAt(handle, 20, eocdPosition - 20);
  if (locator.readUInt32LE(0) !== ZIP64_LOCATOR_SIGNATURE || locator.readUInt32LE(4) !== 0 || locator.readUInt32LE(16) !== 1) {
    throw new Error('Invalid or multi-disk ZIP64 locator');
  }
  const recordOffset = safeNumber(locator.readBigUInt64LE(8), 'ZIP64 record offset');
  const record = await readAt(handle, 56, recordOffset);
  if (record.readUInt32LE(0) !== ZIP64_EOCD_SIGNATURE || record.readUInt32LE(16) !== 0 || record.readUInt32LE(20) !== 0) {
    throw new Error('Invalid or multi-disk ZIP64 record');
  }
  return {
    entries: safeNumber(record.readBigUInt64LE(32), 'ZIP member count'),
    size: safeNumber(record.readBigUInt64LE(40), 'central directory size'),
    offset: safeNumber(record.readBigUInt64LE(48), 'central directory offset'),
  };
}

async function readMembers(handle, archiveSize) {
  const central = await centralDirectoryLocation(handle, archiveSize);
  if (central.offset + central.size > archiveSize) throw new Error('Central directory extends beyond the archive');
  const data = await readAt(handle, central.size, central.offset);
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
  const before = await stat(archivePath);
  if (!before.isFile()) throw new Error(`Archive not found: ${archive}`);
  const handle = await open(archivePath, 'r');
  let members;
  try { members = await readMembers(handle, before.size); } finally { await handle.close(); }
  const digest = await sha256(archivePath);
  const after = await stat(archivePath);
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
    compressedBytesOnDisk: before.size,
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
  main().catch(error => { process.stderr.write(`${error.message}\n${usage()}\n`); process.exitCode = 1; });
}
