import SwiftUI
import WebKit

@main
@MainActor
struct LabelTileHarness: App {
    @State private var mode = SyntheticLabelTransport.Mode.success

    var body: some Scene {
        WindowGroup {
            VStack(spacing: 0) {
                Picker("Mock transport", selection: $mode) {
                    ForEach(SyntheticLabelTransport.Mode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .padding(8)
                MapWebView(mode: mode)
            }
        }
    }
}

@MainActor
struct MapWebView: UIViewRepresentable {
    let mode: SyntheticLabelTransport.Mode

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        let transport = GatewayLabelTransport()
        var mapURL: URL?

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(action.targetFrame?.isMainFrame == true && action.request.url == mapURL ? .allow : .cancel)
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let coordinator = context.coordinator
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.setURLSchemeHandler(GridlyLabelTileSchemeHandler(transport: coordinator.transport),
                                   forURLScheme: LabelTile.scheme)
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = coordinator
        coordinator.transport.mode = mode
        if let page = Bundle.main.url(forResource: "map", withExtension: "html", subdirectory: "Web") {
            coordinator.mapURL = page
            view.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        } else {
            assertionFailure("The harness map resource is missing.")
        }
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        guard context.coordinator.transport.mode != mode else { return }
        context.coordinator.transport.mode = mode
        view.evaluateJavaScript("window.redrawMockLabels?.()")
    }
}
