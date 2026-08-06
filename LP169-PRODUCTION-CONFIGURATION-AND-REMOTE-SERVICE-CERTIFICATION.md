# LP169 — Production Configuration & Remote Service Certification

## Purpose and decision

LP169 provides a deterministic, redacted, read-only certification boundary for production configuration and remote Supabase/Storage state. Repository evidence was available, but authenticated owner evidence was not. The resulting overall classification is **`SOURCE_UNAVAILABLE_REMOTE_VERIFICATION_REQUIRED`**. This is not proof that a service or control is absent. It does not advance LP168's `NOT_READY` finding, authorize deployment, activate a county, authorize distribution, or launch Gridly.

## Audit boundary and evidence sources

The audit inventories tracked example environment files, GitHub workflow location, `supabase/config.toml`, the local Supabase link marker (presence only), migrations, Edge Function source, Capacitor/PWA/native configuration, package lock state, LP146/LP147 storage evidence, and canonical Git blobs for protected artifacts. Local Supabase metadata is repository evidence only and is never treated as remote proof. No environment value is read. No network or authenticated remote command is run automatically.

The database expectation is derived from tracked migrations and runtime use. The Storage expectation is 254 address packages and 254 address runtime certificates in `certified-addresses`. Runtime manifests, destination assets, and crossing assets are currently repository-hosted, so Supabase Storage certification for those categories is `NOT_APPLICABLE`.

## Secret-redaction policy

Governed reports permit identifiers, status classifications, counts, safe hashes, and method identifiers only. Secret values, API keys, passwords, service-role/access/refresh tokens, signing keys, private certificates, and complete connection strings are prohibited. The evidence ingester rejects value-bearing or raw-output fields, duplicate identifiers, invalid statuses, and recognizable credential patterns. Public client configuration is classified separately from server secrets, but its value is still not recorded.

## Findings

### Production configuration and runtime alignment

The repository contract identifies public runtime, server secret, build, Supabase, Storage, app-distribution, and owner-governed requirements. Native identifiers and the locked Node build source are present. Production presence and intended-project alignment for remotely managed values remain unavailable. The Edge Function source contains local-development origins in its fallback allowlist; production override evidence is required. The certified bucket default is present. Production origins, callbacks, redirects, deep links, support URL, and legal URL need owner evidence.

### Supabase and database

The repository contains Supabase configuration, eleven migrations, and the `gridly-geocode` Edge Function. The production project identity, region, availability, API/auth settings, deployed migration compatibility, tables, columns, types, constraints, indexes, policies, triggers, extensions, and deployed function are `SOURCE_UNAVAILABLE`. Repository configuration alone does not certify remote state.

### Storage and policies

Remote bucket identity, 254 package objects, 254 certificate objects, object lengths/hashes/content types, service read compatibility, and policies remain `SOURCE_UNAVAILABLE`. Anonymous/public write denial and required runtime read access are not inferred. No object or policy was changed.

### Security

The governed repository-pattern scan does not report committed secret material, and no service-role credential is identified in browser-delivered configuration. However, production CORS, remote credentials by name, Storage write policy, and administrative configuration require owner evidence. No penetration testing, privilege escalation, rotation, or session invalidation occurred.

## Owner-assisted evidence process

Prerequisites: Windows PowerShell 7, Git, Node/npm, Supabase CLI authenticated to the intended project, the authenticated Supabase Dashboard SQL Editor for database metadata, and GitHub CLI authenticated with repository-metadata access. Run from a clean clone. Review all intermediate output on screen; never redirect raw CLI output into the repository. Commands below emit names/status/counts only.

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
git switch main
git pull --ff-only
if ((git status --porcelain).Count) { throw 'Working tree must be clean' }

# Safe project identifier: hash the linked ref; do not print the ref.
$ProjectRef = (supabase status --output json 2>$null | ConvertFrom-Json).project_ref
if (-not $ProjectRef) { throw 'Supabase project identity unavailable' }
$ProjectHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($ProjectRef))).ToLower()
[pscustomobject]@{ identifier='SUPABASE_PROJECT_IDENTITY'; status='PRESENT'; redactedSha256=$ProjectHash }

# Secret names only. This pipeline deliberately discards every value field.
supabase secrets list --project-ref $ProjectRef --output json |
  ConvertFrom-Json | ForEach-Object { $_.name } | Sort-Object -Unique |
  ForEach-Object { [pscustomobject]@{ identifier=('SECRET:' + $_); status='PRESENT' } } |
  ConvertTo-Json -Depth 3

