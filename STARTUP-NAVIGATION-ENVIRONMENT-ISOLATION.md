# Startup navigation environment isolation

## Scope and conclusion

This control did not change the production startup path. The supplied 37.6-second
`navigationStart` to `fetchStart` interval occurs before the document request and
therefore before repository JavaScript can execute. Neither the independent
server measurements nor repository inspection supports a Gridly application or
local file-serving defect. Exact Edge DevTools device-toolbar behavior remains
the leading untested environment because no browser executable is installed in
the execution environment.

## Independent HTTP server control

The checked-in repository root was served with
`python3 -m http.server 8765 --bind 127.0.0.1`. Each path was requested ten times
sequentially with curl. Values are milliseconds. "Request" is curl's
`time_pretransfer`, TTFB is `time_starttransfer`, and transfer is total minus
TTFB.

| Path | Bytes | Cold connect/request/TTFB/transfer/total | Warm mean connect/request/TTFB/transfer/total | Warm total range |
| --- | ---: | --- | --- | --- |
| `/` | 95,318 | 0.295 / 0.333 / 3.631 / 2.709 / 6.340 | 0.450 / 0.568 / 2.872 / 0.437 / 3.309 | 2.510–6.287 |
| `/index.html` | 95,318 | 0.328 / 0.406 / 2.572 / 1.067 / 3.639 | 0.714 / 0.780 / 3.194 / 0.707 / 3.901 | 2.598–4.806 |
| `/css/styles.css` | 846,889 | 0.979 / 1.029 / 3.180 / 0.503 / 3.683 | 0.409 / 0.518 / 2.976 / 1.430 / 4.407 | 3.177–5.884 |
| `/js/app.js` | 8,016,278 | 0.241 / 0.276 / 3.665 / 6.781 / 10.446 | 0.491 / 0.582 / 2.835 / 6.987 / 9.823 | 7.728–11.563 |
| `/js/gridlyStartupDiagnostics.js` | 47,339 | 0.263 / 0.317 / 2.564 / 0.559 / 3.123 | 0.323 / 0.407 / 2.893 / 0.681 / 3.574 | 2.711–4.179 |
| `/js/gridlyPackageRegistry.js` | 230,002 | 0.372 / 0.426 / 2.687 / 0.768 / 3.455 | 0.835 / 0.892 / 4.398 / 0.951 / 5.349 | 3.034–12.786 |
| `/js/gridlyUnifiedIntelligence.js` | 4,931 | 0.325 / 0.366 / 4.299 / 0.153 / 4.452 | 0.422 / 0.511 / 3.224 / 0.143 / 3.367 | 2.589–6.555 |

No request approached one second, much less 17–38 seconds. The nominal "cold"
request was not consistently slower than warm requests.

## Development server control

No VS Code Live Server settings, workspace settings, Vite, webpack dev-server,
BrowserSync, `live-server`, or `http-server` configuration or installed package
was found. Consequently there is no checked-in implementation, port, live-reload
injection, watcher, proxy, or service-worker override to reproduce. The repository
does declare Playwright as a development dependency, but not a development HTTP
server. The independent server performs plain static file delivery without live
reload, proxying, or service-worker changes.

## Browser automation capability and limitation

Executable searches through `PATH`, `/usr`, `/opt`, the home directory, and the
Playwright cache found no Microsoft Edge, Chromium, Google Chrome, Chrome Headless
Shell, Playwright browser, or Puppeteer-compatible browser. Playwright 1.54.2 is
installed as a Node package, but its browser cache is empty. No large browser
binary was downloaded.

Therefore automated fresh navigation, reload, second reload, fresh-context,
desktop viewport, mobile viewport, and iPhone-like emulation measurements could
not be run. The 17–38-second pre-fetch delay was not reproduced by the available
HTTP controls, but browser non-reproduction cannot be claimed. In particular,
viewport configuration in Playwright would not be equivalent proof for Edge
DevTools device-toolbar emulation even if a Playwright browser were present.

## Static startup and service-worker control

`index.html` is 95,318 bytes (approximately 93 KiB). Its first local stylesheet
reference is at line 216, after three small inline startup blocks. Those blocks
perform theme selection, a hostname check, and prepaint scheduling; inspection
shows no synchronous network request, loop, timer wait, or other multi-second
operation. The first external script is the startup diagnostics at line 1428.
No document code can execute before the browser fetches the document.

The normal application registers `service-worker.js` later from `js/app.js`.
The owner evidence says a registration exists, the affected navigation has no
controller, and `workerStart` is zero. Because no browser was available, that
lifecycle could not be independently observed and no registration was removed.
The control page does not register or unregister a worker; it only displays
whether a matching registration and controller are already present.

## Owner control

The development-only `startup-navigation-control.html` contains no production
Gridly runtime, Supabase, Leaflet, external resource, or service-worker
registration, and it is not linked from production navigation. It reports the
navigation type, fetch/request/response milestones, DOM/load milestones,
pre-fetch delay, and read-only service-worker state directly on the page.

One simple control remains: open
`http://localhost:<current-server-port>/startup-navigation-control.html`, press
refresh once, and copy the displayed output. A 20–40-second pre-fetch delay on
this tiny page isolates the wait outside Gridly application runtime and strongly
implicates the Edge navigation/DevTools/device-emulation environment or its host.

## Recommended next action

Do not repair Gridly startup. Use the one-page owner control once in the already
affected Edge environment, without changing browser modes. If it reports the
same delay, investigate Edge reload lifecycle, DevTools/device-toolbar state,
extensions/security inspection, and host scheduling. Only investigate the local
server further if the control page shows a low fetch delay while `index.html`
still shows a high one under otherwise identical conditions.
