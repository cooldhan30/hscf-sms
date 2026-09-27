// Bundles scripts/racing-harness/entry.tsx (the real RaceGame3D with a
// stand-in session API) and the app's Tailwind CSS into a static page:
//   node scripts/racing-harness/build.mjs [outDir]
import { build } from 'esbuild'
import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const out = path.resolve(process.argv[2] ?? path.join(root, '.racing-harness'))
mkdirSync(out, { recursive: true })
await build({
  entryPoints: [path.join(root, 'scripts/racing-harness/entry.tsx')],
  bundle: true,
  outfile: path.join(out, 'harness.js'),
  format: 'esm',
  jsx: 'automatic',
  target: 'es2020',
  minify: true,
  sourcemap: false,
  alias: { '@': root },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
})
execFileSync(path.join(root, 'node_modules/.bin/tailwindcss'), ['-c', path.join(root, 'tailwind.config.ts'), '-i', path.join(root, 'app/globals.css'), '-o', path.join(out, 'harness.css'), '--minify'], { stdio: 'inherit', cwd: root })
writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html><html lang="ta"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Tamil Grand Prix harness</title><link rel="stylesheet" href="harness.css"></head><body><div id="root"></div><script type="module" src="harness.js"></script></body></html>`
)
console.log(path.join(out, 'index.html'))
