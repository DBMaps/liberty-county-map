import CryptoKit
import Foundation

enum MockEnvironment: Equatable { case production, sandbox }

struct MockPaidDecision {
    let evidenceID: UUID
    let lineage: UUID
    let environment: MockEnvironment
    let verifiedAt: Int64
    let periodEnd: Int64
    var verified = true
    var revoked = false
    var continuityOnly = false
}

struct MockIntegrityDecision {
    let challenge: UUID
    let paidEvidenceID: UUID
    let installation: UUID
    let environment: MockEnvironment
    let verifiedAt: Int64
    let publicKey: P256.Signing.PublicKey
    var verified = true
}

struct MockLease {
    let id: UUID
    let issuedAt: Int64
    let expiresAt: Int64
    let environment: MockEnvironment
    var audience: String { MockGateway.audience }
    var scope: String { MockGateway.scope }
}

struct MockTileProof {
    var method = "GET"
    var target: String
    var leaseID: UUID
    var timestamp: Int64
    var requestID: UUID
    var signature = Data()

    func signingBytes() throws -> Data {
        let fields: [Any] = [MockGateway.audience, method,
            "https://labels.mock.invalid" + target, leaseID.uuidString.lowercased(),
            timestamp, requestID.uuidString.lowercased()]
        return try JSONSerialization.data(withJSONObject: fields, options: [.withoutEscapingSlashes])
    }

    mutating func sign(with key: P256.Signing.PrivateKey) throws {
        signature = try key.signature(for: signingBytes()).rawRepresentation
    }

    func verifies(with key: P256.Signing.PublicKey) -> Bool {
        guard signature.count == 64, let parsed = try? P256.Signing.ECDSASignature(rawRepresentation: signature),
              let bytes = try? signingBytes() else { return false }
        return key.isValidSignature(parsed, for: bytes)
    }

    static func target(for tile: LabelTile) -> String {
        "/v1/imagery-labels/\(tile.level)/\(tile.row)/\(tile.column)"
    }

    func tile() -> LabelTile? {
        let prefix = "/v1/imagery-labels/"
        guard method == "GET", target.hasPrefix(prefix), target.utf8.count <= 42,
              let url = URL(string: "gridly-label://mock/tile/" + String(target.dropFirst(prefix.count))),
              let tile = LabelTile(url: url, method: method), target == Self.target(for: tile) else { return nil }
        return tile
    }
}

// Native fixture counterpart to the Node gateway. The MainActor serializes
// replay and quota reservations before the asynchronous local provider starts.
@MainActor
final class MockGateway {
    nonisolated static let audience = "gridly-labels-gateway-mock-v1"
    nonisolated static let scope = "imagery-labels:read"

    struct Limits {
        var installationDaily = 500
        var lineageDaily = 1000
        var aggregateDaily = 10_000
        var perMinute = 60
        var installationActive = 4
        var aggregateActive = 64
    }

    struct Reservation {
        let tile: LabelTile
        fileprivate let id: UUID
    }

    private struct Record {
        let lease: MockLease
        let installation: UUID
        let lineage: UUID
        let key: P256.Signing.PublicKey
        var seen: Set<UUID> = []
    }

    private struct Active {
        let leaseID: UUID
        let installation: UUID
    }

    private let environment: MockEnvironment
    private let clock: () -> Int64
    private let limits: Limits
    private var lastTime: Int64 = 0
    private var nextSweep: Int64 = 0
    private var leases: [UUID: Record] = [:]
    private var challenges: [UUID: Int64] = [:]
    private var arrivals: [UUID: [Int64]] = [:]
    private var activeByInstallation: [UUID: Int] = [:]
    private var active: [UUID: Active] = [:]
    private var day: Int64 = -1
    private var installationUsage: [UUID: Int] = [:]
    private var lineageUsage: [UUID: Int] = [:]
    private(set) var attemptsToday = 0
    var activeCount: Int { active.count }

    init(environment: MockEnvironment, limits: Limits = .init(), clock: @escaping () -> Int64) {
        self.environment = environment
        self.limits = limits
        self.clock = clock
    }

    private func currentTime() throws -> Int64 {
        let time = clock()
        guard time >= lastTime, time <= 8_640_000_000_000_000 else { throw TileError.unavailable }
        lastTime = time
        if time >= nextSweep {
            leases = leases.filter { $0.value.lease.expiresAt > time }
            challenges = challenges.filter { $0.value > time }
            arrivals = arrivals.filter { ($0.value.last ?? 0) > time - 60_000 || activeByInstallation[$0.key] != nil }
            nextSweep = time + 1000
        }
        return time
    }

