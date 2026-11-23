import { leasePath, safe } from './protocol.mjs';

const maxRequestBytes = 48 * 1024;
const proofHeaders = ['x-gridly-labels-lease', 'x-gridly-labels-timestamp',
  'x-gridly-labels-request', 'x-gridly-labels-signature'];

function send(res, result) {
  if (res.destroyed || res.writableEnded) return;
  const { status, body, ...rest } = result;
  const png = status === 200 && Buffer.isBuffer(body);
  const bytes = png ? body : Buffer.from(JSON.stringify(rest));
  res.writeHead(status, { 'content-type': png ? 'image/png' : 'application/json; charset=utf-8',
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-length': bytes.length });
  res.end(bytes);
}

async function leaseBody(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw Error('content_type');
  const parts = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > maxRequestBytes) throw Error('body_limit');
    parts.push(part);
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts, size)));
}

// No listener or provider is started here. The future HTTPS host must apply
// pre-auth ingress limits and preserve the raw origin-form request target.
export function createNodeHandler(gateway) {
  return async (req, res) => {
    const abort = new AbortController();
    res.once('close', () => abort.abort());
    const deadline = setTimeout(() => {
      abort.abort();
      if (!req.complete) res.once('finish', () => req.destroy());
      send(res, safe(504, 'request_timeout'));
    }, 8000);
    try {
      if (req.url === leasePath) {
        if (req.method !== 'POST') return send(res, safe(405, 'method_not_allowed'));
        const evidence = await leaseBody(req);
        if (!abort.signal.aborted) send(res, await gateway.issueLease(evidence, abort.signal));
        return;
      }
      const headers = proofHeaders.map(name => req.headersDistinct[name]);
      if (headers.some(values => values && values.length !== 1)) return send(res, safe(400, 'invalid_request'));
      const [leaseId, stamp, requestId, signature] = headers.map(values => values?.[0]);
      const timestamp = typeof stamp === 'string' && /^(0|[1-9][0-9]{0,15})$/.test(stamp) &&
        String(Number(stamp)) === stamp ? Number(stamp) : NaN;
      send(res, await gateway.requestTile({ method: req.method, target: req.url, leaseId, timestamp, requestId,
        signature, signal: abort.signal }));
    } catch {
      send(res, safe(400, 'invalid_request'));
    } finally {
      clearTimeout(deadline);
    }
  };
}
