#!/usr/bin/env node

/** LP104.3: read-only, bounded NAD measurements through GDAL /vsizip/. */

import { constants as fsConstants } from 'node:fs';
import { access, mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const VERSION = 1;
const DEFAULT_GDB = 'NAD_r23.gdb';
const DEFAULT_LAYER = 'NAD';
const DISTRIBUTIONS = ['Placement', 'AddAuth', 'NAD_Source', 'DataSet_ID', 'AddrClass', 'Lifecycle', 'Addr_Type', 'DeliverTyp', 'Provenance'];
const COMPLETENESS = ['Address', 'Add_Number', 'AddNo_Full', 'Street', 'St_Name', 'StNam_Full', 'Post_City', 'Uninc_Comm', 'Zip_Code', 'Latitude', 'Longitude'];
const MAX_GDAL_OUTPUT_BYTES = 64 * 1024 * 1024;

function usage() {
  return `Usage: node tools/lp104/measure-nad-r23.mjs --archive <NAD_r23.zip> --reports <directory> [options]

Required:
  --archive <path>       Local NAD R23 ZIP (never extracted or modified)
  --reports <directory> Output directory for deterministic report files

Options:
  --gdal <path>          ogrinfo executable or GDAL bin directory
  --geodatabase <path>  ZIP member path (default: NAD_r23.gdb)
  --layer <name>         Feature layer (default: NAD)
  --state <value>        State selector (default: TX; display values are inventoried)
  --county <value>       Proof county selector (default: Liberty)
  --top <number>         Distribution values retained (default: 25)
  --generated-at <ISO>  Reproducible report timestamp (otherwise current UTC time)
  --debug                Print each ogrinfo executable and argument array
  --help                 Show this help

GDAL may also be set with GRIDLY_GDAL_OGRINFO or OGRINFO. The command uses only
ogrinfo -ro with /vsizip/ and SQLite SELECT statements; it never extracts data.`;
}

export function parseArguments(argv) {
  const options = { geodatabase: DEFAULT_GDB, layer: DEFAULT_LAYER, state: 'TX', county: 'Liberty', top: 25 };
  const valued = new Set(['--archive', '--reports', '--gdal', '--geodatabase', '--layer', '--state', '--county', '--top', '--generated-at']);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--debug') options.debug = true;
    else if (valued.has(arg)) {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      options[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  options.top = Number(options.top);
  if (!Number.isInteger(options.top) || options.top < 1 || options.top > 1000) throw new Error('--top must be an integer from 1 to 1000');
  if (!options.help && !options.archive) throw new Error('--archive is required');
  if (!options.help && !options.reports) throw new Error('--reports is required');
  if (options.generatedAt && Number.isNaN(Date.parse(options.generatedAt))) throw new Error('--generated-at must be an ISO date/time');
  return options;
}

async function onPath(name) {
  const suffixes = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];
  for (const folder of (process.env.PATH || '').split(delimiter)) for (const suffix of suffixes) {
    const candidate = resolve(folder || '.', `${name}${suffix}`);
    try { await access(candidate, fsConstants.X_OK); return candidate; } catch { /* continue */ }
  }
  return null;
}

export async function discoverOgrinfo(explicit) {
  const configured = explicit || process.env.GRIDLY_GDAL_OGRINFO || process.env.OGRINFO;
  if (configured) {
    let candidate = resolve(configured);
    try {
      if ((await stat(candidate)).isDirectory()) candidate = join(candidate, process.platform === 'win32' ? 'ogrinfo.exe' : 'ogrinfo');
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch { throw new Error(`GDAL ogrinfo is unavailable at: ${candidate}`); }
  }
  const found = await onPath('ogrinfo');
  if (!found) throw new Error('GDAL ogrinfo was not found. Use --gdal or GRIDLY_GDAL_OGRINFO.');
  return found;
}

function quoteIdentifier(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function literal(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function present(field) { const q = quoteIdentifier(field); return `${q} IS NOT NULL AND TRIM(CAST(${q} AS TEXT)) <> ''`; }
function normalized(field) { return `UPPER(TRIM(CAST(${quoteIdentifier(field)} AS TEXT)))`; }

function commandDiagnostic(executable, args) {
  return `executable: ${JSON.stringify(executable)}\narguments: ${JSON.stringify(args)}`;
}

export function runOgrinfo(executable, args, label, { debug = false, spawnImpl = spawn, maxOutputBytes = MAX_GDAL_OUTPUT_BYTES } = {}) {
  return new Promise((resolveRun, reject) => {
    const diagnostic = commandDiagnostic(executable, args);
    if (debug) process.stderr.write(`[LP104.3] ${label} command\n${diagnostic}\n`);
    let child;
    try {
      child = spawnImpl(executable, args, { shell: false, windowsHide: true, detached: false, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      reject(new Error(`${label} spawn error: ${error.message}\n${diagnostic}`));
      return;
    }
    let stdout = ''; let stderr = '';
    let outputBytes = 0; let settled = false;
    const fail = error => { if (!settled) { settled = true; reject(error); } };
    const collect = (stream, destination) => stream.on('data', chunk => {
      outputBytes += Buffer.byteLength(chunk, 'utf8');
      if (outputBytes > maxOutputBytes) {
        child.kill();
        fail(new Error(`${label} exceeded the ${maxOutputBytes}-byte output limit\n${diagnostic}`));
      } else destination(chunk);
    });
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    collect(child.stdout, chunk => { stdout += chunk; });
    collect(child.stderr, chunk => { stderr += chunk; });
    child.on('error', error => fail(new Error(`${label} spawn error: ${error.message}\n${diagnostic}`)));
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      if (code === 0) resolveRun(stdout);
      else reject(new Error(`${label} process failure\nexit code: ${code === null ? 'null' : code}\nsignal: ${signal || 'none'}\nstdout:\n${stdout || '(empty)'}\nstderr:\n${stderr || '(empty)'}\n${diagnostic}`));
    });
  });
}

function layerFromSchemaText(text, expectedLayer) {
  if (!/using driver [`']OpenFileGDB['`] successful/i.test(text)) throw new Error('Schema inspection did not confirm the OpenFileGDB driver');
  const layerMatch = text.match(/^Layer name:\s*(.+)$/mi);
  if (!layerMatch || layerMatch[1].trim().toLowerCase() !== expectedLayer.toLowerCase()) throw new Error(`Schema inspection returned no ${expectedLayer} layer`);
  const fields = [];
  for (const match of text.matchAll(/^([^\r\n:]+):\s+(?:Integer|Integer64|Real|String|Date|Time|DateTime|Binary)(?:\s|\(|$).*$/gmi)) fields.push({ name: match[1].trim() });
  const geometry = text.match(/^Geometry:\s*(.+)$/mi)?.[1].trim();
  return { fields, geometryType: geometry || null };
}

function layerFromJson(text, label) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error(`${label} returned invalid JSON`); }
  const layer = parsed.layers?.[0];
  if (!layer) throw new Error(`${label} returned no layer`);
  return layer;
}

function rowsFromLayer(layer) {
  return (layer.features || []).map(feature => feature.properties || feature.fields || {});
}

function findField(fields, wanted, required = false) {
  const match = fields.find(field => field.toLowerCase() === wanted.toLowerCase());
  if (!match && required) throw new Error(`Required NAD field is unavailable: ${wanted}`);
  return match;
}

async function atomic(path, content) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, content, 'utf8');
  try { await rename(temporary, path); } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
}

function csvCell(value) { const text = value == null ? '' : String(value); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }

export async function measure(options) {
  const archive = resolve(options.archive);
  const reports = resolve(options.reports);
  const before = await stat(archive).catch(() => { throw new Error(`Archive not found: ${archive}`); });
  if (!before.isFile()) throw new Error(`Archive not found: ${archive}`);
  if (reports === archive || reports.startsWith(`${archive}${process.platform === 'win32' ? '\\' : '/'}`)) throw new Error('Reports must not overwrite or be placed inside the archive path');
  const ogrinfo = await discoverOgrinfo(options.gdal);
  const zipPath = archive.replaceAll('\\', '/');
  const gdb = options.geodatabase.replaceAll('\\', '/').replace(/^\/+/, '');
  const datasource = `/vsizip/${zipPath}/${gdb}`;
  const baseArgs = ['-ro', '-if', 'OpenFileGDB', '-json', '-oo', 'LIST_ALL_TABLES=NO', datasource];
  const log = message => process.stderr.write(`[LP104.3] ${message}\n`);
  log('Inspecting the NAD schema through /vsizip/ (read-only)');
  const schemaArgs = [datasource, '-ro', '-so', options.layer];
  const schemaLayer = layerFromSchemaText(await runOgrinfo(ogrinfo, schemaArgs, 'Schema inspection', { debug: options.debug }), options.layer);
  const fieldNames = (schemaLayer.fields || []).map(field => typeof field === 'string' ? field : field.name);
  const state = findField(fieldNames, 'State', true);
  const county = findField(fieldNames, 'County', true);
  const available = name => findField(fieldNames, name);
  const sqlRows = async (sql, label) => {
    log(label);
    const layer = layerFromJson(await runOgrinfo(ogrinfo, [...baseArgs, '-dialect', 'SQLite', '-sql', sql], label, { debug: options.debug }), label);
    return rowsFromLayer(layer);
  };

  const stateRows = await sqlRows(`SELECT ${quoteIdentifier(state)} AS value, COUNT(*) AS count FROM ${quoteIdentifier(options.layer)} GROUP BY ${quoteIdentifier(state)} ORDER BY count DESC`, 'Inventorying national State values');
  const requested = String(options.state).trim().toUpperCase();
  const exactStateValues = stateRows.filter(row => {
    const value = String(row.value ?? '').trim().toUpperCase();
    return value === requested || (requested === 'TX' && value === 'TEXAS');
  }).map(row => row.value);
  if (!exactStateValues.length) throw new Error(`No records match state selector ${options.state}; inspect the reported State inventory`);
  const stateWhere = exactStateValues.map(value => `${normalized(state)}=${literal(String(value).trim().toUpperCase())}`).join(' OR ');
  const scopeTexas = `(${stateWhere})`;
  const countyRows = await sqlRows(`SELECT ${quoteIdentifier(county)} AS county, COUNT(*) AS count FROM ${quoteIdentifier(options.layer)} WHERE ${scopeTexas} GROUP BY ${quoteIdentifier(county)} ORDER BY county`, 'Counting Texas counties');
  const normalizedCountyGroups = new Map();
  for (const row of countyRows) {
    const key = String(row.county ?? '').trim().replace(/\s+county$/i, '').toUpperCase();
    if (!normalizedCountyGroups.has(key)) normalizedCountyGroups.set(key, []);
    normalizedCountyGroups.get(key).push(row.county);
  }
  const exactCountyValues = countyRows.filter(row => String(row.county ?? '').trim().replace(/\s+county$/i, '').toUpperCase() === String(options.county).trim().replace(/\s+county$/i, '').toUpperCase()).map(row => row.county);
  if (!exactCountyValues.length) throw new Error(`No Texas county matches ${options.county}`);
  const countyWhere = exactCountyValues.map(value => `${normalized(county)}=${literal(String(value).trim().toUpperCase())}`).join(' OR ');
  const scopes = { texas: scopeTexas, libertyCounty: `${scopeTexas} AND (${countyWhere})` };
  const report = {
    reportSchema: 'gridly.lp104.3.nad-measurement.v1', reportVersion: VERSION,
    generatedAt: new Date(options.generatedAt || Date.now()).toISOString(),
    sourceFacts: { archive: archive.replaceAll('\\', '/'), geodatabase: gdb, layer: options.layer, access: 'read-only /vsizip/ via OpenFileGDB-compatible GDAL', geometry: schemaLayer.geometryFields || schemaLayer.geometryType || null, fields: fieldNames },
    calculatedMeasurements: {
      statePartitioning: { selector: options.state, exactValues: exactStateValues, values: stateRows },
      counties: countyRows,
      countyAnalysis: {
        distinctNonblankSourceValues: countyRows.filter(row => String(row.county ?? '').trim()).length,
        missingCountyRecords: countyRows.filter(row => !String(row.county ?? '').trim()).reduce((sum, row) => sum + number(row.count), 0),
        normalizationCollisions: [...normalizedCountyGroups].filter(([, values]) => values.length > 1).map(([normalizedValue, sourceValues]) => ({ normalizedValue, sourceValues })),
        recognizedAgainstExternalTexasCountyList: null,
        recognitionNote: 'No external county list is used; nonblank source values and normalization collisions are reported without inventing recognition status.',
      },
    },
    methodology: { stateComparison: 'trimmed case-insensitive comparison; exact observed values retained', countyComparison: 'trimmed case-insensitive comparison with optional County suffix removed for selection', blankDefinition: 'NULL or empty after text conversion and trim', distributionTopLimit: options.top },
  };

  const identifiers = fieldNames.filter(name => /(?:fips|geoid|state.*(?:id|code)|county.*(?:id|code)|natstate|natcounty)/i.test(name));
  const completenessFields = COMPLETENESS.map(name => available(name)).filter(Boolean);
  const houseFields = ['Add_Number', 'AddNo_Full'].map(available).filter(Boolean);
  const streetFields = ['Street', 'St_Name', 'StNam_Full'].map(available).filter(Boolean);
  for (const [scopeName, where] of Object.entries(scopes)) {
    const metrics = ['COUNT(*) AS total'];
    for (const field of [...new Set([...completenessFields, ...identifiers])]) metrics.push(`SUM(CASE WHEN ${present(field)} THEN 1 ELSE 0 END) AS ${quoteIdentifier(`present__${field}`)}`);
    const house = houseFields.length ? `(${houseFields.map(present).join(' OR ')})` : '0';
    const street = streetFields.length ? `(${streetFields.map(present).join(' OR ')})` : '0';
    metrics.push(`SUM(CASE WHEN ${house} THEN 1 ELSE 0 END) AS house_number_present`);
    metrics.push(`SUM(CASE WHEN ${street} THEN 1 ELSE 0 END) AS street_present`);
    metrics.push(`SUM(CASE WHEN ${street} AND NOT ${house} THEN 1 ELSE 0 END) AS street_without_house_number`);
    metrics.push(`SUM(CASE WHEN ${house} AND NOT ${street} THEN 1 ELSE 0 END) AS house_number_without_street`);
    const uninc = available('Uninc_Comm'); const postCity = available('Post_City');
    if (uninc) metrics.push(`SUM(CASE WHEN ${present(uninc)} THEN 1 ELSE 0 END) AS unincorporated_community_present`);
    if (uninc && postCity) metrics.push(`SUM(CASE WHEN ${present(uninc)} AND NOT ${present(postCity)} THEN 1 ELSE 0 END) AS unincorporated_without_post_city`);
    const geom = schemaLayer.geometryFields?.[0]?.name || available('Shape');
    if (geom) metrics.push(`SUM(CASE WHEN ${quoteIdentifier(geom)} IS NOT NULL AND NOT IsEmpty(${quoteIdentifier(geom)}) THEN 1 ELSE 0 END) AS geometry_present`);
    const aggregate = (await sqlRows(`SELECT ${metrics.join(', ')} FROM ${quoteIdentifier(options.layer)} WHERE ${where}`, `Measuring ${scopeName} completeness`))[0];
    report.calculatedMeasurements[scopeName] = {
      completeness: aggregate,
      fieldAvailability: Object.fromEntries(COMPLETENESS.map(name => [name, available(name) || null])),
      distributions: {}, identifiers: {},
    };
    for (const id of identifiers) report.calculatedMeasurements[scopeName].identifiers[id] = number(aggregate[`present__${id}`]);

    const roadExpression = streetFields.length ? `UPPER(TRIM(${streetFields.map(field => `COALESCE(CAST(${quoteIdentifier(field)} AS TEXT), '')`).join(" || ' ' || ")}))` : "''";
    const patterns = {
      countyRoadAny: "% COUNTY ROAD %|COUNTY ROAD %|% COUNTY RD %|COUNTY RD %|CR %|% CR %",
      countyRoadFull: "% COUNTY ROAD %|COUNTY ROAD %",
      countyRoadRd: "% COUNTY RD %|COUNTY RD %",
      countyRoadCr: "CR %|% CR %",
      farmToMarketAny: "FM %|% FM %|FARM TO MARKET %|% FARM TO MARKET %|FARM-TO-MARKET %|% FARM-TO-MARKET %",
      farmToMarketFm: "FM %|% FM %",
      farmToMarketWords: "FARM TO MARKET %|% FARM TO MARKET %",
      farmToMarketHyphenated: "FARM-TO-MARKET %|% FARM-TO-MARKET %",
      ranchToMarketAny: "RM %|% RM %|RANCH TO MARKET %|% RANCH TO MARKET %|RANCH-TO-MARKET %|% RANCH-TO-MARKET %",
      ranchToMarketRm: "RM %|% RM %",
      ranchToMarketWords: "RANCH TO MARKET %|% RANCH TO MARKET %",
      ranchToMarketHyphenated: "RANCH-TO-MARKET %|% RANCH-TO-MARKET %",
    };
    const ruralSelect = Object.entries(patterns).map(([key, encoded]) => {
      const clauses = encoded.split('|').map(pattern => `${roadExpression} LIKE ${literal(pattern)}`);
      return `SUM(CASE WHEN ${clauses.join(' OR ')} THEN 1 ELSE 0 END) AS ${quoteIdentifier(key)}`;
    });
    report.calculatedMeasurements[scopeName].ruralRoadway = (await sqlRows(`SELECT ${ruralSelect.join(', ')} FROM ${quoteIdentifier(options.layer)} WHERE ${where}`, `Measuring ${scopeName} rural roadway patterns`))[0];
    if (streetFields.length) {
      report.calculatedMeasurements[scopeName].roadNameInventory = await sqlRows(`SELECT ${roadExpression} AS normalized_street, COUNT(*) AS count FROM ${quoteIdentifier(options.layer)} WHERE ${where} AND (${roadExpression} LIKE '%ROAD%' OR ${roadExpression} LIKE 'CR %' OR ${roadExpression} LIKE '% CR %' OR ${roadExpression} LIKE 'FM %' OR ${roadExpression} LIKE '% FM %' OR ${roadExpression} LIKE 'RM %' OR ${roadExpression} LIKE '% RM %') GROUP BY normalized_street ORDER BY count DESC, normalized_street LIMIT 100`, `${scopeName}: inventorying actual rural road names`);
    }
    for (const requestedField of DISTRIBUTIONS) {
      const field = available(requestedField); if (!field) continue;
      const total = (await sqlRows(`SELECT COUNT(DISTINCT ${quoteIdentifier(field)}) AS unique_values FROM ${quoteIdentifier(options.layer)} WHERE ${where}`, `${scopeName}: ${field} unique values`))[0];
      const top = await sqlRows(`SELECT ${quoteIdentifier(field)} AS value, COUNT(*) AS count FROM ${quoteIdentifier(options.layer)} WHERE ${where} GROUP BY ${quoteIdentifier(field)} ORDER BY count DESC, value LIMIT ${options.top}`, `${scopeName}: ${field} top values`);
      report.calculatedMeasurements[scopeName].distributions[field] = { uniqueValues: number(total.unique_values), top };
    }
    const date = available('DateUpdate') || available('LastUpdate');
    if (date) report.calculatedMeasurements[scopeName].dateUpdate = (await sqlRows(`SELECT MIN(${quoteIdentifier(date)}) AS minimum, MAX(${quoteIdentifier(date)}) AS maximum, SUM(CASE WHEN ${present(date)} THEN 1 ELSE 0 END) AS present FROM ${quoteIdentifier(options.layer)} WHERE ${where}`, `${scopeName}: update date range`))[0];
  }

  const addNumber = available('Add_Number') || available('AddNo_Full');
  const streetName = available('StNam_Full') || available('Street') || available('St_Name');
  const city = available('Post_City'); const zip = available('Zip_Code');
  if (!addNumber || !streetName) throw new Error('Target diagnostic requires an address-number field and street-name field');
  const targetFields = [...new Set([addNumber, streetName, city, zip, state, county, 'Latitude', 'Longitude', ...DISTRIBUTIONS, 'GUID', 'DateUpdate'].map(available).filter(Boolean))];
  const targetQuery = async numberValue => sqlRows(`SELECT ${targetFields.map(quoteIdentifier).join(', ')} FROM ${quoteIdentifier(options.layer)} WHERE ${scopes.libertyCounty} AND ${normalized(addNumber)}=${literal(String(numberValue))} AND REPLACE(REPLACE(REPLACE(${normalized(streetName)}, 'COUNTY ROAD', 'CR'), 'COUNTY RD', 'CR'), '  ', ' ') LIKE '%CR 677%'${city ? ` AND ${normalized(city)}=${literal('DAYTON')}` : ''}${zip ? ` AND SUBSTR(TRIM(CAST(${quoteIdentifier(zip)} AS TEXT)),1,5)=${literal('77535')}` : ''} LIMIT 100`, `Checking ${numberValue} County Road 677`);
  const exact = await targetQuery(274); const interpolation = await targetQuery(698);
  report.calculatedMeasurements.targetAddress = { query: '274 County Road 677, Dayton, TX 77535', exactFound: exact.length > 0, candidateCount: exact.length, candidates: exact, interpolation698Found: interpolation.length > 0, interpolation698CandidateCount: interpolation.length, interpolation698Candidates: interpolation };
  report.scalabilityAssessment = {
    status: 'measurement evidence; ingestion design requires owner review',
    statePackagesWithoutSpatialFilter: exactStateValues.length > 0,
    countyPackagesWithoutSpatialFilter: countyRows.length > 0,
    stableStateIdentifierCandidates: identifiers.filter(name => /state/i.test(name)), stableCountyIdentifierCandidates: identifiers.filter(name => /county|fips|geoid/i.test(name)),
    cautions: ['Do not hard-code Texas names, abbreviations, road vocabulary, county suffixes, or field casing.', 'Key counties by a durable state-qualified identifier; county display names are not nationally unique.', 'Normalize whitespace/case and aliases only for matching while retaining source values.', 'Verify identifier completeness and collisions before deterministic package generation.', 'National scale requires bounded output, repeatable GDAL versions, source-release identity, and explicit handling of territories and schema drift.'],
    libertyProofOfConcept: 'Suitable only if measured completeness, durable identifiers, target diagnostics, and owner review are acceptable.',
    proceedToIngestionDesign: false,
  };
  const after = await stat(archive);
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error('NAD archive changed during measurement');
  await mkdir(reports, { recursive: true });
  const names = { json: 'lp104.3-nad-r23-texas-measurement.json', markdown: 'lp104.3-nad-r23-texas-measurement.md', countiesCsv: 'lp104.3-nad-r23-texas-counties.csv' };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const totalTexas = number(report.calculatedMeasurements.texas.completeness.total);
  const libertyTotal = number(report.calculatedMeasurements.libertyCounty.completeness.total);
  const markdown = `# LP104.3 NAD R23 Texas measurement\n\nGenerated: ${report.generatedAt}\n\n> Calculated measurements from the local archive; no records were ingested and the archive was read through \`/vsizip/\`.\n\n## Headline results\n\n- Texas records: ${totalTexas.toLocaleString('en-US')}\n- Texas county values: ${countyRows.length}\n- Liberty County records: ${libertyTotal.toLocaleString('en-US')}\n- Target exact candidates: ${exact.length}\n- 698 interpolation candidates: ${interpolation.length}\n- Observed Texas State values: ${exactStateValues.map(value => `\`${value}\``).join(', ')}\n\n## Artifacts\n\n- Machine-readable measurements: \`${names.json}\`\n- County counts: \`${names.countiesCsv}\`\n\n## Decision\n\nDo not begin ingestion or merge this milestone until the real measurement output has been reviewed. Identifier completeness, anomalous county values, distributions, rural patterns, and target candidates are detailed in the JSON report.\n`;
  const countyCsv = `county,count\r\n${countyRows.map(row => `${csvCell(row.county)},${number(row.count)}`).join('\r\n')}\r\n`;
  await atomic(join(reports, names.json), json); await atomic(join(reports, names.markdown), markdown); await atomic(join(reports, names.countiesCsv), countyCsv);
  log(`Complete. Reports written to ${reports}`);
  return { report, reports, files: names };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) { process.stdout.write(`${usage()}\n`); return; }
  await measure(options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  process.stderr.write(`LP104.3 measurement failed: ${error.message}\n\n${usage()}\n`); process.exitCode = 1;
});
