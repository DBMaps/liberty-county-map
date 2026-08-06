#requires -version 5.1
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Repository,[Parameter(Mandatory=$true)][string]$ProjectRef,[string]$OutputPath="evidence/lp170/owner-evidence.json")
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' -or $ProjectRef -notmatch '^[a-z0-9]{10,40}$') { throw 'Identifiers are invalid; no evidence was written.' }
function Resolve-Tool([string]$Name) {
  if (Get-Command $Name -ErrorAction SilentlyContinue) { return @($Name) }
  if ($Name -eq 'supabase' -and (Get-Command npx -ErrorAction SilentlyContinue)) { return @('npx','--yes','supabase') }
  return $null
}
function Invoke-Safe([string[]]$Command,[string[]]$Arguments) {
  if (-not $Command) { return $false }
  $exe=$Command[0]; $prefix=@(); if($Command.Count -gt 1){$prefix=$Command[1..($Command.Count-1)]}
  $text=& $exe @prefix @Arguments 2>$null | Out-String
  if ($text -match '(?i)(bearer\s+|authorization\s*:|password\s*[:=]|api[_-]?key\s*[:=]|service[_-]?role\s*[:=]|postgres(?:ql)?://|sb_(?:secret|service)_)') { throw 'Secret-shaped command output detected; no evidence was written.' }
  return ($LASTEXITCODE -eq 0)
}
$records=New-Object System.Collections.ArrayList
function Add-Record([string]$Id,[string]$Class,[string]$Source,[string]$Method) { [void]$records.Add([ordered]@{identifier=$Id;classification=$Class;sourceSystem=$Source;method=$Method;readOnly=$true;metadataOnly=$true;attestation='OWNER_CAPTURE_REQUIRED_FOR_COMPLETE_REQUIREMENT'}) }
$gh=Resolve-Tool 'gh'; $supabase=Resolve-Tool 'supabase'
$ghOk=Invoke-Safe $gh @('workflow','list','--repo',$Repository,'--json','name,path,state')
$sbOk=Invoke-Safe $supabase @('functions','list','--project-ref',$ProjectRef,'--output','json')
Add-Record 'HEALTH:GITHUB_DEPLOYMENTS' $(if($ghOk){'PARTIAL_EVIDENCE'}else{'SOURCE_UNAVAILABLE'}) 'GITHUB_CLI' 'READ_ONLY_WORKFLOW_METADATA'
Add-Record 'HEALTH:EDGE_FUNCTIONS' $(if($sbOk){'PARTIAL_EVIDENCE'}else{'SOURCE_UNAVAILABLE'}) 'SUPABASE_CLI' 'READ_ONLY_FUNCTION_METADATA'
$document=[ordered]@{schemaVersion=1;records=@($records | Sort-Object identifier)}
$json=($document | ConvertTo-Json -Depth 8) -replace "`r`n","`n"
$full=[IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath)); $dir=[IO.Path]::GetDirectoryName($full); [IO.Directory]::CreateDirectory($dir)|Out-Null
$tmp="$full.tmp"; [IO.File]::WriteAllText($tmp,$json+"`n",(New-Object Text.UTF8Encoding($false))); Move-Item -Force $tmp $full
Write-Host 'LP170 sanitized metadata evidence captured atomically. Review and add explicit owner attestations before ingestion.'
