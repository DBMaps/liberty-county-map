$ErrorActionPreference='Stop'
. "$PSScriptRoot\..\tools\retention\LP24458-VERIFY-EDGE-OWNER.ps1" -ContractOnly
$fixture='[{"subsystem":"compliance_cleanup","job_state":"active","latest_run_state":"succeeded","latest_run_at":"2026-09-26T17:09:00.059196+00:00","last_success_at":"2026-09-26T17:09:00.066125+00:00","retention_state":"none","compliance_health_state":"succeeded","report_overdue_count":0,"report_breached_count":0,"compliance_late_processed_count":0,"compliance_late_processed_at":null},{"subsystem":"report_retention","job_state":"active","latest_run_state":"succeeded","latest_run_at":"2026-09-26T17:09:00.059981+00:00","last_success_at":"2026-09-26T17:09:00.066693+00:00","retention_state":"succeeded","compliance_health_state":"none","report_overdue_count":0,"report_breached_count":0,"compliance_late_processed_count":0,"compliance_late_processed_at":null}]'
$passed=0
function Check($name,$json,$expected='PASS',$type='application/json',$cache='no-store') {
 $actual='PASS'
 try { Assert-GridlyHealthResponse -Status 200 -ContentType $type -CacheControl $cache -Json $json } catch { $actual=$_.Exception.Message }
 if($actual -ne $expected){throw "Fixture $name expected $expected got $actual"}
 $script:passed++;Write-Output "$name PASS ($actual)"
}
Check 'healthy UTC/null/Int64 two rows' $fixture
Check 'Z UTC' ($fixture.Replace('+00:00','Z'))
$nested=@($fixture|ConvertFrom-Json)
if($nested.Count -ne 1 -or $nested[0] -isnot [Array]) { throw 'PS5.1 RCA not reproduced' }
Write-Output 'RCA PASS: PS5.1 old pipeline wrapper row_count=1, nested Object[]'
$rows=ConvertFrom-Json -InputObject $fixture
Check 'missing row' ('['+($rows[0]|ConvertTo-Json -Compress)+']') 'row_count'
Check 'extra row' (ConvertTo-Json -InputObject @($rows[0],$rows[1],$rows[1]) -Compress) 'row_count'
Check 'top-level object' ($rows[0]|ConvertTo-Json -Compress) 'json_top_level'
Check 'malformed JSON' '[' 'json_parse'
Check 'missing field' ($fixture.Replace('"job_state":"active",','')) 'fields'
Check 'private extra field' ($fixture.Replace('"job_state":"active"','"job_state":"active","report_id":"private"')) 'fields'
Check 'malformed timestamp' ($fixture.Replace('2026-09-26T17:09:00.059196+00:00','arbitrary')) 'timestamp_format'
Check 'non-UTC timestamp' ($fixture.Replace('+00:00','+01:00')) 'timestamp_format'
Check 'Postgres SQL display not HTTP contract' ($fixture.Replace('2026-09-26T17:09:00.059196+00:00','2026-09-26 17:09:00.059196+00')) 'timestamp_format'
Check 'invalid calendar' ($fixture.Replace('2026-09-26','2026-02-30')) 'timestamp_parse'
Check 'bad enum' ($fixture.Replace('"active"','"private"')) 'enum'
Check 'out of range' ($fixture.Replace('"report_overdue_count":0','"report_overdue_count":1000001')) 'count_range'
Check 'string count' ($fixture.Replace('"report_overdue_count":0','"report_overdue_count":"0"')) 'count_type'
Check 'JSON media charset' $fixture 'PASS' 'application/json; charset=utf-8'
Check 'wrong media type' $fixture 'content_type' 'text/html'
Check 'wrong cache' $fixture 'cache_control' 'application/json' 'public'
Write-Output "PowerShell $($PSVersionTable.PSVersion) fixtures passed=$passed"
