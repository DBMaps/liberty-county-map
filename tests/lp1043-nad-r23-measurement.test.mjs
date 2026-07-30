import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { discoverOgrinfo, parseArguments } from '../tools/lp104/measure-nad-r23.mjs';

const repository = path.resolve(import.meta.dirname, '..');
const tool = 'tools/lp104/measure-nad-r23.mjs';

test('argument parser supports reusable state/county selectors and reproducible timestamps', () => {
  assert.deepEqual(parseArguments(['--archive', 'a.zip', '--reports', 'out', '--state', 'LA', '--county', 'Liberty', '--top', '10', '--generated-at', '2026-07-30T00:00:00Z']), {
    archive: 'a.zip', reports: 'out', geodatabase: 'NAD_r23.gdb', layer: 'NAD', state: 'LA', county: 'Liberty', top: 10, generatedAt: '2026-07-30T00:00:00Z',
  });
  assert.throws(() => parseArguments(['--archive', 'a.zip']), /--reports is required/);
  assert.throws(() => parseArguments(['--archive', 'a.zip', '--reports', 'out', '--top', '0']), /integer/);
});

test('help succeeds without an archive and documents read-only /vsizip/ behavior', () => {
  const result = spawnSync(process.execPath, [tool, '--help'], { cwd: repository, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /never extracts or modifies|never extracted or modified/);
  assert.match(result.stdout, /\/vsizip\//);
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
});
