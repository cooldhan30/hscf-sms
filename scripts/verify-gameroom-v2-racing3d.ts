// Tamil Grand Prix (rebuilt): pseudo-3D arcade racing, verified headlessly
// against the real modules (lib/gameRoomV2/racing3d):
//   1. six substantially different tracks (geometry, scenery, look, audio)
//   2. road building: easing, closed laps, deterministic scenery
//   3. driving physics: throttle, brake, momentum, centrifugal drift,
//      off-road slowdown, scenery crashes, car bumps
//   4. Tamil checkpoints: freeze -> answer -> power-up -> countdown
//   5. power-ups: each effect, slots, situational awards, star on streaks
//   6. rivals: three personalities, sim-only, finish and standings
//   7. balance: driving skill AND answers both matter; determinism
//   8. Live Classroom: real classmates only, server positions only
//   9. security/learning boundaries, controls, audio, reduced motion
//
//   npx tsx scripts/verify-gameroom-v2-racing3d.ts
import { readFileSync } from 'fs'
import {
  TRACKS,
  SOLID_SCENERY,
  buildRoad,
  segmentAt,
  createRace,
  stepRace,
  answerCheckpoint,
  resumeAfterQuestion,
  planCheckpoints,
  standings,
  placeOf,
  player,
  kmh,
  awardPower,
  POWERS,
  POWER_SLOTS,
  RIVALS,
  PERSONA,
  DIFFICULTY,
  IDLE,
  STEP,
  LAPS,
  MAX_SPEED,
  MAX_RACE_CHECKPOINTS,
  SEGMENT_LENGTH,
  type RaceState,
  type RaceInput,
  type Difficulty,
} from '../lib/gameRoomV2/racing3d'
import { mulberry32 } from '../lib/gameRoomV2/gameplay/rng'
import { N } from '../components/gameRoomV2/gameplay/gameMusic'

let failures = 0
let passes = 0
function assert(cond: unknown, msg: string) {
  if (cond) passes++
  else {
    failures++
    console.error(`  FAIL: ${msg}`)
  }
}
const read = (f: string) => readFileSync(f, 'utf8')
const TAMIL = /[஀-௿]/
const run = (s: RaceState, input: RaceInput, steps: number) => {
  const ev = []
  for (let i = 0; i < steps; i++) ev.push(...stepRace(s, input, STEP))
  return ev
}
const fresh = (over: Partial<{ trackId: string; difficulty: Difficulty; seed: number; questions: number }> = {}) =>
  createRace({ trackId: over.trackId ?? 'coastal-highway', difficulty: over.difficulty ?? 'normal', seed: over.seed ?? 1, questions: over.questions ?? 6 })
const throughCountdown = (s: RaceState) => run(s, IDLE, Math.ceil(3.1 / STEP))
const GAS: RaceInput = { throttle: 1, brake: 0, steer: 0, usePower: false }

console.log('1. Tracks')
assert(TRACKS.length >= 6, `at least 6 tracks (${TRACKS.length})`)
const wanted = ['சென்னை நகர ஓட்டம்', 'கோவில் மலைப்பாதை', 'கடற்கரை விரைவு', 'காட்டு சாலை', 'கிராமப் பாதை', 'இரவு நகரம்']
for (const w of wanted) assert(TRACKS.some((t) => t.tamilName === w), `track "${w}"`)
const sig = (t: (typeof TRACKS)[number]) => t.sections.map((s) => `${s.len}:${s.curve}:${s.hill}`).join('|')
assert(new Set(TRACKS.map(sig)).size === TRACKS.length, 'every track has its own road layout (not recolours)')
assert(new Set(TRACKS.map((t) => t.theme.horizon)).size >= 5, 'distinct horizons/skylines')
assert(new Set(TRACKS.map((t) => t.music)).size === TRACKS.length, 'a different music style per track')
assert(new Set(TRACKS.map((t) => t.ambience)).size === TRACKS.length, 'a different ambience per track')
assert(new Set(TRACKS.map((t) => t.theme.sky.join())).size === TRACKS.length, 'distinct skies / time of day')
assert(TRACKS.some((t) => t.theme.night) && TRACKS.some((t) => t.theme.seaSide), 'a night circuit and a coastal road with the sea')
for (const t of TRACKS) {
  assert(TAMIL.test(t.tamilName) && TAMIL.test(t.blurb), `${t.id}: Tamil name and description`)
  const hills = t.sections.some((s) => Math.abs(s.hill) > 0)
  const curves = t.sections.filter((s) => Math.abs(s.curve) >= 3).length
  assert(hills || t.id === 'night-city' || t.id === 'coastal-highway', `${t.id}: has hills`)
  assert(t.landmarks.length >= 2, `${t.id}: has landmarks`)
  if (t.challenge === 3) assert(curves >= 5, `${t.id}: technical track has many sharp bends`)
}

