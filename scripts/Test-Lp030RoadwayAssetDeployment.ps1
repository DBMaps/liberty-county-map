<#
.SYNOPSIS
Self-contained validation for LP030.2 roadway asset upload tooling.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$deployScript = Join-Path $PSScriptRoot 'Deploy-Lp030RoadwayAssets.ps1'
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("gridly-lp030-roadway-assets-" + [System.Guid]::NewGuid().ToString('n'))
$sourceDir = Join-Path $tempRoot 'road-segments'
$resultPath = Join-Path $tempRoot 'results/result.json'
New-Item -ItemType Directory -Path $sourceDir -Force | Out-Null

$countyNames = @('Austin','Brazoria','Brazos','Calhoun','Chambers','Colorado','Fayette','Fort Bend','Galveston','Grimes','Hardin','Jackson','Jasper','Jefferson','Lavaca','Matagorda','Newton','Orange','Polk','Tyler','Walker','Waller','Washington','Wharton')
function ConvertTo-TestCountyId { param([string]$Name) (($Name.ToLowerInvariant() -replace '[^a-z0-9]+','-') -replace '(^-|-$)','') + '-tx' }
function Write-TestInventory {
    param([string[]]$Names)
    Remove-Item -LiteralPath (Join-Path $sourceDir '*') -Force -ErrorAction SilentlyContinue
    $entries = @()
    foreach ($name in $Names) {
        $id = ConvertTo-TestCountyId $name
        $fileName = "$id-road-segments.geojson"
        $path = Join-Path $sourceDir $fileName
        '{"type":"FeatureCollection","features":[]}' | Set-Content -LiteralPath $path -Encoding ascii
        $entries += [pscustomobject]@{ countyId=$id; countyName=$name; fileName=$fileName; sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant(); byteLength=(Get-Item -LiteralPath $path).Length }
    }
    [pscustomobject]@{ assets=$entries } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $sourceDir 'lp028-roadway-runtime-assets.json') -Encoding utf8
}
function Assert-Fails {
    param([scriptblock]$Block, [string]$Pattern)
    $failed = $false
    try { & $Block | Out-Null } catch { $failed = $_.Exception.Message -match $Pattern }
    if (-not $failed) { throw "Expected failure matching $Pattern" }
}

try {
    Write-TestInventory $countyNames
    $before = Get-ChildItem -LiteralPath $sourceDir -File | ForEach-Object { @{ path=$_.FullName; hash=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash } }
    & $deployScript -SourceDirectory $sourceDir -ResultOutputPath $resultPath -Version 'lp030-test' | Out-Null
    $after = Get-ChildItem -LiteralPath $sourceDir -File | ForEach-Object { @{ path=$_.FullName; hash=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash } }
    if (($before | ConvertTo-Json -Compress) -ne ($after | ConvertTo-Json -Compress)) { throw 'Protected source fixture hashes changed.' }
    $result = Get-Content -Raw -LiteralPath $resultPath | ConvertFrom-Json
    if ($result.execute -ne $false) { throw 'Dry-run must not execute uploads.' }
    if ($result.countyCount -ne 24) { throw 'Expected 24 county results.' }
    foreach ($field in @('countyId','countyName','localPath','fileName','objectPath','publicUrl','version','sha256','localByteLength','remoteByteLength','uploadAttempted','uploadStatus','httpStatus','verificationStatus','verified','error')) {
        if ($result.results[0].PSObject.Properties.Name -notcontains $field) { throw "Missing result field $field" }
    }
    if ($result.results | Where-Object { $_.uploadAttempted -ne $false -or $_.uploadStatus -ne 'dry-run' }) { throw 'No upload may occur without -Execute.' }

    Write-TestInventory ($countyNames + @('Harris'))
    Assert-Fails { & $deployScript -SourceDirectory $sourceDir -ResultOutputPath $resultPath } 'Harris'
    Write-TestInventory ($countyNames | Where-Object { $_ -ne 'Austin' })
    Assert-Fails { & $deployScript -SourceDirectory $sourceDir -ResultOutputPath $resultPath } 'Missing expected county'
    Write-TestInventory ($countyNames + @('Dallas'))
    Assert-Fails { & $deployScript -SourceDirectory $sourceDir -ResultOutputPath $resultPath } 'Extra county'
    Write-TestInventory $countyNames
    'not geojson' | Set-Content -LiteralPath (Join-Path $sourceDir 'notes.txt')
    Assert-Fails { & $deployScript -SourceDirectory $sourceDir -ResultOutputPath $resultPath } 'Non-GeoJSON'
    Remove-Item -LiteralPath (Join-Path $sourceDir 'notes.txt') -Force
    $env:GRIDLY_ROADWAY_STORAGE_BASE_URL = 'http://storage.example.invalid'
    Assert-Fails { & $deployScript -SourceDirectory $sourceDir -ResultOutputPath $resultPath } 'HTTPS except localhost'
    $env:GRIDLY_ROADWAY_STORAGE_BASE_URL = $null

    $deployText = Get-Content -Raw -LiteralPath $deployScript
    if ($deployText -match 'Get-Content\s+-Raw\s+-LiteralPath\s+\$file\.FullName\s*\|\s*ConvertFrom-Json') { throw 'Deployment path parses full GeoJSON with ConvertFrom-Json.' }
    if ($deployText -match 'Write-(Host|Output)\s+\$token') { throw 'Token redaction check failed.' }
    if ($deployText -notmatch 'Remote object exists and -AllowOverwrite was not supplied') { throw 'Overwrite protection check failed.' }

    Write-Host 'LP030.2 roadway asset deployment tooling tests passed'
} finally {
    $env:GRIDLY_ROADWAY_STORAGE_BASE_URL = $null
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
