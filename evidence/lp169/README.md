# LP169 owner evidence drop

Place only the redacted `owner-evidence.json` produced by the procedure in the LP169.1 certification document here. Never place raw CLI output, environment files, tokens, URLs containing credentials, or secret values in this directory.

Run `tools/lp169/capture-owner-production-evidence.ps1` only in the owner's authenticated Windows environment. It writes a names/status/counts-only review bundle under `%TEMP%`, not into this directory. After reviewing the bundle and adding owner-controlled origin/legal classifications, create a schema-v2 draft and run:

```powershell
node tools/lp169/ingest-owner-evidence.mjs "$env:TEMP\gridly-lp169-owner-evidence-draft.json"
```

The all-or-nothing ingester rejects value-bearing fields, unknown fields, duplicate identities, invalid statuses, authorization/cookie material, recognizable credentials, and invalid provenance without echoing input. It adds the deterministic record identity and writes canonical LF JSON only after the complete draft passes sanitization. Partial evidence must use truthful statuses and cannot certify a category whose required detailed records are absent.
