import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const INVENTORY = resolve(ROOT, 'data/lp104/texas-counties.json');
const DEFAULT_SOURCE = resolve(ROOT, 'evidence/lp125/sources/PopReportCurrent.xlsx');
const DEFAULT_OUTPUT = resolve(ROOT, 'evidence/lp125/texas-statewide-county-jail-evidence.json');
export const EXPECTED_WORKBOOK_SHA256 = '77970ab3c5c0d3929e774e42c61dda092ad4afe828b21b9fcb223b30c00f540d';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const portable = (path) => relative(ROOT, path).replaceAll('\\', '/');
function fail(code, detail = '') { const error = new Error(`${code}${detail ? `: ${detail}` : ''}`); error.code = code; throw error; }
function decodeXml(value = '') { return value.replace(/&#(x[\da-f]+|\d+);|&(?:amp|lt|gt|quot|apos);/gi, (entity, numeric) => numeric ? String.fromCodePoint(Number(numeric[0].toLowerCase() === 'x' ? `0${numeric}` : numeric)) : ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }[entity.toLowerCase()])); }
async function zipEntry(path, entry) {
  try { return (await execFileAsync('unzip', ['-p', path, entry], { encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 })).stdout; }
  catch (error) { fail('INVALID_XLSX_ARCHIVE', `${entry}: ${error.message}`); }
}
function attr(xml, name) { return decodeXml(xml.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || ''); }
function sharedStrings(xml) { return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(([, body]) => [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x => decodeXml(x[1])).join('')); }
function rows(xml, strings) {
  return [...xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)].map(([, attrs, body]) => {
    const cells = {};
    for (const [, cellAttrs, cellBody] of body.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const reference = attr(cellAttrs, 'r'), column = reference.match(/^[A-Z]+/)?.[0];
      const raw = cellBody.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
      let value = attr(cellAttrs, 't') === 's' && raw !== '' ? strings[Number(raw)] : decodeXml(raw);
      if (attr(cellAttrs, 't') === 'inlineStr') value = [...cellBody.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x => decodeXml(x[1])).join('');
      if (column) cells[column] = value;
    }
    return { rowNumber: Number(attr(attrs, 'r')), cells };
  });
}
function excelDate(serial) { const date = new Date(Date.UTC(1899, 11, 30) + Number(serial) * 86400000); if (!Number.isFinite(date.valueOf())) fail('INVALID_REPORTING_DATE', serial); return date.toISOString().slice(0, 10); }
function classify(identifier) {
  if (/\(no jail\)\s*$/i.test(identifier)) return { type: 'NO_JAIL', countyToken: identifier.replace(/\s*\(no jail\)\s*$/i, '') };
  if (/\(p\)\s*$/i.test(identifier)) return { type: 'PRIVATE_FACILITY', countyToken: identifier.replace(/\s*\(p\)\s*$/i, '') };
  if (/\bOLS\b/i.test(identifier)) return { type: 'OLS', countyToken: null };
  return { type: 'COUNTY_JAIL', countyToken: identifier.trim() };
}

export async function parseWorkbook(source = DEFAULT_SOURCE) {
  const path = source instanceof URL ? fileURLToPath(source) : resolve(source); let bytes;
  try { bytes = await readFile(path); } catch (error) { fail('WORKBOOK_NOT_FOUND', error.message); }
  const workbookSha256 = sha256(bytes);
  if (workbookSha256 !== EXPECTED_WORKBOOK_SHA256) fail('WORKBOOK_HASH_MISMATCH', workbookSha256);
  const [workbookXml, relsXml, stringsXml] = await Promise.all([zipEntry(path, 'xl/workbook.xml'), zipEntry(path, 'xl/_rels/workbook.xml.rels'), zipEntry(path, 'xl/sharedStrings.xml')]);
  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/g)].map(([, a]) => ({ name: attr(a, 'name'), relationshipId: attr(a, 'r:id') }));
  const relationships = new Map([...relsXml.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)].map(([, a]) => [attr(a, 'Id'), attr(a, 'Target')]));
  const strings = sharedStrings(stringsXml);
  const loadSheet = async (name) => { const sheet = sheets.find(x => x.name === name); if (!sheet) fail('WORKSHEET_NOT_FOUND', name); const target = relationships.get(sheet.relationshipId); if (!target) fail('WORKSHEET_RELATIONSHIP_NOT_FOUND', name); return rows(await zipEntry(path, `xl/${target.replace(/^\//, '')}`), strings); };
  const countyRows = await loadSheet('BY COUNTY'), dictionaryRows = await loadSheet('DATA DICTIONARY');
  if (countyRows.find(x => x.rowNumber === 5)?.cells.A !== 'County/Facility') fail('INVALID_HEADER', 'BY COUNTY!A5');
  const dictionary = Object.fromEntries(dictionaryRows.map(x => [x.cells.A, x.cells.B]).filter(([term, definition]) => term && definition));
  const required = { 'County/Facility': 'Name of the county, private facility, OLS Unit.', '(P)': 'Private Facility', '(No Jail)': 'The county does not have a jail, and they house their inmates in another county.', OLS: 'Operation Lonestar Unit' };
  for (const [term, definition] of Object.entries(required)) if (dictionary[term] !== definition) fail('INVALID_DATA_DICTIONARY', term);
  const populated = countyRows.filter(x => x.rowNumber >= 6 && x.cells.A && x.cells.B);
  if (!populated.length) fail('NO_WORKBOOK_DATA');
  const latestSerial = Math.max(...populated.map(x => Number(x.cells.B)));
  const latestRows = populated.filter(x => Number(x.cells.B) === latestSerial).map(x => ({ rowNumber: x.rowNumber, identifier: x.cells.A, reportingDate: excelDate(latestSerial), ...classify(x.cells.A) }));
  return { path, workbookSha256, worksheet: 'BY COUNTY', headerRow: 5, dataStartRow: 6, reportingDate: excelDate(latestSerial), latestSerial, historicalReportingDateCount: new Set(populated.map(x => x.cells.B)).size, latestRows, dictionary };
}

