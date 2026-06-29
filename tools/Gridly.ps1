# Gridly.ps1
# Gridly Developer Toolkit Command Center

function Invoke-GridlyTool {
    param(
        [Parameter(Mandatory)]
        [string]$Script
    )

    $Tool = Join-Path (Get-Location) $Script

    if (!(Test-Path $Tool)) {
        Write-Host ""
        Write-Host "Tool not found:" -ForegroundColor Red
        Write-Host $Script
        Read-Host "Press ENTER"
        return
    }

    powershell -ExecutionPolicy Bypass -File $Tool

    Write-Host ""
    Read-Host "Press ENTER to return to Command Center" | Out-Null
}

while ($true) {

    Clear-Host

    $Branch = git branch --show-current 2>$null

    if (-not $Branch) {
        $Branch = "(unknown)"
    }

    $GitChanges = git status --porcelain 2>$null

    if ([string]::IsNullOrWhiteSpace($GitChanges)) {
        $GitState = "Clean"
    }
    else {
        $GitState = "Uncommitted Changes"
    }

    $Modules = @(
        "tools\Runtime\Invoke-GridlyRuntimeValidation.ps1",
        "tools\Validation\Invoke-GridlySmokeTest.ps1",
        "tools\Inventory\Get-GridlyInventory.ps1",
        "tools\Certification\New-GridlyCertification.ps1",
        "tools\Release\New-GridlyRelease.ps1",
        "tools\Release\New-GridlyHandoff.ps1",
        "tools\CountyPromotion\Test-GridlyCountyPromotionReadiness.ps1",
        "tools\ProductionPackages\Build-GridlyProductionPackages.ps1",
        "tools\CountyPromotion\Promote-GridlyCounty.ps1"
    )

    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host "              GRIDLY COMMAND CENTER" -ForegroundColor Cyan
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host ""

    Write-Host ("Repository : {0}" -f (Split-Path (Get-Location) -Leaf))
    Write-Host ("Branch     : {0}" -f $Branch)
    Write-Host ("Git Status : {0}" -f $GitState)
Write-Host ""

$Readiness = powershell -ExecutionPolicy Bypass -File ".\tools\Runtime\Invoke-GridlyProductionReadiness.ps1" 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "Production Status : READY TO SHIP" -ForegroundColor Green
}
else {
    Write-Host "Production Status : BLOCKED" -ForegroundColor Red
}

    Write-Host ""
    Write-Host "Toolkit Modules"
    Write-Host "---------------"

    foreach ($Module in $Modules) {

        if (Test-Path $Module) {
            Write-Host ("[ OK ] {0}" -f (Split-Path $Module -Leaf))
        }
        else {
            Write-Host ("[MISS] {0}" -f (Split-Path $Module -Leaf))
        }

    }

    Write-Host ""
    Write-Host "1. Runtime Validation"
    Write-Host "2. Smoke Test"
    Write-Host "3. Inventory"
    Write-Host "4. Git Status"
    Write-Host "5. Open Documentation"
    Write-Host "6. Open Certification Folder"
    Write-Host "7. Open Release Folder"
    Write-Host "8. County Promotion Readiness"
    Write-Host "9. Production Package Manufacturing"
    Write-Host "10. County Promotion Automation"
    Write-Host "0. Exit"
    Write-Host ""

    $Choice = Read-Host "Select"

    switch ($Choice) {

        "1" {

            Invoke-GridlyTool "tools\Runtime\Invoke-GridlyRuntimeValidation.ps1"

        }

        "2" {

            Invoke-GridlyTool "tools\Validation\Invoke-GridlySmokeTest.ps1"

        }

        "3" {

            Invoke-GridlyTool "tools\Inventory\Get-GridlyInventory.ps1"

        }

        "4" {

            Clear-Host

            git status

            Write-Host ""
            Read-Host "Press ENTER" | Out-Null

        }

        "5" {

            explorer ".\docs"

        }

        "6" {

            explorer ".\tools\Certification"

        }

        "7" {

            explorer ".\tools\Release"

        }

        "8" {

            Clear-Host
            $County = Read-Host "County name"

            if (-not [string]::IsNullOrWhiteSpace($County)) {
                $Tool = Join-Path (Get-Location) "tools\CountyPromotion\Test-GridlyCountyPromotionReadiness.ps1"
                powershell -ExecutionPolicy Bypass -File $Tool -County $County
            }

            Write-Host ""
            Read-Host "Press ENTER to return to Command Center" | Out-Null

        }

        "9" {

            Clear-Host
            Write-Host "Production Package Manufacturing" -ForegroundColor Cyan
            Write-Host "1. All eligible counties"
            Write-Host "2. One county"
            $ManufacturingChoice = Read-Host "Select"
            $Tool = Join-Path (Get-Location) "tools\ProductionPackages\Build-GridlyProductionPackages.ps1"

            if ($ManufacturingChoice -eq "1") {
                powershell -ExecutionPolicy Bypass -File $Tool -All
            }
            elseif ($ManufacturingChoice -eq "2") {
                $County = Read-Host "County name"
                if (-not [string]::IsNullOrWhiteSpace($County)) {
                    powershell -ExecutionPolicy Bypass -File $Tool -County $County
                }
            }

            Write-Host ""
            Read-Host "Press ENTER to return to Command Center" | Out-Null

        }

        "10" {

            Clear-Host
            Write-Host "County Promotion Automation" -ForegroundColor Cyan
            Write-Host "1. WhatIf/preflight (default)"
            Write-Host "2. Actual promotion (currently blocked by V792 safety rules)"
            $PromotionChoice = Read-Host "Select"
            $County = Read-Host "County name(s), comma-separated"
            $Tool = Join-Path (Get-Location) "tools\CountyPromotion\Promote-GridlyCounty.ps1"

            if (-not [string]::IsNullOrWhiteSpace($County)) {
                if ($PromotionChoice -eq "2") {
                    powershell -ExecutionPolicy Bypass -File $Tool -County $County
                }
                else {
                    powershell -ExecutionPolicy Bypass -File $Tool -County $County -WhatIf
                }
            }

            Write-Host ""
            Read-Host "Press ENTER to return to Command Center" | Out-Null

        }

        "0" {

            break

        }

    }

}