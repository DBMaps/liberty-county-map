import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { SOURCE_UNAVAILABLE, assessment, audit, nadWhere, parseArguments, parseFeatureCount, queryArguments, redactDiagnostic, runOgrinfo, txgioWhere, txgioWheres, nadWheres, ROAD_VARIANTS } from '../tools/lp106/audit-authoritative-address-coverage.mjs';

test('arguments are deterministic and reject unknown options', () => {
  const parsed = parseArguments(['--txgio-gdb', 'Texas.gdb', '--nad-archive', 'NAD.zip', '--generated-at', '2026-07-31T00:00:00Z']);
  assert.equal(parsed.txgioGdb, 'Texas.gdb'); assert.equal(parsed.nadArchive, 'NAD.zip');
  assert.throws(() => parseArguments(['--write']), /Unknown option/);
  assert.throws(() => parseArguments(['--generated-at', 'yesterday']), /ISO/);
});

test('source predicates use deterministic bounded native equalities', () => {
  const txgio = txgioWheres(); const nad = nadWheres();
  assert.equal(txgio.length, 28); assert.equal(nad.length, 56);
  assert.deepEqual(txgio, txgioWheres()); assert.deepEqual(nad, nadWheres());
  for (const where of [...txgio, ...nad]) {
    assert.doesNotMatch(where, /(?:TRIM|UPPER|CAST)\s*\(/i);
    assert.match(where, /\("Add_Number" = '274' OR "Add_Number" = 274\)/);
    assert.match(where, /77535/);
  }
  for (const alias of ROAD_VARIANTS) {
    assert.ok(txgio.some(where => where.includes(`"Full_Addr" = '274 ${alias}'`)));
    assert.ok(nad.some(where => where.includes(`"StNam_Full" = '${alias}'`)));
  }
  assert.ok(txgio.every(where => /48291/.test(where) && /"County" = '(?:Liberty|LIBERTY)'/.test(where) && /"Post_Comm" = '(?:Dayton|DAYTON)'/.test(where)));
  assert.ok(nad.every(where => /"State" = '(?:TX|Tx)'/.test(where) && /"County" = '(?:Liberty|LIBERTY)'/.test(where) && /"Post_City" = '(?:Dayton|DAYTON)'/.test(where)));
  const datasource = 'C:\\immutable source files\\Texas 2026.gdb';
  const args = queryArguments(datasource, 'layer', txgioWhere());
  assert.deepEqual(args, ['-ro', '-so', '-where', txgioWhere(), datasource, 'layer']);
  assert.ok(!args.includes('-sql')); assert.ok(!args.includes('-json')); assert.ok(!args.includes('-update'));
});

test('feature counts are parsed without feature rows', () => {
  assert.equal(parseFeatureCount('Layer name: x\nFeature Count: 1,234\n'), 1234);
  assert.equal(parseFeatureCount('Feature Count: 0\n'), 0);
  assert.equal(parseFeatureCount({ stdout: '', stderr: 'Warning 42\nLayer name: x\nFeature Count: 7\n', exitCode: 0, completed: true }), 7);
  assert.throws(() => parseFeatureCount({ stdout: '', stderr: 'Warning: processed 99 features', exitCode: 0, completed: true }), /no parseable/);
  assert.throws(() => parseFeatureCount('no count'), /no parseable/);
});

test('governed query failures provide bounded path-redacted diagnostics', () => {
  const source = 'C:\\Owner Name\\Immutable Sources\\Texas 2026.gdb';
  assert.equal(redactDiagnostic(`ERROR opening ${source}`), 'ERROR opening [WINDOWS SOURCE PATH REDACTED]');
  assert.throws(
    () => parseFeatureCount({ stdout: 'Layer name: addresses\n', stderr: `ERROR opening ${source}`, exitCode: 1, completed: true }),
    error => /executable completed: yes/.test(error.message) && /exit code: 1/.test(error.message) && /stdout length: 22/.test(error.message) && /stderr length:/.test(error.message) && /layer appears opened: yes/.test(error.message) && !error.message.includes(source),
  );
  assert.throws(
    () => parseFeatureCount({ stdout: 'Layer name: addresses\n', stderr: `ERROR 1: Undefined function 'TRIM' used in ${source}`, exitCode: 0, completed: true }),
    error => /no parseable Feature Count/.test(error.message) && /Undefined function 'TRIM'/.test(error.message) && !error.message.includes(source),
  );
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
    runOgrinfo: async (_command, args) => { calls.push(args); return calls.length === txgioWheres().length + 1 ? 'Feature Count: 1\n' : 'Feature Count: 0\n'; },
  });
  assert.equal(report.assessment.status, 'LIVE_QUERY_COMPLETE'); assert.equal(report.assessment.decision, 'AUTHORITATIVE_CANDIDATE_REQUIRES_SOURCE_REVIEW');
  assert.deepEqual(report.sources.map(source => source.exactCandidateCount), [0, 1]);
  assert.deepEqual(report.sources.map(source => source.candidateQueryHits), [0, 1]);
  assert.ok(report.sources.every(source => source.queryCompleted && source.queryFailure === null));
  assert.deepEqual(report.sources.map(source => source.queries.length), [28, 56]);
  assert.ok(report.sources.every(source => source.query.readOnly && !JSON.stringify(source).includes(directory)));
  assert.ok(report.sources.every(source => source.query.featureRowsEmitted === false));
  assert.ok(report.sources.every(source => source.queries.every(query => query.arguments[4] === '[IMMUTABLE SOURCE PATH REDACTED]')));
  assert.ok(calls[28][4].startsWith('/vsizip/'));
});

