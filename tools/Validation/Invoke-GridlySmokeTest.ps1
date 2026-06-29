# Invoke-GridlySmokeTest.ps1

$Repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host ""
Write-Host "GRIDLY SMOKE TEST" -ForegroundColor Cyan
Write-Host "================="

$tests = @(
    @{Name="index.html"; Path="index.html"},
    @{Name="app.js"; Path="js\app.js"},
    @{Name="styles.css"; Path="css\styles.css"},
    @{Name="docs"; Path="docs"},
    @{Name="Tools"; Path="Tools"}
)

$failed = $false

foreach ($t in $tests) {
    $full = Join-Path $Repo $t.Path
    if (Test-Path $full) {
        Write-Host ("[PASS] {0}" -f $t.Name) -ForegroundColor Green
    }
    else {
        Write-Host ("[FAIL] {0}" -f $t.Name) -ForegroundColor Red
        $failed = $true
    }
}

Write-Host ""

try {
    $branch = git branch --show-current 2>$null
    Write-Host ("Branch: {0}" -f $branch)
}
catch {}

Write-Host ""

if ($failed) {
    Write-Host "SMOKE TEST FAILED" -ForegroundColor Red
    exit 1
}
else {
    Write-Host "SMOKE TEST PASSED" -ForegroundColor Green
    exit 0
}
