param()
# LOCAL DISPOSABLE CERTIFICATION ONLY. No linked project or production endpoint.
$ErrorActionPreference='Stop'
$repo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..\..')).Path
$suffix=[guid]::NewGuid().ToString('N').Substring(0,12)
$projectId='gridly-dispatch-phase29-'+$suffix
$runtime=Join-Path $env:TEMP $projectId
$network='gridly-phase29-'+$suffix
$evidence=Join-Path $repo 'reports\responder\phase29-evidence\deployment-safe-installer'
$docker='C:\Users\gulfi\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$supabase='C:\Users\gulfi\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\@supabase\cli-windows-x64\bin\supabase.exe'
if($WorkerOnly){$evidence=Join-Path $repo 'reports\responder\phase29-evidence\worker-hosting'; if($FocusedOnly -or $ReviewOnly -or $InviteOnly){throw 'Worker certification switches cannot be combined'}}
$started=$false; $networkCreated=$false; $startAttempted=$false
function Assert-DisposableCliDirectory {
 if((Get-Location).Path -ne $runtime -or -not $runtime.StartsWith([IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Supabase CLI outside disposable TEMP project refused'}
}
function Invoke-SqlFile([string]$file) {
 $sql=[IO.File]::ReadAllText($file)
 $sql | & $docker exec -i ('supabase_db_'+$projectId) psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
 if($LASTEXITCODE -ne 0){throw "SQL install failed: $file"}
}
try {
 & node (Join-Path $PSScriptRoot 'build.mjs'); if($LASTEXITCODE -ne 0){throw 'package build failed'}
 if((& $docker info --format '{{.OSType}}').Trim() -ne 'linux'){throw 'healthy local Linux Docker engine required'}
 New-Item -ItemType Directory -Path $runtime | Out-Null
 New-Item -ItemType Directory -Path $evidence -Force | Out-Null
 Push-Location $runtime
 try {
 $env:SUPABASE_TELEMETRY_DISABLED='true'
 Assert-DisposableCliDirectory; & $supabase init | Out-Null; if($LASTEXITCODE -ne 0){throw 'unlinked init failed'}
 if(Test-Path -LiteralPath (Join-Path $runtime 'supabase\.temp\project-ref')){throw 'linked project refused'}
 Assert-DisposableCliDirectory; & $supabase migration new phase29_disposable_bootstrap | Out-Null; if($LASTEXITCODE -ne 0){throw 'bootstrap generation failed'}
 $stubFile=Get-ChildItem -LiteralPath (Join-Path $runtime 'supabase\migrations') -Filter '*phase29_disposable_bootstrap.sql' | Select-Object -First 1
 [IO.File]::WriteAllText($stubFile.FullName,'CREATE SCHEMA dispatch_api;',[Text.UTF8Encoding]::new($false))
 $configPath=Join-Path $runtime 'supabase\config.toml'; $config=[IO.File]::ReadAllText($configPath)
 $config=[regex]::new('schemas\s*=\s*\["public",\s*"graphql_public"\]').Replace($config,'schemas = ["public", "graphql_public", "dispatch_api"]',1)
 $config=[regex]::new('(?ms)(\[auth\.mfa\.totp\].*?enroll_enabled\s*=\s*)false').Replace($config,'$1true',1)
 $config=[regex]::new('(?ms)(\[auth\.mfa\.totp\].*?verify_enabled\s*=\s*)false').Replace($config,'$1true',1)
 [IO.File]::WriteAllText($configPath,$config,[Text.UTF8Encoding]::new($false))
 & $docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 $network | Out-Null; if($LASTEXITCODE -ne 0){throw 'loopback network failed'}; $networkCreated=$true; $startAttempted=$true
 Assert-DisposableCliDirectory; & $supabase start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --network-id $network 2>$null | Out-Null
 if($LASTEXITCODE -ne 0){throw 'disposable Supabase start failed'}; $started=$true
 $vars=@{}; Assert-DisposableCliDirectory; & $supabase status -o env 2>$null | ForEach-Object {if($_ -match '^([A-Z0-9_]+)="(.*)"$'){$vars[$matches[1]]=$matches[2]}}
 if($vars.API_URL -ne 'http://127.0.0.1:54321'){throw 'non-loopback API refused'}
 'DROP SCHEMA dispatch_api;' | & $docker exec -i ('supabase_db_'+$projectId) psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
 if($LASTEXITCODE -ne 0){throw 'bootstrap cleanup failed'}
 'ALTER ROLE postgres NOSUPERUSER CREATEDB CREATEROLE BYPASSRLS;' | & $docker exec -i ('supabase_db_'+$projectId) psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d postgres
 if($LASTEXITCODE -ne 0){throw 'standard nonsuperuser administrator baseline failed'}
 $env:P29_API_URL=$vars.API_URL; $env:P29_DOCKER=$docker; $env:P29_PROJECT_ID=$projectId; $env:P29_EVIDENCE_DIR=$evidence
 & node --test (Join-Path $PSScriptRoot 'runtime.test.mjs'); if($LASTEXITCODE -ne 0){throw 'installer runtime certification failed'}
 $env:P29_INVITE_ONLY=if($InviteOnly){'true'}else{'false'}; $env:P29_REVIEW_ONLY=if($ReviewOnly){'true'}else{'false'}; $env:P29_API_URL=$vars.API_URL; $env:P29_ANON_KEY=$vars.ANON_KEY; $env:P29_SERVICE_KEY=$vars.SERVICE_ROLE_KEY
 $env:P29_DOCKER=$docker; $env:P29_PROJECT_ID=$projectId; $env:P29_EVIDENCE_DIR=$evidence
 & node --test (Join-Path $PSScriptRoot 'compat.runtime.test.mjs'); if($LASTEXITCODE -ne 0){throw 'Phase 29 runtime certification failed'}
 & node --test (Join-Path $PSScriptRoot 'principal.runtime.test.mjs'); if($LASTEXITCODE -ne 0){throw 'principal certification failed'}
 Invoke-SqlFile (Join-Path $PSScriptRoot 'security-postflight.sql')
 } finally {Pop-Location}
} finally {
 if($startAttempted -and (Test-Path -LiteralPath $runtime)){Push-Location $runtime; try{Assert-DisposableCliDirectory; & $supabase stop --no-backup 2>$null | Out-Null}finally{Pop-Location}}
 if($networkCreated){& $docker network rm $network 2>$null | Out-Null}
 $resolved=[IO.Path]::GetFullPath($runtime); $tempRoot=[IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
 if(-not $resolved.StartsWith($tempRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notmatch '^gridly-dispatch-phase29-[a-f0-9]{12}$'){throw 'unsafe disposable cleanup path'}
 if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
 foreach($name in 'P29_INVITE_ONLY','P29_REVIEW_ONLY','P29_API_URL','P29_ANON_KEY','P29_SERVICE_KEY','P29_DOCKER','P29_PROJECT_ID','P29_EVIDENCE_DIR'){[Environment]::SetEnvironmentVariable($name,$null,'Process')}
}
