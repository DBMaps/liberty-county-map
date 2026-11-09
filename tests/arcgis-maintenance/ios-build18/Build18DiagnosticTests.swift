// Add to an authorized iOS XCTest target with the diagnostic adapter enabled.
// All tests use synthetic state and never create a network connection.
import XCTest
import Darwin
@testable import App

final class Build18DiagnosticTests: XCTestCase {
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
