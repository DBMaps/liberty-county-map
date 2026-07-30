import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { explore, parseArguments, prepareQuery, queryArguments } from '../tools/lp104/explore-nad-r23.mjs';

const fields = ['Add_Number', 'StNam_Full', 'State', 'County', 'Post_City', 'Zip_Code', 'Uninc_Comm', 'Placement', 'AddAuth', 'NAD_Source'];
const schema = `INFO: Open of fixture\nLayer name: AddPoints\nGeometry: Point\n${fields.map(name => `${name}: String (80.0)`).join('\n')}\n`;

test('arguments combine native filters, select fields, and a hard result limit', () => {
  const options = parseArguments(['fixture.gdb', '--limit', '20', '--state', 'TX', '--county', "O'Brien", '--contains', 'COUNTY', '--fields', 'Add_Number,StNam_Full']);
  const query = prepareQuery(options, fields);
  assert.equal(query.where, `"State" = 'TX' AND "County" = 'O''Brien' AND "StNam_Full" LIKE '%COUNTY%'`);
  assert.deepEqual(queryArguments('fixture.gdb', 'AddPoints', query, 20), [
    'fixture.gdb', '-ro', '-q', '-json', '-geom=NO', '-fields=YES', '-limit', '20', '-dialect', 'OGRSQL', '-sql',
    `SELECT "Add_Number", "StNam_Full" FROM "AddPoints" WHERE ${query.where}`,
  ]);
  assert.doesNotMatch(query.where, /GROUP BY|COUNT\s*\(/i);
});

test('special rural-data predicates can be combined', () => {
  const options = parseArguments(['fixture.gdb', '--uninc-populated', '--missing-zip', '--missing-house-number']);
  const { where } = prepareQuery(options, fields);
  assert.match(where, /"Uninc_Comm" IS NOT NULL/);
  assert.match(where, /"Zip_Code" IS NULL/);
  assert.match(where, /"Add_Number" IS NULL/);
});

test('invalid fields and unsafe limits fail with useful messages', () => {
  assert.throws(() => prepareQuery({ fields: ['NotAField'], filters: {} }, fields), /Invalid or unavailable NAD field: NotAField.*Available fields/);
  assert.throws(() => parseArguments(['fixture.gdb', '--limit', '0']), /1 through 1000/);
});

test('no matches are graceful and still export valid empty CSV and JSON', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lp1044-'));
  const gdb = path.join(root, 'extracted', 'NAD_r23.gdb'); const reports = path.join(root, 'reports');
  await mkdir(gdb, { recursive: true });
  const calls = [];
  const result = await explore({ gdb, reports, name: 'empty', layer: 'AddPoints', limit: 20, fields: ['Add_Number', 'StNam_Full'], filters: { county: 'Nowhere' } }, {
    discoverOgrinfo: async () => 'ogrinfo',
    run: async (_command, args) => { calls.push(args); return calls.length === 1 ? schema : JSON.stringify({ type: 'FeatureCollection', features: [] }); },
  });
  assert.deepEqual(result.rows, []);
  assert.equal(await readFile(result.jsonPath, 'utf8'), '[]\n');
  assert.equal(await readFile(result.csvPath, 'utf8'), 'Add_Number,StNam_Full\r\n');
  assert.ok(calls[1].includes('-limit'));
});

test('matching records retain only requested properties in both exports', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lp1044-row-')); const gdb = path.join(root, 'NAD_r23.gdb');
  await mkdir(gdb);
  let call = 0;
  const result = await explore({ gdb, reports: path.join(root, 'reports'), name: 'rows', layer: 'AddPoints', limit: 1, fields: ['Add_Number', 'StNam_Full'], filters: {} }, {
    discoverOgrinfo: async () => 'ogrinfo',
    run: async () => (++call === 1 ? schema : JSON.stringify({ features: [{ properties: { Add_Number: '274', StNam_Full: 'COUNTY ROAD 677', Secret: 'omit' } }] })),
  });
  assert.deepEqual(result.rows, [{ Add_Number: '274', StNam_Full: 'COUNTY ROAD 677' }]);
  assert.doesNotMatch(await readFile(result.jsonPath, 'utf8'), /Secret/);
});
