/** Sites-compatible HTTP adapter. No CLI, Node APIs, credentials or live calls at build time. */
import { InputError, createShoppingGuide, createSceneAdapter, publicAIStatus } from './google-ai.mjs';

const MAX_BODY = 16 * 1024;
const json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: {
  'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
  'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', ...extra,
} });

async function readJSON(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new InputError('Content-Type must be application/json.', 415);
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new InputError('Request exceeds 16 KB.', 413);
  if (!request.body) throw new InputError('Request must be valid JSON.');
  const reader = request.body.getReader();
  const chunks = []; let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY) { await reader.cancel(); throw new InputError('Request exceeds 16 KB.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new InputError('Request must be valid JSON.'); }
}

export function createWorker({ fetchImpl = fetch, catalog, now = Date.now } = {}) {
  // Per-isolate safeguards, not a distributed quota or a spending cap.
  const rates = new Map(); const daily = new Map(); let active = 0;
  const states = new WeakMap();
  function adapters(env) {
    let state = states.get(env);
    if (!state) {
      const options = { env, fetchImpl, ...(catalog ? { catalog } : {}) };
      state = { guide: createShoppingGuide(options), scene: createSceneAdapter(options), verified: false, lastFailure: '' };
      states.set(env, state);
    }
    return state;
  }
  function status(env, state) {
    const configured = publicAIStatus(env);
    return { ...configured, configured: configured.guide === 'configured', usable: state.verified,
      connection: state.verified ? 'verified' : state.lastFailure ? 'blocked' : configured.guide === 'configured' ? 'unverified' : 'unconfigured',
      ...(configured.guide === 'configured' ? { model: env.GEMINI_MODEL } : {}),
      ...(state.lastFailure ? { reason: state.lastFailure } : {}), analysis: 'unavailable', hosting: 'sites-worker',
      costControls: { requestsPerMinute: 20, providerAttemptsPerDay: 60, maxConcurrent: 4, maxOutputTokens: 1024, scope: 'per_worker_isolate', monetarySpendCap: false } };
  }
  return {
    async fetch(request, env = {}) {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api/') && url.pathname !== '/healthz') {
        if (!['GET', 'HEAD'].includes(request.method)) return json(405, { error: 'Method not allowed.' });
        if (!env.ASSETS?.fetch) return json(503, { error: 'Frontend assets are unavailable.' });
        const response = await env.ASSETS.fetch(request);
        if (response.status !== 404 || !request.headers.get('accept')?.includes('text/html') || /\.[^/]+$/.test(url.pathname)) return response;
        const index = new URL(request.url); index.pathname = '/index.html'; index.search = '';
        return env.ASSETS.fetch(new Request(index, request));
      }
      // Dispatch supplies this identity. Never expose this Worker outside the Sites access boundary.
      const user = request.headers.get('oai-authenticated-user-id');
      if (!user || user.length > 256) return json(401, { error: 'Sign in to this private Site to use its API.' });
      const origin = request.headers.get('origin');
      if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json(403, { error: 'Origin not allowed.' });
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
      const state = adapters(env);
      if (['/api/status', '/api/health', '/healthz'].includes(url.pathname)) {
        if (!['GET', 'HEAD'].includes(request.method)) return json(405, { error: 'Method not allowed.' });
        return json(200, { ...(url.pathname !== '/api/status' ? { ok: true, service: 'maison-edit' } : {}), ...status(env, state) });
      }
      if (!['/api/guide', '/api/scene', '/api/analyze'].includes(url.pathname)) return json(404, { error: 'API route not found.' });
      if (request.method !== 'POST') return json(405, { error: 'Use POST.' });
      const time = now();
      for (const [key, entry] of rates) if (entry.until <= time) rates.delete(key);
      const rate = rates.get(user) ?? { until: time + 60000, count: 0 };
      if (active >= 4 || rate.count >= 20 || (rates.size >= 1000 && !rates.has(user))) return json(429, { error: 'Please wait before another request.', retryAfterSeconds: 60 }, { 'retry-after': '60' });
      rate.count++; rates.set(user, rate); active++;
      try {
        const body = await readJSON(request);
        if (url.pathname === '/api/analyze') return json(200, { mode: 'unavailable', analyzed: false, externalCall: false, reason: 'analysis_not_configured', uploads: false });
        // Reserve before an eligible provider attempt. No retries or automatic fan-out.
        // These process-local counters reset on isolate replacement, so they are not a hard spend cap.
        if (body?.consent?.googleAI === true && publicAIStatus(env).guide === 'configured') {
          const day = Math.floor(time / 86400000);
          for (const [key, item] of daily) if (item.day !== day) daily.delete(key);
          const item = daily.get(user) ?? { day, count: 0 };
          if (item.count >= 60 || (daily.size >= 1000 && !daily.has(user))) return json(429, { error: 'The private preview has reached its daily AI-attempt allowance.', code: 'daily_ai_limit' });
          item.count++; daily.set(user, item);
        }
        const result = await (url.pathname === '/api/guide' ? state.guide(body) : state.scene(body));
        if (result.mode === 'gemini' && result.externalCall && (result.reply || result.generated)) { state.verified = true; state.lastFailure = ''; }
        else if (result.externalCall) { state.verified = false; state.lastFailure = result.warning || result.reason || 'provider_unavailable'; }
        return json(200, result);
      } catch (error) {
        return json(error instanceof InputError ? error.status : 500, { error: error instanceof InputError ? error.message : 'Request could not be completed.', code: error instanceof InputError ? error.code : 'server_error' });
      } finally { active--; }
    },
  };
}

export default createWorker();
