import Foundation
import Capacitor
import StoreKit
import UIKit

// BEGIN TESTABLE STORE DIAGNOSTICS
// No persistence, raw errors, transaction values or network logging.
struct GridlyStoreDiagnosticPolicy {
    static var enabled: Bool {
#if GRIDLY_STOREKIT_DIAGNOSTICS
        return Bundle.main.bundleIdentifier == "com.gridlygo.gridly" &&
            (Int(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "") ?? 0) > 14
#else
        return false
#endif
    }
    static let stages: Set<String> = ["native_entry", "product_fetch", "product_validation", "purchase_call", "purchase_result", "restore_sync", "current_enumeration", "latest_lookup", "native_evidence"]
    static let outcomes: Set<String> = ["started", "returned", "passed", "failed", "accepted", "rejected", "success", "cancelled", "pending", "unknown", "none", "match", "multiple", "unverified", "busy", "count_rejected", "id_rejected", "type_rejected", "period_rejected", "offers_rejected", "storefront_rejected"]
    static func numericCode(_ failure: Error) -> Int? {
        let value = failure as NSError
        guard ["SKErrorDomain", NSURLErrorDomain].contains(value.domain),
              (-65536...65535).contains(value.code) else { return nil }
        return value.code
    }
    static func payload(enabled: Bool, attempt: Int, action: String, stage: String, outcome: String, failure: Error? = nil) -> [String: Any]? {
        guard enabled, (1...1000000).contains(attempt),
              ["startup", "launch", "refresh", "purchase", "restore"].contains(action),
              stages.contains(stage), outcomes.contains(outcome) else { return nil }
        var value: [String: Any] = ["attempt": attempt, "action": action, "stage": stage, "outcome": outcome]
        if let failure = failure, let code = numericCode(failure) { value["errorCode"] = code }
        return value
    }
}
// END TESTABLE STORE DIAGNOSTICS

// Evidence is transient. No native state grants Gridly paid access.
@objc(GridlyStoreKitPlugin)
public class GridlyStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GridlyStoreKitPlugin"
    public let jsName = "GridlyStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "diagnosticConfiguration", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCurrentEntitlement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refreshEntitlement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finishTransaction", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startObserving", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopObserving", returnType: CAPPluginReturnPromise)
    ]
    private let state = GridlyStoreKitState()
    private var observingForeground = false
    @objc func diagnosticConfiguration(_ call: CAPPluginCall) {
        Task { @MainActor [self] in
            if GridlyStoreDiagnosticPolicy.enabled {
                state.diagnosticSink = { [weak self] value in self?.notifyListeners("storeDiagnostic", data: value) }
            }
            call.resolve(["enabled": GridlyStoreDiagnosticPolicy.enabled])
        }
    }
    @objc func getProducts(_ call: CAPPluginCall) { Task { @MainActor in call.resolve(await state.products(call.getInt("diagnosticAttempt") ?? 0)) } }
    @objc func purchase(_ call: CAPPluginCall) { Task { @MainActor in call.resolve(await state.purchase(call.getInt("diagnosticAttempt") ?? 0)) } }
    @objc func getCurrentEntitlement(_ call: CAPPluginCall) { Task { @MainActor in call.resolve(await state.current(call.getInt("diagnosticAttempt") ?? 0, "launch")) } }
    @objc func refreshEntitlement(_ call: CAPPluginCall) { Task { @MainActor in call.resolve(await state.current(call.getInt("diagnosticAttempt") ?? 0, "refresh")) } }
    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard call.getBool("userInitiated") == true else { call.resolve(state.resultError("unknown")); return }
            let attempt = call.getInt("diagnosticAttempt") ?? 0
            state.diagnostic(attempt, "restore", "native_entry", "started")
            do {
                try await state.step(attempt, "restore", "restore_sync") { try await AppStore.sync() }
                call.resolve(await state.current(attempt, "restore"))
            }
            catch { call.resolve(state.resultError("store_unavailable")) }
        }
    }
    @objc func finishTransaction(_ call: CAPPluginCall) {
        Task { @MainActor in call.resolve(await state.finish(call.getString("completionHandle"))) }
    }
    @objc func startObserving(_ call: CAPPluginCall) {
        Task { @MainActor [self] in
            state.observe { [weak self] in
                // Signal only: no transaction ID, signed payload or account data in events.
                self?.notifyListeners("transactionUpdate", data: ["reason": "store_transaction_update"])
            }
            if !observingForeground {
                NotificationCenter.default.addObserver(self, selector: #selector(appDidBecomeActive(_:)), name: UIApplication.didBecomeActiveNotification, object: nil)
                observingForeground = true
            }
            call.resolve(["observing": true])
        }
    }
    @objc func stopObserving(_ call: CAPPluginCall) { Task { @MainActor in
        state.stop()
        NotificationCenter.default.removeObserver(self, name: UIApplication.didBecomeActiveNotification, object: nil)
        observingForeground = false
        call.resolve(["observing": false])
    } }
    @objc private func appDidBecomeActive(_ notification: Notification) {
        // No Notification or non-Sendable plugin enters a Foundation @Sendable block.
        Task { @MainActor [weak self] in
            self?.notifyListeners("appForeground", data: ["reason": "app_foreground"])
        }
    }
    deinit { NotificationCenter.default.removeObserver(self, name: UIApplication.didBecomeActiveNotification, object: nil) }
}

