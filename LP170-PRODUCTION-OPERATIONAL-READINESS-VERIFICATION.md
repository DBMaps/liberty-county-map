# LP170 — Production Operational Readiness Verification

## Purpose and result

LP170 determines whether Gridly has sufficient operational evidence for a future LP167 launch-readiness reassessment. It is an **Audit First, Patch Second** milestone supporting **Awareness Platform First, Route Intelligence Second**. The current classification is **NOT_READY** because complete owner evidence is unavailable; absence and uncertainty fail closed.

## Scope, evidence, and non-goals

The audit separates repository configuration presence, observable production behavior, owner attestation, and operational rehearsal. Sources are committed configuration and documentation, canonical Git blobs, prior LP167–LP169 governed reports, and optional sanitized owner metadata produced on the authoritative Windows system. A mention in a file is not proof that a service exists.

LP170 performs no deployment, workflow trigger, county activation, runtime membership or production-data change, Supabase mutation, credential rotation, restore, rollback, distribution, store submission, or public-launch authorization. Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase Sync, matching, search, routing, awareness, and notification behavior remain outside its modification boundary.

## Classification rules

`PASS` requires every governed dimension to have complete evidence. `PARTIAL_EVIDENCE` records useful but incomplete evidence. `OWNER_ACTION_REQUIRED` applies when authoritative attestations or contacts are missing. `SOURCE_UNAVAILABLE`, `NOT_CONFIGURED`, `NOT_TESTED`, `NOT_READY`, and `NOT_APPLICABLE` retain their literal meanings. No classification is inferred upward. Logs alone never prove alerting; configuration never proves behavior; documentation never proves rehearsal.

## Operational readiness contract

### Monitoring and health

The minimum signal set covers application availability; search, routing-provider, Edge Function, Supabase, Storage, ingestion, report-submission, authentication, critical-client, and deployment failures. Each signal is assessed independently for existence, accessibility, ownership, threshold, destination, response procedure, and behavioral validation. Supabase project, database, Storage, Edge Function, and GitHub deployment health are separately recorded. All currently require authoritative evidence.

### Backup and restoration

Backup evidence must establish configuration, frequency, retention, point-in-time recovery availability, latest known successful backup, and ownership. Restoration additionally requires prerequisites, a documented procedure, ownership, validation steps, and rehearsal evidence. A configured backup does not establish restorability. LP170 does not execute a restore; production restoration remains untested unless explicit rehearsal evidence is ingested.

### Rollback

Application/runtime, GitHub release, deployment artifact, Edge Function, configuration, data/schema, county activation, and public-launch reversal are governed separately. Each requires a prior release identity, preserved artifact identity, procedure, owner, validation, and rehearsal. Documentation alone cannot certify rehearsal. Data/schema rollback remains bounded as `NO_DATA_OR_SCHEMA_ROLLBACK_AUTHORIZED`; LP170 executes no rollback.

### Incident response and escalation

Explicit evidence is required for the primary owner, backup owner, support contact, severity levels, initial triage, containment, rollback decision path, user communications, evidence preservation, post-incident review, and escalation path. LP170 invents no people or contact details: unknown contacts remain `OWNER_ACTION_REQUIRED`.

## Owner workflow

From Windows PowerShell 5.1 at the repository root, run:

```powershell
npm run capture:lp170:owner-evidence -- -Repository <owner/repo> -ProjectRef <supabase-project-ref>
```

The consolidated collector resolves `supabase` directly or through `npx --yes supabase`, queries only GitHub workflow and Supabase Edge Function metadata, rejects secret-shaped output without echoing it, and atomically writes canonical UTF-8-without-BOM/LF JSON. It deliberately produces partial evidence: the owner must review it and provide explicit sanitized attestations for monitoring dimensions, service health, backup and restore posture, rollback ownership/rehearsal, and incident contacts/escalation. Never place tokens, keys, passwords, service-role values, connection strings, headers, cookies, raw authentication responses, or secret values in evidence.

## Deterministic tooling and remaining blockers

`npm run audit:lp170` and `npm run certify:lp170` regenerate governed reports; `npm run verify:lp170` compares two independent generations byte-for-byte with committed reports; `npm run test:lp170` exercises fail-closed and non-mutation contracts. Protected identities use canonical Git blobs rather than working-tree line endings.

Remaining blockers are complete monitoring/alert evidence, backup metadata, restoration capability and rehearsal, rollback identity/ownership/validation/rehearsal, and named incident/support/escalation ownership. They are enumerated in `reports/lp170/operational-blockers.json`.

## Authorization boundary and recommendation

Deployment: **NOT_AUTHORIZED**. Activation: **NOT_AUTHORIZED**. Distribution: **NOT_AUTHORIZED**. Public launch: **NOT_AUTHORIZED**. LP170 may inform only a future LP167 reassessment. The next milestone should ingest reviewed owner evidence, reconcile it deterministically, and retain `NOT_READY` for every incomplete requirement; it must not deploy or launch.
