import CryptoKit
import Foundation

private let pilotAudience = "gridly-labels-pilot-v1"
private let leasePurpose = "gridly-labels-lease-v1"
private let storeEnvironment = "sandbox"
private let attestEnvironment = "production"

func base64url(_ data: Data) -> String {
    data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
}

private func digest(_ data: Data) -> String { base64url(Data(SHA256.hash(data: data))) }

func canonicalTileProof(origin: String, target: String, leaseID: String, timestamp: Int64,
                        requestID: String, audience: String = "gridly-labels-pilot-v1") throws -> Data {
    try JSONSerialization.data(withJSONObject: [audience, "GET", origin + target, leaseID, timestamp, requestID],
                               options: [.withoutEscapingSlashes])
}

public struct LabelsLeaseEvidence: Encodable {
    let challengeId: String
    let paidEvidence: String
    let attestEvidence: String

    public init(challengeID: UUID, paidEvidence: String, attestEvidence: String) {
        self.challengeId = challengeID.uuidString.lowercased()
        self.paidEvidence = paidEvidence
        self.attestEvidence = attestEvidence
    }
}

public struct LabelsBindingContext {
    public let keyFingerprint: String
    public let appID: String

    public func clientDataHash(challengeID: UUID, paidEvidence: String) throws -> Data {
        let binding = try JSONSerialization.data(withJSONObject: [
            leasePurpose, appID, storeEnvironment, attestEnvironment,
            challengeID.uuidString.lowercased(), digest(Data(paidEvidence.utf8)), keyFingerprint
        ], options: [.withoutEscapingSlashes])
        return Data(SHA256.hash(data: binding))
    }
}

public struct LabelsPilotConfiguration {
    let origin: String
    let appID: String
    let evidence: @MainActor (LabelsBindingContext) async throws -> LabelsLeaseEvidence

    public init?(origin: String, appID: String,
                 evidence: @escaping @MainActor (LabelsBindingContext) async throws -> LabelsLeaseEvidence) {
        guard let components = URLComponents(string: origin), components.scheme == "https",
              let host = components.host, !host.isEmpty, host == host.lowercased(),
              components.user == nil, components.password == nil, components.path.isEmpty,
              components.query == nil, components.fragment == nil,
              components.string == origin, !appID.isEmpty else { return nil }
        self.origin = origin
        self.appID = appID
        self.evidence = evidence
    }
}

struct PilotHTTPReply {
    let status: Int
    let contentType: String?
    let body: Data
}

@MainActor
protocol PilotHTTP {
    func send(_ request: URLRequest, maximumBytes: Int) async throws -> PilotHTTPReply
}

private final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

@MainActor
final class PilotURLSession: PilotHTTP {
    private let session: URLSession

    init(protocolClasses: [AnyClass] = []) {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.urlCredentialStorage = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 6
        configuration.timeoutIntervalForResource = 8
        if !protocolClasses.isEmpty { configuration.protocolClasses = protocolClasses }
        session = URLSession(configuration: configuration, delegate: NoRedirects(), delegateQueue: nil)
    }

    deinit { session.invalidateAndCancel() }

    func send(_ request: URLRequest, maximumBytes: Int) async throws -> PilotHTTPReply {
        let (bytes, response) = try await session.bytes(for: request)
        guard let http = response as? HTTPURLResponse,
              http.url == request.url,
              http.expectedContentLength <= Int64(maximumBytes) else {
            bytes.task.cancel()
            throw TileError.unavailable
        }
        // Consume only successful image/JSON replies. An untrusted error
        // response never reaches the WebView or the caller.
        guard http.statusCode == 200 || http.statusCode == 201 else {
            bytes.task.cancel()
            return .init(status: http.statusCode, contentType: nil, body: Data())
        }
        var body = Data()
        do {
            for try await byte in bytes {
                guard body.count < maximumBytes else { throw TileError.invalidImage }
                body.append(byte)
            }
            try Task.checkCancellation()
        } catch {
            bytes.task.cancel()
            throw error
        }
        return .init(status: http.statusCode, contentType: http.mimeType, body: body)
    }
}

@MainActor
final class HTTPSLabelTransport: LabelTransport {
    private struct Lease: Decodable {
        let leaseId: UUID
        let audience: String
        let scope: String
        let store: String
        let attest: String
        let issuedAt: Int64
        let expiresAt: Int64
    }

    private let configuration: LabelsPilotConfiguration?
    private let http: PilotHTTP
    private let signingKey = P256.Signing.PrivateKey()
    private let clock: () -> Int64
    private var lease: Lease?
    private var renewal: (id: UUID, task: Task<Lease, Error>)?

