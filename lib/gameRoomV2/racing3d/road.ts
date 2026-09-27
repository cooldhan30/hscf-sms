import { mulberry32 } from '../gameplay/rng'
import { BOX_DEPTH, SCENERY_WIDTH, SOLID_SCENERY, type SceneryKind, type TrackDef } from './tracks'

// Builds the drawable road for one lap of a track: a list of short road
// SEGMENTS, each with its curve, start/end height and the scenery beside
// it. This is the classic pseudo-3D ("segment projection") road model:
// the renderer projects each segment ahead of the camera to a trapezoid,
// shifting it sideways by the accumulated curve and up/down by height.
//
// Pure and deterministic for a given track (scenery placement is seeded
// by the track id), so every student sees the same road.

export const SEGMENT_LENGTH = 200 // world units along the road
export const ROAD_WIDTH = 2000 // world half-width of the road
export const RUMBLE_LENGTH = 3 // segments per rumble-strip colour band
export const LANES = 3

export interface RoadSprite {
  kind: SceneryKind
  // Lateral position in road half-widths (sign = side; >1 is off-road).
  offset: number
  scale: number
  solid: boolean
  // Half-width for collisions, in road half-widths.
  halfWidth: number
  landmark: boolean
  // Art variant (fixed per piece). For direction signs: 0 = bend to the
  // left, 1 = to the right.
  variant: number
  // Solid blocks: depth along the road in segments (0 = flat cut-out).
  depth: number
}

// Guard rail on the outside of sharp bends, in road half-widths from the
// centre. Cars touching it glance off instead of crashing.
export const RAIL_OFFSET = 1.5
export const RAIL_HEIGHT = 260 // world units

export interface Segment {
  index: number
  curve: number
  y1: number // world height at the segment's start
  y2: number // ... and end
  band: 0 | 1 // alternating rumble/lane colour band
  sprites: RoadSprite[]
  // Red/white kerbs in and around bends (plain shoulder on straights).
  kerb: boolean
  // Guard rail side on the outside of a sharp bend (-1 left, 1 right).
  rail: -1 | 0 | 1
}

export interface Road {
  trackId: string
  segments: Segment[]
  lapLength: number // world units per lap
}

const easeIn = (a: number, b: number, t: number) => a + (b - a) * Math.pow(t, 2)
const easeInOut = (a: number, b: number, t: number) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5)

