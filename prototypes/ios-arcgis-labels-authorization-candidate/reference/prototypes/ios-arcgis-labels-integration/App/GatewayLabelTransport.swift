import CryptoKit
import Foundation
import OSLog

@MainActor
final class GatewayLabelTransport: MockLabelTransport {
    private let renderer = SyntheticLabelTransport()
    private let gateway: MockGateway
    private let signingKey = P256.Signing.PrivateKey()
    private let installation = UUID()
    private let lineage = UUID()
    private let clock: () -> Int64
    private let paidPeriodEnd: Int64
    private let log = Logger(subsystem: "com.gridlygo.prototype.labeltiles.integration", category: "mock-gateway")
    private let emptyFixture = Bundle.main.url(forResource: "valid", withExtension: "png")
        .flatMap { try? Data(contentsOf: $0) }
    private var lease: MockLease?
    private var reportedDelivery = false

    var mode: SyntheticLabelTransport.Mode {
        get { renderer.mode }
        set { renderer.mode = newValue }
    }

    init(clock: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }) {
        self.clock = clock
        self.gateway = MockGateway(environment: .sandbox, clock: clock)
        self.paidPeriodEnd = clock() + 3_600_000
    }

    private func currentLease(at time: Int64) throws -> MockLease {
        if let lease, time < lease.expiresAt { return lease }
        let evidenceID = UUID()
        let paid = MockPaidDecision(evidenceID: evidenceID, lineage: lineage, environment: .sandbox,
                                    verifiedAt: time, periodEnd: paidPeriodEnd)
        let integrity = MockIntegrityDecision(challenge: UUID(), paidEvidenceID: evidenceID,
            installation: installation, environment: .sandbox, verifiedAt: time, publicKey: signingKey.publicKey)
        let issued = try gateway.issue(paid: paid, integrity: integrity, publicKey: signingKey.publicKey,
                                       requested: .sandbox)
        lease = issued
        return issued
    }

    private func render(_ tile: LabelTile, completion: @escaping TileCompletion) -> TileCancel {
        // The certified renderer draws these fixed anchors. Keep a margin
        // larger than any mock glyph before using the bundled transparent tile.
        let anchors = [(30.052, -94.891), (30.044, -94.880), (30.038, -94.889)]
        let mayContainLabel = anchors.contains { anchor in
            let point = tile.pixel(latitude: anchor.0, longitude: anchor.1)
            return (-256.0...768.0).contains(point.x) && (-256.0...768.0).contains(point.y)
        }
        guard mode == .success, !mayContainLabel else { return renderer.request(tile, completion: completion) }
        let fixture = emptyFixture
        let task = Task { @MainActor in
            if Task.isCancelled { completion(.failure(.cancelled)) }
            else if let fixture { completion(.success(fixture)) }
            else { completion(.failure(.invalidImage)) }
        }
        return { task.cancel() }
    }

    func request(_ tile: LabelTile, completion: @escaping TileCompletion) -> TileCancel {
        do {
            let time = clock()
            let lease = try currentLease(at: time)
            var proof = MockTileProof(target: MockTileProof.target(for: tile), leaseID: lease.id,
                                      timestamp: time, requestID: UUID())
            try proof.sign(with: signingKey)
            let reservation = try gateway.reserve(proof)
            return render(reservation.tile) { [self] result in
                let delivered = gateway.finish(reservation, result)
                if !reportedDelivery, case .success = delivered {
                    reportedDelivery = true
                    log.notice("MOCK_GATEWAY_PNG_DELIVERED")
                }
                completion(delivered)
            }
        } catch let error as TileError {
            completion(.failure(error))
        } catch {
            completion(.failure(.unavailable))
        }
        return {}
    }
}
