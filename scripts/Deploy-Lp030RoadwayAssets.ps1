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
$LocalRuntimeCountyIds = @('liberty-tx', 'montgomery-tx', 'san-jacinto-tx')
$BlockedCountyIds = @('harris-tx')


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
function Get-Lp030RuntimeAssetsManifest {
    param([string]$ManifestPath)
    return (Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json)
}
function Get-Lp030ManifestEntries {
    param($Manifest)
    if ($Manifest.PSObject.Properties.Name -contains 'assets') { return @($Manifest.assets) }
    if ($Manifest.PSObject.Properties.Name -contains 'counties') { return @($Manifest.counties) }
    if ($Manifest.PSObject.Properties.Name -contains 'roadwayAssets') { return @($Manifest.roadwayAssets) }
    throw 'lp028-roadway-runtime-assets.json must contain assets, counties, or roadwayAssets.'
}
function Get-Lp030EntryValue {
    param($Entry, [string[]]$Names)
    foreach ($name in $Names) { if ($Entry.PSObject.Properties.Name -contains $name -and $null -ne $Entry.$name) { return [string]$Entry.$name } }
    return $null
}
function ConvertTo-Lp030SanitizedText {
    param([string]$Value)
    if (-not $Value) { return '' }
    $sanitized = $Value
    if ($env:GRIDLY_ROADWAY_STORAGE_TOKEN) { $sanitized = $sanitized.Replace($env:GRIDLY_ROADWAY_STORAGE_TOKEN, '[redacted]') }
    if ($sanitized.Length -gt 1000) { $sanitized = $sanitized.Substring(0, 1000) + '...[truncated]' }
    return $sanitized
}
# Verifies remote Content-Length by downloading the public object; curl replacement for legacy Invoke-WebRequest InFile = $InFile binary upload contract
function Invoke-Lp030CurlRequest {
    param(
        [ValidateNotNullOrEmpty()][string]$Method,
        [ValidateNotNullOrEmpty()][string]$Url,
        [hashtable]$Headers,
        [string]$InFile,
        [string]$ContentType = 'application/geo+json'
    )
    $curlPath = 'curl.exe'
    $curlCommand = Get-Command -Name $curlPath -CommandType Application -ErrorAction SilentlyContinue
    if (-not $curlCommand) { $curlPath = 'curl' }
    $tempBody = [System.IO.Path]::GetTempFileName()
    $tempError = [System.IO.Path]::GetTempFileName()
    try {
        $curlArgs = @('--silent', '--show-error', '--location', '--request', $Method.ToUpperInvariant(), '--output', $tempBody, '--write-out', '%{http_code}', '--url', $Url)
        if ($Headers) {
            foreach ($headerName in @($Headers.Keys | Sort-Object)) {
                $headerValue = [string]$Headers[$headerName]
                $curlArgs += @('--header', ("${headerName}: $headerValue"))
            }
        }
        if ($InFile) {
            $absoluteInFile = Resolve-Lp030Path $InFile
            $curlArgs += @('--header', ("Content-Type: $ContentType"), '--data-binary', ('@' + $absoluteInFile))
        }
        $errorText = ''
        $statusText = & $curlPath @curlArgs 2> $tempError
        $exitCode = $LASTEXITCODE
        if (Test-Path -LiteralPath $tempError -PathType Leaf) { $errorText = Get-Content -Raw -LiteralPath $tempError }
        $bodyText = ''
        if (Test-Path -LiteralPath $tempBody -PathType Leaf) { $bodyText = Get-Content -Raw -LiteralPath $tempBody }
        $httpStatus = 0
        if (-not [int]::TryParse(([string]$statusText).Trim(), [ref]$httpStatus)) { $httpStatus = 0 }
        return [pscustomobject]@{
            StatusCode = $httpStatus
            Body = $bodyText
            ErrorText = $errorText
            ExitCode = $exitCode
            Succeeded = ($exitCode -eq 0 -and $httpStatus -ge 200 -and $httpStatus -lt 300)
        }
    } finally {
        if (Test-Path -LiteralPath $tempBody) { Remove-Item -LiteralPath $tempBody -Force -ErrorAction SilentlyContinue }
        if (Test-Path -LiteralPath $tempError) { Remove-Item -LiteralPath $tempError -Force -ErrorAction SilentlyContinue }
    }
}
function Invoke-Lp030StorageRequest {
    param(
        [ValidateNotNullOrEmpty()][string]$Method,
        [ValidateNotNullOrEmpty()][string]$Url,
        [hashtable]$Headers,
        [string]$InFile,
        [string]$CountyId,
        [string]$ObjectPath,
        [switch]$AllowNotFound
    )
    $response = Invoke-Lp030CurlRequest -Method $Method -Url $Url -Headers $Headers -InFile $InFile
    if ($response.ExitCode -ne 0) {
        throw "Storage request failed for county '$CountyId' object '$ObjectPath' with curl exit code $($response.ExitCode), HTTP $($response.StatusCode): $(ConvertTo-Lp030SanitizedText ($response.ErrorText + $response.Body))"
    }
    if ($AllowNotFound -and (Test-Lp030StorageNotFoundResponse -StatusCode $response.StatusCode -Body $response.Body)) { return $response }
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
        throw "Storage request failed for county '$CountyId' object '$ObjectPath' with HTTP $($response.StatusCode): $(ConvertTo-Lp030SanitizedText ($response.ErrorText + $response.Body))"
    }
    return $response
}

