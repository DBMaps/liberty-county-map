import CryptoKit
import Foundation
import XCTest
@testable import TileCore

final class MockGatewayTests: XCTestCase {
    private let start: Int64 = 1_794_484_800_000
    private let path = "/v1/imagery-labels/12/1689/968"

    private func decisions(_ key: P256.Signing.PublicKey, at time: Int64) -> (MockPaidDecision, MockIntegrityDecision) {
        let paid = MockPaidDecision(evidenceID: UUID(), lineage: UUID(), environment: .sandbox,
                                    verifiedAt: time, periodEnd: time + 600_000)
        return (paid, MockIntegrityDecision(challenge: UUID(), paidEvidenceID: paid.evidenceID,
            installation: UUID(), environment: .sandbox, verifiedAt: time, publicKey: key))
    }

    private func signed(_ lease: MockLease, _ key: P256.Signing.PrivateKey, at time: Int64) throws -> MockTileProof {
        var proof = MockTileProof(target: path, leaseID: lease.id, timestamp: time, requestID: UUID())
        try proof.sign(with: key)
        return proof
    }

    private func fixture() throws -> Data {
        try Data(contentsOf: XCTUnwrap(Bundle.module.url(forResource: "valid", withExtension: "png")))
    }

    @MainActor
    func testSyntheticAdmissionToSignedFixtureAndReplay() async throws {
        let time = start
        let gateway = MockGateway(environment: .sandbox, clock: { time })
        let key = P256.Signing.PrivateKey()
        let (paid, integrity) = decisions(key.publicKey, at: time)
        let lease = try gateway.issue(paid: paid, integrity: integrity, publicKey: key.publicKey, requested: .sandbox)
        XCTAssertEqual(lease.audience, MockGateway.audience)
        XCTAssertEqual(lease.scope, MockGateway.scope)
        XCTAssertEqual(lease.expiresAt, time + 300_000)
        let proof = try signed(lease, key, at: time)
        let reservation = try gateway.reserve(proof)
        XCTAssertThrowsError(try gateway.reserve(proof))
        XCTAssertThrowsError(try gateway.issue(paid: paid, integrity: integrity, publicKey: key.publicKey, requested: .sandbox))
        XCTAssertEqual(reservation.tile.row, 1689)
        let png = try fixture()
        XCTAssertEqual(gateway.finish(reservation, .success(png)), .success(png))
        XCTAssertEqual(gateway.attemptsToday, 1)
        XCTAssertEqual(gateway.activeCount, 0)
    }

    @MainActor
    func testWrongEnvironmentAndUnverifiedDecisionNeverIssue() async throws {
        let time = start, key = P256.Signing.PrivateKey()
        let gateway = MockGateway(environment: .sandbox, clock: { time })
        var (paid, integrity) = decisions(key.publicKey, at: time)
        XCTAssertThrowsError(try gateway.issue(paid: paid, integrity: integrity, publicKey: key.publicKey, requested: .production))
        paid.continuityOnly = true
        XCTAssertThrowsError(try gateway.issue(paid: paid, integrity: integrity, publicKey: key.publicKey, requested: .sandbox))
        paid.continuityOnly = false
        integrity.verified = false
        XCTAssertThrowsError(try gateway.issue(paid: paid, integrity: integrity, publicKey: key.publicKey, requested: .sandbox))
        XCTAssertEqual(gateway.attemptsToday, 0)
    }

