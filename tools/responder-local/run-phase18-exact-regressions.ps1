# Exact-version Phase 18 regression runner. It creates and removes only its own
# marked, loopback-only disposable container. It never uses Supabase linked state.
param(
  [string]$DockerPath,
  [string]$Image='gridly/postgres17.6-postgis3.3.7-exact:phase18'
)
$ErrorActionPreference='Stop'
$expectedImageId='sha256:c6bb935d4a002250fa5207499c0a0429bb0d367d6662b67977a65d714ac4d05d'
$password=$env:RESPONDER_PHASE18_LOCAL_PASSWORD
if([string]::IsNullOrWhiteSpace($password)){throw 'RESPONDER_PHASE18_LOCAL_PASSWORD is required'}
if([string]::IsNullOrWhiteSpace($DockerPath)){
  $command=Get-Command docker -ErrorAction SilentlyContinue
  if($command){$DockerPath=$command.Source}
  else{
    $candidate=Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
    if(Test-Path -LiteralPath $candidate){$DockerPath=$candidate}
  }
}
if([string]::IsNullOrWhiteSpace($DockerPath) -or -not (Test-Path -LiteralPath $DockerPath)){
  throw 'Docker CLI not found'
}
$psqlBin='C:\Program Files\PostgreSQL\17\bin'
if(-not (Test-Path -LiteralPath (Join-Path $psqlBin 'psql.exe'))){throw 'PostgreSQL 17 client not found'}
$container='gridly-phase18-exact-tests-'+[guid]::NewGuid().ToString('N').Substring(0,12)
$testData=Join-Path $env:TEMP ('gridly-responder-phase17-'+[guid]::NewGuid().ToString('N'))
$created=$false
try{
  & $DockerPath run -d --name $container `
    --label 'com.gridly.phase18.nonproduction=true' `
    --label 'com.gridly.phase18.purpose=isolated-regression-tests' `
    --label 'com.gridly.phase18.production-access=forbidden' `
    -e "POSTGRES_PASSWORD=$password" -p '127.0.0.1::5432' $Image | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Could not create exact-version test container'}
  $created=$true
  $inspect=(& $DockerPath inspect $container | ConvertFrom-Json)[0]
  if($inspect.Image -ne $expectedImageId `
    -or $inspect.Config.Labels.'com.gridly.phase18.nonproduction' -ne 'true' `
    -or $inspect.Config.Labels.'com.gridly.phase18.production-access' -ne 'forbidden'){
    throw 'Exact-version test container identity check failed'
  }
  $binding=$inspect.NetworkSettings.Ports.'5432/tcp'[0]
  if($binding.HostIp -ne '127.0.0.1' -or $binding.HostPort -notmatch '^[0-9]{4,5}$'){
    throw 'Exact-version test container is not loopback-only'
  }
  $port=[string]$binding.HostPort
  $ready=$false
  for($attempt=0;$attempt -lt 30 -and -not $ready;$attempt++){
    & $DockerPath exec $container pg_isready -U postgres -d postgres *> $null
    $ready=$LASTEXITCODE -eq 0
    if(-not $ready){Start-Sleep -Milliseconds 500}
  }
  if(-not $ready){throw 'Exact-version test database did not become ready'}
  New-Item -ItemType Directory -Path $testData | Out-Null
  $env:RESPONDER_PHASE17_PGBIN=$psqlBin
  $env:RESPONDER_PHASE17_PGPORT=$port
  $env:RESPONDER_PHASE17_PGUSER='postgres'
  $env:RESPONDER_PHASE17_PGDATA=$testData
  $env:RESPONDER_PHASE17_PGPASSWORD=$password
  $env:RESPONDER_PHASE17_EXPECTED_POSTGIS='3.3.7'
  & node tests/responder-phase17-production-migration.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Exact-version migration regression failed'}
  & node tests/responder-phase17-security-regression.test.mjs
  if($LASTEXITCODE -ne 0){throw 'Exact-version security regression failed'}
}finally{
  Remove-Item Env:RESPONDER_PHASE17_PGBIN,Env:RESPONDER_PHASE17_PGPORT,
    Env:RESPONDER_PHASE17_PGUSER,Env:RESPONDER_PHASE17_PGDATA,
    Env:RESPONDER_PHASE17_PGPASSWORD,Env:RESPONDER_PHASE17_EXPECTED_POSTGIS `
    -ErrorAction SilentlyContinue
  $resolved=[IO.Path]::GetFullPath($testData)
  $tempRoot=[IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
  if(Test-Path -LiteralPath $resolved){
    if(-not $resolved.StartsWith($tempRoot+'\',[StringComparison]::OrdinalIgnoreCase) `
      -or -not [IO.Path]::GetFileName($resolved).StartsWith('gridly-responder-phase17-')){
      throw 'Refusing unsafe temporary-directory cleanup'
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
  if($created){
    $proof=(& $DockerPath inspect $container | ConvertFrom-Json)[0]
    if($proof.Name -eq '/'+$container `
      -and $proof.Config.Labels.'com.gridly.phase18.nonproduction' -eq 'true' `
      -and $container.StartsWith('gridly-phase18-exact-tests-')){
      & $DockerPath rm -f $container | Out-Null
    }else{throw 'Refusing to remove an unverified container'}
  }
}
