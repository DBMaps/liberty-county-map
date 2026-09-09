const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const {createHash} = require('node:crypto');

const SQL = fs.readFileSync(path.join(__dirname, '../supabase/retention/diagnose-managed-role-raw.PROPOSAL.sql'), 'utf8');
const PORT = 55441;
const CREATOR = `gridly_raw_creator_${process.pid}`;
const DATABASE = `gridly_raw_fixture_${process.pid}`;
const OTHER = `gridly_raw_other_${process.pid}`;

// Direct PostgreSQL wire protocol. Exactly one Q message, no psql or preprocessing.
// Collect every result row and require idle ReadyForQuery (implicit COMMIT done).
function raw(query, user = CREATOR, database = DATABASE, inspectSession = false) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({host: '127.0.0.1', port: PORT});
    let buffer = Buffer.alloc(0), sent = 0;
    let diagnosticResult;
    const rows = [], errors = [], descriptions = [];
    socket.setTimeout(25000, () => { socket.destroy(); reject(new Error('raw query timeout')); });
    socket.on('error', reject);
    socket.on('connect', () => {
      const params = Buffer.from(`user\0${user}\0database\0${database}\0client_encoding\0UTF8\0\0`);
      const packet = Buffer.alloc(8 + params.length);
      packet.writeInt32BE(packet.length); packet.writeInt32BE(196608, 4); params.copy(packet, 8);
      socket.write(packet);
    });
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 5) {
        const type = String.fromCharCode(buffer[0]), length = buffer.readInt32BE(1);
        if (buffer.length < length + 1) break;
        const body = buffer.subarray(5, length + 1);
        buffer = buffer.subarray(length + 1);
        if (type === 'R' && body.readInt32BE() !== 0) {
          socket.destroy(); reject(new Error('fixture must use local trust authentication')); return;
        }
        if (type === 'E') errors.push(body.toString('utf8'));
        if (type === 'T') descriptions.push(body.readInt16BE());
        if (type === 'D') {
          const fields = []; let offset = 2;
          for (let i = 0; i < body.readInt16BE(); i++) {
            const n = body.readInt32BE(offset); offset += 4;
            fields.push(n < 0 ? null : body.subarray(offset, offset + n).toString('utf8'));
            if (n >= 0) offset += n;
          }
          rows.push(fields);
        }
        if (type === 'Z') {
          if (!sent) {
            const bytes = Buffer.from(query + '\0'), packet = Buffer.alloc(5 + bytes.length);
            packet.write('Q'); packet.writeInt32BE(4 + bytes.length, 1); bytes.copy(packet, 5);
            sent++; socket.write(packet);
          } else if (inspectSession && !diagnosticResult) {
            diagnosticResult = {rows: [...rows], errors: [...errors], descriptions: [...descriptions], sent, transaction: body.toString()};
            rows.length = 0; errors.length = 0; descriptions.length = 0;
            const bytes = Buffer.from("select current_setting('search_path'), current_setting('statement_timeout'), current_setting('lock_timeout')\0");
            const packet = Buffer.alloc(5 + bytes.length);
            packet.write('Q'); packet.writeInt32BE(4 + bytes.length, 1); bytes.copy(packet, 5);
            socket.write(packet);
          } else {
            socket.end(); resolve(diagnosticResult ? {...diagnosticResult, sessionAfter: rows, inspectionErrors: errors} : {rows, errors, descriptions, sent, transaction: body.toString()});
          }
        }
      }
    });
  });
}

