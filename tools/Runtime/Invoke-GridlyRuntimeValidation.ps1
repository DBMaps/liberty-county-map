# Invoke-GridlyRuntimeValidation.ps1

$Repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "     GRIDLY PRODUCTION RUNTIME VALIDATION" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

$Checks = @()

function Add-Check {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Details
    )

    $script:Checks += [PSCustomObject]@{
        Check   = $Name
        Result  = if ($Passed) { "PASS" } else { "FAIL" }
        Details = $Details
    }
}

function Check-Path {
    param(
        [string]$Name,
        [string]$RelativePath
    )

    $FullPath = Join-Path $Repo $RelativePath
    Add-Check $Name (Test-Path $FullPath) $RelativePath
}

# Core Application
Check-Path "index.html" "index.html"
Check-Path "js/app.js" "js\app.js"
Check-Path "css" "css"
Check-Path "assets" "assets"
Check-Path "docs" "docs"
Check-Path "Tools" "Tools"

# Git Status
$GitStatus = git status --porcelain 2>$null

if ([string]::IsNullOrWhiteSpace($GitStatus)) {
    Add-Check "Working Tree" $true "Clean"
}
else {
    Add-Check "Working Tree" $false "Uncommitted Changes"
}

$Checks | Format-Table -AutoSize

Write-Host ""

if (-not [string]::IsNullOrWhiteSpace($GitStatus)) {

    Write-Host "Git Changes" -ForegroundColor Yellow
    Write-Host "-----------"

    foreach ($line in ($GitStatus -split "`n")) {

        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        $status = $line.Substring(0,2).Trim()
        $file   = $line.Substring(3)

        switch ($status) {

            "M"  { $label = "Modified" }
            "A"  { $label = "Added" }
            "D"  { $label = "Deleted" }
            "R"  { $label = "Renamed" }
            "??" { $label = "Untracked" }
            default { $label = $status }

        }

        Write-Host ("{0,-12} {1}" -f $label,$file)
    }

    Write-Host ""
}

$Failures = ($Checks | Where-Object Result -eq "FAIL").Count

if ($Failures -eq 0) {
    Write-Host "Overall Result: PASS" -ForegroundColor Green
}
else {
    Write-Host ("Overall Result: FAIL ({0} issue(s))" -f $Failures) -ForegroundColor Red
}