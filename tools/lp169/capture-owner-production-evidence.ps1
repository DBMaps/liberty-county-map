param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9]{20}$')][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$Repository,
  [string]$ReviewDirectory = (Join-Path $env:TEMP 'gridly-lp169-owner-review')
)

. (Join-Path $PSScriptRoot 'owner-evidence-normalization.ps1')

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ReviewDirectory = [System.IO.Path]::GetFullPath($ReviewDirectory)
$ReviewParent = Split-Path -Parent $ReviewDirectory
if (-not (Test-Path -LiteralPath $ReviewParent)) { New-Item -ItemType Directory -Path $ReviewParent -Force | Out-Null }
$CaptureDirectory = Join-Path $ReviewParent ('.lp169-capture-{0}' -f ([Guid]::NewGuid().ToString('N')))
New-Item -ItemType Directory -Path $CaptureDirectory | Out-Null

# Windows PowerShell 5.1's UTF8 cmdlet encoding emits a BOM and does not know
# utf8NoBOM. Use the .NET constructor available on .NET Framework instead.
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Assert-SafeContent([string]$Content) {
  $SecretPattern = '(eyJ[a-zA-Z0-9_-]{20,}\.|sb_(?:secret|service)_[a-zA-Z0-9_-]+|(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/|-----BEGIN [A-Z ]*PRIVATE KEY-----|bearer\s+[a-z0-9._~+\/-]{8,}|authorization["'']?\s*:|cookie["'']?\s*:|["'']?(?:password|access[_-]?token|refresh[_-]?token)["'']?\s*[:=]\s*["'']?[^"'']{8,})'
  if ($Content -match $SecretPattern) { throw 'Evidence capture rejected unsafe content; no captured content was displayed.' }
}

function Write-Utf8NoBomFile([string]$Path, [string]$Content) {
  # All capture artifacts are governed inputs: canonicalize newlines explicitly.
  $CanonicalContent = ($Content -replace "`r`n", "`n") -replace "`r", "`n"
  Assert-SafeContent $CanonicalContent
  $Parent = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $Parent)) { New-Item -ItemType Directory -Path $Parent -Force | Out-Null }
  $TemporaryPath = Join-Path $Parent ('.{0}.{1}.tmp' -f ([System.IO.Path]::GetFileName($Path), [Guid]::NewGuid().ToString('N')))
  try {
    [System.IO.File]::WriteAllText($TemporaryPath, $CanonicalContent, $Utf8NoBom)
    Move-Item -LiteralPath $TemporaryPath -Destination $Path -Force
  } finally {
    if (Test-Path -LiteralPath $TemporaryPath) { Remove-Item -LiteralPath $TemporaryPath -Force }
  }
}

function Invoke-CapturedCommand([string]$CommandName, [object[]]$Arguments) {
  # Invocation by name deliberately permits Applications, Functions, Aliases,
  # and owner-provided command shims. Native nonzero exits remain fail-closed.
  $global:LASTEXITCODE = 0
  # Merge native stderr into the captured stream. A failing CLI must never echo
  # unsafe response material before the concise failure is raised.
  $Output = & $CommandName @Arguments 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw "$CommandName metadata command failed; captured output was not displayed." }
  return $Output
}

function Resolve-SupabaseCommand {
  # Resolve without invoking either command so command shims remain supported and
  # no probe output can enter the console or the governed capture bundle.
  if (Get-Command 'supabase' -ErrorAction SilentlyContinue) {
    return [pscustomobject]@{ Executable = 'supabase'; ArgumentPrefix = @() }
  }
  if (Get-Command 'npx' -ErrorAction SilentlyContinue) {
    return [pscustomobject]@{ Executable = 'npx'; ArgumentPrefix = @('--yes', 'supabase') }
  }
  throw 'Supabase CLI unavailable; install repository npm dependencies or provide a supabase command.'
}

function Invoke-SupabaseCapturedCommand($CommandSpecification, [object[]]$Arguments) {
  [object[]]$EffectiveArguments = @($CommandSpecification.ArgumentPrefix) + @($Arguments)
  return Invoke-CapturedCommand $CommandSpecification.Executable $EffectiveArguments
}

function Write-SafeJson([string]$Name, $Data) {
  # Parameter binding preserves an empty Object[] as JSON `[]`; pipeline input
  # would enumerate it into no output and could publish only a newline.
  $Json = ConvertTo-Json -InputObject $Data -Depth 8
  Write-Utf8NoBomFile (Join-Path $CaptureDirectory $Name) ($Json + "`n")
}

