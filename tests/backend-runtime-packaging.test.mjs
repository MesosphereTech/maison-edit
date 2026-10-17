import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('Cloud Run staged runtime includes the complete catalog dependency graph and serves dist/client', async t => {
  const dockerfile = await readFile(join(root, 'Dockerfile'), 'utf8');
  const runtime = dockerfile.split(' AS runtime')[1];
  assert.ok(runtime, 'Dockerfile must retain its explicit runtime stage.');
  assert.match(runtime, /COPY --from=build --chown=node:node \/app\/src \.\/src\s/);
  assert.match(runtime, /COPY --from=build --chown=node:node \/app\/dist \.\/dist\s/);
  const stage = await mkdtemp(join(tmpdir(), 'maison-cloudrun-runtime-'));
  t.after(() => rm(stage, { recursive: true, force: true }));
  await cp(join(root, 'src'), join(stage, 'src'), { recursive: true });
  await cp(join(root, 'server'), join(stage, 'server'), { recursive: true });
  await cp(join(root, 'package.json'), join(stage, 'package.json'));
  // This check does not need a frontend build, node_modules, a key, or Docker.
  // A build directory can be supplied to additionally stage the actual artifact.
  if (process.env.MAISON_PACKAGING_BUILD_DIR) {
    await cp(resolve(process.env.MAISON_PACKAGING_BUILD_DIR), join(stage, 'dist'), { recursive: true });
  } else {
    await mkdir(join(stage, 'dist', 'client'), { recursive: true });
    await writeFile(join(stage, 'dist', 'client', 'index.html'), '<!doctype html><title>MAISON staged runtime</title>');
  }
  const script = `
    import { createAppServer } from './server/index.mjs';
    import { once } from 'node:events';
    const server = createAppServer({ env: {}, fetchImpl: () => { throw new Error('No external API call is permitted.'); } });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const base = 'http://127.0.0.1:' + server.address().port;
      const health = await fetch(base + '/api/health');
      const metadata = await health.json();
      if (health.status !== 200 || metadata.guide !== 'demo') throw new Error('Safe no-key health failed.');
      const page = await fetch(base + '/');
      if (page.status !== 200 || !(page.headers.get('content-type') || '').includes('text/html')) throw new Error('dist/client was not served.');
      const html = await page.text();
      if (!html.includes('<!doctype html>') && !html.includes('<!DOCTYPE html>')) throw new Error('Missing frontend document.');
      console.log(JSON.stringify({ ok: true, guide: metadata.guide, frontend: page.status, externalCalls: 0 }));
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: stage, encoding: 'utf8', timeout: 10000,
    // Do not inherit any potential runtime keys or provider-test settings.
    env: { PATH: process.env.PATH || '', NODE_ENV: 'production' }
  });
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, `${child.stderr}\n${child.stdout}`);
  assert.match(child.stdout, /"ok":true/);
  assert.match(child.stdout, /"externalCalls":0/);
});
