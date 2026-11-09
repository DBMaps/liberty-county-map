// All tests use synthetic state and never create a network connection.
import XCTest
import Darwin
import Foundation
import UIKit
import WebKit
@testable import App

final class Build18DiagnosticTests: XCTestCase {
    func testCandidateInteropAndBindingFailures() throws {
        // Fixed Node AES-GCM vector, exclusively synthetic. No real credential is used.
        let envelope = try XCTUnwrap(Data(base64Encoded: "JCQkJCQkJCQkJCQkJKb9ddvz8w0W2Cj55HzH7imvejPp6QUk/OD9YgmXokNOShLAMAHkSOCGOwSwQJwwQKmqBrZRg/Q="))
        let run = "owner-0123456789abcdef0123456789abcdef"
        let digest = "a8f2ff7a16c2cd0287bcad92ce97d37dc23aebbbe3b45ef3abf2c408d6d17f49"
        let key = String(repeating: "42", count: 32)
        let signature = "b74a18e465b2313097b438c28e081e0af55ecb925c1d837814af24b55cadf1bb99cc215008d4e6c1a1bb979f118c685a4be06066de530c9f577af498fdf1ab05"
        let publicKey = "8ca63145907a2e6c5fb3dc0791c0189b8252da3e4143704b3b2ca4e526f25dd1"
        let grant = "\(run).\(digest).\(key).\(signature)"
        let now = Date(timeIntervalSince1970: 1794255000)
        func unlock(_ bytes: Data? = nil, _ input: String? = nil,
                    identity: GridlyBuild18Candidate.Identity = .expected,
                    owner: String? = nil, at time: Date? = nil) throws -> GridlyBuild18Candidate.Unlocked {
            try GridlyBuild18Candidate.open(bytes ?? envelope, grant: input ?? grant, identity: identity,
                                            expectedRun: run, ownerPublicKey: owner ?? publicKey, now: time ?? now)
        }
        let candidate = try unlock()
        XCTAssertEqual(candidate.run, run)
        XCTAssertEqual(candidate.token, Data("SYNTHETIC_BUILD18_REPLACEMENT".utf8))
        XCTAssertEqual(candidate.expires.timeIntervalSince(now), 300)
        for invalid in [
            "", "\(run).\(digest).\(String(repeating: "43", count: 32)).\(signature)",
            "owner-\(String(repeating: "0", count: 32)).\(digest).\(key).\(signature)",
            "\(run).\(String(repeating: "0", count: 64)).\(key).\(signature)",
            "\(run).\(digest).\(key).\(String(repeating: "0", count: 128))"
        ] {
            XCTAssertThrowsError(try unlock(envelope, invalid))
        }
        let oldBuild = GridlyBuild18Candidate.Identity(bundleID: "com.gridlygo.gridly", version: "1.0.2", build: "17")
        XCTAssertThrowsError(try unlock(identity: oldBuild))
        let foreign = GridlyBuild18Candidate.Identity(bundleID: "example.invalid", version: "1.0.2", build: "18")
        XCTAssertThrowsError(try unlock(identity: foreign))
        XCTAssertThrowsError(try unlock(owner: ""))
        XCTAssertThrowsError(try GridlyBuild18Candidate.open(envelope, grant: grant, identity: .expected,
            expectedRun: "owner-" + String(repeating: "0", count: 32), ownerPublicKey: publicKey, now: now))
        XCTAssertThrowsError(try unlock(at: candidate.expires))
        var tampered = envelope
        tampered[tampered.count - 1] ^= 1
        XCTAssertThrowsError(try unlock(tampered))
    }

