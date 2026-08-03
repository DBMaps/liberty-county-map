import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { SOURCE_UNAVAILABLE, REQUIRED_FIELDS, assessment, audit, nadWhere, parseArguments, parseFeatureCount, parseLayerEnumeration, parseSchema, parseSchemaInventory, resolveFieldMapping, schemaCompleteness, selectNadLayer, queryArguments, redactDiagnostic, runOgrinfo, schemaArguments, txgioWhere, txgioWheres, nadWheres, ROAD_VARIANTS } from '../tools/lp106/audit-authoritative-address-coverage.mjs';

const txgioSchema = `INFO: Open of x using driver OpenFileGDB successful.\nLayer name: stratmap_2026_address_points_48\nGeometry: Point\nFIPS: Integer (5.0)\nAdd_Number: String (20.0)\nFull_Addr: String (100.0)\nPost_Comm: String (40.0)\nPost_Code: Integer64 (0.0)\n`;
const nadSchema = `INFO: Open of x using driver OpenFileGDB successful.\nLayer name: NAD\nGeometry: Point\nState: String (2.0)\nCounty: String (40.0)\nAdd_Number: Real (0.0)\nStNam_Full: String (100.0)\nPost_City: String (40.0)\nZip_Code: String (10.0)\n`;

test('arguments are deterministic and reject unknown options', () => {
  const parsed = parseArguments(['--txgio-gdb', 'Texas.gdb', '--nad-archive', 'NAD.zip', '--generated-at', '2026-07-31T00:00:00Z']);
  assert.equal(parsed.txgioGdb, 'Texas.gdb'); assert.equal(parsed.nadArchive, 'NAD.zip');
  assert.throws(() => parseArguments(['--write']), /Unknown option/);
  assert.throws(() => parseArguments(['--generated-at', 'yesterday']), /ISO/);
});