private final class GridlyStoreKitState {
    static let productID = "com.gridlygo.gridly.monthly"
    private var completions: [String: Transaction] = [:]
    private var observer: Task<Void, Never>?
    private var purchasing = false
    var diagnosticSink: (([String: Any]) -> Void)?
    @MainActor func diagnostic(_ attempt: Int, _ action: String, _ stage: String, _ outcome: String, _ failure: Error? = nil) {
        if let value = GridlyStoreDiagnosticPolicy.payload(enabled: GridlyStoreDiagnosticPolicy.enabled, attempt: attempt, action: action, stage: stage, outcome: outcome, failure: failure) { diagnosticSink?(value) }
    }
    @MainActor func step<T>(_ attempt: Int, _ action: String, _ stage: String, work: () async throws -> T) async throws -> T {
        diagnostic(attempt, action, stage, "started")
        do {
            let result = try await work()
            diagnostic(attempt, action, stage, "returned")
            return result
        } catch {
            diagnostic(attempt, action, stage, "failed", error)
            throw error
        }
    }
    @MainActor private func validate(_ condition: Bool, _ rejection: String, _ attempt: Int, _ action: String) throws {
        if !condition { diagnostic(attempt, action, "product_validation", rejection); throw BridgeFailure.unavailable }
    }
    func resultError(_ category: String) -> [String: Any] { ["result": "error", "state": "unknown", "errorCategory": category] }

