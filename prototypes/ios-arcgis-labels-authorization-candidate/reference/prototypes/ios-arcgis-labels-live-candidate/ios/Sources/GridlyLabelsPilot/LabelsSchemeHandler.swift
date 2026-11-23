#if canImport(UIKit)
import Foundation
import WebKit

@MainActor
public final class LabelsSchemeHandler: NSObject, WKURLSchemeHandler {
    private struct Pending {
        let task: WKURLSchemeTask
        var cancel: TileCancel
    }

    private let transport: HTTPSLabelTransport
    private let queue: LabelTileQueue
    private var tasks: [ObjectIdentifier: Pending] = [:]
    private var suspended = false

    // One handler per WebView and verified native user session. Install it on
    // the WKWebViewConfiguration before Capacitor constructs the WebView.
    public convenience init(configuration: LabelsPilotConfiguration? = nil) {
        self.init(configuration: configuration, http: PilotURLSession())
    }

    init(configuration: LabelsPilotConfiguration?, http: PilotHTTP) {
        let transport = HTTPSLabelTransport(configuration: configuration, http: http)
        self.transport = transport
        queue = LabelTileQueue(transport: transport, timeout: 8)
        super.init()
    }

    public func install(on configuration: WKWebViewConfiguration) {
        configuration.setURLSchemeHandler(self, forURLScheme: LabelTile.scheme)
    }

    public func setSuspended(_ value: Bool) {
        suspended = value
        guard value else { return }
        transport.invalidate()
        let ids = Array(tasks.keys)
        for id in ids {
            guard let pending = tasks.removeValue(forKey: id) else { continue }
            pending.cancel()
            pending.task.didFailWithError(Self.safeError(.cancelled))
        }
    }

    public func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard !suspended, Self.isLocalApp(webView.url),
              task.request.mainDocumentURL.map({ Self.isLocalApp($0) }) ?? true,
              let url = task.request.url,
              let tile = LabelTile(url: url, method: task.request.httpMethod) else {
            task.didFailWithError(Self.safeError(.invalidRequest))
            return
        }
        let id = ObjectIdentifier(task)
        guard tasks[id] == nil else { return }
        tasks[id] = Pending(task: task, cancel: {})
        let cancel = queue.submit(tile) { [weak self] result in
            guard let self, self.tasks[id] != nil else { return }
            switch result {
            case .success(let data):
                task.didReceive(URLResponse(url: url, mimeType: TilePNG.mimeType,
                                            expectedContentLength: data.count, textEncodingName: nil))
                guard self.tasks[id] != nil else { return }
                task.didReceive(data)
                guard self.tasks.removeValue(forKey: id) != nil else { return }
                task.didFinish()
            case .failure(let error):
                self.tasks.removeValue(forKey: id)
                task.didFailWithError(Self.safeError(error))
            }
        }
        if tasks[id] != nil { tasks[id]?.cancel = cancel }
    }

    public func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        tasks.removeValue(forKey: ObjectIdentifier(task))?.cancel()
    }

    private static func isLocalApp(_ url: URL?) -> Bool {
        guard let url, let parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return false }
        return parts.scheme == "capacitor" && parts.host == "localhost" &&
            parts.port == nil && parts.user == nil && parts.password == nil
    }

    private static func safeError(_ error: TileError) -> NSError {
        NSError(domain: "GridlyLabelsPilot", code: 1, userInfo: [NSLocalizedDescriptionKey: error.rawValue])
    }
}
#endif