    @MainActor
    func testWrongKeyAlteredPathSkewAndExpiredLeaseFailClosed() async throws {
        var time = start
        let gateway = MockGateway(environment: .sandbox, clock: { time })
        let key = P256.Signing.PrivateKey(), wrong = P256.Signing.PrivateKey()
        let (paid, integrity) = decisions(key.publicKey, at: time)
        XCTAssertThrowsError(try gateway.issue(paid: paid, integrity: integrity, publicKey: wrong.publicKey, requested: .sandbox))
        let lease = try gateway.issue(paid: paid, integrity: integrity, publicKey: key.publicKey, requested: .sandbox)
        XCTAssertThrowsError(try gateway.reserve(signed(lease, wrong, at: time)))
        XCTAssertThrowsError(try gateway.reserve(signed(lease, key, at: time + 30_001)))
        var altered = try signed(lease, key, at: time)
        altered.target = "/v1/imagery-labels/0/0/0"
        XCTAssertThrowsError(try gateway.reserve(altered))
        altered.target = "/v1/imagery-labels/12/%31/0"
        XCTAssertThrowsError(try gateway.reserve(altered))
        time += 300_000
        XCTAssertThrowsError(try gateway.reserve(signed(lease, key, at: time)))
        XCTAssertEqual(gateway.attemptsToday, 0)
    }

    @MainActor
    func testQuotaCancellationAndRevocationWhileTileIsInFlight() async throws {
        let time = start, key = P256.Signing.PrivateKey()
        let gateway = MockGateway(environment: .sandbox, limits: .init(aggregateDaily: 2, installationActive: 1), clock: { time })
        let (paid, integrity) = decisions(key.publicKey, at: time)
        let lease = try gateway.issue(paid: paid, integrity: integrity, publicKey: key.publicKey, requested: .sandbox)
        let first = try gateway.reserve(signed(lease, key, at: time))
        XCTAssertThrowsError(try gateway.reserve(signed(lease, key, at: time)))
        XCTAssertEqual(gateway.finish(first, .failure(.cancelled)), .failure(.cancelled))
        let second = try gateway.reserve(signed(lease, key, at: time))
        XCTAssertThrowsError(try gateway.reserve(signed(lease, key, at: time)))
        gateway.revoke(lease)
        XCTAssertEqual(gateway.finish(second, .success(try fixture())), .failure(.unavailable))
        XCTAssertEqual(gateway.attemptsToday, 2)
        XCTAssertEqual(gateway.activeCount, 0)
    }

    @MainActor
    func testInvalidPNGCountsProviderAttempt() async throws {
        let time = start, key = P256.Signing.PrivateKey()
        let gateway = MockGateway(environment: .sandbox, clock: { time })
        let (paid, integrity) = decisions(key.publicKey, at: time)
        let lease = try gateway.issue(paid: paid, integrity: integrity, publicKey: key.publicKey, requested: .sandbox)
        let reservation = try gateway.reserve(signed(lease, key, at: time))
        XCTAssertEqual(gateway.finish(reservation, .success(Data([0, 1, 2]))), .failure(.invalidImage))
        XCTAssertEqual(gateway.attemptsToday, 1)
    }

    func testNodeWireVectorMatchesCanonicalBytesAndVerifiesInCryptoKit() throws {
        struct Vector: Decodable {
            struct Proof: Decodable {
                let method: String, target: String, leaseId: UUID, timestamp: Int64, requestId: UUID, signature: String
            }
            let publicKeySPKI: String, canonical: String, proof: Proof
        }
        let url = try XCTUnwrap(Bundle.module.url(forResource: "wire-proof", withExtension: "json"))
        let vector = try JSONDecoder().decode(Vector.self, from: Data(contentsOf: url))
        let der = try XCTUnwrap(Data(base64Encoded: vector.publicKeySPKI))
        let key = try P256.Signing.PublicKey(derRepresentation: der)
        let encoded = vector.proof.signature.replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/") + "=="
        let proof = MockTileProof(method: vector.proof.method, target: vector.proof.target, leaseID: vector.proof.leaseId,
            timestamp: vector.proof.timestamp, requestID: vector.proof.requestId,
            signature: try XCTUnwrap(Data(base64Encoded: encoded)))
        XCTAssertEqual(try proof.signingBytes(), Data(vector.canonical.utf8))
        XCTAssertTrue(proof.verifies(with: key))
    }
}
