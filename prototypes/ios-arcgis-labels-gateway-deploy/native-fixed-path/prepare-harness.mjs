import assert from 'node:assert/strict';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = process.argv[2];
assert.ok(out);
const root = new URL('../../ios-arcgis-labels-live-candidate/ios/', import.meta.url);
cpSync(fileURLToPath(root), out, { recursive: true, errorOnExist: true, force: false });
const rewrite = (path, replacements) => {
  const file = join(out, path);
  let source = readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  for (const [from, to] of replacements) {
    assert.equal(source.split(from).length, 2, 'unexpected certified source: ' + path);
    source = source.replace(from, to);
  }
  writeFileSync(file, source);
};
const transport = 'Sources/GridlyLabelsPilot/HTTPSLabelTransport.swift';
const source = readFileSync(new URL(transport, root), 'utf8').replaceAll('\r\n', '\n');
const start = source.indexOf('                let target = "/v1/imagery-labels/');
const finish = source.indexOf('                let reply = try await http.send(request, maximumBytes: TilePNG.maximumBytes)', start);
assert.ok(start > 0 && finish > start);
const fixed = readFileSync(new URL('./Sources/GridlyFixedPathTile/FixedPathTile.swift', import.meta.url), 'utf8');
rewrite(transport, [[source.slice(start, finish), `                let request = try FixedPathTile.request(origin: configuration.origin,
                    level: tile.level, row: tile.row, column: tile.column, leaseID: lease.leaseId,
                    timestamp: clock(), requestID: UUID(), key: signingKey)
`]]);
// Compile as part of the existing Xcode target; no project or package resolver change.
writeFileSync(join(out, transport), readFileSync(join(out, transport), 'utf8') +
  '\n' + fixed.replace('import CryptoKit\nimport Foundation\n', ''));
const harness = 'Harness/Harness.swift';
const old = readFileSync(new URL(harness, root), 'utf8').replaceAll('\r\n', '\n');
const begin = old.indexOf('        let path = url.path');
const end = old.indexOf('        DispatchQueue.main.async', begin);
assert.ok(begin > 0 && end > begin);
rewrite(harness, [[old.slice(begin, end), `        guard request.httpMethod == "POST", url.absoluteString == Self.origin + "/v1/imagery-labels/tile",
              request.value(forHTTPHeaderField: "Content-Type") == "application/json",
              request.value(forHTTPHeaderField: "X-Gridly-Pilot-Ingress") == nil,
              let body = request.httpBody ?? Self.read(request.httpBodyStream), body.count <= 64,
              let coordinates = try? JSONDecoder().decode(Coordinates.self, from: body),
              let scheme = URL(string: "gridly-label://pilot/tile/\\(coordinates.level)/\\(coordinates.row)/\\(coordinates.column)"),
              let tile = LabelTile(url: scheme, method: "GET"),
              let id = request.value(forHTTPHeaderField: "X-Gridly-Labels-Lease"), let leaseUUID = UUID(uuidString: id),
              let stamp = request.value(forHTTPHeaderField: "X-Gridly-Labels-Timestamp").flatMap(Int64.init),
              stamp > now - 30_000, stamp < now + 30_000,
              let nonce = request.value(forHTTPHeaderField: "X-Gridly-Labels-Request"), let requestUUID = UUID(uuidString: nonce),
              let encoded = request.value(forHTTPHeaderField: "X-Gridly-Labels-Signature"), encoded.count == 86,
              let raw = Self.decode(encoded), let signature = try? P256.Signing.ECDSASignature(rawRepresentation: raw),
              let payload = try? FixedPathTile.payload(origin: Self.origin, level: tile.level, row: tile.row,
                  column: tile.column, leaseID: leaseUUID, timestamp: stamp, requestID: requestUUID),
              body == payload.body,
              Self.consume(id: id, nonce: nonce, now: now, signature: signature, proof: payload.proof)
        else { fail(); return }
        Self.logger.notice("PILOT_FIXED_POST_VERIFIED")
`], ['    private struct Lease {', `    private struct Coordinates: Decodable {
        let level: Int
        let row: Int
        let column: Int
    }
    private struct Lease {`]]);
