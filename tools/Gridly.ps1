# Gridly.ps1
# Gridly Developer Toolkit Command Center
# Version: 1.0

function Show-Header {
    Clear-Host
    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host "              GRIDLY COMMAND CENTER" -ForegroundColor Cyan
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Get-GitState {
    $branch = git branch --show-current 2>$null
    if (-not $branch) { $branch = "(unknown)" }

    $status = git status --porcelain 2>$null
    if ([string]::IsNullOrWhiteSpace($status)) {
        $gitStatus = "Clean"
    } else {
        $gitStatus = "Uncommitted Changes"
    }

    [PSCustomObject]@{
        Project = Split-Path (Get-Location) -Leaf
        Branch = $branch
        Status = $gitStatus
    }
}

function Wait-ForUser {
    Write-Host ""
    Read-Host "Press ENTER to continue" | Out-Null
}

do {
    Show-Header

    $git = Get-GitState

    Write-Host ("Repository : {0}" -f $git.Project)
    Write-Host ("Branch     : {0}" -f $git.Branch)
    Write-Host ("Git Status : {0}" -f $git.Status)
    Write-Host ""

    Write-Host "1. Git Status"
    Write-Host "2. Open Build"
    Write-Host "3. Open Certification"
    Write-Host "4. Open Runtime"
    Write-Host "5. Open Validation"
    Write-Host "6. Open Inventory"
    Write-Host "7. Open Release"
    Write-Host "8. Open Docs"
    Write-Host "9. Open Repository"
    Write-Host "0. Exit"
    Write-Host ""

    $choice = Read-Host "Select"

    switch ($choice) {
        "1" {
            Clear-Host
            git status
            Wait-ForUser
        }
        "2" { explorer ".\Tools\Build" }
        "3" { explorer ".\Tools\Certification" }
        "4" { explorer ".\Tools\Runtime" }
        "5" { explorer ".\Tools\Validation" }
        "6" { explorer ".\Tools\Inventory" }
        "7" { explorer ".\Tools\Release" }
        "8" { explorer ".\docs" }
        "9" { explorer "." }
        "0" { break }
        default {
            Write-Host "Invalid selection."
            Wait-ForUser
        }
    }

} while ($true)