test('exact raw diagnostic: isolated PostgreSQL 17.10 non-superuser owner', async t => {
  let databaseCreated = false, creatorCreated = false, otherCreated = false, authenticatorCreated = false;
  const admin = async (q, database = DATABASE) => {
    const r = await raw(q, 'postgres', database);
    assert.deepEqual(r.errors, []); return r;
  };
  const absence = async () => {
    const r = await admin("select (select count(*) from pg_roles where rolname like 'gridly_diag_%'), (select count(*) from pg_class where relname = 'gridly_diag_result'), (select count(*) from pg_proc where proname = 'gridly_managed_role_diagnostic_lp24423b')");
    assert.deepEqual(r.rows, [['0', '0', '0']]);
  };
  const success = async (q = SQL) => {
    const r = await raw(q, CREATOR, DATABASE, true);
    assert.deepEqual(r.errors, []);
    assert.equal(r.sent, 1); assert.equal(r.transaction, 'I');
    assert.deepEqual(r.descriptions, [1]); assert.equal(r.rows.length, 1);
    const value = JSON.parse(r.rows[0][0]);
    assert.equal(value.status, 'NO-GO'); // Synthetic creator is deliberately not the production owner.
    assert.equal(value.cleanup_success, true); assert.equal(value.diagnostic_role_absent, true);
    assert.deepEqual(r.inspectionErrors, []);
    assert.deepEqual(r.sessionAfter, [['"$user", public', '0', '0']]);
    assert.equal(value.predicates.matches_repaired_production_predicate, false);
    assert.equal(value.predicates.production_owner_identity_match, false);
    await absence(); return value;
  };
  const failure = async (q, reason = 'diagnostic predicate mismatch or incomplete observation') => {
    const r = await raw(q);
    assert.ok(r.errors.length > 0); assert.deepEqual(r.rows, []); assert.equal(r.transaction, 'I');
    assert.ok(r.errors.some(e => e.includes(reason)), r.errors.join('\n'));
    await absence();
  };
  const inject = statement => {
    const point = '    select * into strict r from pg_roles where rolname = diagnostic_name;';
    assert.ok(SQL.includes(point)); return SQL.replace(point, statement.replaceAll('fixture_other', OTHER).replaceAll('to postgres', 'to ' + CREATOR) + '\n' + point);
  };
  try {
    await admin(`create database ${DATABASE}`, 'postgres'); databaseCreated = true;
    await admin(`create role ${CREATOR} login nosuperuser createrole`); creatorCreated = true;
    await admin(`create role ${OTHER} nologin; grant ${OTHER} to ${CREATOR} with admin true`); otherCreated = true;
    const auth = await admin("select count(*) from pg_roles where rolname='authenticator'");
    if (auth.rows[0][0] === '0') { await admin('create role authenticator nologin'); authenticatorCreated = true; }
    await admin(`grant create on database ${DATABASE} to ${CREATOR}; create schema fixture_private; create schema "fixture_""quoted"; create table fixture_private.fixture_table (value integer); grant usage, create on schema fixture_private to ${CREATOR} with grant option; grant all on fixture_private.fixture_table to ${CREATOR} with grant option`);
    const schemaInventory = (await admin('select oid, nspname, nspowner, nspacl from pg_namespace order by oid')).rows;
    await t.test('fixture is exactly 17.10 and non-superuser CREATEROLE', async () => {
      const r = await raw("select current_setting('server_version'), rolsuper, rolcreaterole from pg_roles where rolname=current_user");
      assert.deepEqual(r.errors, []); assert.deepEqual(r.rows, [['17.10', 'f', 't']]);
    });
    await t.test('no client syntax or forbidden production identifiers', () => {
      assert.doesNotMatch(SQL, /\\(?:set|gset|gexec)|:\s*'|\$\(|gridly_retention_monitor|authorization|nhwhkbkludzkuyxmkkcj/i);
      assert.doesNotMatch(SQL, /\b(?:update|delete|create\s+(?:function|table|schema)|security\s+definer)\b|^\s*(?:commit|begin);/im);
    });
    await t.test('exact bytes: one query, one complete JSON row after role rollback', async () => {
      const v = await success();
      assert.match(v.diagnostic_role, /^gridly_diag_[a-f0-9]{32}$/);
      assert.deepEqual(v.attributes, {rolcanlogin:false, rolsuper:false, rolcreatedb:false,
        rolcreaterole:false, rolinherit:false, rolreplication:false, rolbypassrls:false,
        rolconnlimit:0, config_present:false, database_config_present:false});
      assert.deepEqual(v.memberships, [{role:v.diagnostic_role, member:CREATOR,
        direction:'diagnostic_granted_to_member', admin:true, inherit:false, set:false,
        grantor:'postgres', grantor_superuser:true}]);
      assert.equal(v.authenticator_present, true); assert.equal(v.authenticator_can_set, false);
      assert.deepEqual(v.explicit_grants, {schema:0, relation:0, column:0, function:0, database:0, all_acl_dependencies:0});
      assert.deepEqual(v.owned_objects, {total:0, by_catalog:{}});
      assert.ok(v.databases.length >= 3); assert.ok(v.schemas.length >= 4);
      assert.ok(JSON.stringify(v).length > 1024, 'transport is not truncated to identifier length');
      assert.ok(v.schemas.some(s => s.schema === 'fixture_"quoted'));
      assert.equal(v.predicates.attributes_match, true); assert.equal(v.predicates.creator_membership_shape_match, true);
      assert.equal(v.predicates.pregrant_privileges_match, true); assert.equal(v.predicates.complete_observation, true);
      assert.equal(v.predicates.effective_privileges_expected, true);
      assert.equal(v.predicates.memberships_match, false);
    });
    await t.test('repeat exact query without collision or residue', async () => {
      const names = new Set(); for (let i = 0; i < 3; i++) names.add((await success()).diagnostic_role);
      assert.equal(names.size, 3);
    });
    await t.test('wrong attributes fail without result or residue', async () => {
      for (const [a,b] of [['nologin','login'], ['nocreaterole','createrole'], ['noinherit','inherit'], ['connection limit 0','connection limit 1']]) {
        await failure(SQL.replace(a,b));
      }
      await admin(`alter role ${CREATOR} createdb`);
      try { await failure(SQL.replace('nocreatedb', 'createdb')); }
      finally { await admin(`alter role ${CREATOR} nocreatedb`); }
    });
    await t.test('inbound membership and wrong SET/INHERIT/ADMIN fail', async () => {
      for (const s of [
        "execute format('grant fixture_other to %I', diagnostic_name);",
        "execute format('grant %I to postgres with set true', diagnostic_name);",
        "execute format('grant %I to postgres with inherit true', diagnostic_name);",
        "execute format('grant %I to postgres with admin false', diagnostic_name);",
        "execute format('grant %I to authenticator', diagnostic_name);"
      ]) await failure(inject(s));
    });
    await t.test('explicit table/column/schema grants and ownership fail', async () => {
      for (const s of [
        "execute format('grant select on fixture_private.fixture_table to %I', diagnostic_name);",
        "execute format('grant select(value) on fixture_private.fixture_table to %I', diagnostic_name);",
        "execute format('grant usage on schema fixture_private to %I', diagnostic_name);",
        "execute format('grant %I to postgres with set true', diagnostic_name); execute format('create schema authorization %I', diagnostic_name);"
      ]) await failure(inject(s));
    });
    await t.test('injected error immediately after creation rolls back role', async () => {
      await failure(inject("raise exception 'synthetic injected failure';"), 'synthetic injected failure');
    });
    await t.test('errors after observation and transport corruption produce no result', async () => {
      await failure(SQL.replace("    raise exception using errcode = 'G2301'", "    raise exception 'synthetic injected failure';\n    raise exception using errcode = 'G2301'"), 'synthetic injected failure');
      await failure(SQL.replace('pg_catalog.quote_ident(observed::text)', "pg_catalog.quote_ident('not JSON')"), 'invalid input syntax for type json');
    });
    await t.test('cleanup assertion detects an unrolled role and query failure still removes it', async () => {
      await failure(SQL.replace("raise exception using errcode = 'G2301', message = 'rollback diagnostic observation';", 'rolled_back := true;'), 'diagnostic cleanup or observation failed');
    });
    await t.test('configuration presence fails without exposing setting values', async () => {
      for (const statement of [
        "execute format('alter role %I set work_mem = %L', diagnostic_name, '7MB');",
        "execute format('alter role %I in database %I set work_mem = %L', diagnostic_name, current_database(), '7MB');"
      ]) {
        const r = await raw(inject(statement));
        assert.ok(r.errors.some(e => e.includes('diagnostic predicate mismatch')));
        assert.doesNotMatch(r.errors.join(), /7MB/); assert.deepEqual(r.rows, []); await absence();
      }
    });
    await t.test('missing authenticator fails incomplete observation', async () => {
      await failure(SQL.replace('complete := authenticator_present', 'complete := false and authenticator_present'));
    });
    await t.test('collision fails and leaves existing role unchanged', async () => {
      await admin('create role gridly_diag_collision nologin');
      try {
        const r = await raw(SQL.replace("'gridly_diag_' || replace(gen_random_uuid()::text, '-', '')", "'gridly_diag_collision'"));
        assert.ok(r.errors.some(e => e.includes('identity collision'))); assert.deepEqual(r.rows, []);
        assert.deepEqual((await admin("select rolcanlogin from pg_roles where rolname='gridly_diag_collision'")).rows, [['f']]);
      } finally { await admin('drop role gridly_diag_collision'); }
      await absence();
    });
    await t.test('unexpected PUBLIC privileges fail', async () => {
      await admin('grant usage on schema fixture_private to public');
      try { await failure(SQL); } finally { await admin('revoke usage on schema fixture_private from public'); }
    });
    await t.test('no schema, schema ACL, or fixture data changes persist', async () => {
      assert.deepEqual((await admin('select oid, nspname, nspowner, nspacl from pg_namespace order by oid')).rows, schemaInventory);
      assert.deepEqual((await admin('select count(*) from fixture_private.fixture_table')).rows, [['0']]);
    });
    await t.test('final catalog absence independently verified', absence);
    console.log('canonical-LF SHA-256:', createHash('sha256').update(SQL.replace(/\r\n/g, '\n')).digest('hex'));
  } finally {
    if (databaseCreated) await admin(`drop database ${DATABASE} with (force)`, 'postgres');
    if (creatorCreated) await admin(`drop role ${CREATOR}`, 'postgres');
    if (otherCreated) await admin(`drop role ${OTHER}`, 'postgres');
    if (authenticatorCreated) await admin('drop role authenticator', 'postgres');
  }
});
