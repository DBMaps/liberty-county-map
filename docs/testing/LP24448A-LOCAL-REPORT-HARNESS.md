# LP244.48A local report acceptance harness

## Audit before implementation

- `gridlyClearLocalTestReports`, `gridlyClearTestData`, and `gridlyTestDataCleanupAudit` already exist in `js/app.js`. The first two clear the entire active in-memory report inventory; `gridlyClearTestData` can also invoke Supabase cleanup. Neither is safe for clearing only the proposed fixtures. `gridlyClearSupabaseTestHazards`, `gridlyDevPurgeRecentRoadHazards`, and `gridlyDevPurgeRecentCrossingReports` target backend rows and must not be used.
- LP241.2A already proves an in-memory report fixture can enter `activeHazards` and the real `refreshReportHazardViews` consumer chain without a write. It is a fixed acceptance scenario, not an owner-friendly fixture store.
- `loadSharedReports` reads Supabase, calls `normalizeReports`, applies county and lifecycle filters, assigns `activeHazards`/`activeReports`, then calls the shared presentation refresh. `normalizeReports` is the earliest reusable report-shaped seam for browser-only input. `renderUnifiedIncidents`, crossing rendering, Alerts, awareness, and KBYG consume these active collections. The popup builders are `buildUnifiedIncidentPopup` and `buildPopup`. The unified confirm/clear dispatcher is `handleUnifiedIncidentAction`.
- `normalizeReports` also captures road-location diagnostic samples. Prefixed fixture IDs bypass only that diagnostic capture; the normalizer and consumer projection still run unchanged.
- Historical projection has a separate public source getter and a manual generator. Both now use the same fixture-excluding source list, so an owner-triggered projection while fixtures are active cannot export their identities into historical analytics.
- `gridlySubmitCommunityMutation`, `createSharedReport`, `createSharedHazardReport`, and `clearHazard` are production mutation paths. Synthetic identities must be intercepted at the unified popup dispatcher before reaching these functions. A private in-memory fixture store can be reapplied after a live read replaces active collections, while remaining outside the backend `rawRows`, history capture, accepted-local registries, and Route Watch source collection.
- The shared report refresh also reapplies fixtures for the currently active county. This preserves an active fixture through Search/Return Home county transitions even when Supabase reads are unavailable. The reapply function returns immediately when there are no fixtures or fixture records.
- There is no safe existing cleanup helper for this narrow scope. The harness must remove only its own prefixed identities from the active collections and its own memory store, then use `refreshReportHazardViews`.
- Production exclusion requires an exact HTTP loopback-host gate and a negative native/Capacitor gate. Every exposed command must recheck the gate. No browser storage will be used, so refresh removes fixtures.
- The governed startup-script manifest must remain unchanged. The helper is appended to `js/app.js`; adding a separate `index.html` script breaks the native startup inventory test.

## Owner usage and policy

Run `node tools/lp24448a/verify-browser.mjs --serve` from the repository root and open the printed `http://127.0.0.1` URL. Press Ctrl+C when done. The helper is available in that browser's console only on `http://localhost` or `http://127.0.0.1` in a non-native browser. It keeps reports in page memory only. Refresh removes them. No report operation uses device location or changes Home. When coordinates are omitted, `add` uses the current map center. Use `presets()` for supported conditions and `status()` for gate and count details.

```js
gridlyLocalTestReports.presets()
gridlyLocalTestReports.add('flooded-roadway')
gridlyLocalTestReports.add('road-blocked', { lat: 30.0466, lng: -94.8852, ageMinutes: 5 })
gridlyLocalTestReports.addAtMapCenter('debris-in-road')
gridlyLocalTestReports.list()
gridlyLocalTestReports.clear()
```

For crossing presets, pass a governed `crossingId` or coordinates for the nearest currently loaded governed crossing. `confirm(id)` and `clearOne(id)` operate only on IDs returned by `add` or `list`. The popup's Confirm/Mark Cleared actions use the same local lifecycle for fixture incidents. `clear()` removes all fixtures and leaves live reports alone. The helper rejects placement where the active county cannot be safely determined.

## Certification and later visual review

The browser verifier is `node tools/lp24448a/verify-browser.mjs`. It records evidence in `reports/lp24448a-browser.json` and portrait screenshots under `.artifacts/lp24448a/`. It covers isolated and multiple hazards, real marker mapping and popup builders, popup confirm/clear interception, a governed crossing's blocked/delay/neutral assets, Search and Around Me contexts, Return Home, Route Watch geometry/source preservation, clear-all, page refresh, and 320/360/390/440 px portrait widths. It records every non-GET request by phase and asserts zero during fixture work. Startup and reload may separately issue the existing read-only `get_community_reporting_status` RPC; the verifier blocks external calls.

The live consumer pipeline currently renders a second marker layer for some raw/grouped community hazards, and one duplicate can show `undefinedm` below the approved asset. This predates the harness and is left for the later visual audit. The browser screenshots also lack base-map tiles in the isolated verifier, so they establish marker and interface layout, not final map cartography.

Useful final-audit scenarios: one flooded roadway near Dayton; flooded roadway, debris, and downed power line in a tight cluster; two confirmations of one condition; a governed neutral crossing followed by a blocked crossing and a reported delay; a searched Crosby destination with a nearby active issue; Around Me with a nearby active issue; a full clear returning to the quiet state. Revisit marker duplication, freshness captions, neutral crossing scale, Current Location prominence, and Saved Places density there without changing those designs in this harness task.
