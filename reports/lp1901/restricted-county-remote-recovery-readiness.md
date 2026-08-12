# LP190.1 Restricted County Remote Recovery Readiness

**Overall classification: `OWNER_EXECUTION_REQUIRED`.** No current owner-local probe evidence is committed. Supabase Storage metadata cannot prove SHA-256 identity; an owner-triggered byte download and local length/SHA-256 recomputation are required.

## Governed remote contract

- Provider: Supabase Storage
- Bucket: `certified-addresses`
- Prefix: `lp104/txgio-addresses/`
- Credentials: `SUPABASE_URL` (or the LP147 fallback `GRIDLY_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`
- Quarantine: ignored `evidence/lp1901/recovered-payloads.local/` only
- Production writes: none
- Activations: none

| FIPS | County | Current classification |
|---|---|---|
| 48061 | Cameron | `OWNER_CREDENTIALS_REQUIRED` |
| 48073 | Cherokee | `OWNER_CREDENTIALS_REQUIRED` |
| 48113 | Dallas | `OWNER_CREDENTIALS_REQUIRED` |
| 48121 | Denton | `OWNER_CREDENTIALS_REQUIRED` |
| 48135 | Ector | `OWNER_CREDENTIALS_REQUIRED` |
| 48229 | Hudspeth | `OWNER_CREDENTIALS_REQUIRED` |
| 48329 | Midland | `OWNER_CREDENTIALS_REQUIRED` |
| 48377 | Presidio | `OWNER_CREDENTIALS_REQUIRED` |
| 48401 | Rusk | `OWNER_CREDENTIALS_REQUIRED` |
| 48425 | Somervell | `OWNER_CREDENTIALS_REQUIRED` |
| 48441 | Taylor | `OWNER_CREDENTIALS_REQUIRED` |

The runtime remains **243 operational / 11 restricted**. Even partial exact recovery is not statewide restoration readiness. If all 11 quarantined objects verify as `REMOTE_OBJECT_EXACT_MATCH`, the next milestone is **LP190.2 — Exact Governed Payload Restoration + LP134 Recertification Preparation**.
