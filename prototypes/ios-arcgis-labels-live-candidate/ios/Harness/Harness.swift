import CryptoKit
import OSLog
import SwiftUI
import WebKit

@main
@MainActor
struct PilotHarness: App {
    var body: some Scene {
        WindowGroup { HarnessView() }
    }
}

@MainActor
struct HarnessView: UIViewRepresentable {
    func makeCoordinator() -> HarnessPage { HarnessPage() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        let page = context.coordinator
        configuration.setURLSchemeHandler(page, forURLScheme: "capacitor")
        page.labels.install(on: configuration)
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = page
        view.load(URLRequest(url: HarnessPage.home))
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}
}

@MainActor
final class HarnessPage: NSObject, WKURLSchemeHandler, WKNavigationDelegate {
    static let home = URL(string: "capacitor://localhost/map.html")!
    static let origin = "https://labels-pilot.invalid"
    private static let logger = Logger(subsystem: "com.gridlygo.prototype.labeltiles.pilot-cert", category: "certification")
    let labels: LabelsSchemeHandler

    override init() {
        let config = LabelsPilotConfiguration(origin: Self.origin, appID: "com.gridlygo.prototype.labeltiles.pilot") { _ in
            LabelsLeaseEvidence(challengeID: UUID(), paidEvidence: "harness-paid", attestEvidence: "harness-attest")
        }!
        labels = LabelsSchemeHandler(configuration: config, http: PilotURLSession(protocolClasses: [HarnessHTTPS.self]))
        super.init()
    }

    func webView(_ view: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(action.targetFrame?.isMainFrame == true && action.request.url == Self.home ? .allow : .cancel)
    }

    func webView(_ view: WKWebView, start task: WKURLSchemeTask) {
        let allowed = ["map.html": "text/html", "map.js": "application/javascript",
            "imagery.svg": "image/svg+xml", "vendor/leaflet.js": "application/javascript", "vendor/leaflet.css": "text/css"]
        if let url = task.request.url, url.absoluteString == "capacitor://localhost/ready",
           task.request.httpMethod == "GET",
           let fixture = Bundle.main.url(forResource: "valid", withExtension: "png"),
           let body = try? Data(contentsOf: fixture) {
            task.didReceive(URLResponse(url: url, mimeType: "image/png", expectedContentLength: body.count, textEncodingName: nil))
            task.didReceive(body)
            task.didFinish()
            Self.logger.notice("PILOT_WEBKIT_LABELS_RENDERED")
            return
        }
        guard task.request.httpMethod == "GET", let url = task.request.url,
              let file = allowed.keys.first(where: { url.absoluteString == "capacitor://localhost/" + $0 }),
              let root = Bundle.main.resourceURL?.appendingPathComponent("Web"),
              let body = try? Data(contentsOf: root.appendingPathComponent(file))
        else { task.didFailWithError(URLError(.resourceUnavailable)); return }
        task.didReceive(URLResponse(url: url, mimeType: allowed[file], expectedContentLength: body.count,
                                    textEncodingName: allowed[file]?.hasPrefix("image/") == true ? nil : "utf-8"))
        task.didReceive(body)
        task.didFinish()
    }

    func webView(_ view: WKWebView, stop task: WKURLSchemeTask) {}
}

