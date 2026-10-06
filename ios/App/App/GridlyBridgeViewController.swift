import Capacitor
import UIKit
import WebKit
import OSLog

// BEGIN TESTABLE RECOVERY GATE
// Readiness failures never consume the one prompt. Evaluation is event-driven
// and bounded for this controller lifetime, including navigation and resume.
struct GridlyLegacyRecoveryGate {
    private(set) var attempts = 0
    private(set) var inFlight = false
    private(set) var prompted = false
    private(set) var complete = false
    private var pending = false

    mutating func begin(ready: Bool) -> Bool {
        guard !complete, !prompted, attempts < 12 else { return false }
        if inFlight { pending = true; return false }
        guard ready else { return false }
        attempts += 1
        inFlight = true
        return true
    }

    mutating func finish(terminal: Bool = false, prompt: Bool = false) -> Bool {
        inFlight = false
        complete = complete || terminal
        prompted = prompted || prompt
        let recheck = pending && !complete && !prompted && attempts < 12
        pending = false
        return recheck
    }
}
// END TESTABLE RECOVERY GATE

private final class GridlyRecoveryReadinessHandler: NSObject, WKScriptMessageHandler {
    weak var owner: GridlyBridgeViewController?
    init(owner: GridlyBridgeViewController) { self.owner = owner }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        owner?.legacyRuntimeReady(message)
    }
}

@objc(GridlyBridgeViewController)
class GridlyBridgeViewController: CAPBridgeViewController {
    private var recoveryGate = GridlyLegacyRecoveryGate()
    private var loadObservation: NSKeyValueObservation?
    private static let recoveryLog = Logger(subsystem: "com.gridlygo.gridly", category: "LegacyRecovery")

