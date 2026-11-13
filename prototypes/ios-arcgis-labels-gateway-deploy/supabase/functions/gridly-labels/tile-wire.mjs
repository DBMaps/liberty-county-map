import { audience, parseTileTarget, sha256 } from './foundation/protocol.mjs';

export const tilePath = '/v1/imagery-labels/tile';
export const maxTileBody = 64;
const domain = 'gridly-labels-tile-body-v1';

export function parseTileBody(body) {
  if (typeof body !== 'string' || body.length > maxTileBody) return null;
  const fields = /^\{"level":(0|[1-9][0-9]?),"row":(0|[1-9][0-9]{0,5}),"column":(0|[1-9][0-9]{0,5})\}$/.exec(body);
  if (!fields || fields[0] !== body) return null;
  return parseTileTarget('/v1/imagery-labels/' + fields.slice(1).join('/'));
}

export function tileProofBytes({ leaseId, timestamp, requestId, body }, origin) {
  return Buffer.from(JSON.stringify([audience, domain, 'POST', origin + tilePath,
    sha256(body), leaseId, timestamp, requestId]), 'utf8');
}
