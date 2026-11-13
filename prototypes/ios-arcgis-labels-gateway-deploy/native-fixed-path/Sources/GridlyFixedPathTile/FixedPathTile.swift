import CryptoKit
import Foundation

// Isolated outbound request builder. The caller retains the certified lease
// renewal, PilotHTTP response limits, cancellation, and local WebKit handler.
public enum FixedPathTile {
    public enum Failure: Error { case invalidRequest }
    private static let path = "/v1/imagery-labels/tile"

    public static func request(origin: String, level: Int, row: Int, column: Int,
                               leaseID: UUID, timestamp: Int64, requestID: UUID,
                               key: P256.Signing.PrivateKey) throws -> URLRequest {
        let parts = try payload(origin: origin, level: level, row: row, column: column,
                                leaseID: leaseID, timestamp: timestamp, requestID: requestID)
        let signature = try key.signature(for: parts.proof)
        var request = URLRequest(url: parts.url, cachePolicy: .reloadIgnoringLocalCacheData)
        request.httpMethod = "POST"
        request.httpBody = parts.body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("image/png", forHTTPHeaderField: "Accept")
        request.setValue(leaseID.uuidString.lowercased(), forHTTPHeaderField: "X-Gridly-Labels-Lease")
        request.setValue(String(timestamp), forHTTPHeaderField: "X-Gridly-Labels-Timestamp")
        request.setValue(requestID.uuidString.lowercased(), forHTTPHeaderField: "X-Gridly-Labels-Request")
        request.setValue(base64url(signature.rawRepresentation), forHTTPHeaderField: "X-Gridly-Labels-Signature")
        return request
    }

    static func payload(origin: String, level: Int, row: Int, column: Int,
                        leaseID: UUID, timestamp: Int64, requestID: UUID) throws -> (url: URL, body: Data, proof: Data) {
        guard (0...19).contains(level), (0..<(1 << level)).contains(row),
              (0..<(1 << level)).contains(column), (0...8_640_000_000_000_000).contains(timestamp),
              origin.range(of: #"^https://[a-z0-9.-]+(?::[1-9][0-9]{0,4})?$"#,
                           options: .regularExpression)?.upperBound == origin.endIndex,
              let components = URLComponents(string: origin), let host = components.host, !host.isEmpty,
              components.port.map({ (1...65535).contains($0) && $0 != 443 }) ?? true,
              let url = URL(string: origin + path), url.absoluteString == origin + path
        else { throw Failure.invalidRequest }
        let body = Data("{\"level\":\(level),\"row\":\(row),\"column\":\(column)}".utf8)
        let digest = base64url(Data(SHA256.hash(data: body)))
        let proof = "[\"gridly-labels-pilot-v1\",\"gridly-labels-tile-body-v1\",\"POST\",\"\(url.absoluteString)\",\"\(digest)\",\"\(leaseID.uuidString.lowercased())\",\(timestamp),\"\(requestID.uuidString.lowercased())\"]"
        return (url, body, Data(proof.utf8))
    }

    private static func base64url(_ bytes: Data) -> String {
        bytes.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
