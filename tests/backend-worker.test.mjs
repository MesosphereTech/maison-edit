import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorker } from '../server/worker.mjs';

// All provider calls below use fake transport. No credential, Google call or billing is involved.
const origin = 'https://maison.example.test';
const headers = { 'oai-authenticated-user-id': 'synthetic-owner', 'content-type': 'application/json', origin };
const input = { message: 'A calm tailored look', language: 'en', context: { category: 'women', budget: 5000 }, consent: { googleAI: true } };
const liveEnv = { GEMINI_API_KEY: 'synthetic-key', GEMINI_MODEL: 'gemini-test-model' };
const answer = { reply: 'A considered tailored foundation.', recommendations: [{ productId: 'ME-001', reason: 'Quiet tailoring anchors the look.' }] };
const providerResponse = () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(answer) }] } }] }));
const request = (path = '/api/guide', body = input, extra = {}) => new Request(origin + path, { method: 'POST', headers, body: JSON.stringify(body), ...extra });
const get = path => new Request(origin + path, { headers });

test('Worker API requires Sites-supplied identity and same-origin requests before any provider call', async () => {
  let calls = 0; const worker = createWorker({ fetchImpl: () => { calls++; throw Error('must not call'); } });
  for (const path of ['/api/status', '/api/health', '/healthz', '/api/guide']) assert.equal((await worker.fetch(new Request(origin + path), liveEnv)).status, 401);
  assert.equal((await worker.fetch(request('/api/guide', input, { headers: { ...headers, origin: 'https://evil.example.test' } }), liveEnv)).status, 403);
  assert.equal((await worker.fetch(request('/api/guide', input, { headers: { ...headers, 'sec-fetch-site': 'cross-site' } }), liveEnv)).status, 403);
  assert.equal(calls, 0);
});

test('Worker no-key and denied-consent paths are labeled demo and never call Google', async () => {
  let calls = 0; const worker = createWorker({ fetchImpl: () => { calls++; throw Error('must not call'); } });
  const missing = await (await worker.fetch(request(), {})).json();
  const denied = await (await worker.fetch(request('/api/guide', { ...input, consent: { googleAI: false } }), liveEnv)).json();
  assert.equal(missing.mode, 'demo'); assert.equal(missing.externalCall, false); assert.equal(missing.warning, 'not_configured');
  assert.equal(denied.mode, 'demo'); assert.equal(denied.warning, 'consent_required'); assert.equal(calls, 0);
});

test('Worker status distinguishes configuration from an actually validated mocked provider result', async () => {
  let calls = 0; const worker = createWorker({ fetchImpl: async () => { calls++; return providerResponse(); } });
  const initial = await (await worker.fetch(get('/api/status'), liveEnv)).json();
  assert.equal(initial.configured, true); assert.equal(initial.usable, false); assert.equal(initial.connection, 'unverified'); assert.equal(calls, 0);
  const result = await (await worker.fetch(request(), liveEnv)).json();
  assert.equal(result.mode, 'gemini'); assert.equal(result.externalCall, true); assert.equal(result.products[0].price, 3280); assert.equal(calls, 1);
  const status = await (await worker.fetch(get('/api/status'), liveEnv)).json();
  assert.equal(status.connection, 'verified'); assert.equal(status.usable, true);
  assert.equal(JSON.stringify(status).includes('synthetic-key'), false);
});

test('Worker provider rejection remains explicit demo fallback without provider error text', async () => {
  const worker = createWorker({ fetchImpl: async () => new Response('private upstream message', { status: 429 }) });
  const result = await (await worker.fetch(request(), liveEnv)).json();
  assert.equal(result.mode, 'demo'); assert.equal(result.warning, 'provider_rate_limited'); assert.equal(result.externalCall, true);
  const status = await (await worker.fetch(get('/api/status'), liveEnv)).json();
  assert.equal(status.connection, 'blocked'); assert.equal(status.usable, false); assert.equal(JSON.stringify(status).includes('private upstream'), false);
});

test('Worker clears usable status when a later provider request fails', async () => {
  let healthy = true;
  const worker = createWorker({ fetchImpl: async () => healthy ? providerResponse() : new Response('private', { status: 500 }) });
  await worker.fetch(request(), liveEnv);
  assert.equal((await (await worker.fetch(get('/api/status'), liveEnv)).json()).usable, true);
  healthy = false;
  await worker.fetch(request(), liveEnv);
  const status = await (await worker.fetch(get('/api/status'), liveEnv)).json();
  assert.equal(status.usable, false); assert.equal(status.connection, 'blocked');
});

