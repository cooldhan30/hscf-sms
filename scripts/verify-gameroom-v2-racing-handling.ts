// Tamil Grand Prix driving feel -- deterministic handling tests against
// the real simulation (lib/gameRoomV2/racing3d/sim.ts):
//   1. constant-radius corners (every bend strength the tracks use)
//   2. S-curve: left -> right transition stays controllable and smooth
//   3. hairpin: too fast runs wide; braking + steering makes it
//   4. high-speed turning never collapses
//   5. low-speed / off-road recovery
//   6. frame-rate independence: 30 / 60 / 120 FPS
//   7. input: smoothing, no dead zone, sign conventions shared with the
//      renderer (a right bend is DRAWN to the right and pushes the car left)
//   8. every bend of every real track can be held at top speed
//
//   npx tsx scripts/verify-gameroom-v2-racing-handling.ts
import {
  TRACKS,
  buildRoad,
  createRace,
  stepRace,
  segmentAt,
  steerAuthority,
  bendDrift,
  smoothSteer,
  projectRoad,
  roadOffsetAhead,
  rig,
  RoadFrame,
  newCamera,
  updateCamera,
  cameraYaw,
  HANDLING,
  STEP,
  MAX_SPEED,
  BOOST_MULT,
  SEGMENT_LENGTH,
  type RaceState,
  type RaceInput,
  type TrackDef,
  type TrackSection,
} from '../lib/gameRoomV2/racing3d'

let failures = 0
let passes = 0
function assert(cond: unknown, msg: string) {
  if (cond) {
    passes++
    console.log(`  ok  ${msg}`)
  } else {
    failures++
    console.error(`  FAIL: ${msg}`)
  }
}

// A race on a custom test road: no rivals (parked, finished), no coins,
// no question checkpoints -- just the player's car and the road.
function testRace(sections: TrackSection[], opts: { speed?: number; x?: number; z?: number } = {}): RaceState {
  const base = TRACKS[0]
  const track: TrackDef = { ...base, id: 'handling-test', sections: [{ len: 40, curve: 0, hill: 0 }, ...sections, { len: 200, curve: 0, hill: 0 }], scenery: [], landmarks: [] }
  const s = createRace({ trackId: base.id, difficulty: 'normal', seed: 1, questions: 0 })
  s.track = track
  s.road = buildRoad(track)
  for (const seg of s.road.segments) {
    seg.sprites = seg.sprites.filter((sp) => sp.kind === 'chevron')
    seg.rail = 0 // measure the car, not the guard rail
  }
  s.raceLength = s.road.lapLength * s.laps
  s.coins = []
  s.checkpoints = []
  for (const c of s.cars.slice(1)) {
    c.finished = true
    c.z = -1e7
  }
  s.status = 'racing'
  const p = s.cars[0]
  p.z = opts.z ?? SEGMENT_LENGTH * 20
  p.x = opts.x ?? 0
  p.speed = opts.speed ?? MAX_SPEED
  p.pz = p.z
  p.px = p.x
  return s
}

const segStart = (s: RaceState, sectionIndex: number) => {
  // Absolute segment where test section `sectionIndex` (0-based, after the lead-in) begins.
  let i = 40
  for (let k = 0; k < sectionIndex; k++) i += s.track.sections[k + 1].len
  return i
}

// A reactive driver, like a student watching the screen: aims at where
// the road centre will be a moment ahead and steers towards it. It knows
// nothing about the handling constants.
function driver(s: RaceState, opts: { throttle?: number; brake?: number; lookS?: number; gain?: number; target?: number } = {}): RaceInput {
  const p = s.cars[0]
  const look = Math.max(SEGMENT_LENGTH * 4, p.speed * (opts.lookS ?? 0.35))
  // Road centre `look` ahead, in half-widths, relative to where the car
  // is heading now.
  const roadAhead = roadOffsetAhead(s.road, p.z, look) / 2000
  const carAhead = p.x + p.vx * (look / Math.max(p.speed, 1))
  const err = (opts.target ?? 0) + roadAhead - carAhead
  const steer = Math.max(-1, Math.min(1, err * (opts.gain ?? 2.2)))
  return { throttle: opts.throttle ?? 1, brake: opts.brake ?? 0, steer, usePower: false }
}

