import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createCodexAdapters, codexStatus, validatePresetContext, cliArgs, CliError, runCodex } from '../server/codex-cli.mjs';
import { createAppServer } from '../server/index.mjs';
import { InputError } from '../server/google-ai.mjs';

// All CLI transports here are fake. The separate manual live smoke records real runtime results.
const env = { MAISON_AI_PROVIDER: 'codex-cli', CODEX_CLI_TEST_ENABLED: 'true' };
const body = { message: 'Quiet tailoring for daily work', language: 'en', context: { category: 'women', budget: 5000 }, presetContext: { personaId: 'everyday-woman-45', homeId: 'compact-city', room: 'living' }, consent: { openAI: true } };
const answer = { reply: 'Ivory softness balances walnut tailoring.', recommendations: [{ productId: 'ME-001', reason: 'A quiet tailored foundation.' }] };

test('CLI status distinguishes enabled configuration from verified usable inference', () => {
  const status = codexStatus(env); assert.equal(status.configured, true); assert.equal(status.usable, false); assert.equal(status.guide, 'unavailable'); assert.equal(status.analysis, 'unavailable'); assert.equal(status.uploads, false); assert.equal(status.billingVerified, false);
});
test('CLI disabled and denied consent never start a process', async () => {
  let calls = 0; const runImpl = () => { calls++; throw new Error('must not run'); };
  const disabled = await createCodexAdapters({ env: {}, runImpl }).guide(body); assert.equal(disabled.warning, 'cli_disabled'); assert.equal(disabled.mode, 'demo');
  const denied = await createCodexAdapters({ env, runImpl }).guide({ ...body, consent: { openAI: false } }); assert.equal(denied.warning, 'consent_required'); assert.equal(denied.externalCall, false);
  assert.equal(calls, 0);
});
test('CLI guide transmits trusted synthetic preset metadata and returns catalog canonical facts', async () => {
  const captures = []; const adapter = createCodexAdapters({ env, runImpl: async request => { captures.push(request); return { value: answer, usage: { input_tokens: 300 } }; } });
  const result = await adapter.guide(body); assert.equal(result.mode, 'codex-cli'); assert.equal(result.model, 'gpt-6.1-sol'); assert.equal(result.products[0].price, 3280); assert.equal(result.testOnly, true); assert.equal(adapter.status().guide, 'configured'); assert.equal(adapter.status().analysis, 'unavailable');
  await adapter.guide({ ...body, presetContext: { personaId: 'soft-woman-60', homeId: 'warm-family', room: 'bedroom' } });
  assert.notEqual(captures[0].prompt, captures[1].prompt); assert.match(captures[1].prompt, /soft-woman-60/); assert.match(captures[1].prompt, /warm-family/); assert.equal(captures[0].images, undefined);
});
test('CLI guard rejects unknown product, over-budget and unsafe prose as explicit demo fallback', async () => {
  for (const value of [{ ...answer, recommendations: [{ productId: 'UNKNOWN', reason: 'A lovely look.' }] }, { ...answer, reply: 'Your payment is confirmed.' }, { ...answer, reply: 'This fits you perfectly.' }, { ...answer, reply: 'Only 2 in stock.' }]) {
    const adapter = createCodexAdapters({ env, runImpl: async () => ({ value }) }); const result = await adapter.guide(body); assert.equal(result.mode, 'demo'); assert.equal(adapter.status().usable, false);
  }
  const over = await createCodexAdapters({ env, runImpl: async () => ({ value: answer }) }).guide({ ...body, context: { category: 'women', budget: 1000 } }); assert.equal(over.mode, 'demo'); assert.equal(over.productIds.includes('ME-001'), false);
});
test('readonly CLI failure never presents mock output as real inference', async () => {
  const adapter = createCodexAdapters({ env, runImpl: async () => { throw new CliError('runtime_read_only'); } });
  const result = await adapter.guide(body); assert.equal(result.warning, 'runtime_read_only'); assert.equal(result.mode, 'demo'); assert.equal(result.externalCall, false); assert.equal(result.invocationAttempted, true); assert.equal(adapter.status().connection, 'blocked'); assert.equal(adapter.status().reason, 'runtime_read_only'); assert.equal(adapter.status().guide, 'unavailable');
});
test('request JSON cannot supply photos, paths, URLs, unknown presets, shell flags or Google consent', async () => {
  const adapter = createCodexAdapters({ env, runImpl: () => { throw new Error('must not run'); } });
  for (const request of [{ ...body, images: ['/etc/passwd'] }, { ...body, photo: 'data:image/jpeg;base64,xx' }, { ...body, binary: '/bin/sh' }, { ...body, presetContext: { personaId: '../../etc/passwd' } }, { ...body, consent: { googleAI: true } }]) await assert.rejects(adapter.guide(request), InputError);
  for (const value of [{ room: 'garage' }, { homeId: 'https://evil.example' }, { path: '/etc/passwd' }]) assert.throws(() => validatePresetContext(value), InputError);
});
test('analysis uses only fixed fixture images and selected room metadata', async () => {
  let capture; const adapter = createCodexAdapters({ env, runImpl: async request => { capture = request; return { value: { summary: 'A soft palette with warm texture.', observations: [{ reference: 'persona', text: 'Relaxed layers and a warm palette.' }, { reference: 'room', text: 'A light room with layered textiles.' }], styleTags: ['soft', 'warm'], recommendedKinds: ['knit', 'cushion'] } }; } });
  const result = await adapter.analyze({ personaId: 'soft-woman-60', homeId: 'warm-family', room: 'study', language: 'en', consent: { openAI: true } });
  assert.equal(result.analyzed, true); assert.equal(result.mode, 'codex-cli'); assert.equal(result.floorplanSource, 'synthetic_metadata'); assert.match(capture.images[0], /soft-woman-60\.jpg$/); assert.match(capture.images[1], /warm-family-living\.jpg$/); assert.match(capture.prompt, /"room":"study"/); assert.equal(adapter.status().analysis, 'configured');
});
test('analysis denied consent and uploaded payloads never trigger model calls', async () => {
  let calls = 0; const adapter = createCodexAdapters({ env, runImpl: () => { calls++; throw new Error('must not run'); } });
  assert.equal((await adapter.analyze({ consent: { openAI: false } })).reason, 'consent_required');
  await assert.rejects(adapter.analyze({ images: ['data:image/jpeg;base64,xx'], consent: { openAI: true } }), InputError); assert.equal(calls, 0);
});
test('image-generation route truthfully reports never verified and never calls CLI', async () => {
  let calls = 0; const adapter = createCodexAdapters({ env, runImpl: () => { calls++; } }); const result = await adapter.scene({ prompt: 'A warm room', productIds: ['ME-017'], presetContext: body.presetContext, consent: { openAI: true } }); assert.equal(result.generated, false); assert.equal(result.reason, 'cli_image_generation_unverified'); assert.equal(calls, 0);
});
test('CLI arguments use official fixed binary flags, readonly ephemeral and disabled tools', () => {
  const args = cliArgs('/tmp/maison-test'); assert.ok(args.includes('--ephemeral')); assert.ok(args.includes('--ignore-user-config')); assert.ok(args.includes('read-only')); assert.ok(args.includes('shell_tool')); assert.ok(args.includes('image_generation')); assert.ok(args.includes('web_search="disabled"')); assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
});
test('HTTP CLI bridge exposes safe status, consent and blocked-runtime results', async t => {
  const server = createAppServer({ env, runCodexImpl: async () => { throw new CliError('runtime_read_only'); } }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }); const base = `http://127.0.0.1:${server.address().port}`;
  const status = await (await fetch(`${base}/api/status`)).json(); assert.equal(status.usable, false);
  const result = await (await fetch(`${base}/api/guide`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(); assert.equal(result.warning, 'runtime_read_only'); assert.equal(result.mode, 'demo');
  const analysis = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ consent: { openAI: false } }) }); assert.equal((await analysis.json()).reason, 'consent_required');
});

test('HTTP CLI bridge refuses DNS-rebinding hosts and cross-origin callers', async t => {
  let calls = 0; const server = createAppServer({ env, runCodexImpl: async () => { calls++; return { value: answer }; } }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }); const base = `http://127.0.0.1:${server.address().port}`;
  for (const headers of [{ 'content-type': 'application/json', host: 'attacker.example', origin: 'http://attacker.example' }, { 'content-type': 'application/json', origin: 'https://attacker.example' }]) {
    const response = await fetch(`${base}/api/guide`, { method: 'POST', headers, body: JSON.stringify(body) }); assert.equal(response.status, 403);
  }
  assert.equal(calls, 0);
});
