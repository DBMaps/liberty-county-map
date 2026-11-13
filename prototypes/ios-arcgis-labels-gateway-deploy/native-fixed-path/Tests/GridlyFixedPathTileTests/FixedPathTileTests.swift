import CryptoKit
import Foundation
import XCTest
@testable import GridlyFixedPathTile

final class FixedPathTileTests: XCTestCase {
    private struct Vector: Decodable {
        let origin: String
        let leaseId: UUID
        let timestamp: Int64
        let requestId: UUID
        let body: String
        let canonical: String
        let publicKey: Data
        let signature: Data
    }

    func testSharedNodeVectorAndOutboundRequest() throws {
        let file = try XCTUnwrap(Bundle.module.url(forResource: "tile-proof", withExtension: "json"))
        let v = try JSONDecoder().decode(Vector.self, from: Data(contentsOf: file))
        let payload = try FixedPathTile.payload(origin: v.origin, level: 12, row: 1689, column: 968,
                                                leaseID: v.leaseId, timestamp: v.timestamp, requestID: v.requestId)
        XCTAssertEqual(payload.body, Data(v.body.utf8))
        XCTAssertEqual(payload.proof, Data(v.canonical.utf8))
        let key = try P256.Signing.PublicKey(derRepresentation: v.publicKey)
        let signature = try P256.Signing.ECDSASignature(rawRepresentation: v.signature)
        XCTAssertTrue(key.isValidSignature(signature, for: payload.proof))
        let signingKey = P256.Signing.PrivateKey()
        let request = try FixedPathTile.request(origin: v.origin, level: 12, row: 1689, column: 968,
                                                leaseID: v.leaseId, timestamp: v.timestamp, requestID: v.requestId,
                                                key: signingKey)
        XCTAssertEqual(request.url?.absoluteString, v.origin + "/v1/imagery-labels/tile")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.httpBody, payload.body)
        XCTAssertNil(request.value(forHTTPHeaderField: "X-Gridly-Pilot-Ingress"))
        let encoded = try XCTUnwrap(request.value(forHTTPHeaderField: "X-Gridly-Labels-Signature"))
        XCTAssertEqual(encoded.count, 86)
        let raw = try XCTUnwrap(Data(base64Encoded: encoded.replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/") + "=="))
        XCTAssertTrue(signingKey.publicKey.isValidSignature(
            try P256.Signing.ECDSASignature(rawRepresentation: raw), for: payload.proof))
        let altered = try FixedPathTile.payload(origin: v.origin, level: 12, row: 1690, column: 968,
                                                leaseID: v.leaseId, timestamp: v.timestamp, requestID: v.requestId)
        XCTAssertFalse(key.isValidSignature(signature, for: altered.proof))
        if let export = ProcessInfo.processInfo.environment["GRIDLY_FIXED_VECTOR_OUT"] {
            let data = try JSONSerialization.data(withJSONObject: [
                "origin": v.origin, "leaseId": v.leaseId.uuidString.lowercased(), "timestamp": v.timestamp,
                "requestId": v.requestId.uuidString.lowercased(), "body": v.body, "canonical": v.canonical,
                "publicKey": signingKey.publicKey.derRepresentation.base64EncodedString(), "signature": raw.base64EncodedString()
            ])
            try data.write(to: URL(fileURLWithPath: export), options: .atomic)
        }
    }
}
