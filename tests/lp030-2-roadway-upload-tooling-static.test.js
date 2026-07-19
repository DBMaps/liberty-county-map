const assert = require('assert');
const fs = require('fs');
const deploy = fs.readFileSync('scripts/Deploy-Lp030RoadwayAssets.ps1', 'utf8');
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
assert(docs.includes('LP030.2'), 'docs describe LP030.2 correction');
console.log('LP030.2 roadway upload tooling static tests passed');
