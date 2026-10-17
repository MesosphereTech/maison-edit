import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createShoppingGuide, createSceneAdapter, validateGuideInput, publicAIStatus, InputError } from '../server/google-ai.mjs';
import { createAppServer } from '../server/index.mjs';

// Fixtures and mocked fetch only: these tests never contact Google or need a key.
const catalog = [
  { id: 'ME-001', name: '羊毛西装', en: 'Wool blazer', brand: 'ÉDIT', category: 'women', price: 3280, stock: 8, tags: ['tailored', 'quiet'], color: 'Walnut', kind: 'blazer', description: 'Demo blazer.' },
  { id: 'ME-002', name: '真丝衬衫', en: 'Silk shirt', brand: 'LIGNE', category: 'women', price: 1680, stock: 8, tags: ['soft'], color: 'Ivory', kind: 'shirt', description: 'Demo shirt.' },
  { id: 'ME-017', name: '休闲椅', en: 'Lounge chair', brand: 'OBJET', category: 'home', price: 4980, stock: 8, tags: ['warm', 'artful'], color: 'Terracotta', kind: 'chair', description: 'Demo chair.' }
];
const liveEnv = { GEMINI_API_KEY: 'mock-test-only', GEMINI_MODEL: 'gemini-test-model', GEMINI_TIMEOUT_MS: '50' };
const request = { message: 'A quietly tailored look for a gallery opening', language: 'en', context: { category: 'women', budget: 5000, styleTags: ['quiet'], selectedProductIds: ['ME-001'] }, consent: { googleAI: true } };
const validAnswer = { reply: 'Soft silk balances sculpted tailoring for a considered evening look.', recommendations: [{ productId: 'ME-001', reason: 'A quiet tailored foundation.' }, { productId: 'ME-002', reason: 'Ivory brings softness to walnut.' }] };
function responseFor(value = validAnswer) { return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] }), { status: 200 }); }
const buildGuide = fetchImpl => createShoppingGuide({ env: liveEnv, fetchImpl, catalog });

