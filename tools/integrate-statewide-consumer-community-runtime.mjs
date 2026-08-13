#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { countyRegistryRange } from '../scripts/lp189-statewide-runtime-activation-guarded.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appPath = path.join(root, 'js/app.js');
const projectionPath = path.join(root, 'data/generated/gridly-statewide-consumer-community-projection-v1.json');
const geometryPath = path.join(root, 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json');

function entryRanges(source, range) {
  const ranges = [];
  const pattern = /^  "([^"]+-tx)": Object\.freeze\(\{/gm;
  pattern.lastIndex = range.open + 1;
  for (let match; (match = pattern.exec(source)) && match.index < range.close;) {
    let depth = 1, quote = null, escaped = false;
    const open = match.index + match[0].length - 1;
    for (let index = open + 1; index < range.close; index += 1) {
      const char = source[index];
      if (quote) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = null; continue; }
      if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
      if (char === '{') depth += 1;
      if (char === '}' && --depth === 0) { ranges.push({ id: match[1], start: match.index, open, close: index }); pattern.lastIndex = index + 1; break; }
    }
  }
  return ranges;
}

export function integrateRuntime(source, projection, geometry) {
  if (projection?.schemaVersion !== 'gridly.statewide-consumer-community-projection.v1' || projection.counties?.length !== 254) throw new Error('governed projection must contain 254 counties');
  const registryRange = countyRegistryRange(source);
  const context = {};
  vm.runInNewContext(`${source.slice(0, registryRange.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, context);
  const existing = context.registry;
  const fipsById = new Map(geometry.counties.map(county => [county.countyId, county.fips]));
  const countyByFips = new Map(projection.counties.map(county => [county.countyFips, county]));
  const edits = entryRanges(source, registryRange).map(entry => {
    const fips = existing[entry.id]?.countyFips || fipsById.get(entry.id);
    const governed = countyByFips.get(fips);
    if (!governed) throw new Error(`missing governed county projection for ${entry.id}`);
    const priorFocus = new Map((existing[entry.id]?.consumerAwarenessAreas || []).filter(item => item.focus).map(item => [item.placeGeoid, item.focus]));
    const communities = governed.communities.map(item => ({
      placeGeoid: item.placeGeoid,
      displayName: item.displayName,
      governedType: item.governedType,
      consumerEligible: true,
      countyMemberships: item.countyMemberships,
      canonicalIdentity: 'PLACE_GEOID',
      ...(priorFocus.has(item.placeGeoid) ? { focus: priorFocus.get(item.placeGeoid) } : {})
    }));
    let body = source.slice(entry.open + 1, entry.close);
    body = body.replace(/^    defaultAwarenessAreas:.*\n/m, '');
    body = body.replace(/^    consumerAwarenessAreas:.*\n/m, '');
    const comma = body.trimEnd().endsWith(',') ? '' : ',';
    body = `${body.trimEnd()}${comma}\n    defaultAwarenessAreas: Object.freeze(${JSON.stringify([`${governed.displayName} County`, ...communities.map(item => item.displayName)])}),\n    consumerAwarenessAreas: Object.freeze(${JSON.stringify(communities)})\n  `;
    return { start: entry.open + 1, end: entry.close, body };
  });
  if (edits.length !== 254) throw new Error(`runtime registry must contain 254 counties, found ${edits.length}`);
  let output = source;
  for (const edit of edits.reverse()) output = output.slice(0, edit.start) + edit.body + output.slice(edit.end);
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const verify = process.argv.includes('--verify');
  const projection = JSON.parse(fs.readFileSync(projectionPath, 'utf8'));
  const geometry = JSON.parse(fs.readFileSync(geometryPath, 'utf8'));
  const current = fs.readFileSync(appPath, 'utf8');
  const output = integrateRuntime(current, projection, geometry);
  if (verify) {
    if (output !== current) throw new Error('statewide consumer community runtime projection is stale');
    process.stdout.write('Statewide consumer community runtime projection PASS\n');
  } else {
    fs.writeFileSync(appPath, output);
    process.stdout.write(`Projected ${projection.counts.membershipCount} governed memberships into runtime\n`);
  }
}