function run(s: RaceState, seconds: number, input: (s: RaceState, t: number) => RaceInput, dt = STEP, each?: (s: RaceState, t: number) => void) {
  const steps = Math.round(seconds / dt)
  for (let i = 0; i < steps; i++) {
    stepRace(s, input(s, i * dt), dt)
    each?.(s, (i + 1) * dt)
  }
}

console.log('1. Constant-radius corners')
for (const curve of [2, 3.5, 5, 6]) {
  for (const dir of [1, -1]) {
    // Enter from the straight at top speed, like a player would.
    const s = testRace([{ len: 200, curve: curve * dir, hill: 0 }])
    const p = s.cars[0]
    const start = segStart(s, 0)
    p.z = (start - 15) * SEGMENT_LENGTH
    let maxAbsX = 0
    let minSpeed = Infinity
    let held = 0
    let heldN = 0
    run(s, 3, (st) => driver(st), STEP, (st) => {
      const c = st.cars[0]
      maxAbsX = Math.max(maxAbsX, Math.abs(c.x))
      minSpeed = Math.min(minSpeed, c.speed)
      if (Math.abs(segmentAt(st.road, c.z).curve) === curve) {
        held += Math.abs(c.steer)
        heldN++
      }
    })
    const lock = held / Math.max(1, heldN)
    assert(maxAbsX < 0.35, `curve ${curve * dir} at top speed: the car follows the bend (max |x| ${maxAbsX.toFixed(2)} half-widths)`)
    assert(minSpeed > MAX_SPEED * 0.95, `curve ${curve * dir}: no speed lost while following it (min ${((minSpeed / MAX_SPEED) * 100).toFixed(0)}%)`)
    assert(heldN > 30 && lock < (curve >= 6 ? 0.95 : 0.7), `curve ${curve * dir}: held with ${(lock * 100).toFixed(0)}% lock on average`)
    // Hands off: the bend pushes the car to its outside.
    const s2 = testRace([{ len: 200, curve: curve * dir, hill: 0 }])
    s2.cars[0].z = (start + 30) * SEGMENT_LENGTH
    run(s2, 1, () => ({ throttle: 1, brake: 0, steer: 0, usePower: false }))
    assert(Math.sign(s2.cars[0].x) === -dir && Math.abs(s2.cars[0].x) > 0.04 * curve, `curve ${curve * dir}: hands off, the car drifts to the outside (x ${s2.cars[0].x.toFixed(2)})`)
  }
}

console.log('2. S-curve')
{
  const s = testRace([{ len: 70, curve: 4.5, hill: 0 }, { len: 70, curve: -4.5, hill: 0 }])
  const p = s.cars[0]
  p.z = (segStart(s, 0) - 10) * SEGMENT_LENGTH
  let maxAbsX = 0
  let maxAccel = 0
  let lastVx = 0
  let reversals = 0
  let lastSign = 0
  run(s, 3.2, (st) => driver(st), STEP, (st) => {
    const c = st.cars[0]
    maxAbsX = Math.max(maxAbsX, Math.abs(c.x))
    maxAccel = Math.max(maxAccel, Math.abs(c.vx - lastVx) / STEP)
    lastVx = c.vx
    const sg = Math.sign(Math.round(c.steer * 10))
    if (sg !== 0 && sg !== lastSign) {
      if (lastSign !== 0) reversals++
      lastSign = sg
    }
  })
  assert(maxAbsX < 0.45, `left -> right at top speed stays on the road, near the middle (max |x| ${maxAbsX.toFixed(2)})`)
  assert(maxAccel < 40, `lateral response is smooth, no jerks (max ${maxAccel.toFixed(1)} half-widths/s^2)`)
  assert(reversals <= 4, `no zig-zag: steering changes direction ${reversals} times through the S`)
  // The same S by keyboard (on/off keys): a student tapping the arrows.
  const k = testRace([{ len: 70, curve: 4.5, hill: 0 }, { len: 70, curve: -4.5, hill: 0 }])
  k.cars[0].z = p.z - 3.2 * MAX_SPEED
  let kMax = 0
  run(k, 3.2, (st) => {
    const d = driver(st)
    return { ...d, steer: d.steer > 0.25 ? 1 : d.steer < -0.25 ? -1 : 0 }
  }, STEP, (st) => {
    kMax = Math.max(kMax, Math.abs(st.cars[0].x))
  })
  assert(kMax < 0.6, `with digital keys (full lock or nothing) the S is still easy (max |x| ${kMax.toFixed(2)})`)
}

