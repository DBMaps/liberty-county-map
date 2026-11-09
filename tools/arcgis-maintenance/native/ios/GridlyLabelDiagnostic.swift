// Diagnostic source only. Compiled for the standalone fixture or an explicit Build 18 opt-in.
#if GRIDLY_ARCGIS_DIAGNOSTIC && (DEBUG || GRIDLY_BUILD18_DIAGNOSTIC)
import UIKit
import WebKit
import Network
import Security
import Darwin

private enum DiagnosticFailure: Error { case stopped, http(Int) }

// The sidecar stays on disk if we cannot prove that completion was persisted.
final class NativeLabelBudget {
    private enum Operation: Equatable { case inspect, reserve, complete, stop }
    private let file: URL
    private(set) var flightHeld = false
    private let prefix: String
    private static func location(_ run: String, createDirectory: Bool = false) throws -> URL {
        guard run.range(of: "^owner-[a-f0-9]{32}$", options: .regularExpression) != nil else { throw DiagnosticFailure.stopped }
        let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: createDirectory).resolvingSymlinksInPath().standardizedFileURL
        let url = root.appendingPathComponent("arcgis-ios-\(run).ledger")
        guard url.resolvingSymlinksInPath().standardizedFileURL == url.standardizedFileURL else { throw DiagnosticFailure.stopped }
        return url
    }
    // Explicit owner provisioning, never invoked by opening/arming/restarting a fixture.
    static func provision(run: String, mode: String) throws {
        guard mode == GridlyLabelDiagnostic.mode else { throw DiagnosticFailure.stopped }
        let url = try location(run, createDirectory: true)
        let fd = Darwin.open(url.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, S_IRUSR | S_IWUSR)
        guard fd >= 0 else { throw DiagnosticFailure.stopped }
        defer { Darwin.close(fd) }
        let bytes = Array("GRIDLY_LABELS_V2:ios:\(run)\n".utf8)
        let written = bytes.withUnsafeBytes { Darwin.write(fd, $0.baseAddress, $0.count) }
        guard written == bytes.count, fsync(fd) == 0 else { throw DiagnosticFailure.stopped }
        var privateURL = url
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try privateURL.setResourceValues(values)
        try syncParent(of: url)
        // A partial file remains invalid. Never delete/reset a failed provisioning.
    }
    init(run: String) throws {
        file = try Self.location(run)
        prefix = "GRIDLY_LABELS_V2:ios:\(run)\n"
        try checkAvailable()
    }
    func checkAvailable() throws {
        guard !FileManager.default.fileExists(atPath: file.path + ".flight") else { throw DiagnosticFailure.stopped }
        _ = try change(.inspect)
    }
    func beginFlight() throws {
        guard !flightHeld, !FileManager.default.fileExists(atPath: file.path + ".stopped") else { throw DiagnosticFailure.stopped }
        let fd = Darwin.open(file.path + ".flight", O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, S_IRUSR | S_IWUSR)
        guard fd >= 0 else { throw DiagnosticFailure.stopped }
        defer { Darwin.close(fd) }
        flightHeld = true
        guard fsync(fd) == 0 else { throw DiagnosticFailure.stopped }
        try Self.syncParent(of: file)
    }
    private static func syncParent(of file: URL) throws {
        let fd = Darwin.open(file.deletingLastPathComponent().path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
        guard fd >= 0 else { throw DiagnosticFailure.stopped }
        defer { Darwin.close(fd) }
        guard fsync(fd) == 0 else { throw DiagnosticFailure.stopped }
    }
    func endFlight(stopping: Bool) throws {
        guard flightHeld else { throw DiagnosticFailure.stopped }
        _ = try change(stopping ? .stop : .complete)
        guard unlink(file.path + ".flight") == 0 else { throw DiagnosticFailure.stopped }
        flightHeld = false
    }
    func reserve() throws -> Int { try change(.reserve) }
    private func change(_ operation: Operation) throws -> Int {
        guard operation == .inspect || flightHeld,
              (try file.resourceValues(forKeys: [.isExcludedFromBackupKey])).isExcludedFromBackup == true,
              !FileManager.default.fileExists(atPath: file.path + ".stopped") else { throw DiagnosticFailure.stopped }
        let fd = Darwin.open(file.path, O_RDWR | O_NOFOLLOW)
        guard fd >= 0 else { throw DiagnosticFailure.stopped }
        defer { Darwin.close(fd) }
        guard flock(fd, LOCK_EX | LOCK_NB) == 0 else { throw DiagnosticFailure.stopped }
        defer { flock(fd, LOCK_UN) }
        var info = stat()
        guard fstat(fd, &info) == 0, (info.st_mode & S_IFMT) == S_IFREG, info.st_uid == getuid(),
              (info.st_mode & 0o777) == 0o600, info.st_nlink == 1, info.st_size > 0, info.st_size <= 256 else { throw DiagnosticFailure.stopped }
        var bytes = [UInt8](repeating: 0, count: Int(info.st_size))
        let count = bytes.withUnsafeMutableBytes { Darwin.read(fd, $0.baseAddress, $0.count) }
        guard count == bytes.count, let state = String(bytes: bytes, encoding: .utf8), state.hasPrefix(prefix) else { throw DiagnosticFailure.stopped }
        var tail = String(state.dropFirst(prefix.count))
        let terminal = tail.hasSuffix("STOP\n")
        if terminal { tail = String(tail.dropLast(5)) }
        let used: Int
        switch tail {
        case "": used = 0
        case "1\n", "1\nOK\n": used = 1
        case "1\nOK\n2\n": used = 2
        default: throw DiagnosticFailure.stopped
        }
        let available = !terminal && (tail.isEmpty || tail == "1\nOK\n")
        let record: String
        switch operation {
        case .inspect:
            guard available else { throw DiagnosticFailure.stopped }
            return used
        case .reserve:
            guard available, used < 2 else { throw DiagnosticFailure.stopped }
            record = "\(used + 1)\n"
        case .complete:
            guard !terminal, tail == "1\n" else { throw DiagnosticFailure.stopped }
            record = "OK\n"
        case .stop:
            record = terminal ? "" : "STOP\n"
        }
        if !record.isEmpty {
            let addition = Array(record.utf8)
            guard lseek(fd, 0, SEEK_END) >= 0 else { throw DiagnosticFailure.stopped }
            let written = addition.withUnsafeBytes { Darwin.write(fd, $0.baseAddress, $0.count) }
            guard written == addition.count else { throw DiagnosticFailure.stopped }
        }
        guard fsync(fd) == 0 else { throw DiagnosticFailure.stopped }
        return operation == .reserve ? used + 1 : used
    }
}

