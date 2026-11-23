import UIKit
import WebKit

@MainActor
final class GridlyLabelTileSchemeHandler: NSObject, WKURLSchemeHandler {
    private let queue: LabelTileQueue
    private var tasks: [ObjectIdentifier: TileCancel] = [:]

    init(transport: MockLabelTransport) {
        queue = LabelTileQueue(transport: transport)
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url,
              let tile = LabelTile(url: url, method: task.request.httpMethod) else {
            task.didFailWithError(Self.safeError(.invalidRequest))
            return
        }
        let id = ObjectIdentifier(task)
        guard tasks[id] == nil else { return }
        tasks[id] = {}
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
        if tasks[id] != nil { tasks[id] = cancel }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        tasks.removeValue(forKey: ObjectIdentifier(task))?()
    }

    private static func safeError(_ error: TileError) -> NSError {
        NSError(domain: "GridlyLabelTileHarness", code: 1,
                userInfo: [NSLocalizedDescriptionKey: error.rawValue])
    }
}

@MainActor
final class SyntheticLabelTransport: MockLabelTransport {
    enum Mode: String, CaseIterable {
        case success = "Success", failure = "Failure", timeout = "Timeout", invalidPNG = "Invalid PNG"
    }
    var mode = Mode.success

    func request(_ tile: LabelTile, completion: @escaping TileCompletion) -> TileCancel {
        let mode = mode
        let task = Task { @MainActor in
            do {
                try await Task.sleep(nanoseconds: mode == .timeout ? 5_000_000_000 : 60_000_000)
                switch mode {
                case .success:
                    if let data = Self.render(tile) { completion(.success(data)) }
                    else { completion(.failure(.invalidImage)) }
                case .failure, .timeout:
                    completion(.failure(.unavailable))
                case .invalidPNG:
                    completion(.success(Data([0, 1, 2])))
                }
            } catch {
                completion(.failure(.cancelled))
            }
        }
        return { task.cancel() }
    }

    private static func render(_ tile: LabelTile) -> Data? {
        let size = CGFloat(LabelTile.size)
        let bounds = CGRect(x: 0, y: 0, width: size, height: size)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = false
        format.preferredRange = .standard
        let renderer = UIGraphicsImageRenderer(size: bounds.size, format: format)
        return renderer.image { _ in
            draw("West Ridge", at: tile.pixel(latitude: 30.052, longitude: -94.891), fontSize: 24, in: bounds)
            draw("Cedar Lane", at: tile.pixel(latitude: 30.044, longitude: -94.880), fontSize: 18, in: bounds)
            draw("Mill Creek", at: tile.pixel(latitude: 30.038, longitude: -94.889), fontSize: 16, in: bounds)
        }.pngData()
    }

    private static func draw(_ label: String, at point: (x: Double, y: Double), fontSize: CGFloat, in bounds: CGRect) {
        let text = label as NSString
        let font = UIFont.systemFont(ofSize: fontSize, weight: .bold)
        let size = text.size(withAttributes: [.font: font])
        let anchor = CGPoint(x: CGFloat(point.x), y: CGFloat(point.y))
        let rect = CGRect(x: anchor.x - size.width / 2, y: anchor.y - size.height - 5,
                          width: size.width, height: size.height)
        guard rect.union(CGRect(x: anchor.x - 4, y: anchor.y - 4, width: 8, height: 8))
            .insetBy(dx: -4, dy: -4).intersects(bounds) else { return }
        text.draw(in: rect, withAttributes: [
            .font: font, .foregroundColor: UIColor.white,
            .strokeColor: UIColor.black, .strokeWidth: -4
        ])
        UIColor.white.setFill()
        UIBezierPath(ovalIn: CGRect(x: anchor.x - 3, y: anchor.y - 3, width: 6, height: 6)).fill()
    }
}
