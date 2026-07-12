# Gridly L001 Beta Closure and Launch Transition

## Status

Gridly Beta Cohort 1 is complete, and the public GitHub Pages entry now presents the beta-closure experience.

## Purpose

This document records the launch-transition change that closes the public beta without deleting application source, history, assets, package data, or backend records.

## Public URL

https://dbmaps.github.io/liberty-county-map/

## Beta Cohort 1 Closure Statement

The first Gridly beta has officially concluded. Thank you to everyone who tested, reported issues, and shared feedback.

## Launch Transition Statement

Gridly is now in Launch Preparation. The public URL communicates that the beta is complete and that future announcements will follow.

## User-visible Change

Visitors now see a polished dark Gridly beta-closure page instead of the map application. The page includes the Gridly brand, "Know Before You Go," "Beta Complete," "Thank You," a launch-preparation statement, Facebook announcement text, and "Coming Soon."

## Files Changed

- `index.html`
- `manifest.json`
- `service-worker.js`
- `docs/launch/GRIDLY-L001-BETA-CLOSURE-AND-LAUNCH-TRANSITION.md`
- `docs/audits/GRIDLY-L001-BETA-CLOSURE-AUDIT.md`

## Application Startup Statement

The public `index.html` no longer loads `js/app.js`, Leaflet, Supabase, county packages, crossing packages, report hydration, awareness runtime, map runtime, or application startup scripts.

## Service-worker/cache Closure Strategy

The service worker now uses the closure cache `gridly-beta-closure-v1`. It precaches only the closure page, manifest, selected icons, and the Gridly logo. During activation it deletes recognized old Gridly application shell caches matching `gridly-pwa-shell-*` and older closure caches matching `gridly-beta-closure-*` except the current closure cache.

Navigation requests use a network-first `no-store` fetch with a fallback to the cached closure `index.html`. This prevents the old cached app shell from being the public navigation fallback while keeping the closure page available if the network request fails after the closure worker is installed.

The closure page also includes a bounded cleanup routine that deletes recognized old Gridly caches and registers the closure service worker without forcing reloads.

## Data Preservation Statement

No Supabase schema, table, storage, or record deletion was performed. No user-generated backend reports or hazard records were deleted.

## Protected-system Statement

Reporting logic, alert generation, hazard lifecycle, awareness filtering, Route Watch, search logic, weather logic, community intelligence, crossing runtime, and directional intelligence were not modified.

## Desktop Gate Statement

The public URL no longer exposes the desktop application experience. The closure page is readable on desktop, but it does not initialize or reveal Gridly desktop app controls.

## Landscape Gate Statement

The public URL no longer exposes the landscape application experience. The closure page remains readable in landscape, but it does not initialize or reveal Gridly landscape app controls.

## Human Validation Checklist

- Open the GitHub Pages URL in a private/incognito mobile browser.
- Confirm the beta-closure page appears.
- Confirm the Gridly map does not load.
- Confirm report, Alerts, Search, Settings, and Route Watch are inaccessible.
- Open the URL in a browser that previously used Gridly.
- Confirm the old cached application is replaced by the closure page.
- Open a previously installed Gridly home-screen PWA while online.
- Confirm it resolves to the closure experience.
- Refresh twice and confirm no reload loop occurs.
- Confirm no beta download or installation link remains.
- Confirm desktop does not expose the Gridly application.
- Confirm landscape does not expose the Gridly application.
- Confirm existing Supabase data was not deleted.
- Run `window.gridlyBetaClosureAudit?.()` in the browser console.

## Rollback Procedure

Revert this commit or restore the previous `index.html`, `manifest.json`, and `service-worker.js` from Git history, then redeploy GitHub Pages. If rollback is required after the closure service worker activates, verify browser navigation and installed PWA behavior in an already-used browser because service-worker update timing can vary by browser.

## Git Tag Recommendation

After merge, create a tag to preserve the completed beta milestone in Git history:

```bash
git tag gridly-beta-cohort-1-final
git push origin gridly-beta-cohort-1-final
```

If using GitHub Desktop, create the tag after the merge is complete and push it to the remote repository.

## Merge Recommendation

Merge this branch after static checks and human validation confirm that the public URL presents only the closure experience and does not initialize the beta app.

## Follow-up Items

- Begin Version & Build Management as a launch follow-up; do not expand it in L001.
- Confirm or create an official Gridly Facebook page URL before linking to it publicly.
- Complete launch preparation planning in a separate branch or milestone.
