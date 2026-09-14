# Disposable localhost PostgreSQL/PostGIS suites only. No remote connection or production work.
param([int[]]$Phases = @(1,2,3,4,5,6,7,8))
$ErrorActionPreference = 'Stop'
$bin = 'C:\Program Files\PostgreSQL\17\bin'
if (-not (Test-Path -LiteralPath (Join-Path $bin 'initdb.exe'))) { throw 'PostgreSQL 17 local toolchain missing' }
foreach ($phase in $Phases) {
  if ($phase -lt 1 -or $phase -gt 8) { throw "Invalid phase $phase" }
  $data = Join-Path $env:TEMP ('gridly-responder-phase' + $phase + '-' + [guid]::NewGuid().ToString('N'))
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $port = $listener.LocalEndpoint.Port
  $listener.Stop()
  $started = $false
  try {
    & (Join-Path $bin 'initdb.exe') -D $data -U phase8_local_owner -A trust -E UTF8 --no-instructions *> $null
    if ($LASTEXITCODE -ne 0) { throw "Phase $phase initdb failed" }
    & (Join-Path $bin 'pg_ctl.exe') -D $data -l (Join-Path $data 'server.log') -o "-h 127.0.0.1 -p $port" -w start
    if ($LASTEXITCODE -ne 0) { throw "Phase $phase server start failed" }
    $started = $true
    $env:RESPONDER_LOCAL_PGBIN = $bin
    $env:RESPONDER_LOCAL_PGPORT = [string]$port
    $env:RESPONDER_LOCAL_PGUSER = 'phase8_local_owner'
    $env:RESPONDER_LOCAL_PGDATA = $data
    $test = if ($phase -eq 8) { 'tests/responder-phase8-local-dashboard.test.mjs' }
      else { "tests/responder-phase$phase-local-" + @{
        1='schema';2='auth';3='authority';4='rls';5='command';6='governance';7='rate-consumer'
      }[$phase] + '.test.mjs' }
    $log = Join-Path $data 'test.log'
    & node $test *> $log
    $result = $LASTEXITCODE
    $summary = @(Get-Content -LiteralPath $log | Where-Object { $_ -match '^(TOTAL|RESULT) |^PHASE5_PASS=' } | Select-Object -Last 1)
    if ($summary.Count -eq 0) { $summary = @('summary missing') }
    Write-Output "PHASE_$phase $($summary[0]) EXIT=$result"
    if ($result -ne 0) {
      Get-Content -LiteralPath $log | Where-Object { $_ -match '^FAIL ' }
      Get-Content -LiteralPath $log -Tail 35
      throw "Phase $phase suite failed"
    }
  } finally {
    if ($started) {
      & (Join-Path $bin 'pg_ctl.exe') -D $data -m immediate -w stop
      if ($LASTEXITCODE -ne 0) { throw "Phase $phase server stop failed" }
    }
    $resolved = [System.IO.Path]::GetFullPath($data).TrimEnd('\')
    $tempResolved = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
    if (-not $resolved.StartsWith($tempResolved + '\',[System.StringComparison]::OrdinalIgnoreCase) -or
      -not [System.IO.Path]::GetFileName($resolved).StartsWith("gridly-responder-phase$phase-")) {
      throw "Phase $phase cleanup path invalid"
    }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
    Remove-Item Env:RESPONDER_LOCAL_PGBIN,Env:RESPONDER_LOCAL_PGPORT,Env:RESPONDER_LOCAL_PGUSER,Env:RESPONDER_LOCAL_PGDATA -ErrorAction SilentlyContinue
  }
}
