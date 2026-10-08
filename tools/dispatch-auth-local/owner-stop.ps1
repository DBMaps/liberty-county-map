param([Parameter(Mandatory=$true)][string]$SessionPath)
$ErrorActionPreference='Stop'
$resolved=[IO.Path]::GetFullPath($SessionPath);$taskTempRoot=[IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
if(-not $resolved.StartsWith($taskTempRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notmatch '^gridly-dispatch-auth-[a-f0-9]{12}$'){throw 'Owned session path required'}
if((Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse session path denied'}
$ready=Get-Content -LiteralPath (Join-Path $resolved 'ready.json') -Raw | ConvertFrom-Json
if($ready.project -ne [IO.Path]::GetFileName($resolved) -or $ready.url -ne 'http://127.0.0.1:4180/'){throw 'Session identity mismatch'}
[IO.File]::WriteAllText((Join-Path $resolved 'stop.request'),'')
Write-Output 'Stop requested. Wait for CLEANUP PASS in the launcher console.'
