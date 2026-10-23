"""Compile and exercise the EXACT production Swift recovery gate on macOS.

No UIKit/WebKit mocks or duplicated state-machine implementation. Windows can
inspect the fixture, but certification requires a Swift-capable runner.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile

source = Path("ios/App/App/GridlyBridgeViewController.swift").read_text(encoding="utf-8")
gate = source.split("// BEGIN TESTABLE RECOVERY GATE\n", 1)[1].split("// END TESTABLE RECOVERY GATE", 1)[0]
# Exercise the exact native Bundle binding against real Foundation bundle
# metadata, so a marketing-version bump cannot silently disable recovery.
binding = source.split("    private var recoveryBuild: Bool {", 1)[1].split("\n    }", 1)[0]
binding = 'struct RecoveryBundleFixture { let fixtureBundle: Bundle\nvar recoveryBuild: Bool {' + binding.replace("Bundle.main", "fixtureBundle") + '\n}\n}\n'
checks = r'''
var cases = 0
func check(_ name: String, _ body: () -> Void) {
    body(); cases += 1; print("PASS " + name)
}
check("reviewed Builds14/16 and emergency17 share the recovery contract") {
    for build in ["14", "16", "17"] {
        assert(GridlyLegacyRecoveryCompatibility.supports(bundleIdentifier: "com.gridlygo.gridly", buildNumber: build))
    }
}
check("unsupported, missing, malformed versions and foreign apps fail closed") {
    let unsupported: [String?] = [nil, "", "12", "13", "15", "18", "140", "016", "16.0", "16\n"]
    for build in unsupported {
        assert(!GridlyLegacyRecoveryCompatibility.supports(bundleIdentifier: "com.gridlygo.gridly", buildNumber: build))
    }
    let foreign: [String?] = [nil, "", "com.example.gridly"]
    for bundle in foreign {
        assert(!GridlyLegacyRecoveryCompatibility.supports(bundleIdentifier: bundle, buildNumber: "16"))
    }
}
check("published and maintenance marketing metadata use the exact native build binding") {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try! FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try! FileManager.default.removeItem(at: directory) }
    for (index, metadata) in [("1.0.0", "14", true), ("1.0.0", "16", true), ("1.0.1", "16", true), ("1.0.1", "15", false), ("1.0.1", "17", true)].enumerated() {
        let path = directory.appendingPathComponent("Fixture\(index).bundle")
        try! FileManager.default.createDirectory(at: path, withIntermediateDirectories: true)
        let info = ["CFBundleIdentifier": "com.gridlygo.gridly", "CFBundleShortVersionString": metadata.0, "CFBundleVersion": metadata.1]
        let data = try! PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0)
        try! data.write(to: path.appendingPathComponent("Info.plist"))
        let fixture = RecoveryBundleFixture(fixtureBundle: Bundle(path: path.path)!)
        assert(fixture.recoveryBuild == metadata.2)
    }
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
    fixture.write_text('import Foundation\n' + gate + binding + checks)
    subprocess.run([swift, str(fixture)], check=True)
