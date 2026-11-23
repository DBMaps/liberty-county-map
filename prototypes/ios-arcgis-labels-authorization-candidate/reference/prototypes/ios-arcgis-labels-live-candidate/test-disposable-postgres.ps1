param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin',
    [ValidateRange(1024,65535)][int]$Port = 55219
)

$ErrorActionPreference = 'Stop'
$tempRoot = [System.IO.Path]::TrimEndingDirectorySeparator(
    (Resolve-Path -LiteralPath ([System.IO.Path]::GetTempPath())).Path)
$root = Join-Path $tempRoot ('gridly-labels-pilot-pg-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root | Out-Null
$data = Join-Path $root 'data'
$passwordFile = Join-Path $root 'pg-pass'
$log = Join-Path $root 'pg.log'
$envNames = @('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSERVICE','PGSSLMODE','PGOPTIONS','GRIDLY_PILOT_PG_BIN')
$previous = @{}
foreach ($name in $envNames) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$started = $false
try {
    $password = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    [System.IO.File]::WriteAllText($passwordFile, $password, [System.Text.UTF8Encoding]::new($false))
    & "$PostgresBin/initdb.exe" -D $data -U gridly_pilot_test_owner -A scram-sha-256 "--pwfile=$passwordFile" --no-locale -E UTF8 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Disposable initdb failed' }
    Remove-Item -LiteralPath $passwordFile
    $server = Start-Process -FilePath "$PostgresBin/postgres.exe" -ArgumentList @('-D', ('"' + $data + '"'), '-h', '127.0.0.1', '-p', "$Port") `
        -RedirectStandardError $log -RedirectStandardOutput (Join-Path $root 'pg-stdout.log') -WindowStyle Hidden -PassThru
    $started = $true
    $ready = $false
    for ($attempt = 0; $attempt -lt 20 -and !$server.HasExited; $attempt++) {
        & "$PostgresBin/pg_isready.exe" -h 127.0.0.1 -p $Port -U gridly_pilot_test_owner -d postgres -t 1 -q
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 250
    }
    if (!$ready) { throw 'Disposable PostgreSQL did not become ready' }
    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = [string]$Port
    $env:PGUSER = 'gridly_pilot_test_owner'
    $env:PGPASSWORD = $password
    $env:PGDATABASE = 'postgres'
    Remove-Item Env:PGSERVICE -ErrorAction SilentlyContinue
    $env:PGSSLMODE = 'disable'
    Remove-Item Env:PGOPTIONS -ErrorAction SilentlyContinue
    $env:GRIDLY_PILOT_PG_BIN = $PostgresBin
    & "$PostgresBin/psql.exe" -Xqw -v ON_ERROR_STOP=1 -c 'create database gridly_labels_pilot_test'
    if ($LASTEXITCODE -ne 0) { throw 'Disposable database creation failed' }
    $env:PGDATABASE = 'gridly_labels_pilot_test'
    node --test (Join-Path $PSScriptRoot 'postgres.test.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Disposable database tests failed' }
} finally {
    foreach ($name in $envNames) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    if ($started -and !$server.HasExited) {
        & "$PostgresBin/pg_ctl.exe" -D $data -m fast -w stop | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Disposable PostgreSQL shutdown failed' }
    }
    $resolved = (Resolve-Path -LiteralPath $root).Path
    if ([System.IO.Path]::GetDirectoryName($resolved) -ne $tempRoot -or
        [System.IO.Path]::GetFileName($resolved) -notmatch '^gridly-labels-pilot-pg-[a-f0-9]{32}$') {
        throw 'Unexpected disposable database directory'
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