// Lifecycle cancellation is latched synchronously, even when the transport queue is busy.
final class DiagnosticCancellation {
    private let lock = NSLock()
    private var cancelled = false

    func cancel() {
        lock.lock()
        cancelled = true
        lock.unlock()
    }

    @discardableResult
    func whileActive(_ action: () -> Void) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard !cancelled else { return false }
        action()
        return true
    }
}

// There is NO attempt to register an HTTPS WKURLSchemeHandler.
private final class EmptyFixtureAssets: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard task.request.url?.absoluteString == "capacitor://localhost/" else {
            task.didFailWithError(DiagnosticFailure.stopped); return
        }
        let bytes = Data("<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'\"><body>Gridly isolated label diagnostic</body>".utf8)
        task.didReceive(URLResponse(url: task.request.url!, mimeType: "text/html", expectedContentLength: bytes.count, textEncodingName: "UTF-8"))
        task.didReceive(bytes); task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

final class GridlyLabelDiagnostic: NSObject, WKNavigationDelegate {
    static let mode = "OWNER_ISOLATED_NATIVE_LABEL_DIAGNOSTIC"
    private static let host = "static-map-tiles-api.arcgis.com"
    private static let tile = "/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/"
    private static let maxBytes = 2 * 1024 * 1024
    private let queue = DispatchQueue(label: "Gridly.IsolatedLabelDiagnostic")
    private let budget: NativeLabelBudget
    private let candidate: String
    private let cancellation = DiagnosticCancellation()
    private let requestSlot = DispatchSemaphore(value: 1)
    private var armed = false, stopped = false, inFlight = false
    private var providerEnabled = false
    private var synthetic: (() -> Data)?
    private var connection: NWConnection?
    private var timeout: DispatchWorkItem?
    private var cancelRequest: (() -> Void)?
    private var webView: WKWebView?
    private var preparing = false
    private var inactiveObserver: NSObjectProtocol?
    private var documentOrigin = "UNOBSERVABLE"
    private var rows: [Evidence] = []
    struct Evidence {
        let request: Int, status: Int
        let documentOrigin: String
        let referer = "ABSENT_NATIVE_BOUND_PATH"
        let requestOrigin = "ABSENT_NATIVE_BOUND_PATH"
        let contentType: String, tileValidity: String
        let context: String
    }
    static func provision(run: String, mode: String) throws { try NativeLabelBudget.provision(run: run, mode: mode) }
    init(run: String, mode: String, candidate: String) throws {
        guard mode == Self.mode, candidate.range(of: "^[A-Za-z0-9_.~-]{16,4096}$", options: .regularExpression) != nil else { throw DiagnosticFailure.stopped }
        self.budget = try NativeLabelBudget(run: run); self.candidate = candidate
        super.init()
        inactiveObserver = NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: nil) { [weak self] _ in self?.stop() }
    }
    deinit { if let observer = inactiveObserver { NotificationCenter.default.removeObserver(observer) }; connection?.cancel() }
    func selectSyntheticTransport(_ response: @escaping () -> Data) -> Bool {
        guard Thread.isMainThread else { return false }
        return queue.sync {
            guard webView == nil, !armed, !stopped, !providerEnabled, candidate.hasPrefix("SYNTHETIC_") else { return false }
            synthetic = response; return true
        }
    }
    // No automatic call site. A separate explicit live-test authorization is required.
    func authorizeProviderTransport(_ authorization: String) -> Bool {
        guard Thread.isMainThread else { return false }
        return queue.sync {
            guard webView == nil, !armed, !stopped, synthetic == nil, !candidate.hasPrefix("SYNTHETIC_"), authorization == "OWNER_TWO_REQUEST_NATIVE_PROVIDER_TEST" else { return false }
            providerEnabled = true; return true
        }
    }
    // Main thread only. No consumer source, Leaflet, map, bridge plugins or push code.
    // Completion provides fixed status only; a nil view is a hard stop.
    func prepareFixture(completion: @escaping (WKWebView?, String) -> Void) {
        guard Thread.isMainThread, webView == nil, !preparing else { completion(nil,"FIXTURE_REJECTED"); return }
        preparing = true
        let rules = "[{\"trigger\":{\"url-filter\":\"^https?://\"},\"action\":{\"type\":\"block\"}}]"
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "GridlyIsolatedNoNetworkV1", encodedContentRuleList: rules) { [weak self] rule, error in
            DispatchQueue.main.async {
                guard let self = self, let rule = rule, error == nil else { completion(nil,"RULE_COMPILATION_FAILED"); return }
                guard self.cancellation.whileActive({}) else { completion(nil,"FIXTURE_REJECTED"); return }
                let configuration = WKWebViewConfiguration()
                configuration.websiteDataStore = .nonPersistent()
                configuration.defaultWebpagePreferences.allowsContentJavaScript = false
                configuration.userContentController.add(rule)
                configuration.setURLSchemeHandler(EmptyFixtureAssets(), forURLScheme: "capacitor")
                let view = WKWebView(frame: .zero, configuration: configuration)
                view.navigationDelegate = self; self.webView = view
                view.load(URLRequest(url: URL(string: "capacitor://localhost/")!))
                completion(view,"INSTALLED_UNARMED")
            }
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Only the fixed local fixture document. Remote/resource HTTP is blocked by the rule list.
        guard action.request.url?.absoluteString == "capacitor://localhost/" else { stop(); decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { stop() }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { stop() }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { stop() }
    func arm(completion: @escaping (String) -> Void) {
        guard Thread.isMainThread, UIApplication.shared.applicationState == .active,
              let view = webView, !view.isLoading, view.url?.absoluteString == "capacitor://localhost/" else { completion("ARM_REJECTED"); return }
        let observed = "\(view.url!.scheme!)://\(view.url!.host!)" // Actual native document URL; not an HTTP header.
        queue.async {
            guard self.providerEnabled || self.synthetic != nil, !self.armed, !self.stopped,
                  self.cancellation.whileActive({}) else { completion("ARM_REJECTED"); return }
            do { try self.budget.checkAvailable() }
            catch { self.finishStop(); completion("BUDGET_UNAVAILABLE"); return }
            self.documentOrigin = observed; self.armed = true; completion("ARMED")
        }
    }
    func stop() {
        cancellation.cancel()
        queue.async {
            if let cancelRequest = self.cancelRequest { cancelRequest() }
            else { self.finishStop() }
        }
    }
    private func finishStop() {
        guard !stopped else { return }
        stopped = true; armed = false
        cancellation.cancel()
        timeout?.cancel(); timeout = nil; connection?.cancel(); connection = nil
        do {
            if !budget.flightHeld { try budget.beginFlight() }
            try budget.endFlight(stopping: true)
            inFlight = false
        } catch {
            // No further attempts. A held sidecar remains if the terminal write failed.
        }
    }
    private func settleFlight(success: Bool, ordinal: Int) -> Bool {
        guard success, cancellation.whileActive({}), !stopped else {
            finishStop()
            return false
        }
        if ordinal == 2 {
            finishStop()
            return !inFlight
        }
        do {
            try budget.endFlight(stopping: false)
            inFlight = false
            return true
        } catch {
            // A failed completion write is terminal. Leave the sidecar in place.
            stopped = true
            armed = false
            cancellation.cancel()
            return false
        }
    }
    func evidence(completion: @escaping ([Evidence]) -> Void) { queue.async { completion(self.rows) } }
    // Explicit native button/action only. No script-message/native HTTP plugin path.
    func requestTile(zoom: Int, row: Int, column: Int, completion result: @escaping (UIImage?, String) -> Void) {
        guard requestSlot.wait(timeout: .now()) == .success else { result(nil,"BLOCKED"); return }
        queue.async {
            func completion(_ image: UIImage?, _ status: String) {
                if !self.inFlight { self.requestSlot.signal() }
                result(image, status)
            }
            guard (self.providerEnabled || self.synthetic != nil), self.armed, !self.stopped, !self.inFlight,
                  self.cancellation.whileActive({}), zoom >= 0, zoom <= 23, row >= 0, column >= 0,
                  row < (1 << zoom), column < (1 << zoom) else { completion(nil,"BLOCKED"); return }
            self.inFlight = true
            do {
                try self.budget.beginFlight() // Cross-controller exclusion; stale crash marker fails closed.
                let ordinal = try self.budget.reserve() // Durable before transport.
                guard self.cancellation.whileActive({}) else { self.finishStop(); completion(nil,"STOPPED"); return }
                if let response = self.synthetic {
                    let data = response()
                    guard data.count <= Self.maxBytes, let image = UIImage(data: data), image.cgImage?.width == 512, image.cgImage?.height == 512 else {
                        self.finishStop(); completion(nil,"SYNTHETIC_FAIL"); return
                    }
                    guard self.settleFlight(success: true, ordinal: ordinal) else { completion(nil,"STOPPED"); return }
                    self.rows.append(Evidence(request: ordinal, status: 0, documentOrigin: self.documentOrigin, contentType: "image/png", tileValidity: "SYNTHETIC_DECODE_512_PASS", context: "SYNTHETIC_TRANSPORT"))
                    completion(image,"SYNTHETIC_PASS"); return
                }
                let path = Self.tile + "\(zoom)/\(row)/\(column)?token=" + self.candidate
                // NO synthesized Referer/Origin. This is NOT ordinary WKWebView authorization evidence.
                let bytes = Data("GET \(path) HTTP/1.1\r\nHost: \(Self.host)\r\nConnection: close\r\nAccept: image/png\r\nAccept-Encoding: identity\r\n\r\n".utf8)
                let tls = NWProtocolTLS.Options()
                sec_protocol_options_set_tls_server_name(tls.securityProtocolOptions, Self.host)
                sec_protocol_options_add_tls_application_protocol(tls.securityProtocolOptions, "http/1.1")
                let parameters = NWParameters(tls: tls, tcp: NWProtocolTCP.Options())
                // Default platform trust/hostname verification. No custom verify block or proxy.
                let connection = NWConnection(host: NWEndpoint.Host(Self.host), port: 443, using: parameters)
                self.connection = connection
                var sent = false, response = Data(), finished = false
                func finish(_ image: UIImage?, _ status: Int) {
                    guard !finished else { return }; finished = true
                    self.cancelRequest = nil
                    connection.stateUpdateHandler = nil
                    self.timeout?.cancel(); self.timeout = nil; connection.cancel(); self.connection = nil
                    let accepted = self.settleFlight(success: image != nil, ordinal: ordinal) ? image : nil
                    self.rows.append(Evidence(request: ordinal, status: status, documentOrigin: self.documentOrigin, contentType: accepted == nil ? "UNEXPECTED" : "image/png", tileValidity: accepted == nil ? "FAIL" : "DECODE_512_PASS", context: "EXPLICIT_NATIVE_TLS_NOT_WEBVIEW_HTTPS"))
                    completion(accepted,accepted == nil ? "STOPPED" : "PASS")
                }
                func receive() {
                    connection.receive(minimumIncompleteLength: 1, maximumLength: 16384) { data, _, complete, error in
                        guard !finished else { return }
                        if let data = data { response.append(data) }
                        guard error == nil, response.count <= Self.maxBytes else { finish(nil,0); return }
                        if complete {
                            do { let body = try Self.parseResponse(response); guard let image = UIImage(data: body), image.cgImage?.width == 512, image.cgImage?.height == 512 else { finish(nil,200); return }; finish(image,200) }
                            catch DiagnosticFailure.http(let status) { finish(nil,status) }
                            catch { finish(nil,0) }
                        } else { receive() } // Read more bytes; NEVER send another HTTP request.
                    }
                }
                self.cancelRequest = { finish(nil,0) }
                connection.stateUpdateHandler = { state in
                    switch state {
                    case .ready:
                        guard !sent, !finished else { return }
                        guard self.armed, !self.stopped, self.inFlight, self.connection === connection,
                              self.cancellation.whileActive({
                            sent = true
                            connection.send(content: bytes, completion: .contentProcessed { error in // SINGLE_HTTP_WRITE; no .idempotent/restart/retry.
                                guard !finished else { return }
                                if error != nil { finish(nil,0) } else { receive() }
                            })
                        }) else { finish(nil,0); return }
                    case .failed, .waiting: finish(nil,0)
                    default: break
                    }
                }
                let timeout = DispatchWorkItem { finish(nil,0) }; self.timeout = timeout
                self.queue.asyncAfter(deadline: .now() + 10, execute: timeout)
                connection.start(queue: self.queue)
            } catch {
                if self.budget.flightHeld { self.finishStop() }
                else { self.stopped = true; self.armed = false }
                completion(nil,"BUDGET_UNAVAILABLE")
            }
        }
    }
    static func parseResponse(_ response: Data) throws -> Data {
        guard let separator = response.range(of: Data([13,10,13,10])), separator.lowerBound <= 16384,
              let text = String(data: response[..<separator.lowerBound], encoding: .ascii) else { throw DiagnosticFailure.stopped }
        let lines = text.components(separatedBy: "\r\n")
        let parts = lines[0].split(separator: " ")
        guard parts.count >= 2, ["HTTP/1.0","HTTP/1.1"].contains(String(parts[0])), let status = Int(parts[1]), (100...599).contains(status) else { throw DiagnosticFailure.stopped }
        guard status == 200 else { throw DiagnosticFailure.http(status) }
        var headers: [String:String] = [:]
        for line in lines.dropFirst() {
            guard let colon = line.firstIndex(of: ":") else { throw DiagnosticFailure.stopped }
            let key = String(line[..<colon]).lowercased(), value = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
            guard !key.isEmpty, headers[key] == nil else { throw DiagnosticFailure.stopped }; headers[key] = value
        }
        let body = Data(response[separator.upperBound...])
        guard headers["transfer-encoding"] == nil, headers["content-encoding"] == nil, headers["content-type"] == "image/png",
              headers["content-length"] == String(body.count), body.starts(with: [137,80,78,71,13,10,26,10]) else { throw DiagnosticFailure.stopped }
        return body // Unknown framing fails closed; no fallback/retry.
    }
}
#endif