test('partial bounded-query failure is incomplete evidence with no unique count or absence conclusion', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lp106-partial-')); const txgio = join(directory, 'Texas.gdb'); const reports = join(directory, 'reports');
  await writeFile(txgio, 'synthetic'); let call = 0;
  const report = await audit({ ...parseArguments(['--txgio-gdb', txgio, '--reports', reports]), generatedAt: '2026-07-31T00:00:00Z' }, {
    identity: async () => ({ fileName: 'Texas.gdb', sizeBytes: 1, sha256: 'a'.repeat(64), sourcePathExcludedFromReport: true }),
    runOgrinfo: async () => ++call === 2 ? { stdout: 'Layer name: addresses\n', stderr: "ERROR 1: Undefined function 'UPPER' used.", exitCode: 0, completed: true } : 'Feature Count: 1\n',
  });
  const source = report.sources[0];
  assert.equal(source.queryCompleted, false); assert.equal(source.exactCandidateCount, null); assert.equal(source.uniqueExactCandidateCount, null);
  assert.equal(source.candidateQueryHits, 27); assert.equal(source.queryFailure.count, 1);
  assert.equal(report.assessment.decision, 'NO SOURCE-PRESENCE CONCLUSION PERMITTED'); assert.equal(report.assessment.sourceAbsenceClaimed, false);
  assert.ok(!JSON.stringify(report).includes(directory));
});

test('complete zero counts mean no candidate in snapshots, never generalized source absence', () => {
  const result = assessment([{ queryCompleted: true, exactFound: false }, { queryCompleted: true, exactFound: false }]);
  assert.equal(result.decision, 'NO_EXACT_CANDIDATE_IN_QUERIED_SNAPSHOTS'); assert.equal(result.sourceAbsenceClaimed, false);
});

test('process execution preserves argument boundaries and forbids a shell', async () => {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); let invocation;
  queueMicrotask(() => { child.stdout.end('Feature Count: 0\n'); child.stderr.end(); setImmediate(() => child.emit('close', 0)); });
  const output = await runOgrinfo('ogrinfo', ['-ro', '-so', 'source path', 'layer'], { spawnImpl(command, args, options) { invocation = { command, args, options }; return child; } });
  assert.match(output.stdout, /Feature Count/); assert.equal(output.exitCode, 0); assert.deepEqual(invocation.args, ['-ro', '-so', 'source path', 'layer']); assert.equal(invocation.options.shell, false);
  assert.ok(!invocation.args.includes('-al'));
});

test('process execution retains stderr informational output for governed parsing', async () => {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  queueMicrotask(() => { child.stdout.end(); child.stderr.end('Layer name: x\nFeature Count: 0\n'); setImmediate(() => child.emit('close', 0)); });
  const output = await runOgrinfo('ogrinfo', ['-ro', '-so', 'source', 'layer'], { spawnImpl: () => child });
  assert.equal(output.exitCode, 0); assert.equal(parseFeatureCount(output), 0); assert.match(output.stderr, /Feature Count: 0/);
});
