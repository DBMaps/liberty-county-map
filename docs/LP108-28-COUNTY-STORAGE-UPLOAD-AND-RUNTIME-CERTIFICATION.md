# LP108 — 28-County Storage Upload and Runtime Certification

## Decision and starting state

LP107 established **local-only** readiness for exactly 28 launched counties. Local readiness is not remote readiness, Storage presence is not runtime certification, and runtime certification requires all 28 counties plus the safety and business controls.

Discovery found the deployed/source certified-address adapter was **effectively Liberty-only**: it contained one fixed Liberty identity and fixed object paths. LP108 replaces that fixed selection with the governed 28-county identity inventory. Selection requires consistent county/FIPS/county-ID evidence, chooses one package before retrieval, and fails closed for conflict, ambiguity, or unsupported counties. The existing Dayton/77535 Liberty evidence remains for compatibility. Business/place requests remain outside this provider.

## Governed private Storage contract

The bucket is `certified-addresses`. Each LP107 county requires these private objects (28 of each, 56 total):

* `lp104/txgio-addresses/<county>-<fips>.addresses.jsonl.gz`
* `lp104/txgio-addresses/<county>-<fips>.runtime-certificate.json`

The cohort is sourced from the maintained `initial28` county manifest and checked against the exact 28-entry Edge identity inventory. The tool hashes and sizes local packages, applies the LP104.5 certificate contract, checks files for mutation, and writes reports atomically. It does not create public or signed URLs. Upload uses `x-upsert: false`; matching objects are not uploaded, and mismatches are refused unless `--replace-mismatched` accompanies `--upload`.

## Commands

```bash
node tools/lp108/sync-certified-address-storage.mjs --plan
node tools/lp108/sync-certified-address-storage.mjs --verify-remote
node tools/lp108/sync-certified-address-storage.mjs --upload
node tools/lp108/sync-certified-address-storage.mjs --upload --verify-remote
node tools/lp108/sync-certified-address-storage.mjs --verify-remote --county-fips 48291
node tools/lp108/certify-remote-runtime.mjs
npm run test:lp108
```

Remote Storage requires `SUPABASE_URL` and the server-authorized `SUPABASE_SERVICE_ROLE_KEY`. Runtime certification accepts `GRIDLY_GEOCODE_FUNCTION_URL` (or derives it from `SUPABASE_URL`) and `SUPABASE_ANON_KEY`. Secrets are environment-only and redacted. Use the repository convention to deploy after verification: `npx supabase functions deploy gridly-geocode --project-ref <project-ref>`.

## Certification privacy and safeguards

The runtime tool deterministically selects one valid record from each existing gzip by the SHA-256 ordering of record IDs and keeps the query in memory only. Tracked code and generated JSON evidence store county/FIPS and hashes, never the residential query. Controls cover a package-proven missing number, road-only input, conflicting county evidence, unsupported county, and business search. No interpolation, approximate match, nearby-house substitution, or road-only residential promotion was introduced. Exact house number, canonical road, package integrity, certificate acceptance, provider boundary, and no-fallback behavior remain enforced.

## Current result and blocker

Local plan: 28/28 packages valid, 28/28 certificates valid, and 56 object paths planned. **REMOTE EXECUTION NOT COMPLETED.** This environment has a linked project reference but no `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, or authenticated deployment evidence. Consequently remote object totals, deployment, 28 remote exact cases, negative controls, and business control are not certified; `readyFor28CountyRuntime` remains false.

Generated evidence is ignored under `reports/lp108/`: `storage-plan.json`, `storage-verification.json` when remote verification runs, `remote-runtime-certification.json`, and `lp108-summary.json`.

## Rollback and exclusions

Rollback is code-only: redeploy the prior `gridly-geocode` commit. Storage replacement is never automatic; do not delete the verified Liberty objects. LP108 did not rebuild packages, change certificates, query source agencies, insert addresses, alter UI or business search, resume LP106, expose Storage, or modify protected reporting/route/hazard systems.
