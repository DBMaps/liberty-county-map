<#
.SYNOPSIS
Safely validates and uploads LP030 roadway GeoJSON packages to Supabase Storage REST.

.DESCRIPTION
Defaults to dry-run. Reads data/road-segments/ and lp028-roadway-runtime-assets.json without
modifying protected source assets. Real uploads require -Execute and credentials supplied through
environment variables. GeoJSON package contents are hashed and streamed; this script does not parse
full GeoJSON files into memory.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [AllowEmptyString()]
    [string]$SourceDirectory,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$RuntimeAssetsManifestPath,

    [Parameter()]
    [AllowEmptyString()]
    [string]$ResultOutputPath,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$Version = 'lp030',

    [Parameter()]
    [switch]$Execute,

    [Parameter()]
    [switch]$AllowOverwrite,

    [Parameter()]
    [ValidateRange(1, 5)]
    [int]$MaxAttempts = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedCounties = @(
    @{ id = 'austin-tx'; name = 'Austin' }, @{ id = 'brazoria-tx'; name = 'Brazoria' },
    @{ id = 'brazos-tx'; name = 'Brazos' }, @{ id = 'calhoun-tx'; name = 'Calhoun' },
    @{ id = 'chambers-tx'; name = 'Chambers' }, @{ id = 'colorado-tx'; name = 'Colorado' },
    @{ id = 'fayette-tx'; name = 'Fayette' }, @{ id = 'fort-bend-tx'; name = 'Fort Bend' },
    @{ id = 'galveston-tx'; name = 'Galveston' }, @{ id = 'grimes-tx'; name = 'Grimes' },
    @{ id = 'hardin-tx'; name = 'Hardin' }, @{ id = 'jackson-tx'; name = 'Jackson' },
    @{ id = 'jasper-tx'; name = 'Jasper' }, @{ id = 'jefferson-tx'; name = 'Jefferson' },
    @{ id = 'lavaca-tx'; name = 'Lavaca' }, @{ id = 'matagorda-tx'; name = 'Matagorda' },
    @{ id = 'newton-tx'; name = 'Newton' }, @{ id = 'orange-tx'; name = 'Orange' },
    @{ id = 'polk-tx'; name = 'Polk' }, @{ id = 'tyler-tx'; name = 'Tyler' },
    @{ id = 'walker-tx'; name = 'Walker' }, @{ id = 'waller-tx'; name = 'Waller' },
    @{ id = 'washington-tx'; name = 'Washington' }, @{ id = 'wharton-tx'; name = 'Wharton' }
)
$BlockedCountyIds = @('liberty-tx', 'montgomery-tx', 'san-jacinto-tx', 'harris-tx')


function Resolve-Lp030ScriptPath {
    param($Invocation)
    $candidate = $null
    if ($Invocation -and $Invocation.MyCommand -and $Invocation.MyCommand.Path) { $candidate = $Invocation.MyCommand.Path }
    if (-not $candidate -and (Get-Variable -Name PSScriptRoot -Scope Script -ErrorAction SilentlyContinue) -and $PSScriptRoot) {
        $candidate = Join-Path $PSScriptRoot 'Deploy-Lp030RoadwayAssets.ps1'
    }
    if (-not $candidate) { throw 'Unable to resolve deployment script file path for repository-relative defaults.' }
    $resolved = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($candidate)
    if (-not $resolved -or -not (Test-Path -LiteralPath $resolved -PathType Leaf)) { throw "Unable to resolve deployment script file path: $candidate" }
    return $resolved
}
function Resolve-Lp030RepositoryRoot {
    param([string]$ScriptPath)
    $scriptDirectory = Split-Path -Parent $ScriptPath
    if (-not $scriptDirectory) { throw "Unable to resolve deployment script directory from: $ScriptPath" }
    $repoRoot = Split-Path -Parent $scriptDirectory
    if (-not $repoRoot) { throw "Unable to resolve repository root from deployment script path: $ScriptPath" }
    return $repoRoot
}

