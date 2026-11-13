import { crc32, inflateSync } from 'node:zlib';

export const maxTileBytes = 512 * 1024;
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const adam7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4],
  [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

function predictor(filter, left, above, corner) {
  if (filter === 1) return left;
  if (filter === 2) return above;
  if (filter === 3) return (left + above) >>> 1;
  if (filter !== 4) return 0;
  const p = left + above - corner;
  const [a, b, c] = [Math.abs(p - left), Math.abs(p - above), Math.abs(p - corner)];
  return a <= b && a <= c ? left : b <= c ? above : corner;
}

function validScanlines(compressed, bits, type, interlace, paletteEntries) {
  const passes = (interlace ? adam7 : [[0, 0, 1, 1]]).map(([x, y, dx, dy]) => {
    const width = Math.ceil((512 - x) / dx);
    const height = Math.ceil((512 - y) / dy);
    return { width, height, stride: Math.ceil(width * bits * channels[type] / 8) };
  });
  const length = passes.reduce((size, { height, stride }) => size + height * (stride + 1), 0);
  const { buffer, engine } = inflateSync(compressed, { maxOutputLength: length, info: true });
  if (buffer.length !== length || engine.bytesWritten !== compressed.length) return false;
  let offset = 0;
  for (const { width, height, stride } of passes) {
    let previous = Buffer.alloc(type === 3 ? stride : 0);
    for (let y = 0; y < height; y++) {
      const filter = buffer[offset++];
      if (filter > 4) return false;
      if (type === 3) {
        const row = buffer.subarray(offset, offset + stride);
        for (let i = 0; i < stride; i++) {
          row[i] += predictor(filter, row[i - 1] ?? 0, previous[i], previous[i - 1] ?? 0);
        }
        for (let x = 0; x < width; x++) {
          const bit = x * bits;
          if (((row[bit >>> 3] >>> (8 - bits - bit % 8)) & ((1 << bits) - 1)) >= paletteEntries) return false;
        }
        previous = row;
      }
      offset += stride;
    }
  }
  return true;
}

function ancillarySize(name, body, remaining) {
  const separator = body.indexOf(0);
  if (separator < 1 || separator > 79) return -1;
  let compressed = true;
  let start = separator + 2;
  if (name === 'iTXt') {
    const flag = body[separator + 1];
    if ((flag !== 0 && flag !== 1) || body[separator + 2] !== 0) return -1;
    compressed = flag === 1;
    const languageEnd = body.indexOf(0, separator + 3);
    if (languageEnd === -1) return -1;
    const translatedEnd = body.indexOf(0, languageEnd + 1);
    if (translatedEnd === -1) return -1;
    start = translatedEnd + 1;
  } else if (body[separator + 1] !== 0) return -1;
  const payload = body.subarray(start);
  if (!compressed) return payload.length <= remaining ? payload.length : -1;
  if (remaining <= 0) return -1;
  try {
    const result = inflateSync(payload, { maxOutputLength: remaining, info: true });
    return result.engine.bytesWritten === payload.length ? result.buffer.length : -1;
  } catch {
    return -1;
  }
}

export function validTilePng(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 45 || bytes.length > maxTileBytes ||
      !bytes.subarray(0, 8).equals(signature)) return false;
  let bits, type, interlace, paletteEntries = 0, transparency = false, afterImage = false;
  let count = 0, metadataBytes = 0;
  const image = [];
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 8 + length;
    if (end + 4 > bytes.length || ++count > 4096) return false;
    const name = bytes.toString('latin1', offset + 4, offset + 8);
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(name) ||
        crc32(bytes.subarray(offset + 4, end)) !== bytes.readUInt32BE(end)) return false;
    const body = bytes.subarray(offset + 8, end);
    if (offset === 8) {
      if (name !== 'IHDR' || length !== 13 || body.readUInt32BE(0) !== 512 || body.readUInt32BE(4) !== 512 ||
          body[10] !== 0 || body[11] !== 0 || body[12] > 1 || !depths[body[9]]?.includes(body[8])) return false;
      [bits, type, interlace] = [body[8], body[9], body[12]];
    } else if (name === 'PLTE') {
      if (paletteEntries || transparency || image.length || type === 0 || type === 4 ||
          !length || length % 3 || length > 768 || (type === 3 && length / 3 > 2 ** bits)) return false;
      paletteEntries = length / 3;
    } else if (name === 'tRNS') {
      if (transparency || image.length || !length ||
          !(type === 0 && length === 2 || type === 2 && length === 6 || type === 3 && length <= paletteEntries)) return false;
      transparency = true;
    } else if (name === 'IDAT') {
      if (afterImage || (type === 3 && !paletteEntries) || image.length >= 1024) return false;
      image.push(body);
    } else if (name === 'IEND') {
      if (length || end + 4 !== bytes.length || !image.length) return false;
      try { return validScanlines(Buffer.concat(image), bits, type, interlace, paletteEntries); }
      catch { return false; }
    } else {
      // Reject unknown critical chunks and animated images. Other ancillary
      // chunks are checked structurally and passed through without decoding.
      if (name[0] === name[0].toUpperCase() || ['acTL', 'fcTL', 'fdAT'].includes(name)) return false;
      // Bound decompressed ancillary data before passing through the PNG.
      if (name === 'iCCP' || name === 'zTXt' || name === 'iTXt') {
        const size = ancillarySize(name, body, 1_048_576 - metadataBytes);
        if (size < 0) return false;
        metadataBytes += size;
      }
      if (image.length) afterImage = true;
    }
    offset = end + 4;
  }
  return false;
}