console.log('3. Hairpin')
{
  // A true hairpin: ~180 degrees at the tightest curve the tracks allow.
  const hair: TrackSection[] = [{ len: 140, curve: 6, hill: 0 }]
  // Flat out, boosted, no braking: runs wide (extreme speed is limited).
  const a = testRace(hair, { speed: MAX_SPEED * BOOST_MULT })
  a.cars[0].boostT = 10
  a.cars[0].z = (segStart(a, 0) - 10) * SEGMENT_LENGTH
  let wide = 0
  run(a, 2.2, (st) => ({ ...driver(st), brake: 0 }), STEP, (st) => {
    wide = Math.max(wide, Math.abs(st.cars[0].x))
  })
  assert(wide > 0.9, `boosting flat out into a hairpin runs wide (|x| reached ${wide.toFixed(2)}) -- extreme speed is limited`)
  // At normal top speed it is tight but makeable; braking makes it easy.
  const n = testRace(hair)
  n.cars[0].z = (segStart(n, 0) - 10) * SEGMENT_LENGTH
  let nMax = 0
  run(n, 2.6, (st) => driver(st), STEP, (st) => {
    nMax = Math.max(nMax, Math.abs(st.cars[0].x))
  })
  assert(nMax < 1 && nMax > 0.2, `at normal top speed the hairpin is tight but stays on the road (max |x| ${nMax.toFixed(2)})`)
  // Arrive boosted, brake on the way in (and dab it again if the car is
  // still too quick in the tightest part), steer: stays on the road.
  const b = testRace(hair, { speed: MAX_SPEED * BOOST_MULT })
  b.cars[0].boostT = 1
  b.cars[0].z = (segStart(b, 0) - 20) * SEGMENT_LENGTH
  let bMax = 0
  run(b, 3, (st, t) => {
    const d = driver(st)
    const c = st.cars[0]
    const tight = Math.abs(segmentAt(st.road, c.z).curve) >= 5
    const brake = t < 0.4 || (tight && c.speed > MAX_SPEED * 0.8)
    return { ...d, throttle: brake ? 0 : 1, brake: brake ? 1 : 0 }
  }, STEP, (st) => {
    bMax = Math.max(bMax, Math.abs(st.cars[0].x))
  })
  assert(bMax < 0.7, `braking into the hairpin then steering keeps the car on the road (max |x| ${bMax.toFixed(2)})`)
  // Ran wide onto the grass: steering brings it back.
  const c = testRace(hair, { speed: MAX_SPEED * 0.6, x: -1.5 })
  c.cars[0].z = (segStart(c, 0) + 20) * SEGMENT_LENGTH
  let back = -1
  run(c, 3, (st) => driver(st), STEP, (st, t) => {
    if (back < 0 && Math.abs(st.cars[0].x) < 0.9) back = t
  })
  assert(back > 0 && back < 1.5, `run wide in the hairpin, back on the road in ${back.toFixed(2)} s`)
}