console.log('2. Road')
for (const t of TRACKS) {
  const r = buildRoad(t)
  const last = r.segments[r.segments.length - 1]
  assert(Math.abs(last.y2) < 1, `${t.id}: lap closes at the start height`)
  assert(r.segments.length >= 1000 && r.segments.length <= 2200, `${t.id}: lap length ${r.segments.length} segments`)
  assert(r.segments.slice(0, 12).every((s) => s.sprites.length === 0), `${t.id}: start grid is clear`)
  let maxJump = 0
  for (let i = 1; i < r.segments.length; i++) maxJump = Math.max(maxJump, Math.abs(r.segments[i].curve - r.segments[i - 1].curve))
  assert(maxJump < 1.5, `${t.id}: curves ease in and out (max step ${maxJump.toFixed(2)})`)
  const sprites = r.segments.reduce((a, s) => a + s.sprites.length, 0)
  assert(sprites > 150, `${t.id}: rich roadside scenery (${sprites} pieces)`)
  assert(r.segments.every((s) => s.sprites.every((p) => Math.abs(p.offset) > 1.2)), `${t.id}: scenery stays off the road`)
  const again = buildRoad(t)
  assert(JSON.stringify(again.segments.map((s) => s.sprites)) === JSON.stringify(r.segments.map((s) => s.sprites)), `${t.id}: deterministic`)
}
assert(buildRoad(TRACKS[0]).segments.some((s) => s.sprites.some((p) => p.kind === 'sign')), 'warning signs before sharp bends')

console.log('3. Driving')
{
  const s = fresh()
  const ev = throughCountdown(s)
  assert(ev.some((e) => e.type === 'go') && s.status === 'racing', '3-2-1-GO starts the race')
  assert(ev.filter((e) => e.type === 'count').length >= 2, 'countdown ticks')
  run(s, GAS, 60)
  const v1 = player(s).speed
  run(s, GAS, 120)
  assert(player(s).speed > v1 && v1 > 0, 'throttle accelerates with momentum')
  assert(player(s).speed <= MAX_SPEED + 1, 'top speed capped')
  const vb = player(s).speed
  run(s, { throttle: 0, brake: 1, steer: 0, usePower: false }, 30)
  assert(player(s).speed < vb * 0.6, 'brakes bite')
  const vc = player(s).speed
  run(s, IDLE, 30)
  assert(player(s).speed < vc && player(s).speed > 0, 'coasting slows gently')
}
{
  const s = fresh()
  throughCountdown(s)
  run(s, GAS, 200)
  const p = player(s)
  p.x = 0
  const slowX = (() => {
    const t = fresh()
    throughCountdown(t)
    run(t, GAS, 20)
    return player(t)
  })()
  const x0 = p.x
  run(s, { throttle: 1, brake: 0, steer: 1, usePower: false }, 20)
  const fastTurn = p.x - x0
  slowX.x = 0
  const t2 = fresh()
  throughCountdown(t2)
  run(t2, GAS, 12)
  const q = player(t2)
  q.x = 0
  run(t2, { throttle: 0, brake: 0, steer: 1, usePower: false }, 20)
  assert(fastTurn > q.x, 'steering is speed-sensitive (more lateral travel at speed)')
}
{
  // Centrifugal: on a bend with no steering the car drifts outward.
  const s = fresh({ trackId: 'forest-road' })
  throughCountdown(s)
  const bend = s.road.segments.findIndex((g) => Math.abs(g.curve) >= 4)
  const p = player(s)
  p.z = bend * SEGMENT_LENGTH
  p.speed = MAX_SPEED
  p.x = 0
  const c = segmentAt(s.road, p.z).curve
  run(s, { throttle: 1, brake: 0, steer: 0, usePower: false }, 10)
  assert(Math.sign(-c) === Math.sign(p.x) && Math.abs(p.x) > 0.02, 'bends push the car outward (centrifugal)')
}
{
  const s = fresh()
  throughCountdown(s)
  const p = player(s)
  p.speed = MAX_SPEED
  p.x = 1.5
  const ev = run(s, GAS, 30)
  assert(p.speed < MAX_SPEED * 0.85, 'off-road slows the car')
  assert(ev.some((e) => e.type === 'offroad'), 'off-road reported')
}
{
  // Crash into a solid roadside piece.
  const s = fresh({ trackId: 'chennai-city' })
  throughCountdown(s)
  const i = s.road.segments.findIndex((g, k) => k > 50 && g.sprites.some((sp) => sp.solid && SOLID_SCENERY.has(sp.kind)))
  const sp = s.road.segments[i].sprites.find((x) => x.solid)!
  const p = player(s)
  p.z = i * SEGMENT_LENGTH + 10
  p.x = sp.offset
  p.speed = MAX_SPEED * 0.8
  const ev = run(s, GAS, 1)
  assert(ev.some((e) => e.type === 'crash') && p.speed < MAX_SPEED * 0.2, 'driving into scenery crashes (big slowdown)')
  assert(Math.abs(p.x) < Math.abs(sp.offset), 'crash knocks the car back toward the road')
  assert(p.crashT > 0, 'recovery time after a crash')
}
{
  // Bump into a slower car ahead.
  const s = fresh()
  throughCountdown(s)
  const p = player(s)
  const r = s.cars[1]
  p.z = 20000
  p.x = 0
  p.speed = MAX_SPEED
  r.z = 20000 + SEGMENT_LENGTH * 0.5
  r.x = 0
  r.speed = MAX_SPEED * 0.5
  const ev = run(s, GAS, 1)
  assert(ev.some((e) => e.type === 'bump') && p.speed < MAX_SPEED * 0.7, 'rear-ending a car costs speed')
}

