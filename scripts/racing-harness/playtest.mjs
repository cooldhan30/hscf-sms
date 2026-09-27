// Browser playtest for Tamil Grand Prix (development only).
//
// Builds the harness page (the real RaceGame3D + a stand-in session API),
// then drives full three-lap races in Chromium by pressing REAL keys
// (arrows or WASD) or touching the on-screen controls, like a player
// reacting to the screen about ten times a second. It answers the Tamil
// question gates, takes screenshots of the moments that matter and
// records frame timing for the whole race.
//
// This is automation: it proves the game runs, renders and can be driven
// with the real controls. It cannot judge how the driving FEELS -- that
// needs a person at the keyboard.
//
//   node scripts/racing-harness/playtest.mjs [outDir] [--only=name]
import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { serve } from './serve.mjs'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const outDir = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? path.join(root, '.racing-harness/playtest'))
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7)
const harness = process.env.HARNESS_DIR ?? path.join(root, '.racing-harness')
mkdirSync(outDir, { recursive: true })
if (!process.env.HARNESS_DIR) execFileSync('node', [path.join(root, 'scripts/racing-harness/build.mjs'), harness], { stdio: 'inherit' })

const require = createRequire(import.meta.url)
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  ;({ chromium } = require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')))
}

const { server, url } = await serve(harness)
const browser = await chromium.launch()
const report = {}

// What the driver "sees" each tick (read from the local race only).
const look = () => {
  const ref = window.__tamizhiRace3d
  const s = ref && ref.current
  if (!s) return null
  const p = s.cars[0]
  const segs = s.road.segments
  const n = segs.length
  const at = (z) => segs[((Math.floor(z / 200) % n) + n) % n]
  // Road centre offset `ahead` units away (double integral of the bends).
  const offsetAhead = (ahead) => {
    let x = 0
    let t = 0
    let pos = p.z / 200
    let left = ahead / 200
    while (left > 1e-6) {
      const f = pos - Math.floor(pos)
      const step = Math.min(1 - f, left)
      const c = at(pos * 200).curve
      x += t * step + (c * step * step) / 2
      t += c * step
      left -= step
      pos += step
    }
    return x / 2000
  }
  const lookD = Math.max(800, p.speed * 0.35)
  const rivals = s.cars.slice(1).map((c) => ({ dz: c.z - p.z, x: c.x }))
  return {
    status: s.status, over: s.over, lap: p.lap, z: p.z, x: p.x, vx: p.vx, speed: p.speed / (200 * 60), finished: p.finished,
    curve: at(p.z).curve, curveSoon: at(p.z + 3000).curve, curveLater: at(p.z + 9000).curve, roadAhead: offsetAhead(lookD), carAhead: p.x + (p.vx || 0) * (lookD / Math.max(p.speed, 1)),
    slots: s.slots.length, boost: p.boostT > 0 || p.starT > 0 || p.burstT > 0, place: s.place, rivals, time: s.time, crashes: s.stats.crashes, offroad: s.stats.offroadTime,
  }
}

async function answerIfAsked(page, correct) {
  const btns = page.locator('button:has-text("அ"), button:has-text("Flower"), button:has-text("ஐந்து"), button:has-text("Water"), button:has-text("12"), button:has-text("House"), button:has-text("Fire"), button:has-text("Tree")')
  const q = await page.evaluate(() => {
    const h = window.__harness
    return h && h.session.currentIndex < h.QUESTIONS.length ? h.QUESTIONS[h.session.currentIndex] : null
  })
  if (!q) return false
  const want = correct ? q.answer : q.options.find((o) => o !== q.answer)
  const b = page.getByRole('button', { name: want, exact: true })
  if (await b.count()) {
    await b.first().click()
    return true
  }
  void btns
  return false
}

