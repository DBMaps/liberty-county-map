#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { expected, protectedSnapshot, preservation, sourceGate, deviceGate, stagedIdentity, projectFiles, contained, redact, json } from './core.mjs';
import { analyzeAttachments } from './analyze.mjs';

const family = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(family, '../..');
const usage = `LP244.54 — installed physical iPhone only
  node tools/lp24454/run.mjs preflight
  node tools/lp24454/run.mjs run --phase onboarding
  node tools/lp24454/run.mjs run --phase journey
  node tools/lp24454/run.mjs capture
  node tools/lp24454/run.mjs relaunch
  node tools/lp24454/run.mjs console
All commands validate the pinned physical device and source before interaction.
onboarding verifies seven pages, Back, Finish and safe-replay Skip; stops before journey.
journey finishes optional setup without selecting Home, then invokes real Around Me.
Only the separate XCTest runner is built/installed; Gridly is never built or installed.
console deliberately relaunches Gridly and captures up to 30 seconds of console output.
No production repair, app reset, reporting, synthetic location, push or merge.`;

const args = process.argv.slice(2), mode = args[0];
if (!mode || ['--help', '-h', 'help'].includes(mode)) { console.log(usage); process.exit(0); }
let phase = 'onboarding';
if (mode === 'run' && args.length === 3 && args[1] === '--phase' && ['onboarding', 'journey'].includes(args[2])) phase = args[2];
else if (!(args.length === 1 && ['preflight', 'run', 'capture', 'relaunch', 'console'].includes(mode))) { console.error(usage); process.exit(2); }
// No pretending to discover Xcode from Windows or a simulator. No output created.
if (process.platform !== 'darwin') { console.error('BLOCKED: LP244.54 physical execution requires the connected Mac. This host is ' + process.platform + '. No device command or production change was performed.'); process.exit(2); }

const base = path.join(root, '.artifacts/iphone-acceptance/lp24454');
fs.mkdirSync(base, { recursive: true, mode: 0o700 });
const out = contained(base, fs.mkdtempSync(path.join(base, new Date().toISOString().replace(/[:.]/g, '-') + '-')));
fs.chmodSync(out, 0o700);
const save = (name, value) => fs.writeFileSync(contained(out, path.join(out, name)), typeof value === 'string' ? value : json(value), { mode: 0o600 });
const git = argv => execFileSync('git', argv, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const before = protectedSnapshot(root, git);
save('protected-before.json', before);
let serial = 0;
const commands = [];
async function command(program, argv, { timeout = 60000, allowedFailure = false, label = program } = {}) {
  const id = String(++serial).padStart(3, '0'), started = new Date().toISOString();
  const result = await new Promise(resolve => {
    const child = spawn(program, argv, { cwd: root, env: process.env, shell: false });
    let text = '', timedOut = false, announced = false;
    const collect = chunk => {
      text += chunk.toString();
      if (text.length > 64 * 1024 * 1024) { text = text.slice(-64 * 1024 * 1024); child.kill('SIGTERM'); }
      if (!announced && text.includes('HUMAN ACTION REQUIRED:')) {
        announced = true;
        console.log('HUMAN ACTION REQUIRED: Check the iPhone for a protected permission/security prompt. For location, choose Allow While Using App only if you consent; note Precise Location. Automation waits up to 180 seconds and never presses permission buttons.');
      }
    };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeout);
    let hardTimer;
    child.on('spawn', () => { hardTimer = setTimeout(() => child.kill('SIGKILL'), timeout + 5000); });
    child.on('error', error => { clearTimeout(timer); clearTimeout(hardTimer); resolve({ code: null, text: text + '\n' + error.message, timedOut }); });
    child.on('close', code => { clearTimeout(timer); clearTimeout(hardTimer); resolve({ code, text, timedOut }); });
  });
  save(`${id}-${label.replace(/[^a-z0-9-]/gi, '-')}.txt`, redact(result.text));
  commands.push({ program, argv, started, finished: new Date().toISOString(), code: result.code, timedOut: result.timedOut });
  save('commands.json', commands);
  if ((result.code !== 0 || result.timedOut) && !allowedFailure) throw Error(`${label} failed (exit ${result.code}, timeout ${result.timedOut}); see local command evidence.`);
  return result;
}

