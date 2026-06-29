# V787 County Promotion Toolkit Certification

## Certification summary

V787 adds the first reusable developer-toolkit capability for controlled county promotion readiness. The milestone is audit/preflight only. No county is promoted, no county is enabled, and no production, community, crossing, or application runtime package is modified.

## Files added or modified

Added:

- `tools/CountyPromotion/Test-GridlyCountyPromotionReadiness.ps1`
- `docs/Standards/GRIDLY-COUNTY-PROMOTION-TOOLKIT.md`
- `docs/certifications/V787-COUNTY-PROMOTION-TOOLKIT.md`
- `docs/certifications/evidence/V787-county-promotion-toolkit.json`

Modified:

- `tools/Gridly.ps1`

## Readiness script behavior

`Test-GridlyCountyPromotionReadiness.ps1` accepts `-County <name>` and optional `-Json`. It inspects existing repository state for package presence, production manifest presence, application assets, registry references, disabled search/awareness/consumer state, certification evidence, and known remaining gaps.

The script is read-only. It does not copy files, update manifests, register a county, enable a county, or alter application behavior.

## Command center integration

`tools/Gridly.ps1` now lists `County Promotion Readiness` as a command-center option. The command prompts for a county name and invokes the readiness script. It does not perform promotion.

## Protected-system verification

V787 leaves the following systems unchanged:

- Shared Reports
- Route Watch
- Awareness Filtering
- Hazard Lifecycle
- Alert Generation
- Supabase Synchronization
- Production Crossing Runtime
- Community Package Pipeline
- Developer Toolkit existing commands, except for adding the new command-center menu option

## Testing results

PowerShell was unavailable in the execution environment, so the PowerShell commands could not be executed locally. JSON evidence was validated with Python.

Planned commands:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Test-GridlyCountyPromotionReadiness.ps1 -County Chambers
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Test-GridlyCountyPromotionReadiness.ps1 -County Chambers -Json
powershell -ExecutionPolicy Bypass -File .\tools\Validation\Test-GridlyToolkit.ps1
powershell -ExecutionPolicy Bypass -File .\tools\Runtime\Invoke-GridlyProductionReadiness.ps1
```

Executed validation:

```bash
python3 -m json.tool docs/certifications/evidence/V787-county-promotion-toolkit.json
```
