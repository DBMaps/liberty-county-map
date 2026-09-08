// Exact locally reviewed LP244.21E runtime content; not a blanket runtime exemption.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const reviewed = {
  "index.html": "38a01c7e1d617042432b40b100efa487e4da4254e9f590593946badb6fb9ad2c",
  "js/app.js": "6478cac278e99bf2bc3197c7f352c8d138b5d36108f6950df32d55d0f1df360f",
  "service-worker.js": "9614f39ca139bc844fdaab7e467c79535b2514b79dcb966e08b84cbc3f83fc96"
};
export function assertAuthorizedRetentionRuntime() {
  const changed=execFileSync('git',['diff','HEAD','--name-only','--','index.html','js/app.js','manifest.json','service-worker.js','android','ios'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
  for(const path of changed) {
    assert.ok(Object.hasOwn(reviewed,path), 'Unapproved protected-file change: '+path);
    const hash=createHash('sha256').update(readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex');
    assert.equal(hash,reviewed[path], 'Runtime changed beyond reviewed retention protocol: '+path);
  }
}