function Test-Lp030StorageNotFoundResponse {
    param(
        [int]$StatusCode,
        [string]$Body
    )
    if ($StatusCode -eq 404) { return $true }
    if ($StatusCode -ne 400 -or -not $Body) { return $false }

    $textValues = @($Body)
    try {
        $parsed = $Body | ConvertFrom-Json -ErrorAction Stop
        foreach ($name in @('statusCode', 'error', 'errorCode', 'code', 'message', 'msg')) {
            if ($parsed.PSObject.Properties.Name -contains $name -and $null -ne $parsed.$name) {
                $textValues += [string]$parsed.$name
            }
        }
    } catch {
        # Non-JSON error bodies are evaluated as plain text below.
    }

    $combined = ($textValues -join ' ').ToLowerInvariant()
    return (
        $combined -match 'not[ -]?found' -or
        $combined -match 'does not exist' -or
        $combined -match 'no such (key|object|file)' -or
        $combined -match 'object not found'
    )
}

function Remove-Lp030ProbeObject {
    param([string]$BaseUrl, [string]$Bucket, [hashtable]$Headers)
    $probeUrl = "$BaseUrl/storage/v1/object/$Bucket/probe.json"
    $response = Invoke-Lp030StorageRequest -Method 'Delete' -Url $probeUrl -Headers $Headers -CountyId 'probe' -ObjectPath 'probe.json' -AllowNotFound
    return [pscustomobject]@{ objectPath = 'probe.json'; httpStatus = [int]$response.StatusCode; removed = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300); alreadyAbsent = (Test-Lp030StorageNotFoundResponse -StatusCode $response.StatusCode -Body $response.Body) }
}
function Save-Lp030PublicObjectForVerification {
    param([string]$Url, [string]$CountyId, [string]$ObjectPath)
    $tempFile = [System.IO.Path]::GetTempFileName()
    $curlPath = 'curl.exe'
    if (-not (Get-Command -Name $curlPath -CommandType Application -ErrorAction SilentlyContinue)) { $curlPath = 'curl' }
    $tempError = [System.IO.Path]::GetTempFileName()
    try {
        $curlArgs = @('--silent', '--show-error', '--location', '--output', $tempFile, '--write-out', '%{http_code}', '--url', $Url)
        $statusText = & $curlPath @curlArgs 2> $tempError
        $exitCode = $LASTEXITCODE
        $errorText = Get-Content -Raw -LiteralPath $tempError
        $httpStatus = 0
        if (-not [int]::TryParse(([string]$statusText).Trim(), [ref]$httpStatus)) { $httpStatus = 0 }
        if ($exitCode -ne 0 -or $httpStatus -lt 200 -or $httpStatus -ge 300) {
            throw "Public verification download failed for county '$CountyId' object '$ObjectPath' with curl exit code $exitCode, HTTP ${httpStatus}: $(ConvertTo-Lp030SanitizedText $errorText)"
        }
        $downloadInfo = Get-Item -LiteralPath $tempFile
        return [pscustomobject]@{ Path = $tempFile; HttpStatus = $httpStatus; ByteLength = [int64]$downloadInfo.Length; Sha256 = (Get-FileHash -LiteralPath $tempFile -Algorithm SHA256).Hash.ToLowerInvariant() }
    } catch {
        if (Test-Path -LiteralPath $tempFile) { Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue }
        throw
    } finally {
        if (Test-Path -LiteralPath $tempError) { Remove-Item -LiteralPath $tempError -Force -ErrorAction SilentlyContinue }
    }
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
    if ($LocalRuntimeCountyIds -contains $countyId) { throw "Local runtime county package present: $countyId" }
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

$manifest = Get-Lp030RuntimeAssetsManifest $manifestFullPath
$manifestEntries = Get-Lp030ManifestEntries $manifest
$allowedManifestIds = @($expectedIds + $LocalRuntimeCountyIds + $BlockedCountyIds)
foreach ($propertyCheck in @(
    @{ name = 'coveredCountyCount'; value = 28 },
    @{ name = 'runtimeReadyCountyCount'; value = 27 },
    @{ name = 'blockedCountyCount'; value = 1 }
)) {
    if ($manifest.PSObject.Properties.Name -contains $propertyCheck.name) {
        $actualPropertyValue = $manifest.PSObject.Properties[$propertyCheck.name].Value
        if ([int]$actualPropertyValue -ne $propertyCheck.value) {
            throw "Expected manifest disagrees: $($propertyCheck.name) must be $($propertyCheck.value); found $actualPropertyValue"
        }
    }
}
$manifestByCounty = @{}
foreach ($entry in $manifestEntries) {
    $entryCountyValue = Get-Lp030EntryValue $entry @('countyId','id','county','countyName','name')
    if (-not $entryCountyValue) { throw 'Expected manifest disagrees: entry missing county identifier.' }
    $entryCountyId = ConvertTo-Lp030CountyId $entryCountyValue
    if ($manifestByCounty.ContainsKey($entryCountyId)) { throw "Expected manifest disagrees: duplicate county $entryCountyId" }
    $manifestByCounty[$entryCountyId] = $entry
}
$manifestExtra = @($manifestByCounty.Keys | Where-Object { $allowedManifestIds -notcontains $_ })
if ($manifestExtra.Count -gt 0) { throw ('Expected manifest disagrees: extra county ' + ($manifestExtra -join ', ')) }
if ($manifest.PSObject.Properties.Name -contains 'blockedCounties') {
    $manifestBlockedIds = @($manifest.blockedCounties | ForEach-Object {
        if ($null -eq $_) { $null }
        elseif ($_.PSObject.Properties.Name -contains 'countyId') { ConvertTo-Lp030CountyId ([string]$_.countyId) }
        elseif ($_.PSObject.Properties.Name -contains 'id') { ConvertTo-Lp030CountyId ([string]$_.id) }
        elseif ($_.PSObject.Properties.Name -contains 'county') { ConvertTo-Lp030CountyId ([string]$_.county) }
        elseif ($_.PSObject.Properties.Name -contains 'countyName') { ConvertTo-Lp030CountyId ([string]$_.countyName) }
        elseif ($_.PSObject.Properties.Name -contains 'name') { ConvertTo-Lp030CountyId ([string]$_.name) }
        else { ConvertTo-Lp030CountyId ([string]$_) }
    })
    $unknownBlocked = @($manifestBlockedIds | Where-Object { $BlockedCountyIds -notcontains $_ })
    if ($unknownBlocked.Count -gt 0) { throw ('Expected manifest disagrees: blockedCounties contains unexpected county ' + ($unknownBlocked -join ', ')) }
    $missingBlockedMetadata = @($BlockedCountyIds | Where-Object { $manifestBlockedIds -notcontains $_ })
    if ($missingBlockedMetadata.Count -gt 0) { throw ('Expected manifest disagrees: blockedCounties missing ' + ($missingBlockedMetadata -join ', ')) }
    if ($manifestBlockedIds.Count -ne $BlockedCountyIds.Count) { throw 'Expected manifest disagrees: blockedCounties must contain Harris only' }
} else {
    $manifestBlockedIds = @()
}
foreach ($id in @($LocalRuntimeCountyIds + $BlockedCountyIds)) {
    if (-not $manifestByCounty.ContainsKey($id)) { throw "Expected manifest disagrees: missing county $id" }
}
foreach ($id in $LocalRuntimeCountyIds) {
    if ($manifestBlockedIds -contains $id) { throw "Expected manifest disagrees: local runtime county cannot be blocked $id" }
}
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
if ($Execute) { $probeDeletion = Remove-Lp030ProbeObject -BaseUrl $baseUrl -Bucket $bucket -Headers $headers } else { $probeDeletion = [pscustomobject]@{ objectPath = 'probe.json'; httpStatus = $null; removed = $false; alreadyAbsent = $false } }

$results = foreach ($county in $ExpectedCounties) {
    $file = $filesByCounty[$county.id].file
    $sha = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $objectPath = "roadways/$($county.id)/$Version/$($file.Name)"
    $encodedObjectPath = ($objectPath -split '/' | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
    $objectUrl = "$baseUrl/storage/v1/object/$bucket/$encodedObjectPath"
    $publicUrl = "$baseUrl/storage/v1/object/public/$bucket/$encodedObjectPath"
    $status = if ($Execute) { 'pending' } else { 'dry-run' }; $httpStatus = $null; $errorText = $null; $remoteLength = $null; $remoteSha = $null; $verification = 'not-attempted'; $verified = $false
    if ($Execute) {
        if (-not $AllowOverwrite) {
            $head = Invoke-Lp030StorageRequest -Method 'Head' -Url $objectUrl -Headers $headers -CountyId $county.id -ObjectPath $objectPath -AllowNotFound
            if ($head.StatusCode -ge 200 -and $head.StatusCode -lt 300) { throw "Remote object exists and -AllowOverwrite was not supplied: $objectPath" }
        }
        for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
            $response = Invoke-Lp030StorageRequest -Method 'Post' -Url $objectUrl -Headers $headers -InFile $file.FullName -CountyId $county.id -ObjectPath $objectPath
            $httpStatus = [int]$response.StatusCode
            if (($httpStatus -ge 200 -and $httpStatus -lt 300) -or -not (Test-Lp030TransientStatus $httpStatus) -or $attempt -eq $MaxAttempts) { break }
            Start-Sleep -Seconds ([Math]::Min(8, [Math]::Pow(2, $attempt)))
        }
        $status = if ($httpStatus -ge 200 -and $httpStatus -lt 300) { 'uploaded' } else { 'failed' }
        $download = Save-Lp030PublicObjectForVerification -Url $publicUrl -CountyId $county.id -ObjectPath $objectPath
        try {
            $remoteLength = [int64]$download.ByteLength
            $remoteSha = [string]$download.Sha256
            $verification = if ($remoteLength -eq $file.Length -and $remoteSha -eq $sha) { 'verified' } else { 'failed' }
            $verified = ($verification -eq 'verified')
        } finally {
            if ($download -and $download.Path -and (Test-Path -LiteralPath $download.Path)) { Remove-Item -LiteralPath $download.Path -Force -ErrorAction SilentlyContinue }
        }
    }
    [pscustomobject]@{ countyId=$county.id; countyName=$county.name; sourcePath=$file.FullName; localPath=$file.FullName; fileName=$file.Name; objectPath=$objectPath; publicUrl=$publicUrl; version=$Version; localSha256=$sha; sha256=$sha; localByteLength=$file.Length; remoteByteLength=$remoteLength; remoteSha256=$remoteSha; uploadAttempted=[bool]$Execute; uploadStatus=$status; httpStatus=$httpStatus; verificationStatus=$verification; verified=$verified; error=$errorText }
}
$result = [ordered]@{ contractVersion='LP030.2'; generatedAtUtc=(Get-Date -Format 'o'); execute=[bool]$Execute; allowOverwrite=[bool]$AllowOverwrite; sourceDirectory=$sourceFullPath; runtimeAssetsManifestPath=$manifestFullPath; protectedDataRoadSegmentsModified=$false; dryRun=(-not [bool]$Execute); countyCount=$results.Count; uploadedCount=@($results | Where-Object { $_.uploadStatus -eq 'uploaded' }).Count; verifiedCount=@($results | Where-Object { $_.verificationStatus -eq 'verified' }).Count; failedCount=@($results | Where-Object { $_.uploadStatus -eq 'failed' -or $_.verificationStatus -eq 'failed' }).Count; probeDeletion=$probeDeletion; results=$results }
$resultParent = Split-Path -Parent $resultFullPath
if ($resultParent -and -not (Test-Path -LiteralPath $resultParent -PathType Container)) { New-Item -ItemType Directory -Path $resultParent -Force | Out-Null }
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resultFullPath -Encoding utf8
$result | ConvertTo-Json -Depth 8


