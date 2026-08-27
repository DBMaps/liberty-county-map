# LP241 Owner Browser Acceptance

Record deployment URL/ID, git SHA, date/time, browser/version, viewport, selected identity/county, network condition, actual result, screenshot/video reference, console helper output, and PASS/FAIL for every row. Use existing helpers where available. Never paste secrets or private addresses.

## Finite release-candidate run

| # | Journey / state | Steps and expected response | Dependencies | Proof |
|---:|---|---|---|---|
| 1 | First-time + location allowed/denied | Clear site data; run both permission choices; truthful selected area, no silent wrong-location fallback | geolocation, storage | browser + phone |
| 2 | Returning + Home Area | Reload and reopen; saved public test area returns without leaking precise location | storage, resolver | browser |
| 3 | Tarkington non-PLACE | Select governed identity; identity remains governed across Weather, Alerts, KBYG and Location Context | NWS, identity | screenshot |
| 4 | Multi-county | Select one canonical multi-county identity from each side; county transitions do not fork identity | resolver | screenshot |
| 5 | Quiet area / El Paso | Confirm explicit family states; no blank known-family row and no empty-array inference of QUIET | providers | screenshot |
| 6 | Weather active/multiple | Confirm official event labels, timing, detail in Alerts, concise KBYG, Show me | NWS | screenshot |
| 7 | Weather failure/stale/transition | Use existing failure controls/devtools; must be UNAVAILABLE/stale truthfully, never false quiet; late response cannot overwrite new area | NWS | log + screenshot |
| 8 | Official Roadways active | Repeated road groups; singleton is direct; action belongs to condition; identity is unique across surfaces | DriveTexas | screenshot |
| 9 | Roadway stale/cleared/failure | Refresh and forced failure; cleared incident disappears, provider failure is not quiet | DriveTexas | log + screenshot |
| 10 | Crossings positive/empty | Urban and rural, popup, filter, multi-county, Show me; active-empty is truthful | crossing packages | screenshot |
| 11 | Community Report lifecycle | Public test location: submit, refresh, rehydrate, area switch, confirm, clear; no duplicate/stale card | Supabase/RLS | log + screenshot |
| 12 | Report failure/abuse | Force rejected request; no success acknowledgement; verify bounds/rate/duplicate/malicious-input controls | Supabase | redacted log |
| 13 | Destination/address | Execute every fixture in the 254-county plan; record every result field; no centroid/road promoted to exact | approved search provider | exported ledger |
| 14 | Route preview/handoff | Exact, approximate, no-result and provider-failure cases; only eligible selected result creates marker/handoff | search, routing | screenshot |
| 15 | Box Canyon | In Val Verde select broader context, publish/use governed test incident as authorized, wait/refresh, inspect Alerts/KBYG/Location Context and camera | owner test data | required screenshots |
| 16 | Slow/offline/recovery | Throttle, offline, reload shell, restore online; no fake success or invalid cache masking | service worker | log + video |
| 17 | Performance accumulation | Capture first usable interaction; repeat area switch/sheets/search/route/report refresh 10×; compare listeners/intervals/memory | devtools | trace summary |
| 18 | Production operations | Record provider health/quota, monitoring visibility, release ID, rollback rehearsal, backup status, incident owner, abort thresholds | owner systems | signed record |

## Box Canyon acceptance contract

Historical evidence says generated incidents are governed Location Context/Community Pulse evidence and may represent a Family M propagation failure when current/eligible but absent. Owner must state the intended family propagation and camera movement **before** judging the run. A static identity match or success elsewhere is insufficient.

## Exit rule

All six launch gates in `LP241-LAUNCH-GO-NO-GO.md` need dated PASS evidence. Any wrong county/identity, false exact address, false quiet, fake report success, silent wrong-location fallback, or inaccessible core action is FAIL requiring bounded repair and rerun.
