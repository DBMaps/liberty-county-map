import {createHash} from 'node:crypto';
// Canonical contract bytes: UTF-8 text with CRLF represented as LF. No trim or other transformation.
export function canonicalContractHash(text) {
 if(typeof text !== 'string') throw new TypeError('Contract must be UTF-8 text');
 return createHash('sha256').update(text.replaceAll('\r\n','\n'),'utf8').digest('hex');
}
