// Tamil Grand Prix scenery stability -- runs the REAL renderer
// (components/gameRoomV2/racing3d/render.ts) headlessly against a
// recording canvas, driving three full laps of every track, and checks
// every building, tree, wall, rail, arch, coin and car it draws:
//   1. nothing pops out of view while it is plainly on screen (the old
//      renderer culled every road segment that rounded to 0 px tall, so
//      far scenery and cars flickered in and out)
//   2. nothing jumps: frame-to-frame motion is smooth (no discontinuity
//      when the camera crosses a segment, a lap, or a bend)
//   3. nothing is drawn twice in a frame; far things are drawn first
//   4. lap 3 looks exactly like lap 1 (no floating-point drift)
//   5. no NaN / runaway sizes, including across a viewport resize
//   6. the same checks at 144 Hz with render interpolation
//
//   npx tsx scripts/verify-gameroom-v2-racing-scenery.ts
import { TRACKS, createRace, stepRace, roadOffsetAhead, STEP, MAX_SPEED, SEGMENT_LENGTH, NEAR, SCENERY_DISTANCE, boosting, type RaceState, type RaceInput } from '../lib/gameRoomV2/racing3d'

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

// ---- a recording 2D canvas for Node ----------------------------------------
function fakeContext(): CanvasRenderingContext2D {
  const grad = { addColorStop() {} }
  const target: Record<string | symbol, unknown> = {
    measureText: (s: string) => ({ width: s.length * 50 }),
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
  }
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k]
      return () => undefined
    },
    set(t, k, v) {
      t[k] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}
;(globalThis as unknown as { document: unknown }).document = {
  createElement: () => {
    const ctx = fakeContext()
    return { width: 0, height: 0, getContext: () => ctx }
  },
}

type Kind = 'sprite' | 'wall' | 'rail' | 'car' | 'coin' | 'arch'
interface Rect {
  kind: Kind
  x: number
  y: number
  w: number
  h: number
  d: number
  order: number
}

function driver(s: RaceState): RaceInput {
  const p = s.cars[0]
  const look = Math.max(SEGMENT_LENGTH * 4, p.speed * 0.35)
  const roadAhead = roadOffsetAhead(s.road, p.z, look) / 2000
  const carAhead = p.x + p.vx * (look / Math.max(p.speed, 1))
  // Weave across the lanes now and then, like a player overtaking.
  const target = Math.sin(s.time * 0.7) * 0.45
  return { throttle: 1, brake: 0, steer: Math.max(-1, Math.min(1, (target + roadAhead - carAhead) * 2.2)), usePower: s.time > 20 && s.slots.length > 0 }
}

