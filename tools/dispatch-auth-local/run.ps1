# Disposable local safety gate. No production project links or global Docker configuration.
param([Parameter(Mandatory=$true)][string]$Supabase,[Parameter(Mandatory=$true)][string]$Docker,[switch]$GuardOnly)
$ErrorActionPreference='Stop'
$project='gridly-dispatch-auth-'+[guid]::NewGuid().ToString('N').Substring(0,12)
$runtime=Join-Path $env:TEMP $project
$network=$project+'-net'
$priorPath=$env:PATH
$priorTelemetry=$env:SUPABASE_TELEMETRY_DISABLED
$created=$false
$attempted=$false
function Exec-Checked([string]$exe,[string[]]$argv){& $exe @argv; if($LASTEXITCODE -ne 0){throw ('Local command failed: '+[IO.Path]::GetFileName($exe)+' '+$argv[0])}}
function Tcp-Open([string]$address,[int]$port){$socket=[Net.Sockets.TcpClient]::new();try{$task=$socket.ConnectAsync($address,$port);return ($task.Wait(1200) -and $socket.Connected)}catch{return $false}finally{$socket.Dispose()}}
try{
 if(-not $GuardOnly){throw 'Only guard certification is available; operational authentication awaits owner review'}
 if(-not [IO.Path]::IsPathRooted($Docker) -or -not [IO.Path]::IsPathRooted($Supabase)){throw 'Absolute executable paths required'}
 if($env:DOCKER_HOST -or $env:DOCKER_CONTEXT){throw 'Ambient Docker endpoint overrides are unsupported'}
 $endpoint=& $Docker context inspect --format '{{.Endpoints.docker.Host}}';if($LASTEXITCODE -ne 0 -or $endpoint.Trim() -ne 'npipe:////./pipe/dockerDesktopLinuxEngine'){throw 'Certified local Linux Docker endpoint required'}
 New-Item -ItemType Directory -Path $runtime | Out-Null
 Push-Location $runtime
 try{
  $env:SUPABASE_TELEMETRY_DISABLED='true'
  $version=& $Supabase --version;if($LASTEXITCODE -ne 0 -or $version.Trim() -ne '2.119.0'){throw 'Certified Supabase CLI v2.119.0 required'}
  Exec-Checked $Supabase @('start','--help') | Out-Null
  Exec-Checked $Supabase @('init') | Out-Null
  $configPath=Join-Path $runtime 'supabase\config.toml'
  $config=[IO.File]::ReadAllText($configPath)
  $config=[regex]::Replace($config,'(?m)^project_id = .*$',('project_id = "'+$project+'"'))
  $config=[regex]::new('(?ms)(\[realtime\].*?enabled\s*=\s*)true').Replace($config,'$1false',1)
  $config=[regex]::new('(?ms)(\[storage\].*?enabled\s*=\s*)true').Replace($config,'$1false',1)
  $config=[regex]::Replace($config,'(?m)^jwt_expiry = .*$', 'jwt_expiry = 900')
  $config=[regex]::Replace($config,'(?m)^enable_signup = true$', 'enable_signup = false')
  $config=[regex]::new('(?ms)(\[auth\.mfa\.totp\].*?enroll_enabled\s*=\s*)false').Replace($config,'$1true',1)
  $config=[regex]::new('(?ms)(\[auth\.mfa\.totp\].*?verify_enabled\s*=\s*)false').Replace($config,'$1true',1)
  [IO.File]::WriteAllText($configPath,$config,[Text.UTF8Encoding]::new($false))
  if(Test-Path -LiteralPath 'supabase\.temp\project-ref'){throw 'Linked project forbidden'}
  New-Item -ItemType Directory -Path shim | Out-Null
  $source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'docker-guard.cs')).Replace('@@DOCKER@@',$Docker.Replace('"','""')).Replace('@@PROJECT@@',$project).Replace('@@NETWORK@@',$network).Replace('@@LOG@@',(Join-Path $runtime 'bindings.log'))
  [IO.File]::WriteAllText((Join-Path $runtime 'shim\guard.cs'),$source)
  Exec-Checked 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' @('/nologo','/r:System.Web.Extensions.dll',('/out:'+(Join-Path $runtime 'shim\docker.exe')),(Join-Path $runtime 'shim\guard.cs'))
  $shim=Join-Path $runtime 'shim\docker.exe'
  $env:PATH=(Join-Path $runtime 'shim')+';'+$priorPath
  Exec-Checked $Docker @('network','create','--driver','bridge','--opt','com.docker.network.bridge.host_binding_ipv4=127.0.0.1',$network) | Out-Null
  $created=$true
  $denied=0
  foreach($mapping in '0.0.0.0:54324:8025','[::]:54324:8025','54325:8025','54324:1025','54324:8025/udp'){
   & $shim create --name ('supabase_inbucket_'+$project) --network $network -p $mapping public.ecr.aws/supabase/mailpit:v1.31.3 2>$null
   if($LASTEXITCODE -ne 125){throw 'Adversarial mapping accepted'};$denied++
  }
  foreach($flag in '--publish-all','--publish=54324:8025','--network=host','--privileged'){
   & $shim create --name ('supabase_inbucket_'+$project) --network $network $flag public.ecr.aws/supabase/mailpit:v1.31.3 2>$null
   if($LASTEXITCODE -ne 125){throw 'Unexpected Docker flag accepted'};$denied++
  }
  # Unsafe negative control is CREATED but NEVER STARTED; no listener is exposed.
  Exec-Checked $Docker @('create','--name',('supabase_inbucket_'+$project),'--network',$network,'-p','54324:8025','public.ecr.aws/supabase/mailpit:v1.31.3') | Out-Null
  & $shim start ('supabase_inbucket_'+$project) 2>$null;if($LASTEXITCODE -ne 125){throw 'Unsafe pre-start binding accepted'};$denied++
  $running=& $Docker inspect ('supabase_inbucket_'+$project) --format '{{.State.Running}}';if($running.Trim() -ne 'false'){throw 'Negative control ran'}
  Exec-Checked $Docker @('rm',('supabase_inbucket_'+$project)) | Out-Null
  $attempted=$true
  & $Supabase start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --network-id $network *> (Join-Path $runtime 'startup.log')
  if($LASTEXITCODE -ne 0){Get-Content -LiteralPath (Join-Path $runtime 'startup.log') | Where-Object {$_ -match 'LOCAL_BINDING_GUARD|Error|failed|Failed|unsupported'} | Write-Output;throw 'Guarded startup failed'}
  $inventory=@();$bindings=0
  foreach($service in 'db','kong','inbucket','auth','rest'){
   $name='supabase_'+$service+'_'+$project
   $ports=(& $Docker inspect $name --format '{{json .NetworkSettings.Ports}}') | ConvertFrom-Json
   if($LASTEXITCODE -ne 0){throw 'Resolved inspection failed'}
   foreach($property in $ports.PSObject.Properties){foreach($binding in $property.Value){if($binding.HostIp -ne '127.0.0.1'){throw 'Non-loopback resolved publication'};$bindings++;$inventory+=($name+' '+$binding.HostIp+':'+$binding.HostPort+' -> '+$property.Name)}}
   $networks=(& $Docker inspect $name --format '{{json .NetworkSettings.Networks}}') | ConvertFrom-Json
   if(@($networks.PSObject.Properties).Count -ne 1 -or -not $networks.$network){throw 'Network isolation drift'}
  }
  if($bindings -ne 3 -or @(Get-Content -LiteralPath (Join-Path $runtime 'bindings.log')).Count -ne 3){throw 'CLI bypass or inventory drift'}
  $addresses=@(Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred | Where-Object {$_.IPAddress -notmatch '^(127\.|169\.254\.)'} | Select-Object -ExpandProperty IPAddress -Unique)
  if($addresses.Count -eq 0){throw 'No host non-loopback probe available'}
  $probes=0
  foreach($port in 54321,54322,54324){if(-not (Tcp-Open '127.0.0.1' $port)){throw 'Local service unreachable'};foreach($address in $addresses){if(Tcp-Open $address $port){throw 'Non-loopback service reachable'};$probes++}}
  Write-Output ('GUARD PASS: '+$denied+' adversarial refusals; 3 resolved localhost bindings; 3 localhost TCP passes; '+$probes+' non-loopback rejections')
  $inventory | Write-Output
 }finally{Pop-Location}
}finally{
 if($attempted -and (Test-Path -LiteralPath $runtime)){Push-Location $runtime;try{& $Supabase stop --no-backup | Out-Null}finally{Pop-Location}}
 $env:PATH=$priorPath
 $env:SUPABASE_TELEMETRY_DISABLED=$priorTelemetry
 $containers=@(& $Docker ps -a --format '{{.Names}}' | Where-Object {$_ -match ('^supabase_[a-z0-9_]+_'+[regex]::Escape($project)+'$')})
 foreach($name in $containers){Exec-Checked $Docker @('rm','-f',$name) | Out-Null}
 $volumes=@(& $Docker volume ls --format '{{.Name}}' | Where-Object {$_ -match ('^supabase_[a-z0-9_]+_'+[regex]::Escape($project)+'$')})
 foreach($name in $volumes){Exec-Checked $Docker @('volume','rm',$name) | Out-Null}
 if($created){Exec-Checked $Docker @('network','rm',$network) | Out-Null}
 $leftContainers=@(& $Docker ps -a --format '{{.Names}}' | Where-Object {$_ -like ('*'+$project+'*')})
 $leftVolumes=@(& $Docker volume ls --format '{{.Name}}' | Where-Object {$_ -like ('*'+$project+'*')})
 $leftNetworks=@(& $Docker network ls --format '{{.Name}}' | Where-Object {$_ -eq $network})
 if($leftContainers.Count+$leftVolumes.Count+$leftNetworks.Count -ne 0){throw 'Disposable cleanup incomplete'}
 $resolved=[IO.Path]::GetFullPath($runtime);$tempRoot=[IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
 if(-not $resolved.StartsWith($tempRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notmatch '^gridly-dispatch-auth-[a-f0-9]{12}$'){throw 'Unsafe cleanup path'}
 if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
 Write-Output 'CLEANUP PASS: 0 owned containers, volumes, networks; temporary runtime and credentials removed'
}
