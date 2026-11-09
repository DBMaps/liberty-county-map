#if GRIDLY_BUILD18_DIAGNOSTIC && GRIDLY_ARCGIS_DIAGNOSTIC
import UIKit
import UniformTypeIdentifiers

// This branch is for the owner's internal TestFlight accounts only.
final class GridlyBuild18DiagnosticViewController: UIViewController, UIDocumentPickerDelegate {
    private static let gestureName = "GridlyBuild18OwnerDiagnostic"
    private static let syntheticRun = "owner-5b3712894b9a414db71a3a8cbcae1207"
    private var diagnostic: GridlyLabelDiagnostic?
    private let content = UIStackView()
    private let status = UILabel()
    private let prepare = UIButton(type: .system)
    private let importCandidate = UIButton(type: .system)
    private let runLabel = UILabel()
    private let arm = UIButton(type: .system)
    private let request = UIButton(type: .system)
    private var pickerSession: UUID?
    private var pendingEnvelope: Data?
    private var approvedRun: String?
    private var isPrivateRun = false
    private weak var grantAlert: UIAlertController?

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
        status.text = "Diagnostic off"
        status.numberOfLines = 0
        content.addArrangedSubview(status)
        configure(prepare, "Prepare synthetic run", #selector(prepareRun))
        #if !targetEnvironment(simulator)
        if GridlyBuild18Candidate.verificationKey(in: .main) != nil {
            runLabel.numberOfLines = 0
            content.addArrangedSubview(runLabel)
            createRun()
            configure(importCandidate, "Select encrypted candidate", #selector(pickCandidate))
        }
        #endif
        configure(arm, "Arm", #selector(armRun))
        configure(request, "Request synthetic tile", #selector(requestTile))
        configure(UIButton(type: .system), "Close", #selector(close))
        arm.isEnabled = false
        request.isEnabled = false
        NotificationCenter.default.addObserver(self, selector: #selector(resignActiveNotification(_:)),
                                               name: UIApplication.willResignActiveNotification, object: nil)
    }

    private func createRun() {
        let run = "owner-" + UUID().uuidString.lowercased().replacingOccurrences(of: "-", with: "")
        approvedRun = run
        runLabel.text = "Owner run: \(run)"
    }

    private func configure(_ button: UIButton, _ title: String, _ action: Selector) {
        button.setTitle(title, for: .normal)
        button.addTarget(self, action: action, for: .touchUpInside)
        content.addArrangedSubview(button)
    }

    @objc private func prepareRun() {
        guard UIApplication.shared.applicationState == .active, diagnostic == nil else { return }
        prepare.isEnabled = false
        importCandidate.isEnabled = false
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
            showFixture(adapter)
        } catch {
            status.text = "SYNTHETIC_RUN_UNAVAILABLE"
        }
    }

    @objc private func pickCandidate() {
        guard UIApplication.shared.applicationState == .active, diagnostic == nil,
              pickerSession == nil, pendingEnvelope == nil else { return }
        pickerSession = UUID()
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.data], asCopy: false)
        picker.allowsMultipleSelection = false
        picker.delegate = self
        present(picker, animated: true)
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pickerSession = nil
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let selection = pickerSession else { return }
        guard urls.count == 1, let selected = urls.first,
              UIApplication.shared.applicationState == .active, diagnostic == nil else {
            pickerSession = nil
            rejectImport()
            return
        }
        prepare.isEnabled = false
        importCandidate.isEnabled = false
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let envelope = try? GridlyBuild18Candidate.readPickedFile(selected)
            DispatchQueue.main.async {
                guard let self = self, self.pickerSession == selection,
                      UIApplication.shared.applicationState == .active, self.viewIfLoaded?.window != nil else { return }
                self.pickerSession = nil
                guard let envelope = envelope else { self.rejectImport(); return }
                self.pendingEnvelope = envelope
                if self.presentedViewController === controller {
                    controller.dismiss(animated: true) { [weak self] in self?.promptForGrant() }
                } else {
                    self.promptForGrant()
                }
            }
        }
    }

