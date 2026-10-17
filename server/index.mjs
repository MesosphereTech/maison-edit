import { createServer as nodeServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { InputError, createShoppingGuide, createSceneAdapter, publicAIStatus } from './google-ai.mjs';
import { createCodexAdapters } from './codex-cli.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const maxBodyBytes = 16 * 1024;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf' };
function sendJSON(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}
function originValue(value) {
  if (!value) return '';
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && url.origin === value ? value : ''; } catch { return ''; }
}
async function readJSON(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) throw new InputError('Content-Type must be application/json.', 415);
  if (Number(request.headers['content-length']) > maxBodyBytes) throw new InputError('Request exceeds 16 KB.', 413);
  const chunks = []; let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) throw new InputError('Request exceeds 16 KB.', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new InputError('Request must be valid JSON.'); }
}
export function createAppServer({ env = process.env, fetchImpl = fetch, distDir = resolve(root, 'dist/client'), catalog, runCodexImpl } = {}) {
  const codexMode = env.MAISON_AI_PROVIDER === 'codex-cli';
  const codex = codexMode ? createCodexAdapters({ env, ...(catalog ? { catalog } : {}), ...(runCodexImpl ? { runImpl: runCodexImpl } : {}) }) : null;
  const guide = codex?.guide ?? createShoppingGuide({ env, fetchImpl, ...(catalog ? { catalog } : {}) });
  const scene = codex?.scene ?? createSceneAdapter({ env, fetchImpl, ...(catalog ? { catalog } : {}) });
  const status = () => codex?.status() ?? publicAIStatus(env);
  const allowedOrigin = originValue(env.GUIDE_ALLOWED_ORIGIN);
  const rates = new Map();
  let activeAI = 0;
  function rateAllowed(request) {
    // Deliberately do not trust caller-controlled forwarded IP headers.
    const key = request.socket.remoteAddress || 'unknown';
    const now = Date.now();
    for (const [address, entry] of rates) if (entry.until <= now) rates.delete(address);
    if (rates.size >= 1000 && !rates.has(key)) return false;
    const entry = rates.get(key) || { until: now + 60000, count: 0 };
    entry.count++; rates.set(key, entry);
    return entry.count <= 20;
  }
  const server = nodeServer(async (request, response) => {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('x-frame-options', 'DENY');
    response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); } catch { return sendJSON(response, 400, { error: 'Invalid URL.' }); }
    if (pathname === '/healthz' || pathname === '/api/health') {
      if (!['GET', 'HEAD'].includes(request.method)) return sendJSON(response, 405, { error: 'Method not allowed.' });
      return sendJSON(response, 200, { ok: true, service: 'maison-edit', ...status() });
    }
    if (pathname.startsWith('/api/')) {
      // This credential-bearing test bridge is never a network-exposed command service.
      if (codexMode && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) return sendJSON(response, 403, { error: 'CLI testing is loopback-only.' });
      if (codexMode && !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(request.headers.host || '')) return sendJSON(response, 403, { error: 'CLI testing requires a loopback host.' });
      const origin = request.headers.origin;
      const sameOrigin = origin && origin === `${request.socket.encrypted ? 'https' : 'http'}://${request.headers.host}`;
      // Cloud Run terminates TLS before Node. Compare both schemes for this host.
      const cloudSameOrigin = origin && origin === `https://${request.headers.host}`;
      if (origin && !sameOrigin && !cloudSameOrigin && origin !== allowedOrigin) return sendJSON(response, 403, { error: 'Origin not allowed.' });
      if (origin) { response.setHeader('access-control-allow-origin', origin); response.setHeader('vary', 'Origin'); }
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' });
        return response.end();
      }
      if (pathname === '/api/status' && request.method === 'GET') return sendJSON(response, 200, status());
      if (!['/api/guide', '/api/scene', '/api/analyze'].includes(pathname)) return sendJSON(response, 404, { error: 'API route not found.' });
      if (request.method !== 'POST') return sendJSON(response, 405, { error: 'Use POST.' });
      if (!rateAllowed(request) || activeAI >= (codexMode ? 1 : 4)) return sendJSON(response, 429, { error: 'Please wait before another request.', retryAfterSeconds: 60 });
      activeAI++;
      try {
        const body = await readJSON(request);
        const result = await (pathname === '/api/guide' ? guide(body) : pathname === '/api/scene' ? scene(body) : codex ? codex.analyze(body) : { mode: 'unavailable', analyzed: false, externalCall: false, reason: 'analysis_not_configured', uploads: false });
        return sendJSON(response, 200, result);
      } catch (error) {
        request.resume();
        return sendJSON(response, error instanceof InputError ? error.status : 500, { error: error instanceof InputError ? error.message : 'Request could not be completed.', code: error instanceof InputError ? error.code : 'server_error' });
      } finally { activeAI--; }
    }
    if (!['GET', 'HEAD'].includes(request.method)) return sendJSON(response, 405, { error: 'Method not allowed.' });
    if (pathname.includes('\u0000') || pathname.includes('\\') || pathname.split('/').some(segment => segment.startsWith('.'))) return sendJSON(response, 404, { error: 'Not found.' });
    try {
      const base = await realpath(distDir);
      let path = resolve(base, `.${pathname}`);
      if (path !== base && !path.startsWith(`${base}${sep}`)) return sendJSON(response, 404, { error: 'Not found.' });
      try {
        if (!(await stat(path)).isFile()) throw new Error('not a file');
        path = await realpath(path);
        if (!path.startsWith(`${base}${sep}`)) return sendJSON(response, 404, { error: 'Not found.' });
      } catch {
        if (extname(pathname)) return sendJSON(response, 404, { error: 'Not found.' });
        path = await realpath(resolve(base, 'index.html'));
        if (!path.startsWith(`${base}${sep}`)) return sendJSON(response, 404, { error: 'Not found.' });
      }
      const extension = extname(path).toLowerCase();
      if (!mime[extension]) return sendJSON(response, 404, { error: 'Not found.' });
      const contents = await readFile(path);
      const headers = { 'content-type': mime[extension], 'content-length': contents.length, 'accept-ranges': 'bytes', 'cache-control': extension === '.html' ? 'no-cache' : pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600' };
      // Browsers need byte ranges to seek and finish real MP3 recordings.
      // Ignore conditional ranges rather than serving an unverified partial file.
      if (request.method === 'GET' && request.headers.range && !request.headers['if-range']) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        let start = 0, end = contents.length - 1;
        if (match) {
          start = match[1] ? Number(match[1]) : Math.max(0, contents.length - Number(match[2]));
          end = match[1] && match[2] ? Math.min(end, Number(match[2])) : end;
        }
        if (!match || (!match[1] && (!match[2] || Number(match[2]) === 0)) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= contents.length) {
          response.writeHead(416, { 'content-range': `bytes */${contents.length}`, 'content-length': 0, 'accept-ranges': 'bytes' });
          return response.end();
        }
        response.writeHead(206, { ...headers, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${contents.length}` });
        return response.end(contents.subarray(start, end + 1));
      }
      response.writeHead(200, headers);
      response.end(request.method === 'HEAD' ? undefined : contents);
    } catch {
      return sendJSON(response, 503, { error: 'Frontend build unavailable. Run npm run build before starting the server.' });
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
  const server = createAppServer();
  server.listen(port, process.env.MAISON_AI_PROVIDER === 'codex-cli' ? '127.0.0.1' : '0.0.0.0', () => console.log(`MAISON ÉDIT listening on port ${port}. Credentials and shopping requests are never logged.`));
  process.on('SIGTERM', () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 9000).unref(); });
}