console.log('4. Checkpoints')
{
  assert(planCheckpoints(1000, 3, 10).length === MAX_RACE_CHECKPOINTS, 'at most two question checkpoints per lap')
  assert(planCheckpoints(1000, 3, 2).length === 2 && planCheckpoints(1000, 3, 0).length === 0, 'fewer questions -> fewer checkpoints')
  const cps = planCheckpoints(1000, 3, 6)
  assert(cps.every((z, i) => i === 0 || z > cps[i - 1]), 'checkpoints in order along the race')
  const s = fresh({ questions: 6 })
  throughCountdown(s)
  const p = player(s)
  p.z = s.checkpoints[0] - 5
  p.speed = MAX_SPEED
  const ev = run(s, GAS, 1)
  assert(ev.some((e) => e.type === 'checkpoint') && s.status === 'question', 'crossing a checkpoint opens a question')
  const snapshot = s.cars.map((c) => c.z).join()
  const t = s.time
  run(s, GAS, 300)
  assert(s.cars.map((c) => c.z).join() === snapshot && s.time === t, 'the whole race freezes while the student answers (fair)')
  const out = answerCheckpoint(s, true)
  assert(out.power !== null && s.slots.length === 1, 'correct answer -> a power-up in a slot')
  assert(s.status === 'resume', 'then a countdown')
  const ev2 = run(s, GAS, Math.ceil(3.05 / STEP))
  assert(ev2.some((e) => e.type === 'resumeGo') && s.status === 'racing', 'the race resumes after 3-2-1')
  const s2 = fresh()
  throughCountdown(s2)
  player(s2).z = s2.checkpoints[0] - 1
  player(s2).speed = MAX_SPEED
  run(s2, GAS, 1)
  const wrong = answerCheckpoint(s2, false)
  assert(wrong.power === null && s2.slots.length === 0 && s2.status === 'resume', 'wrong answer: no power, fair resume')
  const s3 = fresh()
  throughCountdown(s3)
  player(s3).z = s3.checkpoints[0] - 1
  player(s3).speed = MAX_SPEED
  run(s3, GAS, 1)
  resumeAfterQuestion(s3)
  assert(s3.status === 'resume', 'a checkpoint with no question left simply resumes')
}