    private func promptForGrant() {
        guard pendingEnvelope != nil, UIApplication.shared.applicationState == .active,
              viewIfLoaded?.window != nil, presentedViewController == nil else { rejectImport(); return }
        let alert = UIAlertController(title: "Owner diagnostic grant",
                                      message: "Import for this foreground session. A separate Arm tap is required before either native request.",
                                      preferredStyle: .alert)
        alert.addTextField {
            $0.isSecureTextEntry = true
            $0.keyboardType = .asciiCapable
            $0.autocapitalizationType = .none
            $0.autocorrectionType = .no
            $0.spellCheckingType = .no
            $0.placeholder = "One-time owner grant"
        }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { [weak self, weak alert] _ in
            alert?.textFields?.first?.text = nil
            self?.rejectImport()
        })
        alert.addAction(UIAlertAction(title: "Approve native diagnostic", style: .default) { [weak self, weak alert] _ in
            guard let field = alert?.textFields?.first, let grant = field.text else { self?.rejectImport(); return }
            field.text = nil
            self?.acceptGrant(grant)
        })
        grantAlert = alert
        present(alert, animated: true)
    }

    private func acceptGrant(_ grant: String) {
        defer { pendingEnvelope = nil }
        guard UIApplication.shared.applicationState == .active, diagnostic == nil,
              let envelope = pendingEnvelope, let run = approvedRun,
              let owner = GridlyBuild18Candidate.verificationKey(in: .main) else { rejectImport(); return }
        do {
            var unlocked = try GridlyBuild18Candidate.open(envelope, grant: grant, identity: .init(bundle: .main),
                                                           expectedRun: run, ownerPublicKey: owner)
            defer { unlocked.token.resetBytes(in: 0..<unlocked.token.count) }
            let mode = GridlyLabelDiagnostic.mode
            // O_EXCL is also the durable import receipt. Reopening the same run cannot
            // reset the ledger, even if no request was made or the app was killed.
            try GridlyLabelDiagnostic.provision(run: unlocked.run, mode: mode)
            let adapter = try GridlyLabelDiagnostic(run: unlocked.run, mode: mode, candidateBytes: unlocked.token)
            guard adapter.authorizeProviderTransport("OWNER_TWO_REQUEST_NATIVE_PROVIDER_TEST", expires: unlocked.expires) else {
                adapter.stop()
                rejectImport()
                return
            }
            isPrivateRun = true
            request.setTitle("Request Dayton labels tile", for: .normal)
            showFixture(adapter)
        } catch {
            rejectImport()
        }
    }

    private func rejectImport() {
        pendingEnvelope = nil
        status.text = "PRIVATE_IMPORT_UNAVAILABLE"
        prepare.isEnabled = diagnostic == nil
        importCandidate.isEnabled = diagnostic == nil
    }

    private func showFixture(_ adapter: GridlyLabelDiagnostic) {
        diagnostic = adapter
        adapter.prepareFixture { [weak self, weak adapter] fixture, state in
            guard let self = self, let adapter = adapter, self.diagnostic === adapter,
                  self.viewIfLoaded?.window != nil, UIApplication.shared.applicationState == .active else {
                adapter?.stop()
                return
            }
            self.status.text = state
            guard let fixture = fixture else { adapter.stop(); return }
            fixture.heightAnchor.constraint(equalToConstant: 80).isActive = true
            self.content.insertArrangedSubview(fixture, at: 1)
            self.arm.isEnabled = true
        }
    }

    @objc private func armRun() {
        arm.isEnabled = false
        diagnostic?.arm { [weak self] state in
            DispatchQueue.main.async {
                guard let self = self, UIApplication.shared.applicationState == .active else { return }
                self.status.text = state
                self.arm.isEnabled = state == "ARM_REJECTED"
                self.request.isEnabled = state == "ARMED"
            }
        }
    }

    @objc private func requestTile() {
        guard UIApplication.shared.applicationState == .active else { return }
        request.isEnabled = false
        let live = isPrivateRun
        diagnostic?.requestTile(zoom: live ? 12 : 0, row: live ? 1689 : 0, column: live ? 968 : 0) { [weak self] _, state in
            DispatchQueue.main.async {
                guard let self = self, UIApplication.shared.applicationState == .active else { return }
                self.status.text = state
                self.request.isEnabled = state == "SYNTHETIC_PASS" || state == "PASS"
            }
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        diagnostic?.stop()
        super.viewWillDisappear(animated)
    }

    @objc private func resignActiveNotification(_ notification: Notification) {
        resignActive()
    }

    private func resignActive() {
        pickerSession = nil
        pendingEnvelope = nil
        grantAlert?.textFields?.first?.text = nil
        grantAlert?.dismiss(animated: false)
        diagnostic?.stop()
        arm.isEnabled = false
        request.isEnabled = false
        if diagnostic == nil {
            // Retain only the public challenge so the owner can place the
            // encrypted file in local Files before importing in the foreground.
            rejectImport()
        } else {
            status.text = "STOPPED"
        }
    }

    @objc private func close() {
        resignActive()
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
