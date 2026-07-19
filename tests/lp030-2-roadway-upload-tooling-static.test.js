const assert = require('assert');
const fs = require('fs');
const deploy = fs.readFileSync('scripts/Deploy-Lp030RoadwayAssets.ps1', 'utf8');
const harness = fs.readFileSync('scripts/Test-Lp030RoadwayAssetDeployment.ps1', 'utf8');
const docs = fs.readFileSync('docs/GRIDLY-LP030-EXTERNAL-ROADWAY-ASSET-UPLOAD-TOOLING.md', 'utf8');

const expected = ['Austin','Brazoria','Brazos','Calhoun','Chambers','Colorado','Fayette','Fort Bend','Galveston','Grimes','Hardin','Jackson','Jasper','Jefferson','Lavaca','Matagorda','Newton','Orange','Polk','Tyler','Walker','Waller','Washington','Wharton'];
for (const county of expected) assert(deploy.includes(`name = '${county}'`), `missing expected county ${county}`);
assert.match(deploy, /\[switch\]\$Execute/, 'real upload requires -Execute');
assert.match(deploy, /\$Execute\) \{[\s\S]*GRIDLY_ROADWAY_STORAGE_BASE_URL[\s\S]*GRIDLY_ROADWAY_STORAGE_BUCKET[\s\S]*GRIDLY_ROADWAY_STORAGE_TOKEN/, 'execute requires env credentials');
assert.match(deploy, /Get-FileHash[\s\S]*SHA256/, 'uses Get-FileHash SHA256');
assert(!/Get-Content\s+-Raw\s+-LiteralPath\s+\$file\.FullName\s*\|\s*ConvertFrom-Json/.test(deploy), 'deployment path must not parse GeoJSON bodies with ConvertFrom-Json');
assert.match(deploy, /InFile\s*=\s*\$InFile/, 'upload uses streamed InFile where supported');
assert.match(deploy, /Harris roadway package is explicitly rejected/, 'Harris must be explicitly rejected');
assert.match(deploy, /Expected exactly 24 county packages/, 'validates exact 24-county inventory');
assert.match(deploy, /Non-GeoJSON package present/, 'rejects non-GeoJSON packages');
assert.match(deploy, /Storage base URL must use HTTPS except localhost/, 'rejects unsafe URLs');
assert.match(deploy, /Remote object exists and -AllowOverwrite was not supplied/, 'protects remote overwrites');
assert.match(deploy, /roadways\/\$\(\$county\.id\)\/\$Version\/\$\(\$file\.Name\)/, 'uses stable object path');
assert.match(deploy, /Content-Length/, 'verifies remote byte length where available');
assert(!deploy.includes('Write-Host $token') && !deploy.includes('Write-Output $token'), 'does not print token');
for (const field of ['countyId','countyName','localPath','fileName','objectPath','publicUrl','version','sha256','localByteLength','remoteByteLength','uploadAttempted','uploadStatus','httpStatus','verificationStatus','verified','error']) {
  assert(deploy.includes(`${field}=`) || deploy.includes(`${field}:`), `missing result field ${field}`);
}

const paramBlock = deploy.match(/param\([\s\S]*?\n\)/);
assert(paramBlock, 'deployment script must have a param block');
assert(!/\$PSScriptRoot/.test(paramBlock[0]), '$PSScriptRoot must not be used in param default expressions');
assert(!/Split-Path\s+-Parent\s+\$PSScriptRoot/.test(paramBlock[0]), 'repo-relative defaults must not be derived inside param block');
assert.match(deploy, /\$Invocation\.MyCommand\.Path[\s\S]*Resolve-Lp030ScriptPath\s+\$MyInvocation/, 'deployment script resolves script path from MyInvocation after param block');
assert.match(deploy, /Join-Path\s+\$repoRoot\s+'data\/road-segments'/, 'deployment script derives default source directory after resolving repo root');

const ps7OnlyPatterns = [
  { pattern: /\?\?/, name: 'null-coalescing operator' },
  { pattern: /\?\s*[^\r\n:]+\s*:/, name: 'ternary operator' },
  { pattern: /ForEach-Object\s+-Parallel/, name: 'ForEach-Object -Parallel' },
  { pattern: /Get-Date[^\r\n]*-AsUTC/, name: 'Get-Date -AsUTC' }
];
for (const { pattern, name } of ps7OnlyPatterns) {
  assert(!pattern.test(deploy), `deployment script must not use PowerShell 7-only ${name}`);
  assert(!pattern.test(harness), `test harness must not use PowerShell 7-only ${name}`);
}

assert.match(harness, /Start-Process[\s\S]*-PassThru[\s\S]*-RedirectStandardOutput[\s\S]*-RedirectStandardError/, 'test harness must capture native child-process stdout and stderr');
assert.match(harness, /ExitCode\s*-ne\s*0/, 'test harness must verify successful child process exit codes');
assert.match(harness, /ExitCode\s*-eq\s*0/, 'test harness must verify failing child process exit codes');
assert.match(harness, /CombinedOutput/, 'test harness must match failures against combined stdout and stderr');
assert.match(harness, /\$missingCountyNames\.Count\s*-ne\s*23/, 'missing-county fixture must verify it contains exactly 23 counties');
assert.match(harness, /\$missingCountyNames\s+-contains\s+'Austin'/, 'missing-county fixture must verify Austin is omitted');
assert(!/Remove-Item\s+-LiteralPath\s+\(Join-Path\s+\$sourceDir\s+'\*'\)/.test(harness), 'test harness must not attempt wildcard cleanup through -LiteralPath');
assert.match(harness, /finally\s*\{[\s\S]*Remove-Item\s+-LiteralPath\s+\$tempRoot\s+-Recurse\s+-Force/, 'test harness must clean temporary fixtures in finally');

assert(docs.includes('LP030.3'), 'docs describe LP030.3 runtime repair');
console.log('LP030.3 roadway upload tooling static tests passed');
