import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { consumerRuntimeScriptPaths, nativePackagedScriptPaths, stage } from '../tools/native-web.mjs';

const text = (path) => readFileSync(path, 'utf8');
const index = text('index.html');
const manifest = JSON.parse(text('consumer-script-manifest.json'));
const indexScripts = [...index.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
const pathOf = (source) => source.split(/[?#]/, 1)[0];

const nonconsumerNativeScripts = [
  'js/gridly.local.example.js',
  'js/gridlyAwarenessResolutionTurnCache.js',
  'js/gridlyRouteWatchGeometryShadowScoring.js',
  'js/historical-activation-readiness-revalidation.js',
  'js/historical-archive-persistence.js',
  'js/historical-intelligence-activation-boundary.js',
  'js/historical-intelligence-attachment-controller.js',
  'js/historical-intelligence-presentation.js',
  'js/historical-knowledge-base.js',
  'js/historical-knowledge-retrieval.js',
  'js/historical-learning-orchestration.js',
  'js/historical-learning-quality-governance.js',
  'js/historical-narrative-generator.js',
  'js/historical-narrative-input-assembly.js',
  'js/historical-narrative-invocation-governance.js',
  'js/historical-narrative-output-validation.js',
  'js/historical-narrative-ranking-input-governance.js',
  'js/historical-narrative-ranking-output-governance.js',
  'js/historical-narrative-ranking.js',
  'js/historical-observation-learning.js',
  'js/historical-operational-rollout-plan.js',
  'js/historical-pattern-intelligence.js',
  'js/historical-pattern-lifecycle.js',
  'js/historical-pipeline-certification.js',
  'js/historical-presentation-invocation-governance.js',
  'js/historical-presentation-output-validation.js',
  'js/historical-retrieval-session.js',
  'js/lp1045-txgio-address-runtime.js'
];

test('normal consumer startup exactly matches the governed ordered manifest', () => {
  assert.equal(manifest.schemaVersion, 'gridly.consumerScripts.v1');
  assert.deepEqual(indexScripts, manifest.startupScripts);
  assert.equal(indexScripts.length, 76);
  assert.equal(new Set(indexScripts).size, indexScripts.length);
  assert.equal(manifest.diagnosticScripts.length, 19);
  for (const entry of manifest.diagnosticScripts) {
    assert.equal(indexScripts.includes(entry.src), false, `${entry.src} must be opt-in only`);
    assert.ok(existsSync(pathOf(entry.src)), `${entry.src} must remain available for source-served certification`);
  }
  for (const required of [
    'js/gridlyStartupDiagnostics.js?v=929',
    'js/gridlyLp0361cRuntimeCountyGeometryPackageAudit.js',
    'js/lp24110-poi-search-certification.js?v=24110',
    'js/gridlyLP240WeatherAuthorityAudit.js?v=2401h4',
    'js/gridlyCrossingProviderActivationAudit.js'
  ]) assert.ok(indexScripts.includes(required), `${required} must remain in startup order`);
});

test('opt-in certification loader is inert until called and loads every governed diagnostic in order', async () => {
  const start = index.indexOf('(function installGridlyCertificationDiagnosticLoader');
  const terminator = '})(window);';
  const end = index.indexOf(terminator, start) + terminator.length;
  assert.ok(start >= 0 && end > start);

  let fetchCount = 0;
  const appended = [];
  const context = { console };
  context.window = context;
  context.document = {
    readyState: 'complete',
    createElement: () => ({ dataset: {}, remove() {} }),
    head: {
      appendChild(script) {
        appended.push(script.src);
        const entry = manifest.diagnosticScripts.find((candidate) => candidate.src === script.src);
        for (const name of entry.globals) context[name] = function diagnosticGlobal() {};
        queueMicrotask(() => script.onload());
      }
    }
  };
  context.addEventListener = () => assert.fail('complete document must not register a load listener');
  context.fetch = async (url, options) => {
    fetchCount += 1;
    assert.equal(url, 'consumer-script-manifest.json');
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => manifest };
  };
  vm.createContext(context);
  vm.runInContext(index.slice(start, end), context);
  assert.equal(fetchCount, 0, 'ordinary startup must not fetch or activate diagnostics');
  assert.equal(appended.length, 0);

  const result = await context.gridlyLoadCertificationDiagnostics();
  assert.equal(fetchCount, 1);
  assert.equal(result.count, 19);
  assert.deepEqual(appended, manifest.diagnosticScripts.map((entry) => entry.src));
  for (const entry of manifest.diagnosticScripts) {
    for (const name of entry.globals) assert.equal(typeof context[name], 'function', `${name} must appear after opt-in`);
  }
});

test('diagnostic global contracts are backed by their retained source files', () => {
  for (const entry of manifest.diagnosticScripts) {
    const source = text(pathOf(entry.src));
    for (const name of entry.globals) assert.ok(source.includes(name), `${entry.src} must publish ${name}`);
  }
});

test('native stage contains only governed consumer JavaScript plus exact vendor replacements', async () => {
  const destination = mkdtempSync(join(tmpdir(), 'gridly-lp24430a-native-'));
  try {
    await stage(destination);
    const runtime = consumerRuntimeScriptPaths(manifest).sort();
    const expected = nativePackagedScriptPaths(manifest).sort();
    const staged = expected.filter((path) => existsSync(join(destination, path))).sort();
    assert.deepEqual(staged, expected);
    assert.equal(runtime.length, 76);
    assert.equal(expected.length, 77);
    for (const entry of manifest.diagnosticScripts) {
      assert.equal(existsSync(join(destination, pathOf(entry.src))), entry.nativeOptIn === true, `${entry.src} packaging must match its governed boundary`);
    }
    for (const path of nonconsumerNativeScripts) assert.equal(existsSync(join(destination, path)), false, `${path} must not be packaged`);
    for (const path of manifest.dynamicRuntimeScripts.map(pathOf)) assert.ok(existsSync(join(destination, path)), `${path} must be packaged`);
    for (const path of ['vendor/leaflet/leaflet.js', 'vendor/supabase/supabase.js']) assert.ok(existsSync(join(destination, path)), `${path} must be packaged`);
    for (const path of expected) assert.deepEqual(readFileSync(join(destination, path)), readFileSync(path), `${path} must retain browser source bytes`);
    const nativeIndex = readFileSync(join(destination, 'index.html'), 'utf8');
    assert.match(nativeIndex, /vendor\/leaflet\/leaflet\.js/);
    assert.match(nativeIndex, /vendor\/supabase\/supabase\.js/);
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }
});