    init(configuration: LabelsPilotConfiguration?, http: PilotHTTP,
         clock: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }) {
        self.configuration = configuration
        self.http = http
        self.clock = clock
    }

    func invalidate() {
        lease = nil
        renewal?.task.cancel()
        renewal = nil
    }

    private func currentLease(_ config: LabelsPilotConfiguration) async throws -> Lease {
        if let lease, clock() < lease.expiresAt - 5_000 { return lease }
        let active: (id: UUID, task: Task<Lease, Error>)
        if let renewal {
            active = renewal
        } else {
            let spki = signingKey.publicKey.derRepresentation
            let task = Task { @MainActor in
                let evidence = try await config.evidence(.init(keyFingerprint: digest(spki), appID: config.appID))
                try Task.checkCancellation()
                guard (1...20_000).contains(evidence.paidEvidence.utf8.count),
                      (1...20_000).contains(evidence.attestEvidence.utf8.count),
                      let endpoint = URL(string: config.origin + "/v1/labels/lease") else { throw TileError.unavailable }
                struct Body: Encodable {
                    let paidEvidence: String
                    let attestEvidence: String
                    let challengeId: String
                    let spki: String
                }
                var request = URLRequest(url: endpoint)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.httpBody = try JSONEncoder().encode(Body(paidEvidence: evidence.paidEvidence,
                    attestEvidence: evidence.attestEvidence, challengeId: evidence.challengeId, spki: base64url(spki)))
                guard (request.httpBody?.count ?? 0) <= 48 * 1024 else { throw TileError.unavailable }
                let reply = try await http.send(request, maximumBytes: 4096)
                try Task.checkCancellation()
                guard reply.status == 201, reply.contentType == "application/json" else { throw TileError.unavailable }
                let issued = try JSONDecoder().decode(Lease.self, from: reply.body)
                let now = clock()
                guard issued.audience == pilotAudience, issued.scope == "imagery-labels:read",
                      issued.store == storeEnvironment, issued.attest == attestEnvironment,
                      issued.issuedAt > 0, issued.issuedAt <= now + 30_000, issued.expiresAt > now,
                      issued.expiresAt > issued.issuedAt, issued.expiresAt - issued.issuedAt <= 300_000
                else { throw TileError.unavailable }
                return issued
            }
            active = (UUID(), task)
            renewal = active
        }
        do {
            let result = try await active.task.value
            if renewal?.id == active.id {
                lease = result
                renewal = nil
            }
            guard lease?.leaseId == result.leaseId else { throw TileError.cancelled }
            try Task.checkCancellation()
            return result
        } catch {
            if renewal?.id == active.id { renewal = nil }
            throw error
        }
    }

    func request(_ tile: LabelTile, completion: @escaping TileCompletion) -> TileCancel {
        guard let configuration else {
            completion(.failure(.unavailable))
            return {}
        }
        let task = Task { @MainActor in
            do {
                let lease = try await currentLease(configuration)
                try Task.checkCancellation()
                let target = "/v1/imagery-labels/\(tile.level)/\(tile.row)/\(tile.column)"
                guard let url = URL(string: configuration.origin + target) else { throw TileError.invalidRequest }
                let leaseID = lease.leaseId.uuidString.lowercased()
                let requestID = UUID().uuidString.lowercased()
                let timestamp = clock()
                let bytes = try canonicalTileProof(origin: configuration.origin, target: target,
                    leaseID: leaseID, timestamp: timestamp, requestID: requestID)
                let signature = try signingKey.signature(for: bytes)
                var request = URLRequest(url: url)
                request.httpMethod = "GET"
                request.setValue("image/png", forHTTPHeaderField: "Accept")
                request.setValue(leaseID, forHTTPHeaderField: "X-Gridly-Labels-Lease")
                request.setValue(String(timestamp), forHTTPHeaderField: "X-Gridly-Labels-Timestamp")
                request.setValue(requestID, forHTTPHeaderField: "X-Gridly-Labels-Request")
                request.setValue(base64url(signature.rawRepresentation), forHTTPHeaderField: "X-Gridly-Labels-Signature")
                let reply = try await http.send(request, maximumBytes: TilePNG.maximumBytes)
                try Task.checkCancellation()
                if reply.status == 401, self.lease?.leaseId == lease.leaseId { self.lease = nil }
                guard reply.status == 200, reply.contentType == TilePNG.mimeType else { throw TileError.unavailable }
                completion(.success(reply.body))
            } catch {
                completion(.failure(Task.isCancelled ? .cancelled : .unavailable))
            }
        }
        return { task.cancel() }
    }
}
