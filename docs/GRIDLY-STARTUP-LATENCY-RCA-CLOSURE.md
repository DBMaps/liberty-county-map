# Gridly startup latency RCA closure

## 1. RCA status

**Closed.** The valid same-context mobile control has eliminated supported
Gridly runtime ownership for the intermittent long pre-fetch delay. This
closure is evidentiary only: it makes no production startup repair, changes no
script ordering, and does not alter LP201, crossings, DriveTexas, destination
search, Weather/NWS, or service-worker behavior.

The threshold for reopening the application RCA is new, deterministic evidence
that attributes the wait to Gridly production code. An exact external owner has
not been proven.

## 2. Valid mobile control evidence

The corrected control opened the actual mobile consumer experience in the same
browser context. The captured environment was:

| Signal | Observed value |
| --- | ---: |
| Viewport width | 430 |
| Viewport height | 932 |
| Device pixel ratio | 3 |
| Mobile media query | `true` |
| Layout type | `mobile` |
| Mobile consumer surface detected | `true` |

The resulting Gridly surface rendered the mobile map, mobile controls,
**Location Context**, and bottom navigation. This run is therefore valid mobile
lifecycle evidence rather than a desktop or cross-context control.

## 3. Control-page delay evidence

The development-only control page reported a normal `navigate` navigation with
the following navigation timing:

| Milestone | Time |
| --- | ---: |
| Navigation start | 0.0 ms |
| Fetch start | 8261.7 ms |
| Request start | 8261.7 ms |
| Response start | 8277.6 ms |
| Response end | 8286.9 ms |
| DOMContentLoaded | 8420.5 ms |
| Load | 8427.4 ms |
| Worker start | 8260.6 ms |

The pre-fetch delay was **8.262 seconds**. The control classification is
**environment delay**: navigation waited before the page could be fetched.
This page contains no Gridly runtime, `app.js`, Leaflet, Supabase, or production
application startup graph. A multi-second delay on that page cannot be caused
by those absent components.

## 4. Gridly mobile navigation evidence

Selecting **OPEN GRIDLY** preserved the valid mobile emulated context. Gridly's
current pre-fetch delay was approximately **33.9 ms**. As expected following a
control-page navigation, there was no previous Gridly lifecycle record to
compare.

This is the inverse of application ownership: the tiny non-Gridly control
waited for seconds, while the full mobile Gridly document began fetching in
tens of milliseconds.

## 5. Gridly mobile reload evidence

Selecting **RELOAD GRIDLY** again rendered the valid mobile consumer experience
and again produced an approximately **33.9 ms** pre-fetch delay. The previous
Gridly lifecycle record was present. Its events were tightly grouped around
normal document navigation and destruction; it exposed no multi-second Gridly
teardown handler. The previously observed 17–38 second wait did not reproduce
on this valid mobile reload.

## 6. Outgoing lifecycle conclusion

Outgoing Gridly lifecycle ownership is not supported. Static audit found no
production `beforeunload` or `unload` teardown, history-capture lifecycle flush,
Supabase teardown, WebSocket close path, large lifecycle storage persistence,
or synchronous lifecycle network operation. The same-context mobile reload
provides runtime corroboration: outgoing lifecycle activity completed normally
before a roughly 33.9 ms pre-fetch interval.

## 7. Parser conclusion

Early Gridly parser work is not the dominant intermittent delay. Prior valid
instrumentation measured:

| Interval or work | Duration |
| --- | ---: |
| Response end to first resource | 147.1 ms |
| Theme initialization | 1.0 ms |
| Hostname gate | 0.1 ms |
| Prepaint scheduler | 0.2 ms |

The suspected parser delay did not reproduce, and a delay before `fetchStart`
precedes delivery and parsing of the Gridly document.

## 8. Service-worker correlation note

The delayed tiny-page capture reported a service-worker registration and an
active controller, with `workerStart` at **8260.6 ms**, near the delayed fetch
boundary. Earlier captures reported no controller and `workerStart` of zero.

This is a preserved **correlation and external-environment clue, not a causal
classification**. Any future investigation of service-worker/browser
navigation lifecycle must be separate from this application RCA. This closure
does not unregister or modify the production service worker.

## 9. Final root-cause classification

The closure classifications are:

* `INTERMITTENT_BROWSER_OR_DEVELOPMENT_ENVIRONMENT_PRE_FETCH_DELAY`
* `GRIDLY_APPLICATION_OWNERSHIP_NOT_SUPPORTED`
* `PRODUCTION_STARTUP_REPAIR_NOT_JUSTIFIED`

Cross-run evidence establishes intermittency. Previous Gridly captures showed
approximately 17.4-second and 37.6-second pre-fetch delays, while earlier
control-page captures showed approximately 6 ms and 25 ms. The valid mobile
comparison reversed that relationship: approximately 8.262 seconds on the
control page and approximately 33.9 ms on both Gridly navigation and Gridly
reload.

Possible external owners include browser navigation scheduling,
DevTools/device-emulation behavior, service-worker/browser lifecycle, browser
profile/security/extension behavior, or host scheduling. None is declared the
proven exact owner.

## 10. Why no production repair is justified

The delay is not bound to `app.js`, the Gridly parser, mobile shell, outgoing
lifecycle, LP201, crossings, DriveTexas, destination search, or the application
startup graph. It can occur before fetch on a tiny page containing none of
those systems, and it did not recur on either valid mobile Gridly navigation.
Changing production startup code would therefore treat an unowned,
non-deterministic symptom and would add regression risk without causal
evidence.

Production code must remain unchanged unless new deterministic evidence shows
application ownership.

## 11. Diagnostic keep/remove recommendation

**KEEP temporarily.** The development-only control and read-only lifecycle
evidence are now proven useful for same-context owner troubleshooting, and they
preserve a low-cost way to distinguish pre-fetch environment delay from Gridly
execution. They must remain development-host gated, unlinked from production
navigation, read-only, and behaviorally isolated from production startup.

Review removal at the next production-release cleanup gate, when the value of
retaining owner troubleshooting can be weighed against diagnostic maintenance
surface. Do not remove the diagnostics as part of this closure.

## 12. Product-work resumption

**Product work may resume.** Return first to Baytown awareness convergence and
the late lightweight active-awareness writer, then to Baytown destination-search
Walmart locality acceptance. This closure does not begin LP215 and grants no
automatic merge authority.
