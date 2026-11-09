import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createDecipheriv,createHash,generateKeyPairSync,verify} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import test from 'node:test';
import {deriveIosMaintenanceInputs,maintenanceIosIdentity,PROFILE,RELEASES} from '../../tools/arcgis-maintenance/contracts.mjs';
import {sealBuild18Candidate} from '../../tools/arcgis-maintenance/build18-candidate.mjs';
import {alignIOSDeploymentFloor} from '../../tools/ios-deployment-floor.mjs';
import {originalBytes,candidateBytes,fixture} from './fixtures.mjs';

const projectPath='ios/App/App.xcodeproj/project.pbxproj';
const bridgePath='ios/App/App/GridlyBridgeViewController.swift';
const viewPath='ios/App/App/GridlyBuild18DiagnosticViewController.swift';
const adapterPath='tools/arcgis-maintenance/native/ios/GridlyLabelDiagnostic.swift';
const importPath='ios/App/App/GridlyBuild18Candidate.swift';
const plistPath='ios/App/App/Info.plist';
const schemePath='ios/App/App.xcodeproj/xcshareddata/xcschemes/GridlyBuild18Diagnostics.xcscheme';
const read=async path=>(await readFile(path,'utf8')).replaceAll('\r\n','\n');
const released=path=>execFileSync('git',['show',RELEASES.ios+':'+path],{encoding:'utf8'});

