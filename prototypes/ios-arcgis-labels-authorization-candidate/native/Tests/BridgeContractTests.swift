import XCTest
import Capacitor
@testable import GridlyLabelsAuthorizationCandidate

@MainActor
final class BridgeContractTests: XCTestCase {
    func testExistingCapacitorMethodNamesRemainUnchanged() {
        let store = GridlyStoreKitPlugin(), attest = GridlyAppAttestPlugin()
        XCTAssertEqual(store.identifier, "GridlyStoreKitPlugin")
        XCTAssertEqual(store.jsName, "GridlyStoreKit")
        XCTAssertEqual(store.pluginMethods.compactMap { $0.name }, ["getProducts", "purchase", "getCurrentEntitlement",
            "restorePurchases", "refreshEntitlement", "finishTransaction", "startObserving", "stopObserving"])
        XCTAssertEqual(attest.identifier, "GridlyAppAttestPlugin")
        XCTAssertEqual(attest.jsName, "GridlyAppAttest")
        XCTAssertEqual(attest.pluginMethods.compactMap { $0.name }, ["isSupported", "authorize", "confirm"])
    }

    func testNativeEvidencePortsReuseTheActualBridgeInstances() {
        let store = GridlyStoreKitPlugin(), attest = GridlyAppAttestPlugin()
        let storePort: any LabelsStoreEvidenceProvider = store
        let attestPort: any LabelsAttestEvidenceProvider = attest
        XCTAssertTrue((storePort as AnyObject) === store)
        XCTAssertTrue((attestPort as AnyObject) === attest)
        // Do not call StoreKit/DeviceCheck. This test checks identity and conformance only.
    }
}
