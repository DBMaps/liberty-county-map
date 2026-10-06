"""Compile and exercise the EXACT production Swift recovery gate on macOS.

No UIKit/WebKit mocks or duplicated state-machine implementation. Windows can
inspect the fixture, but certification requires a Swift-capable runner.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile

source = Path("ios/App/App/GridlyBridgeViewController.swift").read_text()
gate = source.split("// BEGIN TESTABLE RECOVERY GATE\n", 1)[1].split("// END TESTABLE RECOVERY GATE", 1)[0]
checks = r'''
var cases = 0
func check(_ name: String, _ body: () -> Void) {
    body(); cases += 1; print("PASS " + name)
}
check("inactive first appearance does not consume trigger; didBecomeActive recovers") {
    var g = GridlyLegacyRecoveryGate()
    assert(!g.begin(ready: false)); assert(g.attempts == 0)
    assert(g.begin(ready: true)); assert(!g.finish(prompt: true))
    assert(g.prompted); assert(!g.begin(ready: true))
}
check("Capacitor bridge -> load -> appearance -> load completion -> paid admission") {
    var g = GridlyLegacyRecoveryGate()
    assert(!g.begin(ready: false)) // bridge/loadView, no established origin
    assert(!g.begin(ready: false)) // inactive viewDidAppear
    assert(g.begin(ready: true)); assert(!g.finish()) // loaded but paid runtime not_ready
    assert(g.begin(ready: true)); assert(!g.finish(prompt: true)) // admitted runtime event
    assert(g.prompted && g.attempts == 2)
}
check("key becomes visible after didFinish; empty initial preview is not terminal") {
    var g = GridlyLegacyRecoveryGate()
    assert(g.begin(ready: true)); assert(!g.finish()) // empty/unavailable
    assert(g.begin(ready: true)); assert(!g.finish(prompt: true))
    assert(g.prompted)
}
check("ready event during evaluation is coalesced, not lost") {
    var g = GridlyLegacyRecoveryGate()
    assert(g.begin(ready: true)); assert(!g.begin(ready: true))
    assert(g.finish()); assert(g.begin(ready: true)); assert(!g.finish(prompt: true))
}
check("navigation/reload cannot duplicate a prompt") {
    var g = GridlyLegacyRecoveryGate()
    assert(g.begin(ready: true)); _ = g.finish(prompt: true)
    for _ in 0..<20 { assert(!g.begin(ready: true)) }
    assert(g.attempts == 1)
}
check("application/scene resume cannot duplicate prompt after Keep or Forget") {
    for _ in ["Keep", "Forget"] {
        var g = GridlyLegacyRecoveryGate()
        assert(g.begin(ready: true)); _ = g.finish(prompt: true)
        assert(!g.begin(ready: true)); assert(!g.begin(ready: true))
    }
}
check("blocked active presentation leaves readiness opportunity intact") {
    var g = GridlyLegacyRecoveryGate()
    assert(!g.begin(ready: false)); assert(g.begin(ready: true))
    _ = g.finish(); assert(g.begin(ready: true)); _ = g.finish(prompt: true)
}
check("active report/review/retry does not mark a prompt or authorize deletion") {
    var g = GridlyLegacyRecoveryGate()
    assert(g.begin(ready: true)); _ = g.finish() // script busy
    assert(!g.prompted && !g.complete && !g.inFlight)
}
check("fresh state with no key never marks a prompt") {
    var g = GridlyLegacyRecoveryGate()
    assert(g.begin(ready: true)); _ = g.finish() // script empty
    assert(!g.prompted)
}
check("ineligible legacy identity is terminal and preserves record") {
    var g = GridlyLegacyRecoveryGate()
    assert(g.begin(ready: true)); _ = g.finish(terminal: true)
    assert(g.complete && !g.prompted); assert(!g.begin(ready: true))
}
check("evaluation is bounded without time-based polling") {
    var g = GridlyLegacyRecoveryGate()
    for _ in 0..<12 { assert(g.begin(ready: true)); _ = g.finish() }
    assert(!g.begin(ready: true) && g.attempts == 12)
}
print("Production Swift lifecycle gate: \(cases) cases PASS")
'''
swift = shutil.which("swift")
if not swift:
    raise SystemExit("Swift is required for this certification (run on macOS)")
with tempfile.TemporaryDirectory(prefix="gridly-recovery-lifecycle-") as temporary:
    fixture = Path(temporary) / "RecoveryLifecycle.swift"
    fixture.write_text(gate + checks)
    subprocess.run([swift, str(fixture)], check=True)
