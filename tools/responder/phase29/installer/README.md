# Deployment-safe Dispatch empty-project installer candidate

Owner task: DAYTON-PREINSTALL-01-v1. Target project cmrrvwgkgjhmdugzhnrh. **Local design/certification only; no remote execution is authorized.** Historical packages remain immutable. No fixture schemas, consumer sentinel, test identity or Docker assumption appears in installation SQL. Docker/CLI appear only in the separate disposable certification harness.

## Source provenance and build

`source-lock.json` pins LF-normalized SHA-256 for every reused committed package and runtime test. `build.mjs` refuses source drift and extracts the frozen SQL bodies into one new transaction with independent target, namespace, role, platform and ACL prechecks. This is not permission to delete guards from a historical package or apply that package remotely. New candidate construction replaces environmental guards at exact checked boundaries; runtime functions, taxonomy, review, invitation and grants are retained. Existing disposable runners/evidence are not overwritten.

`inventory.json` records exact planned tables/roles, phase-body hashes and full installation hash. Certification also exports installed functions, ownership, ACLs and RLS. Generated compatibility/principal tests reuse the locked assertion bodies with imports retargeted; sentinel assertions become absence assertions, and refusal tests exercise the new installer/rollback. No original test file is changed.

## A–F phases and checkpoints

A: validated direct hostname/project reference and certificate-verified TLS in `target.mjs`; read-only SQL precheck for PostgreSQL >=17.11 and major 17, expected database/administrator, standard platform roles/Auth/helpers, absent Dispatch namespaces/roles, empty application data/public namespace and known public default-ACL principals. The project setting is supplied by the validated connection wrapper, not treated as independent SQL identity evidence. Standalone SQL must not be used to bypass connection validation. Unexpected populated/partial/ambiguous state refuses before application DDL.

Before B: `default-privileges.sql` removes all future postgres-owned public table/sequence browser/service-role privileges, including residual TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, and prevents browser schema creation. It changes no Auth/Storage/Realtime/Vault objects or defaults. Application installation and future application migrations must use the reviewed postgres owner; Supabase-managed admin defaults are not repurposed for Dispatch objects. PUBLIC's global default function EXECUTE cannot be removed by a schema-level REVOKE: every new Dispatch function instead has explicit PUBLIC revocation and exact grants, as in the frozen packages.

B: frozen organization/security foundation and unit boundaries; NOLOGIN/NOINHERIT/BYPASSRLS command owner, sole bounded postgres Auth bridge, invoker identity/session helpers, exact grants and forced RLS. No consumer or retention-rehearsal schema is created.

C: all four department matrices, normalized taxonomy/versioned contract, impacts, narrow/high-risk conjunctive gates, governed projection/review, sensitive content protection and explicit sharing. Static registry data only; no real organizations, units or capability grants.

D: DAYTON-REVIEW-01 exact scoped authorizations/revalidation and invitation delivery attempts/evidence/suppression, immutable lineage. DAYTON-RETENTION-01-v1 execution gaps remain OPEN; this installer does not invent retention jobs, holds or legal disposition.

E: LOGIN/NOINHERIT/NOBYPASSRLS/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION delivery connection, connection limit 4, narrow transport-only SET role membership and short timeouts. No password is embedded or assigned. Real credential provisioning is a later secret-safe owner action; null password prevents password-authenticated transport. The local principal test creates transient synthetic credential material only and does not print it.

F: preserved Phase 27/28 security postflight plus transport membership/function/table boundary checks, exact table inventory, registry/review/invitation objects, no activation data, publication flag false and no extra consumer/fixture namespaces. Later catalog certification must include exact function/ACL inventory and any standard-platform administrator restrictions.

## Transaction/failure model

All application DDL, roles, privilege hardening and postflight run in one transaction with one advisory transaction lock, 5-second lock timeout and 120-second statement timeout. PostgreSQL transactional role/schema DDL is used. Connection failure/process close aborts uncommitted work. A failure must never be reported as an installation. Auth dashboard settings, Data API exposed-schema configuration, network policy, secret provisioning, backup and restore are separate owner checkpoints and are not transactional SQL work.

No restart/reconcile/automatic repair of an existing Dispatch installation is permitted. A partial/incompatible baseline requires a reviewed forward-repair plan. The driver has no CLI execution entry, never logs credentials and accepts only the dedicated certificate hostname; no service_role/consumer credentials. Provider delivery and public publishing remain inactive.

## Rollback/refusal

`rollback.sql` is an explicitly authorized empty/unactivated-only candidate. It scans every nonregistry table, refuses evidence, activation or tracked external dependencies, then drops only Dispatch schemas/roles transactionally. Unexpected role dependencies abort rather than being reassigned/dropped. Safe public privilege hardening remains in place. After any evidence-bearing use or activation, freeze the affected installation and use reviewed forward repair; never run destructive rollback. Managed platform schemas remain outside rollback.

Role creation/administration must also work under the actual Supabase postgres NOSUPERUSER/CREATEROLE/BYPASSRLS posture. A local superuser-only success is insufficient. Certification deliberately applies those administrator attributes in the disposable baseline; any unsupported privilege requirement is a STOP, never an excuse to weaken command-owner security.

## Local certification and owner gates

`node tools/responder/phase29/installer/build.mjs`

`node --test tests/responder-phase29-installer.test.mjs`

`pwsh -NoProfile -File tools/responder/phase29/installer/run-certification.ps1`

The harness initializes an unlinked TEMP Supabase project and runs the cached CLI only there. It refuses a linked project/non-loopback API and cleans only its validated TEMP path/network. It never invokes repository Supabase configuration or the protected cache. Standard local platform schemas are admitted based on observed platform inventory, without creating application sentinel/markers.

Required evidence: fresh installation; wrong ref/version, namespace, role/public/default-ACL refusals; post-hardening transaction failure; exact catalogs; future-table privilege denial; platform catalog unchanged; empty rollback/reapply; full Auth/TOTP reporting/reviewer/invitation tests; narrow real login/role reset/refusal tests; evidence-bearing rollback refusal; frozen security postflight. Final status comes from test exit codes and complete counts, not an unconditional evidence label.

See [pre-install owner packet](../../../../docs/RESPONDER/DAYTON-DISPATCH-PREINSTALL-SECURITY.md) for owner-approved settings, exact approved Auth redirects, session/password values, explicit network-policy deferral, restore and legal prerequisites. The owner may manually apply the approved dashboard settings; the candidate installer is approved, but remote baseline installation still requires separate explicit authorization. Local Supabase cannot establish actual Cloudflare route, Hyperdrive egress/TLS or provider connectivity.
PostgreSQL 17 grants the nonsuperuser role creator native ADMIN-only memberships (SET FALSE / INHERIT FALSE). Postflight forbids SET/INHERIT runtime access for the installer; ADMIN-only maintenance grants are recorded in the inventory and permit controlled empty rollback. These are not connection-principal grants: the delivery login has exactly one transport membership with ADMIN FALSE / INHERIT FALSE / SET TRUE. No frozen function-owner or browser ACL is changed.

Global postgres-owned table/sequence defaults are hardened before schema-specific defaults, preventing global ACL additions from leaking into new private tables. Unknown global ACL principals refuse in preflight. Existing managed tables/schema-specific ACLs stay unchanged. Candidate hashes use UTF-8 with CRLF normalized to LF and no trimming or other transformations; actual text changes invalidate the hash.