async function drive(name, { trackIndex, viewport, mode, touch = false, shots = {}, offroadAt = null, weave = 0.35 }) {
  if (only && only !== name) return
  console.log(`\n== ${name}: track ${trackIndex}, ${viewport.width}x${viewport.height}, ${touch ? 'touch' : mode} ==`)
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/fonts\.googleapis|net::ERR/.test(m.text()) && errors.push(m.text()))
  await page.goto(url)
  await page.locator('[role="radiogroup"][aria-label*="Track"] button').nth(trackIndex).click()
  await page.getByText('பந்தயத்தைத் தொடங்கு').click()
  const keys = mode === 'wasd' ? { up: 'w', down: 's', left: 'a', right: 'd' } : { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }
  const held = new Set()
  let cdp = null
  let touchState = { steer: 0, gas: false }
  void touchState
  let pad = null
  let gas = null
  const press = async (k, on) => {
    if (on && !held.has(k)) {
      held.add(k)
      await page.keyboard.down(k)
    } else if (!on && held.has(k)) {
      held.delete(k)
      await page.keyboard.up(k)
    }
  }
  let active = 0
  const setTouch = async (steer, gasOn) => {
    if (!cdp) cdp = await ctx.newCDPSession(page)
    if (!pad) {
      pad = await page.locator('[role="slider"][aria-label*="Steering"]').boundingBox()
      gas = await page.locator('button[aria-label*="Accelerate"]').first().boundingBox()
    }
    if (!pad || !gas) return
    // Left thumb on the steering pad, right thumb on GAS (multi-touch).
    const points = [{ x: pad.x + pad.width / 2 + steer * pad.width * 0.4, y: pad.y + pad.height / 2, id: 1 }]
    if (gasOn) points.push({ x: gas.x + gas.width / 2, y: gas.y + gas.height / 2, id: 2 })
    const type = points.length > active ? 'touchStart' : points.length < active ? 'touchEnd' : 'touchMove'
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points })
    active = points.length
    touchState = { steer, gas: gasOn }
  }
  const releaseTouch = async () => {
    if (cdp && active) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    active = 0
    pad = null
    touchState = { steer: 0, gas: false }
  }
  const trail = []
  let asked = 0
  let perfReset = false
  const taken = new Set()
  const shotAt = async (key, why) => {
    if (taken.has(key) || !shots[key]) return
    taken.add(key)
    const file = path.join(outDir, `${name}-${key}.png`)
    await page.screenshot({ path: file })
    console.log(`  shot ${key}: ${why}`)
  }
  const started = Date.now()
  let lastSteer = 0
  let offroadDone = false
  while (Date.now() - started < 240000) {
    const s = await page.evaluate(look)
    if (!s) {
      await page.waitForTimeout(100)
      continue
    }
    if (s.status === 'question' || (s.over && (await page.locator('text=மேடைக்கு முன்').count()))) {
      for (const k of Array.from(held)) await press(k, false)
      if (touch) await releaseTouch()
      await page.waitForTimeout(700)
      if (!taken.has('question')) await shotAt('question', 'Tamil checkpoint question')
      if (await answerIfAsked(page, asked % 3 !== 2)) asked++
      await page.waitForTimeout(900)
      if (!taken.has('answer')) await shotAt('answer', 'after answering')
      continue
    }
    if (s.over && (await page.locator('text=பந்தய நேரம்').count())) {
      // Podium / celebration.
      await page.waitForTimeout(2500)
      await shotAt('podium', 'finish / podium')
      break
    }
    if (s.status === 'racing' && !perfReset) {
      await page.evaluate(() => window.__tamizhiRacePerf?.reset())
      perfReset = true
    }
    if (s.status === 'racing' && !s.finished) {
      // A player's plan: follow the road, weave to overtake, now and then
      // run wide on purpose to test recovery.
      let target = 0
      for (const r of s.rivals) if (r.dz > 0 && r.dz < 3000 && Math.abs(r.x - s.x) < 0.5) target = r.x > 0 ? r.x - 0.75 : r.x + 0.75
      if (offroadAt !== null && s.lap === offroadAt.lap && s.z % 1 >= 0 && !offroadDone && Math.abs(s.curve) < 0.5 && s.time > offroadAt.after) target = 1.9
      if (Math.abs(s.x) > 1.7 && target > 1) offroadDone = true
      const err = target + s.roadAhead - s.carAhead
      const want = Math.max(-1, Math.min(1, err * 2.2))
      const brake = Math.abs(s.curveSoon) >= 5 && s.speed > 1.05
      const throttle = !brake
      if (touch) {
        await setTouch(want, throttle)
      } else {
        // Digital keys, like a person: hold, tap, release.
        const dz = 0.2
        await press(keys.left, want < -dz)
        await press(keys.right, want > dz)
        await press(keys.up, throttle)
        await press(keys.down, brake)
      }
      if (s.slots > 0 && Math.abs(s.curve) < 0.5 && Math.abs(s.curveLater) < 1 && s.lap >= 1) await page.keyboard.press('Space')
      lastSteer = want
      trail.push({ t: s.time, x: s.x, speed: s.speed, curve: s.curve })
      // Screenshots of the moments that matter.
      if (s.speed > 0.85 && Math.abs(s.curve) < 0.2 && Math.abs(s.curveLater) < 0.3 && s.time > 6) await shotAt('straight', 'straight at speed')
      if (Math.abs(s.curve) >= 1.5 && Math.abs(s.curve) < 3) await shotAt('gentle', `gentle bend (curve ${s.curve.toFixed(1)})`)
      if (Math.abs(s.curve) >= 4.4) await shotAt('tight', `tight bend (curve ${s.curve.toFixed(1)})`)
      if (Math.abs(s.curve) >= 3 && Math.abs(s.curveLater) >= 3 && Math.sign(s.curve) !== Math.sign(s.curveLater)) await shotAt('scurve', 'S-curve')
      if (Math.abs(s.curve) >= 4.9 && s.time > 5) await shotAt('hairpin', `hairpin-strength bend (curve ${s.curve.toFixed(1)})`)
      if (Math.abs(s.x) > 1.4) await shotAt('offroad', `off the road (x ${s.x.toFixed(2)})`)
      if (s.time > 5 && s.rivals.some((r) => r.dz > 150 && r.dz < 1400 && Math.abs(r.x - s.x) > 0.5)) await shotAt('overtake', 'alongside a rival')
      if (s.boost) await shotAt('boost', 'boost')
      if (s.lap === 2 && s.time > 1) await shotAt('finalLap', 'final lap')
      if (s.time > 12 && Math.abs(s.curve) < 1) await shotAt('scenery', 'environment')
    } else {
      for (const k of Array.from(held)) await press(k, false)
      if (touch) await releaseTouch()
    }
    await page.waitForTimeout(90)
  }
  for (const k of Array.from(held)) await press(k, false)
  const perf = await page.evaluate(() => window.__tamizhiRacePerf?.summary())
  const final = await page.evaluate(look)
  const maxAbsX = trail.reduce((m, p) => Math.max(m, Math.abs(p.x)), 0)
  report[name] = {
    viewport: `${viewport.width}x${viewport.height}`, input: touch ? 'touch' : mode, finished: !!final?.finished, raceTime: final?.time, place: final?.place,
    offroadSeconds: final?.offroad, crashes: final?.crashes, maxAbsX, questionsAnswered: asked, errors, perf, shots: Array.from(taken),
  }
  console.log(JSON.stringify(report[name], null, 1))
  void lastSteer
  await ctx.close()
}

