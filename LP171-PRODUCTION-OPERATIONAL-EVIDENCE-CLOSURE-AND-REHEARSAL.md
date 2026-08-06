# LP171 — Production Operational Evidence Closure and Rehearsal

## Purpose, scope, and boundary

LP171 consumes LP170's truthful `NOT_READY` baseline without rewriting it. It closes procedures and performs deterministic, local/tabletop rehearsals; it does not deploy, mutate production, restore, roll back, activate counties, distribute an app, trigger a workflow, or authorize launch. Gridly remains **NOT_READY** and every production authorization remains **NOT_AUTHORIZED**.

The product priority remains Awareness Platform First, Route Intelligence Second. The engineering order is Audit First, Patch Second. A procedure is not a rehearsal; a rehearsal is not production proof; backups do not prove restoration; logs do not prove monitoring or alerting; and a prior release identity does not prove rollback capability.

## Evidence and classifications

Sources are committed LP170 reports, canonical Git blobs, the empty fail-closed LP171 attestation ledger, read-only GitHub/Supabase metadata, and explicit owner attestations. `PASS` requires every governed configuration, evidence, ownership, procedure, validation, rehearsal, and applicable production-proof requirement. Otherwise LP171 uses `PARTIAL_EVIDENCE`, `OWNER_ACTION_REQUIRED`, `SOURCE_UNAVAILABLE`, `NOT_CONFIGURED`, `NOT_TESTED`, `REHEARSAL_REQUIRED`, `REHEARSAL_PASS`, `REHEARSAL_FAIL`, `NOT_READY`, or `NOT_APPLICABLE`. Production behavioral proof necessarily remains post-launch evidence.

## Monitoring and backup closure

The monitoring matrix governs availability; startup and critical JavaScript errors; search, address, destination, and routing failures; Supabase, Storage, and Edge Functions; incident ingestion and report submission; authentication and GitHub deployment failures; public-origin availability; and configuration drift. Each needs signal identity/source, access, owner, trigger, destination, response, validation method, and latest result. Existing browser, host, GitHub, and Supabase capabilities should be evaluated before paid services. Current evidence is unavailable and alerting is not inferred.

Backup evidence requires the Supabase plan capability, frequency, retention, PITR, latest status, owner, access path, verification, and limitations. Because safe CLI/API proof is not established, the owner must attest from the dashboard without copying billing or secret data. Backup and restoration remain separate.

## Production restoration runbook

1. Qualify severity and preserve logs, release identity, and configuration evidence.
2. The named restoration authority approves; an unknown authority is an abort condition.
3. Select an owner-verified backup and record identity/coverage without secrets.
4. Confirm the target explicitly; abort if it is ambiguous or production authorization is absent.
5. Plan downtime and user communication with the communication owner.
6. Reconcile database consistency, Storage object/metadata consistency, Edge Function versions, and configuration dependencies.
7. Validate schema, critical reads, Storage access, functions, application smoke paths, monitoring, and evidence identity.
8. Abort on missing evidence, owner, backup identity, consistency plan, validation failure, scope drift, or unsafe credentials; escalate through the incident timeline.

The deterministic tabletop/local-fixture rehearsal completed `REHEARSAL_PASS`: inputs, unknown ownership, validation, and abort conditions were exercised without contacting production or mutating anything. Production restoration remains `NOT_TESTED`.

## Rollback runbook and rehearsal

Rollback is independently governed for static runtime, GitHub deployment, Edge Functions, configuration, database/schema, Storage metadata/configuration, county activation, distribution, and public-launch reversal. For each, record current and prior known-good identities, preservation, procedure, owner, validation, abort criteria, forward fix, rehearsal, and production status. Database changes must explicitly choose reversible migration, forward-fix only, restoration, manual correction, or unsupported rollback.

The local fixture/Git-blob identity selection rehearsal completed `REHEARSAL_PASS`; it selected preserved baseline `68c30eb`, validated identity deterministically, and performed no push, deployment, workflow, Supabase request, configuration change, activation, distribution, or launch. Domain ownership/evidence remains incomplete and production rollback remains `NOT_TESTED`.

## Incident-response runbook

Classify SEV1 critical, SEV2 major, SEV3 degraded, or SEV4 informational; preserve evidence; establish impact; contain through safe client/service boundaries; and escalate on the owner-defined timeline. Primary/backup operations, technical escalation, support, rollback/restoration authority, communications, evidence preservation, and post-review owners require explicit attestations. No identities are invented; all currently remain owner action required.

## Launch-day checklist

After future explicit owner authorization only: verify prerequisites; monitoring access; owner availability; backup status; rollback artifacts; incident channel and support; production origin; deployment evidence capture; smoke checks; monitoring window; stop-launch and rollback criteria; and the authorization boundary. Any missing owner, evidence, alert, backup, artifact, or validation is a stop-launch condition. This checklist never authorizes launch.

## Owner workflow and reassessment

On the authoritative Windows PowerShell 5.1 workstation, complete `evidence/lp171/owner-attestations.json`, then run:

```powershell
npm run capture:lp171:owner-evidence -- -Repository <owner/repo> -ProjectRef <project-ref>
```

The workflow requires `gh`, prefers direct `supabase` and otherwise uses `npx --yes supabase`; it discards raw authenticated output, validates secret-safe metadata-only attestations, and atomically regenerates reports. Remaining blockers are monitoring, backup, named operational/support ownership, per-domain rollback evidence, and launch-day availability. After closure, recommend a separate explicit LP167 reassessment—not automatic authorization.