function Resolve-Lp030Path { param([string]$Path) $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path) }
function ConvertTo-Lp030CountyId {
    param([string]$Value)
    $slug = $Value.ToLowerInvariant() -replace '&', ' and ' -replace '[^a-z0-9]+', '-' -replace '(^-|-$)', ''
    if ($slug -notmatch '-tx$') { $slug = "$slug-tx" }
    return $slug
}
function Get-Lp030CountyNameFromFileName {
    param([string]$FileName)
    $base = [System.IO.Path]::GetFileNameWithoutExtension($FileName).ToLowerInvariant()
    $base = $base -replace '-county-road-segments$', '' -replace '-road-segments$', '' -replace '-roads$', '' -replace '-tx$', ''
    ($base -split '-' | ForEach-Object { if ($_.Length -gt 0) { $_.Substring(0,1).ToUpperInvariant() + $_.Substring(1) } }) -join ' '
}
function Test-Lp030SafeBaseUrl {
    param([string]$Url)
    $uri = [Uri]$Url
    if ($uri.Scheme -eq 'https') { return $true }
    return ($uri.Scheme -eq 'http' -and ($uri.Host -eq 'localhost' -or $uri.Host -eq '127.0.0.1' -or $uri.Host -eq '::1'))
}
function Get-Lp030ManifestEntries {
    param([string]$ManifestPath)
    $manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
    if ($manifest.assets) { return @($manifest.assets) }
    if ($manifest.counties) { return @($manifest.counties) }
    if ($manifest.roadwayAssets) { return @($manifest.roadwayAssets) }
    throw 'lp028-roadway-runtime-assets.json must contain assets, counties, or roadwayAssets.'
}
function Get-Lp030EntryValue {
    param($Entry, [string[]]$Names)
    foreach ($name in $Names) { if ($Entry.PSObject.Properties.Name -contains $name -and $null -ne $Entry.$name) { return [string]$Entry.$name } }
    return $null
}
function Invoke-Lp030StorageRequest {
    param([string]$Method, [string]$Url, [hashtable]$Headers, [string]$InFile)
    $args = @{ Method = $Method; Uri = $Url; Headers = $Headers; UseBasicParsing = $true }
    if ($InFile) { $args.InFile = $InFile; $args.ContentType = 'application/geo+json' }
    try { Invoke-WebRequest @args } catch { if ($_.Exception.Response) { return $_.Exception.Response }; throw }
}
function Test-Lp030TransientStatus { param([int]$StatusCode) return ($StatusCode -eq 408 -or $StatusCode -eq 429 -or ($StatusCode -ge 500 -and $StatusCode -lt 600)) }

$scriptPath = Resolve-Lp030ScriptPath $MyInvocation
$repoRoot = Resolve-Lp030RepositoryRoot $scriptPath
if (-not $SourceDirectory) { $SourceDirectory = Join-Path $repoRoot 'data/road-segments' }
if (-not $ResultOutputPath) {
    $resultOutputDirectory = Join-Path $repoRoot 'lp030-roadway-upload-results'
    $ResultOutputPath = Join-Path $resultOutputDirectory ('lp030-roadway-assets-' + (Get-Date -Format 'yyyyMMddTHHmmssZ') + '.json')
}
$sourceFullPath = Resolve-Lp030Path $SourceDirectory
if (-not $RuntimeAssetsManifestPath) { $RuntimeAssetsManifestPath = Join-Path $sourceFullPath 'lp028-roadway-runtime-assets.json' }
$manifestFullPath = Resolve-Lp030Path $RuntimeAssetsManifestPath
$resultFullPath = Resolve-Lp030Path $ResultOutputPath
if ($resultFullPath.Replace('\\','/') -match '(^|/)data/road-segments(/|$)') { throw 'Result JSON must be written outside data/road-segments/.' }
if (-not (Test-Path -LiteralPath $sourceFullPath -PathType Container)) { throw "Source directory does not exist: $sourceFullPath" }
if (-not (Test-Path -LiteralPath $manifestFullPath -PathType Leaf)) { throw "LP028 runtime asset manifest does not exist: $manifestFullPath" }

