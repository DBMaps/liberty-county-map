param([Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9][a-z0-9-]{0,57}[a-z0-9]$')][string]$ProjectName)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$evidenceDir = Join-Path $repo 'evidence\lp1835'
$rawDir = Join-Path $evidenceDir 'raw'
New-Item -ItemType Directory -Force $rawDir | Out-Null
Write-Host "OWNER CONFIRMATION: the one empty Direct Upload project will be '$ProjectName'."
if ((Read-Host 'Type the exact project name to confirm') -cne $ProjectName) { throw 'Project name confirmation did not match.' }
function Invoke-SafeWrangler([string[]]$Arguments,[string]$File) {
  $text = (& npx --yes wrangler @Arguments 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) { throw "Wrangler command failed: $($Arguments -join ' ')" }
  if ($text -match '(?i)(CLOUDFLARE_API_TOKEN|authorization\s*:|cookie\s*:|bearer\s+\S+|access[_-]?token|refresh[_-]?token|session[_-]?token|api[_-]?key)') { throw 'Secret-shaped Wrangler output rejected.' }
  [IO.File]::WriteAllText($File,($text -replace "`r`n","`n"),(New-Object Text.UTF8Encoding($false)))
  return $text
}
$who = Invoke-SafeWrangler -Arguments @('whoami') -File (Join-Path $rawDir 'whoami.txt')
$version = Invoke-SafeWrangler -Arguments @('--version') -File (Join-Path $rawDir 'version.txt')
$before = Invoke-SafeWrangler -Arguments @('pages','project','list') -File (Join-Path $rawDir 'projects-before.txt')
if ($before -match "(?m)(^|\s)$([regex]::Escape($ProjectName))(\s|$)") { throw 'A project with the confirmed name already exists; no project was created.' }
Invoke-SafeWrangler -Arguments @('pages','project','create',$ProjectName,'--production-branch','preview') -File (Join-Path $rawDir 'project-create.txt') | Out-Null
$after = Invoke-SafeWrangler -Arguments @('pages','project','list') -File (Join-Path $rawDir 'projects-after.txt')
$deployments = Invoke-SafeWrangler -Arguments @('pages','deployment','list','--project-name',$ProjectName) -File (Join-Path $rawDir 'deployments.txt')
$projectHelp = Invoke-SafeWrangler -Arguments @('pages','project','--help') -File (Join-Path $rawDir 'project-help.txt')
$deleteHelp = Invoke-SafeWrangler -Arguments @('pages','project','delete','--help') -File (Join-Path $rawDir 'project-delete-help.txt')
Write-Host 'In the authenticated dashboard, inspect (do not change) zone gridlygo.com, Pages custom domains, and DNS record removal controls.'
$countBefore = [int](Read-Host 'Exact project count shown in projects-before.txt')
$countAfter = [int](Read-Host 'Exact project count shown in projects-after.txt')
if (($countAfter - $countBefore) -ne 1) { throw 'Project count did not transition by exactly one.' }
$deploymentCount = [int](Read-Host 'Exact deployment count shown in deployments.txt (expected 0)')
if ($deploymentCount -ne 0) { throw 'The new project is not empty; evidence capture stopped.' }
$customDomainCount = [int](Read-Host 'Exact custom-domain count shown in the authenticated Pages dashboard (expected 0)')
if ($customDomainCount -ne 0) { throw 'The new project has a custom domain; evidence capture stopped.' }
$accountName = Read-Host 'Exact account name shown by whoami'
$accountId = Read-Host 'Exact account ID shown by whoami'
$zoneStatus = Read-Host 'Type VERIFIED only if authenticated dashboard proves this account manages gridlygo.com; otherwise OWNER_VERIFICATION_REQUIRED'
$defaultHostname = Read-Host "Default Pages hostname (normally $ProjectName.pages.dev)"
$domainDetach = (Read-Host 'Type PROVEN only if the Pages custom-domain Remove control was observed') -ceq 'PROVEN'
$dnsDelete = (Read-Host 'Type PROVEN only if the gridlygo.com DNS record Delete control was observed') -ceq 'PROVEN'
$projectDelete = $deleteHelp -match '(?i)delete'
$record = [ordered]@{schemaVersion='gridly.lp1835.ownerPagesEvidence.v1';capturedAt=(Get-Date).ToUniversalTime().ToString('o');wranglerVersion=$version.Trim();authenticated=$true;authenticatedCommandStatus='PASS';accountName=$accountName;accountId=$accountId;zoneName='gridlygo.com';zoneOwnershipStatus=$zoneStatus;projectName=$ProjectName;productionBranch='preview';defaultHostname=$defaultHostname;projectCreated=$true;directUpload=$true;gitIntegration=$false;automaticDeployment=$false;previewCustomDomainBound=$false;dnsChanged=$false;accessChanged=$false;artifactUploaded=$false;projectDeleteControlProven=$projectDelete;customDomainDetachControlProven=$domainDetach;dnsDeleteControlProven=$dnsDelete;projectCountBefore=$countBefore;projectCountAfter=$countAfter;deploymentCount=$deploymentCount;customDomainCount=$customDomainCount}
$json = $record | ConvertTo-Json -Depth 5
if ($json -match '(?i)(CLOUDFLARE_API_TOKEN|authorization\s*:|cookie\s*:|bearer\s+\S+|access[_-]?token|refresh[_-]?token|session[_-]?token|api[_-]?key)') { throw 'Secret-shaped evidence rejected.' }
[IO.File]::WriteAllText((Join-Path $evidenceDir 'pages-project-owner-evidence.local.json'),(($json -replace "`r`n","`n")+"`n"),(New-Object Text.UTF8Encoding($false)))
Write-Host 'STOP: do not deploy, bind a domain, change DNS/Access, or delete the project.'
Write-Host 'Run: npm run build:lp1835; npm run test:lp1835; npm run verify:lp1835'