export async function buildEvidence({ source = DEFAULT_SOURCE, output = DEFAULT_OUTPUT } = {}) {
  const [parsed, inventoryBytes] = await Promise.all([parseWorkbook(source), readFile(INVENTORY)]);
  const inventory = JSON.parse(inventoryBytes); const byName = new Map(inventory.counties.map(x => [x.countyName.toLowerCase(), x]));
  const countyEntries = new Map(inventory.counties.map(x => [x.fips, []])); const nonCountyEntries = [];
  for (const row of parsed.latestRows) {
    const county = row.countyToken ? byName.get(row.countyToken.toLowerCase()) : null;
    const entry = { workbookRow: row.rowNumber, identifier: row.identifier, tcjsClassification: row.type };
    if (!county) { nonCountyEntries.push(entry); continue; }
    countyEntries.get(county.fips).push(entry);
  }
  const unresolved = nonCountyEntries.filter(x => x.tcjsClassification !== 'OLS');
  const missing = inventory.counties.filter(x => countyEntries.get(x.fips).length === 0);
  if (unresolved.length) fail('COUNTY_RECONCILIATION_FAILED', JSON.stringify({ unresolved }));
  const records = inventory.counties.map(({ countyName, fips }) => {
    const entries = countyEntries.get(fips); const types = [...new Set(entries.map(x => x.tcjsClassification))];
    return { recordId: `lp125-county-jail-${fips}`, evidenceClass: 'COUNTY_JAIL', assertionType: 'TCJS_COUNTY_FACILITY_STATUS', county: `${countyName} County`, countyFips: fips, reportingDate: parsed.reportingDate, tcjsClassifications: types, sourceEntries: entries, sourcePublisher: 'Texas Commission on Jail Standards', sourceArtifact: portable(parsed.path), sourceArtifactSha256: parsed.workbookSha256, sourceWorksheet: parsed.worksheet, sourceHeaderRow: parsed.headerRow, sourceDataStartRow: parsed.dataStartRow, sourceIdentifierColumn: 'County/Facility', acquisitionMethod: 'PARSED_GOVERNED_XLSX', reviewStatus: entries.length ? 'PENDING_REVIEW' : 'REVIEW_REQUIRED', reconciliationIssue: entries.length ? null : 'COUNTY_NOT_REPRESENTED_AT_LATEST_REPORTING_DATE', candidateApproval: false, productionAuthorization: false, runtimeEligible: false };
  });
  const countType = (type) => records.filter(x => x.tcjsClassifications.includes(type)).length;
  const batch = { schemaVersion: 'gridly-lp125-tcjs-county-jail-evidence-v1', milestone: 'LP125', evidenceClass: 'COUNTY_JAIL', reportingDate: parsed.reportingDate, latestReportingDateSelection: true, workbookProvenance: { publisher: 'Texas Commission on Jail Standards', artifactPath: portable(parsed.path), sha256: parsed.workbookSha256, worksheet: parsed.worksheet, headerRow: parsed.headerRow, dataStartRow: parsed.dataStartRow, identifierColumn: 'County/Facility', historicalReportingDateCount: parsed.historicalReportingDateCount, parsedLatestRowCount: parsed.latestRows.length, dataDictionary: Object.fromEntries(['County/Facility', '(No Jail)', '(P)', 'OLS'].map(k => [k, parsed.dictionary[k]])) }, reconciliation: { controlInventoryPath: portable(INVENTORY), controlInventorySha256: sha256(inventoryBytes), expectedCountyCount: inventory.count, reconciledCountyCount: records.filter(x => x.sourceEntries.length).length, missingCountiesAtLatestDate: missing.map(x => ({ county: `${x.countyName} County`, countyFips: x.fips })), unresolvedIdentifiers: nonCountyEntries, duplicateSourceEntriesPreserved: parsed.latestRows.length - new Set(parsed.latestRows.map(x => x.identifier)).size }, records, summary: { countyJail: countType('COUNTY_JAIL'), noJail: countType('NO_JAIL'), privateFacility: countType('PRIVATE_FACILITY'), olsCountyRecords: countType('OLS'), standaloneOlsEntries: nonCountyEntries.filter(x => x.tcjsClassification === 'OLS').length, reviewRequired: records.filter(x => x.reviewStatus === 'REVIEW_REQUIRED').length }, candidateApproval: false, productionAuthorization: false, runtimeEligible: false, countiesActivated: false, runtimeModified: false };
  batch.seal = { algorithm: 'SHA-256', canonicalPayloadHash: sha256(JSON.stringify(batch)) };
  await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(output, `${JSON.stringify(batch, null, 2)}\n`); return batch;
}
function cliValue(flag) { const i = process.argv.indexOf(flag); return i < 0 ? undefined : process.argv[i + 1]; }
if (import.meta.url === pathToFileURL(process.argv[1]).href) await buildEvidence({ source: cliValue('--source') || DEFAULT_SOURCE, output: cliValue('--output') || DEFAULT_OUTPUT });
