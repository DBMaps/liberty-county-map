#if GRIDLY_BUILD18_DIAGNOSTIC && GRIDLY_ARCGIS_DIAGNOSTIC
import UIKit

// This branch is for the owner's internal TestFlight accounts only.
// The live adapter entry point remains unwired until a private handoff is approved.
final class GridlyBuild18DiagnosticViewController: UIViewController {
    private static let gestureName = "GridlyBuild18OwnerDiagnostic"
    private static let syntheticRun = "owner-5b3712894b9a414db71a3a8cbcae1207"
    private var diagnostic: GridlyLabelDiagnostic?
    private let content = UIStackView()
    private let status = UILabel()
    private let prepare = UIButton(type: .system)
    private let arm = UIButton(type: .system)
    private let request = UIButton(type: .system)

    static func install(on owner: GridlyBridgeViewController) {
        guard Bundle.main.bundleIdentifier == "com.gridlygo.gridly",
              Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String == "18",
              Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String == "1.0.2",
              let view = owner.viewIfLoaded,
              view.gestureRecognizers?.contains(where: { $0.name == gestureName }) != true else { return }
        let gesture = UILongPressGestureRecognizer(target: owner, action: #selector(GridlyBridgeViewController.openBuild18Diagnostic(_:)))
        gesture.name = gestureName
        gesture.numberOfTouchesRequired = 2
        gesture.minimumPressDuration = 3
        gesture.cancelsTouchesInView = false
        gesture.delaysTouchesBegan = false
        gesture.delaysTouchesEnded = false
        view.addGestureRecognizer(gesture)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        content.axis = .vertical
        content.spacing = 12
        content.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(content)
        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            content.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor)
        ])
        status.text = "Synthetic diagnostic off"
        status.numberOfLines = 0
        content.addArrangedSubview(status)
        configure(prepare, "Prepare synthetic run", #selector(prepareRun))
        configure(arm, "Arm", #selector(armRun))
        configure(request, "Request synthetic tile", #selector(requestTile))
        configure(UIButton(type: .system), "Close", #selector(close))
        arm.isEnabled = false
        request.isEnabled = false
    }

    private func configure(_ button: UIButton, _ title: String, _ action: Selector) {
        button.setTitle(title, for: .normal)
        button.addTarget(self, action: action, for: .touchUpInside)
        content.addArrangedSubview(button)
    }

    @objc private func prepareRun() {
        guard UIApplication.shared.applicationState == .active, diagnostic == nil else { return }
        prepare.isEnabled = false
        let mode = GridlyLabelDiagnostic.mode
        do {
            try GridlyLabelDiagnostic.provision(run: Self.syntheticRun, mode: mode)
            let adapter = try GridlyLabelDiagnostic(run: Self.syntheticRun, mode: mode, candidate: "SYNTHETIC_BUILD18_LABELS")
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            let png = UIGraphicsImageRenderer(size: CGSize(width: 512, height: 512), format: format).pngData { context in
                UIColor.systemBlue.setFill()
                context.fill(CGRect(x: 0, y: 0, width: 512, height: 512))
            }
            guard adapter.selectSyntheticTransport({ png }) else { adapter.stop(); return }
            diagnostic = adapter
            adapter.prepareFixture { [weak self] fixture, state in
                guard let self = self, self.viewIfLoaded?.window != nil else { return }
                self.status.text = state
                guard let fixture = fixture else { adapter.stop(); return }
                fixture.heightAnchor.constraint(equalToConstant: 80).isActive = true
                self.content.insertArrangedSubview(fixture, at: 1)
                self.arm.isEnabled = true
            }
        } catch {
            status.text = "SYNTHETIC_RUN_UNAVAILABLE"
        }
    }

    @objc private func armRun() {
        arm.isEnabled = false
        diagnostic?.arm { [weak self] state in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.status.text = state
                self.arm.isEnabled = state == "ARM_REJECTED"
                self.request.isEnabled = state == "ARMED"
            }
        }
    }

    @objc private func requestTile() {
        guard UIApplication.shared.applicationState == .active else { return }
        request.isEnabled = false
        diagnostic?.requestTile(zoom: 0, row: 0, column: 0) { [weak self] _, state in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.status.text = state
                self.request.isEnabled = state == "SYNTHETIC_PASS"
            }
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        diagnostic?.stop()
        super.viewWillDisappear(animated)
    }

    @objc private func close() {
        diagnostic?.stop()
        dismiss(animated: true)
    }
}

extension GridlyBridgeViewController {
    @objc func openBuild18Diagnostic(_ gesture: UILongPressGestureRecognizer) {
        guard gesture.state == .began, UIApplication.shared.applicationState == .active,
              viewIfLoaded?.window != nil, presentedViewController == nil else { return }
        let controller = GridlyBuild18DiagnosticViewController()
        controller.modalPresentationStyle = .fullScreen
        present(controller, animated: true)
    }
}
#endif
