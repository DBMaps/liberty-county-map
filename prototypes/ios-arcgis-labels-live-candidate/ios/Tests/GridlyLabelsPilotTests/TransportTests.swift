import CryptoKit
import Foundation
import XCTest
@testable import GridlyLabelsPilot

final class TransportTests: XCTestCase {
    func testPilotLeaseBindingMatchesNodeVector() throws {
        let context = LabelsBindingContext(keyFingerprint: "BNh3zlADIaEw0DQ6HhZZWPt99knZQKuSPGCyYDuJICw",
                                           appID: "com.gridlygo.prototype.labeltiles.pilot")
        let challenge = try XCTUnwrap(UUID(uuidString: "00000000-0000-4000-8000-000000000003"))
        let hash = try context.clientDataHash(challengeID: challenge, paidEvidence: "fixture/paid")
        XCTAssertEqual(base64url(hash), "RTh-c0aw-gbVGBX0srYt0MYr0OAHs5K021EsrFTjCMY")
    }

    func testCertifiedCanonicalVectorAndCryptoKitSignature() throws {
        let origin = "https://labels.mock.invalid"
        let target = "/v1/imagery-labels/12/1689/968"
        let lease = "00000000-0000-4000-8000-000000000001"
        let request = "00000000-0000-4000-8000-000000000002"
        let bytes = try canonicalTileProof(origin: origin, target: target, leaseID: lease, timestamp: 1794484800000,
                                           requestID: request, audience: "gridly-labels-gateway-mock-v1")
        XCTAssertEqual(String(decoding: bytes, as: UTF8.self),
            "[\"gridly-labels-gateway-mock-v1\",\"GET\",\"https://labels.mock.invalid/v1/imagery-labels/12/1689/968\",\"00000000-0000-4000-8000-000000000001\",1794484800000,\"00000000-0000-4000-8000-000000000002\"]")
        let spki = try XCTUnwrap(Data(base64Encoded: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEkqX3IukYjA1zcWs/+1Xo3ysAEFTHlRhCwUHT5d0he6Zp6xEl6AOhJ+C6I7Y5HoLupEYv09ZTWqpTP/U+reINVg=="))
        let encoded = "znVMQIc7kPPn6U_ns_hPPKNxL8jmN-SSG6yAbzQ-KUQqjEMAVqCJcL2mExFRqEr1_8T32S8-b9PQqvuiPTm1SA"
        let raw = try XCTUnwrap(Data(base64Encoded: encoded.replacingOccurrences(of: "_", with: "/")
            .replacingOccurrences(of: "-", with: "+") + "=="))
        let key = try P256.Signing.PublicKey(derRepresentation: spki)
        let signature = try P256.Signing.ECDSASignature(rawRepresentation: raw)
        XCTAssertTrue(key.isValidSignature(signature, for: bytes))
        let changed = try canonicalTileProof(origin: "https://labels-pilot.invalid", target: target, leaseID: lease,
                                             timestamp: 1794484800000, requestID: request)
        XCTAssertFalse(key.isValidSignature(signature, for: changed))
    }

    @MainActor
    func testDisabledTransportAndInvalidationRenewTheLease() async throws {
        let http = StubHTTP()
        let tile = try XCTUnwrap(LabelTile(url: XCTUnwrap(URL(string: "gridly-label://pilot/tile/12/1689/968")), method: "GET"))
        let disabled = HTTPSLabelTransport(configuration: nil, http: http)
        let denial = await request(disabled, tile)
        XCTAssertThrowsError(try denial.get())
        XCTAssertTrue(http.requests.isEmpty)
        let config = try XCTUnwrap(LabelsPilotConfiguration(origin: "https://labels-pilot.invalid",
            appID: "com.gridlygo.prototype.labeltiles.pilot") { _ in
                LabelsLeaseEvidence(challengeID: UUID(), paidEvidence: "local-paid", attestEvidence: "local-attest")
            })
        let transport = HTTPSLabelTransport(configuration: config, http: http, clock: { 1794484800000 })
        let first = await request(transport, tile)
        XCTAssertEqual(try first.get(), Data([1, 2, 3]))
        _ = await request(transport, tile)
        XCTAssertEqual(http.requests.map(\.httpMethod), ["POST", "GET", "GET"])
        transport.invalidate()
        _ = await request(transport, tile)
        XCTAssertEqual(http.requests.map(\.httpMethod), ["POST", "GET", "GET", "POST", "GET"])
        for call in http.requests.filter({ $0.httpMethod == "GET" }) {
            XCTAssertEqual(call.url?.absoluteString, "https://labels-pilot.invalid/v1/imagery-labels/12/1689/968")
            XCTAssertEqual(call.value(forHTTPHeaderField: "X-Gridly-Labels-Signature")?.count, 86)
            XCTAssertNil(call.value(forHTTPHeaderField: "Authorization"))
        }
    }

    @MainActor
    private func request(_ transport: HTTPSLabelTransport, _ tile: LabelTile) async -> TileResult {
        await withCheckedContinuation { continuation in
            _ = transport.request(tile) { continuation.resume(returning: $0) }
        }
    }
}

@MainActor
private final class StubHTTP: PilotHTTP {
    private(set) var requests: [URLRequest] = []

    func send(_ request: URLRequest, maximumBytes: Int) async throws -> PilotHTTPReply {
        requests.append(request)
        if request.httpMethod == "POST" {
            let json: [String: Any] = ["leaseId": UUID().uuidString.lowercased(),
                "audience": "gridly-labels-pilot-v1", "scope": "imagery-labels:read", "store": "sandbox",
                "attest": "production", "issuedAt": 1794484800000 as Int64, "expiresAt": 1794485100000 as Int64]
            return .init(status: 201, contentType: "application/json", body: try JSONSerialization.data(withJSONObject: json))
        }
        return .init(status: 200, contentType: "image/png", body: Data([1, 2, 3]))
    }
}
