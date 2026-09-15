# Responder Phase 14D psql file-execution readiness

## Scope and result

Phase 14D is a local-only rehearsal of a transport that avoids the Phase 14C connector request-size limit. It did not connect to production or Supabase, modify the certified payload, populate production counties, create a migration, deploy, or authorize a later production run.

The local result is **PSQL FILE STREAMING READY**. This means the certified payload can be streamed by psql inside one executor-owned transaction and certified before the executor reaches its explicit commit decision. Production execution still requires separate authorization.

## Certified input

The unchanged input is [`phase14a_county_population_payload.sql`](../../db/responder-local/phase14a_county_population_payload.sql):

- byte size: `13,965,052`
- SHA-256: `464565b291946ff12e948d683e402c83caa39e2737748996f669fa2327a25a9e`
- counties: `254`
- coordinate pairs: `604,979`
- canonical FIPS SHA-256: `7e80dd17d4d295d904f986a193ab259850e607c6bdfde3a7454e9af5a54a2092`
- transaction-control statements: `0`

The payload remains a transaction-neutral sequence of 254 inserts. It contains no `BEGIN`, `COMMIT`, or `ROLLBACK` statement.

## One-session executor

[`phase14d_county_population_executor.sql`](../../db/responder-local/phase14d_county_population_executor.sql) is labeled **LOCAL CERTIFIED EXECUTOR TEMPLATE**, **NOT A MIGRATION**, and **REQUIRES SEPARATE PRODUCTION AUTHORIZATION**. It contains no credentials, host, user, password, or fixed production connection string.

One psql backend performs this ordered sequence:

1. enable `ON_ERROR_STOP`;
2. `BEGIN`;
3. acquire `SHARE ROW EXCLUSIVE` on `public.gridly_texas_county_boundaries`;
4. require the empty target, RLS, zero policies, zero user triggers, and the valid GiST index;
5. capture backend PID and transaction ID;
6. use `\i` to stream the payload on that same connection;
7. prove the backend PID and transaction ID are unchanged;
8. certify all 254 counties, unique and complete Texas FIPS sequence, non-null geometry/version, SRID 4326, valid `MultiPolygon`, 604,979 coordinate pairs, the frozen boundary version, and Liberty/Chambers strict-boundary behavior;
9. commit only when certification passes and `phase14d_commit_authorized=true`; otherwise roll back.

The safe default is rollback. The operator must explicitly supply the true commit flag to reach `COMMIT`, and must do so only under a separate production authorization.

## Local production-shaped fixture

The disposable PostgreSQL 17.10/PostGIS 3.6.2 fixture used `public.gridly_texas_county_boundaries` with the production-shaped FIPS primary key and check, `geometry(MultiPolygon,4326)`, `boundary_version`, GiST geometry index, enabled RLS, no policies, and no user triggers. Unrelated sentinel tables proved that the executor touched only the county table.

## Rehearsal evidence

The successful rollback rehearsal streamed the full payload, observed 254 rows before the decision, kept the same backend PID and transaction ID, passed certification, deliberately selected rollback, and ended at zero rows.

The successful commit rehearsal started from zero, streamed and certified the full payload in one transaction, explicitly selected commit, and then used a fresh read-only session to prove 254 rows and the committed table digest `54f42bb9795dd2f4f6f743a14b4d86e7`.

The forced precommit failure rehearsal loaded all 254 rows without changing the payload, forced the certification boolean false, selected rollback, and ended at zero rows.

Two error rehearsals proved `ON_ERROR_STOP` behavior. A synthetic local include raised a payload SQL error, and a safe test hook raised a certification SQL error after the certified payload had loaded. In both cases psql stopped before the decision block, no commit marker appeared, connection closure rolled back the open transaction, and a fresh session found zero rows. These hooks can only prevent a commit.

## Absolute Windows path

The caller supplies `phase14d_payload_path` as an absolute Windows path normalized to forward slashes, for example:

```powershell
$payload = (Resolve-Path -LiteralPath 'db/responder-local/phase14a_county_population_payload.sql').Path.Replace('\', '/')
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -X -w -v ON_ERROR_STOP=1 -v "phase14d_payload_path=$payload" -v phase14d_commit_authorized=false -f 'db/responder-local/phase14d_county_population_executor.sql'
```

This removes dependence on psql's or the shell's current directory. Secure database connection parameters must come from the separately authorized execution environment.

## Error and operator behavior

`\set ON_ERROR_STOP on` makes a payload or certification SQL error terminate psql processing immediately. Since `COMMIT` appears only later in a conditional block, it is never reached automatically after an error. PostgreSQL rolls back the still-open transaction when the stopped psql connection closes. For a certified normal run, the external `phase14d_commit_authorized` value remains the explicit final decision.

The bounded machine-readable evidence is in [`responder-phase14d-psql-readiness-certification.json`](../../reports/responder/responder-phase14d-psql-readiness-certification.json), and the executable proof is in [`responder-phase14d-psql-readiness-contracts.test.mjs`](../../tests/responder-phase14d-psql-readiness-contracts.test.mjs).

## Future transport recommendation

Use one psql session, an absolute forward-slash payload path, the executor-owned `BEGIN` and `SHARE ROW EXCLUSIVE` lock, `ON_ERROR_STOP`, `\i` file streaming, complete certification before the decision, and an explicit externally supplied commit authorization. Do not send the 13.9 MB SQL body through the size-limited connector.

**PSQL FILE STREAMING READY**
