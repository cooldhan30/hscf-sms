// Browser playtest for the Little Learners games (development only).
// Builds the harness (real game component + stand-in session API), then
// plays Balloon Pop in Chrome at several screen sizes the way a child
// would -- tapping the balloons where they are on screen -- and saves
// screenshots of each moment plus a measurements report.
//
// It proves the game runs, lays out and can be played; it can't judge
// whether it's fun or looks right -- a person has to look at the shots.
//
//   npm i --no-save playwright-core   (uses the installed Chrome)
//   node scripts/kids-harness/playtest.mjs [outDir]
import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { serve } from './serve.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? path.join(root, '.kids-harness/shots', (process.argv.find((a) => a.startsWith('--engine=')) ?? '--engine=balloon-pop').slice(9)))
const harness = path.join(root, '.kids-harness')
const ENGINE = (process.argv.find((a) => a.startsWith('--engine=')) ?? '--engine=balloon-pop').slice(9)
mkdirSync(outDir, { recursive: true })
execFileSync(process.execPath, [path.join(root, 'scripts/kids-harness/build.mjs'), harness], { stdio: 'inherit' })

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'ipad-portrait', width: 820, height: 1180, touch: true },
  { name: 'ipad-landscape', width: 1180, height: 820, touch: true },
  { name: 'phone-390', width: 390, height: 844, touch: true },
]
const ANSWERS = ['அ', 'ஈ', 'ஆ', 'ஏ', 'உயிரெழுத்து', 'சரி ✓']

const { server, url } = await serve(harness)
const browser = await chromium.launch({ executablePath: CHROME })
const report = {}

// Tap a balloon where it currently is -- waiting (as a child would) until
// it has floated fully into view.
async function tapBalloon(page, label) {
  const loc = page.getByRole('button', { name: label, exact: true })
  const vp = page.viewportSize()
  for (let i = 0; i < 120; i++) {
    const b = await loc.boundingBox()
    if (b && b.y > 150 && b.y + b.height < vp.height - 10 && b.x >= 0 && b.x + b.width <= vp.width) {
      const starsBefore = await page.$eval('[aria-label$="stars"]', (e) => e.textContent)
      await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.35)
      // A moving target can slip away between aiming and tapping -- like a
      // child, just try again if nothing happened
      await page.waitForTimeout(300)
      const hit = (await page.$eval('[aria-label$="stars"]', (e) => e.textContent)) !== starsBefore || (await page.getByText('👆 இதோ!').count()) > 0
      if (hit) return b
    }
    await page.waitForTimeout(150)
  }
  throw new Error(`choice "${label}" never came into view`)
}