const allShots = { straight: 1, gentle: 1, tight: 1, scurve: 1, hairpin: 1, offroad: 1, overtake: 1, boost: 1, finalLap: 1, scenery: 1, question: 1, answer: 1, podium: 1 }
await drive('city-1366-arrows', { trackIndex: 0, viewport: { width: 1366, height: 768 }, mode: 'arrows', shots: allShots, offroadAt: { lap: 1, after: 0 } })
await drive('temple-1920-wasd', { trackIndex: 1, viewport: { width: 1920, height: 1080 }, mode: 'wasd', shots: allShots, offroadAt: { lap: 1, after: 0 } })
await drive('forest-1366-arrows', { trackIndex: 3, viewport: { width: 1366, height: 768 }, mode: 'arrows', shots: { scurve: 1, tight: 1, scenery: 1, hairpin: 1 } })
await drive('night-phone-touch', { trackIndex: 5, viewport: { width: 844, height: 390 }, mode: 'touch', touch: true, shots: { straight: 1, tight: 1, scenery: 1, question: 1, podium: 1, overtake: 1 } })

// Performance only: the busiest track, no screenshots.
await drive('perf-night-1366', { trackIndex: 5, viewport: { width: 1366, height: 768 }, mode: 'arrows' })
await drive('perf-night-1920', { trackIndex: 5, viewport: { width: 1920, height: 1080 }, mode: 'wasd' })

writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
console.log(`\nreport: ${path.join(outDir, 'report.json')}`)
await browser.close()
server.close()
