// Screenshots of the GameRoom Classic prototype at desktop/laptop/iPad/phone,
// including played-through flows. It proves screens render, fit and can be
// clicked through; whether they look right is for a person to judge.
//   npm i --no-save playwright-core   (uses the installed Chrome)
//   node scripts/grc-harness/shots.mjs <outDir>
import { execFileSync } from 'child_process'
import { createServer } from 'http'
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = path.resolve(process.argv[2] ?? path.join(root, '.grc-harness'))
const site = path.join(outDir, 'site')
const shots = path.join(outDir, 'shots')
mkdirSync(shots, { recursive: true })
execFileSync(process.execPath, [path.join(root, 'scripts/grc-harness/build.mjs'), site], { stdio: 'inherit' })

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
const server = createServer((req, res) => {
  const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/$/, '/index.html')
  const p = path.join(site, rel)
  if (!p.startsWith(site) || !existsSync(p)) return res.writeHead(404).end()
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }).end(readFileSync(p))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}/`

const { chromium } = createRequire(import.meta.url)('playwright-core')
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'ipad-820', width: 820, height: 1180, touch: true },
  { name: 'phone-390', width: 390, height: 844, touch: true },
]
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7)
const report = { overflow: [], errors: [], flows: {} }

async function open(vp, screen) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => report.errors.push(`${vp.name}/${screen}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && report.errors.push(`${vp.name}/${screen} console: ${m.text()}`))
  await page.goto(`${base}?screen=${screen}`)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
  return { ctx, page }
}
async function shot(page, vp, name) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (over > 1) report.overflow.push(`${vp.name}/${name}: ${over}px`)
  await page.screenshot({ path: path.join(shots, `${name}--${vp.name}.png`), fullPage: true })
}
async function flow(name, vp, fn) {
  try {
    await fn()
    report.flows[`${name}/${vp.name}`] = 'ok'
  } catch (e) {
    report.flows[`${name}/${vp.name}`] = `FAILED: ${e.message.split('\n')[0]}`
  }
}

