// Bundles scripts/kids-harness/entry.tsx (the real Little Learners game
// components with a stand-in session API) and the app's Tailwind CSS into
// a static page:   node scripts/kids-harness/build.mjs [outDir]
import { build } from 'esbuild'
import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const out = path.resolve(process.argv[2] ?? path.join(root, '.kids-harness'))
mkdirSync(out, { recursive: true })
await build({
  entryPoints: [path.join(root, 'scripts/kids-harness/entry.tsx')],
  bundle: true,
  outfile: path.join(out, 'harness.js'),
  format: 'esm',
  jsx: 'automatic',
  target: 'es2020',
  minify: true,
  alias: { '@': root },
  define: { 'process.env.NODE_ENV': '"production"' },
  // next/link (Trace & Learn) reads process.env.__NEXT_*; outside Next there is no process
  banner: { js: 'globalThis.process = globalThis.process || { env: { NODE_ENV: "production" } };' },
  logLevel: 'warning',
})
execFileSync(process.execPath, [path.join(root, 'node_modules/tailwindcss/lib/cli.js'), '-c', path.join(root, 'tailwind.config.ts'), '-i', path.join(root, 'app/globals.css'), '-o', path.join(out, 'harness.css'), '--minify'], { stdio: 'inherit', cwd: root })
// Same Tamil font the app loads through next/font (--font-tamil)
writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html><html lang="ta"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Little Learners harness</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;600;700;800&family=Inter:wght@400;600;700;800&display=swap">
<link rel="stylesheet" href="harness.css"><style>:root{--font-tamil:'Noto Sans Tamil'} body{font-family:Inter,sans-serif}</style></head><body><div id="root"></div><script type="module" src="harness.js"></script></body></html>`
)
console.log(path.join(out, 'index.html'))
