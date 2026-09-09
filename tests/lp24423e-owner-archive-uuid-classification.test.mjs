import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {ARCHIVE_DICTIONARY,UUID_BEARING_IDENTIFIER_COLUMNS,validateArchiveRow} from '../tools/retention/owner-archive.mjs';

const uuid='123e4567-e89b-42d3-a456-426614174000';
const timestamp='2026-09-09T12:00:00Z';

function row(dataset,overrides={}) {
  const defaults={
    reports:{id:randomUUID(),archive_ref:randomUUID(),created_at:timestamp,original_submitted_at:timestamp,expires_at:timestamp,
      cleanup_after:'2026-10-09T12:00:00Z',linkage_deadline:'2026-11-09T12:00:00Z',crossing_id:'DOT-SYNTHETIC-CROSSING',
      crossing_name:'Synthetic crossing',railroad:'Synthetic railroad',lat:30,lng:-95,county_id:'liberty-tx',state:'TX',report_type:'blocked',
      severity:'high',detail:'Standing water',source:'user',confidence:'Community report',status:'active',provenance:'user_supplied'},
    feedback:{id:randomUUID(),created_at:timestamp,category:'general',message:'Safe feedback',awareness_area:'Liberty County',platform:'web',
      gridly_version:'test',county_id:'liberty-tx',state:'TX',status:'new',provenance:'user_supplied'},
    receipts:{report_ref:randomUUID(),original_submitted_at:timestamp,first_accepted_at:timestamp,provenance:'security_control'}
  };
  return {...defaults[dataset],...overrides};
}

test('UUID-bearing database identifier allowlist is explicit, bounded, and reviewable', () => {
  assert.deepEqual(Object.keys(UUID_BEARING_IDENTIFIER_COLUMNS).sort(),[
    'feedback.id','receipts.report_ref','reports.archive_ref','reports.crossing_id','reports.id'
  ]);
  assert.equal(Object.isFrozen(UUID_BEARING_IDENTIFIER_COLUMNS),true);
  assert.deepEqual(Object.keys(ARCHIVE_DICTIONARY).sort(),['feedback','health','history','protocol','receipts','reports','reset_compliance','retention_runs']);
});

test('the same UUID is accepted only from allowlisted record-identity provenance', () => {
  assert.doesNotThrow(()=>validateArchiveRow('reports',row('reports',{crossing_id:`hazard-${uuid}`})));
  assert.throws(()=>validateArchiveRow('reports',row('reports',{detail:uuid})),/secret review/);
  assert.throws(()=>validateArchiveRow('reports',row('reports',{detail:`record_id=${uuid}`})),/secret review/);
});

test('approved stable report, feedback, and receipt UUID columns remain exportable', () => {
  assert.doesNotThrow(()=>validateArchiveRow('reports',row('reports',{id:uuid,archive_ref:uuid})));
  assert.doesNotThrow(()=>validateArchiveRow('feedback',row('feedback',{id:uuid})));
  assert.doesNotThrow(()=>validateArchiveRow('receipts',row('receipts',{report_ref:uuid})));
});

test('authorization and non-allowlisted UUID sources fail closed', () => {
  assert.throws(()=>validateArchiveRow('reports',row('reports',{detail:`authorization_uuid=${uuid}`})),/secret review/);
  assert.throws(()=>validateArchiveRow('feedback',row('feedback',{message:uuid})),/secret review/);
  assert.throws(()=>validateArchiveRow('reports',row('reports',{crossing_id:`authorization-${uuid}`})),/secret review/);
});

test('tokens, replay evidence, credentials, keys, and provider secrets remain rejected', () => {
  const cases=[
    'access_token=access-fixture-value','refresh_token=refresh-fixture-value','submission_token=submission-fixture-value',
    `replay_digest=${'a'.repeat(64)}`,'credential=owner:fixture','password=fixture-password',
    '-----BEGIN PRIVATE KEY----- fixture -----END PRIVATE KEY-----','provider_secret=provider-fixture-value'
  ];
  for(const value of cases) assert.throws(()=>validateArchiveRow('feedback',row('feedback',{message:value})),/secret review/,value);
});

test('nested JSON and text containing credential material remain rejected', () => {
  const cases=[
    JSON.stringify({profile:{credentials:{password:'nested-fixture'}}}),
    'Support note contains password = text-fixture and must never leave review.'
  ];
  for(const value of cases) assert.throws(()=>validateArchiveRow('feedback',row('feedback',{message:value})),/secret review/,value);
});

test('misleading identity field names cannot bypass strict row or UUID source allowlists', () => {
  assert.throws(()=>validateArchiveRow('feedback',{...row('feedback'),safe_report_id:uuid}),/allowlist mismatch/);
  assert.throws(()=>validateArchiveRow('feedback',row('feedback',{message:`safe_report_id=${uuid}`})),/secret review/);
});