console.log('4. High-speed turning')
{
  const mid = steerAuthority(MAX_SPEED * 0.5)
  const top = steerAuthority(MAX_SPEED)
  const boost = steerAuthority(MAX_SPEED * BOOST_MULT)
  assert(top >= mid * 0.85, `full lock at top speed keeps ${(top / mid * 100).toFixed(0)}% of mid-speed authority`)
  assert(boost >= mid * 0.78, `...and ${(boost / mid * 100).toFixed(0)}% while boosting (limited, never useless)`)
  // Lane change at top speed on a straight.
  const s = testRace([{ len: 200, curve: 0, hill: 0 }])
  let t06 = -1
  run(s, 1.5, (st) => ({ throttle: 1, brake: 0, steer: 1, usePower: false }), STEP, (st, t) => {
    if (t06 < 0 && st.cars[0].x >= 0.66) t06 = t
  })
  assert(t06 > 0 && t06 < 0.55, `a full lane change at top speed takes ${t06.toFixed(2)} s`)
  // Holding a lane-change against a strong bend still works.
  const s2 = testRace([{ len: 200, curve: -5, hill: 0 }])
  s2.cars[0].z = (segStart(s2, 0) + 40) * SEGMENT_LENGTH
  const x0 = s2.cars[0].x
  run(s2, 0.6, () => ({ throttle: 1, brake: 0, steer: 1, usePower: false }))
  assert(s2.cars[0].x - x0 > 0.4, `in a strong bend, steering to the inside still moves the car (+${(s2.cars[0].x - x0).toFixed(2)} in 0.6 s)`)
}

console.log('5. Low-speed and off-road recovery')
{
  assert(steerAuthority(MAX_SPEED * 0.15) > 0.7, `at 15% speed the car still turns (${steerAuthority(MAX_SPEED * 0.15).toFixed(2)} half-widths/s)`)
  assert(steerAuthority(0) === 0, 'a stopped car does not slide sideways')
  const a = testRace([{ len: 300, curve: 0, hill: 0 }], { speed: MAX_SPEED * 0.25, x: 2.4 })
  let back = -1
  run(a, 4, (st) => ({ throttle: 1, brake: 0, steer: st.cars[0].x > 0.3 ? -1 : 0, usePower: false }), STEP, (st, t) => {
    if (back < 0 && Math.abs(st.cars[0].x) < 1) back = t
  })
  assert(back > 0 && back < 2.5, `from deep in the grass at low speed: back on the road in ${back.toFixed(2)} s`)
  const b = testRace([{ len: 300, curve: 0, hill: 0 }], { speed: 0, x: -2 })
  let back2 = -1
  run(b, 5, (st) => ({ throttle: 1, brake: 0, steer: st.cars[0].x < -0.3 ? 1 : 0, usePower: false }), STEP, (st, t) => {
    if (back2 < 0 && Math.abs(st.cars[0].x) < 1) back2 = t
  })
  assert(back2 > 0 && back2 < 3, `from a standstill on the grass: back on the road in ${back2.toFixed(2)} s`)
  // A crash glances the car back towards the road, it never sticks.
  const c = testRace([{ len: 300, curve: 0, hill: 0 }], { speed: MAX_SPEED * 0.8, x: 1.2 })
  c.cars[0].vx = 2
  c.road.segments[segmentAt(c.road, c.cars[0].z).index + 1].sprites.push({ kind: 'tree', offset: 1.5, scale: 1, solid: true, halfWidth: 0.3, landmark: false, variant: 0, depth: 0 })
  run(c, 0.2, () => ({ throttle: 1, brake: 0, steer: 0, usePower: false }))
  assert(c.cars[0].vx + c.cars[0].kick < 0, 'after hitting a roadside tree the car moves back towards the road')
  // A knock (bump, rail, crash) shoves the car sideways without turning
  // its nose -- so the camera, which follows the heading, never jolts round.
  const k = testRace([{ len: 300, curve: 0, hill: 0 }])
  k.cars[0].kick = 0.8
  run(k, 0.1, () => ({ throttle: 1, brake: 0, steer: 0, usePower: false }))
  assert(k.cars[0].x > 0.04 && Math.abs(k.cars[0].yaw) < 0.01, `a knock moves the car (+${k.cars[0].x.toFixed(2)}) but keeps its heading (${k.cars[0].yaw.toFixed(3)} rad)`)
}