async function main() {
  const { createRenderer } = await import('../components/gameRoomV2/racing3d/render')
  const W = 1366
  const H = 768
  const g = fakeContext()

  interface Drive {
    frames: number
    items: number
    pops: number
    popExamples: string[]
    jumps: number
    jumpExamples: string[]
    dupes: number
    order: number
    bad: number
    maxJerk: number
    worst: string
  }

  function drive(trackId: string, hz: number, fault = false): Drive {
    const s = createRace({ trackId, difficulty: 'normal', seed: 3, questions: 6 })
    const r = createRenderer(s.track, s.cars.map((c) => c.color))
    const out: Drive = { frames: 0, items: 0, pops: 0, popExamples: [], jumps: 0, jumpExamples: [], dupes: 0, order: 0, bad: 0, maxJerk: 0, worst: '' }
    const recent: string[] = []
    let prev = new Map<string, Rect>()
    let prev2 = new Map<string, Rect>()
    let cur = new Map<string, Rect>()
    let order = 0
    let lastD = Infinity
    let lastKind: Kind = 'sprite'
    let dropped = false
    const trace = (kind: Kind, id: number, x: number, y: number, w: number, h: number, d: number) => {
      // Detector self-test: lose one building for a frame, and shift the
      // scene 25 px for one frame -- both must be caught.
      if (fault && out.frames === 700 && !dropped && kind === 'sprite' && h > 20 && d > 8000 && d < 30000 && x > 200 && x < W - 200) {
        dropped = true
        return
      }
      if (fault && out.frames === 900) x += 25
      const key = `${kind}:${id}`
      if (![x, y, w, h, d].every(Number.isFinite) || w > W * 60 || h > H * 60) out.bad++
      if (cur.has(key) && kind !== 'car') out.dupes++
      // Far to near (a step draws its far-end scenery, then the walls and
      // rails of the segment in front of it: allow one segment of overlap).
      if (d > lastD + SEGMENT_LENGTH * 1.01 && !(kind === 'car' || lastKind === 'car')) out.order++
      lastD = d
      lastKind = kind
      cur.set(key, { kind, x, y, w, h, d, order: order++ })
    }
    let acc = 0
    let t = 0
    let frozen = 0
    const frameDt = 1 / hz
    const maxFrames = hz * 60 * 6
    while (!s.cars[0].finished && out.frames < maxFrames) {
      acc += frameDt
      let events = ''
      while (acc >= STEP - 1e-9) {
        const wasRacing = s.status === 'racing'
        for (const e of stepRace(s, driver(s))) {
          if (e.type === 'checkpoint') s.status = 'resume'
          events += e.type + ' '
        }
        if (s.status === 'resume' && s.resumeT <= 0) s.resumeT = 0.01
        // A question freeze and a collision (bump, crash, rail) are sudden
        // changes of motion on purpose; the jump check skips just those frames.
        if (!wasRacing || s.status !== 'racing' || /bump|crash|rail|shieldHit/.test(events)) frozen = Math.ceil((3 * hz) / 60) + 1
        acc -= STEP
      }
      recent.push(events.trim() || '-')
      if (recent.length > 4) recent.shift()
      t += frameDt
      const alpha = Math.min(1, acc / STEP)
      const lerp = (a: number, b: number) => a + (b - a) * alpha
      const cars = s.cars.map((c) => ({ id: c.id, z: lerp(c.pz, c.z), x: lerp(c.px, c.x), yaw: lerp(c.pyaw, c.yaw), color: c.color, isPlayer: c.isPlayer, boosting: boosting(c), shielded: false, label: c.isPlayer ? undefined : c.tamilName }))
      cur = new Map()
      order = 0
      lastD = Infinity
      r.draw(g, W, H, {
        track: s.track, road: s.road, camZ: cars[0].z, camX: cars[0].x, yaw: cars[0].yaw, speedPct: s.cars[0].speed / MAX_SPEED, steer: s.cars[0].steer,
        cars, coins: s.coins, isCoinTaken: (lap, i) => s.taken.has(lap * 10000 + i), checkpoints: s.checkpoints.slice(s.nextCheckpoint), camera: 'chase', time: t,
        boost: boosting(s.cars[0]), shield: false, offroad: false, crash: 0, magnet: false, reduced: false, finishDistance: s.raceLength, trace,
      })
      out.frames++
      out.items += cur.size
      // (1) pops: plainly visible last frame, gone now.
      const moved = s.cars[0].speed * frameDt
      for (const [key, a] of Array.from(prev)) {
        if (cur.has(key) || a.kind === 'coin' || a.kind === 'car' || a.h === 0) continue
        // Plainly on screen: inside the edges by more than it moves per frame.
        const before = prev2.get(key)
        const margin = 6 + (before ? 2 * Math.abs(a.x - before.x) + Math.abs(a.w - before.w) : a.w * 0.5)
        const onScreen = a.x > margin && a.x + a.w < W - margin && a.y + a.h > margin && a.w > 1.5 && a.h > 1.5
        const nearCamera = a.d < NEAR + moved * 3 + SEGMENT_LENGTH * 2
        const atHorizon = a.d > (SCENERY_DISTANCE - 3) * SEGMENT_LENGTH
        if (onScreen && !nearCamera && !atHorizon) {
          out.pops++
          if (out.popExamples.length < 5) out.popExamples.push(`${key} at d=${a.d.toFixed(0)} rect ${a.x.toFixed(0)},${a.y.toFixed(0)} ${a.w.toFixed(1)}x${a.h.toFixed(1)}`)
        }
      }
      // (2) jumps: position acceleration out of proportion to its size.
      if (frozen) frozen--
      else for (const [key, c] of Array.from(cur)) {
        const b = prev.get(key)
        const a = prev2.get(key)
        if (!a || !b || c.kind === 'coin' || !a.h || !b.h || !c.h) continue
        if (c.d < NEAR + SEGMENT_LENGTH * 3 || c.w < 2) continue
        const jerkX = Math.abs(c.x - 2 * b.x + a.x)
        const jerkY = Math.abs(c.y + c.h - 2 * (b.y + b.h) + (a.y + a.h))
        const jerkW = Math.abs(Math.log(c.w / b.w) - Math.log(b.w / a.w))
        // A glitch is a sudden change of motion that is big both for the
        // object and on screen (> 6 px); a gentle collision jolt is not.
        const size = Math.max(c.w, 12)
        // (Scale is only meaningful for cut-outs; a wall seen edge-on changes
        // its apparent width with every turn of the camera.)
        const card = c.kind === 'sprite' || c.kind === 'car'
        const j = Math.max(jerkX > 6 ? jerkX / size : 0, jerkY > 6 ? jerkY / Math.max(c.h, 12) : 0, card ? jerkW * 4 : 0)
        if (j > out.maxJerk) {
          out.maxJerk = j
          out.worst = `${key} frame ${out.frames} t=${s.time.toFixed(2)} d=${c.d.toFixed(0)} dx ${(c.x - b.x).toFixed(1)} vs ${(b.x - a.x).toFixed(1)} w ${c.w.toFixed(1)} h ${c.h.toFixed(1)} events [${events.trim()}] recent [${recent.join(' ')}]`
        }
        if (j > 0.25) {
          out.jumps++
          if (out.jumpExamples.length < 5) out.jumpExamples.push(`${key} frame ${out.frames} t=${s.time.toFixed(2)} ${s.status} d=${c.d.toFixed(0)} dx ${(c.x - b.x).toFixed(1)} vs ${(b.x - a.x).toFixed(1)}, w ${c.w.toFixed(1)}`)
        }
      }
      prev2 = prev
      prev = cur
    }
    const laps = Math.floor(s.cars[0].z / s.road.lapLength)
    assert(laps >= 3, `${trackId} @${hz} Hz: drove ${laps} laps (${out.frames} frames, ~${Math.round(out.items / out.frames)} objects drawn per frame)`)
    return out
  }

  console.log('1-3, 5. Three laps of every track at 60 Hz, 1366x768')
  for (const t of TRACKS) {
    const d = drive(t.id, 60)
    assert(d.pops === 0, `${t.id}: nothing pops out of view (${d.pops})${d.popExamples.length ? ' e.g. ' + d.popExamples.join(' | ') : ''}`)
    assert(d.jumps === 0, `${t.id}: no jumps or scale glitches (max jerk ${d.maxJerk.toFixed(3)} of 0.25)${d.jumps ? ' worst: ' + d.worst : ''}`)
    assert(d.dupes === 0 && d.order === 0, `${t.id}: nothing drawn twice (${d.dupes}); far to near order kept (${d.order} violations)`)
    assert(d.bad === 0, `${t.id}: every rectangle finite and sane (${d.bad})`)
  }

  console.log('   (detector self-test: an injected pop and an injected jump are caught)')
  {
    const d = drive('chennai-city', 60, true)
    assert(d.pops >= 1 && d.jumps >= 1, `injected faults detected: ${d.pops} pop(s), ${d.jumps} jump(s)`)
  }

  console.log('6. With render interpolation at 144 Hz')
  for (const id of ['temple-hill', 'forest-road']) {
    const d = drive(id, 144)
    assert(d.pops === 0 && d.jumps === 0 && d.dupes === 0 && d.bad === 0, `${id} @144 Hz: no pops (${d.pops}), jumps (${d.jumps}, max jerk ${d.maxJerk.toFixed(3)}), duplicates (${d.dupes}) or bad rects (${d.bad})${d.jumps ? ' worst: ' + d.worst : ''}`)
  }

  console.log('4. Lap 3 draws exactly like lap 1')
  for (const t of TRACKS) {
    const s = createRace({ trackId: t.id, difficulty: 'normal', seed: 3, questions: 0 })
    const L = s.road.lapLength
    let worst = 0
    let count = 0
    for (const frac of [0.13, 0.37, 0.61, 0.88]) {
      const snap = (lap: number) => {
        const r = createRenderer(s.track, [s.cars[0].color])
        const m = new Map<string, Rect>()
        const z = frac * L + lap * L
        const view = {
          track: s.track, road: s.road, camZ: z, camX: 0.2, yaw: 0.05, speedPct: 1, steer: 0.3, cars: [{ id: 'p', z, x: 0.2, color: s.cars[0].color, isPlayer: true, boosting: false, shielded: false }],
          coins: [], isCoinTaken: () => true, checkpoints: [], camera: 'chase' as const, time: 1, boost: false, shield: false, offroad: false, crash: 0, magnet: false, reduced: false, finishDistance: 3 * L,
          trace: (kind: Kind, id: number, x: number, y: number, w: number, h: number, d: number) => {
            // Same piece, whichever lap: strip the lap from the id.
            const segs = s.road.segments.length
            const local = kind === 'sprite' ? (Math.floor(id / 16) % segs) * 16 + (id % 16) : kind === 'wall' ? (Math.floor(id / 32) % segs) * 32 + (id % 32) : kind === 'rail' ? id % segs : id
            m.set(`${kind}:${local}`, { kind, x, y, w, h, d, order: 0 })
          },
        }
        r.draw(g, W, H, view)
        r.draw(g, W, H, { ...view, time: 1 + 1 / 60 })
        return m
      }
      const a = snap(0)
      const b = snap(2)
      for (const [k, ra] of Array.from(a)) {
        const rb = b.get(k)
        if (!rb) {
          worst = Infinity
          continue
        }
        worst = Math.max(worst, Math.abs(ra.x - rb.x), Math.abs(ra.y - rb.y), Math.abs(ra.w - rb.w), Math.abs(ra.h - rb.h))
        count++
      }
      if (b.size !== a.size) worst = Infinity
    }
    assert(count > 200 && worst < 1e-6, `${t.id}: ${count} objects compared, largest lap 1 vs lap 3 difference ${worst === Infinity ? 'MISSING' : worst.toExponential(1)} px`)
  }

  console.log('5b. Resize mid-race')
  {
    const s = createRace({ trackId: 'chennai-city', difficulty: 'normal', seed: 3, questions: 0 })
    const r = createRenderer(s.track, s.cars.map((c) => c.color))
    let bad = 0
    let seen = 0
    for (const [w, h] of [[1366, 768], [390, 844], [1920, 1080], [844, 390], [1366, 768]]) {
      r.draw(g, w, h, {
        track: s.track, road: s.road, camZ: 90000, camX: 0, speedPct: 1, steer: 0, cars: [], coins: [], isCoinTaken: () => true, checkpoints: [], camera: 'chase', time: seen,
        boost: false, shield: false, offroad: false, crash: 0, magnet: false, reduced: false, finishDistance: 1e9,
        trace: (_k: Kind, _id: number, x: number, y: number, ww: number, hh: number) => {
          seen++
          if (![x, y, ww, hh].every(Number.isFinite) || ww > w * 60) bad++
        },
      })
    }
    assert(seen > 500 && bad === 0, `phone portrait / landscape / 1080p / back: ${seen} objects, ${bad} bad`)
  }

  console.log(`\n${passes} passed, ${failures} failed`)
  if (failures) {
    console.error('RACING SCENERY VERIFICATION FAILED')
    process.exit(1)
  }
  console.log('RACING SCENERY VERIFICATION PASSED')
}

main()
