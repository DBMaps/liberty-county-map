import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {deriveIosMaintenanceInputs,maintenanceIosIdentity,PROFILE,RELEASES} from '../../tools/arcgis-maintenance/contracts.mjs';

const projectPath='ios/App/App.xcodeproj/project.pbxproj';
const bridgePath='ios/App/App/GridlyBridgeViewController.swift';
const viewPath='ios/App/App/GridlyBuild18DiagnosticViewController.swift';
const adapterPath='tools/arcgis-maintenance/native/ios/GridlyLabelDiagnostic.swift';
const read=async path=>(await readFile(path,'utf8')).replaceAll('\r\n','\n');
const released=path=>execFileSync('git',['show',RELEASES.ios+':'+path],{encoding:'utf8'});

test('Build 18 changes only reviewed metadata, recovery allowlist and opt-in diagnostic wiring',async()=>{
  const expected=deriveIosMaintenanceInputs({project:released(projectPath),recovery:released(bridgePath)});
  const project=await read(projectPath), recovery=await read(bridgePath);
  const references=project.split('\n').filter(line=>/^\s*A18D1A60000000000000000[1-4] /.test(line));
  assert.equal(references.length,8);
  assert.equal(project.split('\n').filter(line=>!references.includes(line)).join('\n'),expected.project);
  assert.equal(recovery.replace('        #if GRIDLY_BUILD18_DIAGNOSTIC && GRIDLY_ARCGIS_DIAGNOSTIC\n        GridlyBuild18DiagnosticViewController.install(on: self)\n        #endif\n',''),expected.recovery);
  assert.doesNotMatch(project,/GRIDLY_BUILD18_DIAGNOSTIC|GRIDLY_ARCGIS_DIAGNOSTIC/);
  // The production candidate staging path must still refuse this diagnostic project.
  assert.throws(()=>maintenanceIosIdentity({project,recovery,profile:PROFILE}),/MAINTENANCE_IOS_/);
});

test('Build 18 owner view cannot load or enable a provider credential',async()=>{
  const view=await read(viewPath);
  assert.ok(view.startsWith('#if GRIDLY_BUILD18_DIAGNOSTIC && GRIDLY_ARCGIS_DIAGNOSTIC\n'));
  assert.match(view,/CFBundleVersion"\) as\? String == "18"/);
  assert.match(view,/gesture\.state == \.began/);
  assert.match(view,/candidate: "SYNTHETIC_BUILD18_LABELS"/);
  assert.match(view,/selectSyntheticTransport\(\{ png \}\)/);
  assert.match(view,/viewWillDisappear[\s\S]*?diagnostic\?\.stop\(\)/);
  assert.doesNotMatch(view,/authorizeProviderTransport|runtimeConfig|readFile|URLSession|evaluateJavaScript|UIPasteboard/);
});

test('native send and terminal persistence retain the required ordering',async()=>{
  const source=await read(adapterPath);
  const reserve=source.indexOf('let ordinal = try self.budget.reserve()');
  const ready=source.indexOf('case .ready:');
  const send=source.indexOf('connection.send(content:');
  assert.ok(reserve>=0 && reserve<ready && ready<send);
  assert.match(source.slice(ready,send),/self\.armed, !self\.stopped, self\.inFlight, self\.connection === connection,\s+self\.cancellation\.whileActive\(\{/);
  assert.match(source,/func stop\(\) \{\s+cancellation\.cancel\(\)\s+queue\.async/);
  assert.match(source,/func endFlight\(stopping: Bool\) throws \{\s+guard flightHeld[\s\S]*?_ = try change\(stopping \? \.stop : \.complete\)\s+guard unlink[\s\S]*?flightHeld = false/);
  assert.match(source,/guard fsync\(fd\) == 0 else \{ throw DiagnosticFailure\.stopped \}\s+return operation == \.reserve/);
  assert.match(source,/let available = !terminal && \(tail\.isEmpty \|\| tail == "1\\nOK\\n"\)/);
  assert.match(source,/requestSlot\.wait\(timeout: \.now\(\)\)/);
  assert.match(source,/willResignActiveNotification/);
  assert.match(source,/asyncAfter\(deadline: \.now\(\) \+ 10/);
});
