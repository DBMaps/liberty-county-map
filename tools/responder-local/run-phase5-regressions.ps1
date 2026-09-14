# LOCAL/DISPOSABLE ONLY. Executes existing Phase 1-4 tests in separate localhost clusters.
$ErrorActionPreference = 'Stop'
$bin = 'C:\Program Files\PostgreSQL\17\bin'
$results = @()
foreach ($phase in 1..4) {
  $data = Join-Path $env:TEMP ('gridly-responder-phase' + $phase + '-' + [guid]::NewGuid().ToString('N'))
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $port = $listener.LocalEndpoint.Port
  $listener.Stop()
  $started = $false
  try {
    Write-Output "PHASE_$phase initializing disposable cluster"
    & (Join-Path $bin 'initdb.exe') -D $data -U phase5_regression_owner -A trust -E UTF8 --no-instructions *> $null
    if ($LASTEXITCODE -ne 0) { throw "Phase $phase initdb failed" }
    & (Join-Path $bin 'pg_ctl.exe') -D $data -l (Join-Path $data 'server.log') -o "-h 127.0.0.1 -p $port" -w start
    if ($LASTEXITCODE -ne 0) { throw "Phase $phase server start failed" }
    $started = $true
    Write-Output "PHASE_$phase running local regression"
    $env:RESPONDER_LOCAL_PGBIN = $bin
    $env:RESPONDER_LOCAL_PGPORT = [string]$port
    $env:RESPONDER_LOCAL_PGUSER = 'phase5_regression_owner'
    $env:RESPONDER_LOCAL_PGDATA = $data
    $test = switch ($phase) {
      1 { 'tests/responder-phase1-local-schema.test.mjs' }
      2 { 'tests/responder-phase2-local-auth.test.mjs' }
      3 { 'tests/responder-phase3-local-authority.test.mjs' }
      4 { 'tests/responder-phase4-local-rls.test.mjs' }
    }
    $log = Join-Path $data 'test.log'
    & node $test *> $log
    $exitCode = $LASTEXITCODE
    $summary = @(Get-Content -LiteralPath $log | Where-Object { $_ -match '^(TOTAL|RESULT) ' } | Select-Object -Last 1)
    if ($summary.Count -eq 0) { $summary = @('summary missing') }
    Write-Output "PHASE_$phase $($summary[0]) EXIT=$exitCode"
    if ($exitCode -ne 0) {
      Get-Content -LiteralPath $log -Tail 30
      throw "Phase $phase regression failed"
    }
    $results += "Phase ${phase}: $($summary[0])"
  } catch {
    Write-Output "PHASE_$phase ERROR=$($_.Exception.Message)"
    $results += "Phase ${phase}: FAIL"
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
  }
}
$results | ForEach-Object { Write-Output "REGRESSION $_" }
if (@($results | Where-Object { $_ -match '^Phase [1-4]: FAIL$' }).Count -gt 0) { exit 1 }
