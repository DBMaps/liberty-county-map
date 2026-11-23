import Foundation
import Capacitor
import StoreKit
import UIKit

// Evidence is transient. No native state grants Gridly paid access.
@objc(GridlyStoreKitPlugin)
public class GridlyStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GridlyStoreKitPlugin"
    public let jsName = "GridlyStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
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
    @objc func getProducts(_ call: CAPPluginCall) { Task { @MainActor in call.resolve(await state.products()) } }
    @objc func purchase(_ call: CAPPluginCall) { Task { @MainActor in call.resolve(await state.purchase()) } }
    @objc func getCurrentEntitlement(_ call: CAPPluginCall) { Task { @MainActor in call.resolve(await state.current()) } }
    @objc func refreshEntitlement(_ call: CAPPluginCall) { Task { @MainActor in call.resolve(await state.current()) } }
    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard call.getBool("userInitiated") == true else { call.resolve(state.resultError("unknown")); return }
            do { try await AppStore.sync(); call.resolve(await state.current()) }
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
    func resultError(_ category: String) -> [String: Any] { ["result": "error", "state": "unknown", "errorCategory": category] }

    @MainActor private func product() async throws -> Product {
        let items = try await Product.products(for: [Self.productID])
        guard items.count == 1, let item = items.first, item.id == Self.productID,
              item.type == .autoRenewable, let subscription = item.subscription,
              subscription.subscriptionPeriod.unit == .month, subscription.subscriptionPeriod.value == 1,
              subscription.introductoryOffer == nil, subscription.promotionalOffers.isEmpty,
              let storefront = await Storefront.current, storefront.countryCode == "USA" else { throw BridgeFailure.unavailable }
        return item
    }
    @MainActor func products() async -> [String: Any] {
        do {
            let item = try await product()
            return ["result": "available", "productId": item.id, "displayName": item.displayName,
                    "displayPrice": item.displayPrice, "currency": item.priceFormatStyle.currencyCode,
                    "billingPeriod": "P1M", "storefront": "US", "hasOffer": false]
        } catch { return resultError("product_unavailable") }
    }
    @MainActor func purchase() async -> [String: Any] {
        guard !purchasing else { return resultError("store_unavailable") }
        purchasing = true
        defer { purchasing = false }
        do {
            let item = try await product()
            switch try await item.purchase() {
            case .success(let verified): return await evidence(verified)
            case .userCancelled: return ["result": "user_cancelled", "errorCategory": "user_cancelled"]
            case .pending: return ["result": "purchase_pending", "errorCategory": "purchase_pending"]
            @unknown default: return resultError("unknown")
            }
        } catch { return resultError("store_unavailable") }
    }
    @MainActor func current() async -> [String: Any] {
        var candidate: VerificationResult<Transaction>?
        for await result in Transaction.currentEntitlements {
            switch result {
            case .verified(let transaction):
                if transaction.productID == Self.productID {
                    guard candidate == nil else { return resultError("unknown") }
                    candidate = result
                }
            case .unverified(let transaction, _):
                if transaction.productID == Self.productID { return resultError("verification_failed") }
            }
        }
        // Current entitlements omit expired/revoked purchases; latest is evidence, never access.
        if candidate == nil { candidate = await Transaction.latest(for: Self.productID) }
        guard let result = candidate else { return ["result": "no_evidence", "state": "not_entitled", "errorCategory": "not_entitled"] }
        return await evidence(result)
    }
    @MainActor private func evidence(_ result: VerificationResult<Transaction>) async -> [String: Any] {
        guard case .verified(let transaction) = result, transaction.productID == Self.productID,
              transaction.productType == .autoRenewable, transaction.ownershipType == .purchased,
              let expiration = transaction.expirationDate else { return resultError("verification_failed") }
        let environment: String
        switch transaction.environment {
        case .production: environment = "production"
        case .sandbox, .xcode: environment = "sandbox/test"
        default: return resultError("verification_failed")
        }
        var hint = "unknown"
        if transaction.revocationDate != nil { hint = "not_entitled" }
        else if expiration <= Date() { hint = "expired" }
        else {
            do {
                let item = try await product()
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
        guard existing != nil || completions.count < 16 else { return resultError("store_unavailable") }
        let handle = existing ?? UUID().uuidString
        completions[handle] = transaction
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
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