console.log('6. Frame-rate independence (30 / 60 / 120 FPS)')
{
  // A lap-like route with every kind of bend.
  const route: TrackSection[] = [
    { len: 60, curve: 3, hill: 5 }, { len: 40, curve: 0, hill: 0 }, { len: 60, curve: -5, hill: -5 }, { len: 60, curve: 5, hill: 0 },
    { len: 80, curve: 0, hill: 0 }, { len: 70, curve: -6, hill: 0 }, { len: 60, curve: 2, hill: 0 },
  ]
  // Scripted controls as a function of time (what a player's hands do):
  // throttle, a brake before the tight bend, and steering from a fixed
  // steering plan so every rate gets the same inputs.
  const plan = (t: number): RaceInput => ({
    throttle: t > 4.2 && t < 4.8 ? 0 : 1,
    brake: t > 4.2 && t < 4.8 ? 1 : 0,
    steer: Math.max(-1, Math.min(1, Math.sin(t * 1.3) * 0.8 + (t > 6 && t < 6.4 ? 1 : 0))),
    usePower: false,
  })
  // (a) The real game loop: fixed 60 Hz simulation, render frames at
  // 30/60/120 Hz sampling the controls once per frame.
  const loop = (fps: number) => {
    const s = testRace(route)
    s.cars[0].z = 40 * SEGMENT_LENGTH
    const trail: { t: number; x: number; z: number }[] = []
    let acc = 0
    let t = 0
    const frameDt = 1 / fps
    for (let f = 0; f < fps * 8; f++) {
      const input = plan(t) // sampled at the frame, like readControls()
      acc += frameDt
      while (acc >= STEP - 1e-9) {
        stepRace(s, input, STEP)
        acc -= STEP
      }
      t += frameDt
      if (Math.abs(t * 2 - Math.round(t * 2)) < 1e-6) trail.push({ t: Math.round(t * 2) / 2, x: s.cars[0].x, z: s.cars[0].z })
    }
    return trail
  }
  // (b) The physics integrated directly at each step length.
  const raw = (hz: number) => {
    const s = testRace(route)
    s.cars[0].z = 40 * SEGMENT_LENGTH
    const trail: { t: number; x: number; z: number }[] = []
    const dt = 1 / hz
    for (let i = 1; i <= hz * 8; i++) {
      stepRace(s, plan((i - 1) * dt), dt)
      if (i % (hz / 2) === 0) trail.push({ t: i * dt, x: s.cars[0].x, z: s.cars[0].z })
    }
    return trail
  }
  // Tolerances: a key press can only be seen at the next frame, so at
  // 30 FPS the same hands act up to 1/30 s later -- about a car length at
  // top speed. Anything beyond that would be the physics drifting.
  const frameTravel = (fps: number) => MAX_SPEED / fps
  const cmp = (name: string, a: { x: number; z: number }[], b: { x: number; z: number }[], xTol: number, zTol: number) => {
    let dx = 0
    let dz = 0
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dx = Math.max(dx, Math.abs(a[i].x - b[i].x))
      dz = Math.max(dz, Math.abs(a[i].z - b[i].z))
    }
    assert(a.length >= 15 && b.length >= 15 && dx < xTol && dz < zTol, `${name}: max lateral difference ${dx.toFixed(3)} half-widths, distance ${dz.toFixed(0)} units (${(dz / SEGMENT_LENGTH).toFixed(2)} segments) over 8 s`)
    return { dx, dz }
  }
  const l30 = loop(30)
  const l60 = loop(60)
  const l120 = loop(120)
  cmp('game loop 30 vs 60 FPS', l30, l60, 0.05, frameTravel(30) * 1.1)
  cmp('game loop 120 vs 60 FPS', l120, l60, 0.03, frameTravel(60) * 1.1)
  const r30 = raw(30)
  const r60 = raw(60)
  const r120 = raw(120)
  cmp('physics at 30 Hz vs 60 Hz steps', r30, r60, 0.05, frameTravel(30) * 1.5)
  cmp('physics at 120 Hz vs 60 Hz steps', r120, r60, 0.03, frameTravel(60) * 1.5)
  console.log(`     trajectories (x at t=2,4,6,8 s): 30fps ${[3, 7, 11, 15].map((i) => l30[i]?.x.toFixed(3)).join(' ')} | 60fps ${[3, 7, 11, 15].map((i) => l60[i]?.x.toFixed(3)).join(' ')} | 120fps ${[3, 7, 11, 15].map((i) => l120[i]?.x.toFixed(3)).join(' ')}`)
}

