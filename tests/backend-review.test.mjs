import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAppServer } from '../server/index.mjs';
import { createShoppingGuide, publicAIStatus } from '../server/google-ai.mjs';

// Independent review coverage. Every transport is mocked or local loopback.
async function fixture(t, options = {}) {
  const parent = await mkdtemp(join(tmpdir(), 'maison-review-'));
  const distDir = join(parent, 'dist'); await mkdir(distDir);
  await writeFile(join(distDir, 'index.html'), '<html>review</html>');
  await writeFile(join(distDir, 'safe.txt'), 'public');
  await writeFile(join(parent, 'outside.txt'), 'private');
  await symlink(join(parent, 'outside.txt'), join(distDir, 'escape.txt'));
  const server = createAppServer({ env: {}, distDir, fetchImpl: () => { throw new Error('No network allowed'); }, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(parent, { recursive: true, force: true }); });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
const body = { message: 'A serene corner', consent: { googleAI: false } };
const post = (base, overrides = {}) => fetch(`${base}/api/guide`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ...overrides });

test('review: static HEAD, encoded hidden paths, symlinks and unknown extension remain safe', async t => {
  const { base } = await fixture(t);
  const head = await fetch(`${base}/safe.txt`, { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), ''); assert.equal(head.headers.get('content-length'), '6');
  for (const path of ['/escape.txt', '/%2eenv', '/safe.txt%00', '/folder%5cescape.txt', '/missing.js']) {
    const result = await fetch(`${base}${path}`); assert.equal(result.status, 404, path); assert.equal((await result.text()).includes('private'), false);
  }
  const unsupported = await fetch(`${base}/safe.txt`, { method: 'PUT' }); assert.equal(unsupported.status, 405);
  const malformed = await fetch(`${base}/%XX`); assert.equal(malformed.status, 400);
});

test('review: explicit extra origin is allowed, near-match and opaque origins denied', async t => {
  const { base } = await fixture(t, { env: { GUIDE_ALLOWED_ORIGIN: 'https://studio.example' } });
  const allowed = await post(base, { headers: { 'content-type': 'application/json', origin: 'https://studio.example' } });
  assert.equal(allowed.status, 200); assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://studio.example');
  for (const origin of ['null', 'https://studio.example.evil', 'https://studio.example:444']) {
    assert.equal((await post(base, { headers: { 'content-type': 'application/json', origin } })).status, 403);
  }
});

test('review: 20-per-minute request bound does not trust spoofed forwarding addresses', async t => {
  const { base } = await fixture(t);
  for (let index = 0; index < 20; index++) {
    const response = await post(base, { headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${index}` } });
    assert.equal(response.status, 200);
  }
  const limited = await post(base, { headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.200' } });
  assert.equal(limited.status, 429); assert.equal((await limited.json()).retryAfterSeconds, 60);
});

test('review: malformed configuration and empty eligibility never trigger a provider call', async () => {
  const never = () => { throw new Error('No network allowed'); };
  const bad = { GEMINI_API_KEY: 'mock-only', GEMINI_MODEL: 'https://evil.example/model' };
  const result = await createShoppingGuide({ env: bad, fetchImpl: never })({ ...body, consent: { googleAI: true } });
  assert.equal(result.externalCall, false); assert.equal(result.warning, 'model_not_configured');
  assert.equal(publicAIStatus(bad).guide, 'demo');
  const empty = await createShoppingGuide({ env: { GEMINI_API_KEY: 'mock-only', GEMINI_MODEL: 'gemini-test' }, fetchImpl: never })({ ...body, consent: { googleAI: true }, context: { budget: 0 } });
  assert.equal(empty.warning, 'no_catalog_matches'); assert.equal(empty.externalCall, false); assert.deepEqual(empty.productIds, []);
});

test('review: chunked oversized provider response and provider failure never expose private text', async () => {
  const env = { GEMINI_API_KEY: 'mock-only', GEMINI_MODEL: 'gemini-test' };
  const input = { ...body, consent: { googleAI: true } };
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(128 * 1024 + 1))); controller.close(); } });
  const oversized = await createShoppingGuide({ env, fetchImpl: async () => new Response(stream) })(input);
  assert.equal(oversized.warning, 'response_too_large'); assert.equal(oversized.mode, 'demo');
  const failed = await createShoppingGuide({ env, fetchImpl: async () => new Response('PRIVATE-UPSTREAM-TEXT', { status: 500 }) })(input);
  assert.equal(failed.warning, 'provider_error'); assert.equal(JSON.stringify(failed).includes('PRIVATE-UPSTREAM-TEXT'), false);
});

test('review: provider concurrency is capped and slots are released after completion', async t => {
  let entered = 0; let signalReady; let release;
  const ready = new Promise(resolve => { signalReady = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const fetchImpl = async () => {
    entered++; if (entered === 4) signalReady();
    await blocked;
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ reply: 'A serene corner with quiet texture.', recommendations: [] }) }] } }] }));
  };
  const { base } = await fixture(t, { env: { GEMINI_API_KEY: 'mock-only', GEMINI_MODEL: 'gemini-test', GEMINI_TIMEOUT_MS: '1000' }, fetchImpl });
  const live = () => post(base, { body: JSON.stringify({ ...body, consent: { googleAI: true } }) });
  const pending = Array.from({ length: 4 }, live);
  await ready;
  assert.equal((await live()).status, 429);
  release();
  const completed = await Promise.all(pending);
  for (const response of completed) { assert.equal(response.status, 200); assert.equal((await response.json()).mode, 'gemini'); }
  const resumed = await live(); assert.equal(resumed.status, 200); assert.equal((await resumed.json()).mode, 'gemini');
});