test('Build 18 changes only reviewed metadata, recovery allowlist and opt-in diagnostic wiring',async()=>{
  const expected=deriveIosMaintenanceInputs({project:released(projectPath),recovery:released(bridgePath)});
  const project=await read(projectPath), recovery=await read(bridgePath);
  const withoutHostedTests=project
    .replace(/^\t\tA18D1A70000000000000000[0-9A-F] .* = \{\n[\s\S]*?^\t\t\};\n/gm,'')
    .replace(/^\t{5}A18D1A700000000000000006 = \{\n[\s\S]*?^\t{5}\};\n/gm,'')
    .replace(/^.*A18D1A70000000000000000[0-9A-F].*\n/gm,'')
    .replace(/\/\* Begin (PBXContainerItemProxy|PBXTargetDependency) section \*\/\n\/\* End \1 section \*\/\n\n/g,'');
  const references=withoutHostedTests.split('\n').filter(line=>/^\s*A18D1A60000000000000000[1-4] /.test(line));
  assert.equal(references.length,8);
  assert.equal(withoutHostedTests.split('\n').filter(line=>!references.includes(line)).join('\n'),expected.project);
  assert.equal(recovery.replace('        #if GRIDLY_BUILD18_DIAGNOSTIC && GRIDLY_ARCGIS_DIAGNOSTIC\n        GridlyBuild18DiagnosticViewController.install(on: self)\n        #endif\n',''),expected.recovery);
  assert.doesNotMatch(project,/GRIDLY_BUILD18_DIAGNOSTIC|GRIDLY_ARCGIS_DIAGNOSTIC/);
  assert.equal((await read(plistPath)).replace('\t<key>GridlyBuild18OwnerPublicKey</key>\n\t<string>$(GRIDLY_BUILD18_OWNER_PUBLIC_KEY)</string>\n',''),released(plistPath));
  assert.match(project,/A18D1A700000000000000007 .*? = \{[\s\S]*?A18D1A700000000000000003 .*?Build18DiagnosticTests.swift in Sources/);
  assert.match(project,/504EC3001FED79650016851F .*? = \{[\s\S]*?A18D1A700000000000000001 .*?GridlyBuild18Candidate.swift in Sources/);
  assert.match(project,/productType = "com.apple.product-type.bundle.unit-test"/);
  assert.match(project,/BUNDLE_LOADER = "\$\(TEST_HOST\)"/);
  assert.match(project,/TEST_HOST = "\$\(BUILT_PRODUCTS_DIR\)\/App.app\/App"/);
  assert.match(project,/SUPPORTED_PLATFORMS = iphonesimulator/);
  const scheme=await read(schemePath);
  assert.equal((scheme.match(/buildForArchiving="NO"/g)||[]).length,2);
  assert.match(scheme,/<TestAction buildConfiguration="Debug"/);
  assert.match(scheme,/<TestableReference skipped="NO" parallelizable="NO">[\s\S]*?BlueprintIdentifier="A18D1A700000000000000006"/);
  // The production candidate staging path must still refuse this diagnostic project.
  assert.throws(()=>maintenanceIosIdentity({project,recovery,profile:PROFILE}),/MAINTENANCE_IOS_/);
});

test('iOS post-sync hook preserves the exact 16.4 manifest with and without the Build 18 test target',async t=>{
  const {root,dispose}=await fixture();
  t.after(dispose);
  const project=join(root,projectPath);
  const spmPath='ios/App/CapApp-SPM/Package.swift';
  const spm=join(root,spmPath);
  await mkdir(dirname(project),{recursive:true});
  await mkdir(dirname(spm),{recursive:true});
  const approved=await read(spmPath);
  const generated=approved.replace('.iOS("16.4")','.iOS(.v16)');
  assert.notEqual(generated,approved);
  const withTests=await read(projectPath);
  for(const source of [released(projectPath),withTests]){
    await writeFile(project,source);
    await writeFile(spm,generated);
    await alignIOSDeploymentFloor(root);
    assert.equal(await read(spm),approved);
    await alignIOSDeploymentFloor(root);
    assert.equal(await read(spm),approved);
  }
  for(const [source,error] of [
    [withTests.replace('name = GridlyBuild18Tests;','name = UnreviewedTests;'),/all four/],
    [withTests.replace('IPHONEOS_DEPLOYMENT_TARGET = 16.4;','IPHONEOS_DEPLOYMENT_TARGET = 16.3;'),/all six/],
    [withTests.replace('IPHONEOS_DEPLOYMENT_TARGET = 16.4;',''),/all six/]
  ]){
    await writeFile(project,source);
    await writeFile(spm,generated);
    await assert.rejects(alignIOSDeploymentFloor(root),error);
    assert.equal(await read(spm),generated);
  }
});

test('Build 18 candidate can only be imported from the owner screen and never reaches JavaScript',async()=>{
  const view=await read(viewPath);
  const importer=await read(importPath);
  assert.ok(view.startsWith('#if GRIDLY_BUILD18_DIAGNOSTIC && GRIDLY_ARCGIS_DIAGNOSTIC\n'));
  assert.match(view,/CFBundleVersion"\) as\? String == "18"/);
  assert.match(view,/gesture\.state == \.began/);
  assert.match(view,/candidate: "SYNTHETIC_BUILD18_LABELS"/);
  assert.match(view,/selectSyntheticTransport\(\{ png \}\)/);
  assert.match(view,/viewWillDisappear[\s\S]*?diagnostic\?\.stop\(\)/);
  assert.doesNotMatch(view+importer,/runtimeConfig|URLSession|evaluateJavaScript|UIPasteboard|localStorage|UserDefaults|startDownloadingUbiquitousItem/);
  assert.match(view,/UIDocumentPickerViewController\(forOpeningContentTypes: \[\.data\], asCopy: false\)/);
  assert.match(view,/isSecureTextEntry = true/);
  assert.match(view,/Approve native diagnostic[\s\S]*?field\.text = nil[\s\S]*?self\?\.acceptGrant\(grant\)/);
  const decode=view.indexOf('GridlyBuild18Candidate.open(');
  const provision=view.indexOf('GridlyLabelDiagnostic.provision(run: unlocked.run');
  const authorize=view.indexOf('adapter.authorizeProviderTransport(');
  assert.ok(decode>=0 && decode<provision && provision<authorize);
  assert.equal((view.match(/\.authorizeProviderTransport\(/g)||[]).length,1);
  assert.match(view,/#if !targetEnvironment\(simulator\)[\s\S]*?verificationKey\(in: \.main\) != nil/);
  assert.match(view,/resignActive\(\)[\s\S]*?pendingEnvelope = nil[\s\S]*?diagnostic\?\.stop\(\)/);
  assert.match(importer,/startAccessingSecurityScopedResource\(\)[\s\S]*?defer \{ url.stopAccessingSecurityScopedResource\(\) \}/);
  assert.match(importer,/O_RDONLY \| O_NOFOLLOW \| O_NONBLOCK \| O_CLOEXEC/);
  assert.match(importer,/owner\.isValidSignature\(signature, for: authorization\)[\s\S]*?AES\.GCM\.open/);
  assert.match(importer,/Data\(SHA256.hash\(data: token\)\) == digest/);
});

test('native send and terminal persistence retain the required ordering',async()=>{
  const source=await read(adapterPath);
  const reserve=source.indexOf('let ordinal = try self.budget.reserve()');
  const ready=source.indexOf('case .ready:');
  const send=source.indexOf('connection.send(content:');
  assert.ok(reserve>=0 && reserve<ready && ready<send);
  assert.match(source.slice(ready,send),/self\.providerAllowed, self\.armed, !self\.stopped, self\.inFlight, self\.connection === connection,\s+self\.cancellation\.whileActive\(\{/);
  assert.match(source,/#if GRIDLY_BUILD18_DIAGNOSTIC && !targetEnvironment\(simulator\)[\s\S]*?let interval = min\(300, expires\.timeIntervalSinceNow\)/);
  assert.match(source,/self\.providerAllowed, self\.cancellation\.whileActive\(\{ connection\.start\(queue: self\.queue\) \}\)/);
  assert.match(source,/func stop\(\) \{\s+cancellation\.cancel\(\)\s+queue\.async/);
  assert.match(source,/func endFlight\(stopping: Bool\) throws \{\s+guard flightHeld[\s\S]*?_ = try change\(stopping \? \.stop : \.complete\)\s+guard unlink[\s\S]*?flightHeld = false/);
  assert.match(source,/guard fsync\(fd\) == 0 else \{ throw DiagnosticFailure\.stopped \}\s+return operation == \.reserve/);
  assert.match(source,/let available = !terminal && \(tail\.isEmpty \|\| tail == "1\\nOK\\n"\)/);
  assert.match(source,/requestSlot\.wait\(timeout: \.now\(\)\)/);
  assert.match(source,/willResignActiveNotification/);
  assert.match(source,/asyncAfter\(deadline: \.now\(\) \+ 10/);
});

test('private writer signs a fresh authenticated envelope containing only the replacement token',()=>{
  const owner=generateKeyPairSync('ed25519'), outsider=generateKeyPairSync('ed25519');
  const run='owner-0123456789abcdef0123456789abcdef';
  const options={originalBytes,candidateBytes,run,signingKey:owner.privateKey,now:1794255000000};
  const {envelope,grant}=sealBuild18Candidate(options);
  const second=sealBuild18Candidate(options);
  const [boundRun,digest,key,signature]=grant.split('.');
  assert.equal(boundRun,run);
  assert.match(grant,/^owner-[a-f0-9]{32}\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{128}$/);
  assert.notDeepEqual(second.envelope.subarray(0,12),envelope.subarray(0,12));
  assert.notEqual(second.grant.split('.')[2],key);
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const auth=(file,fields=[boundRun,digest,key])=>Buffer.from(['GRIDLY_BUILD18_OWNER_GRANT_V1',...fields,hash(file),''].join('\n'));
  const sig=Buffer.from(signature,'hex');
  assert.equal(verify(null,auth(envelope),owner.publicKey,sig),true);
  assert.equal(verify(null,auth(envelope),outsider.publicKey,sig),false);
  assert.equal(verify(null,auth(envelope,[run,digest,'00'.repeat(32)]),owner.publicKey,sig),false);
  const decrypt=(file,build='18',id=run,decryptKey=key,identity=digest)=>{
    const decipher=createDecipheriv('aes-256-gcm',Buffer.from(decryptKey,'hex'),file.subarray(0,12));
    decipher.setAAD(Buffer.from(['GRIDLY_BUILD18_CANDIDATE_V1','com.gridlygo.gridly','1.0.2',build,id,identity,''].join('\n')));
    decipher.setAuthTag(file.subarray(-16));
    return Buffer.concat([decipher.update(file.subarray(12,-16)),decipher.final()]).toString('ascii');
  };
  const token='SYNTHETIC_REPLACEMENT_LABELS';
  assert.equal(decrypt(envelope),'1794255900\n'+token);
  assert.equal(digest,hash(token));
  assert.ok(!envelope.includes(token) && !grant.includes(token));
  assert.throws(()=>decrypt(envelope,'17'));
  assert.throws(()=>decrypt(envelope,'18','owner-'+'0'.repeat(32)));
  assert.throws(()=>decrypt(envelope,'18',run,'00'.repeat(32)));
  assert.throws(()=>decrypt(envelope,'18',run,key,'00'.repeat(32)));
  const tampered=Buffer.from(envelope); tampered[tampered.length-1]^=1;
  assert.equal(verify(null,auth(tampered),owner.publicKey,sig),false);
  assert.throws(()=>decrypt(tampered));
});

test('private writer refuses original fallback, DriveTexas drift, and missing owner authority',()=>{
  const {privateKey}=generateKeyPairSync('ed25519');
  const options={originalBytes,candidateBytes,run:'owner-0123456789abcdef0123456789abcdef',signingKey:privateKey};
  assert.throws(()=>sealBuild18Candidate({...options,candidateBytes:originalBytes}),/MAINTENANCE_CANDIDATE_EQUALS_ORIGINAL/);
  const drift=Buffer.from(candidateBytes.toString().replace('SYNTHETIC_DRIVETEXAS','SYNTHETIC_CHANGED'));
  assert.throws(()=>sealBuild18Candidate({...options,candidateBytes:drift}),/MAINTENANCE_UNRELATED_PROVIDER_CHANGED/);
  assert.throws(()=>sealBuild18Candidate({...options,signingKey:undefined}),/BUILD18_PRIVATE_INPUT_REJECTED/);
  assert.throws(()=>sealBuild18Candidate({...options,run:'wrong-run'}),/BUILD18_PRIVATE_INPUT_REJECTED/);
});