console.log('7. Input and conventions')
{
  // Keyboard taps become ramps: full lock in ~0.1 s, back to centre faster.
  let st = 0
  let tUp = 0
  while (st < 1 && tUp < 1) {
    st = smoothSteer(st, 1, STEP)
    tUp += STEP
  }
  let tDown = 0
  while (st > 0 && tDown < 1) {
    st = smoothSteer(st, 0, STEP)
    tDown += STEP
  }
  assert(tUp > 0.05 && tUp < 0.16, `steering ramps to full lock in ${(tUp * 1000).toFixed(0)} ms (immediate but not a jerk)`)
  assert(tDown < tUp, `and returns to centre faster (${(tDown * 1000).toFixed(0)} ms)`)
  // No dead zone: a small input gives a proportionally small response.
  const small = testRace([{ len: 200, curve: 0, hill: 0 }])
  run(small, 0.6, () => ({ throttle: 1, brake: 0, steer: 0.1, usePower: false }))
  const full = testRace([{ len: 200, curve: 0, hill: 0 }])
  run(full, 0.6, () => ({ throttle: 1, brake: 0, steer: 1, usePower: false }))
  const ratio = small.cars[0].vx / full.cars[0].vx
  assert(ratio > 0.08 && ratio < 0.12, `10% steering gives ${(ratio * 100).toFixed(0)}% of the full response (linear, no dead zone)`)
  // Conventions shared with the renderer.
  assert(bendDrift(MAX_SPEED, 4) < 0 && bendDrift(MAX_SPEED, -4) > 0, 'a right bend (curve > 0) pushes the car left, to its outside')
  const s = testRace([{ len: 200, curve: 4, hill: 0 }])
  const f = new RoadFrame()
  projectRoad(s.road, (segStart(s, 0) + 20) * SEGMENT_LENGTH, 0, 0, rig('chase'), 1000, 600, f)
  const far = f.sx[60]
  assert(far > 520, `...and is DRAWN bending right on screen (road centre 60 segments ahead at x=${far.toFixed(0)} of 1000)`)
  const steerRight = testRace([{ len: 200, curve: 0, hill: 0 }])
  run(steerRight, 0.3, () => ({ throttle: 1, brake: 0, steer: 1, usePower: false }))
  assert(steerRight.cars[0].x > 0 && steerRight.cars[0].yaw > 0, 'steering right moves and points the car right')
  // Braking still works while holding the throttle (children mash both).
  const both = testRace([{ len: 200, curve: 0, hill: 0 }])
  run(both, 0.5, () => ({ throttle: 1, brake: 1, steer: 0, usePower: false }))
  assert(both.cars[0].speed < MAX_SPEED * 0.7, 'brake wins over throttle when both are held')
  const signs = TRACKS.flatMap((t) => buildRoad(t).segments.flatMap((g, i, all) => g.sprites.filter((p) => p.kind === 'chevron' || (p.kind === 'sign' && p.variant < 2)).map((p) => ({ p, curve: all[(i + 12) % all.length].curve, own: g.curve }))))
  assert(signs.length > 20 && signs.every(({ p, curve, own }) => (p.variant === 1) === ((Math.abs(own) >= 3 ? own : curve) > 0)), `bend signs and chevrons point the way the road goes (${signs.length} checked)`)
  assert(signs.every(({ p, curve, own }) => Math.sign(p.offset) === -Math.sign(Math.abs(own) >= 3 ? own : curve)), '...and stand on the outside of the bend')
}

