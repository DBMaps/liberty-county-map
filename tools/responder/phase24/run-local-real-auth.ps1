# LOCAL DISPOSABLE SUPABASE AUTH ONLY. NOT A PRODUCTION MIGRATION.
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..')).Path
$suffix = [guid]::NewGuid().ToString('N').Substring(0,12)
$projectId = 'gridly-dispatch-phase24-' + $suffix
$runtime = Join-Path $env:TEMP $projectId
$network = 'gridly-phase24-' + $suffix
$dockerFallback = 'C:\Users\gulfi\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$docker = if ($dockerCommand) { $dockerCommand.Source } elseif (Test-Path -LiteralPath $dockerFallback) { $dockerFallback } else { throw 'Docker CLI missing' }
$started = $false
$startAttempted = $false
$networkCreated = $false

try {
  $serverOs = & $docker info --format '{{.OSType}}'
  if ($LASTEXITCODE -ne 0 -or $serverOs.Trim() -ne 'linux') { throw 'Healthy Docker Linux engine required' }
  New-Item -ItemType Directory -Path $runtime | Out-Null
  Push-Location $runtime
  try {
    $env:SUPABASE_TELEMETRY_DISABLED = 'true'
    & npm exec --offline -- supabase init | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Supabase local project initialization failed' }
    if (Test-Path -LiteralPath (Join-Path $runtime 'supabase\.temp\project-ref')) { throw 'Disposable project must not be linked' }
    $configPath = Join-Path $runtime 'supabase\config.toml'
    $config = [IO.File]::ReadAllText($configPath)
    $config = [regex]::new('(?ms)(\[auth\.mfa\.totp\].*?enroll_enabled\s*=\s*)false').Replace($config,'$1true',1)
    $config = [regex]::new('(?ms)(\[auth\.mfa\.totp\].*?verify_enabled\s*=\s*)false').Replace($config,'$1true',1)
    if ($config -notmatch '(?ms)\[auth\.mfa\.totp\].*?enroll_enabled\s*=\s*true.*?verify_enabled\s*=\s*true') {
      throw 'Failed to enable local TOTP'
    }
    [IO.File]::WriteAllText($configPath,$config,[Text.UTF8Encoding]::new($false))

    & $docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 $network | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Disposable loopback Docker network creation failed' }
    $networkCreated = $true
    $startAttempted = $true
    & npm exec --offline -- supabase start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --network-id $network | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Disposable Supabase stack start failed' }
    $started = $true

    $statusLines = & npm exec --offline -- supabase status -o env 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Disposable Supabase stack health check failed' }
    $vars = @{}
    foreach ($line in $statusLines) {
      if ($line -match '^([A-Z0-9_]+)="(.*)"$') { $vars[$matches[1]] = $matches[2] }
    }
    if ($vars.API_URL -ne 'http://127.0.0.1:54321') { throw 'Supabase API is not loopback-only' }
    foreach ($name in 'ANON_KEY','SERVICE_ROLE_KEY') { if (-not $vars[$name]) { throw "Missing local $name" } }

    $env:P24_API_URL = $vars.API_URL
    $env:P24_ANON_KEY = $vars.ANON_KEY
    $env:P24_SERVICE_KEY = $vars.SERVICE_ROLE_KEY
    $env:P24_DOCKER = $docker
    $env:P24_PROJECT_ID = $projectId
    & node (Join-Path $repo 'tests\responder-phase24-local-real-supabase-auth.test.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Phase 24 real local Auth suite failed' }
  } finally {
    Pop-Location
  }
} finally {
  if ($startAttempted -and (Test-Path -LiteralPath $runtime)) {
    Push-Location $runtime
    try { & npm exec --offline -- supabase stop --no-backup | Out-Null } finally { Pop-Location }
  }
  if ($networkCreated) { & $docker network rm $network 2>$null | Out-Null }
  $resolved = [IO.Path]::GetFullPath($runtime).TrimEnd('\')
  $tempResolved = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
  if (-not $resolved.StartsWith($tempResolved+'\',[StringComparison]::OrdinalIgnoreCase) -or
      -not [IO.Path]::GetFileName($resolved).StartsWith('gridly-dispatch-phase24-')) {
    throw 'Phase 24 cleanup path invalid'
  }
  if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
  Remove-Item Env:P24_API_URL,Env:P24_ANON_KEY,Env:P24_SERVICE_KEY,Env:P24_DOCKER,
    Env:P24_PROJECT_ID,Env:SUPABASE_TELEMETRY_DISABLED -ErrorAction SilentlyContinue
}
