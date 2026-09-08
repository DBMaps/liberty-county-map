# LP244.21D isolated restoration and certification

**LOCAL PREPARATION ONLY. No restoration, production access change, reconnection, deployment, or policy publication is authorized by this document.**

## Authority and threat model

DJ Burns Collective LLC, doing business as Gridly App, must explicitly authorize each restore and separately authorize reconnection. A designated database operator performs recovery; the owner reviews the evidence and unresolved exceptions. No automated check grants that authorization.

This procedure addresses accidental use of an old backup, PITR image, clone, export, or disaster-recovery copy with expired links, incomplete receipts, permissive old grants, or old admission code. It does not claim to constrain a privileged administrator who deliberately disables safeguards, falsifies evidence, or reconnects a prohibited copy. A restored database cannot discover tokens consumed after its snapshot. That information must come from a trusted, complete source outside the restored snapshot.

## Isolation comes first

1. Before restoring any bytes, establish a separate recovery project/database with **no production routing, client credentials, public Data API access, Realtime delivery, application workers, scheduled writes, analytics feeds, or export destinations**. Restrict network access to the designated operator. Do not perform an in-place publicly reachable restore and hope to revoke access afterward. If the provider cannot guarantee isolation throughout its restore workflow, do not use that workflow.
2. Stop source ingress and writers under separate authorization; drain in-flight submissions, mutations and cancellations. Identify the last accepted operation boundary. Capture complete current replay evidence before using it as a recovery authority. An older backup is not evidence of the final boundary. If the source is lost and no complete independently preserved ledger is available, keep the recovery quarantined indefinitely. Deleting historical rows alone does not make missing tokens safe to accept.
3. Apply the current forward migrations in isolation. These are `202609080001_community_report_retention.sql` then `202609080002_community_submission_protocol.sql`. They are not idempotent migration replays: use verified migration history plus schema inspection to determine pending files. Do not rerun a destructive migration against an already migrated source. Migration 002 now includes LP244.21D live observation receipts; an older C snapshot without those receipts cannot certify. Do not backfill receipts from device IDs, report contents, timestamps, or physical crossing IDs. An ambiguous older schema requires a separately reviewed forward recovery change or remains quarantined.
4. Forward migrations can grant API permissions. Keep external isolation in place, and immediately apply the repository quarantine SQL afterward. Re-run it after any schema/permission change.

Using libpq connection variables for the **isolated** database, with credentials in approved secret storage (never command-line passwords):

```powershell
psql -X -v ON_ERROR_STOP=1 -f supabase/retention/quarantine-restoration.sql
```

Quarantine revokes ordinary/public table and column access, execution on functions in the application schemas, and community-report publication membership. It refuses an all-table publication rather than silently trusting replication. Inherited roles or other access paths may require additional explicit operator work; certification detects effective privileges. SQL revocation does not stop existing gateway caches, network delivery already in flight, external replicas, or privileged connections. External isolation and session/worker shutdown are mandatory, not inferred from a successful SQL command.

## Trusted source evidence

On the known-complete **stopped source**, using the current schema and the same reviewed repository checkout:

```powershell
node tools/retention/certify-restoration.mjs --source-ledger > source-ledger-review.json
```

This read-only command outputs only a SHA-256 fingerprint of the sorted complete digest set, its count, the migration fingerprint and observation time. It does not export token values, report IDs, device identifiers, coordinates or narratives. Its output is deliberately **not certifying**: all operator attestations start false and authorization/source references are empty.

The owner/operator must establish the source was complete through the final drained operation, identify the source and authorization records, confirm target network isolation, and approve an evidence validity window of no more than 24 hours. Set `sourceWritesStopped`, `sourceContinuityVerified`, and `networkIsolationVerified` only after verifying those facts; record `authorizationReference`, `sourceReference`, and `validUntil`. These are explicit operator attestations, not facts that a boolean or this program can independently establish. Preserve the evidence in controlled storage outside the restore domain with an independently recorded file hash and audit timestamp. Do not generate a new “trusted source” witness from the restored database merely to make its fingerprint match.

Every consumed digest, including mutation and cancellation receipts and receipts whose reports have already been removed, must survive. The fingerprint detects missing **or additional** evidence but cannot reconstruct it. Reconcile from a trusted complete ledger copy without importing erased device associations; do not hash devices to invent replacements. If the final ledger is unavailable, absent from the witness, or inconsistent, there is no automatic waiver or clock reset. Keep creation/replay unavailable. A future protocol retirement/reissuance design would require separate authorization and cannot consist of a client-selected new epoch.

## Explicit sanitization

After schema inspection and quarantine, review the deletion scope and explicitly run:

```powershell
psql -X -v ON_ERROR_STOP=1 -f supabase/retention/sanitize-restoration.sql
```

