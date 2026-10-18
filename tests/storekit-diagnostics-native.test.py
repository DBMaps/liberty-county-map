"""Exercise exact native diagnostic policy/step/validation helpers with Swift.
No StoreKit or network calls. No copied implementation. Swift is required.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile

source = Path("ios/App/App/GridlyStoreKitPlugin.swift").read_text()
policy = source.split("// BEGIN TESTABLE STORE DIAGNOSTICS\n", 1)[1].split("// END TESTABLE STORE DIAGNOSTICS", 1)[0]
helpers = source.split("    @MainActor func step<T>", 1)[1].split("    func resultError", 1)[0]
helpers = "    @MainActor func step<T>" + helpers
fixture = r'''
@MainActor final class Harness {
    var events: [[String: Any]] = []
    enum BridgeFailure: Error { case unavailable }
    func diagnostic(_ attempt: Int, _ action: String, _ stage: String, _ outcome: String, _ failure: Error? = nil) {
        if let value = GridlyStoreDiagnosticPolicy.payload(enabled: true, attempt: attempt, action: action, stage: stage, outcome: outcome, failure: failure) { events.append(value) }
    }
HELPERS
    func exercise() async throws {
        let privateError = NSError(domain: "SKErrorDomain", code: 2, userInfo: [NSLocalizedDescriptionKey: "NEVER_EMIT"])
        for (stage, action) in [("product_fetch", "purchase"), ("purchase_call", "purchase"), ("restore_sync", "restore")] {
            events = []
            do { let _: Int = try await step(1, action, stage) { throw privateError }; assertionFailure() }
            catch { assert((error as NSError).code == 2) }
            assert(events.count == 2 && events[0]["outcome"] as? String == "started")
            assert(events[1]["stage"] as? String == stage && events[1]["outcome"] as? String == "failed")
            assert(events[1]["errorCode"] as? Int == 2)
        }
        for label in ["count_rejected", "id_rejected", "type_rejected", "period_rejected", "offers_rejected", "storefront_rejected"] {
            events = []
            do { try validate(false, label, 1, "purchase"); assertionFailure() } catch {}
            assert(events.count == 1 && events[0]["outcome"] as? String == label)
            try validate(true, label, 1, "purchase")
            assert(events.count == 1)
        }
        let value = try await step(1, "purchase", "product_fetch") { 42 }
        assert(value == 42 && events.last?["outcome"] as? String == "returned")
        let safe = GridlyStoreDiagnosticPolicy.payload(enabled: true, attempt: 1, action: "purchase", stage: "purchase_call", outcome: "failed", failure: privateError)!
        assert(Set(safe.keys) == Set(["attempt", "action", "stage", "outcome", "errorCode"]))
        assert(!String(describing: safe).contains("NEVER_EMIT"))
        assert(GridlyStoreDiagnosticPolicy.numericCode(NSError(domain: "NEVER_EMIT", code: 2)) == nil)
        assert(GridlyStoreDiagnosticPolicy.numericCode(NSError(domain: "SKErrorDomain", code: 1000000)) == nil)
        assert(GridlyStoreDiagnosticPolicy.payload(enabled: false, attempt: 1, action: "purchase", stage: "purchase_call", outcome: "failed") == nil)
        assert(GridlyStoreDiagnosticPolicy.payload(enabled: true, attempt: 1, action: "NEVER_EMIT", stage: "purchase_call", outcome: "failed") == nil)
        assert(GridlyStoreDiagnosticPolicy.payload(enabled: true, attempt: 1, action: "purchase", stage: "NEVER_EMIT", outcome: "failed") == nil)
        assert(GridlyStoreDiagnosticPolicy.payload(enabled: true, attempt: 0, action: "purchase", stage: "purchase_call", outcome: "failed") == nil)
        print("Native diagnostic helpers: fetch/purchase/sync failures, validation, pass-through and sanitization PASS")
    }
}
try await Harness().exercise()
'''.replace("HELPERS", helpers)
swift = shutil.which("swift")
if not swift:
    raise SystemExit("Swift is required for native diagnostic certification (run on macOS)")
with tempfile.TemporaryDirectory(prefix="gridly-storekit-diagnostics-") as temporary:
    path = Path(temporary) / "StoreDiagnostics.swift"
    path.write_text("import Foundation\n" + policy + fixture)
    subprocess.run([swift, str(path)], check=True)
