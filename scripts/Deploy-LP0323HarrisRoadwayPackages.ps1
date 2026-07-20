<#
.SYNOPSIS
Uploads and verifies certified LP032.2 Harris roadway packages in production Supabase storage.

.DESCRIPTION
Discovers the deterministic LP032.2 Harris package output generated outside the application
repository, validates the local certification artifacts, uploads only Harris package objects to
Supabase Storage, immediately downloads each object, and verifies the downloaded bytes against the
certified local source. The script does not modify runtime manifests or activate Harris.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [string]$CertifiedPackageRoot = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'gridly-local-generated/harris-roadway-packages/lp032.2'),

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$SupabaseUrl = $env:SUPABASE_URL,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$StorageToken = $(if ($env:SUPABASE_SERVICE_ROLE_KEY) { $env:SUPABASE_SERVICE_ROLE_KEY } else { $env:GRIDLY_ROADWAY_STORAGE_TOKEN }),

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$Bucket = $(if ($env:GRIDLY_ROADWAY_STORAGE_BUCKET) { $env:GRIDLY_ROADWAY_STORAGE_BUCKET } else { 'gridly-roadways' }),

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$ObjectPrefix = 'roadways/harris-tx/lp032.2',

    [Parameter()]
    [string]$ReportOutputPath = (Join-Path $PWD 'artifacts/lp032.3-harris-production-deployment-report.json'),

    [Parameter()]
    [switch]$Execute
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-Sha256Hex { param([byte[]]$Bytes) ([System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($Bytes)) -replace '-', '').ToLowerInvariant() }
function Read-Bytes { param([string]$Path) [System.IO.File]::ReadAllBytes($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)) }
function Get-ObjectUrl { param([string]$ObjectPath) "$($SupabaseUrl.TrimEnd('/'))/storage/v1/object/$Bucket/$ObjectPath" }
function Get-PublicUrl { param([string]$ObjectPath) "$($SupabaseUrl.TrimEnd('/'))/storage/v1/object/public/$Bucket/$ObjectPath" }
function Get-Headers { @{ Authorization = "Bearer $StorageToken"; apikey = $StorageToken } }
function Get-WebExceptionResponseBody {
    param([System.Net.WebException]$WebException)
    if (-not $WebException.Response) { return $null }
    $stream = $WebException.Response.GetResponseStream()
    if (-not $stream) { return $null }
    $reader = New-Object System.IO.StreamReader($stream)
    try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}
function Invoke-StorageRequest {
    param([string]$Method, [string]$Url, [hashtable]$Headers, [byte[]]$Body, [string]$ContentType)
    $parameters = @{ Method = $Method; Uri = $Url; Headers = $Headers; MaximumRedirection = 0 }
    if ($Body) { $parameters.Body = $Body; $parameters.ContentType = $ContentType }
    try {
        $response = Invoke-WebRequest @parameters
        if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 300) { throw "HTTP $($response.StatusCode) from $Method $Url`: $($response.Content)" }
        return $response
    } catch [System.Net.WebException] {
        $webResponse = $_.Exception.Response
        $statusCode = $null
        $statusDescription = $null
        if ($webResponse) {
            $statusCode = [int]$webResponse.StatusCode
            $statusDescription = $webResponse.StatusDescription
        }
        $responseBody = Get-WebExceptionResponseBody -WebException $_.Exception
        if ($statusCode) {
            throw "HTTP $statusCode $statusDescription from $Method $Url`: $responseBody"
        }
        throw "HTTP request failed from $Method $Url`: $($_.Exception.Message) $responseBody"
    }
}
function Assert-ManifestPackage {
    param($Manifest, $Package, [string]$Root)
    if (-not $Package.packageId -or -not $Package.fileName -or -not $Package.sha256) { throw "Incomplete package manifest entry: $($Package | ConvertTo-Json -Compress)" }
    if ($Package.packageId -notmatch '^harris-tx-p\d{4}$') { throw "Unexpected Harris package id '$($Package.packageId)'" }
    $path = Join-Path (Join-Path $Root 'packages') $Package.fileName
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing certified package file: $path" }
    $bytes = Read-Bytes $path
    $sha = Get-Sha256Hex $bytes
    if ($sha -ne $Package.sha256) { throw "Local SHA mismatch for $($Package.packageId): $sha != $($Package.sha256)" }
    if ($bytes.Length -ne [int64]$Package.byteLength) { throw "Local byte mismatch for $($Package.packageId): $($bytes.Length) != $($Package.byteLength)" }
    $geojson = [System.Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
    if ($geojson.gridlyPackage.packageId -ne $Package.packageId) { throw "GeoJSON package id mismatch in $path" }
    if (@($geojson.features).Count -ne [int]$Package.featureCount) { throw "Feature count mismatch for $($Package.packageId)" }
    return [pscustomobject]@{ PackageId = $Package.packageId; FileName = $Package.fileName; Path = $path; ObjectPath = "$ObjectPrefix/packages/$($Package.fileName)"; Sha256 = $sha; ByteLength = $bytes.Length; FeatureCount = @($geojson.features).Count; Bytes = $bytes }
}

$root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CertifiedPackageRoot)
$manifestPath = Join-Path $root 'manifest.json'
$certificationPath = Join-Path $root 'certification.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "Missing LP032.2 manifest: $manifestPath" }
if (-not (Test-Path -LiteralPath $certificationPath -PathType Leaf)) { throw "Missing LP032.2 certification: $certificationPath" }
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$certification = Get-Content -Raw -LiteralPath $certificationPath | ConvertFrom-Json
if ($manifest.countyId -ne 'harris-tx' -or $certification.countyId -ne 'harris-tx') { throw 'Certification artifacts are not for harris-tx.' }
if ($certification.validation.overall -ne 'PASS') { throw "LP032.2 certification is not PASS: $($certification.validation.overall)" }
if (@($manifest.packages).Count -ne [int]$certification.summary.packageCount) { throw 'Manifest package count does not match certification summary.' }