This is a separate destructive operation, not part of certification. It checks effective quarantine before deleting untrustworthy reports: missing live receipts/ledger, invalid or altered original clocks, device-derived identities, exposed device values, and recognized plaintext consumed tokens. Deleting reports cascades the private device association and temporary observation receipt. Legacy historical sidecars are deleted. Trusted expired reports then undergo the existing day-149 cleanup and coarse aggregation. The permanent replay ledger is never deleted, rewritten, or synthesized. Unknown records are deleted rather than aggregated under invented provenance. Transactions and nonzero errors prevent a partial successful sanitization claim; failed SQL leaves quarantine required. Capture command exit status and counts in the operator audit. Correct the cause, then retry.

Maximum device linkage remains **180 days from original submission**. Day 149 is an internal cleanup target with a 31-day operational buffer. Restoration never restarts either clock. The temporary observation receipt preserves the original time independently of the mutable condition row and links that row to a consumed digest only during its lifetime. It contains no device value; it cascades away with the report, including on cleanup. The permanent ledger still contains only digest and first-accepted time.

## Read-only certification and reconnection decision

On the isolated target, with `PGHOST`, `PGUSER`, `PGDATABASE`, and other libpq options set explicitly; remote connections require `PGSSLMODE=verify-full`:

```powershell
node tools/retention/certify-restoration.mjs --evidence source-ledger-review.json > recovery-certification.json
```

Exit 0 means the inspected database passed the repository checks against the supplied trusted evidence. Any missing configuration, malformed/expired evidence, SQL error, timeout, incomplete snapshot, or failed condition returns nonzero and `pass:false`. The result always says `reconnectionAuthorized:false`. It never changes grants, deletes rows, runs cleanup, invokes restored admission RPCs, or opens access. Inspection uses one repeatable-read, read-only transaction, catalog/built-in reads and current base tables rather than trusting a restored health view.

Checks cover the current LP244.21 function bodies, RPC signatures, fixed search paths, owners, required triggers/constraints, private table shape, unique digests and live receipts, original clocks and deadlines, incomplete ledger continuity, old device-bearing identities and historical sidecars, recognized plaintext tokens, RLS, effective client grants, replication exposure, and recent successful cleanup. Unknown/incomplete schemas fail rather than returning zero counts. The tool's 32 MiB inspection output bound and timeout also fail closed; large datasets require separately reviewed scaling, not a bypass.

Retain this evidence for owner review:

- Restore authorization, target/source identification, network isolation and writer/session shutdown evidence, final accepted-operation boundary, external ledger witness and its independently recorded hash.
- Exact repository commit plus unstaged-diff/artifact hashes when reviewing local changes; migration file hashes; PostgreSQL/Node versions; applied migration history and schema inspection.
- Sanitization command/status/counts, read-only certification JSON/status/time, and the local retention/replay/restoration test results for that exact revision.
- Reviewed inventory of other RPCs, views, exports, copies, subscriptions/replication and administrative access. An unrelated public function remains denied in recovery; granting it later requires review. This checker is not a universal scanner of arbitrary external files, encoded narratives, hidden schemas, or malicious admin-created functions.
- Provider retention/log/body-capture evidence and unresolved exceptions. No exceptions can waive missing ledger continuity or expired linkage.

Only after every technical and operational gate passes may the owner consider a separately authorized reconnection. Keep target writes closed through that decision; changes after inspection invalidate the certificate. Re-run immediately before the decision if state, code, permissions or validity changes. Reconnection must restore only reviewed current read/RPC permissions; never replay an old grants export or reopen direct legacy INSERT. No automatic reconnection SQL is provided. A failure remains quarantined and escalates to the owner/operator with bounded diagnostics; never attach raw tokens, device values or report bodies to the ticket.

## Boundaries and provider facts

**Repository-enforced:** read-only verifier, explicit separate quarantine/sanitization artifacts, exact protocol checks, trusted-evidence requirement and no automatic reconnect. **Locally database-tested:** ordinary role denial, cascade deletion, immutable clocks/receipts, replay uniqueness, unsafe fixture failures and cleanup retry/idempotence. **Operator-required:** pre-restore isolation, source continuity/provenance, credentials/session/worker controls, copy inventory, correct evidence and approval. **Provider-unverified:** actual backup/PITR windows, WAL/physical remnants, log/body retention, replica/export deletion and end-to-end isolation during provider restoration.

Supabase documents daily backups and separate PITR arrangements; database backup coverage does not establish deletion of external Storage objects or every copy. Current project options were not inspected or changed in this block. See [Supabase database backups](https://supabase.com/docs/guides/platform/backups). The [changelog](https://supabase.com/changelog) was reviewed on September 8, 2026; restore credential handling and API/replication changes reinforce the need to verify the actual provider workflow rather than assume restored permissions or credentials are safe.

Backups, PITR images, WAL, replicas, exports and logs must follow their own verified expiration and restoration restrictions. An ordinary rollback must never restore erased associations. Old offline clients/caches cannot be remotely guaranteed to erase copies before they next run; old package creation remains rejected by the database. No physical erasure, anonymity, complete backup deletion, or operative 180-day production promise is certified here. Production deployment and policy publication remain separately blocked.
