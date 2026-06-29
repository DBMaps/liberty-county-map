# Update-GridlyCommandCenter.ps1
# Connects Gridly.ps1 menu to toolkit scripts.

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host ""
Write-Host "GRIDLY TOOLKIT CHECK" -ForegroundColor Cyan
Write-Host "===================="

$tools = @(
    "Tools\Certification\New-GridlyCertification.ps1",
    "Tools\Runtime\Invoke-GridlyRuntimeValidation.ps1",
    "Tools\Validation\Invoke-GridlySmokeTest.ps1",
    "Tools\Release\New-GridlyRelease.ps1",
    "Tools\Release\New-GridlyHandoff.ps1",
    "Tools\Inventory\Get-GridlyInventory.ps1"
)

$missing = $false

foreach($tool in $tools){
    $full = Join-Path $repo $tool
    if(Test-Path $full){
        Write-Host ("[PASS] {0}" -f $tool) -ForegroundColor Green
    } else {
        Write-Host ("[FAIL] {0}" -f $tool) -ForegroundColor Red
        $missing = $true
    }
}

Write-Host ""

if($missing){
    Write-Host "Toolkit is incomplete." -ForegroundColor Yellow
    exit 1
}

Write-Host "Toolkit foundation complete." -ForegroundColor Green
Write-Host "Ready for Command Center integration."