    @MainActor private func product(_ attempt: Int = 0, _ action: String = "refresh") async throws -> Product {
        let items = try await step(attempt, action, "product_fetch") { try await Product.products(for: [Self.productID]) }
        diagnostic(attempt, action, "product_validation", "started")
        try validate(items.count == 1, "count_rejected", attempt, action)
        guard let item = items.first else { throw BridgeFailure.unavailable }
        try validate(item.id == Self.productID, "id_rejected", attempt, action)
        try validate(item.type == .autoRenewable, "type_rejected", attempt, action)
        guard let subscription = item.subscription else { diagnostic(attempt, action, "product_validation", "type_rejected"); throw BridgeFailure.unavailable }
        try validate(subscription.subscriptionPeriod.unit == .month && subscription.subscriptionPeriod.value == 1, "period_rejected", attempt, action)
        try validate(subscription.introductoryOffer == nil && subscription.promotionalOffers.isEmpty, "offers_rejected", attempt, action)
        guard let storefront = await Storefront.current, storefront.countryCode == "USA" else { diagnostic(attempt, action, "product_validation", "storefront_rejected"); throw BridgeFailure.unavailable }
        diagnostic(attempt, action, "product_validation", "passed")
        return item
    }
    @MainActor func products(_ attempt: Int = 0) async -> [String: Any] {
        do {
            let item = try await product(attempt, "startup")
            return ["result": "available", "productId": item.id, "displayName": item.displayName,
                    "displayPrice": item.displayPrice, "currency": item.priceFormatStyle.currencyCode,
                    "billingPeriod": "P1M", "storefront": "US", "hasOffer": false]
        } catch { return resultError("product_unavailable") }
    }
    @MainActor func purchase(_ attempt: Int = 0) async -> [String: Any] {
        diagnostic(attempt, "purchase", "native_entry", "started")
        guard !purchasing else { diagnostic(attempt, "purchase", "native_entry", "busy"); return resultError("store_unavailable") }
        purchasing = true
        defer { purchasing = false }
        do {
            let item = try await product(attempt, "purchase")
            switch try await step(attempt, "purchase", "purchase_call", work: { try await item.purchase() }) {
            case .success(let verified): diagnostic(attempt, "purchase", "purchase_result", "success"); return await evidence(verified, attempt, "purchase")
            case .userCancelled: diagnostic(attempt, "purchase", "purchase_result", "cancelled"); return ["result": "user_cancelled", "errorCategory": "user_cancelled"]
            case .pending: diagnostic(attempt, "purchase", "purchase_result", "pending"); return ["result": "purchase_pending", "errorCategory": "purchase_pending"]
            @unknown default: diagnostic(attempt, "purchase", "purchase_result", "unknown"); return resultError("unknown")
            }
        } catch { return resultError("store_unavailable") }
    }
    @MainActor func current(_ attempt: Int = 0, _ action: String = "refresh") async -> [String: Any] {
        diagnostic(attempt, action, "current_enumeration", "started")
        var candidate: VerificationResult<Transaction>?
        for await result in Transaction.currentEntitlements {
            switch result {
            case .verified(let transaction):
                if transaction.productID == Self.productID {
                    guard candidate == nil else { diagnostic(attempt, action, "current_enumeration", "multiple"); return resultError("unknown") }
                    candidate = result
                }
            case .unverified(let transaction, _):
                if transaction.productID == Self.productID { diagnostic(attempt, action, "current_enumeration", "unverified"); return resultError("verification_failed") }
            }
        }
        // Current entitlements omit expired/revoked purchases; latest is evidence, never access.
        diagnostic(attempt, action, "current_enumeration", candidate == nil ? "none" : "match")
        if candidate == nil {
            diagnostic(attempt, action, "latest_lookup", "started")
            candidate = await Transaction.latest(for: Self.productID)
            diagnostic(attempt, action, "latest_lookup", candidate == nil ? "none" : "match")
        }
        guard let result = candidate else { return ["result": "no_evidence", "state": "not_entitled", "errorCategory": "not_entitled"] }
        return await evidence(result, attempt, action)
    }
    @MainActor private func evidence(_ result: VerificationResult<Transaction>, _ attempt: Int = 0, _ action: String = "refresh") async -> [String: Any] {
        diagnostic(attempt, action, "native_evidence", "started")
        guard case .verified(let transaction) = result, transaction.productID == Self.productID,
              transaction.productType == .autoRenewable, transaction.ownershipType == .purchased,
              let expiration = transaction.expirationDate else { diagnostic(attempt, action, "native_evidence", "rejected"); return resultError("verification_failed") }
        let environment: String
        switch transaction.environment {
        case .production: environment = "production"
        case .sandbox, .xcode: environment = "sandbox/test"
        default: diagnostic(attempt, action, "native_evidence", "rejected"); return resultError("verification_failed")
        }
        var hint = "unknown"
        if transaction.revocationDate != nil { hint = "not_entitled" }
        else if expiration <= Date() { hint = "expired" }
        else {
            do {
                let item = try await product(attempt, action)
                if let statuses = try await item.subscription?.status {
                    for status in statuses {
                        guard case .verified(let current) = status.transaction, current.id == transaction.id,
                              case .verified(let renewal) = status.renewalInfo,
                              renewal.currentProductID == Self.productID else { continue }
                        switch status.state {
                        case .subscribed: hint = renewal.willAutoRenew ? "active" : "canceled_pending_expiry"
                        case .expired: hint = "expired"
                        case .revoked, .inBillingRetryPeriod: hint = "not_entitled"
                        default: hint = "unknown" // No launch billing grace.
                        }
                    }
                }
            } catch { hint = "unknown" }
        }
        let existing = completions.first(where: { $0.value.id == transaction.id })?.key
        guard existing != nil || completions.count < 16 else { diagnostic(attempt, action, "native_evidence", "busy"); return resultError("store_unavailable") }
        let handle = existing ?? UUID().uuidString
        completions[handle] = transaction
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        diagnostic(attempt, action, "native_evidence", "accepted")
        return ["result": "verified", "productId": Self.productID, "environment": environment,
                "state": hint, "expiresAt": formatter.string(from: expiration),
                "revoked": transaction.revocationDate != nil, "completionHandle": handle,
                "signedTransaction": result.jwsRepresentation]
    }
    @MainActor func finish(_ handle: String?) async -> [String: Any] {
        // Trusted coordinator calls only after verifying nonce-bound server proof.
        guard let handle = handle, let transaction = completions[handle] else { return resultError("verification_failed") }
        await transaction.finish()
        completions.removeValue(forKey: handle)
        return ["finished": true]
    }
    @MainActor func observe(_ signal: @escaping @MainActor () -> Void) {
        guard observer == nil else { return }
        observer = Task { @MainActor in
            for await result in Transaction.updates {
                if Task.isCancelled { return }
                switch result {
                case .verified(let transaction), .unverified(let transaction, _):
                    if transaction.productID == Self.productID { signal() }
                }
            }
        }
    }
    @MainActor func stop() { observer?.cancel(); observer = nil; completions.removeAll() }
    deinit { observer?.cancel() }
    private enum BridgeFailure: Error { case unavailable }
}