test('Worker bounds concurrent provider work and releases slots after completion', async () => {
  const waiting = [];
  const worker = createWorker({ fetchImpl: () => new Promise(resolve => waiting.push(resolve)) });
  const pending = Array.from({ length: 4 }, () => worker.fetch(request(), liveEnv));
  while (waiting.length < 4) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal((await worker.fetch(request(), liveEnv)).status, 429);
  waiting.splice(0).forEach(resolve => resolve(providerResponse()));
  assert.ok((await Promise.all(pending)).every(response => response.status === 200));
  const next = worker.fetch(request(), liveEnv);
  while (!waiting.length) await new Promise(resolve => setTimeout(resolve, 1));
  waiting.pop()(providerResponse());
  assert.equal((await next).status, 200);
});

test('Worker validates content type, bytes, JSON, unknown routes and unsupported image analysis', async () => {
  const worker = createWorker(); const env = {};
  assert.equal((await worker.fetch(request('/api/guide', input, { headers: { ...headers, 'content-type': 'text/plain' } }), env)).status, 415);
  assert.equal((await worker.fetch(request('/api/guide', input, { body: '{bad' }), env)).status, 400);
  assert.equal((await worker.fetch(request('/api/guide', input, { body: JSON.stringify({ message: 'x'.repeat(17000) }) }), env)).status, 413);
  assert.equal((await worker.fetch(request('/api/guide', input, { body: JSON.stringify({ message: '漢'.repeat(6000) }) }), env)).status, 413);
  assert.equal((await worker.fetch(get('/api/missing'), env)).status, 404);
  assert.equal((await worker.fetch(get('/api/guide'), env)).status, 405);
  const analysis = await (await worker.fetch(request('/api/analyze', {}), env)).json();
  assert.equal(analysis.analyzed, false); assert.equal(analysis.externalCall, false);
});

test('Worker rate guard is keyed to platform identity and ignores forwarded address spoofing', async () => {
  const worker = createWorker(); const env = {};
  for (let i = 0; i < 20; i++) assert.equal((await worker.fetch(request('/api/guide', input, { headers: { ...headers, 'x-forwarded-for': `spoof-${i}` } }), env)).status, 200);
  const limited = await worker.fetch(request(), env); assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '60');
});

test('Worker daily AI-attempt guard is explicit and resets on a new UTC day', async () => {
  let time = 0; let calls = 0;
  const worker = createWorker({ now: () => time, fetchImpl: async () => { calls++; return providerResponse(); } });
  for (let minute = 0; minute < 3; minute++) {
    time = minute * 60001;
    for (let index = 0; index < 20; index++) assert.equal((await worker.fetch(request(), liveEnv)).status, 200);
  }
  time = 4 * 60001;
  const blocked = await worker.fetch(request(), liveEnv);
  assert.equal(blocked.status, 429); assert.equal((await blocked.json()).code, 'daily_ai_limit'); assert.equal(calls, 60);
  time = 86400000;
  assert.equal((await worker.fetch(request(), liveEnv)).status, 200); assert.equal(calls, 61);
});

test('Worker serves Sites ASSETS and falls back to SPA only for extensionless HTML GETs', async () => {
  const calls = []; const env = { ASSETS: { fetch: async req => { const path = new URL(req.url).pathname; calls.push(path); return new Response(path, { status: path === '/index.html' || path === '/assets/app.js' ? 200 : 404 }); } } };
  const worker = createWorker();
  assert.equal((await worker.fetch(new Request(origin + '/assets/app.js'), env)).status, 200);
  assert.equal((await worker.fetch(new Request(origin + '/looks?x=1', { headers: { accept: 'text/html' } }), env)).status, 200);
  assert.equal((await worker.fetch(new Request(origin + '/missing.png', { headers: { accept: 'text/html' } }), env)).status, 404);
  assert.deepEqual(calls, ['/assets/app.js', '/looks', '/index.html', '/missing.png']);
  assert.equal((await worker.fetch(new Request(origin + '/looks', { method: 'POST' }), env)).status, 405);
});

test('Worker runtime source and shared Gemini adapter have no Node imports or Buffer dependency', async () => {
  for (const name of ['worker.mjs', 'google-ai.mjs']) {
    const source = await readFile(new URL('../server/' + name, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /from ['"]node:|\bBuffer\./);
  }
});
