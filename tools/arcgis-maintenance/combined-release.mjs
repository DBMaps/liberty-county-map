import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { PROFILE, requireSyntheticProviders } from './contracts.mjs';
import { readMaintenanceProviderInputs, verifyMaintenanceRuntime } from './staging.mjs';
import { privatePathVerified } from './windows-private-path.mjs';

const root = resolve(import.meta.dirname, '../..');
const sourcePaths = ['consumer-script-manifest.json', 'css/styles.css', 'index.html', 'js/app.js'];
const reportName = 'community-submission-contract.json';
const config = 'js/gridlyRuntimeEnvironmentConfig.js';
const profile = 'gridly-102-combined-2026-11';
const manifestPath = 'tools/arcgis-maintenance/combined-release.json';
const combinedTool = 'tools/arcgis-maintenance/combined-release.mjs';
const tooling = [manifestPath, combinedTool, 'tests/arcgis-maintenance/crossing-context.test.mjs'];
const releaseTooling = {
  ios: ['tools/apple_acceptance_build_only.py'],
  android: ['tools/arcgis-maintenance/android-combined-attest.py']
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const reject = code => { throw Error(code); };

function git(...args) {
  return execFileSync('git', args, { cwd:root, stdio:['ignore','pipe','ignore'], maxBuffer:16*1024*1024 });
}

async function checkSource(platform, releaseCommit) {
  const manifest = JSON.parse(await readFile(join(root,manifestPath),'utf8'));
  if (manifest.profile !== profile || manifest.scope !== 'COMBINED_RELEASE_AND_SYNTHETIC_REVIEW' || !Object.hasOwn(manifest.fallback,platform))
    reject('COMBINED_PROFILE_REJECTED');
  const fallback = manifest.fallback[platform];
  const head = git('rev-parse','HEAD').toString().trim();
  if (git('merge-base',fallback,'HEAD').toString().trim() !== fallback) reject('COMBINED_BASELINE_REJECTED');
  const approved = manifest.approved[platform];
  if (git('merge-base',approved,'HEAD').toString().trim() !== approved ||
      git('diff','--name-only',approved,'--',...sourcePaths).length)
    reject('COMBINED_APPROVED_SOURCE_MISMATCH');
  if (releaseCommit !== undefined && (!/^[a-f0-9]{40}$/.test(releaseCommit) || head !== releaseCommit ||
      git('status','--porcelain','--untracked-files=all').length ||
      git('diff','--name-only','-z',approved,'HEAD').toString().split('\0').filter(Boolean)
        .some(path => ![manifestPath,combinedTool,...releaseTooling[platform]].includes(path))))
    reject('COMBINED_RELEASE_SOURCE_REJECTED');
  const changes = [
    git('diff','--name-only','-z',fallback,'--'), git('ls-files','-z','--others','--exclude-standard')
  ].flatMap(output => output.toString().split('\0').filter(Boolean));
  const allowed = new Set([...sourcePaths,...tooling,...releaseTooling[platform]]);
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
  if (!(await lstat(www)).isDirectory()) reject('COMBINED_STAGE_INVALID_ENTRY');
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

function bundleDigest(records) {
  return 'sha256:'+digest([...records].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)
    .map(row => row.path+'\0'+row.bytes+'\0'+row.sha256+'\n').join(''));
}

async function requireAbsent(path) {
  try { await lstat(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  reject('COMBINED_REPORT_ALREADY_EXISTS');
}

async function certify(platform, { privateRoot, candidateFile, originalFile, aab, releaseCommit }) {
  const { manifest, source } = await checkSource(platform,releaseCommit);
  const release = releaseCommit !== undefined;
  const identityFile = join(privateRoot,release ? 'combined-release-identity.json' : 'combined-review-identity.json');
  const reportFile = join(privateRoot,'runtime-stage-identity.json');
  await requireAbsent(identityFile);
  await requireAbsent(reportFile);
  if (release && (!await privatePathVerified(privateRoot,'Directory',{authorizedRoot:privateRoot}) ||
      !await privatePathVerified(originalFile,'File',{authorizedRoot:dirname(originalFile)})))
    reject('COMBINED_RELEASE_PRIVATE_PATH_REJECTED');
  const inputs = await readMaintenanceProviderInputs({
    candidateFile, originalFile,
    verifyPrivateFile: path => privatePathVerified(path,'File',{authorizedRoot:privateRoot})
  });
  if (release) {
    for (const bytes of Object.values(inputs)) {
      const providers = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
      if ([providers.arcgisStaticBasemapApiKey,providers.driveTexas.apiKey].some(value => value.startsWith('SYNTHETIC_')))
        reject('COMBINED_RELEASE_REQUIRES_REAL_INPUTS');
    }
  } else {
    requireSyntheticProviders(inputs);
  }
  const stageArgs = ['tools/native-web.mjs','--arcgis-maintenance-profile',PROFILE,'--runtime-config-file',candidateFile,
    '--original-runtime-config-file',originalFile,'--maintenance-private-root',privateRoot,'--report-file',reportFile];
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
  if (release) {
    await checkSource(platform,releaseCommit);
    if (legacy.candidateGitSha !== releaseCommit || legacy.sourceGitState.trackedDirty) reject('COMBINED_RELEASE_SOURCE_REJECTED');
    const records = [...expected.values()];
    await writeFile(identityFile,JSON.stringify({
      ...legacy, combinedReleaseProfile:profile, scope:'RELEASE', platform,
      files:records, bundleDigest:bundleDigest(records)
    },null,2)+'\n',{flag:'wx',mode:0o600});
    return;
  }
  const combinedPaths = [...sourcePaths,reportName];
  const report = {
    profile, scope:'SYNTHETIC_REVIEW_ONLY', blocked:manifest.blocked, platform, sourceCommit:legacy.candidateGitSha,
    trackedDirty:legacy.sourceGitState.trackedDirty, fallback:manifest.fallback[platform],
    sourceSha256:manifest.sourceSha256, files,
    approvedPayload:combinedPaths.map(path => expected.get(path)),
    androidRetainedOutsideApprovedPayloadAndConfig:platform === 'android' ? files-combinedPaths.length-1 : null,
    bundleDigest: bundleDigest(expected.values())
  };
  await writeFile(identityFile, JSON.stringify(report,null,2)+'\n',
    {flag:'wx',mode:0o600});
}

async function verifyReleaseStage(platform, commit, identityFile) {
  const { manifest } = await checkSource(platform,commit);
  const privateRoot = dirname(identityFile);
  if (identityFile !== join(privateRoot,'combined-release-identity.json') ||
      !await privatePathVerified(privateRoot,'Directory',{authorizedRoot:privateRoot}))
    reject('COMBINED_RELEASE_PRIVATE_PATH_REJECTED');
  const info = await lstat(identityFile);
  if (!info.isFile() || info.nlink !== 1 ||
      (process.platform === 'win32' && !await privatePathVerified(identityFile,'File')) ||
      (process.platform === 'darwin' && (info.uid !== process.getuid() || (info.mode & 0o7777) !== 0o600)))
    reject('COMBINED_RELEASE_PRIVATE_PATH_REJECTED');
  const report = JSON.parse(await readFile(identityFile,'utf8'));
  if (report.schemaVersion !== 'gridly.nativeConfiguredWebBundle.v1' || report.combinedReleaseProfile !== profile ||
      report.scope !== 'RELEASE' || report.platform !== platform || report.candidateGitSha !== commit ||
      report.maintenanceProfile !== PROFILE || report.googleLicenseTest !== false ||
      report.androidProduction !== (platform === 'android') || report.sourceGitState?.trackedDirty !== false ||
      report.sourceGitState?.trackedDiffSha256 !== digest('') || report.files.length !== 1007 ||
      report.bundleDigest !== bundleDigest(report.files))
    reject('COMBINED_RELEASE_IDENTITY_REJECTED');
  const expected = new Map(report.files.map(row => [row.path,row]));
  if (expected.size !== 1007 || expected.get('js/app.js')?.sha256 !== manifest.sourceSha256['js/app.js'] ||
      report.runtimeConfig?.path !== config || expected.get(config)?.sha256 !== report.runtimeConfig.sha256 ||
      expected.get(config)?.bytes !== report.runtimeConfig.bytes)
    reject('COMBINED_RELEASE_IDENTITY_REJECTED');
  const www = join(root,'www');
  await verifyStage(www,expected);
  if (/["']SYNTHETIC_/.test(await readFile(join(www,config),'utf8')))
    reject('COMBINED_RELEASE_REQUIRES_REAL_INPUTS');
}

try {
  const [platform, mode, ...args] = process.argv.slice(2);
  if (!['ios','android'].includes(platform)) reject('COMBINED_ARGUMENTS_INVALID');
  if (mode === '--check-source' && !args.length) {
    await checkSource(platform);
    console.log('COMBINED_SOURCE_VERIFIED');
  } else if (mode === '--check-release-source' && args.length === 1) {
    await checkSource(platform,args[0]);
    console.log('COMBINED_RELEASE_SOURCE_VERIFIED');
  } else if (mode === '--verify-release-stage' && args.length === 2) {
    await verifyReleaseStage(platform,args[0],resolve(args[1]));
    console.log('COMBINED_RELEASE_STAGE_VERIFIED');
  } else if (mode === '--release' && args.length === (platform === 'android' ? 4 : 3)) {
    const [releaseCommit,candidate,original,aab] = args;
    if (args.some(arg => !arg || arg.startsWith('--'))) reject('COMBINED_ARGUMENTS_INVALID');
    const candidateFile = resolve(candidate);
    await certify(platform,{privateRoot:dirname(candidateFile),candidateFile,
      originalFile:resolve(original),aab:aab && resolve(aab),releaseCommit});
    console.log('COMBINED_RELEASE_PAYLOAD_VERIFIED');
  } else {
    if (!mode || mode.startsWith('--') || args.length !== (platform === 'android' ? 1 : 0))
      reject('COMBINED_ARGUMENTS_INVALID');
    const privateRoot = resolve(mode);
    await certify(platform,{privateRoot,candidateFile:join(privateRoot,'native-provider-config.json'),
      originalFile:join(privateRoot,'original-native-provider-config.json'),aab:args[0] && resolve(args[0])});
    console.log('COMBINED_SYNTHETIC_PAYLOAD_VERIFIED');
  }
} catch (error) {
  console.error(/^COMBINED_[A-Z_]+$/.test(error.message) ? error.message : 'COMBINED_OPERATION_REJECTED');
  process.exitCode=1;
}
