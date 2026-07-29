# LP103.1 Secure Verified Rural Address Enrollment

This administrator-only workflow enrolls an owner-approved address without putting its private
values in Git, shell command text, browser diagnostics, tests, or documentation. Obtain the property
or entrance coordinate locally through an approved method. Never paste an address, coordinate,
service-role credential, or fingerprint into GitHub, Codex, browser DevTools, this chat, a ticket, or
a shared recording.

## Exact registry contract

Migration `202607290100_lp103_verified_rural_address_registry.sql` creates
`public.gridly_verified_rural_addresses`: UUID `id`; unique 64-character lowercase-hex
`lookup_hash`; `normalized_address`, `house_number`, `canonical_road_identity`, `locality`,
`county_id`, TX-only `state`, `postal_code`; Texas-bounded `latitude` and `longitude`;
`coordinate_source`; `verification_method`; `verification_date`; `verification_status`;
`source_authority`; JSON-array `aliases`; `precision`; `consumer_eligible`; and timestamps.
Verification methods are `county_911_address_record`, `county_appraisal_situs_record`,
`owner_confirmed_gps`, `field_verified_entrance`, or `authoritative_address_point_dataset`.
Statuses are `pending`, `verified`, or `revoked`; precisions are `verified_address_point` or
`verified_entrance`. New rows default to `consumer_eligible=false`. RLS is enabled and table access
is granted only to `service_role`.

The lookup input is canonical `house|road|state|ZIP5`. The script uses the Edge Function's house,
geography, and County Road/FM/SH/US alias rules, then calculates SHA-256 over the JSON-encoded lookup
string exactly as production does. Enrollment upserts a `pending`, ineligible row. Approval is a
separate command that PATCHes only status, eligibility, and `updated_at`, preserving verification
metadata. All three utilities request only what they need and print redacted state only. Verification
is a third, read-only action; it is deliberately not a mode of either enrollment or approval.

## Migration and deployment

Run from the repository root. Linking stores project configuration, not private residence data:

```powershell
npx supabase link --project-ref nhwhkbkludzkuyxmkkcj
npx supabase db push --linked
```

After enrollment and approval, rotate the non-private cache namespace and deploy the Edge Function:

```powershell
npx supabase secrets set GRIDLY_GEOCODE_CACHE_NAMESPACE=lp103-private-registry-v2 --project-ref nhwhkbkludzkuyxmkkcj
npx supabase functions deploy gridly-geocode --project-ref nhwhkbkludzkuyxmkkcj
```

Choose a new namespace value for any later rotation; it must not contain address-derived material.

## PowerShell 5.1 enrollment block

This block keeps inputs out of PowerShell command text and clears process environment variables in
`finally`. `Read-Host -AsSecureString` hides every private value and credential. It does not persist
them to `.env.lp103.local`.

```powershell
function Read-Lp103Secret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
$names = @('LP103_SUPABASE_URL','LP103_SUPABASE_SERVICE_ROLE_KEY','LP103_HOUSE_NUMBER','LP103_ROAD',
  'LP103_LOCALITY','LP103_COUNTY_ID','LP103_STATE','LP103_POSTAL_CODE','LP103_LATITUDE','LP103_LONGITUDE',
  'LP103_COORDINATE_SOURCE','LP103_VERIFICATION_METHOD','LP103_VERIFICATION_DATE','LP103_SOURCE_AUTHORITY',
  'LP103_ALIASES_JSON','LP103_PRECISION')
try {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, (Read-Lp103Secret $name), 'Process') }
  node scripts/lp103-enroll-verified-rural-address.mjs
  if ($LASTEXITCODE -ne 0) { throw 'LP103 enrollment failed.' }
} finally {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
  Remove-Item Function:\Read-Lp103Secret -ErrorAction SilentlyContinue
}
```

`LP103_ALIASES_JSON` must be a JSON array (use `[]` if none). Dates use `YYYY-MM-DD`. Coordinates
must be decimal numbers within the migration's Texas bounds. The source authority must truthfully
identify the local authorization/authority; do not elevate owner GPS to a government-source claim.

## Independent PowerShell 5.1 approval block

Run only after independently reviewing identity, coordinate, authority, permission, precision, and
county containment. The confirmation must exactly match the phrase prompted below.

```powershell
function Read-Lp103Secret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
$names = @('LP103_SUPABASE_URL','LP103_SUPABASE_SERVICE_ROLE_KEY','LP103_HOUSE_NUMBER','LP103_ROAD',
  'LP103_STATE','LP103_POSTAL_CODE')
try {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, (Read-Lp103Secret $name), 'Process') }
  $env:LP103_APPROVAL_CONFIRMATION = Read-Host 'Type APPROVE VERIFIED RURAL ADDRESS to approve'
  node scripts/lp103-approve-verified-rural-address.mjs
  if ($LASTEXITCODE -ne 0) { throw 'LP103 approval failed.' }
} finally {
  foreach ($name in ($names + 'LP103_APPROVAL_CONFIRMATION')) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
  Remove-Item Function:\Read-Lp103Secret -ErrorAction SilentlyContinue
}
```

## Independent PowerShell 5.1 redacted verification block

Run this separately after approval. It independently reconstructs the lookup fingerprint locally,
selects only the five fields needed to form the allowed redacted result, and clears its process
environment even when verification fails.

```powershell
function Read-Lp103Secret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
$names = @('LP103_SUPABASE_URL','LP103_SUPABASE_SERVICE_ROLE_KEY','LP103_HOUSE_NUMBER','LP103_ROAD',
  'LP103_STATE','LP103_POSTAL_CODE')
try {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, (Read-Lp103Secret $name), 'Process') }
  node scripts/lp103-verify-verified-rural-address.mjs
  if ($LASTEXITCODE -ne 0) { throw 'LP103 redacted verification failed.' }
} finally {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
  Remove-Item Function:\Read-Lp103Secret -ErrorAction SilentlyContinue
}
```

Successful verification prints only `recordFound`, `verificationStatus`, `consumerEligible`,
`coordinatePresent`, `sourceAuthorityPresent`, and `privateValuesRedacted`. It never returns the row.

## Browser asset and visible certification

1. Before deployment, run `npm run test:lp103`, `npm run test:lp1031`, and
   `rg -n "gridly-geocoding-client|app.js" index.html`; confirm the browser loads both governed
   geocoding assets. Deploy the normal web bundle using the project's existing release process,
   then confirm production serves both assets with `curl -fsSI https://gridly.app/js/app.js` and
   `curl -fsSI https://gridly.app/js/gridly-geocoding-client.js` (both must report HTTP 200).
2. Hard-refresh production and use the Network panel only to confirm the loaded `app.js` and
   `gridly-geocoding-client.js` responses are the newly deployed assets. Do not inspect, copy, or
   preserve a private request payload.
3. Enter the private address only into Gridly consumer Search. Confirm one correct card, no incorrect
   Census number/unrelated roadway, and a Route Preview marker at the locally approved property or
   entrance point. Do not capture the private card or map in screenshots or recordings.
4. Confirm the browser contacts only Gridly's `gridly-geocode` endpoint, not Nominatim, Census, a
   county viewer, or a commercial geocoder.
5. The LP103 diagnostics are designed to be redacted. Run
   `window.gridlyLp103VisibleRuralAddressCertification?.()` only
   if doing so cannot expose console history under the applicable operational policy; require an
   empty `failedChecks` list and `safeToMerge: true`. Do not paste its output into public content.

Synthetic tests certify implementation invariants only. They do not prove that an owner address is
enrolled, that its coordinate is correct, or that production is certified.