    private var recoveryBuild: Bool {
        Bundle.main.bundleIdentifier == "com.gridlygo.gridly" &&
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String == "14"
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GridlyStoreKitPlugin())
        bridge?.registerPluginInstance(GridlyContinuityPlugin())
        bridge?.registerPluginInstance(GridlyAppAttestPlugin())
        guard recoveryBuild else {
            recoveryDiagnostic("build_check_failed")
            return
        }
        guard let target = webView else {
            recoveryDiagnostic("webview_unavailable")
            return
        }
        let controller = target.configuration.userContentController
        controller.add(GridlyRecoveryReadinessHandler(owner: self), contentWorld: .page, name: "gridlyLegacyRuntimeReady")
        controller.addUserScript(WKUserScript(source: Self.legacyReadinessScript, injectionTime: .atDocumentEnd,
                                               forMainFrameOnly: true, in: .page))
        loadObservation = target.observe(\.isLoading, options: [.new]) { [weak self] target, _ in
            guard !target.isLoading else { return }
            DispatchQueue.main.async { [weak self] in self?.previewLegacyRetry() }
        }
        NotificationCenter.default.addObserver(self, selector: #selector(legacyApplicationActive),
                                               name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(legacyApplicationActive),
                                               name: UIScene.didActivateNotification, object: nil)
        recoveryDiagnostic("bridge_observers_installed")
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard recoveryBuild else { return }
        previewLegacyRetry()
    }

    @objc private func legacyApplicationActive() { previewLegacyRetry() }

    fileprivate func legacyRuntimeReady(_ message: WKScriptMessage) {
        guard recoveryBuild, message.webView === webView, message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "capacitor",
              message.frameInfo.securityOrigin.host == "localhost", message.body as? Bool == true else {
            recoveryDiagnostic("readiness_context_rejected")
            return
        }
        recoveryDiagnostic("runtime_ready")
        previewLegacyRetry()
    }

    private func recoveryDiagnostic(_ state: String) {
        // Only hardcoded states or allowlisted status values. No snapshot,
        // URL, identifier, coordinates, exception text, or purchase information.
        Self.recoveryLog.notice("recovery state=\(state, privacy: .public) attempts=\(self.recoveryGate.attempts)")
    }

    private func previewLegacyRetry() {
        guard recoveryBuild else { return }
        guard viewIfLoaded?.window != nil, UIApplication.shared.applicationState == .active else {
            recoveryDiagnostic("waiting_for_active_view")
            return
        }
        guard presentedViewController == nil else {
            recoveryDiagnostic("presentation_blocked")
            return
        }
        guard let target = webView, let url = target.url, url.scheme == "capacitor",
              url.host == "localhost", !target.isLoading else {
            recoveryDiagnostic("waiting_for_local_load")
            return
        }
        guard recoveryGate.begin(ready: true) else { return }
        recoveryDiagnostic("script_evaluation")
        target.callAsyncJavaScript(Self.legacyRecoveryScript,
                                   arguments: ["action": "preview", "expected": ""],
                                   in: nil, in: .page) { [weak self, weak target] result in
            guard let self = self else { return }
            guard let target = target, self.webView === target, target.url == url, !target.isLoading,
                  self.viewIfLoaded?.window != nil,
                  UIApplication.shared.applicationState == .active,
                  self.presentedViewController == nil else {
                let recheck = self.recoveryGate.finish()
                self.recoveryDiagnostic("evaluation_context_or_presentation_changed")
                if recheck { self.previewLegacyRetry() }
                return
            }
            guard case .success(let value) = result, let record = value as? [String: Any],
                  let status = record["status"] as? String else {
                let recheck = self.recoveryGate.finish()
                self.recoveryDiagnostic("script_failed")
                if recheck { self.previewLegacyRetry() }
                return
            }
            let allowed = ["not_ready", "busy", "empty", "not_legacy", "not_confirmed", "storage_unavailable", "preview"]
            self.recoveryDiagnostic(allowed.contains(status) ? status : "unexpected_status")
            guard status == "preview", let raw = record["raw"] as? String,
                  let kind = record["kind"] as? String, let started = record["started"] as? String,
                  let payload = record["payload"] as? String else {
                let recheck = self.recoveryGate.finish(terminal: status == "not_legacy")
                if recheck { self.previewLegacyRetry() }
                return
            }
            _ = self.recoveryGate.finish(prompt: true)
            self.presentLegacyPreview(raw: raw, kind: kind, started: started,
                                      payload: payload, target: target, url: url)
        }
    }

    private func presentLegacyPreview(raw: String, kind: String, started: String,
                                      payload: String, target: WKWebView, url: URL) {
        // The raw snapshot stays in this callback's memory. Never log, export,
        // persist, or display its UUID, coordinates, or other report contents.
        let message = "Saved action: \(kind)\nSaved at (UTC): \(started)\nDetails: \(payload)\n\n" +
            "This saved retry predates Build 12. Forgetting it removes only this local reporting operation. " +
            "Home Area, saved places, settings, and purchases stay intact. " +
            "Its earlier submission is unconfirmed; this does not cancel or delete any server report."
        let alert = UIAlertController(title: "Review legacy saved report", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Keep saved retry", style: .cancel))
        alert.addAction(UIAlertAction(title: "Forget saved retry", style: .destructive) { [weak self, weak target, weak alert] _ in
            alert?.dismiss(animated: true) { [weak self, weak target] in
                guard let self = self, let target = target,
                      self.webView === target, target.url == url, !target.isLoading,
                      self.viewIfLoaded?.window != nil,
                      UIApplication.shared.applicationState == .active else { return }
                self.forgetLegacyRetry(raw: raw, target: target)
            }
        })
        present(alert, animated: true) { [weak self, weak alert] in
            self?.recoveryDiagnostic(alert?.presentingViewController != nil ? "alert_presented" : "alert_presentation_failed")
        }
    }

    private func forgetLegacyRetry(raw: String, target: WKWebView) {
        target.callAsyncJavaScript(Self.legacyRecoveryScript,
                                   arguments: ["action": "clear", "expected": raw],
                                   in: nil, in: .page) { [weak self, weak target] result in
            guard let self = self, let target = target, self.webView === target,
                  self.viewIfLoaded?.window != nil,
                  UIApplication.shared.applicationState == .active else { return }
            let record: [String: Any]?
            if case .success(let value) = result { record = value as? [String: Any] }
            else { record = nil }
            let removed = record?["status"] as? String == "removed"
            let refreshed = record?["ctaRefreshed"] as? Bool == true
            let message = removed
                ? (refreshed ? "Only the legacy saved retry was removed. This recovery did not submit a report."
                   : "The legacy saved retry was removed. Close and reopen Gridly to refresh the screen. This recovery did not submit a report.")
                : "Removal was not confirmed. Recovery will not retry automatically. Close and reopen Gridly before reviewing the saved retry again."
            let alert = UIAlertController(title: removed ? "Saved retry removed" : "Saved retry not confirmed",
                                          message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            self.present(alert, animated: true)
        }
    }

    // Fixed native function body: named arguments are supplied by WebKit, never
    // interpolated into executable source. Preview is read-only. Clear has no
    // await between its final snapshot comparison and its one-key removal.
    private static let legacyRecoveryScript = #"""
    const KEY = 'gridlyPendingCommunityOperationV1';
    const cutoff = Date.parse('2026-10-06T21:14:27Z'); // Certified Build 12 archive.
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (action !== 'preview' && action !== 'clear') return {status:'invalid_action'};
    if (location.protocol !== 'capacitor:' || location.hostname !== 'localhost'
        || document.visibilityState !== 'visible') return {status:'not_ready'};
    try {
      if (window.gridlyReportProtocol?.protocol_version !== 2 || window.gridlyReportProtocol.KEY !== KEY
          || typeof gridlyRefreshPendingOperationButton !== 'function'
          || typeof reportingState !== 'object' || !reportingState
          || typeof governedRoadHazardSubmissionPromise === 'undefined'
          || typeof governedRoadHazardReportDraft === 'undefined'
          || typeof gridlyReportSubmissionRecoveryState !== 'object'
          || typeof gridlyLp0534bClearDiagnostics !== 'object') return {status:'not_ready'};
      if (reportingState.submissionInProgress || reportingState.locationLookupInProgress
          || reportingState.reportModeActive || reportingState.placementModeActive
          || governedRoadHazardSubmissionPromise || governedRoadHazardReportDraft
          || gridlyReportSubmissionRecoveryState.activeSubmission
          || gridlyLp0534bClearDiagnostics.crossingClearInFlightKeys.size
          || gridlyLp0534bClearDiagnostics.roadHazardClearInFlightKeys.size
          || document.getElementById('gridlyRetryPendingReport')?.disabled) return {status:'busy'};
      let raw;
      try { raw = localStorage.getItem(KEY); } catch { return {status:'storage_unavailable'}; }
      if (raw === null) return {status:'empty'};
      if (action === 'clear' && (typeof expected !== 'string' || raw !== expected)) return {status:'changed'};
      if (raw.length > 14000) return {status:'not_legacy'};
      let saved;
      try { saved = JSON.parse(raw); } catch { return {status:'not_legacy'}; }
      if (!saved || !uuid.test(saved.id) || !Number.isFinite(saved.startedAt)
          || saved.startedAt < 0 || saved.startedAt >= cutoff
          || !['create','confirm','edit','clear','cancel'].includes(saved.kind)) return {status:'not_legacy'};
      if (action === 'preview') {
        let valid = saved.kind === 'cancel';
        const p = saved.payload;
        if (p && !Array.isArray(p) && typeof p === 'object') {
          const encoded = JSON.stringify(p);
          const bounded = encoded.length <= 12000 && !/"(?:device_id|deviceId|submission_token|operation_id)"\s*:/.test(encoded);
          valid = bounded && (saved.kind === 'create'
            ? typeof p.crossing_id === 'string' && !!p.crossing_id.trim()
              && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90
              && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180
              && typeof p.report_type === 'string' && !!p.report_type.trim()
            : saved.kind === 'cancel' || uuid.test(p.observation_id)
              && (p.changes === undefined || p.changes && typeof p.changes === 'object' && !Array.isArray(p.changes)));
        }
        const labels = {create:'Create report',confirm:'Confirm report',edit:'Edit report',clear:'Clear report',cancel:'Cancel saved operation'};
        return {status:'preview',raw,kind:labels[saved.kind],started:new Date(saved.startedAt).toISOString(),
          payload:saved.kind === 'cancel' ? 'Cancellation identity only' : valid ? 'Complete saved details' : 'Incomplete saved details'};
      }
      localStorage.removeItem(KEY);
      if (localStorage.getItem(KEY) !== null) return {status:'removal_unconfirmed'};
      let ctaRefreshed = false;
      try { gridlyRefreshPendingOperationButton(); ctaRefreshed = !document.getElementById('gridlyRetryPendingReport'); } catch {}
      return {status:'removed',ctaRefreshed};
    } catch { return {status:'not_confirmed'}; }
    """#

    // Observe actual classic-runtime admission, which may occur long after the
    // navigation finishes. This read-only signal cannot clear storage or run a
    // supplied evaluator. It is installed on the same page before initial load.
    private static let legacyReadinessScript = #"""
    (() => {
      let sent = false;
      const signal = () => {
        if (sent || location.protocol !== 'capacitor:' || location.hostname !== 'localhost'
            || document.visibilityState !== 'visible' || document.readyState !== 'complete') return;
        try {
          if (window.gridlyReportProtocol?.protocol_version !== 2
              || typeof gridlyRefreshPendingOperationButton !== 'function'
              || typeof reportingState !== 'object' || !reportingState
              || typeof governedRoadHazardSubmissionPromise === 'undefined'
              || typeof governedRoadHazardReportDraft === 'undefined'
              || typeof gridlyReportSubmissionRecoveryState !== 'object'
              || typeof gridlyLp0534bClearDiagnostics !== 'object') return;
          window.webkit.messageHandlers.gridlyLegacyRuntimeReady.postMessage(true);
          sent = true;
          observer.disconnect();
          window.removeEventListener('load', signal, true);
          document.removeEventListener('visibilitychange', signal);
        } catch { /* Global lexical declarations can still be initializing. */ }
      };
      const observer = new MutationObserver(signal);
      observer.observe(document.documentElement, {childList:true, subtree:true});
      window.addEventListener('load', signal, true);
      document.addEventListener('visibilitychange', signal);
      signal();
    })();
    """#
}