console.log('5. Power-ups')
{
  assert(Object.keys(POWERS).length >= 7, 'seven power-ups')
  for (const pw of Object.values(POWERS)) assert(TAMIL.test(pw.tamilName) && TAMIL.test(pw.tamilHint), `${pw.id}: Tamil name and hint`)
  const fire = (id: keyof typeof POWERS) => {
    const s = fresh()
    throughCountdown(s)
    run(s, GAS, 120)
    s.slots = [id]
    const before = { speed: player(s).speed }
    const ev = run(s, { ...GAS, usePower: true }, 1)
    return { s, p: player(s), ev, before }
  }
  const b = fire('boost')
  assert(b.p.boostT > 0 && b.ev.some((e) => e.type === 'power'), 'boost fires and lasts')
  run(b.s, GAS, 150)
  assert(kmh(b.p.speed) > kmh(MAX_SPEED), 'boost raises top speed above normal')
  const sh = fire('shield')
  sh.p.x = 1.8
  sh.p.speed = MAX_SPEED
  run(sh.s, GAS, 30)
  assert(sh.p.speed > MAX_SPEED * 0.9, 'shield: grass does not slow you')
  const bu = fire('burst')
  assert(bu.p.speed >= MAX_SPEED * 1.15, 'speed burst: instant speed')
  const mg = fire('magnet')
  assert(mg.p.magnetT > 0, 'coin magnet lasts')
  const gr = fire('grip')
  assert(gr.p.gripT > 0, 'grip lasts')
  const rp = (() => {
    const s = fresh()
    throughCountdown(s)
    run(s, GAS, 60)
    const p = player(s)
    p.x = 2.5
    p.speed = 500
    p.crashT = 0.8
    s.slots = ['repair']
    run(s, { ...GAS, usePower: true }, 1)
    return p
  })()
  assert(Math.abs(rp.x) <= 0.6 && rp.speed >= MAX_SPEED * 0.69 && rp.crashT === 0, 'recovery: back on the road at speed')
  const st = fire('star')
  assert(st.p.starT > 0, 'Tamil star: shield + boost')
  // Slots.
  const s = fresh()
  throughCountdown(s)
  for (let k = 0; k < POWER_SLOTS + 1; k++) {
    player(s).z = s.checkpoints[s.nextCheckpoint] - 1
    player(s).speed = MAX_SPEED
    run(s, GAS, 1)
    answerCheckpoint(s, true)
    run(s, GAS, Math.ceil(3.05 / STEP))
  }
  assert(s.slots.length === POWER_SLOTS, `never more than ${POWER_SLOTS} held`)
  // Situational awards.
  assert(awardPower({ place: 1, racers: 4, offroadShare: 0, streak: 3 }, 0.1) === 'star', 'a 3-answer streak earns the Tamil star')
  assert(['grip', 'repair'].includes(awardPower({ place: 2, racers: 4, offroadShare: 0.4, streak: 1 }, 0.5)), 'lots of grass -> handling help')
  assert(['boost', 'burst', 'grip'].includes(awardPower({ place: 4, racers: 4, offroadShare: 0, streak: 1 }, 0.3)), 'last place -> speed')
  assert(['shield', 'magnet', 'boost'].includes(awardPower({ place: 1, racers: 4, offroadShare: 0, streak: 1 }, 0.3)), 'leader -> defence')
  // Coins.
  const c = fresh()
  throughCountdown(c)
  let coins = 0
  for (let i = 0; i < 60 * 20; i++) {
    const p = player(c)
    const next = c.coins.find((k) => k.z > (p.z % c.road.lapLength))
    for (const e of stepRace(c, { throttle: 1, brake: 0, steer: next ? Math.max(-1, Math.min(1, (next.x - p.x) * 4)) : 0, usePower: false })) if (e.type === 'coin') coins++
    if (c.status === 'question') answerCheckpoint(c, false)
  }
  assert(coins > 5, `coins can be collected on the road (${coins})`)
}

