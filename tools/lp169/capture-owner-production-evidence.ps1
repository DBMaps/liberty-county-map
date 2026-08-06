param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9]{20}$')][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$Repository,
  [string]$ReviewDirectory = (Join-Path $env:TEMP 'gridly-lp169-owner-review')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (Test-Path $ReviewDirectory) { Remove-Item $ReviewDirectory -Recurse -Force }
New-Item -ItemType Directory -Path $ReviewDirectory | Out-Null

function Write-SafeJson([string]$Name, $Data) {
  $Data | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8NoBOM (Join-Path $ReviewDirectory $Name)
}

# Requires an existing `supabase login` session. Every projection intentionally
# drops token, key, connection, URL, and secret-value fields.
$Projects = @(supabase projects list --output json | ConvertFrom-Json |
  Where-Object { $_.id -eq $ProjectRef } |
  Select-Object id,name,region,status)
Write-SafeJson 'supabase-project-safe.json' $Projects

$SecretNames = @(supabase secrets list --project-ref $ProjectRef --output json |
  ConvertFrom-Json | ForEach-Object { $_.name } | Where-Object { $_ } |
  Sort-Object -Unique | ForEach-Object { [pscustomobject]@{ name = $_; status = 'PRESENT' } })
Write-SafeJson 'supabase-secret-names-safe.json' $SecretNames

$Functions = @(supabase functions list --project-ref $ProjectRef --output json |
  ConvertFrom-Json | Select-Object name,slug,status,version | Sort-Object name,slug)
Write-SafeJson 'supabase-functions-safe.json' $Functions

# Requires an existing `gh auth login` session with read access. GitHub never
# returns Actions secret values through these list commands.
$RepoMetadata = gh repo view $Repository --json nameWithOwner,isPrivate,defaultBranchRef | ConvertFrom-Json
Write-SafeJson 'github-repository-safe.json' ([pscustomobject]@{
  nameWithOwner = $RepoMetadata.nameWithOwner
  isPrivate = $RepoMetadata.isPrivate
  defaultBranch = $RepoMetadata.defaultBranchRef.name
})
$RepoSecrets = @(gh secret list --repo $Repository --app actions --json name | ConvertFrom-Json |
  Select-Object -ExpandProperty name | Sort-Object -Unique |
  ForEach-Object { [pscustomobject]@{ name = $_; status = 'PRESENT' } })
Write-SafeJson 'github-secret-names-safe.json' $RepoSecrets
$Workflows = @(gh workflow list --repo $Repository --json name,state,path | ConvertFrom-Json | Sort-Object path)
Write-SafeJson 'github-workflows-safe.json' $Workflows
$ActionsPermissions = gh api "repos/$Repository/actions/permissions" | ConvertFrom-Json |
  Select-Object enabled,allowed_actions,sha_pinning_required
Write-SafeJson 'github-actions-permissions-safe.json' $ActionsPermissions
$Environments = @(gh api --paginate "repos/$Repository/environments" --jq '.environments[] | {name: .name, protection_rule_count: (.protection_rules | length)}' |
  ForEach-Object { $_ | ConvertFrom-Json } | Sort-Object name)
Write-SafeJson 'github-environments-safe.json' $Environments
foreach ($Environment in $Environments) {
  $EnvironmentSecrets = @(gh secret list --repo $Repository --env $Environment.name --app actions --json name | ConvertFrom-Json |
    Select-Object -ExpandProperty name | Sort-Object -Unique |
    ForEach-Object { [pscustomobject]@{ environment = $Environment.name; name = $_; status = 'PRESENT' } })
  Write-SafeJson ("github-environment-{0}-secret-names-safe.json" -f ($Environment.name -replace '[^A-Za-z0-9_.-]','_')) $EnvironmentSecrets
}