const help = new Map();
async function discover(tokens) {
  const key = tokens.join(' ');
  const result = await command('xcrun', ['devicectl', ...tokens, '--help'], { allowedFailure: true, label: 'help-' + key });
  help.set(key, result.code === 0 ? result.text : '');
  return help.get(key);
}
function requireHelp(tokens, flags = []) {
  const value = help.get(tokens.join(' '));
  if (!value) throw Error('Installed tool does not document ' + tokens.join(' '));
  for (const flag of flags) if (!value.includes(flag)) throw Error('Installed help does not document ' + flag + ' for ' + tokens.join(' '));
}
async function deviceJSON(tokens, name, device = true) {
  requireHelp(tokens, device ? ['--device'] : []);
  if (!help.get('')?.includes('--json-output')) throw Error('devicectl structured JSON output not documented by installed tool');
  const file = contained(out, path.join(out, name + '.json'));
  await command('xcrun', ['devicectl', ...tokens, ...(device ? ['--device', expected.udid] : []), '--json-output', file], { label: name });
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const report = { schema: 'gridly.lp24454.v1', mode, phase: mode === 'run' ? phase : null,
  executionHost: 'Mac', expected, status: 'BLOCKED', physicalAcceptance: 'NOT_CERTIFIED',
  gates: { R1: 'NOT_OBSERVED', R3: 'NOT_OBSERVED', onboardingVisual: 'INCONCLUSIVE — HUMAN VISUAL CONFIRMATION REQUIRED' },
  securityCleanup: 'AFTER ACCEPTANCE: owner must review and tighten the Apple Development private-key Access Control previously set to Allow all applications. This harness never changes Keychain.',
  installedIdentityLimitation: 'Installed bundle ID/version/build is verified; those fields alone cannot prove installed runtime byte identity.',
};

try {
  console.log('Evidence directory: ' + out);
  const errors = sourceGate({ head: before.head, branch: git(['branch', '--show-current']).trim(), changed: git(['diff', '--name-only', 'HEAD']).trim().split(/\r?\n/).filter(Boolean) });
  if (errors.length) throw Error(errors.join('; '));
  const plist = fs.readFileSync(path.join(root, 'ios/App/App/Info.plist'), 'utf8');
  if (!plist.includes('NSLocationWhenInUseUsageDescription') || /NSLocationAlways|UIBackgroundModes|NSAllowsArbitraryLoads/.test(plist)) throw Error('Foreground-only location/ATS preflight differs from protected contract');
  const nativeProject = fs.readFileSync(path.join(root, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const floors = [...nativeProject.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g)].map(m => m[1]);
  if (floors.length !== 4 || floors.some(v => v !== '16.4')) throw Error('Four iOS deployment floors at 16.4 not proven');
  if (!fs.readFileSync(path.join(root, 'ios/App/CapApp-SPM/Package.swift'), 'utf8').includes('.iOS("16.4")')) throw Error('SPM iOS 16.4 floor not proven');
  if (JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8')).appId !== expected.bundle) throw Error('Capacitor bundle ID differs');
  if (/com.apple.product-type.bundle.ui-testing/.test(nativeProject)) throw Error('An existing UI-test target now exists. Review and prefer it before creating the separate runner.');
  save('native-local-diff.txt', git(['diff', 'HEAD', '--', 'ios/App/App.xcodeproj/project.pbxproj', 'ios/App/App/Info.plist', 'ios/App/App/Assets.xcassets/Splash.imageset/Contents.json']));
  const xcode = await command('xcodebuild', ['-version'], { label: 'xcode-version' });
  if (!/^Xcode 27\.0\s*\r?\nBuild version 27A266a/m.test(xcode.text.trim())) throw Error('Installed Xcode version differs from supplied 27.0 / 27A266a baseline; review discovery before interaction');
  await command('xcrun', ['--help'], { label: 'xcrun-help' });
  for (const tokens of [[], ['list', 'devices'], ['device'], ['device', 'info'], ['device', 'info', 'details'], ['device', 'info', 'apps'], ['device', 'info', 'processes'], ['device', 'process'], ['device', 'process', 'launch'], ['device', 'process', 'terminate'], ['device', 'capture'], ['device', 'capture', 'screenshot']]) await discover(tokens);
  // Inspect advertised public subcommand help only. A HID capability string is
  // never converted into a guessed command or private CoreDevice call.
  save('hid-discovery.json', { advertisedHelpLines: [...help].flatMap(([name, value]) => value.split(/\r?\n/).filter(l => /\b(hid|input|keyboard|digitizer|scroll)\b/i.test(l)).map(line => ({ name, line }))), selectedBackend: 'public XCTest semantic accessibility', privateAPIs: false });
  const project = path.join(root, 'ios/App/App.xcodeproj');
  await command('xcodebuild', ['-list', '-json', '-project', project, '-disableAutomaticPackageResolution'], { label: 'existing-targets', timeout: 120000 });
  const destinations = await command('xcodebuild', ['-showdestinations', '-project', project, '-scheme', 'App', '-disableAutomaticPackageResolution'], { label: 'destinations', timeout: 120000 });
  const devices = await deviceJSON(['list', 'devices'], 'devices', false);
  const details = await deviceJSON(['device', 'info', 'details'], 'device-details');
  const apps = await deviceJSON(['device', 'info', 'apps'], 'installed-apps');
  report.preflight = deviceGate(devices, details, apps, destinations.text);
  report.stagedIdentity = stagedIdentity(root);
  save('preflight.json', report);
  if (report.preflight.status !== 'PASS') throw Error(report.preflight.errors.join('; '));
  if (report.stagedIdentity.status !== 'PASS') throw Error('Critical staged/synced file identity is unavailable or differs; no interaction. Inspect saved evidence, do not restage automatically.');
  if (help.get('device info processes')) await deviceJSON(['device', 'info', 'processes'], 'processes-before');
  const integrity = preservation(before, protectedSnapshot(root, git));
  if (integrity.status !== 'PASS') throw Error('Discovery changed protected state; stop without restoring: ' + integrity.changed.join(', '));
  report.status = 'PREFLIGHT_PASS';

  if (['capture', 'relaunch', 'console'].includes(mode)) {
    if (mode !== 'capture') {
      const tokens = ['device', 'process', 'launch'];
      requireHelp(tokens, ['--device', '--terminate-existing', ...(mode === 'console' ? ['--console'] : [])]);
      const result = await command('xcrun', ['devicectl', ...tokens, '--device', expected.udid, '--terminate-existing', ...(mode === 'console' ? ['--console'] : []), expected.bundle], { label: mode, timeout: mode === 'console' ? 30000 : 60000, allowedFailure: mode === 'console' });
      report.console = mode === 'console' ? { boundedSeconds: 30, code: result.code, timedOut: result.timedOut, limitation: 'A bounded attached launch console is not complete WKWebView network/JS tracing. Missing output is not proof of success.' } : null;
    }
    const tokens = ['device', 'capture', 'screenshot'];
    requireHelp(tokens, ['--device']);
    const docs = help.get(tokens.join(' '));
    const flag = /--output-path\b/.test(docs) ? '--output-path' : /--output\b/.test(docs) ? '--output' : null;
    if (!flag) throw Error('Screenshot destination syntax not recognized in installed help. Preserve help and adapt harness; no guessed argument.');
    await command('xcrun', ['devicectl', ...tokens, '--device', expected.udid, flag, path.join(out, 'physical-screen.png')], { label: 'screenshot' });
    report.status = 'CAPTURED';
  }

  if (mode === 'run') {
    const generated = contained(out, path.join(out, 'runner'));
    fs.mkdirSync(path.join(generated, 'GridlyAcceptance.xcodeproj/xcshareddata/xcschemes'), { recursive: true });
    const files = projectFiles();
    fs.writeFileSync(path.join(generated, 'GridlyAcceptance.xcodeproj/project.pbxproj'), files.project);
    fs.writeFileSync(path.join(generated, 'GridlyAcceptance.xcodeproj/xcshareddata/xcschemes/GridlyAcceptance.xcscheme'), files.scheme);
    fs.copyFileSync(path.join(family, 'GridlyAcceptance.swift'), path.join(generated, 'GridlyAcceptance.swift'));
    const selection = `GridlyAcceptance/GridlyAcceptance/${phase === 'journey' ? 'testPhysicalJourney' : 'testOnboardingCapture'}`;
    const common = ['-project', path.join(generated, 'GridlyAcceptance.xcodeproj'), '-scheme', 'GridlyAcceptance', '-configuration', 'Debug', '-destination', 'platform=iOS,id=' + expected.udid, '-derivedDataPath', path.join(out, 'DerivedData'), '-parallel-testing-enabled', 'NO', '-maximum-concurrent-test-device-destinations', '1', '-allowProvisioningUpdates'];
    console.log('Building only the separate acceptance runner. If macOS requests signing-key access, handle that protected prompt; do not broaden Keychain permissions.');
    await command('xcodebuild', ['build-for-testing', ...common], { label: 'runner-build', timeout: 600000 });
    // Revalidate device and installed app immediately before input automation.
    const fresh = deviceGate(await deviceJSON(['list', 'devices'], 'devices-before-input', false), await deviceJSON(['device', 'info', 'details'], 'details-before-input'), await deviceJSON(['device', 'info', 'apps'], 'apps-before-input'), destinations.text);
    if (fresh.status !== 'PASS') throw Error(fresh.errors.join('; '));
    if (preservation(before, protectedSnapshot(root, git)).status !== 'PASS') throw Error('Protected state changed before input; stop without restoring');
    const resultPath = path.join(out, 'physical.xcresult');
    const run = await command('xcodebuild', ['test-without-building', ...common, '-only-testing:' + selection, '-resultBundlePath', resultPath], { label: 'physical-test', timeout: 900000, allowedFailure: true });
    report.testProcess = { code: run.code, timedOut: run.timedOut, resultPath, selectedTest: selection };
    report.status = run.code === 0 && !run.timedOut ? 'UI_RUN_COMPLETED_REVIEW_REQUIRED' : 'UI_RUN_FAILED_OR_BLOCKED';
    if (fs.existsSync(resultPath)) {
      const h = await command('xcrun', ['xcresulttool', 'export', 'attachments', '--help'], { allowedFailure: true, label: 'xcresult-attachments-help' });
      if (h.code === 0 && h.text.includes('--path') && h.text.includes('--output-path')) {
        await command('xcrun', ['xcresulttool', 'export', 'attachments', '--path', resultPath, '--output-path', path.join(out, 'attachments')], { allowedFailure: true, label: 'export-attachments' });
      }
      const summary = await command('xcrun', ['xcresulttool', 'get', 'test-results', 'summary', '--help'], { allowedFailure: true, label: 'xcresult-summary-help' });
      if (summary.code === 0 && summary.text.includes('--path')) await command('xcrun', ['xcresulttool', 'get', 'test-results', 'summary', '--path', resultPath], { allowedFailure: true, label: 'test-summary' });
    }
    report.analysis = analyzeAttachments(path.join(out, 'attachments'));
    save('analysis.json', report.analysis);
    if (phase === 'onboarding' && report.analysis.status !== 'EVIDENCE_EXTRACTED') report.status = 'UI_RUN_FAILED_OR_BLOCKED';
    report.visual = report.analysis.visual;
    report.gates.R1 = phase === 'journey' ? 'INCONCLUSIVE — inspect physical observations and available console; exact GPS/permission/Home bytes not observable by XCTest' : 'NOT_RUN — onboarding-only phase';
    report.gates.R3 = 'INCONCLUSIVE — XCTest screen evidence does not prove WKWebView request origin or provider internals';
  }
} catch (error) {
  report.error = redact(error.message);
  report.status = 'BLOCKED_OR_FAILED';
  process.exitCode = 2;
} finally {
  const after = protectedSnapshot(root, git);
  save('protected-after.json', after);
  report.preservation = preservation(before, after);
  if (report.preservation.status !== 'PASS') { report.status = 'PROTECTED_STATE_CHANGED'; process.exitCode = 2; }
  save('report.json', report);
  save('REPORT.md', `# LP244.54 physical iPhone evidence\n\nStatus: **${report.status}**. Physical acceptance: **${report.physicalAcceptance}**.\n\n${report.error || 'See command logs, snapshots, XCTest attachments and report.json.'}\n\nR1: ${report.gates.R1}\n\nR3: ${report.gates.R3}\n\nOnboarding visual: ${report.gates.onboardingVisual}\n\nProtected state: ${report.preservation.status}. No automatic restore was attempted.\n\n${report.securityCleanup}\n`);
  console.log(`${report.status}: ${report.error || 'Evidence saved; inspect report.json and physical.xcresult.'}`);
  console.log('Physical acceptance is NOT_CERTIFIED by command completion. Evidence: ' + out);
  if (mode === 'run' && report.status === 'UI_RUN_FAILED_OR_BLOCKED') process.exitCode = 2;
}
