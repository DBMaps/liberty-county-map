import test from 'node:test';
import assert from 'node:assert/strict';
import { deterministicReportMismatch } from '../tools/deterministic-report-diagnostics.mjs';

test('LP162.2 identifies the first deterministic JSON value mismatch', () => {
  const diagnostic = deterministicReportMismatch('reports/example.json', '{"status":"FAIL","count":2}\n', '{"status":"PASS","count":2}\n');
  assert.match(diagnostic, /^path=reports\/example\.json;/);
  assert.match(diagnostic, /actualSha256=[0-9a-f]{64}; expectedSha256=[0-9a-f]{64}/);
  assert.match(diagnostic, /mismatch=JSON_VALUE; jsonPointer=\/status; actual="FAIL"; expected="PASS"$/);
});

test('LP162.2 distinguishes canonical serialization drift from governed content drift', () => {
  const diagnostic = deterministicReportMismatch('data/example.json', '{\r\n  "status": "PASS"\r\n}\r\n', '{\n  "status": "PASS"\n}\n');
  assert.match(diagnostic, /firstDifferingByte=1; actualLine=1; actualColumn=2/);
  assert.match(diagnostic, /mismatch=SERIALIZATION_ONLY$/);
});

test('LP162.2 reports invalid JSON without dumping unbounded report content', () => {
  const diagnostic = deterministicReportMismatch('data/example.json', '{"status":', '{"status":"PASS"}\n');
  assert.match(diagnostic, /mismatch=INVALID_ACTUAL_JSON; parseError=/);
  assert.ok(diagnostic.length < 1000);
});