const STATIC = ['home', 'teacher', 'teacher-pick-host', 'teacher-assignments', 'create', 'edit', 'assign', 'results', 'student', 'student-assignments', 'review', 'quiz', 'match', 'word', 'sentence', 'join']
for (const vp of VIEWPORTS) {
  if (only && !vp.name.startsWith(only)) continue
  for (const s of STATIC) {
    const { ctx, page } = await open(vp, s)
    await shot(page, vp, s)
    await ctx.close()
  }

  await flow('create', vp, async () => {
    const { ctx, page } = await open(vp, 'create')
    await page.getByRole('button', { name: /Classic Quiz/ }).click()
    await page.getByRole('checkbox').nth(0).check()
    await page.getByRole('checkbox').nth(1).check()
    await page.getByText('Advanced options').click()
    await shot(page, vp, 'flow-create-questions')
    await ctx.close()
  })

  await flow('quiz', vp, async () => {
    const { ctx, page } = await open(vp, 'quiz')
    await page.getByRole('button', { name: 'Answer 2: 12' }).click()
    await shot(page, vp, 'flow-quiz-correct')
    await page.getByRole('button', { name: 'Next →' }).click()
    await page.getByRole('button', { name: 'Answer 1: அ' }).click()
    await shot(page, vp, 'flow-quiz-wrong')
    await ctx.close()
  })

  await flow('match', vp, async () => {
    const { ctx, page } = await open(vp, 'match')
    await page.getByRole('button', { name: 'பூனை', exact: true }).click()
    await page.getByRole('button', { name: 'cat', exact: true }).click()
    await page.getByRole('button', { name: 'நாய்', exact: true }).click()
    await shot(page, vp, 'flow-match-selected')
    for (const [l, r] of [['நாய்', 'dog'], ['பசு', 'cow'], ['யானை', 'elephant']]) {
      if (l !== 'நாய்') await page.getByRole('button', { name: l, exact: true }).click()
      await page.getByRole('button', { name: r, exact: true }).click()
    }
    await page.waitForTimeout(400)
    await shot(page, vp, 'flow-match-done')
    await ctx.close()
  })

  await flow('word', vp, async () => {
    const { ctx, page } = await open(vp, 'word')
    for (const t of ['ம்', 'அ', 'மா']) await page.getByRole('button', { name: `Tile ${t}`, exact: true }).click()
    await page.getByRole('button', { name: 'Check ✓' }).click()
    await page.waitForTimeout(500)
    await shot(page, vp, 'flow-word-wrong')
    await page.getByRole('button', { name: 'Clear' }).click()
    for (const t of ['அ', 'ம்', 'மா']) await page.getByRole('button', { name: `Tile ${t}`, exact: true }).click()
    await page.getByRole('button', { name: 'Check ✓' }).click()
    await page.waitForTimeout(300)
    await shot(page, vp, 'flow-word-correct')
    await ctx.close()
  })

  await flow('assignment', vp, async () => {
    const { ctx, page } = await open(vp, 'assignment-quiz')
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: /^Answer 1:/ }).click()
      if (i === 0) await shot(page, vp, 'flow-assignment-saved')
      await page.getByRole('button', { name: i < 4 ? 'Next →' : 'Finish' }).click()
    }
    await shot(page, vp, 'flow-assignment-confirm')
    await page.getByRole('button', { name: 'Finish & Submit' }).click()
    await page.getByText('Assignment Submitted Successfully!').waitFor()
    await page.waitForTimeout(1800)
    await shot(page, vp, 'flow-assignment-submitted')
    await ctx.close()
  })

  await flow('results', vp, async () => {
    const { ctx, page } = await open(vp, 'results')
    await page.getByRole('button', { name: 'View' }).first().click()
    await shot(page, vp, 'flow-results-view')
    await ctx.close()
  })

  await flow('join', vp, async () => {
    const { ctx, page } = await open(vp, 'join')
    await page.getByLabel('Game PIN').fill('111111')
    await page.getByRole('button', { name: 'Join ▶' }).click()
    await shot(page, vp, 'flow-join-bad-pin')
    await page.getByLabel('Game PIN').fill('482913')
    await page.getByRole('button', { name: 'Join ▶' }).click()
    await shot(page, vp, 'flow-join-waiting')
    await page.getByRole('button', { name: /Demo: teacher starts/ }).click()
    await shot(page, vp, 'flow-join-question')
    await page.getByRole('button', { name: 'Answer 2: 12' }).click()
    await page.waitForTimeout(1800)
    await shot(page, vp, 'flow-join-result')
    await ctx.close()
  })

  if (!vp.name.startsWith('phone')) {
    await flow('host', vp, async () => {
      const { ctx, page } = await open(vp, 'host')
      await page.waitForTimeout(6000)
      await shot(page, vp, 'flow-host-lobby')
      await page.getByRole('button', { name: 'Start game ▶' }).click()
      await page.waitForTimeout(4000)
      await shot(page, vp, 'flow-host-question')
      await page.getByRole('button', { name: 'Next ▶' }).waitFor({ timeout: 15000 })
      await page.waitForTimeout(700)
      await shot(page, vp, 'flow-host-reveal')
      await page.getByRole('button', { name: 'Next ▶' }).click()
      await page.waitForTimeout(500)
      await shot(page, vp, 'flow-host-leaderboard')
      for (let i = 1; i < 5; i++) {
        await page.getByRole('button', { name: 'Next question ▶' }).click()
        await page.getByRole('button', { name: 'Next ▶' }).click({ timeout: 15000 })
      }
      await page.getByRole('button', { name: /Show winners/ }).click()
      await page.waitForTimeout(2200)
      await shot(page, vp, 'flow-host-podium')
      await ctx.close()
    })
    await flow('host-race', vp, async () => {
      const { ctx, page } = await open(vp, 'host-race')
      await page.waitForTimeout(4000)
      await page.getByRole('button', { name: 'Start game ▶' }).click()
      await page.waitForTimeout(5000)
      await shot(page, vp, 'flow-host-race')
      await ctx.close()
    })
  }
  console.log(`done ${vp.name}`)
}

writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
server.close()