$geoJsonFiles = @(Get-ChildItem -LiteralPath $sourceFullPath -File | Where-Object { $_.Name -ne 'lp028-roadway-runtime-assets.json' } | Sort-Object Name)
$badFiles = @($geoJsonFiles | Where-Object { $_.Extension.ToLowerInvariant() -ne '.geojson' })
if ($badFiles.Count -gt 0) { throw ('Non-GeoJSON package present: ' + (($badFiles | Select-Object -ExpandProperty Name) -join ', ')) }
$filesByCounty = @{}
foreach ($file in $geoJsonFiles) {
    $countyName = Get-Lp030CountyNameFromFileName $file.Name
    $countyId = ConvertTo-Lp030CountyId $countyName
    if ($countyId -eq 'harris-tx') { throw 'Harris roadway package is explicitly rejected.' }
    if ($BlockedCountyIds -contains $countyId) { throw "Blocked county package present: $countyId" }
    $filesByCounty[$countyId] = @{ file = $file; countyName = $countyName }
}
$expectedIds = @($ExpectedCounties | ForEach-Object { $_.id })
$actualIds = @($filesByCounty.Keys | Sort-Object)
$missing = @($expectedIds | Where-Object { -not $filesByCounty.ContainsKey($_) })
$extra = @($actualIds | Where-Object { $expectedIds -notcontains $_ })
if ($missing.Count -gt 0) { throw ('Missing expected county package(s): ' + ($missing -join ', ')) }
if ($extra.Count -gt 0) { throw ('Extra county package(s): ' + ($extra -join ', ')) }
if ($geoJsonFiles.Count -ne 24 -or $actualIds.Count -ne 24) { throw "Expected exactly 24 county packages; found $($geoJsonFiles.Count) file(s) and $($actualIds.Count) county id(s)." }

$manifestEntries = Get-Lp030ManifestEntries $manifestFullPath
$manifestByCounty = @{}
foreach ($entry in $manifestEntries) {
    $entryCountyId = Get-Lp030EntryValue $entry @('countyId','id','county')
    if (-not $entryCountyId) { $entryCountyId = ConvertTo-Lp030CountyId (Get-Lp030EntryValue $entry @('countyName','name')) }
    $manifestByCounty[$entryCountyId] = $entry
}
$manifestExtra = @($manifestByCounty.Keys | Where-Object { $expectedIds -notcontains $_ })
if ($manifestByCounty.ContainsKey('harris-tx')) { throw 'Expected manifest disagrees: Harris is explicitly rejected.' }
if ($manifestExtra.Count -gt 0) { throw ('Expected manifest disagrees: extra county ' + ($manifestExtra -join ', ')) }
foreach ($id in $expectedIds) {
    if (-not $manifestByCounty.ContainsKey($id)) { throw "Expected manifest disagrees: missing $id" }
    $entry = $manifestByCounty[$id]
    $file = $filesByCounty[$id].file
    $entryFile = Get-Lp030EntryValue $entry @('fileName','filename','name')
    if ($entryFile -and $entryFile -ne $file.Name) { throw "Expected manifest disagrees for $id filename: $entryFile vs $($file.Name)" }
    $entrySize = Get-Lp030EntryValue $entry @('byteLength','bytes','size','localByteLength')
    if ($entrySize -and ([int64]$entrySize) -ne $file.Length) { throw "File size mismatch for $id" }
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $entryHash = Get-Lp030EntryValue $entry @('sha256','checksum','hash')
    if ($entryHash -and $entryHash.ToLowerInvariant() -ne $hash) { throw "Checksum mismatch for $id" }
}

$baseUrl = $env:GRIDLY_ROADWAY_STORAGE_BASE_URL
$bucket = $env:GRIDLY_ROADWAY_STORAGE_BUCKET
$token = $env:GRIDLY_ROADWAY_STORAGE_TOKEN
if ($Execute) {
    if (-not $baseUrl -or -not $bucket -or -not $token) { throw 'GRIDLY_ROADWAY_STORAGE_BASE_URL, GRIDLY_ROADWAY_STORAGE_BUCKET, and GRIDLY_ROADWAY_STORAGE_TOKEN are required for -Execute.' }
    if (-not (Test-Lp030SafeBaseUrl $baseUrl)) { throw 'Storage base URL must use HTTPS except localhost.' }
} elseif ($baseUrl -and -not (Test-Lp030SafeBaseUrl $baseUrl)) { throw 'Storage base URL must use HTTPS except localhost.' }
if (-not $baseUrl) { $baseUrl = 'https://storage.example.invalid' }
if (-not $bucket) { $bucket = 'dry-run' }
$baseUrl = $baseUrl.TrimEnd('/')

