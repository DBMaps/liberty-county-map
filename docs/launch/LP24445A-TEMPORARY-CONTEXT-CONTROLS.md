# LP244.45A — Temporary context visibility and Return Home

Status: READY FOR OWNER RETEST. Automated checks do not constitute physical/local owner acceptance.

Baseline: 0305bd35fb43e62e21190af2a89b82eb14341be9 on LP244.45-unified-awareness-context-foundation.

## RCA and reproduction

The existing visible Location Context surface is #mobileDestinationCommandPanel in awareness mode. The older #gridlyPortraitLocationAwarenessPanel deliberately stays hidden to avoid a duplicate panel.

In js/app.js, getGridlyMobileCommandCardVisibilityState treated any selected destination as route/destination ownership, even after Search closed. Its pendingDestinationConfirmation remained true without a route preview. syncMobileDestinationCommandCard then explicitly suppressed the entire shared card whenever pendingDestinationConfirmation was true. Crosby awareness correctly survived, but its only normal-map Search entry disappeared. The older panel could not compensate because its intentional ownership contract keeps it hidden.

The baseline browser runner reproduces the owner's sequence through actual controls: Cleveland Home, Location Context Search, Crosby result selection, X. It records SEARCH/Crosby with the shared card invisible and pendingDestinationConfirmation true. Evidence: reports/lp24445a-baseline-browser.json and the baseline screenshot. The previous LP244.45 harness checked data context after close but failed to assert visibility of the actual shared command card; its hidden legacy-panel/identity observations did not prove usable return controls.

## Bounded repair

A temporary Search with no open destination surface, active preview or active Route Watch now uses the existing card's awareness mode and bypasses pending-confirmation suppression. Closing the search shell synchronizes that card after hiding the sheet. Its existing kicker reads active temporary identity directly, so it says LOCATION CONTEXT • CROSBY independently of persisted Home. Search stays the existing entry point. No second panel is enabled or created.

One hidden-by-default Return Home button is added beside Search in the existing action container. It invokes clearGridlyPendingDestination, which already delegates to the LP244.45 temporary-context clear operation, then resynchronizes the card and focuses Search. No new context owner, persistence, provider request path or route implementation is introduced. The button disappears on Home. An explicit scoped [hidden] style is necessary because the existing compact-button cascade otherwise renders hidden buttons; temporary actions use 96px width and existing 44px height to fit Return Home at narrow widths.

Existing route preview, open Search and active Route Watch ownership remains intact. This repair does not activate Around Me or change route behavior. Home remains Cleveland throughout temporary selections, including Crosby → close → Search → Dayton.

## Verification

- 4 focused control-ownership tests pass.
- All 16 LP244.45 foundation tests pass, including delayed Crosby NWS versus Dayton and delayed POI publication.
- Relevant existing Search, route publication, location metric/KBYG and landscape suites: 50 pass, one existing CSS expectation failure. Overall 70/71 tests pass. The unchanged failing expectation rejects tokens already present at the baseline; reports/lp24445a-historical-failure.json records identical offending matches before/after. No new test regression detected.
- Actual browser controls reproduce Search selection, X, Search reentry, Dayton replacement and Return Home without reload. Assertions cover visible identity, both actions, Home restoration, weather, Nearby, community, DriveTexas, Location Context, KBYG, crossing qualification and map center. Four Home storage values remain byte-identical.
- Portrait captures at 390, 360 and 320px wide, 844px high, verify one shared card, no horizontal card overflow, and a card bottom above bottom navigation. Return Home uses the existing button style and hides again on Home. No layout redesign.
- Browser harness uses headless Edge with local assets, deterministic NWS responses and blocked other remote requests. Existing seeded saved destinations avoid the already documented empty-profile startup issue. This is not live provider, native hardware or owner physical acceptance.

Reproduce: node --test tests/lp24445a-temporary-context-controls.test.cjs; node tools/lp24445a/verify-browser.mjs. The --baseline variant serves the original app/HTML/CSS at the baseline commit and asserts the owner's missing-card defect.

## Files and noninterference

Runtime changes: js/app.js, index.html and 12 scoped lines in css/styles.css. Added focused tests, isolated browser harness, this RCA and LP244.45A-only evidence/screenshots. Prior phase evidence is not regenerated.

No notifications, hazard taxonomy, winter hazards, Around Me activation, Android/iOS native, Supabase, backend, reporting activation, moderation, retention, privacy, public-site, Dispatch or production changes. No push, merge, build or deployment.

Disposition: one follow-up local commit named Repair temporary awareness context controls. Owner must repeat the physical/local portrait flow; final acceptance remains pending that retest.
