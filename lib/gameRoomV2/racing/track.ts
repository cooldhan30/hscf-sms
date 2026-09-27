// Tamil Grand Prix track geometry. A closed Catmull-Rom spline through a
// few control points, resampled at even arc length so "distance along
// the track" is a real, uniform measure. Everything the race needs --
// where a car is along the lap, how far it is from the centreline,
// which surface it is on, where checkpoints and boost pads sit -- is
// derived from this one sampled centreline. Pure; no DOM.

export interface TrackSample {
  x: number
  y: number
  // Unit tangent (direction of travel) and left-hand normal.
  tx: number
  ty: number
  nx: number
  ny: number
  // Distance from the start line along the centreline.
  s: number
}

export interface BoostPad {
  s: number
  // Lateral offset of the pad's centre from the centreline (+ = left).
  offset: number
  halfWidth: number
  length: number
}

export interface Scenery {
  kind: 'tree' | 'stand' | 'pond' | 'flag'
  x: number
  y: number
  r: number
  angle?: number
}

export interface Track {
  id: string
  name: string
  samples: TrackSample[]
  length: number
  // Road half width; beyond it is grass, beyond `barrier` is the wall.
  roadHalf: number
  barrier: number
  // Sector gates (fractions of a lap) a car must pass in order before a
  // lap counts -- the finish-line anti-cheat.
  sectors: number[]
  pads: BoostPad[]
  scenery: Scenery[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

const SAMPLE_STEP = 6

// A flowing circuit with a long main straight, a hairpin, an S-bend and
// a sweeping final corner (world units; roughly 1 unit = 0.25 m).
const CONTROL_POINTS: [number, number][] = [
  [0, 0],
  [700, 0],
  [1300, 20],
  [1650, 180],
  [1720, 520],
  [1520, 760],
  [1180, 720],
  [980, 560],
  [760, 620],
  [640, 900],
  [820, 1180],
  [1260, 1230],
  [1640, 1260],
  [1760, 1560],
  [1480, 1800],
  [900, 1820],
  [340, 1760],
  [-60, 1560],
  [-260, 1180],
  [-300, 700],
  [-240, 280],
]

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

function buildSamples(points: [number, number][]): { samples: TrackSample[]; length: number } {
  // Dense raw polyline first.
  const raw: [number, number][] = []
  const n = points.length
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    for (let k = 0; k < 60; k++) {
      const t = k / 60
      raw.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)])
    }
  }
  // Cumulative length of the raw loop.
  const cum: number[] = [0]
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1]
    const b = raw[i % raw.length]
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const length = cum[cum.length - 1]
  // Even resampling.
  const count = Math.round(length / SAMPLE_STEP)
  const pts: [number, number][] = []
  let j = 0
  for (let k = 0; k < count; k++) {
    const target = (k / count) * length
    while (cum[j + 1] < target) j++
    const f = (target - cum[j]) / (cum[j + 1] - cum[j] || 1)
    const a = raw[j]
    const b = raw[(j + 1) % raw.length]
    pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f])
  }
  const samples: TrackSample[] = pts.map((p, k) => {
    const prev = pts[(k - 1 + count) % count]
    const next = pts[(k + 1) % count]
    let tx = next[0] - prev[0]
    let ty = next[1] - prev[1]
    const l = Math.hypot(tx, ty) || 1
    tx /= l
    ty /= l
    return { x: p[0], y: p[1], tx, ty, nx: ty, ny: -tx, s: (k / count) * length }
  })
  return { samples, length }
}

function buildScenery(samples: TrackSample[], barrier: number): Scenery[] {
  // Deterministic scatter: trees just outside the barrier, stands along
  // the main straight, a pond in the infield.
  const out: Scenery[] = []
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < samples.length; k += 9) {
    const smp = samples[k]
    for (const side of [1, -1]) {
      if (rnd() < 0.55) continue
      const d = barrier + 40 + rnd() * 160
      out.push({ kind: 'tree', x: smp.x + smp.nx * d * side, y: smp.y + smp.ny * d * side, r: 18 + rnd() * 16 })
    }
  }
  // Grandstands along the start straight (right-hand side of travel).
  for (let k = 8; k < 120; k += 22) {
    const smp = samples[k]
    const d = -(barrier + 70)
    out.push({ kind: 'stand', x: smp.x + smp.nx * d, y: smp.y + smp.ny * d, r: 55, angle: Math.atan2(smp.ty, smp.tx) })
  }
  out.push({ kind: 'pond', x: 430, y: 1330, r: 150 })
  out.push({ kind: 'pond', x: 1200, y: 980, r: 90 })
  // Keep scenery off the road itself.
  return out.filter((sc) => {
    for (let k = 0; k < samples.length; k += 3) {
      if (Math.hypot(samples[k].x - sc.x, samples[k].y - sc.y) < barrier + sc.r + 10) return false
    }
    return true
  })
}

let cached: Track | null = null

export function getTrack(): Track {
  if (cached) return cached
  const { samples, length } = buildSamples(CONTROL_POINTS)
  const roadHalf = 78
  const barrier = roadHalf + 95
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of samples) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const pads: BoostPad[] = [0.06, 0.4, 0.7].map((f, i) => ({ s: f * length, offset: i % 2 === 0 ? 34 : -34, halfWidth: 26, length: 70 }))
  cached = {
    id: 'kovil-circuit',
    name: 'Kovil Circuit',
    samples,
    length,
    roadHalf,
    barrier,
    sectors: [0.25, 0.5, 0.75],
    pads,
    scenery: buildScenery(samples, barrier),
    bounds: { minX: minX - barrier - 220, minY: minY - barrier - 220, maxX: maxX + barrier + 220, maxY: maxY + barrier + 220 },
  }
  return cached
}

export function sampleAt(track: Track, s: number): TrackSample {
  const n = track.samples.length
  const idx = ((Math.round((s / track.length) * n) % n) + n) % n
  return track.samples[idx]
}

export interface Projection {
  index: number
  // Distance along the lap, 0..length.
  s: number
  // Signed distance from the centreline (+ = left of travel).
  offset: number
}

// Projects a point onto the centreline. `hint` (the car's last index)
// makes this a small local search; without it, a full scan.
export function project(track: Track, x: number, y: number, hint?: number): Projection {
  const n = track.samples.length
  let best = 0
  let bestD = Infinity
  if (hint === undefined) {
    for (let k = 0; k < n; k++) {
      const p = track.samples[k]
      const d = (p.x - x) ** 2 + (p.y - y) ** 2
      if (d < bestD) {
        bestD = d
        best = k
      }
    }
  } else {
    for (let o = -60; o <= 60; o++) {
      const k = (((hint + o) % n) + n) % n
      const p = track.samples[k]
      const d = (p.x - x) ** 2 + (p.y - y) ** 2
      if (d < bestD) {
        bestD = d
        best = k
      }
    }
  }
  const p = track.samples[best]
  const dx = x - p.x
  const dy = y - p.y
  const along = dx * p.tx + dy * p.ty
  const offset = dx * p.nx + dy * p.ny
  let s = p.s + along
  if (s < 0) s += track.length
  if (s >= track.length) s -= track.length
  return { index: best, s, offset }
}

// Heading change over the next `span` units from s -- a curvature
// measure the AI uses to brake before corners (radians).
export function turnAhead(track: Track, s: number, from: number, span: number): number {
  const a = sampleAt(track, s + from)
  const b = sampleAt(track, s + from + span)
  const ha = Math.atan2(a.ty, a.tx)
  const hb = Math.atan2(b.ty, b.tx)
  let d = hb - ha
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}