# Deployed function names/status only.
supabase functions list --project-ref $ProjectRef --output json |
  ConvertFrom-Json | Select-Object name,status | Sort-Object name | ConvertTo-Json -Depth 3

# GitHub secret names only (never request values).
gh secret list --app actions --json name | ConvertFrom-Json |
  Select-Object -ExpandProperty name | Sort-Object -Unique |
  ForEach-Object { [pscustomobject]@{ identifier=('GITHUB_SECRET:' + $_); status='PRESENT' } } |
  ConvertTo-Json -Depth 3

# Presence-only process environment check; values are never expanded.
$Required = 'SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','GRIDLY_CERTIFIED_ADDRESS_BUCKET'
$Required | ForEach-Object {
  [pscustomobject]@{ identifier=$_; status=if ([Environment]::GetEnvironmentVariable($_)) {'PRESENT'} else {'ABSENT'} }
} | ConvertTo-Json -Depth 3
```

Database and Storage metadata should be captured only with an owner-approved read-only account. Use the governed LP169.3 SQL file in Supabase SQL Editor, export its single result as CSV, and ingest it with the Node command:

```powershell
# In Supabase SQL Editor, run tools/lp169/lp169-owner-metadata-query.sql
\pset tuples_only on
\pset format unaligned
SELECT table_schema || '.' || table_name FROM information_schema.tables WHERE table_schema IN ('public','history_capture') ORDER BY 1;
SELECT routine_schema || '.' || routine_name FROM information_schema.routines WHERE routine_schema IN ('public','history_capture') ORDER BY 1;
SELECT schemaname || '.' || tablename || ':' || policyname FROM pg_policies WHERE schemaname IN ('public','storage','history_capture') ORDER BY 1;
SELECT id || ':' || public::text FROM storage.buckets ORDER BY id;
SELECT bucket_id || ':' || count(*)::text FROM storage.objects GROUP BY bucket_id ORDER BY bucket_id;
\q
```

Expected safe output is object names, policy names, bucket IDs/public flags, and aggregate counts—never rows, object bodies, definitions, credentials, or URLs with tokens. Hash verification should be performed only against downloaded public/read-authorized artifacts in a temporary directory outside the repository, using `Get-FileHash -Algorithm SHA256`; delete the directory afterward. Do not use a command if it cannot suppress sensitive fields.

Create `evidence/lp169/owner-evidence.json` manually from the reviewed safe results using canonical records such as:

```json
{
  "records": [
    {
      "attestation": "OWNER_ATTESTED",
      "identifier": "SUPABASE_PROJECT",
      "method": "SUPABASE_CLI_REDACTED_PROJECT_CHECK",
      "status": "PASS"
    }
  ],
  "schemaVersion": 1
}
```

Do not paste raw output. Each status must be directly supported. Partial evidence stays partial, and missing evidence cannot become `PASS`.

## Certification decisions and blockers

Production configuration, runtime alignment, security configuration, origins, and app distribution require owner action. Supabase, database objects, Storage objects, and Storage policies are source-unavailable. Deployment and statewide activation configuration are `NOT_READY`. Blockers apply to deployment, activation, and public launch. A later certification may advance LP168 only after complete redacted evidence verifies intended-project alignment and all remote requirements.

## Protected-system preservation

LP169 adds tooling, reports, tests, documentation, and an evidence schema only. Canonical Git blobs—not working-tree bytes—govern protected identity. Shared Reports, Route Watch, awareness filtering, hazard lifecycle, alerts, synchronization, `js/app.js`, routing, matching, search, notifications, county membership, packages, manifests, schema, policies, functions, secrets, and production Storage were not modified.

## Exact Windows validation procedure

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
git switch main
git pull --ff-only
npm ci

1..2 | ForEach-Object {
  npm run audit:lp169
  npm run certify:lp169
  npm run verify:lp169
  npm run test:lp169
}
npm run test:lp168
npm run test:lp167
git diff --exit-code -- js/app.js
git diff --exit-code -- reports/lp162 reports/lp163 reports/lp164 reports/lp165 reports/lp166 reports/lp167 reports/lp168
git diff --check
if ((git status --porcelain).Count) { throw 'Validation changed the working tree' }
```

When validating an uncommitted LP169 change, capture `git status --short` before execution and compare it byte-for-byte afterward instead of requiring an empty tree. After commit, the exact procedure above must leave the repository clean.

## Merge recommendation

**Merge the certification artifacts and tooling only. Do not deploy, activate Texas, distribute an app, or launch.** Re-run certification after safe owner evidence is available.
