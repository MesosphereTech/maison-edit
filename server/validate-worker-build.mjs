/** Validate compiled output with local transports only. Never loads runtime secrets or calls a provider. */
import assert from 'node:assert/strict';
import { readFile, lstat, readdir } from 'node:fs/promises';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
let hosting = null;
try { hosting = JSON.parse(await readFile(join(output, '.openai/hosting.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!hosting) {
  await assertFilesOnly(output);
  assert.match(await readFile(join(output, 'client/index.html'), 'utf8'), /<div id="root"><\/div>/);
  const result = spawnSync(process.execPath, ['--test', 'tests/backend-runtime-packaging.test.mjs'], {
    cwd: root, encoding: 'utf8', timeout: 30000,
    env: { PATH: process.env.PATH || '', SystemRoot: process.env.SystemRoot || '', TEMP: process.env.TEMP || '', TMP: process.env.TMP || '', MAISON_PACKAGING_BUILD_DIR: output }
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  console.log(JSON.stringify({ ok: true, target: 'node-cloud-run', frontend: 'dist/client', stagedRuntime: 'passed', providerCalls: 0, published: false }));
  process.exit(0);
}
const source = JSON.parse(await readFile(join(root, '.openai/hosting.json'), 'utf8'));
assert.equal(hosting.project_id, source.project_id); assert.equal(hosting.static, undefined);
assert.equal(hosting.d1, null); assert.equal(hosting.r2, null);
const entry = await readFile(join(output, 'server/index.js'), 'utf8');
assert.doesNotMatch(entry, /from\s*["']node:|\bBuffer\./);
async function assertFilesOnly(path) {
  const info = await lstat(path); assert.equal(info.isSymbolicLink(), false);
  if (info.isDirectory()) for (const item of await readdir(path)) await assertFilesOnly(join(path, item));
  else { assert.equal(info.isFile(), true); assert.ok(!/(?:^|\/)\.env(?:\.|$)/.test(path)); }
}
await assertFilesOnly(output);
const worker = (await import(pathToFileURL(join(output, 'server/index.js')).href + `?validation=${Date.now()}`)).default;
const headers = { 'oai-authenticated-user-id': 'synthetic-build-validation' };
const env = { ASSETS: { async fetch(request) {
  const path = resolve(output, 'client', '.' + new URL(request.url).pathname);
  assert.ok(path.startsWith(join(output, 'client') + sep));
  try { return new Response(await readFile(path), { headers: { 'content-type': path.endsWith('.html') ? 'text/html' : 'application/octet-stream' } }); }
  catch { return new Response('missing', { status: 404 }); }
} } };
const status = await worker.fetch(new Request('https://build-validation.invalid/api/status', { headers }), env);
assert.equal(status.status, 200);
const metadata = await status.json(); assert.equal(metadata.configured, false); assert.equal(metadata.usable, false); assert.equal(metadata.connection, 'unconfigured');
assert.equal((await worker.fetch(new Request('https://build-validation.invalid/api/status'), env)).status, 401);
const home = await worker.fetch(new Request('https://build-validation.invalid/index.html'), env);
assert.equal(home.status, 200); assert.match(await home.text(), /<div id="root"><\/div>/);
const route = await worker.fetch(new Request('https://build-validation.invalid/saved', { headers: { accept: 'text/html' } }), env);
assert.equal(route.status, 200);
const guide = await worker.fetch(new Request('https://build-validation.invalid/api/guide', { method: 'POST', headers: { ...headers, 'content-type': 'application/json', origin: 'https://build-validation.invalid' }, body: JSON.stringify({ message: 'A quiet gallery look', consent: { googleAI: false } }) }), env);
const result = await guide.json(); assert.equal(guide.status, 200); assert.equal(result.mode, 'demo'); assert.equal(result.externalCall, false);
console.log(JSON.stringify({ ok: true, workerBytes: entry.length, project_id: hosting.project_id, frontend: 'dist/client', worker: 'dist/server/index.js', status: metadata.connection, providerCalls: 0, published: false }));
