import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PROFILE, requireSyntheticProviders } from './contracts.mjs';
import { readMaintenanceProviderInputs, verifyMaintenanceRuntime } from './staging.mjs';
import { privatePathVerified } from './windows-private-path.mjs';

const root = resolve(import.meta.dirname, '../..');
const sourcePaths = ['consumer-script-manifest.json', 'css/styles.css', 'index.html', 'js/app.js'];
const reportName = 'community-submission-contract.json';
const config = 'js/gridlyRuntimeEnvironmentConfig.js';
const profile = 'gridly-102-combined-2026-11';
const manifestPath = 'tools/arcgis-maintenance/combined-release.json';
const tooling = [manifestPath, 'tools/arcgis-maintenance/combined-release.mjs'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const reject = code => { throw Error(code); };

function git(...args) {
  return execFileSync('git', args, { cwd:root, stdio:['ignore','pipe','ignore'], maxBuffer:16*1024*1024 });
}

async function checkSource(platform) {
  const manifest = JSON.parse(await readFile(join(root,manifestPath),'utf8'));
  if (manifest.profile !== profile || manifest.scope !== 'SYNTHETIC_REVIEW_ONLY' || !Object.hasOwn(manifest.fallback,platform))
    reject('COMBINED_PROFILE_REJECTED');
  const fallback = manifest.fallback[platform];
  if (git('merge-base',fallback,'HEAD').toString().trim() !== fallback) reject('COMBINED_BASELINE_REJECTED');
  const changes = [
    git('diff','--name-only','-z',fallback,'--'), git('ls-files','-z','--others','--exclude-standard')
  ].flatMap(output => output.toString().split('\0').filter(Boolean));
  const allowed = new Set([...sourcePaths,...tooling]);
  if (changes.some(path => !allowed.has(path))) reject('COMBINED_UNRELATED_SOURCE_CHANGE');
  const source = new Map();
  for (const path of sourcePaths) {
    const body = await readFile(join(root,path));
    if (digest(body) !== manifest.sourceSha256[path]) reject('COMBINED_SOURCE_HASH_MISMATCH');
    source.set(path,body);
  }
  return { manifest, source };
}

function replaceOnce(text, from, to) {
  if (text.split(from).length !== 2) reject('COMBINED_ANDROID_LAYOUT_MISMATCH');
  return text.replace(from,to);
}

const appBefore = 'js/app.js?v=lp24448-awareness';
const appAfter = appBefore + '-gridly102';
const cssBefore = 'css/styles.css?v=lp24447-approved-png';
const cssAfter = cssBefore + '-gridly102';

async function androidOverlay(www, source) {
  const raw = async path => readFile(join(www,path),'utf8');
  const html = replaceOnce(replaceOnce(replaceOnce(await raw('index.html'),
    ' /> Show all crossings layer</label>', ' /> Railroad Crossings</label>'), appBefore, appAfter), cssBefore, cssAfter);
  const scripts = replaceOnce(await raw('consumer-script-manifest.json'), appBefore, appAfter);
  if (scripts.replaceAll('\r\n','\n') !== source.get('consumer-script-manifest.json').toString())
    reject('COMBINED_ANDROID_SCRIPT_MANIFEST_MISMATCH');
  const css = source.get('css/styles.css').toString();
  const baselineCss = await raw('css/styles.css');
  const contract = JSON.parse(await raw(reportName));
  if (contract.runtime?.['js/app.js'] !== digest(await readFile(join(www,'js/app.js'))) ||
      !Array.isArray(contract.scripts) || contract.scripts.filter(path => path === appBefore).length !== 1)
    reject('COMBINED_ANDROID_SUBMISSION_CONTRACT_MISMATCH');
  contract.runtime['js/app.js'] = digest(source.get('js/app.js'));
  contract.scripts = contract.scripts.map(path => path === appBefore ? appAfter : path);
  return new Map([
    ['js/app.js',source.get('js/app.js')],
    ['css/styles.css',Buffer.from(baselineCss.includes('\r\n') ? css.replaceAll('\n','\r\n') : css)],
    ['index.html',Buffer.from(html)],
    ['consumer-script-manifest.json',Buffer.from(scripts)],
    [reportName,Buffer.from(JSON.stringify(contract,null,2)+'\n')]
  ]);
}

async function verifyStage(www, expected) {
  const paths = [];
  async function walk(relative = '') {
    for (const entry of await readdir(join(www,relative), {withFileTypes:true})) {
      const path = relative ? relative+'/'+entry.name : entry.name;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) paths.push(path);
      else reject('COMBINED_STAGE_INVALID_ENTRY');
    }
  }
  await walk();
  if (paths.length !== expected.size) reject('COMBINED_STAGE_INVENTORY_MISMATCH');
  for (const path of paths) {
    const bytes = await readFile(join(www,path)), record = expected.get(path);
    if (!record || bytes.length !== record.bytes || digest(bytes) !== record.sha256) reject('COMBINED_STAGE_BYTE_MISMATCH');
  }
  return paths.length;
}

