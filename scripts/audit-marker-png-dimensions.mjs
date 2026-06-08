#!/usr/bin/env node
import { open, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const markerDir = path.resolve(process.cwd(), "assets/markers/png");
const expectedSize = 256;
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function readPngDimensions(filePath) {
  const file = await open(filePath, "r");
  try {
    const header = Buffer.alloc(24);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    if (bytesRead < header.length || !header.subarray(0, 8).equals(pngSignature)) {
      throw new Error("Not a PNG file");
    }
    return {
      naturalWidth: header.readUInt32BE(16),
      naturalHeight: header.readUInt32BE(20)
    };
  } finally {
    await file.close();
  }
}

const entries = (await readdir(markerDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

const audit = [];
for (const filename of entries) {
  const dimensions = await readPngDimensions(path.join(markerDir, filename));
  audit.push({
    filename,
    ...dimensions,
    expectedSizePass: dimensions.naturalWidth === expectedSize && dimensions.naturalHeight === expectedSize
  });
}

const failures = audit.filter((row) => !row.expectedSizePass);
console.table(audit);
console.log(JSON.stringify({ expectedMasterSize: `${expectedSize}x${expectedSize}`, pass: failures.length === 0, failures }, null, 2));

if (failures.length > 0) {
  console.error(`Marker PNG dimension audit failed: ${failures.length} asset(s) are not ${expectedSize}x${expectedSize}.`);
  process.exitCode = 1;
}