console.log('6. Rivals')
{
  assert(RIVALS.map((r) => r.id).join() === 'kayal,mugil,aruvi', 'Kayal, Mugil and Aruvi')
  assert(new Set(RIVALS.map((r) => r.personality)).size === 3, 'three different driving personalities')
  for (const r of RIVALS) assert(TAMIL.test(r.tamilName) && TAMIL.test(r.blurb), `${r.id}: Tamil name and style`)
  assert(PERSONA.aggressive.top > PERSONA.smooth.top && PERSONA.smooth.top > PERSONA.steady.top, 'Mugil fastest in a straight line, Aruvi steadiest')
  assert(PERSONA.steady.corner > PERSONA.aggressive.corner && PERSONA.aggressive.runsWide > 0 && PERSONA.steady.straightBoost, 'Aruvi corners best and boosts on straights; Mugil runs wide')
  assert(DIFFICULTY.easy.pace < DIFFICULTY.normal.pace && DIFFICULTY.normal.pace < DIFFICULTY.hard.pace, 'difficulty scales rival pace')
  const s = fresh()
  throughCountdown(s)
  run(s, IDLE, 60 * 5)
  assert(s.cars.slice(1).every((c) => c.z > SEGMENT_LENGTH * 20), 'rivals drive the track themselves')
  const sim = read('lib/gameRoomV2/racing3d/sim.ts')
  assert(!/fetch\(|supabase|sessionId|studentId|xp\b/i.test(sim), 'rivals are simulation-only: no accounts, records, XP or network')
}

console.log('7. Balance and determinism')
function botRace(trackId: string, difficulty: Difficulty, usePowers: boolean, correct: boolean): { place: number; time: number; over: boolean } {
  const s = createRace({ trackId, difficulty, seed: 11, questions: 6 })
  let steps = 0
  const r = mulberry32(3)
  while (!s.over && steps < 60 * 400) {
    const p = player(s)
    let input: RaceInput = IDLE
    if (s.status === 'racing') {
      const ahead = segmentAt(s.road, p.z + 2000)
      let want = -Math.sign(ahead.curve) * 0.3
      for (const c of s.cars) {
        if (c.isPlayer) continue
        const dz = c.z - p.z
        if (dz > 0 && dz < 2400 && Math.abs(c.x - want) < 0.45) want = c.x > 0 ? c.x - 0.7 : c.x + 0.7
      }
      want = Math.max(-0.85, Math.min(0.85, want))
      input = { throttle: 1, brake: 0, steer: Math.max(-1, Math.min(1, (want - p.x) * 2 + segmentAt(s.road, p.z).curve * 0.35)), usePower: usePowers && s.slots.length > 0 && Math.abs(ahead.curve) < 1 && r() < 0.5 }
    }
    for (const e of stepRace(s, input)) if (e.type === 'checkpoint') answerCheckpoint(s, correct)
    steps++
  }
  return { place: placeOf(s, 'player'), time: s.time, over: s.over }
}
{
  const hardNoPower = TRACKS.map((t) => botRace(t.id, 'hard', false, false).place)
  const hardPower = TRACKS.map((t) => botRace(t.id, 'hard', true, true).place)
  const easy = TRACKS.map((t) => botRace(t.id, 'easy', false, false))
  assert(easy.every((r) => r.over), 'every race finishes')
  assert(easy.every((r) => r.time > 50 && r.time < 150), `races last about a minute or two (${easy.map((r) => r.time.toFixed(0)).join(',')}s)`)
  assert(hardNoPower.some((p) => p > 1), `hard: clean driving alone does not always win (${hardNoPower.join(',')})`)
  assert(hardPower.filter((p) => p === 1).length > hardNoPower.filter((p) => p === 1).length, `hard: correct answers + well-timed power-ups help (${hardPower.join(',')} vs ${hardNoPower.join(',')})`)
  const a = botRace('temple-hill', 'normal', true, true)
  const b = botRace('temple-hill', 'normal', true, true)
  assert(a.place === b.place && a.time === b.time, 'deterministic for the same seed and inputs')
  const s = fresh()
  throughCountdown(s)
  const order = standings(s).map((c) => c.id)
  assert(order[order.length - 1] === 'player', 'the player starts at the back of the grid')
}

console.log('8. Live Classroom')
{
  const rg = read('components/gameRoomV2/racing/RacingGame.tsx')
  const live = read('components/gameRoomV2/racing3d/LiveRace3D.tsx')
  assert(/\/api\/gameroom-v2\/live\/\$\{liveSessionId\}\/race/.test(rg), 'live positions come from the server race endpoint')
  assert(!/RIVALS|createRace|stepRace/.test(rg.split('function MultiplayerRacingGame')[1] ?? '') && !/RIVALS|createRace|stepRace/.test(live), 'live mode adds no simulated racers (real classmates only)')
  assert(!/fetch\(/.test(live), 'the live view never sends positions anywhere')
  assert(/cars: racers\.map\(\(r, i\)/.test(live) && /r\.distance \/ len/.test(live), 'every car drawn is a server racer at its server distance')
  assert(/steerOnly/.test(live), 'in class the student steers across lanes only (answers drive the car)')
  assert(/TRACKS\[seedFromString\(liveSessionId\) % TRACKS\.length\]/.test(rg), 'the whole class races the same track')
  assert(/setInterval\(pollRace, LIVE_POLL_INTERVAL_MS\)/.test(rg) && /raceFinished\]\)/.test(rg), 'coarse polling that stops at the finish')
}

console.log('9. Boundaries, controls, audio')
{
  const game = read('components/gameRoomV2/racing3d/RaceGame3D.tsx')
  assert(!/fetch\(/.test(game), 'solo race sends nothing itself (answers go through QuestionOverlay; rewards from /complete)')
  assert(/<QuestionOverlay/.test(game) && /useQuestionGate/.test(game), 'server-graded questions; session paused whenever no question is open')
  assert(/localStorage/.test(game) && /Personal bests live on this device only/.test(game), 'personal bests are local conveniences only')
  assert(/<CelebrationLayer/.test(game) && /celebrate\.current\?\.correct/.test(game) && /<AnswerReview/.test(game), 'correct-answer celebration and calm review')
  const input = read('components/gameRoomV2/racing/useDriveInput.ts')
  for (const k of ["'w'", "'a'", "'s'", "'d'", "'arrowup'", "'arrowleft'"]) assert(input.includes(k), `keyboard ${k}`)
  assert(/key === ' '/.test(input) && /escape/.test(input), 'Space fires power-ups, Escape pauses')
  assert(/addEventListener\('blur', clear\)/.test(input) && /visibilitychange/.test(input), 'no stuck keys on blur / tab switch')
  const touch = read('components/gameRoomV2/racing/TouchControls.tsx')
  assert(/setPointerCapture/.test(touch) && /onPointerCancel/.test(touch) && /onLostPointerCapture/.test(touch), 'multi-touch: each control owns its pointer and releases on cancel')
  assert(/c === 'chase' \? 'cockpit' : 'chase'/.test(game) && /key\.toLowerCase\(\) === 'c'/.test(game), 'chase / driver-seat camera toggle (C)')
  const render = read('components/gameRoomV2/racing3d/render.ts')
  assert(/drawCockpit/.test(render) && /project\(/.test(render) && /DRAW_DISTANCE/.test(render), 'perspective road renderer with cockpit view')
  assert(/!v\.reduced && v\.speedPct > 0\.85/.test(render) && /v\.reduced \? 0/.test(render), 'reduced motion: no speed lines or camera shake')
  const sprites = read('components/gameRoomV2/racing3d/sprites.ts')
  assert(/drawn ONCE into an offscreen canvas/.test(sprites), 'scenery pre-rendered once (performance)')
  assert(/document\.hidden/.test(game) && /cancelAnimationFrame\(raf\)/.test(game), 'loop stops when hidden and on unmount')
  const music = read('components/gameRoomV2/racing3d/music.ts')
  const toks = new Set<string>()
  for (const m of Array.from(music.matchAll(/'([A-G][#b]?\d)'/g))) toks.add(m[1])
  for (const m of Array.from(music.matchAll(/line\(\[([\s\S]*?)\]\)/g))) for (const t of m[1].replace(/['\s,]+/g, ' ').split(' ')) if (/^[A-G]/.test(t)) toks.add(t)
  const bad = Array.from(toks).filter((t) => N[t] === undefined)
  assert(bad.length === 0, `every music note is valid (${bad.join(',')})`)
  assert(/duck\(duck\)/.test(game) && /setHidden\(hidden\)/.test(game) && /startAudio\(\)/.test(game), 'music ducks under questions, pauses hidden, starts on click')
  assert(/setMood\('boss'\)/.test(game), 'final-lap music')
  assert(!/\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDEFF]|\uD83E[\uDD00-\uDEFF]/.test(game + read('components/gameRoomV2/racing3d/LiveRace3D.tsx')), 'no emoji art')
}

console.log(`\n${passes} passed, ${failures} failed`)
if (failures) {
  console.error('RACING VERIFICATION FAILED')
  process.exit(1)
}
console.log('RACING VERIFICATION PASSED')
