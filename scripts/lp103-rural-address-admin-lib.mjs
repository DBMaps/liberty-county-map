import { createHash } from 'node:crypto';
import { stdin, stdout } from 'node:process';

export const TABLE = 'gridly_verified_rural_addresses';
export const VERIFICATION_METHODS = Object.freeze([
  'county_911_address_record', 'county_appraisal_situs_record', 'owner_confirmed_gps',
  'field_verified_entrance', 'authoritative_address_point_dataset'
]);
export const PRECISIONS = Object.freeze(['verified_address_point', 'verified_entrance']);
const PRIVATE_NAMES = Object.freeze([
  'HOUSE_NUMBER', 'ROAD', 'LOCALITY', 'COUNTY_ID', 'STATE', 'POSTAL_CODE', 'LATITUDE',
  'LONGITUDE', 'COORDINATE_SOURCE', 'VERIFICATION_METHOD', 'VERIFICATION_DATE',
  'SOURCE_AUTHORITY', 'ALIASES_JSON', 'PRECISION'
]);

export function normalizeHouseNumber(value) {
  const match = String(value || '').trim().match(/^(\d{1,9})([A-Za-z]?)$/);
  return match ? `${Number(match[1])}${match[2].toLowerCase()}` : '';
}

// Keep byte-for-byte semantics aligned with normalizeRoadIdentity in gridly-geocode.
export function normalizeRoadIdentity(value) {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b(?:county road|county rd|co rd|cr)\s*(\d+[a-z]?)\b/g, 'cr $1')
    .replace(/\b(?:farm to market road|farm to market|farm road|fm)\s*(\d+[a-z]?)\b/g, 'fm $1')
    .replace(/\b(?:state highway|sh|tx)\s*(\d+[a-z]?)\b/g, 'sh $1')
    .replace(/\b(?:us highway|us)\s*(\d+[a-z]?)\b/g, 'us $1');
  return normalized.replace(/^\d{1,9}[a-z]?\s+/, '').trim();
}

export function normalizeGeography(value) {
  const normalized = String(value || '').toLowerCase().replace(/\bcounty\b/g, '').replace(/[^a-z0-9]/g, '');
  return ({ texas: 'tx', tx: 'tx' })[normalized] || normalized;
}

export function registryLookup(values) {
  return [normalizeHouseNumber(values.houseNumber), normalizeRoadIdentity(values.road),
    normalizeGeography(values.state), String(values.postalCode || '').slice(0, 5)].join('|');
}

export function lookupFingerprint(values) {
  // Production hashes JSON.stringify(normalizedRegistryLookup(body)), including JSON string quotes.
  return createHash('sha256').update(JSON.stringify(registryLookup(values))).digest('hex');
}

export function validateLookupIdentity(values) {
  if (!normalizeHouseNumber(values.houseNumber)) throw new Error('Invalid or missing house number.');
  if (!normalizeRoadIdentity(values.road)) throw new Error('Invalid or missing road.');
  if (String(values.state || '').trim().toUpperCase() !== 'TX') throw new Error('State must be TX.');
  if (!/^\d{5}(?:-\d{4})?$/.test(String(values.postalCode || '').trim())) throw new Error('Invalid postal code.');
  return values;
}

function requiredText(value, label, max = 300) {
  const result = String(value || '').trim();
  if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw new Error(`Invalid or missing ${label}.`);
  return result;
}