    func testLocalCandidateReadRejectsSymlinkHardLinkPermissionsAndSize() throws {
        let fm = FileManager.default
        let root = fm.temporaryDirectory.resolvingSymlinksInPath().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fm.createDirectory(at: root, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: root) }
        let file = root.appendingPathComponent("candidate.gridlycandidate")
        let symlink = root.appendingPathComponent("alias.gridlycandidate")
        let hardlink = root.appendingPathComponent("hard.gridlycandidate")
        let bytes = Data(repeating: 42, count: 64)
        try bytes.write(to: file)
        try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
        XCTAssertEqual(try GridlyBuild18Candidate.readLocalFile(file), bytes)
        try fm.createSymbolicLink(at: symlink, withDestinationURL: file)
        XCTAssertThrowsError(try GridlyBuild18Candidate.readLocalFile(symlink))
        try fm.linkItem(at: file, to: hardlink)
        XCTAssertThrowsError(try GridlyBuild18Candidate.readLocalFile(file))
        try fm.removeItem(at: hardlink)
        try fm.setAttributes([.posixPermissions: 0o666], ofItemAtPath: file.path)
        XCTAssertThrowsError(try GridlyBuild18Candidate.readLocalFile(file))
        try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
        try Data(repeating: 42, count: GridlyBuild18Candidate.maxFileBytes + 1).write(to: file)
        XCTAssertThrowsError(try GridlyBuild18Candidate.readLocalFile(file))
    }

    func testAlreadyProvisionedRunCannotBeImportedAgainBeforeAnyRequest() throws {
        let run = try makeRun()
        XCTAssertThrowsError(try GridlyLabelDiagnostic.provision(run: run.id, mode: GridlyLabelDiagnostic.mode))
    }

    func testActualAdapterStartsOffArmsAndStopsAtTwoSyntheticRequests() throws {
        let run = try makeRun()
        let adapter = try GridlyLabelDiagnostic(run: run.id, mode: GridlyLabelDiagnostic.mode, candidate: "SYNTHETIC_BUILD18_LABELS")
        let finished = expectation(description: "synthetic sequence reached the third-request denial")
        func request(_ expected: String, _ next: @escaping () -> Void) {
            adapter.requestTile(zoom: 0, row: 0, column: 0) { _, state in
                XCTAssertEqual(state, expected)
                DispatchQueue.main.async(execute: next)
            }
        }
        func arm(_ attempts: Int) {
            adapter.arm { state in
                DispatchQueue.main.async {
                    if state == "ARM_REJECTED" && attempts > 0 {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { arm(attempts - 1) }
                    } else if state == "ARMED" {
                        request("SYNTHETIC_PASS") {
                            request("SYNTHETIC_PASS") {
                                request("BLOCKED") {
                                    adapter.evidence { rows in
                                        XCTAssertEqual(rows.map { $0.request }, [1, 2])
                                        XCTAssertTrue(rows.allSatisfy { $0.context == "SYNTHETIC_TRANSPORT" &&
                                            $0.documentOrigin == "capacitor://localhost" && $0.tileValidity == "SYNTHETIC_DECODE_512_PASS" })
                                        finished.fulfill()
                                    }
                                }
                            }
                        }
                    } else {
                        XCTFail("Fixture did not arm")
                        finished.fulfill()
                    }
                }
            }
        }
        DispatchQueue.main.async {
            request("BLOCKED") {
                let format = UIGraphicsImageRendererFormat()
                format.scale = 1
                let png = UIGraphicsImageRenderer(size: CGSize(width: 512, height: 512), format: format).pngData { _ in }
                guard adapter.selectSyntheticTransport({ png }) else { XCTFail("Synthetic setup failed"); finished.fulfill(); return }
                request("BLOCKED") {
                    adapter.prepareFixture { fixture, state in
                        XCTAssertEqual(state, "INSTALLED_UNARMED")
                        guard let fixture = fixture else { XCTFail("Fixture not installed"); finished.fulfill(); return }
                        XCTAssertTrue(fixture.navigationDelegate === adapter)
                        arm(40)
                    }
                }
            }
        }
        wait(for: [finished], timeout: 12)
        adapter.stop()
    }

    func testResignActiveLatchesStopAndRejectsRestart() throws {
        let run = try makeRun()
        let adapter = try GridlyLabelDiagnostic(run: run.id, mode: GridlyLabelDiagnostic.mode, candidate: "SYNTHETIC_BUILD18_LABELS")
        let finished = expectation(description: "inactive run denied")
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: UIApplication.willResignActiveNotification, object: nil)
            adapter.requestTile(zoom: 0, row: 0, column: 0) { _, state in
                XCTAssertEqual(state, "BLOCKED")
                Self.assertLedgerRestartRejected(run.id)
                finished.fulfill()
            }
        }
        wait(for: [finished], timeout: 3)
    }

    private static func assertLedgerRestartRejected(_ runID: String, file: StaticString = #filePath, line: UInt = #line) {
        // An invalid run ID reaches the adapter's private stopped error before file access.
        guard case .failure(let expected) = Result(catching: { try NativeLabelBudget(run: "") }) else {
            XCTFail("Invalid run did not produce a rejection", file: file, line: line)
            return
        }
        let expectedError = expected as NSError
        XCTAssertThrowsError(try NativeLabelBudget(run: runID), file: file, line: line) { error in
            let actualError = error as NSError
            XCTAssertTrue(type(of: error) == type(of: expected) &&
                          actualError.domain == expectedError.domain && actualError.code == expectedError.code,
                          "Unexpected ledger restart error", file: file, line: line)
        }
    }

    func testCancellationBeforeConnectionReadyCannotWrite() {
        let cancellation = DiagnosticCancellation()
        let ready = DispatchSemaphore(value: 0)
        let finished = expectation(description: "late ready callback was denied")
        DispatchQueue.global().async {
            guard ready.wait(timeout: .now() + 2) == .success else { return }
            XCTAssertFalse(cancellation.whileActive { XCTFail("send after cancellation") })
            finished.fulfill()
        }
        cancellation.cancel()
        ready.signal()
        wait(for: [finished], timeout: 3)
    }

    func testCompetingControllersAndRestartKeepBothReservations() throws {
        let run = try makeRun()
        let initial = try NativeLabelBudget(run: run.id)
        let competing = try NativeLabelBudget(run: run.id)
        try initial.beginFlight()
        XCTAssertEqual(try initial.reserve(), 1)
        XCTAssertThrowsError(try competing.beginFlight())
        XCTAssertThrowsError(try NativeLabelBudget(run: run.id))
        try initial.endFlight(stopping: false)

        let restarted = try NativeLabelBudget(run: run.id)
        try restarted.beginFlight()
        XCTAssertEqual(try restarted.reserve(), 2)
        try restarted.endFlight(stopping: true)
        XCTAssertFalse(restarted.flightHeld)
        XCTAssertThrowsError(try NativeLabelBudget(run: run.id))
        XCTAssertThrowsError(try GridlyLabelDiagnostic.provision(run: run.id, mode: GridlyLabelDiagnostic.mode))
    }

    func testTerminalPersistenceFailureKeepsFlightMarkerAndRejectsRestart() throws {
        for stopping in [false, true] {
            let run = try makeRun()
            let budget = try NativeLabelBudget(run: run.id)
            try budget.beginFlight()
            XCTAssertEqual(try budget.reserve(), 1)
            let handle = try FileHandle(forWritingTo: run.file)
            try handle.seekToEnd()
            try handle.write(contentsOf: Data("CORRUPT\n".utf8))
            try handle.close()
            XCTAssertThrowsError(try budget.endFlight(stopping: stopping))
            XCTAssertTrue(budget.flightHeld)
            XCTAssertTrue(FileManager.default.fileExists(atPath: run.file.path + ".flight"))
            XCTAssertThrowsError(try NativeLabelBudget(run: run.id))
            // A corrupt ledger must still be rejected if the test removes its sidecar.
            try FileManager.default.removeItem(atPath: run.file.path + ".flight")
            XCTAssertThrowsError(try NativeLabelBudget(run: run.id))
        }
    }

    func testIncompleteReservationIsRejectedEvenIfSidecarIsMissing() throws {
        let run = try makeRun()
        let budget = try NativeLabelBudget(run: run.id)
        try budget.beginFlight()
        XCTAssertEqual(try budget.reserve(), 1)
        try FileManager.default.removeItem(atPath: run.file.path + ".flight")
        XCTAssertThrowsError(try NativeLabelBudget(run: run.id))
    }

    func testCancellationPersistsTerminalStopWithOneReservation() throws {
        let run = try makeRun()
        let budget = try NativeLabelBudget(run: run.id)
        try budget.beginFlight()
        XCTAssertEqual(try budget.reserve(), 1)
        try budget.endFlight(stopping: true)
        XCTAssertFalse(budget.flightHeld)
        XCTAssertThrowsError(try NativeLabelBudget(run: run.id))
    }

    func testRedirectDoesNotBecomeATile() {
        let redirect = Data("HTTP/1.1 302 Found\r\nLocation: https://example.invalid/\r\n\r\n".utf8)
        XCTAssertThrowsError(try GridlyLabelDiagnostic.parseResponse(redirect))
    }

    private func makeRun() throws -> (id: String, file: URL) {
        let id = "owner-" + UUID().uuidString.lowercased().replacingOccurrences(of: "-", with: "")
        let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                               appropriateFor: nil, create: true)
        let file = root.appendingPathComponent("arcgis-ios-\(id).ledger")
        addTeardownBlock {
            for path in [file.path, file.path + ".flight"] {
                if FileManager.default.fileExists(atPath: path) { try FileManager.default.removeItem(atPath: path) }
            }
        }
        try GridlyLabelDiagnostic.provision(run: id, mode: GridlyLabelDiagnostic.mode)
        return (id, file)
    }
}
