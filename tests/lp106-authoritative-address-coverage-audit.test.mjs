import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { SOURCE_UNAVAILABLE, assessment, audit, nadWhere, parseArguments, parseFeatureCount, queryArguments, runOgrinfo, txgioWhere } from '../tools/lp106/audit-authoritative-address-coverage.mjs';

test('arguments are deterministic and reject unknown options', () => {
  const parsed = parseArguments(['--txgio-gdb', 'Texas.gdb', '--nad-archive', 'NAD.zip', '--generated-at', '2026-07-31T00:00:00Z']);
  assert.equal(parsed.txgioGdb, 'Texas.gdb'); assert.equal(parsed.nadArchive, 'NAD.zip');
  assert.throws(() => parseArguments(['--write']), /Unknown option/);
  assert.throws(() => parseArguments(['--generated-at', 'yesterday']), /ISO/);
});

test('source predicates are bounded to the governed target and queries are read-only summaries', () => {
  const txgio = txgioWhere(); const nad = nadWhere();
  for (const where of [txgio, nad]) { assert.match(where, /274/); assert.match(where, /677/); assert.match(where, /77535/); }
  assert.match(txgio, /48291/); assert.match(nad, /LIBERTY/);
  const args = queryArguments('source', 'layer', txgio);
  assert.deepEqual(args.slice(1, 4), ['-ro', '-so', '-where']);
  assert.ok(!args.includes('-sql')); assert.ok(!args.includes('-json')); assert.ok(!args.includes('-update'));
});

test('feature counts are parsed without feature rows', () => {
  assert.equal(parseFeatureCount('Layer name: x\nFeature Count: 1,234\n'), 1234);
  assert.throws(() => parseFeatureCount('no count'), /no parseable/);
});

test('missing immutable datasets are unavailable, not absent', async () => {
  const reports = await mkdtemp(join(tmpdir(), 'lp106-unavailable-'));
  const report = await audit({ ...parseArguments([]), reports, generatedAt: '2026-07-31T00:00:00Z' });
  assert.equal(report.assessment.status, SOURCE_UNAVAILABLE);
  assert.equal(report.assessment.decision, 'NO SOURCE-PRESENCE CONCLUSION PERMITTED');
  assert.equal(report.assessment.sourceAbsenceClaimed, false);
  assert.ok(report.sources.every(source => source.status === SOURCE_UNAVAILABLE && source.exactFound === null));
  const saved = JSON.parse(await readFile(join(reports, 'lp106-authoritative-address-coverage-audit.json')));
  assert.deepEqual(saved, report);
});

test('synthetic sources exercise both live queries without requiring TxGIO or NAD', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lp106-live-')); const txgio = join(directory, 'Texas.gdb'); const nad = join(directory, 'NAD_r23.zip'); const reports = join(directory, 'reports');
  await writeFile(txgio, 'synthetic TxGIO identity'); await writeFile(nad, 'synthetic NAD identity');
  const calls = [];
  const report = await audit({ ...parseArguments(['--txgio-gdb', txgio, '--nad-archive', nad, '--reports', reports, '--generated-at', '2026-07-31T00:00:00Z']) }, {
    identity: async path => ({ fileName: path.endsWith('.zip') ? 'NAD_r23.zip' : 'Texas.gdb', sizeBytes: 1, sha256: 'a'.repeat(64), sourcePathExcludedFromReport: true }),
    runOgrinfo: async (_command, args) => { calls.push(args); return calls.length === 1 ? 'Feature Count: 0\n' : 'Feature Count: 1\n'; },
  });
  assert.equal(report.assessment.status, 'LIVE_QUERY_COMPLETE'); assert.equal(report.assessment.decision, 'AUTHORITATIVE_CANDIDATE_REQUIRES_SOURCE_REVIEW');
  assert.deepEqual(report.sources.map(source => source.exactCandidateCount), [0, 1]);
  assert.ok(report.sources.every(source => source.query.readOnly && !JSON.stringify(source).includes(directory)));
  assert.ok(calls[1][0].startsWith('/vsizip/'));
});

test('complete zero counts mean no candidate in snapshots, never generalized source absence', () => {
  const result = assessment([{ liveQueryExecuted: true, exactFound: false }, { liveQueryExecuted: true, exactFound: false }]);
  assert.equal(result.decision, 'NO_EXACT_CANDIDATE_IN_QUERIED_SNAPSHOTS'); assert.equal(result.sourceAbsenceClaimed, false);
});

test('process execution preserves argument boundaries and forbids a shell', async () => {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); let invocation;
  queueMicrotask(() => { child.stdout.end('Feature Count: 0\n'); child.stderr.end(); setImmediate(() => child.emit('close', 0)); });
  const output = await runOgrinfo('ogrinfo', ['source path', '-ro'], { spawnImpl(command, args, options) { invocation = { command, args, options }; return child; } });
  assert.match(output, /Feature Count/); assert.deepEqual(invocation.args, ['source path', '-ro']); assert.equal(invocation.options.shell, false);
});
