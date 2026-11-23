import assert from 'node:assert/strict';
import {cpSync,readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
if(existsSync(join(root,'gateway/edge.mjs')))throw Error('already assembled');
cpSync(join(root,'reference/prototypes/ios-arcgis-labels-gateway-deploy/supabase/functions/gridly-labels'),join(root,'gateway'),{recursive:true});
const change=(file,from,to)=>{let s=readFileSync(join(root,file),'utf8').replaceAll('\r\n','\n');assert.equal(s.split(from).length,2,from);writeFileSync(join(root,file),s.replace(from,to));};
change('gateway/edge.mjs',"const appId = 'com.gridlygo.prototype.labeltiles.pilot';","const appId = 'com.gridlygo.gridly';");
change('gateway/edge.mjs',"typeof admission?.verifyPaid === 'function' && typeof admission?.verifyAttest === 'function';","typeof admission?.verifyPaid === 'function' && typeof admission?.verifyAttest === 'function' && typeof admission?.issueChallenge === 'function';");
change('gateway/edge.mjs',"if ((challenge && request.body !== null) || (tile && headers.some(name => {","if ((tile && headers.some(name => {");
change('gateway/edge.mjs',`        const expiry = await state.challenge(id);`,
`        let input;
        try {
          if (request.headers.get('content-type') !== 'application/json') throw Error();
          input = JSON.parse(await boundedBody(request, signal, 2048));
        } catch { return respond(safe(400, 'invalid_request')); }
        const authorized = await admission.issueChallenge({ id, input, signal });
        if (!authorized) return respond(denied());
        signal.throwIfAborted();
        const localExpiry = await state.challenge(id);
        signal.throwIfAborted();
        const expiry = localExpiry && Math.min(localExpiry, authorized.expiresAt);`);
// The consumer entrypoint is an inert factory; discard the copied live Deno entrypoint.
writeFileSync(join(root,'gateway/index.ts'),`// Inert candidate only. No Deno.serve, fetch transport, credential read or registry connection.\nexport { createConsumerRuntime } from './consumer-runtime.mjs';\n`);
mkdirSync(join(root,'native'),{recursive:true});
for(const name of ['GridlyStoreKitPlugin.swift','GridlyAppAttestPlugin.swift'])cpSync(join(root,'reference/build18/ios/App/App',name),join(root,'native',name));
const swift='reference/prototypes/ios-arcgis-labels-live-candidate/ios/Sources/GridlyLabelsPilot/';
for(const name of ['HTTPSLabelTransport.swift','LabelTileCore.swift','LabelsSchemeHandler.swift'])cpSync(join(root,swift,name),join(root,'native',name));
cpSync(join(root,'reference/prototypes/ios-arcgis-labels-gateway-deploy/native-fixed-path/Sources/GridlyFixedPathTile/FixedPathTile.swift'),join(root,'native/FixedPathTile.swift'));
change('native/HTTPSLabelTransport.swift','    public let keyFingerprint: String','    public let keyFingerprint: String\n    public let keySPKI: String');
change('native/HTTPSLabelTransport.swift','.init(keyFingerprint: digest(spki), appID: config.appID)','.init(keyFingerprint: digest(spki), keySPKI: base64url(spki), appID: config.appID)');
let transport=readFileSync(join(root,'native/HTTPSLabelTransport.swift'),'utf8');
const begin=transport.indexOf('                let target = "/v1/imagery-labels/'),end=transport.indexOf('                let reply = try await http.send(request, maximumBytes: TilePNG.maximumBytes)',begin);
assert.ok(begin>0&&end>begin);
transport=transport.slice(0,begin)+`                let request = try FixedPathTile.request(origin: configuration.origin,
                    level: tile.level, row: tile.row, column: tile.column, leaseID: lease.leaseId,
                    timestamp: clock(), requestID: UUID(), key: signingKey)
`+transport.slice(end);writeFileSync(join(root,'native/HTTPSLabelTransport.swift'),transport);
change('native/GridlyStoreKitPlugin.swift','    private var observingForeground = false',`    private var observingForeground = false
    @MainActor func labelsEvidence() async throws -> LabelsStoreEvidence {
        let value = await state.current()
        guard value["result"] as? String == "verified", let signed = value["signedTransaction"] as? String,
              value["environment"] as? String == "sandbox/test" else { throw LabelsAuthorizationError.unavailable }
        return LabelsStoreEvidence(signedTransaction: signed)
    }`);
change('native/GridlyAppAttestPlugin.swift','    private let state = GridlyAppAttestState()',`    private let state = GridlyAppAttestState()
    func labelsRegisteredKeyID() async throws -> String { try await state.labelsRegisteredKeyID() }
    func labelsAssertion(digest: Data) async throws -> [String: String] {
        let value = await state.authorize(base64url(digest), requireConfirmed: true)
        guard value["type"] as? String == "apple_assertion", let keyID = value["keyId"] as? String,
              let object = value["object"] as? String else { throw LabelsAuthorizationError.unavailable }
        return ["type": "apple_assertion", "keyId": keyID, "object": object]
    }`);
change('native/GridlyAppAttestPlugin.swift','    func authorize(_ encodedDigest: String?) async -> [String: Any] {',`    func labelsRegisteredKeyID() throws -> String {
        try ensureInstallMarker()
        guard let record = try load(), record.confirmed else { throw Failure.unavailable }
        return record.keyId
    }
    func authorize(_ encodedDigest: String?, requireConfirmed: Bool = false) async -> [String: Any] {`);
change('native/GridlyAppAttestPlugin.swift','            if record == nil {','            if record == nil {\n                guard !requireConfirmed else { throw Failure.unavailable }');
change('native/GridlyAppAttestPlugin.swift','            if current.confirmed {','            if requireConfirmed && !current.confirmed { throw Failure.unavailable }\n            if current.confirmed {');
console.log('Assembled isolated gateway and native copies; reference files untouched.');
