# Invoke-GridlyProductionReadiness.ps1

$Repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$Checks = @()

function Add-Check {

    param(
        [string]$Category,
        [string]$Name,
        [bool]$Passed,
        [string]$Details
    )

    $script:Checks += [PSCustomObject]@{
        Category = $Category
        Name     = $Name
        Result   = if ($Passed) { "PASS" } else { "FAIL" }
        Details  = $Details
    }
}

function Test-Item {

    param(
        [string]$Category,
        [string]$Name,
        [string]$RelativePath
    )

    $Path = Join-Path $Repo $RelativePath

    Add-Check $Category $Name (Test-Path $Path) $RelativePath
}

# --------------------------------------------------
# Runtime
# --------------------------------------------------

Test-Item "Runtime" "Runtime Validator" "tools\Runtime\Invoke-GridlyRuntimeValidation.ps1"
Test-Item "Runtime" "Smoke Test" "tools\Validation\Invoke-GridlySmokeTest.ps1"
Test-Item "Runtime" "Inventory" "tools\Inventory\Get-GridlyInventory.ps1"

# --------------------------------------------------
# Toolkit
# --------------------------------------------------

Test-Item "Toolkit" "Certification" "tools\Certification\New-GridlyCertification.ps1"
Test-Item "Toolkit" "Release Notes" "tools\Release\New-GridlyRelease.ps1"
Test-Item "Toolkit" "Handoff" "tools\Release\New-GridlyHandoff.ps1"

# --------------------------------------------------
# Application
# --------------------------------------------------

Test-Item "Application" "index.html" "index.html"
Test-Item "Application" "app.js" "js\app.js"
Test-Item "Application" "css" "css"
Test-Item "Application" "assets" "assets"

# --------------------------------------------------
# Documentation
# --------------------------------------------------

Test-Item "Documentation" "docs" "docs"
Test-Item "Documentation" "Standards" "docs\Standards"
Test-Item "Documentation" "Certifications" "docs\certifications"

# --------------------------------------------------
# Git
# --------------------------------------------------

$GitStatus = git status --porcelain 2>$null

if ([string]::IsNullOrWhiteSpace($GitStatus)) {

    Add-Check "Git" "Working Tree" $true "Clean"

}
else {

    Add-Check "Git" "Working Tree" $false "Uncommitted Changes"

}

Clear-Host

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "          GRIDLY PRODUCTION READINESS" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

foreach ($Category in ($Checks.Category | Select-Object -Unique)) {

    Write-Host $Category -ForegroundColor Yellow
    Write-Host ("-" * 45)

    $Checks |
        Where-Object Category -eq $Category |
        ForEach-Object {

            Write-Host ("{0,-22} {1}" -f $_.Name, $_.Result)

        }

    Write-Host ""

}

$Failures = $Checks | Where-Object Result -eq "FAIL"

if ($Failures.Count -eq 0) {

    Write-Host "====================================================" -ForegroundColor Green
    Write-Host "                 READY TO SHIP" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green

    exit 0

}

Write-Host "====================================================" -ForegroundColor Red
Write-Host "                    BLOCKED" -ForegroundColor Red
Write-Host "====================================================" -ForegroundColor Red
Write-Host ""

Write-Host "Failed Checks:" -ForegroundColor Yellow

$Failures | ForEach-Object {

    Write-Host (" - [{0}] {1}" -f $_.Category,$_.Name)

}

Write-Host ""

Write-Host "Git Details:" -ForegroundColor Yellow

git status --short

exit 1