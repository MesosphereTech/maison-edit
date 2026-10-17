/** Build the Node frontend, or the optional Sites Worker when its manifest exists.
 * A clean checkout needs no hosting manifest, runtime credentials or provider call.
 */
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as buildFrontend } from 'vite';
import { build as bundleWorker } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const review = process.argv.length === 3 && process.argv[2] === '--review';
if (process.argv.length > 2 && !review) throw new Error('Use no arguments for production output, or --review for a temporary candidate.');
const output = review ? await mkdtemp(join(tmpdir(), 'maison-sites-worker-')) : join(root, 'dist');
let hosting = null;
try { hosting = JSON.parse(await readFile(join(root, '.openai/hosting.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (hosting && !hosting.project_id) throw new Error('Keep the existing Site project ID before building.');
if (hosting?.static) throw new Error('The Sites Worker manifest must not declare static-only hosting.');
// Native Node/Cloud Run builds do not need an account-specific Sites manifest.
// An existing Sites manifest still selects the original Worker build below.
if (!hosting) {
  if (!review) await rm(output, { recursive: true, force: true });
  await buildFrontend({ root, build: { outDir: join(output, 'client'), emptyOutDir: true } });
  console.log(JSON.stringify({ output, reviewOnly: review, target: 'node-cloud-run', published: false, liveAI: false }));
  process.exit(0);
}
const workerHosting = { ...hosting };
workerHosting.d1 ??= null; workerHosting.r2 ??= null;
// Remove the previous build only. Source, runtime state and environment settings are untouched.
if (!review) await rm(output, { recursive: true, force: true });
await buildFrontend({ root, build: { outDir: join(output, 'client'), emptyOutDir: true } });
await mkdir(join(output, 'server'), { recursive: true });
await mkdir(join(output, '.openai'), { recursive: true });
await bundleWorker({ entryPoints: [join(root, 'server/worker.mjs')], outfile: join(output, 'server/index.js'),
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', minify: true, sourcemap: false,
  metafile: true, logLevel: 'silent', write: true,
}).then(result => {
  if (Object.values(result.metafile.outputs).some(value => value.imports.length)) throw new Error('Worker output must be self-contained.');
});
await writeFile(join(output, '.openai/hosting.json'), JSON.stringify(workerHosting, null, 2) + '\n');
console.log(JSON.stringify({ output, reviewOnly: review, project_id: hosting.project_id, published: false,
  liveAI: false, note: 'Worker build complete; no runtime secrets, provider calls, upload or deployment performed.' }));