# Requires an already configured read-only psql session (for example, owner-set
# PG* environment variables). Queries inspect metadata and aggregates only.
$Sql = @'
SELECT json_build_object('schemas',coalesce(json_agg(x ORDER BY x), '[]'::json)) FROM (SELECT schema_name AS x FROM information_schema.schemata WHERE schema_name IN ('public','storage','history_capture')) q;
SELECT json_build_object('objects',coalesce(json_agg(x ORDER BY x), '[]'::json)) FROM (SELECT table_schema||'.'||table_name AS x FROM information_schema.tables WHERE table_schema IN ('public','storage','history_capture')) q;
SELECT json_build_object('columns',coalesce(json_agg(x ORDER BY x), '[]'::json)) FROM (SELECT table_schema||'.'||table_name||':'||column_name||':'||data_type AS x FROM information_schema.columns WHERE table_schema IN ('public','storage','history_capture')) q;
SELECT json_build_object('routines',coalesce(json_agg(x ORDER BY x), '[]'::json)) FROM (SELECT routine_schema||'.'||routine_name||':'||routine_type AS x FROM information_schema.routines WHERE routine_schema IN ('public','storage','history_capture')) q;
SELECT json_build_object('constraints',coalesce(json_agg(x ORDER BY x), '[]'::json)) FROM (SELECT constraint_schema||'.'||table_name||':'||constraint_name||':'||constraint_type AS x FROM information_schema.table_constraints WHERE constraint_schema IN ('public','storage','history_capture')) q;
SELECT json_build_object('indexes',coalesce(json_agg(x ORDER BY x), '[]'::json)) FROM (SELECT schemaname||'.'||tablename||':'||indexname AS x FROM pg_indexes WHERE schemaname IN ('public','storage','history_capture')) q;
SELECT json_build_object('triggers',coalesce(json_agg(x ORDER BY x), '[]'::json)) FROM (SELECT trigger_schema||'.'||event_object_table||':'||trigger_name||':'||event_manipulation AS x FROM information_schema.triggers WHERE trigger_schema IN ('public','storage','history_capture')) q;
SELECT json_build_object('rowSecurity',coalesce(json_agg(x ORDER BY x), '[]'::json)) FROM (SELECT n.nspname||'.'||c.relname||':'||c.relrowsecurity::text AS x FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','storage','history_capture')) q;
SELECT json_build_object('policies',coalesce(json_agg(x ORDER BY x), '[]'::json)) FROM (SELECT schemaname||'.'||tablename||':'||policyname||':'||cmd AS x FROM pg_policies WHERE schemaname IN ('public','storage','history_capture')) q;
SELECT json_build_object('buckets',coalesce(json_agg(x ORDER BY x), '[]'::json)) FROM (SELECT id||':'||public::text AS x FROM storage.buckets) q;
SELECT json_build_object('objectCounts',coalesce(json_agg(x ORDER BY x), '[]'::json)) FROM (SELECT bucket_id||':'||count(*)::text AS x FROM storage.objects GROUP BY bucket_id) q;
SELECT json_build_object('certifiedAddressObjects',coalesce(json_agg(x ORDER BY x), '[]'::json)) FROM (SELECT bucket_id||':'||name||':'||coalesce((metadata->>'size'),'UNKNOWN')||':'||coalesce((metadata->>'mimetype'),'UNKNOWN') AS x FROM storage.objects WHERE bucket_id='certified-addresses') q;
'@
$Sql | psql --no-psqlrc --quiet --tuples-only --no-align | Set-Content -Encoding utf8NoBOM (Join-Path $ReviewDirectory 'database-storage-metadata-safe.jsonl')

Get-ChildItem $ReviewDirectory -File | Sort-Object Name |
  Select-Object Name,Length,@{Name='Sha256';Expression={(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()}} |
  ConvertTo-Json -Depth 3 | Set-Content -Encoding utf8NoBOM (Join-Path $ReviewDirectory 'capture-manifest-safe.json')

Write-Host "Safe review bundle created at $ReviewDirectory"
Write-Host 'Review it, create the governed draft described in evidence/lp169/README.md, then run the sanitizer. Raw or unreviewed output must never be copied into the repository.'