test('no key returns explicit catalog demo without a network call', async () => {
  let calls = 0;
  const guide = createShoppingGuide({ env: {}, fetchImpl: () => { calls++; throw new Error('must not call'); }, catalog });
  const result = await guide(request);
  assert.equal(calls, 0); assert.equal(result.mode, 'demo'); assert.equal(result.externalCall, false); assert.equal(result.warning, 'not_configured');
  assert.equal(result.source, 'demo_catalog'); assert.equal(result.products[0].price, 3280); assert.equal(result.products[0].inventorySource, 'demo_catalog');
});
test('no model and no consent do not make external calls', async () => {
  const never = () => { throw new Error('must not call'); };
  const missingModel = await createShoppingGuide({ env: { GEMINI_API_KEY: 'mock' }, fetchImpl: never, catalog })(request);
  assert.equal(missingModel.warning, 'model_not_configured');
  const noConsent = await createShoppingGuide({ env: liveEnv, fetchImpl: never, catalog })({ ...request, consent: { googleAI: false } });
  assert.equal(noConsent.warning, 'consent_required'); assert.equal(noConsent.externalCall, false);
});
test('successful Gemini request uses fixed Google endpoint, header key, structured schema and canonical facts', async () => {
  let capture;
  const guide = buildGuide(async (url, options) => { capture = { url, options, body: JSON.parse(options.body) }; return responseFor(); });
  const result = await guide(request);
  assert.equal(result.mode, 'gemini'); assert.equal(result.externalCall, true); assert.equal(result.model, 'gemini-test-model');
  assert.deepEqual(result.productIds, ['ME-001', 'ME-002']); assert.equal(result.products[1].price, 1680); assert.equal(result.products[0].stock, 8);
  assert.equal(capture.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent');
  assert.equal(capture.options.headers['x-goog-api-key'], 'mock-test-only'); assert.equal(capture.options.redirect, 'error');
  assert.equal(capture.body.generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON');
  assert.deepEqual(capture.body.generationConfig.responseFormat.text.schema.properties.recommendations.items.properties.productId.enum, ['ME-001', 'ME-002']);
  assert.equal(JSON.stringify(result).includes('mock-test-only'), false);
});
test('timeout is bounded even when mocked fetch ignores abort', async () => {
  const guide = createShoppingGuide({ env: { ...liveEnv, GEMINI_TIMEOUT_MS: '10' }, fetchImpl: () => new Promise(() => {}), catalog });
  const result = await guide(request);
  assert.equal(result.mode, 'demo'); assert.equal(result.warning, 'provider_timeout'); assert.equal(result.externalCall, true);
});
test('malformed provider JSON returns truthful demo fallback', async () => {
  const result = await buildGuide(async () => new Response('{invalid', { status: 200 }))(request);
  assert.equal(result.mode, 'demo'); assert.equal(result.warning, 'invalid_provider_response');
});
test('malformed model JSON returns truthful demo fallback', async () => {
  const result = await buildGuide(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] })))(request);
  assert.equal(result.mode, 'demo'); assert.equal(result.warning, 'invalid_provider_response');
});
test('unlisted SKU and over-budget SKU never leave the adapter as Gemini recommendations', async () => {
  const unknown = await buildGuide(async () => responseFor({ ...validAnswer, recommendations: [{ productId: 'REAL-SECRET-SKU', reason: 'Looks lovely.' }] }))(request);
  assert.equal(unknown.mode, 'demo'); assert.equal(unknown.warning, 'unlisted_or_ineligible_product'); assert.ok(unknown.productIds.every(id => catalog.some(item => item.id === id)));
  const overBudget = await buildGuide(async () => responseFor())({ ...request, context: { ...request.context, budget: 2000 } });
  assert.equal(overBudget.warning, 'unlisted_or_ineligible_product'); assert.deepEqual(overBudget.productIds, ['ME-002']);
});
test('free-text numeric price or inventory claims are rejected', async () => {
  for (const reply of ['This blazer costs ¥10.', 'These pieces are in stock.', 'Only eight units remaining.', '<script>alert(1)</script>']) {
    const result = await buildGuide(async () => responseFor({ ...validAnswer, reply }))(request);
    assert.equal(result.mode, 'demo'); assert.equal(result.warning, 'unsafe_provider_claim'); assert.notEqual(result.reply, reply);
  }
});
test('fabricated payment, booking and actual-fit claims are rejected in English and Chinese', async () => {
  for (const reply of [
    'I have charged your card and completed your purchase.',
    'Your appointment is booked and confirmed.',
    'This blazer fits you perfectly.',
    '我已为你支付并完成购买。',
    '你的预约已经确认。',
    '这件西装一定合身。',
    'This genuine Prada piece includes silk lining and is made in Italy.'
  ]) {
    const result = await buildGuide(async () => responseFor({ ...validAnswer, reply }))(request);
    assert.equal(result.mode, 'demo'); assert.equal(result.warning, 'unsafe_provider_claim'); assert.notEqual(result.reply, reply);
  }
});
test('recommendation reasons receive the same claim guardrail', async () => {
  const result = await buildGuide(async () => responseFor({ ...validAnswer, recommendations: [{ productId: 'ME-001', reason: 'Your purchase is confirmed.' }] }))(request);
  assert.equal(result.mode, 'demo'); assert.equal(result.warning, 'unsafe_provider_claim');
});
test('blocked response and upstream rate limit are honest fallback modes', async () => {
  const blocked = await buildGuide(async () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } })))(request);
  assert.equal(blocked.warning, 'provider_blocked');
  const limited = await buildGuide(async () => new Response('private provider message', { status: 429 }))(request);
  assert.equal(limited.warning, 'provider_rate_limited'); assert.equal(JSON.stringify(limited).includes('private provider message'), false);
});
test('oversized provider response is rejected without leaking response text', async () => {
  const result = await buildGuide(async () => new Response('ignored', { headers: { 'content-length': '99999999' } }))(request);
  assert.equal(result.warning, 'response_too_large');
});
test('validation rejects photos, measurements, arbitrary fields, unknown SKU and unreasonable input', () => {
  for (const body of [null, { ...request, photo: 'data:image/png;base64,abc' }, { ...request, context: { height: 170 } }, { ...request, context: { selectedProductIds: ['unknown'] } }, { ...request, message: 'x'.repeat(1201) }, { ...request, history: Array(9).fill({ role: 'user', text: 'hello' }) }, { ...request, context: { budget: -1 } }, { ...request, language: 'xx' }]) {
    assert.throws(() => validateGuideInput(body, catalog), InputError);
  }
  assert.equal(validateGuideInput(request, catalog).context.language, 'en');
});
test('department/category aliases must be individually valid and consistent', () => {
  for (const context of [ { category: 'women', department: 'alien' }, { category: 'women', department: 'men' }, { category: null, department: 'women' } ]) {
    assert.throws(() => validateGuideInput({ ...request, context }, catalog), InputError);
  }
  assert.equal(validateGuideInput({ ...request, context: { category: 'women', department: 'women' } }, catalog).context.category, 'women');
  assert.equal(validateGuideInput({ ...request, context: { department: 'home' } }, catalog).context.category, 'home');
});
test('scene generation is explicitly unavailable unless enabled, configured and consented', async () => {
  const never = () => { throw new Error('must not call'); };
  const input = { prompt: 'A serene reading corner', productIds: ['ME-017'], consent: { googleAI: true } };
  const disabled = await createSceneAdapter({ env: {}, fetchImpl: never, catalog })(input);
  assert.equal(disabled.generated, false); assert.equal(disabled.mode, 'unavailable'); assert.equal(disabled.externalCall, false); assert.equal(disabled.reason, 'disabled');
  const unconfigured = await createSceneAdapter({ env: { ENABLE_IMAGE_GENERATION: 'true' }, fetchImpl: never, catalog })(input);
  assert.equal(unconfigured.reason, 'not_configured');
  const unsupported = await createSceneAdapter({ env: { ...liveEnv, ENABLE_IMAGE_GENERATION: 'true', GEMINI_IMAGE_MODEL: 'gemini-made-up-image' }, fetchImpl: never, catalog })(input);
  assert.equal(unsupported.reason, 'unsupported_image_model');
  const noConsent = await createSceneAdapter({ env: { ...liveEnv, ENABLE_IMAGE_GENERATION: 'true', GEMINI_IMAGE_MODEL: 'gemini-3.1-flash-image' }, fetchImpl: never, catalog })({ ...input, consent: { googleAI: false } });
  assert.equal(noConsent.reason, 'consent_required');
});
test('configured scene returns only a real mocked Google image payload with clear concept disclosure', async () => {
  const data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  let capture;
  const adapter = createSceneAdapter({ env: { ...liveEnv, ENABLE_IMAGE_GENERATION: 'true', GEMINI_IMAGE_MODEL: 'gemini-3.1-flash-image' }, catalog, fetchImpl: async (url, options) => { capture = { url, body: JSON.parse(options.body) }; return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { mimeType: 'image/png', data } }] } }] })); } });
  const result = await adapter({ prompt: 'A serene reading corner', productIds: ['ME-017'], consent: { googleAI: true } });
  assert.equal(result.generated, true); assert.equal(result.mode, 'gemini'); assert.equal(result.image.dataUrl, `data:image/png;base64,${data}`);
  assert.match(result.disclosure, /Not a product photo/); assert.match(capture.url, /\/v1\/models\/gemini-3.1-flash-image:generateContent$/);
  assert.deepEqual(capture.body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
  assert.deepEqual(capture.body.generationConfig.imageConfig, { aspectRatio: '4:5' });
  assert.equal(capture.body.generationConfig.responseFormat, undefined);
});
test('thought-only scene images are unavailable; a final image is selected after a thought image', async () => {
  const data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const env = { ...liveEnv, ENABLE_IMAGE_GENERATION: 'true', GEMINI_IMAGE_MODEL: 'gemini-3.1-flash-image' };
  const thought = { thought: true, inlineData: { mimeType: 'image/png', data } };
  const make = parts => createSceneAdapter({ env, catalog, fetchImpl: async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts } }] })) });
  const input = { prompt: 'A quiet corner', consent: { googleAI: true } };
  const onlyThought = await make([thought])(input);
  assert.equal(onlyThought.generated, false); assert.equal(onlyThought.mode, 'unavailable'); assert.equal(onlyThought.image, undefined);
  const finalImage = await make([thought, { inlineData: { mimeType: 'image/png', data } }])(input);
  assert.equal(finalImage.generated, true); assert.equal(finalImage.image.dataUrl, `data:image/png;base64,${data}`);
});
test('scene failure never fabricates an image', async () => {
  const adapter = createSceneAdapter({ env: { ...liveEnv, ENABLE_IMAGE_GENERATION: 'true', GEMINI_IMAGE_MODEL: 'gemini-3.1-flash-image' }, catalog, fetchImpl: async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'cannot generate' }] } }] })) });
  const result = await adapter({ prompt: 'A serene corner', consent: { googleAI: true } });
  assert.equal(result.generated, false); assert.equal(result.externalCall, true); assert.equal(result.mode, 'unavailable'); assert.equal(result.image, undefined);
});
test('health/status metadata do not expose keys or claim live calls', () => {
  assert.equal(publicAIStatus({}).provider, 'demo'); assert.equal(publicAIStatus(liveEnv).provider, 'gemini');
  assert.equal(publicAIStatus({}).guide, 'demo'); assert.equal(publicAIStatus(liveEnv).guide, 'configured');
  assert.equal(publicAIStatus(liveEnv).uploads, false); assert.equal(JSON.stringify(publicAIStatus(liveEnv)).includes('mock-test-only'), false);
});

