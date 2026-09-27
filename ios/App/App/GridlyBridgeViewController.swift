import Capacitor

@objc(GridlyBridgeViewController)
class GridlyBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GridlyStoreKitPlugin())
    }
}
