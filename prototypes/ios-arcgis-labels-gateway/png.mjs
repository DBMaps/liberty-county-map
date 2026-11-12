import { crc32, inflateSync } from 'node:zlib';

export const MAX_TILE_BYTES = 512 * 1024;
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const rowBytes = 512 * 4 + 1;

// The fixture format is non-interlaced, 8-bit RGBA. This deliberately narrow
// decoder checks the synthetic format, including bounded inflation and filters.
export function isMockTilePng(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 57 || bytes.length > MAX_TILE_BYTES ||
      !bytes.subarray(0, 8).equals(signature)) return false;
  const compressed = [];
  let offset = 8;
  for (let chunks = 0; chunks < 128 && offset + 12 <= bytes.length; chunks++) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return false;
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, end - 4);
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) return false;
    if (chunks === 0) {
      if (type !== 'IHDR' || length !== 13 || data.readUInt32BE(0) !== 512 ||
          data.readUInt32BE(4) !== 512 || !data.subarray(8).equals(Buffer.from([8, 6, 0, 0, 0]))) return false;
    } else if (type === 'IDAT') {
      compressed.push(data);
    } else if (type === 'IEND' && length === 0 && end === bytes.length && compressed.length) {
      try {
        const input = Buffer.concat(compressed);
        const { buffer, engine } = inflateSync(input, { maxOutputLength: rowBytes * 512, info: true });
        if (buffer.length !== rowBytes * 512 || engine.bytesWritten !== input.length) return false;
        for (let row = 0; row < 512; row++) if (buffer[row * rowBytes] > 4) return false;
        return true;
      } catch { return false; }
    } else {
      return false;
    }
    offset = end;
  }
  return false;
}
