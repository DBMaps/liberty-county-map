# V336 — DriveTexas Shadow Pipeline Validation Framework

## Scope

V336 defines validation governance for a future DriveTexas shadow pipeline. It is audit-only architecture and does not implement ingestion, acquisition, feeds, APIs, polling, network calls, storage, shadow stores, Supabase writes, markers, alerts, awareness cards, routing, notifications, map layers, or production incidents.

Gridly remains Awareness Platform First and Route Intelligence Second. Official-source events remain separate from community reports. Detour and alternate-route language remains awareness-only and is not routing guidance.

## Shadow Pipeline Stages

Future validation governance is organized around the following non-implemented shadow pipeline stages:

```text
Acquisition
↓
Validation
↓
Normalization
↓
Identity
↓
Lifecycle
↓
Trust
↓
Shadow Incident
↓
Audit
```

### 1. Acquisition Stage

Success criteria:

- Source is recognized as an approved/sanctioned DriveTexas export or future approved source class.
- Source attribution is available and retained.
- Export or source timestamp is available.
- Access method, retention expectations, and replay/archive expectations are documented before any implementation.

### 2. Validation Stage

Success criteria:

- Schema is valid for the sanctioned sample/export contract.
- Required fields are present.
- Payload is contract compliant.
- Field types, enumerations, timestamps, and lifecycle status values are auditable.

### 3. Normalization Stage

Success criteria:

- Canonical Gridly awareness type is assigned.
- DriveTexas vocabulary is mapped to the V326/V327 vocabulary rules.
- Unsupported, ambiguous, or unmapped values are quarantined for audit rather than silently promoted.
- Detour language remains awareness-only and is not converted into routing instructions.

### 4. Identity Stage

Success criteria:

- Stable shadow identity is generated from approved identity inputs.
- Identity is preserved across updates.
- Reopen identity is preserved when the official lifecycle indicates a reopening of a prior event.
- Identity failures do not create production incidents.

### 5. Lifecycle Stage

Success criteria:

- Active state is detected.
- Updated state is detected.
- Removed state is detected.
- Reopened state is detected.
- Stale state is detected.
- Lifecycle interpretation remains official-source scoped and does not merge community reports into official lifecycle authority.

### 6. Trust Stage

Success criteria:

- Trust state is assigned.
- Trust state is valid for the source and evidence context.
- Community evidence may be retained only as supporting context and never as official event authority.

### 7. Shadow Incident Stage

Success criteria:

- Audit-ready shadow record is produced for validation review only.
- Source attribution is retained.
- No production incident, marker, alert, notification, map layer, route, or awareness card is created.

### 8. Audit Stage

Success criteria:

- Audit row is generated.
- Validation trace is retained.
- Failure class, quarantine/rejection decision, and recommendation are retained for governance review.

## Validation Metrics

The future shadow validation program should report these metrics without implying production approval:

| Metric | Purpose |
| --- | --- |
| `recordsReceived` | Count of records presented to the validation framework. |
| `recordsValidated` | Count passing schema and contract validation for shadow review. |
| `recordsRejected` | Count rejected before shadow review. |
| `schemaFailures` | Count with invalid schema shape or types. |
| `contractFailures` | Count that violates sanctioned payload contracts. |
| `identityMatches` | Count matched to an existing stable identity. |
| `identityFailures` | Count unable to produce or preserve identity. |
| `geometryReady` | Count with adequate location/geometry for audit review. |
| `awarenessOnly` | Count explicitly constrained to awareness-only interpretation. |
| `unsupported` | Count with unsupported vocabulary, lifecycle, geometry, or source values. |
| `lifecycleTransitionsDetected` | Count of active/update/remove/stale/reopen transitions detected. |
| `reopenEventsDetected` | Count of official reopen events detected. |
| `removeEventsDetected` | Count of official removal/end events detected. |
| `trustAssignmentsSucceeded` | Count with valid trust assignment. |
| `trustAssignmentFailures` | Count with missing or invalid trust assignment. |
| `auditRowsGenerated` | Count of audit rows produced. |

## Failure Classes

Minimum failure classes:

- `schema_failure` — record shape, type, or schema validation fails.
- `contract_failure` — required contract fields or sanctioned payload requirements are missing or invalid.
- `identity_failure` — stable identity cannot be generated, matched, or preserved.
- `geometry_failure` — location/geometry is missing, contradictory, unsupported, or not audit-ready.
- `lifecycle_failure` — active/update/remove/reopen/stale lifecycle status cannot be interpreted safely.
- `timestamp_failure` — source, export, update, or lifecycle timestamps are missing, invalid, or contradictory.
- `trust_failure` — trust state cannot be assigned or is outside the approved trust vocabulary.

## Quarantine Rules

### Accepted

A record may be accepted into audit-only shadow validation when:

- Source and attribution are recognized.
- Required timestamps are available.
- Schema and contract checks pass.
- Canonical vocabulary is mapped.
- Stable identity is generated or matched.
- Lifecycle status is interpretable.
- Trust state is valid.
- The record remains non-production and non-user-facing.

### Quarantined

A record should be quarantined for governance review when:

- Vocabulary is unsupported, ambiguous, or unmapped.
- Geometry is incomplete but enough source context exists for manual audit.
- Identity cannot be confidently matched but the source record is otherwise traceable.
- Lifecycle state is ambiguous, stale, contradictory, or needs replay comparison.
- Timestamp quality is questionable but not clearly invalid.
- Trust assignment requires review.

Quarantined records must not become production incidents or user-facing UI elements.

### Rejected

A record should be rejected from shadow validation when:

- Source is unrecognized or attribution is unavailable.
- Required schema or contract fields are absent.
- Required timestamps are invalid or absent.
- The record cannot be traced to a sanctioned export/sample context.
- The record would require prohibited production ingestion, storage, network access, UI, map, routing, alert, or notification behavior.

## Promotion Rules and Non-Approval Boundaries

Validation success does not imply production approval.

Shadow pipeline success does not imply user-facing approval.

Audit success does not imply production ingestion approval.

Production ingestion is not approved by V336. Any future production ingestion, storage, UI, map, alert, notification, routing, marker, layer, awareness-card, or production incident behavior requires a separate explicit approval gate.

## Required Conclusions

- Production ingestion is not approved.
- Validation success does not imply production approval.
- Shadow pipeline success does not imply user-facing approval.
- Official/community separation remains preserved.
- Detour language remains awareness-only.
- Gridly remains an awareness platform.
