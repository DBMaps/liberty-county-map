# LP194 — San Antonio guarded runtime activation

**Status:** `SAN_ANTONIO_CONSUMER_REGIONS_RUNTIME_ACTIVE_WITH_SELECTIVE_FAR_SOUTHWEST_LIMITATION`

**Recommendation:** `READY_FOR_OWNER_SAN_ANTONIO_RUNTIME_SMOKE_TEST`

## Guarded activation

The runtime reuses the existing awareness-area registry, selector/search projection, and semantic camera (`lat`, `lng`, and `startupZoom`) contract. Independent governed PLACE/CDP and exact community resolution retain precedence over the San Antonio consumer-region projection; ZIP search creates no direct ZIP-to-region mapping.

Activation writes are restricted to:

- `data/runtime/san-antonio-consumer-regions.geojson`
- `data/runtime/san-antonio-consumer-regions.json`
- `js/app.js`

The geometry is a byte-for-byte copy of `evidence/lp193/san-antonio-consumer-region-design-geometry.geojson`: 3,577,612 bytes, SHA-256 `c8aa67df96e0ac21a9c339eb3eebf67d528522786ab662d8f330eb883dcedfae`, nine features. Runtime unions are never recomputed.

## Owner consumer smoke-test matrix

| Search/select | Expected result | Camera check |
|---|---|---|
| Central San Antonio | Central San Antonio | governed center, zoom 11.16 |
| Medical Region | Medical Region | governed center, zoom 11.36 |
| Airport / Fort Sam | Airport / Fort Sam | governed center, zoom 11.03 |
| Stone Oak / Far North | Stone Oak / Far North | governed center, zoom 11.22 |
| UTSA / Northwest | UTSA / Northwest | governed center, zoom 10.69 |
| Far West / Alamo Ranch | Far West / Alamo Ranch | governed center, zoom 11.66 |
| Northeast San Antonio | Northeast San Antonio | governed center, zoom 10.67 |
| Southside / Brooks | Southside / Brooks | governed center, zoom 10.77 |
| Southwest / Port San Antonio | Southwest / Port San Antonio; never Far Southwest | governed center, zoom 11.27 |
| Alamo Heights | Alamo Heights PLACE | never a San Antonio region |
| Helotes | Helotes PLACE | never a San Antonio region |
| Leon Valley | Leon Valley PLACE | never a San Antonio region |
| Windcrest | Windcrest PLACE | never a San Antonio region |
| Somerset | Somerset PLACE with selective hold | never a San Antonio region |
| Von Ormy | Von Ormy PLACE with selective hold | never a San Antonio region |

No ZIP row is prescribed: LP193 created no ZIP mapping. Validate ZIPs only through an existing governed ZIP/community result; an independent PLACE result must win.

## Browser validation (PowerShell)

```powershell
Set-Location C:\GitHub\liberty-county-map
python -m http.server 5500
Start-Process http://127.0.0.1:5500/index.html
```

Confirm all nine labels are selectable/resolvable and use their governed cameras. Then confirm the six independent PLACE cases above, Southwest's Far Southwest exclusion, one existing Houston child region, and one statewide county. Do not deploy and do not merge until this smoke test passes.
