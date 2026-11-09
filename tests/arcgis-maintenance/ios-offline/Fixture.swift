import UIKit
import WebKit

private let candidate = "SYNTHETIC_GRIDLY_IOS_FIXTURE_20261109"
private let resultName = "gridly-fixture-result"
private let success = "IOS_SYNTHETIC_PASS"

private struct CheckFailed: Error {
    let code: String
}

private func expect(_ condition: @autoclosure () -> Bool, _ code: String) throws {
    if !condition() { throw CheckFailed(code: code) }
}

private final class TileSource: @unchecked Sendable {
    private let lock = NSLock()
    private var calls = 0
    private let png: Data
    private let release: DispatchSemaphore?

    init(_ png: Data, release: DispatchSemaphore? = nil) {
        self.png = png
        self.release = release
    }

    var count: Int {
        lock.lock()
        defer { lock.unlock() }
        return calls
    }

    func tile() -> Data {
        lock.lock()
        calls += 1
        lock.unlock()
        if let release, release.wait(timeout: .now() + 8) != .success { return Data() }
        return png
    }
}

@main
final class FixtureDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = UIViewController()
        window.makeKeyAndVisible()
        self.window = window
        Task { @MainActor in await run() }
        return true
    }

    private func makeAdapter(run: String) throws -> GridlyLabelDiagnostic {
        try GridlyLabelDiagnostic(run: run, mode: GridlyLabelDiagnostic.mode, candidate: candidate)
    }

    private func newRun() throws -> String {
        let run = "owner-" + UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
        try GridlyLabelDiagnostic.provision(run: run, mode: GridlyLabelDiagnostic.mode)
        return run
    }

    @MainActor
    private func prepare(_ adapter: GridlyLabelDiagnostic) async throws -> WKWebView {
        let prepared: (WKWebView?, String) = await withCheckedContinuation { continuation in
            adapter.prepareFixture { view, status in continuation.resume(returning: (view, status)) }
        }
        guard let view = prepared.0, prepared.1 == "INSTALLED_UNARMED", let parent = window?.rootViewController?.view else {
            throw CheckFailed(code: "FIXTURE_PREPARATION")
        }
        parent.subviews.forEach { $0.removeFromSuperview() }
        view.frame = parent.bounds
        parent.addSubview(view)
        for _ in 0..<100 {
            if !view.isLoading && view.url?.absoluteString == "capacitor://localhost/" { return view }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        throw CheckFailed(code: "FIXTURE_NAVIGATION")
    }

    @MainActor
    private func arm(_ adapter: GridlyLabelDiagnostic) async -> String {
        await withCheckedContinuation { continuation in adapter.arm { continuation.resume(returning: $0) } }
    }

    private func request(_ adapter: GridlyLabelDiagnostic) async -> String {
        await withCheckedContinuation { continuation in
            adapter.requestTile(zoom: 1, row: 0, column: 0) { image, status in
                let decoded = image?.cgImage?.width == 512 && image?.cgImage?.height == 512
                continuation.resume(returning: decoded == (status == "SYNTHETIC_PASS") ? status : "IMAGE_MISMATCH")
            }
        }
    }

    private func evidence(_ adapter: GridlyLabelDiagnostic) async -> [GridlyLabelDiagnostic.Evidence] {
        await withCheckedContinuation { continuation in adapter.evidence { continuation.resume(returning: $0) } }
    }

    @MainActor
    private func testDefaultAndBudget(_ png: Data) async throws {
        let disabled = try makeAdapter(run: newRun())
        _ = try await prepare(disabled)
        let defaultArm = await arm(disabled)
        let defaultRequest = await request(disabled)
        let defaultRows = await evidence(disabled)
        try expect(defaultArm == "ARM_REJECTED" && defaultRequest == "BLOCKED" && defaultRows.isEmpty, "DEFAULT_OFF")

        let run = try newRun()
        let adapter = try makeAdapter(run: run)
        let source = TileSource(png)
        try expect(adapter.selectSyntheticTransport(source.tile), "SELECT_SYNTHETIC")
        _ = try await prepare(adapter)
        let beforeArm = await request(adapter)
        let beforeRows = await evidence(adapter)
        try expect(beforeArm == "BLOCKED" && beforeRows.isEmpty && source.count == 0, "PRE_ARM")
        let armed = await arm(adapter)
        try expect(armed == "ARMED", "ARM")
        let first = await request(adapter)
        let second = await request(adapter)
        let third = await request(adapter)
        try expect(first == "SYNTHETIC_PASS" && second == "SYNTHETIC_PASS" && third == "BLOCKED" && source.count == 2, "REQUEST_CAP")
        try expect((try? makeAdapter(run: run)) == nil, "EXHAUSTED_REOPEN")

        let rows = await evidence(adapter)
        try expect(rows.map(\.request) == [1, 2], "DIAGNOSTIC_ORDINALS")
        for row in rows {
            try expect(row.status == 0 && row.documentOrigin == "capacitor://localhost" &&
                row.referer == "ABSENT_NATIVE_BOUND_PATH" && row.requestOrigin == "ABSENT_NATIVE_BOUND_PATH" &&
                row.contentType == "image/png" && row.tileValidity == "SYNTHETIC_DECODE_512_PASS" &&
                row.context == "SYNTHETIC_TRANSPORT", "DIAGNOSTIC_ALLOWLIST")
        }
        // Reflect actual fields, including any future additions, rather than reserializing a subset.
        let allowed = Set(["request", "status", "documentOrigin", "referer", "requestOrigin", "contentType", "tileValidity", "context"])
        for row in rows {
            let fields = Mirror(reflecting: row).children
            try expect(Set(fields.compactMap(\.label)) == allowed, "DIAGNOSTIC_FIELDS")
            try expect(!String(reflecting: row).contains(candidate), "DIAGNOSTIC_MARKER")
        }
    }

    @MainActor
    private func testConcurrencyAndRetry(_ png: Data) async throws {
        let run = try newRun()
        let first = try makeAdapter(run: run)
        let competing = try makeAdapter(run: run)
        let release = DispatchSemaphore(value: 0)
        let source = TileSource(png, release: release)
        let other = TileSource(png)
        try expect(first.selectSyntheticTransport(source.tile) && competing.selectSyntheticTransport(other.tile), "CONCURRENT_SETUP")
        _ = try await prepare(first)
        let firstArm = await arm(first)
        _ = try await prepare(competing)
        let otherArm = await arm(competing)
        try expect(firstArm == "ARMED" && otherArm == "ARMED", "CONCURRENT_ARM")
        let pending = Task { await request(first) }
        defer { release.signal() }
        for _ in 0..<100 where source.count == 0 { try await Task.sleep(nanoseconds: 20_000_000) }
        try expect(source.count == 1, "CONCURRENT_START")
        let denied = await request(competing)
        try expect(denied == "BUDGET_UNAVAILABLE" && other.count == 0, "CONCURRENT_EXCLUSION")
        release.signal()
        let completed = await pending.value
        let later = await request(first)
        try expect(completed == "SYNTHETIC_PASS" && later == "BUDGET_UNAVAILABLE" && source.count == 1, "CONCURRENT_DURABLE_STOP")

        let failing = try makeAdapter(run: newRun())
        let malformed = TileSource(Data([0]))
        try expect(failing.selectSyntheticTransport(malformed.tile), "RETRY_SETUP")
        _ = try await prepare(failing)
        let armed = await arm(failing)
        let invalid = await request(failing)
        let retry = await request(failing)
        try expect(armed == "ARMED" && invalid == "SYNTHETIC_FAIL" && retry == "BLOCKED" && malformed.count == 1, "NO_RETRY")
    }

    @MainActor
    private func testStop(_ png: Data, event: String) async throws {
        let run = try newRun()
        let adapter = try makeAdapter(run: run)
        let source = TileSource(png)
        try expect(adapter.selectSyntheticTransport(source.tile), "STOP_SETUP")
        let view = try await prepare(adapter)
        let armed = await arm(adapter)
        try expect(armed == "ARMED", "STOP_ARM")
        switch event {
        case "EXPLICIT_STOP": adapter.stop()
        case "INACTIVE_NOTIFICATION":
            NotificationCenter.default.post(name: UIApplication.willResignActiveNotification, object: nil)
        case "WEBKIT_TERMINATION_CALLBACK": adapter.webViewWebContentProcessDidTerminate(view)
        default: throw CheckFailed(code: "UNKNOWN_STOP_EVENT")
        }
        let denied = await request(adapter)
        try expect(denied == "BLOCKED" && source.count == 0 && (try? makeAdapter(run: run)) == nil, event)
    }

    @MainActor
    private func testNavigationCancellation(_ png: Data, support: URL) async throws {
        let run = try newRun()
        let adapter = try makeAdapter(run: run)
        let source = TileSource(png)
        try expect(adapter.selectSyntheticTransport(source.tile), "NAVIGATION_SETUP")
        let view = try await prepare(adapter)
        let armed = await arm(adapter)
        try expect(armed == "ARMED", "NAVIGATION_ARM")
        let stopped = support.appendingPathComponent("arcgis-ios-\(run).ledger.stopped")
        view.load(URLRequest(url: URL(string: "capacitor://localhost/cancelled")!))
        for _ in 0..<100 where !FileManager.default.fileExists(atPath: stopped.path) {
            try await Task.sleep(nanoseconds: 20_000_000)
        }
        let denied = await request(adapter)
        try expect(FileManager.default.fileExists(atPath: stopped.path) &&
            view.url?.absoluteString == "capacitor://localhost/" && denied == "BLOCKED" &&
            source.count == 0, "NAVIGATION_CANCELLED")
    }

    @MainActor
    private func run() async {
        guard let support = try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true) else { return }
        let result: String
        do {
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            let png = UIGraphicsImageRenderer(size: CGSize(width: 512, height: 512), format: format).pngData { context in
                context.cgContext.setFillColor(UIColor.blue.cgColor)
                context.cgContext.fill(CGRect(x: 0, y: 0, width: 512, height: 512))
            }
            try await testDefaultAndBudget(png)
            try await testConcurrencyAndRetry(png)
            try await testNavigationCancellation(png, support: support)
            for event in ["EXPLICIT_STOP", "INACTIVE_NOTIFICATION", "WEBKIT_TERMINATION_CALLBACK"] {
                try await testStop(png, event: event)
            }
            result = success
        } catch let error as CheckFailed {
            result = error.code
        } catch {
            result = "FIXTURE_ERROR"
        }
        try? Data(result.utf8).write(to: support.appendingPathComponent(resultName), options: .atomic)
    }
}