function seedOf(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function buildRoad(track: TrackDef): Road {
  const segments: Segment[] = []
  let y = 0
  const push = (curve: number, dy: number) => {
    const i = segments.length
    segments.push({ index: i, curve, y1: y, y2: y + dy, band: (Math.floor(i / RUMBLE_LENGTH) % 2) as 0 | 1, sprites: [], kerb: false, rail: 0 })
    y += dy
  }
  const addSection = (len: number, curve: number, hill: number) => {
    const enter = Math.max(1, Math.round(len * 0.25))
    const leave = Math.max(1, Math.round(len * 0.25))
    const hold = Math.max(1, len - enter - leave)
    const total = enter + hold + leave
    const startY = y
    const endY = startY + hill * SEGMENT_LENGTH
    for (let n = 0; n < total; n++) {
      const c = n < enter ? easeIn(0, curve, n / enter) : n < enter + hold ? curve : easeInOut(curve, 0, (n - enter - hold) / leave)
      const target = easeInOut(startY, endY, (n + 1) / total)
      push(c, target - y)
    }
  }
  for (const sec of track.sections) addSection(sec.len, sec.curve, sec.hill)
  // Close the lap at the starting height so lap 2 joins lap 1 seamlessly.
  if (Math.abs(y) > 1) addSection(Math.max(40, Math.round(Math.abs(y) / SEGMENT_LENGTH) * 3), 0, -y / SEGMENT_LENGTH)
  // A short straight for the start/finish line.
  addSection(24, 0, 0)

  const n = segments.length
  const rand = mulberry32(seedOf(track.id))
  const at = (f: number) => Math.min(n - 1, Math.max(0, Math.floor(f * n)))
  const wrap = (i: number) => ((i % n) + n) % n

  // Bends: kerbs through every real bend, a guard rail and direction
  // chevrons along the outside of the sharp ones (a few segments either
  // side, so the rail visibly leads into the corner).
  for (let i = 0; i < n; i++) {
    const c = segments[i].curve
    if (Math.abs(c) >= 1.5) for (let k = -4; k <= 4; k++) segments[wrap(i + k)].kerb = true
    if (Math.abs(c) >= 3) {
      const side = (c > 0 ? -1 : 1) as -1 | 1
      for (let k = -8; k <= 8; k++) if (segments[wrap(i + k)].rail === 0) segments[wrap(i + k)].rail = side
    }
  }
  const railSide = (i: number) => segments[wrap(i)].rail

  // Keep the start grid and the first few segments clear.
  const clear = (i: number) => i < 12 || i > n - 6
  // Solid blocks never overlap along the same side of the road.
  const blockedUntil = { [-1]: -1, [1]: -1 } as Record<number, number>

  for (const span of track.scenery) {
    for (let i = at(span.from); i <= at(span.to); i++) {
      if (clear(i)) continue
      for (const side of span.side === 'both' ? [-1, 1] : span.side === 'left' ? [-1] : [1]) {
        if (rand() > span.density) continue
        const kind = span.kinds[Math.floor(rand() * span.kinds.length)]
        const w = SCENERY_WIDTH[kind]
        const far = kind === 'paddy' || kind === 'boat' || kind === 'waveRock'
        const offset = side * (1.25 + w + rand() * (far ? 3 : 1.4))
        const scale = 0.85 + rand() * 0.35
        const variant = Math.floor(rand() * 8)
        const depth = BOX_DEPTH[kind] ?? 0
        // Nothing small squeezed between the road and a guard rail.
        if (railSide(i) === side && Math.abs(offset) < RAIL_OFFSET + 0.25) continue
        if (depth > 0) {
          if (i <= blockedUntil[side]) continue
          blockedUntil[side] = i + depth + 1
        }
        segments[i].sprites.push({ kind, offset, scale, solid: SOLID_SCENERY.has(kind), halfWidth: w, landmark: false, variant: kind === 'sign' ? 2 + (variant % 2) : variant, depth })
      }
    }
    blockedUntil[-1] = -1
    blockedUntil[1] = -1
  }
  for (const l of track.landmarks) {
    const i = at(l.at)
    const scale = l.scale ?? 1
    segments[i].sprites.push({ kind: l.kind, offset: l.side * l.offset, scale, solid: SOLID_SCENERY.has(l.kind), halfWidth: SCENERY_WIDTH[l.kind] * scale, landmark: true, variant: 0, depth: 0 })
  }
  // Warning signs before strong bends, on the outside, arrow pointing the
  // way the road goes; chevrons every few segments through the bend.
  for (let i = 20; i < n - 20; i++) {
    const ahead = segments[i + 12].curve
    if (Math.abs(ahead) >= 3.5 && Math.abs(segments[i].curve) < 0.5 && Math.abs(segments[i - 1].curve) < 0.5 && !segments.slice(i - 30, i).some((s) => s.sprites.some((p) => p.kind === 'sign' && p.variant < 2))) {
      const side = ahead > 0 ? -1 : 1 // on the outside of the bend
      segments[i].sprites.push({ kind: 'sign', offset: side * 1.62, scale: 1, solid: true, halfWidth: SCENERY_WIDTH.sign, landmark: false, variant: ahead > 0 ? 1 : 0, depth: 0 })
    }
  }
  for (let i = 12; i < n - 6; i += 4) {
    const c = segments[i].curve
    if (Math.abs(c) < 3) continue
    const side = c > 0 ? -1 : 1
    segments[i].sprites.push({ kind: 'chevron', offset: side * (RAIL_OFFSET + 0.02), scale: 1, solid: false, halfWidth: SCENERY_WIDTH.chevron, landmark: false, variant: c > 0 ? 1 : 0, depth: 0 })
  }
  // Far pieces first, so a renderer can draw each segment's list in order.
  for (const seg of segments) seg.sprites.sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset))
  return { trackId: track.id, segments, lapLength: n * SEGMENT_LENGTH }
}

export function segmentAt(road: Road, z: number): Segment {
  const n = road.segments.length
  const i = Math.floor((((z % road.lapLength) + road.lapLength) % road.lapLength) / SEGMENT_LENGTH)
  return road.segments[Math.min(n - 1, Math.max(0, i))]
}

// Road height at an exact distance (interpolated inside the segment).
export function heightAt(road: Road, z: number): number {
  const seg = segmentAt(road, z)
  const t = ((((z % road.lapLength) + road.lapLength) % road.lapLength) % SEGMENT_LENGTH) / SEGMENT_LENGTH
  return seg.y1 + (seg.y2 - seg.y1) * t
}

// How much the road bends over the next `segments` (for AI braking).
export function curveAhead(road: Road, z: number, segments: number): number {
  const start = segmentAt(road, z).index
  let worst = 0
  for (let k = 1; k <= segments; k++) {
    const c = road.segments[(start + k) % road.segments.length].curve
    if (Math.abs(c) > Math.abs(worst)) worst = c
  }
  return worst
}

// Length of straight road ahead, in segments (for AI boosts).
export function straightAhead(road: Road, z: number, max: number): number {
  const start = segmentAt(road, z).index
  let k = 0
  while (k < max && Math.abs(road.segments[(start + k + 1) % road.segments.length].curve) < 0.5) k++
  return k
}
