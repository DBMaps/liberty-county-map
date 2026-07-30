import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PassThrough } from 'node:stream';
import { discoverOgrinfo, parseArguments, runOgrinfo } from '../tools/lp104/measure-nad-r23.mjs';

const repository = path.resolve(import.meta.dirname, '..');
const tool = 'tools/lp104/measure-nad-r23.mjs';

test('argument parser supports reusable state/county selectors and reproducible timestamps', () => {
  assert.deepEqual(parseArguments(['--archive', 'a.zip', '--reports', 'out', '--state', 'LA', '--county', 'Liberty', '--top', '10', '--generated-at', '2026-07-30T00:00:00Z']), {
    archive: 'a.zip', reports: 'out', geodatabase: 'NAD_r23.gdb', layer: 'NAD', state: 'LA', county: 'Liberty', top: 10, generatedAt: '2026-07-30T00:00:00Z',
  });
  assert.throws(() => parseArguments(['--archive', 'a.zip']), /--reports is required/);
  assert.throws(() => parseArguments(['--archive', 'a.zip', '--reports', 'out', '--top', '0']), /integer/);
});

function fakeChild({ stdout = '', stderr = '', code = 0, signal = null, spawnError } = {}) {
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => {};
  queueMicrotask(() => {
    if (spawnError) child.emit('error', spawnError);
    else {
      child.stdout.end(stdout); child.stderr.end(stderr);
      setImmediate(() => child.emit('close', code, signal));
    }
  });
  return child;
}

test('ogrinfo execution preserves argument boundaries and safe process options', async () => {
  let invocation;
  const args = ['/vsizip/C:/A path/NAD_r23.zip/NAD_r23.gdb', '-ro', '-so', 'NAD'];
  const output = await runOgrinfo('C:\\Program Files\\QGIS\\ogrinfo.exe', args, 'Schema inspection', {
    spawnImpl(executable, actualArgs, options) {
      invocation = { executable, args: actualArgs, options };
      return fakeChild({ stdout: 'schema' });
    },
  });
  assert.equal(output, 'schema');
  assert.deepEqual(invocation.args, args);
  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.options.windowsHide, true);
  assert.equal(invocation.options.detached, false);
  assert.equal(invocation.options.env, process.env);
  assert.deepEqual(invocation.options.stdio, ['ignore', 'pipe', 'pipe']);
});

test('debug mode prints executable and exact argument array', async () => {
  let diagnostic = '';
  const originalWrite = process.stderr.write;
  process.stderr.write = chunk => { diagnostic += chunk; return true; };
  try {
    await runOgrinfo('C:\\Program Files\\QGIS\\ogrinfo.exe', ['source with spaces', '-ro'], 'probe', { debug: true, spawnImpl: () => fakeChild() });
  } finally { process.stderr.write = originalWrite; }
  assert.match(diagnostic, /executable: "C:\\\\Program Files/);
  assert.match(diagnostic, /arguments: \["source with spaces","-ro"\]/);
});

test('nonzero ogrinfo exits report code, signal, stdout, stderr, and invocation', async () => {
  await assert.rejects(runOgrinfo('ogrinfo', ['source', '-ro'], 'probe', { spawnImpl: () => fakeChild({ stdout: 'partial out', stderr: 'GDAL detail', code: null, signal: 'SIGSEGV' }) }), error => {
    assert.match(error.message, /exit code: null/); assert.match(error.message, /signal: SIGSEGV/);
    assert.match(error.message, /partial out/); assert.match(error.message, /GDAL detail/);
    assert.match(error.message, /executable: "ogrinfo"/); assert.match(error.message, /arguments: \["source","-ro"\]/);
    return true;
  });
});

test('ogrinfo spawn errors are distinct from process exits', async () => {
  await assert.rejects(runOgrinfo('ogrinfo', ['-ro'], 'probe', { spawnImpl: () => fakeChild({ spawnError: new Error('ENOENT') }) }), /spawn error: ENOENT[\s\S]*executable/);
});

test('help succeeds without an archive and documents read-only /vsizip/ behavior', () => {
  const result = spawnSync(process.execPath, [tool, '--help'], { cwd: repository, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /never extracts or modifies|never extracted or modified/);
  assert.match(result.stdout, /\/vsizip\//);
  assert.match(result.stdout, /--debug/);
});

test('missing archive fails clearly before GDAL execution', () => {
  const result = spawnSync(process.execPath, [tool, '--archive', path.join(os.tmpdir(), 'definitely-missing-nad.zip'), '--reports', os.tmpdir()], { cwd: repository, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Archive not found/);
});

test('explicit missing GDAL path fails clearly', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lp1043-'));
  const archive = path.join(directory, 'NAD_r23.zip');
  await writeFile(archive, 'fixture only');
  const result = spawnSync(process.execPath, [tool, '--archive', archive, '--reports', path.join(directory, 'reports'), '--gdal', path.join(directory, 'missing-ogrinfo')], { cwd: repository, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GDAL ogrinfo is unavailable/);
});

test('GDAL discovery rejects a configured nonexistent executable', async () => {
  await assert.rejects(discoverOgrinfo(path.join(os.tmpdir(), 'not-an-ogrinfo-executable')), /unavailable/);
});

test('implementation contains no extraction or write-mode GDAL switches', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(path.join(repository, tool), 'utf8');
  assert.match(source, /'OpenFileGDB'/);
  assert.match(source, /'-ro'/);
  assert.doesNotMatch(source, /\b(?:unzip|Expand-Archive|ogr2ogr)\b/);
  assert.doesNotMatch(source, /['"]-(?:update|append|overwrite)['"]/);
  assert.match(source, /const schemaArgs = \[datasource, '-ro', '-so', options\.layer\]/);
  assert.doesNotMatch(source, /schemaArgs[^\n]*(?:-sql|-dialect|-if)/);
});
