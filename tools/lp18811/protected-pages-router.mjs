// Cloudflare Pages advanced-mode worker for the protected preview only.
// The asset binding is always authoritative; the SPA shell is consulted only
// after an HTML navigation misses every staged static file.
export async function routeProtectedPreview(request, env) {
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) return assetResponse;

  const method = request.method.toUpperCase();
  const acceptsHtml = request.headers.get('accept')?.split(',').some(value =>
    value.trim().split(';', 1)[0].toLowerCase() === 'text/html'
  );
  if (!['GET', 'HEAD'].includes(method) || !acceptsHtml) return assetResponse;

  const indexRequest = new Request(new URL('/index.html', request.url), request);
  return env.ASSETS.fetch(indexRequest);
}

export default { fetch: routeProtectedPreview };
