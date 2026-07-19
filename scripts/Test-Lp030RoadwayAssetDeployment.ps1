<#
.SYNOPSIS
Self-contained validation for LP030.3 roadway asset upload tooling.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$deployScript = Join-Path $PSScriptRoot 'Deploy-Lp030RoadwayAssets.ps1'
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("gridly-lp030-roadway-assets-" + [System.Guid]::NewGuid().ToString('n'))
$sourceDir = Join-Path $tempRoot 'road-segments'
$resultPath = Join-Path $tempRoot 'results/result.json'
$stdoutPath = Join-Path $tempRoot 'child-stdout.txt'
$stderrPath = Join-Path $tempRoot 'child-stderr.txt'
New-Item -ItemType Directory -Path $sourceDir -Force | Out-Null

$countyNames = @('Austin','Brazoria','Brazos','Calhoun','Chambers','Colorado','Fayette','Fort Bend','Galveston','Grimes','Hardin','Jackson','Jasper','Jefferson','Lavaca','Matagorda','Newton','Orange','Polk','Tyler','Walker','Waller','Washington','Wharton')
function ConvertTo-TestCountyId { param([string]$Name) (($Name.ToLowerInvariant() -replace '[^a-z0-9]+','-') -replace '(^-|-$)','') + '-tx' }
function Clear-TestDirectory {
    param([string]$Directory)
    if (Test-Path -LiteralPath $Directory -PathType Container) {
        Get-ChildItem -LiteralPath $Directory -Force | Remove-Item -Recurse -Force
    }
}
function Write-TestInventory {
    param([string[]]$Names)
    Clear-TestDirectory $sourceDir
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
function Get-PowerShellChildProcessName {
    $powershellExe = Get-Command powershell.exe -ErrorAction SilentlyContinue
    if ($powershellExe) { return $powershellExe.Source }
    $powershell = Get-Command powershell -ErrorAction SilentlyContinue
    if ($powershell) { return $powershell.Source }
    throw 'Windows PowerShell child process was not found.'
}
function Invoke-DeployChildProcess {
    param([string[]]$Arguments)
    Remove-Item -LiteralPath $stdoutPath,$stderrPath -Force -ErrorAction SilentlyContinue
    $processName = Get-PowerShellChildProcessName
    $allArguments = @('-NoProfile','-ExecutionPolicy','Bypass','-File',$deployScript) + $Arguments
    $process = Start-Process -FilePath $processName -ArgumentList $allArguments -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    $stdout = ''
    $stderr = ''
    if (Test-Path -LiteralPath $stdoutPath) { $stdout = Get-Content -Raw -LiteralPath $stdoutPath }
    if (Test-Path -LiteralPath $stderrPath) { $stderr = Get-Content -Raw -LiteralPath $stderrPath }
    return [pscustomobject]@{ ExitCode = [int]$process.ExitCode; StdOut = $stdout; StdErr = $stderr; CombinedOutput = ($stdout + "`n" + $stderr) }
}
function Assert-ChildFails {
    param([string[]]$Arguments, [string]$Pattern)
    $result = Invoke-DeployChildProcess $Arguments
    if ($result.ExitCode -eq 0) { throw "Expected nonzero exit code matching $Pattern" }
    if ($result.CombinedOutput -notmatch $Pattern) { throw "Expected failure matching $Pattern. ExitCode=$($result.ExitCode). Output=$($result.CombinedOutput)" }
}
function Assert-ChildSucceeds {
    param([string[]]$Arguments)
    $result = Invoke-DeployChildProcess $Arguments
    if ($result.ExitCode -ne 0) { throw "Expected zero exit code. ExitCode=$($result.ExitCode). Output=$($result.CombinedOutput)" }
    return $result
}

try {
    Write-TestInventory $countyNames
    $before = Get-ChildItem -LiteralPath $sourceDir -File | Sort-Object Name | ForEach-Object { @{ path=$_.FullName; hash=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash } }
    Assert-ChildSucceeds @('-SourceDirectory',$sourceDir,'-ResultOutputPath',$resultPath,'-Version','lp030-test') | Out-Null
    $after = Get-ChildItem -LiteralPath $sourceDir -File | Sort-Object Name | ForEach-Object { @{ path=$_.FullName; hash=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash } }
    if (($before | ConvertTo-Json -Compress) -ne ($after | ConvertTo-Json -Compress)) { throw 'Protected source fixture hashes changed.' }
    $result = Get-Content -Raw -LiteralPath $resultPath | ConvertFrom-Json
    if ($result.execute -ne $false) { throw 'Dry-run must not execute uploads.' }
    if ($result.countyCount -ne 24) { throw 'Expected 24 county results.' }
    foreach ($field in @('countyId','countyName','localPath','fileName','objectPath','publicUrl','version','sha256','localByteLength','remoteByteLength','uploadAttempted','uploadStatus','httpStatus','verificationStatus','verified','error')) {
        if ($result.results[0].PSObject.Properties.Name -notcontains $field) { throw "Missing result field $field" }
    }
    if ($result.results | Where-Object { $_.uploadAttempted -ne $false -or $_.uploadStatus -ne 'dry-run' }) { throw 'No upload may occur without -Execute.' }

    Write-TestInventory ($countyNames + @('Harris'))
    Assert-ChildFails @('-SourceDirectory',$sourceDir,'-ResultOutputPath',$resultPath) 'Harris'
    $missingCountyNames = @($countyNames | Where-Object { $_ -ne 'Austin' })
    if ($missingCountyNames.Count -ne 23 -or ($missingCountyNames -contains 'Austin')) { throw 'Missing-county fixture must omit exactly Austin and contain 23 counties.' }
    Write-TestInventory $missingCountyNames
    Assert-ChildFails @('-SourceDirectory',$sourceDir,'-ResultOutputPath',$resultPath) 'Missing expected county package\(s\): austin-tx'
    Write-TestInventory ($countyNames + @('Dallas'))
    Assert-ChildFails @('-SourceDirectory',$sourceDir,'-ResultOutputPath',$resultPath) 'Extra county package\(s\): dallas-tx'
    Write-TestInventory $countyNames
    'not geojson' | Set-Content -LiteralPath (Join-Path $sourceDir 'notes.txt')
    Assert-ChildFails @('-SourceDirectory',$sourceDir,'-ResultOutputPath',$resultPath) 'Non-GeoJSON'
    Remove-Item -LiteralPath (Join-Path $sourceDir 'notes.txt') -Force
    $env:GRIDLY_ROADWAY_STORAGE_BASE_URL = 'http://storage.example.invalid'
    Assert-ChildFails @('-SourceDirectory',$sourceDir,'-ResultOutputPath',$resultPath) 'HTTPS except localhost'
    $env:GRIDLY_ROADWAY_STORAGE_BASE_URL = $null

    $deployText = Get-Content -Raw -LiteralPath $deployScript
    if ($deployText -match 'Get-Content\s+-Raw\s+-LiteralPath\s+\$file\.FullName\s*\|\s*ConvertFrom-Json') { throw 'Deployment path parses full GeoJSON with ConvertFrom-Json.' }
    if ($deployText -match 'Write-(Host|Output)\s+\$token') { throw 'Token redaction check failed.' }
    if ($deployText -notmatch 'Remote object exists and -AllowOverwrite was not supplied') { throw 'Overwrite protection check failed.' }

    Write-Host 'LP030.3 roadway asset deployment tooling tests passed'
} finally {
    $env:GRIDLY_ROADWAY_STORAGE_BASE_URL = $null
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