console.log('8. Every bend of every track, at top speed')
for (const t of TRACKS) {
  const r = buildRoad(t)
  let worst = 0
  for (const g of r.segments) worst = Math.max(worst, Math.abs(bendDrift(MAX_SPEED, g.curve)) / steerAuthority(MAX_SPEED))
  assert(worst < 0.7, `${t.id}: the sharpest bend needs ${(worst * 100).toFixed(0)}% lock at top speed (was over 100% before this fix on 4 tracks)`)
}
{
  // A full 3-lap drive on every track by the reactive driver: it stays on
  // the circuit nearly all the time.
  for (const t of TRACKS) {
    const s = createRace({ trackId: t.id, difficulty: 'normal', seed: 5, questions: 0 })
    s.checkpoints = []
    let off = 0
    let steps = 0
    while (!s.cars[0].finished && steps < 60 * 400) {
      const input = s.status === 'racing' ? driver(s, { target: 0 }) : { throttle: 0, brake: 0, steer: 0, usePower: false }
      stepRace(s, input)
      if (s.status === 'racing' && Math.abs(s.cars[0].x) > 1) off++
      steps++
    }
    const secs = s.time
    assert(s.cars[0].finished && off / 60 < 1.5, `${t.id}: 3 laps in ${secs.toFixed(0)} s, ${(off / 60).toFixed(1)} s off the road`)
  }
}
{
  // A driver who only looks at the SCREEN: every frame the road is
  // projected exactly as the renderer draws it (camera yaw included), the
  // driver reacts to what they saw 0.2 s ago and presses digital keys.
  // Before this fix the bends were drawn mirrored, so this driver spent
  // 17-23 s per race off the road and crashed 8-11 times on the four
  // tracks with sharp bends. Drawing and physics must agree.
  const W = 1000
  const H = 600
  for (const t of TRACKS) {
    const s = createRace({ trackId: t.id, difficulty: 'normal', seed: 5, questions: 0 })
    s.checkpoints = []
    const cam = newCamera()
    const f = new RoadFrame()
    const seen: number[] = []
    let off = 0
    let crashes = 0
    let steps = 0
    while (!s.cars[0].finished && steps < 60 * 300) {
      const p = s.cars[0]
      updateCamera(cam, s.road, p.z, p.yaw, p.speed / MAX_SPEED, false, false, STEP)
      const r = rig('chase', cam.fov)
      projectRoad(s.road, p.z, p.x, cameraYaw(cam), r, W, H, f)
      // Where is the road centre drawn, a moment ahead, relative to the car
      // (which is always drawn in the middle), in road half-widths?
      const k = Math.min(f.count - 1, Math.max(1, Math.round((r.offset + Math.max(800, p.speed * 0.35)) / SEGMENT_LENGTH)))
      seen.push((f.sx[k] - W / 2) / Math.max(1, f.sw[k]))
      const err = seen.length > 12 ? seen[seen.length - 12] : 0
      const steer = err > 0.08 ? 1 : err < -0.08 ? -1 : 0
      for (const e of stepRace(s, s.status === 'racing' ? { throttle: 1, brake: 0, steer, usePower: false } : { throttle: 0, brake: 0, steer: 0, usePower: false })) if (e.type === 'crash') crashes++
      if (s.status === 'racing' && Math.abs(p.x) > 1) off++
      steps++
    }
    assert(s.cars[0].finished && off / 60 < 1 && crashes === 0, `${t.id}: driving only by what the screen shows (0.2 s reactions, digital keys): ${(off / 60).toFixed(1)} s off the road, ${crashes} crashes`)
  }
}
console.log(`     HANDLING: ${JSON.stringify(HANDLING)}`)

console.log(`\n${passes} passed, ${failures} failed`)
if (failures) {
  console.error('RACING HANDLING VERIFICATION FAILED')
  process.exit(1)
}
console.log('RACING HANDLING VERIFICATION PASSED')
