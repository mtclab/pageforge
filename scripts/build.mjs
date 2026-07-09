// Build: bundle the app + copy static files into dist/.
// Usage: node scripts/build.mjs [--watch]
import * as esbuild from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const watch = process.argv.includes('--watch');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(root, 'src/static'), dist, { recursive: true });
await cp(join(root, 'src/app/ui.css'), join(dist, 'ui.css'));

const options = {
  entryPoints: [join(root, 'src/app/main.ts')],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  outfile: join(dist, 'app.js'),
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const server = await ctx.serve({ servedir: dist, port: 8787 });
  console.log(`dev server: http://localhost:${server.port} (static copies are NOT watched)`);
} else {
  await esbuild.build(options);
}
