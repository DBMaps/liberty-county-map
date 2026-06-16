# Active Hazard Inventory — 2026-06-16

## Scope

This audit is read-only and does not change production behavior. It targets active Supabase road-hazard source rows in `public.reports`, matching the app helper criteria used by `gridlySupabaseHazardInventoryAudit`: `expires_at > now()` and `report_type` in Gridly's shared road-hazard report types.

## Execution result from this environment

Live Supabase inventory could not be completed from the current container on 2026-06-16 because outbound access to the Supabase project failed before a PostgREST read could return data.

Commands attempted:

```bash
node scripts/active-hazard-inventory.mjs
```

Result:

```json
{
  "ok": false,
  "error": "fetch failed",
  "generatedAt": "2026-06-16T14:48:03.535Z"
}
```

Additional connectivity check:

```bash
curl -I --max-time 10 https://nhwhkbkludzkuyxmkkcj.supabase.co/rest/v1/
```

Result: the request was blocked by the environment before the API query could be completed.

## Inventory fields to capture when Supabase is reachable

Run `node scripts/active-hazard-inventory.mjs` from a network environment that can reach Supabase, or run `await window.gridlySupabaseHazardInventoryAudit({ limit: 1000 })` in the app console. The Node script returns:

- total active hazards
- active hazards by type
- active hazards by road name / primary road
- active hazards containing both US 90 and Waco Street
- active hazards created today, using UTC day boundaries for 2026-06-16
- active hazards older than today
- hazards likely created during testing
- recommended cleanup candidates
- cleanup helper recommendation

## Cleanup recommendation

Do not purge until the live inventory output has been reviewed. For Patch 1 / Patch 2 road-location test cleanup, prefer the narrower dev helper first:

```js
await window.gridlyDevPurgeRecentRoadHazards({
  dryRun: true,
  hours: 24,
  radiusMiles: 0,
  sourceFilter: ["user"],
  deviceIdFilter: [],
  limit: 100
});
```

If the dry run contains only the approved Patch 1 / Patch 2 test rows, the exact confirmed cleanup command is:

```js
await window.gridlyDevPurgeRecentRoadHazards({
  dryRun: false,
  confirm: true,
  hours: 24,
  radiusMiles: 0,
  sourceFilter: ["user"],
  deviceIdFilter: [],
  limit: 100
});
```

Use `gridlyClearSupabaseTestHazards` only if the reviewed goal is to delete all active non-TxDOT shared road-hazard reports, because it has a broader scope than recent Patch 1 / Patch 2 rows.
