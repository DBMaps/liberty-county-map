#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const defaultSource = 'js/gridly.local.js';
export const defaultOutput = 'owner-local/native-provider-config.json';

const nonblank = (value) => typeof value === 'string' && value.trim() && !/^(?:YOUR_|<)|PLACEHOLDER/i.test(value.trim());

export function validateNativeProviderConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('NATIVE_PROVIDER_CONFIG_MUST_BE_AN_OBJECT');
  if (Object.keys(value).sort().join(',') !== 'arcgisStaticBasemapApiKey,driveTexas') throw new Error('NATIVE_PROVIDER_CONFIG_FIELDS_INVALID');
  if (!nonblank(value.arcgisStaticBasemapApiKey)) throw new Error('NATIVE_PROVIDER_CONFIG_ARCGIS_KEY_REQUIRED');
  if (!value.driveTexas || typeof value.driveTexas !== 'object' || Array.isArray(value.driveTexas)
      || Object.keys(value.driveTexas).join(',') !== 'apiKey' || !nonblank(value.driveTexas.apiKey)) {
    throw new Error('NATIVE_PROVIDER_CONFIG_DRIVETEXAS_KEY_REQUIRED');
  }
  return Object.freeze({
    schema: 'arcgisStaticBasemapApiKey:string(nonblank), driveTexas.apiKey:string(nonblank)',
    arcgisStaticBasemap: 'CONFIGURED_NONBLANK',
    officialRoadways: 'GRIDLY_CONFIG.driveTexas.apiKey_CONFIGURED_NONBLANK'
  });
}

export function composeNativeProviderConfig(sourceBytes) {
  const window = {};
  try { vm.runInNewContext(sourceBytes.toString('utf8'), { window }, { timeout: 1000 }); }
  catch { throw new Error('NATIVE_PROVIDER_SOURCE_INVALID_JAVASCRIPT'); }
  const config = {
    arcgisStaticBasemapApiKey: window.GRIDLY_RUNTIME_CONFIG?.arcgisStaticBasemapApiKey,
    driveTexas: { apiKey: window.GRIDLY_CONFIG?.driveTexas?.apiKey || window.GRIDLY_CONFIG?.txdot?.apiKey || window.GRIDLY_TXDOT_API_KEY }
  };
  validateNativeProviderConfig(config);
  return config;
}

function assertIgnored(relativePath) {
  try { execFileSync('git', ['check-ignore', '--quiet', '--', relativePath], { cwd: root, stdio: 'ignore' }); }
  catch { throw new Error(`NATIVE_PROVIDER_CONFIG_OUTPUT_NOT_GITIGNORED:${relativePath}`); }
  const tracked = execFileSync('git', ['ls-files', '--', relativePath], { cwd: root, encoding: 'utf8' }).trim();
  if (tracked) throw new Error(`NATIVE_PROVIDER_CONFIG_OUTPUT_IS_TRACKED:${relativePath}`);
}

export async function composeFile(source = defaultSource, output = defaultOutput) {
  const sourcePath = resolve(root, source);
  try { if (!(await stat(sourcePath)).isFile()) throw new Error(); }
  catch { throw new Error(`NATIVE_PROVIDER_SOURCE_MISSING:${source}. Run powershell -ExecutionPolicy Bypass -File tools/Setup-GridlyLocalDriveTexas.ps1, add the existing referrer-restricted ArcGIS key to GRIDLY_RUNTIME_CONFIG, then rerun tools/Prepare-GridlyNative.ps1.`); }
  assertIgnored(output);
  const config = composeNativeProviderConfig(await readFile(sourcePath));
  const outputPath = resolve(root, output);
  const temporary = `${outputPath}.tmp-${process.pid}`;
  await mkdir(dirname(outputPath), { recursive: true });
  try {
    await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, outputPath);
  } finally { await rm(temporary, { force: true }); }
  return validateNativeProviderConfig(JSON.parse(await readFile(outputPath, 'utf8')));
}

export async function validateFile(file = defaultOutput) {
  try { return validateNativeProviderConfig(JSON.parse(await readFile(resolve(root, file), 'utf8'))); }
  catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`NATIVE_PROVIDER_CONFIG_MISSING:${file}. Run powershell -ExecutionPolicy Bypass -File tools/Prepare-GridlyNative.ps1.`);
    throw error;
  }
}

export async function verifyStaged(directory = 'www') {
  const runtime = await readFile(resolve(root, directory, 'js/gridlyRuntimeEnvironmentConfig.js'), 'utf8');
  const window = {};
  vm.runInNewContext(runtime, { window }, { timeout: 1000 });
  if (!nonblank(window.GRIDLY_CONFIG?.driveTexas?.apiKey)) throw new Error('STAGED_OFFICIAL_ROADWAYS_CONFIG_MISSING');
  const app = await readFile(resolve(root, directory, 'js/app.js'), 'utf8');
  if (!/SUPABASE_URL\s*=\s*["']https:\/\//.test(app) || !/SUPABASE_PUBLIC_KEY\s*=\s*["'][^"']+/.test(app) || /service[_-]?role/i.test(app)) throw new Error('STAGED_REPORT_PUBLIC_CLIENT_CONFIG_INVALID');
  return Object.freeze({ officialRoadways: 'CONFIGURED', reportSubmission: 'TRACKED_PUBLIC_CLIENT_CONFIGURED_NO_SERVICE_ROLE' });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2] || 'validate';
  const value = command === 'compose' ? await composeFile() : command === 'validate' ? await validateFile() : command === 'verify-staged' ? await verifyStaged() : null;
  if (!value) throw new Error('Usage: node tools/native-provider-config.mjs compose|validate|verify-staged');
  console.log(`Native provider configuration ${command} PASS: ${Object.values(value).join('; ')}. Credential values were not printed.`);
}
