# Get-GridlyInventory.ps1

$Repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host ""
Write-Host "GRIDLY INVENTORY" -ForegroundColor Cyan
Write-Host "================"

$items = @(
    "docs",
    "Tools",
    "js",
    "css",
    "assets",
    "index.html"
)

foreach ($item in $items) {
    $path = Join-Path $Repo $item
    if (Test-Path $path) {
        if ((Get-Item $path).PSIsContainer) {
            $count = (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue).Count
            Write-Host ("[DIR ] {0,-12} {1,6} files" -f $item,$count)
        } else {
            $size = (Get-Item $path).Length
            Write-Host ("[FILE] {0,-12} {1,6} bytes" -f $item,$size)
        }
    } else {
        Write-Host ("[MISS] {0}" -f $item) -ForegroundColor Yellow
    }
}

Write-Host ""
try {
    Write-Host ("Branch : {0}" -f (git branch --show-current))
    Write-Host ("Commit : {0}" -f (git rev-parse --short HEAD))
} catch {}

Write-Host ""
Write-Host "Inventory complete." -ForegroundColor Green
