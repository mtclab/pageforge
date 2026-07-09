// Render the full.json fixture to stdout (or to a dir with --out <dir>).
// Proves the engine runs standalone in Node.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = join(root, 'node_modules/.cache/pageforge-sample.mjs');

await build({
  stdin: {
    contents: `
      export { renderSite } from './src/engine/render.ts';
      export { buildSiteFiles } from './src/engine/bundle.ts';
      export { THEMES, getTheme } from './src/themes/index.ts';
    `,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
});

const { renderSite, getTheme } = await import(pathToFileURL(outfile));
const data = JSON.parse(await readFile(join(root, 'test/fixtures/full.json'), 'utf8'));
const { html, css } = renderSite(data, getTheme(data.meta.themeId));

const outIdx = process.argv.indexOf('--out');
if (outIdx !== -1 && process.argv[outIdx + 1]) {
  const dir = process.argv[outIdx + 1];
  await mkdir(join(dir, 'assets'), { recursive: true });
  await writeFile(join(dir, 'index.html'), html);
  await writeFile(join(dir, 'style.css'), css);
  console.log(`wrote ${dir}/index.html + style.css`);
} else {
  console.log(html);
}