async function certify(platform, syntheticRoot, aab) {
  const { manifest, source } = await checkSource(platform);
  const candidateFile = join(syntheticRoot,'native-provider-config.json');
  const originalFile = join(syntheticRoot,'original-native-provider-config.json');
  const inputs = await readMaintenanceProviderInputs({
    candidateFile, originalFile,
    verifyPrivateFile: path => privatePathVerified(path,'File',{authorizedRoot:syntheticRoot})
  });
  requireSyntheticProviders(inputs);
  const reportFile = join(syntheticRoot,'runtime-stage-identity.json');
  const stageArgs = ['tools/native-web.mjs','--arcgis-maintenance-profile',PROFILE,'--runtime-config-file',candidateFile,
    '--original-runtime-config-file',originalFile,'--maintenance-private-root',syntheticRoot,'--report-file',reportFile];
  if (platform === 'android') stageArgs.push('--android-production','--android-baseline-aab',aab);

  // The unchanged credential stage and verifier provide the platform baseline.
  for (const extra of [[],['--verify']]) {
    try {
      execFileSync(process.execPath, ['--import','./tests/arcgis-maintenance/no-network.mjs',...stageArgs,...extra],
        { cwd:root, stdio:'ignore' });
    } catch { reject(extra.length ? 'COMBINED_BASE_STAGE_VERIFICATION_FAILED' : 'COMBINED_BASE_STAGE_FAILED'); }
  }
  const www = join(root,'www');
  const legacy = JSON.parse(await readFile(reportFile,'utf8'));
  const expected = new Map(legacy.files.map(row => [row.path,row]));
  if (expected.size !== 1007 || legacy.files.length !== expected.size) reject('COMBINED_BASE_STAGE_INVENTORY_MISMATCH');

  if (platform === 'android') {
    for (const [path,bytes] of await androidOverlay(www,source)) {
      if (!expected.has(path)) reject('COMBINED_ANDROID_LAYOUT_MISMATCH');
      await writeFile(join(www,path),bytes);
      expected.set(path,{path,bytes:bytes.length,sha256:digest(bytes)});
    }
  } else {
    for (const path of sourcePaths.filter(path => path !== 'index.html')) {
      if (expected.get(path)?.sha256 !== manifest.sourceSha256[path]) reject('COMBINED_IOS_STAGE_SOURCE_MISMATCH');
    }
  }

  const files = await verifyStage(www,expected);
  verifyMaintenanceRuntime({
    ...inputs, canonicalBytes:await readFile(join(root,config)), runtimeBytes:await readFile(join(www,config))
  });
  const combinedPaths = [...sourcePaths,reportName];
  const report = {
    profile, scope:manifest.scope, blocked:manifest.blocked, platform, sourceCommit:legacy.candidateGitSha,
    trackedDirty:legacy.sourceGitState.trackedDirty, fallback:manifest.fallback[platform],
    sourceSha256:manifest.sourceSha256, files,
    approvedPayload:combinedPaths.map(path => expected.get(path)),
    androidRetainedOutsideApprovedPayloadAndConfig:platform === 'android' ? files-combinedPaths.length-1 : null,
    bundleDigest: 'sha256:'+digest([...expected.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)
      .map(row => row.path+'\0'+row.bytes+'\0'+row.sha256+'\n').join(''))
  };
  await writeFile(join(syntheticRoot,'combined-review-identity.json'), JSON.stringify(report,null,2)+'\n',
    {flag:'wx',mode:0o600});
}

try {
  const [platform, syntheticRoot, aab, ...unexpected] = process.argv.slice(2);
  if (!['ios','android'].includes(platform) || unexpected.length) reject('COMBINED_ARGUMENTS_INVALID');
  if (syntheticRoot === '--check-source' && !aab) {
    await checkSource(platform);
    console.log('COMBINED_SOURCE_VERIFIED');
  } else {
    if (!syntheticRoot || (platform==='android') !== Boolean(aab)) reject('COMBINED_ARGUMENTS_INVALID');
    await certify(platform,resolve(syntheticRoot),aab && resolve(aab));
    console.log('COMBINED_SYNTHETIC_PAYLOAD_VERIFIED');
  }
} catch (error) {
  console.error(/^COMBINED_[A-Z_]+$/.test(error.message) ? error.message : 'COMBINED_OPERATION_REJECTED');
  process.exitCode=1;
}
