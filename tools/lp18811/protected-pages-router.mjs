// Cloudflare Pages advanced-mode worker for the protected preview only.
// The asset binding is always authoritative; the SPA shell is consulted only
// after an HTML navigation misses every staged static file.
export async function routeProtectedPreview(request, env) {
  const assetResponse = await env.ASSETS.fetch(request);
  const method = request.method.toUpperCase();
  const acceptsHtml = request.headers.get('accept')?.split(',').some(value =>
    value.trim().split(';', 1)[0].toLowerCase() === 'text/html'
  );
  const requestedPath = new URL(request.url).pathname;
  const unexpectedSpaShell = assetResponse.status >= 200 && assetResponse.status < 300 &&
    assetResponse.headers.get('content-type')?.toLowerCase().startsWith('text/html') &&
    requestedPath !== '/' && requestedPath !== '/index.html';
  if (assetResponse.status !== 404 && !unexpectedSpaShell) return assetResponse;

  // Fail closed if Pages ever substitutes its HTML shell despite the staged
  // 404 control. A non-HTML asset request must never receive that shell as 200.
  if (!['GET', 'HEAD'].includes(method) || !acceptsHtml) {
    return unexpectedSpaShell ? new Response('Not Found', {status: 404}) : assetResponse;
  }

  const indexRequest = new Request(new URL('/index.html', request.url), request);
  return env.ASSETS.fetch(indexRequest);
}

export default { fetch: routeProtectedPreview };
