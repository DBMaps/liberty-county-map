# LP175 — Production Metadata Capture Completion

## Root cause and implementation

LP173.1 accepted a locally transcribed, ignored record only after the operator supplied every provenance field, including `sourceArtifactIdentity`. It did not ingest an authoritative artifact or derive that artifact's identity. This left a deterministic-ingestion gap and invited avoidable manual copying even though LP173.1 correctly rejected incomplete provenance.

LP175 adds a strict, metadata-only Supabase capture envelope and `npm run capture:lp175`. The collector reads the ignored authoritative capture as bytes, rejects BOM, CRLF, secret-shaped content, extra fields, incomplete provenance, non-production envelopes, and incomplete observations. It calculates `sha256:` over the exact authoritative artifact bytes and maps only explicit fields into the existing LP173.1 contract. LP173.1 then validates, classifies, and writes its governed discovery output. No authorization policy, runtime artifact, or protected artifact is changed.

The deterministic mappings are:

* managed scheduled backups → `backup.backupProvider`;
* daily schedule → `backup.backupFrequency`;
* exact latest successful backup metadata → `backup.latestSuccessfulBackupMetadata`;
* explicit PITR boolean → `backup.pitrAvailability`;
* source-reported timestamp → `monitoring.evidenceTimestamp`;
* active Supabase Observability / Unified Logs → `monitoring.monitoringProviders`;
* the exact required service set (API Gateway, Database, PostgREST, Auth, Edge Functions, Storage, Realtime) → `monitoring.monitoredProductionServices`.

Retention policy, alert destinations, and alert thresholds are deliberately not inferred because the described observations do not establish them.

## Capture workflow and current truthful state

Place the sanitized authoritative provider export at `evidence/lp175/supabase-production-metadata.capture.json`, using the committed template as the exact schema, and run:

```text
npm run capture:lp175
npm run build:lp173
npm run build:lp174
```

No authoritative capture artifact was present in the repository or execution environment for this milestone. The prose description of observations is not an artifact and cannot truthfully supply an exact provider timestamp, latest-backup value, or artifact hash. Therefore LP175 does not fabricate a capture: the committed reports remain at zero `MACHINE_VERIFIED` fields, ten `SOURCE_UNAVAILABLE` machine-verifiable fields, and `NOT_READY_FOR_AUTHORIZATION_REASSESSMENT`. The single remaining reason is absence of the sanitized authoritative capture artifact with complete source provenance. All deployment, activation, distribution, public-launch, production-restore, and production-rollback states remain `NOT_AUTHORIZED`.