    // These inputs are decisions supplied by a trusted in-process synthetic
    // verifier. A WebKit request has no entry point to supply either decision.
    func issue(paid: MockPaidDecision, integrity: MockIntegrityDecision,
               publicKey: P256.Signing.PublicKey, requested: MockEnvironment) throws -> MockLease {
        let time = try currentTime()
        guard requested == environment, paid.environment == environment, integrity.environment == environment,
              paid.verified, !paid.revoked, !paid.continuityOnly, paid.periodEnd > time,
              paid.verifiedAt >= 0, paid.verifiedAt <= time, time - paid.verifiedAt < 300_000,
              integrity.verified, integrity.verifiedAt >= 0, integrity.verifiedAt <= time,
              time - integrity.verifiedAt < 120_000, integrity.paidEvidenceID == paid.evidenceID,
              integrity.publicKey.x963Representation == publicKey.x963Representation,
              challenges[integrity.challenge] == nil else { throw TileError.unavailable }
        guard leases.count < 1024, challenges.count < 4096 else { throw TileError.busy }
        let lease = MockLease(id: UUID(), issuedAt: time, expiresAt: min(paid.periodEnd, paid.verifiedAt + 300_000),
                              environment: environment)
        challenges[integrity.challenge] = integrity.verifiedAt + 120_000
        leases[lease.id] = Record(lease: lease, installation: integrity.installation, lineage: paid.lineage, key: publicKey)
        return lease
    }

    func revoke(_ lease: MockLease) { leases.removeValue(forKey: lease.id) }

    func reserve(_ proof: MockTileProof) throws -> Reservation {
        guard let tile = proof.tile() else { throw TileError.invalidRequest }
        let time = try currentTime()
        guard let record = leases[proof.leaseID], record.lease.expiresAt > time,
              proof.timestamp >= time - 30_000, proof.timestamp <= time + 30_000,
              proof.verifies(with: record.key), !record.seen.contains(proof.requestID) else { throw TileError.unavailable }
        guard arrivals[record.installation] != nil || arrivals.count < 4096 else { throw TileError.busy }
        var recent = arrivals[record.installation, default: []].filter { $0 > time - 60_000 }
        guard recent.count < limits.perMinute else { throw TileError.busy }
        recent.append(time)
        arrivals[record.installation] = recent
        guard record.seen.count < 512, active.count < limits.aggregateActive,
              activeByInstallation[record.installation, default: 0] < limits.installationActive else { throw TileError.busy }

        let utcDay = time / 86_400_000
        if utcDay != day {
            day = utcDay
            attemptsToday = 0
            installationUsage.removeAll()
            lineageUsage.removeAll()
        }
        guard attemptsToday < limits.aggregateDaily,
              installationUsage[record.installation] != nil || installationUsage.count < 4096,
              lineageUsage[record.lineage] != nil || lineageUsage.count < 4096,
              installationUsage[record.installation, default: 0] < limits.installationDaily,
              lineageUsage[record.lineage, default: 0] < limits.lineageDaily else { throw TileError.busy }
        attemptsToday += 1
        installationUsage[record.installation, default: 0] += 1
        lineageUsage[record.lineage, default: 0] += 1
        leases[proof.leaseID]?.seen.insert(proof.requestID)
        let reservation = Reservation(tile: tile, id: UUID())
        active[reservation.id] = Active(leaseID: proof.leaseID, installation: record.installation)
        activeByInstallation[record.installation, default: 0] += 1
        return reservation
    }

    func finish(_ reservation: Reservation, _ result: TileResult) -> TileResult {
        guard let work = active.removeValue(forKey: reservation.id) else { return .failure(.unavailable) }
        if activeByInstallation[work.installation] == 1 { activeByInstallation.removeValue(forKey: work.installation) }
        else { activeByInstallation[work.installation, default: 1] -= 1 }
        guard case .success(let data) = result else { return result }
        guard let time = try? currentTime(), let record = leases[work.leaseID], record.lease.expiresAt > time else {
            return .failure(.unavailable)
        }
        return TilePNG.isValid(data) ? .success(data) : .failure(.invalidImage)
    }
}