test('HTTP server serves built SPA, health and strict JSON APIs with origin and path protections', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'maison-backend-'));
  await mkdir(join(dir, 'assets')); await writeFile(join(dir, 'index.html'), '<html>demo</html>'); await writeFile(join(dir, 'assets/app.js'), 'console.log("demo")');
  const outside = await mkdtemp(join(tmpdir(), 'maison-outside-'));
  await writeFile(join(outside, 'private.txt'), 'private');
  await symlink(outside, join(dir, 'leak'), process.platform === 'win32' ? 'junction' : 'dir');
  const server = createAppServer({ env: {}, distDir: dir, catalog, fetchImpl: () => { throw new Error('must not call'); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${base}/api/health`); assert.equal(health.status, 200); assert.equal((await health.json()).guide, 'demo');
  const index = await fetch(`${base}/some-spa-view`); assert.equal(index.status, 200); assert.equal(await index.text(), '<html>demo</html>');
  const asset = await fetch(`${base}/assets/app.js`); assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(`${base}/.env`)).status, 404); assert.equal((await fetch(`${base}/server/index.mjs`)).status, 404); assert.equal((await fetch(`${base}/leak/private.txt`)).status, 404);
  const guide = await fetch(`${base}/api/guide`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) }); assert.equal(guide.status, 200); assert.equal((await guide.json()).mode, 'demo');
  const badOrigin = await fetch(`${base}/api/guide`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify(request) }); assert.equal(badOrigin.status, 403);
  const invalid = await fetch(`${base}/api/guide`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' }); assert.equal(invalid.status, 400);
  const wrongType = await fetch(`${base}/api/guide`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'text' }); assert.equal(wrongType.status, 415);
  const oversized = await fetch(`${base}/api/guide`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'x'.repeat(17000) }) }); assert.equal(oversized.status, 413);
});

test('HTTP media byte ranges support seeking, suffixes and bounded invalid ranges', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'maison-range-'));
  await writeFile(join(dir, 'track.mp3'), '0123456789');
  const server = createAppServer({ env: {}, distDir: dir });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${server.address().port}/track.mp3`;
  for (const [range, text, contentRange] of [['bytes=2-5','2345','bytes 2-5/10'], ['bytes=7-','789','bytes 7-9/10'], ['bytes=-3','789','bytes 7-9/10'], ['bytes=8-99','89','bytes 8-9/10']]) {
    const response = await fetch(url, { headers: { range } });
    assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), contentRange);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg'); assert.equal(await response.text(), text);
  }
  for (const range of ['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=bad', 'bytes=9007199254740992-']) {
    const response = await fetch(url, { headers: { range } });
    assert.equal(response.status, 416); assert.equal(response.headers.get('content-range'), 'bytes */10');
  }
  const head = await fetch(url, { method: 'HEAD', headers: { range: 'bytes=2-5' } });
  assert.equal(head.status, 200); assert.equal(head.headers.get('content-length'), '10'); assert.equal(await head.text(), '');
  const conditional = await fetch(url, { headers: { range: 'bytes=2-5', 'if-range': '"old"' } });
  assert.equal(conditional.status, 200); assert.equal(await conditional.text(), '0123456789');
});