$packages = @($manifest.packages | ForEach-Object { Assert-ManifestPackage -Manifest $manifest -Package $_ -Root $root })
$manifestBytes = Read-Bytes $manifestPath
$manifestSha = Get-Sha256Hex $manifestBytes
$manifestObjectPath = "$ObjectPrefix/manifest.json"
$results = @()
$uploaded = 0; $verified = 0; $failed = 0

if (-not $Execute) { throw 'Dry-run only. Re-run with -Execute after SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or GRIDLY_ROADWAY_STORAGE_TOKEN are set.' }
if (-not $SupabaseUrl -or -not $StorageToken) { throw 'Missing Supabase credentials.' }
$headers = Get-Headers

foreach ($item in @([pscustomobject]@{ PackageId = 'manifest'; ObjectPath = $manifestObjectPath; Bytes = $manifestBytes; Sha256 = $manifestSha; ByteLength = $manifestBytes.Length; FeatureCount = $null; ContentType = 'application/json' }) + $packages) {
    try {
        $contentType = if ($item.PSObject.Properties.Name -contains 'ContentType') { $item.ContentType } else { 'application/geo+json' }
        Invoke-StorageRequest -Method 'PUT' -Url (Get-ObjectUrl $item.ObjectPath) -Headers $headers -Body $item.Bytes -ContentType $contentType | Out-Null
        $uploaded++
        $download = Invoke-StorageRequest -Method 'GET' -Url (Get-PublicUrl $item.ObjectPath) -Headers @{}
        $downloadBytes = $download.RawContentStream.ToArray()
        $downloadSha = Get-Sha256Hex $downloadBytes
        $ok = ($downloadSha -eq $item.Sha256 -and $downloadBytes.Length -eq $item.ByteLength)
        if ($item.PackageId -ne 'manifest') {
            $geojson = [System.Text.Encoding]::UTF8.GetString($downloadBytes) | ConvertFrom-Json
            $ok = $ok -and $geojson.gridlyPackage.packageId -eq $item.PackageId -and @($geojson.features).Count -eq $item.FeatureCount
        } else {
            $remoteManifest = [System.Text.Encoding]::UTF8.GetString($downloadBytes) | ConvertFrom-Json
            $ok = $ok -and $remoteManifest.countyId -eq 'harris-tx' -and @($remoteManifest.packages).Count -eq $packages.Count
        }
        if ($ok) { $verified++ } else { $failed++ }
        $results += [pscustomobject]@{ packageId = $item.PackageId; objectPath = $item.ObjectPath; uploaded = $true; verified = $ok; localSha256 = $item.Sha256; remoteSha256 = $downloadSha; localByteLength = $item.ByteLength; remoteByteLength = $downloadBytes.Length }
    } catch {
        $failed++
        $results += [pscustomobject]@{ packageId = $item.PackageId; objectPath = $item.ObjectPath; uploaded = $false; verified = $false; error = $_.Exception.Message }
    }
}

$report = [pscustomobject]@{ milestone = 'LP032.3'; countyId = 'harris-tx'; packageCount = $packages.Count; uploadedCount = $uploaded; verifiedCount = [Math]::Max(0, $verified - 1); failedCount = $failed; shaMismatches = @($results | Where-Object { $_.uploaded -and $_.localSha256 -ne $_.remoteSha256 }).Count; byteMismatches = @($results | Where-Object { $_.uploaded -and $_.localByteLength -ne $_.remoteByteLength }).Count; missingUploads = @($results | Where-Object { -not $_.uploaded }).Count; manifestVerification = [bool](@($results | Where-Object { $_.packageId -eq 'manifest' -and $_.verified }).Count -eq 1); overall = $(if ($failed -eq 0 -and $verified -eq ($packages.Count + 1)) { 'PASS' } else { 'FAIL' }); objectPrefix = $ObjectPrefix; results = $results }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ReportOutputPath) | Out-Null
$report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReportOutputPath -Encoding UTF8
$report | ConvertTo-Json -Depth 6
if ($report.overall -ne 'PASS') { exit 1 }
