# LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
$ErrorActionPreference='Stop'
$repo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..')).Path
$suffix=[guid]::NewGuid().ToString('N').Substring(0,12)
$projectId='gridly-dispatch-phase28-'+$suffix
$runtime=Join-Path $env:TEMP $projectId
$network='gridly-phase28-'+$suffix
$evidence=Join-Path $repo 'reports\responder\phase28-evidence'
$docker='C:\Users\gulfi\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
& node (Join-Path $PSScriptRoot 'build-package.mjs')
if($LASTEXITCODE -ne 0){throw 'build failed'}
$started=$false; $networkCreated=$false; $startAttempted=$false
function Invoke-SqlFile([string]$file,[switch]$ExpectFailure){
  $filePath=Join-Path $PSScriptRoot $file
  if(-not (Test-Path -LiteralPath $filePath)){$filePath=Join-Path $PSScriptRoot ('..\phase26\'+$file)}
  $text=[IO.File]::ReadAllText($filePath)
  $text=$text.Replace('\ir seed-static-contract.sql',[IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\phase26\seed-static-contract.sql')))
  $text=$text.Replace('\ir compatibility.sql',[IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\phase26\compatibility.sql')))
  $text | & $docker exec -i ('supabase_db_'+$projectId) psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
  if($ExpectFailure){if($LASTEXITCODE -eq 0){throw "$file unexpectedly succeeded"}}
  elseif($LASTEXITCODE -ne 0){throw "$file failed"}
}
function Invoke-Scalar([string]$sql){
  $out=& $docker exec ('supabase_db_'+$projectId) psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d postgres -c $sql
  if($LASTEXITCODE -ne 0){throw 'scalar SQL failed'}; $last=$out|Select-Object -Last 1; if($null -eq $last){return ''}; return $last.Trim()
}
try{
  if(-not (Test-Path -LiteralPath $docker)){throw 'Docker CLI missing'}
  if((& $docker info --format '{{.OSType}}').Trim() -ne 'linux'){throw 'healthy Docker Linux engine required'}
  New-Item -ItemType Directory -Path $runtime | Out-Null
  New-Item -ItemType Directory -Path $evidence -Force | Out-Null
  Push-Location $runtime
  try{
    $env:SUPABASE_TELEMETRY_DISABLED='true'
    & npm exec --offline -- supabase init | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Supabase init failed'}
    if(Test-Path -LiteralPath (Join-Path $runtime 'supabase\.temp\project-ref')){throw 'linked local project forbidden'}
    $stubDir=Join-Path $runtime 'supabase\migrations'; New-Item -ItemType Directory -Path $stubDir -Force | Out-Null
    & npm exec --offline -- supabase migration new phase28_disposable_api_bootstrap | Out-Null
    if($LASTEXITCODE -ne 0){throw 'bootstrap migration generation failed'}
    $stubFile=Get-ChildItem -LiteralPath $stubDir -Filter '*phase28_disposable_api_bootstrap.sql' | Select-Object -First 1
    [IO.File]::WriteAllText($stubFile.FullName,'CREATE SCHEMA dispatch_api;',[Text.UTF8Encoding]::new($false))
    $configPath=Join-Path $runtime 'supabase\config.toml'
    $config=[IO.File]::ReadAllText($configPath)
    $config=[regex]::new('schemas\s*=\s*\["public",\s*"graphql_public"\]').Replace($config,'schemas = ["public", "graphql_public", "dispatch_api"]',1)
    $config=[regex]::new('(?ms)(\[auth\.mfa\.totp\].*?enroll_enabled\s*=\s*)false').Replace($config,'$1true',1)
    $config=[regex]::new('(?ms)(\[auth\.mfa\.totp\].*?verify_enabled\s*=\s*)false').Replace($config,'$1true',1)
    [IO.File]::WriteAllText($configPath,$config,[Text.UTF8Encoding]::new($false))
    & $docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 $network | Out-Null
    if($LASTEXITCODE -ne 0){throw 'network create failed'}; $networkCreated=$true; $startAttempted=$true
    & npm exec --offline -- supabase start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --network-id $network 2>$null | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Supabase start failed'}; $started=$true
    $vars=@{}; & npm exec --offline -- supabase status -o env 2>$null | ForEach-Object {if($_ -match '^([A-Z0-9_]+)="(.*)"$'){$vars[$matches[1]]=$matches[2]}}
    if($vars.API_URL -ne 'http://127.0.0.1:54321'){throw 'API is not loopback-only'}
    Invoke-Scalar 'DROP SCHEMA dispatch_api'
    Invoke-SqlFile 'baseline.sql'
    [IO.File]::WriteAllText((Join-Path $evidence 'baseline-catalog.json'),(Invoke-Scalar "SELECT jsonb_build_object('schemas',(SELECT jsonb_agg(nspname ORDER BY nspname) FROM pg_namespace WHERE nspname IN('public','auth','report_retention','gridly_rehearsal')),'consumer_rows',(SELECT count(*) FROM public.gridly_consumer_sentinel),'reporting_enabled',(SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton))")+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
    Invoke-SqlFile 'preflight.sql'
    foreach($f in 'failure-type-table.sql','failure-rls.sql','failure-command.sql','failure-grants.sql'){Invoke-SqlFile $f -ExpectFailure}
    if((Invoke-Scalar "SELECT count(*) FROM pg_namespace WHERE nspname LIKE 'phase26_failure_%'") -ne '0'){throw 'failure transaction residue'}
    Invoke-SqlFile 'package.local.sql'; Invoke-SqlFile 'postflight.sql'
    Invoke-SqlFile 'rollback.sql'
    if((Invoke-Scalar "SELECT count(*) FROM pg_namespace WHERE nspname LIKE 'dispatch_%'") -ne '0'){throw 'pre-data rollback residue'}
    Invoke-SqlFile 'preflight.sql'; Invoke-SqlFile 'package.local.sql'; Invoke-SqlFile 'postflight.sql'
    $env:P28_API_URL=$vars.API_URL; $env:P28_ANON_KEY=$vars.ANON_KEY; $env:P28_SERVICE_KEY=$vars.SERVICE_ROLE_KEY
    $env:P28_DOCKER=$docker; $env:P28_PROJECT_ID=$projectId; $env:P28_EVIDENCE_DIR=$evidence
    & node --test (Join-Path $PSScriptRoot 'rehearsal-runtime.test.mjs')
    if($LASTEXITCODE -ne 0){throw 'runtime rehearsal failed'}
    & node --test (Join-Path $PSScriptRoot 'closure-runtime.test.mjs')
    if($LASTEXITCODE -ne 0){throw 'closure certification failed'}
    Invoke-SqlFile 'rollback.sql' -ExpectFailure
    if((Invoke-Scalar "SELECT count(*) FROM pg_namespace WHERE nspname='dispatch_private'") -ne '1'){throw 'evidence rollback did not preserve schema'}
    Invoke-SqlFile 'postflight.sql'
    $catalog=Invoke-Scalar "SELECT jsonb_build_object('schemas',(SELECT jsonb_agg(nspname ORDER BY nspname) FROM pg_namespace WHERE nspname LIKE 'dispatch_%'),'tables',(SELECT jsonb_agg(n.nspname||'.'||c.relname ORDER BY 1) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'dispatch_%' AND c.relkind='r'),'types',(SELECT jsonb_agg(n.nspname||'.'||t.typname ORDER BY 1) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname LIKE 'dispatch_%' AND t.typtype='e'),'functions',(SELECT jsonb_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' ORDER BY 1) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('dispatch_private','dispatch_api')),'policies',(SELECT jsonb_agg(schemaname||'.'||tablename||'.'||policyname ORDER BY 1) FROM pg_policies WHERE schemaname LIKE 'dispatch_%'),'consumer_rows',(SELECT count(*) FROM public.gridly_consumer_sentinel),'reporting_enabled',(SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton))"
    $raw=Join-Path $evidence 'post-catalog.raw.json'; [IO.File]::WriteAllText($raw,$catalog+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
    & node (Join-Path $PSScriptRoot '..\phase26\catalog-snapshot.mjs') $raw (Join-Path $evidence 'post-catalog-certified.json')
    Remove-Item -LiteralPath $raw -Force
  } finally {Pop-Location}
} finally {
  if($startAttempted -and (Test-Path -LiteralPath $runtime)){Push-Location $runtime; try{& npm exec --offline -- supabase stop --no-backup 2>$null | Out-Null}finally{Pop-Location}}
  if($networkCreated){& $docker network rm $network 2>$null | Out-Null}
  $resolved=[IO.Path]::GetFullPath($runtime); $tempRoot=[IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
  if(-not $resolved.StartsWith($tempRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or -not [IO.Path]::GetFileName($resolved).StartsWith('gridly-dispatch-phase28-')){throw 'unsafe cleanup target'}
  if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
  $containers=@(& $docker ps -a --filter 'name=gridly-dispatch-phase28-' --format '{{.Names}}'); $networks=@(& $docker network ls --filter 'name=gridly-phase28-' --format '{{.Name}}')
  $teardown=@{phase=28;containers_remaining=@($containers|Where-Object {$_});networks_remaining=@($networks|Where-Object {$_});temporary_databases_remaining=0;remote_connections=0;production_credentials=0;runtime_directory_removed=(-not (Test-Path -LiteralPath $resolved))}|ConvertTo-Json -Depth 4
  [IO.File]::WriteAllText((Join-Path $evidence 'teardown.json'),$teardown+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
  Remove-Item Env:P28_API_URL,Env:P28_ANON_KEY,Env:P28_SERVICE_KEY,Env:P28_DOCKER,Env:P28_PROJECT_ID,Env:P28_EVIDENCE_DIR,Env:SUPABASE_TELEMETRY_DISABLED -ErrorAction SilentlyContinue
}