try {

# Requires an existing `supabase login` session. Every projection intentionally
# drops token, key, connection, URL, and secret-value fields.
$SupabaseCommand = Resolve-SupabaseCommand
$Projects = @(Invoke-SupabaseCapturedCommand $SupabaseCommand @('projects','list','--output','json') | ConvertFrom-Json |
  Where-Object { $_.id -eq $ProjectRef } |
  Select-Object id,name,region,status)
Write-SafeJson 'supabase-project-safe.json' $Projects

$SupabaseSecretJson = Invoke-SupabaseCapturedCommand $SupabaseCommand @('secrets','list','--project-ref',$ProjectRef,'--output','json')
[object[]]$NormalizedSecretNames = Get-NormalizedInventoryNames -SourceCommand 'supabase secrets list --output json' -JsonText $SupabaseSecretJson -AllowedProperties @('name') -AllowEmpty
$SecretNames = @(foreach ($SecretName in $NormalizedSecretNames) { [pscustomobject]@{ name = $SecretName; status = 'PRESENT' } })
Write-SafeJson 'supabase-secret-names-safe.json' $SecretNames

$Functions = @(Invoke-SupabaseCapturedCommand $SupabaseCommand @('functions','list','--project-ref',$ProjectRef,'--output','json') |
  ConvertFrom-Json | Select-Object name,slug,status,version | Sort-Object name,slug)
Write-SafeJson 'supabase-functions-safe.json' $Functions

# Requires an existing `gh auth login` session with read access. GitHub never
# returns Actions secret values through these list commands.
$RepoMetadata = Invoke-CapturedCommand 'gh' @('repo','view',$Repository,'--json','nameWithOwner,isPrivate,defaultBranchRef') | ConvertFrom-Json
Write-SafeJson 'github-repository-safe.json' ([pscustomobject]@{
  nameWithOwner = $RepoMetadata.nameWithOwner
  isPrivate = $RepoMetadata.isPrivate
  defaultBranch = $RepoMetadata.defaultBranchRef.name
})
$GitHubRepositorySecretJson = Invoke-CapturedCommand 'gh' @('secret','list','--repo',$Repository,'--app','actions','--json','name')
[object[]]$NormalizedRepoSecretNames = Get-NormalizedInventoryNames -SourceCommand 'gh secret list --repo --app actions --json name' -JsonText $GitHubRepositorySecretJson -AllowedProperties @('name') -AllowEmpty
$RepoSecrets = @(foreach ($SecretName in $NormalizedRepoSecretNames) { [pscustomobject]@{ name = $SecretName; status = 'PRESENT' } })
Write-SafeJson 'github-secret-names-safe.json' $RepoSecrets
$Workflows = @(Invoke-CapturedCommand 'gh' @('workflow','list','--repo',$Repository,'--json','name,state,path') | ConvertFrom-Json | Sort-Object path)
Write-SafeJson 'github-workflows-safe.json' $Workflows
$ActionsPermissions = Invoke-CapturedCommand 'gh' @('api',"repos/$Repository/actions/permissions") | ConvertFrom-Json |
  Select-Object enabled,allowed_actions,sha_pinning_required
Write-SafeJson 'github-actions-permissions-safe.json' $ActionsPermissions
$Environments = @(Invoke-CapturedCommand 'gh' @('api','--paginate',"repos/$Repository/environments",'--jq','.environments[] | {name: .name, protection_rule_count: (.protection_rules | length)}') |
  ForEach-Object { $_ | ConvertFrom-Json } | Sort-Object name)
Write-SafeJson 'github-environments-safe.json' $Environments
foreach ($Environment in $Environments) {
  $GitHubEnvironmentSecretJson = Invoke-CapturedCommand 'gh' @('secret','list','--repo',$Repository,'--env',$Environment.name,'--app','actions','--json','name')
  [object[]]$NormalizedEnvironmentSecretNames = Get-NormalizedInventoryNames -SourceCommand 'gh secret list --repo --env --app actions --json name' -JsonText $GitHubEnvironmentSecretJson -AllowedProperties @('name') -AllowEmpty
  $EnvironmentSecrets = @(foreach ($SecretName in $NormalizedEnvironmentSecretNames) { [pscustomobject]@{ environment = $Environment.name; name = $SecretName; status = 'PRESENT' } })
  Write-SafeJson ("github-environment-{0}-secret-names-safe.json" -f ($Environment.name -replace '[^A-Za-z0-9_.-]','_')) $EnvironmentSecrets
}

# Database and Storage catalog evidence is captured separately in the authenticated
# Supabase Dashboard. This script never requests a database password or invokes a
# database client. Run tools/lp169/lp169-owner-metadata-query.sql in SQL Editor,
# export its single result as CSV, then ingest it with:
# npm run ingest:lp169:sql-editor -- "C:\full\path\to\Supabase Snippet Untitled query (4).csv"
Write-Host 'OWNER_SQL_EDITOR_EXPORT_INGESTION_REQUIRED: run tools/lp169/lp169-owner-metadata-query.sql in Supabase SQL Editor, export the single CSV result, and run npm run ingest:lp169:sql-editor -- <full-csv-path>.'

$Manifest = Get-ChildItem $CaptureDirectory -File | Sort-Object Name |
  Select-Object Name,Length,@{Name='Sha256';Expression={(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()}} |
  ConvertTo-Json -Depth 3
Write-Utf8NoBomFile (Join-Path $CaptureDirectory 'capture-manifest-safe.json') ($Manifest + "`n")

# Publish only after every command, safety check, and write succeeds. Preserve an
# existing review bundle and restore it if the directory swap cannot complete.
$BackupDirectory = $null
if (Test-Path -LiteralPath $ReviewDirectory) {
  $BackupDirectory = Join-Path $ReviewParent ('.lp169-previous-{0}' -f ([Guid]::NewGuid().ToString('N')))
  Move-Item -LiteralPath $ReviewDirectory -Destination $BackupDirectory
}
try {
  Move-Item -LiteralPath $CaptureDirectory -Destination $ReviewDirectory
  if ($BackupDirectory) { Remove-Item -LiteralPath $BackupDirectory -Recurse -Force }
} catch {
  if ((-not (Test-Path -LiteralPath $ReviewDirectory)) -and $BackupDirectory -and (Test-Path -LiteralPath $BackupDirectory)) {
    Move-Item -LiteralPath $BackupDirectory -Destination $ReviewDirectory
  }
  throw
}

Write-Host "Safe review bundle created at $ReviewDirectory"
Write-Host 'Review it, create the governed draft described in evidence/lp169/README.md, then run the sanitizer. Raw or unreviewed output must never be copied into the repository.'
} finally {
  if (Test-Path -LiteralPath $CaptureDirectory) { Remove-Item -LiteralPath $CaptureDirectory -Recurse -Force }
}