$headers = @{ Authorization = "Bearer $token"; apikey = $token; 'x-upsert' = ($(if ($AllowOverwrite) { 'true' } else { 'false' })) }
$results = foreach ($county in $ExpectedCounties) {
    $file = $filesByCounty[$county.id].file
    $sha = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $objectPath = "roadways/$($county.id)/$Version/$($file.Name)"
    $encodedObjectPath = ($objectPath -split '/' | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
    $objectUrl = "$baseUrl/storage/v1/object/$bucket/$encodedObjectPath"
    $publicUrl = "$baseUrl/storage/v1/object/public/$bucket/$encodedObjectPath"
    $status = if ($Execute) { 'pending' } else { 'dry-run' }; $httpStatus = $null; $errorText = $null; $remoteLength = $null; $verification = 'not-attempted'; $verified = $false
    if ($Execute) {
        $head = Invoke-Lp030StorageRequest -Method 'Head' -Url $objectUrl -Headers $headers
        if ($head.StatusCode -ge 200 -and $head.StatusCode -lt 300 -and -not $AllowOverwrite) { throw "Remote object exists and -AllowOverwrite was not supplied: $objectPath" }
        for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
            $response = Invoke-Lp030StorageRequest -Method 'Post' -Url $objectUrl -Headers $headers -InFile $file.FullName
            $httpStatus = [int]$response.StatusCode
            if (($httpStatus -ge 200 -and $httpStatus -lt 300) -or -not (Test-Lp030TransientStatus $httpStatus) -or $attempt -eq $MaxAttempts) { break }
            Start-Sleep -Seconds ([Math]::Min(8, [Math]::Pow(2, $attempt)))
        }
        $status = if ($httpStatus -ge 200 -and $httpStatus -lt 300) { 'uploaded' } else { 'failed' }
        $verifyResponse = Invoke-Lp030StorageRequest -Method 'Head' -Url $publicUrl -Headers @{}
        $verification = if ($verifyResponse.StatusCode -ge 200 -and $verifyResponse.StatusCode -lt 300) { 'accessible' } else { 'failed' }
        if ($verifyResponse.Headers['Content-Length']) { $remoteLength = [int64]$verifyResponse.Headers['Content-Length'] }
        $verified = ($verification -eq 'accessible' -and ($null -eq $remoteLength -or $remoteLength -eq $file.Length))
    }
    [pscustomobject]@{ countyId=$county.id; countyName=$county.name; localPath=$file.FullName; fileName=$file.Name; objectPath=$objectPath; publicUrl=$publicUrl; version=$Version; sha256=$sha; localByteLength=$file.Length; remoteByteLength=$remoteLength; uploadAttempted=[bool]$Execute; uploadStatus=$status; httpStatus=$httpStatus; verificationStatus=$verification; verified=$verified; error=$errorText }
}
$result = [ordered]@{ contractVersion='LP030.2'; generatedAtUtc=(Get-Date -Format 'o'); execute=[bool]$Execute; allowOverwrite=[bool]$AllowOverwrite; sourceDirectory=$sourceFullPath; runtimeAssetsManifestPath=$manifestFullPath; protectedDataRoadSegmentsModified=$false; countyCount=$results.Count; results=$results }
$resultParent = Split-Path -Parent $resultFullPath
if ($resultParent -and -not (Test-Path -LiteralPath $resultParent -PathType Container)) { New-Item -ItemType Directory -Path $resultParent -Force | Out-Null }
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resultFullPath -Encoding utf8
$result | ConvertTo-Json -Depth 8