test('source predicates use deterministic bounded native equalities', () => {
  const txFields = parseSchema(txgioSchema, REQUIRED_FIELDS.txgio); const nadFields = parseSchema(nadSchema, REQUIRED_FIELDS.nad);
  const txgio = txgioWheres(undefined, txFields); const nad = nadWheres(undefined, nadFields);
  assert.equal(txgio.length, 14); assert.equal(nad.length, 56);
  for (const where of [...txgio, ...nad]) {
    assert.doesNotMatch(where, /(?:TRIM|UPPER|CAST)\s*\(/i);
    assert.doesNotMatch(where, /"Add_Number"\s*=\s*'274'\s+OR/i);
    assert.match(where, /77535/);
  }
  assert.ok(txgio.every(where => where.includes(`"Add_Number" = '274'`) && where.includes(`"Post_Code" = 77535`)));
  assert.ok(nad.every(where => where.includes(`"Add_Number" = 274`) && where.includes(`"Zip_Code" = '77535'`)));
  for (const alias of ROAD_VARIANTS) {
    assert.ok(txgio.some(where => where.includes(`"Full_Addr" = '274 ${alias}'`)));
    assert.ok(nad.some(where => where.includes(`"StNam_Full" = '${alias}'`)));
  }
  assert.ok(txgio.every(where => /"FIPS" = 48291/.test(where) && /"Post_Comm" = '(?:Dayton|DAYTON)'/.test(where)));
  assert.ok(nad.every(where => /"State" = '(?:TX|Tx)'/.test(where) && /"County" = '(?:Liberty|LIBERTY)'/.test(where) && /"Post_City" = '(?:Dayton|DAYTON)'/.test(where)));
  const datasource = 'C:\\immutable source files\\Texas 2026.gdb';
  const args = queryArguments(datasource, 'layer', txgioWhere(undefined, txFields));
  assert.deepEqual(args, ['-ro', '-so', '-where', txgioWhere(undefined, txFields), datasource, 'layer']);
  assert.ok(!args.includes('-sql')); assert.ok(!args.includes('-json')); assert.ok(!args.includes('-update'));
});

test('schema parser classifies GDAL field types and reports missing or unsupported fields', () => {
  const fields = parseSchema(`Layer name: x\nText: String (20.0)\nI: Integer (0.0)\nBig: Integer64 (0.0)\nAmount: Real (12.3)\nBlob: Binary (0.0)\n`, ['Text', 'I', 'Big', 'Amount', 'Blob', 'Gone']);
  assert.deepEqual(fields.map(field => field.normalizedType), ['string', 'integer', 'integer64', 'real', 'unsupported', null]);
  assert.equal(fields[4].supported, false); assert.equal(fields[5].found, false);
  assert.deepEqual(schemaArguments('source', 'layer'), ['-ro', '-so', 'source', 'layer']);
});

test('NAD schema inventory preserves order, source types, normalized types, and nullability', () => {
  const inventory = parseSchemaInventory('Layer name: NAD\nOBJECTID: Integer64 (0.0) NOT NULL\nSTATE_ABBR: String (2.0)\nADD_NUMBER: Real (10.2) NULLABLE\n');
  assert.deepEqual(inventory, [
    { originalName: 'OBJECTID', originalType: 'Integer64', normalizedType: 'integer64', index: 0, nullable: false },
    { originalName: 'STATE_ABBR', originalType: 'String', normalizedType: 'string', index: 1, nullable: null },
    { originalName: 'ADD_NUMBER', originalType: 'Real', normalizedType: 'real', index: 2, nullable: true },
  ]);
});

test('NAD layer enumeration preserves exact names and geometry annotations', () => {
  assert.deepEqual(parseLayerEnumeration("INFO: Open of x using driver `OpenFileGDB' successful.\n1: Metadata table\n2: NAD (3D Point)\n3: Address History (Point)\n"), [
    { layerIndex: 1, layerName: 'Metadata table', geometryType: null },
    { layerIndex: 2, layerName: 'NAD', geometryType: '3D Point' },
    { layerIndex: 3, layerName: 'Address History', geometryType: 'Point' },
  ]);
});

test('NAD layer enumeration supports the live OpenFileGDB labelled format', () => {
  const live = "INFO: Open of `/vsizip/.../NAD_r23.gdb'\n      using driver `OpenFileGDB' successful.\nLayer: NAD (3D Point)\n";
  assert.deepEqual(parseLayerEnumeration(live), [
    { layerIndex: 0, layerName: 'NAD', geometryType: '3D Point' },
  ]);
  assert.deepEqual(parseLayerEnumeration('Layer: NAME\nLayer: NAME (Point)\nLayer: NAME (3D Point)\nLayer: NAME (Multi Point)\nLayer: Address History 2026\n'), [
    { layerIndex: 0, layerName: 'NAME', geometryType: null },
    { layerIndex: 1, layerName: 'NAME', geometryType: 'Point' },
    { layerIndex: 2, layerName: 'NAME', geometryType: '3D Point' },
    { layerIndex: 3, layerName: 'NAME', geometryType: 'Multi Point' },
    { layerIndex: 4, layerName: 'Address History 2026', geometryType: null },
  ]);
});

test('schema parsing continues beyond blank lines and GDAL metadata sections', () => {
  const output = `Layer name: NAD\nGeometry: 3D Point\nBuilding: String (100.0)\nFloor: String (20.0)\nUnit: String (20.0)\nRoom: String (20.0)\nSeat: String (20.0)\n\nMetadata:\n  DESCRIPTION=National Address Database\nField domains:\nState: String (2.0)\nCounty: String (50.0)\nAdd_Number: String (20.0)\nStNam_Full: String (100.0)\nPost_City: String (50.0)\nZip_Code: String (5.0)\n`;
  const inventory = parseSchemaInventory(output); const mapping = resolveFieldMapping(inventory); const completeness = schemaCompleteness(output, inventory, mapping);
  assert.equal(inventory.length, 11); assert.equal(completeness.firstFieldName, 'Building'); assert.equal(completeness.lastFieldName, 'Zip_Code');
  assert.equal(completeness.parserTerminationReason, 'end-of-output'); assert.deepEqual(completeness.requiredConceptsMissing, []);
});

test('NAD selection fails closed for zero or multiple eligible layers and accepts one or valid explicit layer', () => {
  const eligible = name => ({ layerName: name, schemaInspectionCompleted: true, schemaOutputCompleted: true, requiredConceptsMissing: [] });
  const rejected = { layerName: 'Buildings', schemaInspectionCompleted: true, schemaOutputCompleted: true, requiredConceptsMissing: ['State'] };
  assert.match(selectNadLayer([rejected]).failure, /No eligible/);
  assert.equal(selectNadLayer([rejected, eligible('NAD')]).selectedLayer.layerName, 'NAD');
  assert.match(selectNadLayer([eligible('NAD'), eligible('History')]).failure, /Ambiguous/);
  assert.equal(selectNadLayer([rejected, eligible('NAD')], 'NAD').selectionMode, 'explicit');
  assert.match(selectNadLayer([eligible('NAD')], 'Missing').failure, /does not exist/);
  assert.match(selectNadLayer([rejected], 'Buildings').failure, /ineligible/);
});

test('NAD aliases map discovered fields and select deterministically by declared priority', () => {
  const inventory = parseSchemaInventory('Layer name: NAD\nSTATE_ABBR: String\nCOUNTYNAME: String\nADD_NUMBER: String\nStreet: String\nCity: String\nPost_Code: String\nZipCode: String\n');
  const mapping = resolveFieldMapping(inventory);
  assert.deepEqual(mapping.map(field => [field.requiredField, field.fieldName]), [['State', 'STATE_ABBR'], ['County', 'COUNTYNAME'], ['Add_Number', 'ADD_NUMBER'], ['StNam_Full', 'Street'], ['Post_City', 'City'], ['Zip_Code', 'ZipCode']]);
  assert.match(nadWhere(undefined, mapping), /"STATE_ABBR" = 'TX'.*"COUNTYNAME" = 'Liberty'.*"ADD_NUMBER" = '274'.*"Street" = 'County Road 677'.*"City" = 'Dayton'.*"ZipCode" = '77535'/);
});

test('NAD mapping rejects missing, duplicate, and unsupported mandatory fields', () => {
  assert.throws(() => resolveFieldMapping([]), /Required field missing: State/);
  const duplicate = [{ originalName: 'State', originalType: 'String', normalizedType: 'string', index: 0 }, { originalName: 'STATE', originalType: 'String', normalizedType: 'string', index: 1 }];
  assert.throws(() => resolveFieldMapping(duplicate), /Duplicate candidate field/);
  const unsupported = parseSchemaInventory('Layer name: NAD\nState: Binary\nCounty: String\nAdd_Number: String\nStNam_Full: String\nPost_City: String\nZip_Code: String\n');
  assert.throws(() => resolveFieldMapping(unsupported), /Unsupported schema field: State/);
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
    runOgrinfo: async (_command, args) => { calls.push(args); if (!args.includes('-where')) { if (args.length === 3 && args.at(-1).startsWith('/vsizip/')) return "INFO: Open of `/vsizip/.../NAD_r23.gdb'\n      using driver `OpenFileGDB' successful.\nLayer: NAD (3D Point)\n"; return args.at(-1) === 'NAD' ? nadSchema : txgioSchema; } const where = args[3]; return args.at(-1) === 'NAD' && where.includes(`"State" = 'TX'`) && where.includes(`"County" = 'Liberty'`) && where.includes(`"StNam_Full" = 'County Road 677'`) && where.includes(`"Post_City" = 'Dayton'`) ? 'Feature Count: 1\n' : 'Feature Count: 0\n'; },
  });
  assert.equal(report.assessment.status, 'LIVE_QUERY_COMPLETE'); assert.equal(report.assessment.decision, 'AUTHORITATIVE_CANDIDATE_REQUIRES_SOURCE_REVIEW');
  assert.deepEqual(report.sources.map(source => source.exactCandidateCount), [0, 1]);
  assert.deepEqual(report.sources.map(source => source.candidateQueryHits), [0, 1]);
  assert.ok(report.sources.every(source => source.queryCompleted && source.queryFailure === null));
  assert.deepEqual(report.sources.map(source => source.queries.length), [14, 56]);
  assert.ok(report.sources.every(source => source.query.readOnly && !JSON.stringify(source).includes(directory)));
  assert.ok(report.sources.every(source => source.query.featureRowsEmitted === false));
  assert.ok(report.sources.every(source => source.queries.every(query => query.arguments[4] === '[IMMUTABLE SOURCE PATH REDACTED]')));
  assert.ok(calls.some(args => args[2]?.startsWith('/vsizip/')));
  const inventory = JSON.parse(await readFile(join(reports, 'nad-schema.json')));
  assert.deepEqual(inventory.mapping.map(field => field.actualField), ['State', 'County', 'Add_Number', 'StNam_Full', 'Post_City', 'Zip_Code']);
  assert.ok(inventory.fields.every((field, index) => field.index === index));
  const layers = JSON.parse(await readFile(join(reports, 'nad-layer-inventory.json')));
  assert.equal(layers.discoveredLayerCount, 1); assert.equal(layers.eligibleLayerCount, 1); assert.equal(layers.selectedLayer, 'NAD');
  assert.equal(layers.layerListCompleted, true); assert.equal(inventory.selectionSucceeded, true);
  assert.equal(layers.layers[0].layerIndex, 0); assert.equal(layers.layers[0].geometryType, '3D Point'); assert.equal(layers.layers[0].lastFieldName, 'Zip_Code');
  assert.doesNotMatch(JSON.stringify(layers), new RegExp(directory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('failed NAD selection atomically replaces a stale successful schema report', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lp106-stale-schema-')); const nad = join(directory, 'NAD_r23.zip'); const reports = join(directory, 'reports');
  await writeFile(nad, 'synthetic NAD identity');
  await mkdir(reports, { recursive: true });
  await writeFile(join(reports, 'nad-schema.json'), JSON.stringify({ selectionSucceeded: true, selectedLayer: 'STALE', fields: [{ originalName: 'stale' }] }));
  const report = await audit({ ...parseArguments(['--nad-archive', nad, '--reports', reports]), generatedAt: '2026-07-31T00:00:00Z' }, {
    identity: async () => ({ fileName: 'NAD_r23.zip', sizeBytes: 1, sha256: 'a'.repeat(64), sourcePathExcludedFromReport: true }),
    runOgrinfo: async (_command, args) => args.length === 3 ? 'Layer: NAD (3D Point)\n' : 'Layer name: NAD\nUnrelated: String\n',
  });
  const schema = JSON.parse(await readFile(join(reports, 'nad-schema.json'))); const layers = JSON.parse(await readFile(join(reports, 'nad-layer-inventory.json')));
  assert.equal(schema.selectionSucceeded, false); assert.equal(schema.selectedLayer, null); assert.deepEqual(schema.fields, []);
  assert.equal(layers.layerListCompleted, true); assert.equal(layers.discoveredLayerCount, 1); assert.equal(layers.layers[0].layerName, 'NAD');
  assert.equal(report.assessment.decision, 'NO SOURCE-PRESENCE CONCLUSION PERMITTED'); assert.equal(report.assessment.sourceAbsenceClaimed, false);
});

test('partial bounded-query failure is incomplete evidence with no unique count or absence conclusion', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lp106-partial-')); const txgio = join(directory, 'Texas.gdb'); const reports = join(directory, 'reports');
  await writeFile(txgio, 'synthetic'); let call = 0;
  const report = await audit({ ...parseArguments(['--txgio-gdb', txgio, '--reports', reports]), generatedAt: '2026-07-31T00:00:00Z' }, {
    identity: async () => ({ fileName: 'Texas.gdb', sizeBytes: 1, sha256: 'a'.repeat(64), sourcePathExcludedFromReport: true }),
    runOgrinfo: async (_command, args) => { if (!args.includes('-where')) return txgioSchema; return ++call === 2 ? { stdout: 'Layer name: addresses\n', stderr: "ERROR 1: typed query failed.", exitCode: 0, completed: true } : 'Feature Count: 1\n'; },
  });
  const source = report.sources[0];
  assert.equal(source.queryCompleted, false); assert.equal(source.exactCandidateCount, null); assert.equal(source.uniqueExactCandidateCount, null);
  assert.equal(source.candidateQueryHits, 13); assert.equal(source.queryFailure.count, 1);
  assert.equal(report.assessment.decision, 'NO SOURCE-PRESENCE CONCLUSION PERMITTED'); assert.equal(report.assessment.sourceAbsenceClaimed, false);
  assert.ok(!JSON.stringify(report).includes(directory));
});

test('schema failure prevents live predicates and remains incomplete evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lp106-schema-failure-')); const txgio = join(directory, 'Texas.gdb'); const reports = join(directory, 'reports');
  await writeFile(txgio, 'synthetic'); let calls = 0;
  const report = await audit({ ...parseArguments(['--txgio-gdb', txgio, '--reports', reports]), generatedAt: '2026-07-31T00:00:00Z' }, {
    identity: async () => ({ fileName: 'Texas.gdb', sizeBytes: 1, sha256: 'a'.repeat(64), sourcePathExcludedFromReport: true }),
    runOgrinfo: async () => { calls += 1; return { stdout: '', stderr: `ERROR opening C:\\private\\Texas.gdb`, exitCode: 1, completed: true }; },
  });
  const source = report.sources[0];
  assert.equal(calls, 1); assert.equal(source.schemaQueryAttempted, true); assert.equal(source.schemaQueryCompleted, false);
  assert.equal(source.liveQueryExecuted, false); assert.equal(source.exactCandidateCount, null); assert.equal(source.exactFound, null);
  assert.equal(report.assessment.decision, 'NO SOURCE-PRESENCE CONCLUSION PERMITTED'); assert.equal(report.assessment.sourceAbsenceClaimed, false);
  assert.doesNotMatch(JSON.stringify(report), /private/);
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
