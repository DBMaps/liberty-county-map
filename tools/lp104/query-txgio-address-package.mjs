#!/usr/bin/env node

/** Read-only exact-address query for a generated TxGIO gzip JSONL package. */
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_PACKAGE = join(ROOT, 'data/generated/lp104/txgio-addresses/liberty-48291.addresses.jsonl.gz');

export function usage() {
  return `TxGIO address package exact-query certification (package is never modified)

Usage:
  node tools/lp104/query-txgio-address-package.mjs "FULL ADDRESS" [--package PATH]

Example:
  npm run query:lp1044:txgio:liberty -- "274 County Road 677, Dayton, TX 77535"`;
}

function clean(value) {
  return String(value ?? '').trim().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ');
}

export function canonicalRoad(value) {
  return clean(value)
    .toUpperCase()
    .replace(/\b(?:COUNTY\s+ROAD|COUNTY\s+RD|CO(?:UNTY)?\s+RD|CR)\s*(?=[0-9])/g, 'CR ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeQuery(query) {
  const input = String(query ?? '').trim();
  const parts = input.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length < 3) throw new Error('Enter a full address with road, postal community, and state/ZIP (for example: 274 County Road 677, Dayton, TX 77535).');
  if (!/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i.test(parts.at(-1))) throw new Error('The full address must end with a two-letter state and ZIP.');
  const streetMatch = parts[0].match(/^(\d+[A-Z]?)\s+(.+)$/i);
  if (!streetMatch) throw new Error('The full address must begin with an exact house number followed by a road.');
  const houseNumber = streetMatch[1].toUpperCase();
  const road = canonicalRoad(streetMatch[2]);
  if (!road) throw new Error('The full address must contain a canonical road.');
  const normalizedAddress = [`${houseNumber} ${road}`, ...parts.slice(1).map(clean)].join(', ');
  return { input, houseNumber, road, normalizedAddress };
}

export function parseArguments(argv) {
  let packagePath = DEFAULT_PACKAGE;
  const queryParts = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') return { help: true, packagePath };
    if (arg === '--package') {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error('--package requires a path');
      packagePath = resolve(argv[++index]);
    } else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else queryParts.push(arg);
  }
  if (!queryParts.length) throw new Error('A full address query is required.');
  return { packagePath, query: queryParts.join(' ') };
}

export async function findExactMatches(packagePath, query) {
  const normalized = normalizeQuery(query);
  await access(packagePath).catch(() => { throw new Error(`TxGIO package not found: ${packagePath}. Build the Liberty package first or pass --package.`); });
  const input = createReadStream(packagePath);
  const lines = createInterface({ input: input.pipe(createGunzip()), crlfDelay: Infinity });
  const matches = [];
  for await (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    if (String(record.h).toUpperCase() === normalized.houseNumber && canonicalRoad(record.r) === normalized.road) matches.push(record);
  }
  return { normalized, matches, outcome: matches.length ? 'exact_match' : 'truthful_no_result' };
}

export function formatResult({ normalized, matches, outcome = matches.length ? 'exact_match' : 'truthful_no_result' }) {
  const rows = [`Outcome: ${outcome}`, `Exact matches: ${matches.length}`, `Normalized query: ${normalized.normalizedAddress}`];
  for (const record of matches) rows.push(
    `Matched full address: ${record.a}`,
    `Postal community: ${record.p}`,
    `ZIP: ${record.z}`,
    `Longitude: ${record.x}`,
    `Latitude: ${record.y}`,
    `Deterministic record ID: ${record.i}`,
  );
  return `${rows.join('\n')}\n`;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) return process.stdout.write(`${usage()}\n`);
  const result = await findExactMatches(options.packagePath, options.query);
  process.stdout.write(formatResult(result));
  if (!result.matches.length) throw new Error(`No exact TxGIO match for ${result.normalized.normalizedAddress}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`TxGIO package query failed: ${error.message}\n`); process.exitCode = 1; });
}