// Intercept every request issued by the ephemeral URLSession, including any
// unexpected destination. No TLS or network connection is opened by this stub.
final class HarnessHTTPS: URLProtocol, @unchecked Sendable {
    private struct Lease {
        let id: String
        let key: P256.Signing.PublicKey
        let expires: Int64
        var seen = Set<String>()
    }
    private static let lock = NSLock()
    private static var lease: Lease?
    private static let logger = Logger(subsystem: "com.gridlygo.prototype.labeltiles.pilot-cert", category: "certification")
    private static let origin = "https://labels-pilot.invalid"

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}

    override func startLoading() {
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        guard let url = request.url else { fail(); return }
        if request.httpMethod == "POST", url.absoluteString == Self.origin + "/v1/labels/lease" {
            guard let body = request.httpBody ?? Self.read(request.httpBodyStream),
                  let json = try? JSONSerialization.jsonObject(with: body) as? [String: String],
                  json["paidEvidence"] == "harness-paid", json["attestEvidence"] == "harness-attest",
                  let challenge = json["challengeId"], UUID(uuidString: challenge) != nil,
                  let spki = json["spki"].flatMap(Self.decode),
                  let key = try? P256.Signing.PublicKey(derRepresentation: spki) else { fail(); return }
            let id = UUID().uuidString.lowercased()
            Self.lock.lock()
            Self.lease = Lease(id: id, key: key, expires: now + 300_000)
            Self.lock.unlock()
            let data = try! JSONSerialization.data(withJSONObject: ["leaseId": id, "issuedAt": now,
                "expiresAt": now + 300_000, "audience": "gridly-labels-pilot-v1", "scope": "imagery-labels:read",
                "store": "sandbox", "attest": "production"])
            reply(201, "application/json", data)
            return
        }
        let path = url.path
        let prefix = "/v1/imagery-labels/"
        guard request.httpMethod == "GET", url.absoluteString == Self.origin + path,
              path.hasPrefix(prefix),
              let scheme = URL(string: "gridly-label://pilot/tile/" + path.dropFirst(prefix.count)),
              let tile = LabelTile(url: scheme, method: "GET"),
              let id = request.value(forHTTPHeaderField: "X-Gridly-Labels-Lease"),
              let stamp = request.value(forHTTPHeaderField: "X-Gridly-Labels-Timestamp").flatMap(Int64.init),
              stamp > now - 30_000, stamp < now + 30_000,
              let nonce = request.value(forHTTPHeaderField: "X-Gridly-Labels-Request"), UUID(uuidString: nonce) != nil,
              let raw = request.value(forHTTPHeaderField: "X-Gridly-Labels-Signature").flatMap(Self.decode),
              let signature = try? P256.Signing.ECDSASignature(rawRepresentation: raw),
              let proof = try? canonicalTileProof(origin: Self.origin, target: path, leaseID: id,
                                                  timestamp: stamp, requestID: nonce),
              Self.consume(id: id, nonce: nonce, now: now, signature: signature, proof: proof)
        else { fail(); return }
        DispatchQueue.main.async { [self] in
            guard let png = HarnessRenderer.render(tile) else { fail(); return }
            Self.logger.notice("PILOT_SIGNED_PNG_DELIVERED")
            reply(200, "image/png", png)
        }
    }

    private static func consume(id: String, nonce: String, now: Int64,
                                signature: P256.Signing.ECDSASignature, proof: Data) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard let current = lease, current.id == id, now < current.expires, !current.seen.contains(nonce),
              current.key.isValidSignature(signature, for: proof) else { return false }
        lease?.seen.insert(nonce)
        return true
    }

    private static func decode(_ input: String) -> Data? {
        let base = input.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        return Data(base64Encoded: base + String(repeating: "=", count: (4 - base.count % 4) % 4))
    }

    private static func read(_ stream: InputStream?) -> Data? {
        guard let stream else { return nil }
        stream.open()
        defer { stream.close() }
        let blockSize = 4096
        var buffer = [UInt8](repeating: 0, count: blockSize)
        var data = Data()
        while true {
            let count = stream.read(&buffer, maxLength: blockSize)
            if count == 0 { return data }
            guard count > 0, data.count + count <= 48 * 1024 else { return nil }
            data.append(contentsOf: buffer.prefix(count))
        }
    }

    private func fail() {
        Self.logger.error("PILOT_HARNESS_REQUEST_REJECTED")
        client?.urlProtocol(self, didFailWithError: URLError(.resourceUnavailable))
    }

    private func reply(_ status: Int, _ type: String, _ data: Data) {
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": type, "Content-Length": String(data.count), "Cache-Control": "no-store"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
}
