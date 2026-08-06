param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9]{20}$')][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$Repository,
  [string]$ReviewDirectory = (Join-Path $env:TEMP 'gridly-lp169-owner-review')
)

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
  $Output = & $CommandName @Arguments | Out-String
  if ($LASTEXITCODE -ne 0) { throw "$CommandName metadata command failed; captured output was not displayed." }
  return $Output
}

function Get-NormalizedInventoryNames {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$true)][string]$SourceCommand,
    [Parameter(Mandatory=$true)][AllowNull()][AllowEmptyString()][string]$JsonText,
    [Parameter(Mandatory=$true)][string[]]$AllowedProperties,
    [string[]]$WrapperProperties = @(),
    [switch]$AllowEmpty
  )

  function Stop-InventoryNormalization {
    [CmdletBinding()]
    param(
      [Parameter(Mandatory=$true)]
      [string]$ErrorId,

      [Parameter(Mandatory=$true)]
      [string]$Message,

      [Parameter(Mandatory=$true)]
      [string]$TargetObject
    )

    # ThrowTerminatingError preserves ErrorRecord.FullyQualifiedErrorId on
    # Windows PowerShell 5.1; throwing a string makes that field prose-derived.
    [System.ArgumentException]$Exception =
      [System.ArgumentException]::new($Message)

    [System.Management.Automation.ErrorRecord]$ErrorRecord =
      [System.Management.Automation.ErrorRecord]::new(
      $Exception,
      $ErrorId,
      [System.Management.Automation.ErrorCategory]::InvalidData,
      $TargetObject
    )

    $PSCmdlet.ThrowTerminatingError($ErrorRecord)
  }

  # Do not let PowerShell's convenient scalar/property coercions turn a CLI
  # error, status object, or wrapper into inventory evidence. Diagnostics name
  # schemas only; captured values are never included.
  if ([string]::IsNullOrWhiteSpace($JsonText)) {
    Stop-InventoryNormalization `
      -ErrorId 'LP169InventoryBlankOutput' `
      -Message "$SourceCommand SOURCE_UNAVAILABLE; command returned no JSON; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: []." `
      -TargetObject $SourceCommand
  }
  try {
    $Parsed = ConvertFrom-Json -InputObject $JsonText
  } catch {
    Stop-InventoryNormalization `
      -ErrorId 'LP169InventoryMalformedJson' `
      -Message "$SourceCommand CAPTURE_FAILED; command returned invalid JSON; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: []." `
      -TargetObject $SourceCommand
  }
  if ($null -eq $Parsed -and $JsonText -notmatch '^\s*\[\s*\]\s*$') {
    Stop-InventoryNormalization `
      -ErrorId 'LP169InventoryNullOutput' `
      -Message "$SourceCommand SOURCE_UNAVAILABLE; command returned null JSON; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: []." `
      -TargetObject $SourceCommand
  }
  # Inspect the JSON root before normalization. Windows PowerShell 5.1
  # enumerates JSON arrays at the pipeline boundary: [], [x], and [x,y] can
  # otherwise become null, a scalar, and an array respectively.
  $IsArrayRoot = $JsonText -match '^\s*\['
  $IsObjectRoot = $JsonText -match '^\s*\{'
  if (-not $IsArrayRoot -and -not $IsObjectRoot) {
    Stop-InventoryNormalization `
      -ErrorId 'LP169InventoryScalarRoot' `
      -Message "$SourceCommand returned a scalar JSON root; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: []." `
      -TargetObject $SourceCommand
  }

  [object[]]$Records = @()
  if ($IsArrayRoot) {
    # The empty-array spelling must be recognized from raw text because PS 5.1
    # gives ConvertFrom-Json no output object for it.
    if ($JsonText -notmatch '^\s*\[\s*\]\s*$') { $Records = @($Parsed) }
  } else {
    $WrapperMatches = @($WrapperProperties | Where-Object { $null -ne $Parsed.PSObject.Properties[$_] })
    if ($WrapperMatches.Count -gt 1) {
      $Observed = @($Parsed.PSObject.Properties | ForEach-Object { $_.Name } | Sort-Object -Unique) -join ','
      Stop-InventoryNormalization `
        -ErrorId 'LP169InventoryAmbiguousProperty' `
        -Message "$SourceCommand returned an ambiguous wrapper; expected wrapper properties: [$($WrapperProperties -join ',')]; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: [$Observed]." `
        -TargetObject $SourceCommand
    }
    if ($WrapperMatches.Count -eq 0) {
      $Observed = @($Parsed.PSObject.Properties | ForEach-Object { $_.Name } | Sort-Object -Unique) -join ','
      Stop-InventoryNormalization `
        -ErrorId 'LP169InventorySchemaMismatch' `
        -Message "$SourceCommand returned an unsupported wrapper; expected wrapper properties: [$($WrapperProperties -join ',')]; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: [$Observed]." `
        -TargetObject $SourceCommand
    }
    $WrappedRecords = $Parsed.PSObject.Properties[$WrapperMatches[0]].Value
    if ($null -eq $WrappedRecords -or -not ($WrappedRecords -is [System.Array])) {
      Stop-InventoryNormalization `
        -ErrorId 'LP169InventorySchemaMismatch' `
        -Message "$SourceCommand returned an invalid wrapper inventory; expected wrapper properties: [$($WrapperProperties -join ',')]; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: [$($WrapperMatches -join ',')]." `
        -TargetObject $SourceCommand
    }
    $Records = @($WrappedRecords)
  }
  if ($Records.Count -eq 0) {
    if ($AllowEmpty) { return ,([object[]]@()) }
    Stop-InventoryNormalization `
      -ErrorId 'LP169InventoryEmptyNotAllowed' `
      -Message "$SourceCommand returned an empty inventory; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: []." `
      -TargetObject $SourceCommand
  }

  $Names = @()
  foreach ($Record in $Records) {
    if ($null -eq $Record -or $Record -is [string] -or $Record.GetType().IsPrimitive) {
      Stop-InventoryNormalization `
        -ErrorId 'LP169InventorySchemaMismatch' `
        -Message "$SourceCommand returned a scalar inventory record; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: []." `
        -TargetObject $SourceCommand
    }
    $ObservedProperties = @($Record.PSObject.Properties | ForEach-Object { $_.Name } | Sort-Object -Unique)
    $Supported = @($AllowedProperties | Where-Object { $null -ne $Record.PSObject.Properties[$_] })
    if ($Supported.Count -ne 1) {
      $Reason = if ($Supported.Count -eq 0) { 'unsupported' } else { 'ambiguous' }
      $Identifier = if ($Reason -eq 'ambiguous') { 'LP169InventoryAmbiguousProperty' } else { 'LP169InventorySchemaMismatch' }
      Stop-InventoryNormalization `
        -ErrorId $Identifier `
        -Message "$SourceCommand returned an $Reason inventory record; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: [$($ObservedProperties -join ',')]." `
        -TargetObject $SourceCommand
    }
    $Value = $Record.PSObject.Properties[$Supported[0]].Value
    if ($null -eq $Value -or -not ($Value -is [string]) -or [string]::IsNullOrWhiteSpace($Value)) {
      Stop-InventoryNormalization `
        -ErrorId 'LP169InventorySchemaMismatch' `
        -Message "$SourceCommand returned an invalid inventory name; expected record properties: [$($AllowedProperties -join ',')]; observed properties only: [$($ObservedProperties -join ',')]." `
        -TargetObject $SourceCommand
    }
    $Names += $Value.Trim()
  }
  [object[]]$NormalizedNames = @($Names | Sort-Object -Unique)
  # Unary comma prevents PowerShell's return pipeline from unrolling zero, one,
  # or many names. Callers therefore receive an Object[] in every valid case.
  return ,$NormalizedNames
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
$Projects = @(Invoke-CapturedCommand 'supabase' @('projects','list','--output','json') | ConvertFrom-Json |
  Where-Object { $_.id -eq $ProjectRef } |
  Select-Object id,name,region,status)
Write-SafeJson 'supabase-project-safe.json' $Projects

$SupabaseSecretJson = Invoke-CapturedCommand 'supabase' @('secrets','list','--project-ref',$ProjectRef,'--output','json')
[object[]]$NormalizedSecretNames = Get-NormalizedInventoryNames -SourceCommand 'supabase secrets list --output json' -JsonText $SupabaseSecretJson -AllowedProperties @('name') -AllowEmpty
$SecretNames = @(foreach ($SecretName in $NormalizedSecretNames) { [pscustomobject]@{ name = $SecretName; status = 'PRESENT' } })
Write-SafeJson 'supabase-secret-names-safe.json' $SecretNames

$Functions = @(Invoke-CapturedCommand 'supabase' @('functions','list','--project-ref',$ProjectRef,'--output','json') |
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
$global:LASTEXITCODE = 0
$DatabaseMetadata = $Sql | & psql --no-psqlrc --quiet --tuples-only --no-align | Out-String
if ($LASTEXITCODE -ne 0) { throw 'psql metadata command failed; captured output was not displayed.' }
Write-Utf8NoBomFile (Join-Path $CaptureDirectory 'database-storage-metadata-safe.jsonl') $DatabaseMetadata

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