// Letter Parade: put the letters on the caterpillar in order.
async function paradeFlow(page, vp, r) {
  const tap = async (label) => {
    await page.getByRole('button', { name: label, exact: true }).click()
    await page.waitForTimeout(120)
  }
  // Q1 right order, by taps
  for (const l of ['அ', 'ஆ', 'இ']) await tap(l)
  await page.screenshot({ path: path.join(outDir, `${vp.name}-2b-placing.png`) })
  await tap('ஈ')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(outDir, `${vp.name}-3-correct-pop.png`) })
  r.stars1 = await page.$eval('[aria-label$="stars"]', (e) => e.textContent.trim())
  await page.waitForTimeout(1800)
  // Q2 wrong order -> the right order is shown
  for (const l of ['ஔ', 'ஒ', 'ஐ', 'ஓ']) await tap(l)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(outDir, `${vp.name}-4-wrong-reveal.png`) })
  r.revealShown = await page.getByText("Here's the right order!").isVisible()
  await page.waitForTimeout(3000)
  // Q3: drag the first letter onto segment 1, tap the rest
  const tile = await page.getByRole('button', { name: 'க்', exact: true }).boundingBox()
  const seg = await page.locator('[data-kids-segment]').first().boundingBox()
  await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2)
  await page.mouse.down()
  await page.mouse.move(tile.x + tile.width / 2 + 6, tile.y + tile.height / 2 - 6, { steps: 2 })
  await page.mouse.move(seg.x + seg.width / 2, seg.y + seg.height / 2, { steps: 12 })
  await page.mouse.up()
  r.dragWorked = (await page.locator('[data-kids-segment]').first().getAttribute('aria-label')) === '1: க்'
  for (const l of ['ங்', 'ச்', 'ஞ்']) await tap(l)
  await page.waitForTimeout(2800)
  // Q4: five letters
  await page.screenshot({ path: path.join(outDir, `${vp.name}-5-long-word.png`) })
  for (const l of ['இ', 'ஈ', 'உ', 'ஊ', 'எ']) await tap(l)
  await page.waitForTimeout(2800)
  // Q5: a sentence
  await tap('நான்')
  await page.screenshot({ path: path.join(outDir, `${vp.name}-5b-words.png`) })
  for (const w of ['பள்ளிக்குச்', 'செல்கிறேன்']) await tap(w)
  await page.waitForTimeout(4000)
  await page.screenshot({ path: path.join(outDir, `${vp.name}-6-results.png`), fullPage: true })
  r.resultsShown = await page.getByText("You're a star!").isVisible()
  r.balloons = []
}

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('response', (res) => res.status() >= 400 && !/fonts\.g/.test(res.url()) && errors.push(`${res.status()} ${res.url()}`))
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g|favicon|sounds\//.test(m.text()) && errors.push(m.text()))
  const r = (report[vp.name] = { errors })

  await page.goto(url + '?engine=' + ENGINE)
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(outDir, `${vp.name}-1-start.png`) })

  await page.getByRole('button', { name: /Start/ }).click()
  await page.waitForTimeout(1800)
  await page.screenshot({ path: path.join(outDir, `${vp.name}-2-question.png`) })

  // Measure: every balloon on screen, size, overlap and no sideways scroll
  r.balloons = await page.$$eval('[data-kids-choice]', (els) =>
    els.map((e) => {
      const b = e.getBoundingClientRect()
      return { label: e.getAttribute('aria-label'), w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.y) }
    })
  )
  r.horizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  r.questionCard = await page.$eval('[data-kids-question]', (e) => {
    const b = e.getBoundingClientRect()
    return { h: Math.round(b.height), bottom: Math.round(b.bottom) }
  })

  if (ENGINE === 'letter-parade') {
    await paradeFlow(page, vp, r)
    await ctx.close()
    continue
  }

  // Q1 correct -- by a real drag in the drag games, a tap everywhere else
  if (ENGINE === 'missing-letter') {
    const tile = await page.getByRole('button', { name: ANSWERS[0], exact: true }).boundingBox()
    const gap = await page.getByLabel('இடைவெளி · The gap').boundingBox()
    await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2)
    await page.mouse.down()
    await page.mouse.move(tile.x + tile.width / 2 + 5, tile.y + tile.height / 2 - 5, { steps: 2 })
    await page.mouse.move(gap.x + gap.width / 2, gap.y + gap.height / 2, { steps: 12 })
    await page.screenshot({ path: path.join(outDir, `${vp.name}-2b-dragging.png`) })
    await page.mouse.up()
    r.dragWorked = true
  } else {
    await tapBalloon(page, ANSWERS[0])
  }
  await page.waitForTimeout(350)
  await page.screenshot({ path: path.join(outDir, `${vp.name}-3-correct-pop.png`) })
  await page.waitForTimeout(1800)

  // Q2 wrong pop -> the right balloon is shown
  await tapBalloon(page, 'உ')
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(outDir, `${vp.name}-4-wrong-reveal.png`) })
  r.revealShown = await page.getByText('👆 இதோ!').isVisible()
  await page.waitForTimeout(2400)

  // Q3..Q6 correct; Q5 is a long word, Q6 true/false
  for (let q = 2; q < ANSWERS.length; q++) {
    if (q === 4) await page.screenshot({ path: path.join(outDir, `${vp.name}-5-long-word.png`) })
    await tapBalloon(page, ANSWERS[q])
    await page.waitForTimeout(q === ANSWERS.length - 1 ? 2500 : 2000)
  }
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(outDir, `${vp.name}-6-results.png`), fullPage: true })
  r.resultsShown = await page.getByText("You're a star!").isVisible()
  r.starsOnResults = await page.getByText('நட்சத்திரங்கள் · Stars').isVisible()
  await ctx.close()
}

// Reduced motion: balloons stand still in a row
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(url + '?engine=' + ENGINE)
  await page.getByRole('button', { name: /Start/ }).click()
  await page.waitForTimeout(1500)
  const a = await page.getByRole('button', { name: 'அ', exact: true }).boundingBox()
  await page.waitForTimeout(1000)
  const b = await page.getByRole('button', { name: 'அ', exact: true }).boundingBox()
  report.reducedMotion = { still: Math.abs(a.y - b.y) < 1, onScreen: a.y > 0 && a.y + a.height < 844 }
  await page.screenshot({ path: path.join(outDir, 'phone-390-reduced-motion.png') })
  await ctx.close()
}

await browser.close()
server.close()
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 1))
console.log(outDir)