export function validateCredentials(env) {
  const url = requiredText(env.LP103_SUPABASE_URL, 'service URL', 500);
  const serviceRoleKey = requiredText(env.LP103_SUPABASE_SERVICE_ROLE_KEY, 'service credential', 5000);
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid service URL.'); }
  if (parsed.protocol !== 'https:' && !(parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) throw new Error('Invalid service URL.');
  return { url: url.replace(/\/$/, ''), serviceRoleKey };
}

export function buildPendingRecord(input) {
  const houseNumber = normalizeHouseNumber(input.houseNumber);
  const road = requiredText(input.road, 'road');
  const canonicalRoadIdentity = normalizeRoadIdentity(road);
  if (!houseNumber) throw new Error('Invalid or missing house number.');
  if (!canonicalRoadIdentity) throw new Error('Invalid or missing road.');
  const state = requiredText(input.state, 'state', 20).toUpperCase();
  if (state !== 'TX') throw new Error('State must be TX.');
  const postalCode = requiredText(input.postalCode, 'postal code', 10);
  if (!/^\d{5}(?:-\d{4})?$/.test(postalCode)) throw new Error('Invalid postal code.');
  const latitude = Number(input.latitude); const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || latitude < 25.7 || latitude > 36.6) throw new Error('Invalid latitude.');
  if (!Number.isFinite(longitude) || longitude < -106.7 || longitude > -93.5) throw new Error('Invalid longitude.');
  const verificationMethod = requiredText(input.verificationMethod, 'verification method', 80);
  if (!VERIFICATION_METHODS.includes(verificationMethod)) throw new Error('Invalid verification method.');
  const precision = requiredText(input.precision, 'precision', 80);
  if (!PRECISIONS.includes(precision)) throw new Error('Invalid precision.');
  const verificationDate = requiredText(input.verificationDate, 'verification date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verificationDate) || Number.isNaN(Date.parse(`${verificationDate}T00:00:00Z`))) throw new Error('Invalid verification date.');
  const sourceAuthority = requiredText(input.sourceAuthority, 'source authority');
  const coordinateSource = requiredText(input.coordinateSource, 'coordinate source');
  let aliases;
  try { aliases = JSON.parse(String(input.aliasesJson || '[]')); } catch { throw new Error('Aliases must be a JSON array.'); }
  if (!Array.isArray(aliases) || aliases.some((item) => typeof item !== 'string')) throw new Error('Aliases must be a JSON array of strings.');
  const lookup = validateLookupIdentity({ houseNumber, road, state, postalCode });
  return {
    lookup_hash: lookupFingerprint(lookup), normalized_address: `${houseNumber} ${canonicalRoadIdentity}, ${requiredText(input.locality, 'locality')}, ${state} ${postalCode}`,
    house_number: houseNumber, canonical_road_identity: canonicalRoadIdentity,
    locality: requiredText(input.locality, 'locality'), county_id: requiredText(input.countyId, 'county ID'), state,
    postal_code: postalCode, latitude, longitude, coordinate_source: coordinateSource,
    verification_method: verificationMethod, verification_date: verificationDate, verification_status: 'pending',
    source_authority: sourceAuthority, aliases, precision, consumer_eligible: false, updated_at: new Date().toISOString()
  };
}

export async function hiddenPrompt(label) {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error(`Missing ${label}; interactive input requires a TTY.`);
  stdout.write(`${label}: `); stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
  return await new Promise((resolve, reject) => {
    let value = '';
    const finish = (error) => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData); stdout.write('\n'); error ? reject(error) : resolve(value); };
    const onData = (char) => {
      if (char === '\u0003') return finish(new Error('Input cancelled.'));
      if (char === '\r' || char === '\n') return finish();
      if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
      else if (!/[\u0000-\u001f\u007f]/.test(char)) value += char;
    };
    stdin.on('data', onData);
  });
}

export async function collectInput(env = process.env) {
  const values = {};
  for (const name of PRIVATE_NAMES) values[name] = env[`LP103_${name}`] ?? await hiddenPrompt(`LP103_${name}`);
  return {
    houseNumber: values.HOUSE_NUMBER, road: values.ROAD, locality: values.LOCALITY,
    countyId: values.COUNTY_ID, state: values.STATE, postalCode: values.POSTAL_CODE,
    latitude: values.LATITUDE, longitude: values.LONGITUDE, coordinateSource: values.COORDINATE_SOURCE,
    verificationMethod: values.VERIFICATION_METHOD, verificationDate: values.VERIFICATION_DATE,
    sourceAuthority: values.SOURCE_AUTHORITY, aliasesJson: values.ALIASES_JSON, precision: values.PRECISION
  };
}

export async function collectLookupInput(env = process.env) {
  const read = async (name) => env[`LP103_${name}`] ?? await hiddenPrompt(`LP103_${name}`);
  return { houseNumber: await read('HOUSE_NUMBER'), road: await read('ROAD'), state: await read('STATE'), postalCode: await read('POSTAL_CODE') };
}

export async function adminRequest(credentials, path, options = {}) {
  let response;
  try {
    response = await fetch(`${credentials.url}/rest/v1/${path}`, { ...options, headers: {
      apikey: credentials.serviceRoleKey, Authorization: `Bearer ${credentials.serviceRoleKey}`,
      'Content-Type': 'application/json', ...options.headers
    } });
  } catch { throw new Error('Private registry request failed.'); }
  if (!response.ok) throw new Error(`Private registry request failed with HTTP ${response.status}.`);
  return response;
}

export function redactedVerification(row) {
  return {
    recordFound: Boolean(row), verificationStatus: row?.verification_status || null,
    consumerEligible: row?.consumer_eligible === true,
    coordinatePresent: Number.isFinite(row?.latitude) && Number.isFinite(row?.longitude),
    sourceAuthorityPresent: typeof row?.source_authority === 'string' && row.source_authority.length > 0,
    privateValuesRedacted: true
  };
}
