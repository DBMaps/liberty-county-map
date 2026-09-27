// SYNTHETIC_CONTINUITY_CERTIFICATION: actual installed getter, fixed JSON only.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
export function numericProbeSource(sdk) {
 const start=sdk.indexOf('    public func getDouble(_ key: String) -> Double? {'),end=sdk.indexOf('\n    }',start);
 if(start<0||end<0)throw Error('Installed iOS numeric getter changed');
 const getter=sdk.slice(start,end+6).replace('public func','func');
 return `import Foundation
struct NumericProbe {
    var jsObjectRepresentation: [String: Any]
${getter}
}
let bytes = Data(#"{"verifiedAt":1770000000000}"#.utf8)
let decoded = try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
let probe = NumericProbe(jsObjectRepresentation: decoded)
precondition(decoded["verifiedAt"] is NSNumber)
precondition(probe.getDouble("verifiedAt") == 1770000000000.0)
precondition(NumericProbe(jsObjectRepresentation: ["verifiedAt": NSNumber(value: 1770000000000 as Int64)]).getDouble("verifiedAt") == 1770000000000.0)
precondition(probe.getDouble("missing") == nil)
precondition(NumericProbe(jsObjectRepresentation: ["verifiedAt": "invalid"]).getDouble("verifiedAt") == nil)
print("IOS_NUMERIC_CONTRACT_PASS: JSON/NSNumber integral milliseconds accepted; missing/string rejected")
`;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 if(process.platform!=='darwin')throw Error('Run only on existing Mac Swift toolchain; no installation');
 const sdk=await readFile(new URL('../../node_modules/@capacitor/ios/Capacitor/Capacitor/JSTypes.swift',import.meta.url),'utf8');
 const result=spawnSync('xcrun',['swift','-'],{input:numericProbeSource(sdk),encoding:'utf8',timeout:60000});
 if(result.error||result.status!==0){console.error('IOS_NUMERIC_CONTRACT_FAILED: stop; no runtime acceptance claimed');process.exitCode=1;}
 else if(result.stdout.trim()==='IOS_NUMERIC_CONTRACT_PASS: JSON/NSNumber integral milliseconds accepted; missing/string rejected')console.log(result.stdout.trim());
 else {console.error('IOS_NUMERIC_CONTRACT_FAILED: unexpected output');process.exitCode=1;}
}
