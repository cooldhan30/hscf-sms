import {
  ROAD_WIDTH,
  SEGMENT_LENGTH,
  LANES,
  RAIL_OFFSET,
  RAIL_HEIGHT,
  DRAW_DISTANCE,
  SCENERY_DISTANCE,
  SCENERY_FADE_FROM,
  NEAR,
  RoadFrame,
  cameraYaw,
  newCamera,
  projectRoad,
  rig,
  updateCamera,
  placeAt,
  type CameraMode,
  type Placed,
  type Road,
  type RoadSprite,
  type TrackDef,
  type Coin,
} from '@/lib/gameRoomV2/racing3d'
import { buildAtlas, buildCar, buildCoin, mixHex, variantsOf, CAR_POSES, type CarArt, type SpriteArt } from './sprites'

// Tamil Grand Prix pseudo-3D renderer (canvas 2D, no dependencies).
//
// The road ahead is projected by lib/gameRoomV2/racing3d/view.ts (shared
// with the headless stability tests) and drawn in two passes:
//   1. the road, far to near (painter's order), each strip one segment --
//      or, far away, several segments merged until the strip is at least
//      a pixel tall, in their averaged colours (no shimmer, no gaps);
//   2. everything standing on it, far to near: scenery cut-outs, the
//      road-facing walls of buildings, guard rails, arches, coins, cars --
//      each clipped at the crest of any hill in front of it.
// Nothing is culled because it is small: a building 150 segments away is
// drawn every frame, so it can never flicker in and out.
//
// Everything expensive (scenery, cars, horizon) is drawn ONCE into
// offscreen canvases; each frame only blits and fills, into preallocated
// buffers (no per-frame garbage).

export type { CameraMode }

export interface RenderCar {
  id: string
  z: number
  x: number
  color: string
  isPlayer: boolean
  boosting: boolean
  shielded: boolean
  label?: string
  // Heading relative to the road (rad); cars show their flank when turning.
  yaw?: number
}

// Optional trace of everything drawn (headless stability tests only).
export type TraceFn = (kind: 'sprite' | 'wall' | 'rail' | 'car' | 'coin' | 'arch', id: number, x: number, y: number, w: number, h: number, dist: number) => void

export interface RenderView {
  track: TrackDef
  road: Road
  camZ: number // player distance
  camX: number // player lateral position (road half-widths)
  speedPct: number // 0..1.3
  steer: number // -1..1 (smoothed) for the car's pose / wheel
  yaw?: number // player heading relative to the road (rad)
  braking?: boolean
  cars: RenderCar[]
  coins: Coin[]
  isCoinTaken: (lap: number, index: number) => boolean
  checkpoints: number[] // absolute distances of UPCOMING checkpoints
  camera: CameraMode
  time: number // seconds (real time; drives camera smoothing)
  boost: boolean
  shield: boolean
  offroad: boolean
  crash: number // 0..1 shake strength
  magnet: boolean
  reduced: boolean
  finishDistance: number // absolute distance of the finish line
  trace?: TraceFn
}

export interface RenderStats {
  strips: number
  items: number
}

export interface Renderer {
  draw(g: CanvasRenderingContext2D, w: number, h: number, v: RenderView): void
  stats(): RenderStats
  dispose(): void
}

// Car width in world units (road half-width is 2000).
const CAR_W = 960
const FOG_STEPS = 16
const MAX_FOG = 0.82

// Horizon silhouettes for the track, drawn once and scrolled with the bends.
function buildHorizon(track: TrackDef): HTMLCanvasElement {
  const W = 2048
  const H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d') as CanvasRenderingContext2D
  const [far, near] = track.theme.horizonColor
  const rnd = (i: number) => {
    const x = Math.sin(i * 127.1 + track.id.length * 11.3) * 43758.5453
    return x - Math.floor(x)
  }
  // Periodic in x so the tiled strip has no seam.
  const ridge = (color: string, base: number, amp: number, freq: number, seed: number) => {
    g.fillStyle = color
    g.beginPath()
    g.moveTo(0, H)
    for (let x = 0; x <= W; x += 8) {
      const t = (x / W) * Math.PI * 2
      const y = base - amp * (0.5 + 0.3 * Math.sin(t * freq + seed) + 0.2 * Math.sin(t * freq * 3 + seed * 2))
      g.lineTo(x, y)
    }
    g.lineTo(W, H)
    g.fill()
  }
  const skyline = (color: string, base: number, maxH: number, lights: boolean) => {
    let x = 0
    let i = 0
    while (x < W) {
      const bw = Math.min(W - x, 30 + rnd(i) * 70)
      const bh = maxH * (0.3 + rnd(i + 99) * 0.7)
      g.fillStyle = color
      g.fillRect(x, base - bh, bw, H - base + bh)
      if (lights) {
        g.fillStyle = 'rgba(253,224,71,0.8)'
        for (let wy = base - bh + 6; wy < base - 4; wy += 9) for (let wx = x + 4; wx < x + bw - 4; wx += 8) if (rnd(wx * wy) > 0.62) g.fillRect(wx, wy, 3, 4)
      }
      if (i % 11 === 5) {
        g.fillStyle = color
        for (let t = 0; t < 5; t++) g.fillRect(x + bw / 2 - 20 + t * 4, base - bh - (t + 1) * 12, 40 - t * 8, 12)
      }
      x += bw + 4
      i++
    }
  }
  switch (track.theme.horizon) {
    case 'mountains':
      ridge(far, H * 0.55, H * 0.5, 3, 1)
      ridge(near, H * 0.85, H * 0.45, 5, 4)
      break
    case 'city':
      ridge(far, H * 0.9, H * 0.2, 2, 2)
      skyline(near, H * 0.95, H * 0.55, false)
      break
    case 'nightCity':
      skyline(far, H * 0.8, H * 0.6, true)
      skyline(near, H * 0.98, H * 0.45, true)
      break
    case 'sea':
      ridge(far, H * 0.9, H * 0.15, 2, 3)
      break
    case 'forest':
      ridge(far, H * 0.6, H * 0.4, 4, 2)
      g.fillStyle = near
      for (let x = 0; x < W; x += 18) {
        const th = 40 + rnd(x) * 70
        g.beginPath()
        g.arc(x, H - th * 0.6, 20 + rnd(x + 1) * 14, 0, Math.PI * 2)
        g.fill()
        g.fillRect(x - 12, H - th * 0.6, 24, th)
      }
      break
    case 'fields':
      ridge(far, H * 0.75, H * 0.3, 2, 1)
      ridge(near, H * 0.95, H * 0.2, 3, 5)
      g.fillStyle = near
      for (let x = 30; x < W - 20; x += 90 + rnd(x) * 120) {
        const hgt = 50 + rnd(x + 3) * 40
        g.fillRect(x, H * 0.95 - hgt, 4, hgt)
        g.beginPath()
        g.arc(x + 2, H * 0.95 - hgt, 16, 0, Math.PI * 2)
        g.fill()
      }
      break
  }
  return c
}

// Label widths are measured once (at 100px) and scaled.
const LABEL_W = new Map<string, number>()
function labelWidth(g: CanvasRenderingContext2D, text: string): number {
  let w = LABEL_W.get(text)
  if (w === undefined) {
    g.font = '800 100px "Noto Sans Tamil", sans-serif'
    w = g.measureText(text).width
    if (LABEL_W.size > 200) LABEL_W.clear()
    LABEL_W.set(text, w)
  }
  return w
}

/**
 * Adaptive render resolution. Almost all of a frame's cost is rasterising
 * the canvas, so on a slow device we draw fewer pixels instead of dropping
 * frames: when frames run long the backing store shrinks (down to 55% of
 * CSS size); when there is headroom it grows back towards the device pixel
 * ratio. Hysteresis keeps it from flickering between sizes, and it only
 * judges frames that actually ran (a hidden tab or a pause is ignored).
 */
export function createResolutionGovernor() {
  let scale = 1
  let ema = 16.7
  let slow = 0
  let fast = 0
  return {
    /** Call once per frame with that frame's duration; returns the pixel ratio to draw at. */
    ratio(frameMs: number): number {
      const max = Math.min(2, window.devicePixelRatio || 1)
      if (frameMs > 250) return Math.max(0.5, max * scale)
      ema += (Math.min(100, frameMs) - ema) * 0.08
      if (ema > 21) { slow++; fast = 0 } else if (ema < 17.5) { fast++; slow = 0 } else { slow = 0; fast = 0 }
      if (slow > 45 && scale > 0.55) { scale = Math.max(0.55, scale * 0.85); slow = 0; ema = 16.7 }
      if (fast > 240 && scale < 1) { scale = Math.min(1, scale / 0.9); fast = 0 }
      return Math.max(0.5, max * scale)
    },
  }
}

// ---------------------------------------------------------------------------

type StaticItem =
  | { t: 'sprite'; sp: RoadSprite; art: SpriteArt; id: number; abs: number }
  | { t: 'wall'; side: number; offset: number; height: number; art: SpriteArt; first: boolean; abs: number; seg: number }
  | { t: 'rail'; side: number; abs: number; post: boolean }

const NONE: StaticItem[] = []

interface Dyn {
  d: number
  kind: 0 | 1 | 2 | 3 // 0 car, 1 coin, 2 checkpoint arch, 3 finish arch
  index: number
}

export function createRenderer(track: TrackDef, carColors: string[]): Renderer {
  const t = track.theme
  const atlas = buildAtlas(t)
  const cars = new Map<string, CarArt>()
  carColors.forEach((col, i) => cars.set(col, buildCar(col, `த ${i + 1}`)))
  const coin = buildCoin()
  const horizon = buildHorizon(track)
  const cam = newCamera()
  const frame = new RoadFrame()
  const placed: Placed = { x: 0, y: 0, scale: 0, cz: 0 }
  const minSy = new Float64Array(DRAW_DISTANCE + 1)
  const dyn: Dyn[] = Array.from({ length: 64 }, () => ({ d: 0, kind: 0, index: 0 }))
  let dynCount = 0
  let lastTime: number | null = null
  let camX = 0 // the player's lateral position this frame (road half-widths)
  const lastStats: RenderStats = { strips: 0, items: 0 }
  const stars = Array.from({ length: 80 }, (_, i) => ({ x: Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1, y: Math.abs(Math.sin(i * 78.233) * 12345.6789) % 1 }))
  const speedLines = Array.from({ length: 28 }, (_, i) => ({ a: (i / 28) * Math.PI * 2 + (i % 3) * 0.1, r: 0.3 + ((i * 37) % 50) / 100 }))

  // Colour ramps: each road colour pre-mixed with the fog at FOG_STEPS
  // levels, plus band-averaged versions for strips too thin to show bands.
  const ramp = (c: string) => Array.from({ length: FOG_STEPS }, (_, i) => mixHex(c, t.fog, (i / (FOG_STEPS - 1)) * MAX_FOG))
  const avg = (a: string, b: string) => mixHex(a, b, 0.5)
  const shoulderBase = mixHex(t.road[0], t.night ? '#64748b' : '#e7e5e4', 0.55)
  const C = {
    grass: [ramp(t.grass[0]), ramp(t.grass[1]), ramp(avg(t.grass[0], t.grass[1]))],
    road: [ramp(t.road[0]), ramp(t.road[1]), ramp(avg(t.road[0], t.road[1]))],
    kerb: [ramp(t.rumble[0]), ramp(t.rumble[1]), ramp(avg(t.rumble[0], t.rumble[1]))],
    shoulder: [ramp(shoulderBase), ramp(mixHex(shoulderBase, '#000000', 0.08)), ramp(mixHex(shoulderBase, '#000000', 0.04))],
    edge: ramp(t.night ? '#e2e8f0' : '#f8fafc'),
    lane: ramp(t.lane),
    joint: ramp(mixHex(t.road[0], '#000000', 0.18)),
    sea: ramp(t.seaColor ?? '#0ea5e9'),
    rail: ramp(t.night ? '#94a3b8' : '#e5e7eb'),
    railBand: ramp(t.night ? '#22d3ee' : '#dc2626'),
    post: ramp(t.night ? '#334155' : '#6b7280'),
  }
  const fogIndex = (k: number) => Math.min(FOG_STEPS - 1, Math.round((Math.min(MAX_FOG, Math.pow(k / DRAW_DISTANCE, 1.8) * 1.1) / MAX_FOG) * (FOG_STEPS - 1)))

  // Static items per road segment j, in drawing order (far pieces first):
  // the scenery standing at the FAR end of segment j (point j+1) and the
  // walls / rails running along segment j, merged by distance from the
  // road so a lamp in front of a building's wall is drawn after it.
  let itemsFor: StaticItem[][] = []
  let itemsRoad: Road | null = null
  const buildItems = (road: Road) => {
    const n = road.segments.length
    const lists: StaticItem[][] = Array.from({ length: n }, () => [])
    const artOf = (sp: RoadSprite) => atlas.get(`${sp.kind}:${sp.variant % variantsOf(sp.kind)}`) ?? atlas.get(`${sp.kind}:0`)
    for (let j = 0; j < n; j++) {
      const far = road.segments[(j + 1) % n]
      for (let i = 0; i < far.sprites.length; i++) {
        const sp = far.sprites[i]
        const art = artOf(sp)
        if (art) lists[j].push({ t: 'sprite', sp, art, id: ((j + 1) % n) * 16 + i, abs: Math.abs(sp.offset) })
      }
      const seg = road.segments[j]
      for (const sp of seg.sprites) {
        if (!sp.depth) continue
        const art = artOf(sp)
        if (!art?.wall) continue
        for (let q = 0; q < sp.depth; q++) {
          const into = (j + q) % n
          lists[into].push({ t: 'wall', side: Math.sign(sp.offset), offset: sp.offset, height: art.worldH * sp.scale * art.wall.height, art, first: q === 0, abs: Math.abs(sp.offset), seg: q })
        }
      }
      if (seg.rail) lists[j].push({ t: 'rail', side: seg.rail, abs: RAIL_OFFSET, post: j % 2 === 0 })
    }
    for (const l of lists) l.sort((a, b) => b.abs - a.abs)
    itemsFor = lists
    itemsRoad = road
  }

  // Sky gradient cached per height; sun pre-rendered.
  let skyGrad: CanvasGradient | null = null
  let skyGradH = -1
  const sun = (() => {
    if (!t.sun) return null
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    const g = c.getContext('2d') as CanvasRenderingContext2D
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grd.addColorStop(0, t.sun.color)
    grd.addColorStop(0.2, t.sun.color)
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 256)
    return c
  })()
  let vignette: CanvasGradient | null = null
  let vignetteKey = ''

  function drawSky(g: CanvasRenderingContext2D, w: number, h: number, horizonY: number, yaw: number) {
    if (!skyGrad || skyGradH !== horizonY) {
      skyGrad = g.createLinearGradient(0, 0, 0, horizonY)
      skyGrad.addColorStop(0, t.sky[0])
      skyGrad.addColorStop(1, t.sky[1])
      skyGradH = horizonY
    }
    g.fillStyle = skyGrad
    g.fillRect(0, 0, w, horizonY + 2)
    // Everything on the sky is infinitely far: it turns with the road's
    // total bend plus the camera's yaw, never with the car's lateral move.
    const turn = (cam.heading + yaw) * frame.depth * (w / 2)
    if (t.stars) {
      g.fillStyle = 'rgba(255,255,255,0.8)'
      for (const s of stars) g.fillRect((((s.x * w * 1.5 - turn * 0.9) % (w * 1.5)) + w * 1.5) % (w * 1.5) - w * 0.25, s.y * horizonY * 0.8, 2, 2)
    }
    if (sun && t.sun) {
      const span = w * 3
      const sx = (((w * 0.7 - turn) % span) + span) % span - w
      const sy = horizonY * t.sun.y
      const r = h * 0.25
      g.drawImage(sun, sx - r, sy - r, r * 2, r * 2)
    }
    if (t.moon) {
      const span = w * 3
      const mx = (((w * 0.25 - turn) % span) + span) % span - w
      g.fillStyle = '#fef9c3'
      g.beginPath()
      g.arc(mx, horizonY * 0.25, h * 0.045, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = t.sky[0]
      g.beginPath()
      g.arc(mx + h * 0.018, horizonY * 0.23, h * 0.04, 0, Math.PI * 2)
      g.fill()
    }
    const hh = Math.max(40, h * 0.22)
    const hw = (horizon.width / horizon.height) * hh
    let x0 = -((((turn * 0.9) % hw) + hw) % hw)
    for (; x0 < w; x0 += hw) g.drawImage(horizon, x0, horizonY - hh + 2, hw + 1, hh)
    if (t.seaSide) {
      g.fillStyle = t.seaColor ?? '#0ea5e9'
      g.fillRect(t.seaSide > 0 ? w * 0.45 : 0, horizonY - 3, w * 0.55, 6)
    }
  }

  function quad(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: string) {
    g.fillStyle = color
    g.beginPath()
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.lineTo(x3, y3)
    g.lineTo(x4, y4)
    g.closePath()
    g.fill()
  }

  // ------------------------------------------------------------ pass 1: road
  function drawRoad(g: CanvasRenderingContext2D, w: number, road: Road): number {
    const f = frame
    const S = road.segments
    let strips = 0
    let far = f.count - 1
    for (let k = f.count - 2; k >= 0; k--) {
      if (f.cz[k] <= NEAR) break
      const yN = f.sy[k]
      const yF = f.sy[far]
      if (yF >= yN) {
        // Facing away (the far side of a crest): hidden behind nearer road.
        far = k
        continue
      }
      const merged = far - k > 1
      if (yN - yF < 1 && k > 0 && f.cz[k - 1] > NEAR) continue
      const seg = S[f.seg[k]]
      const fi = fogIndex(k)
      const band = merged ? 2 : seg.band
      const xN = f.sx[k]
      const wN = f.sw[k]
      const xF = f.sx[far]
      const wF = f.sw[far]
      // Grass (and sea beyond the verge on the coast).
      g.fillStyle = C.grass[band][fi]
      g.fillRect(0, yF, w, yN - yF + 0.6)
      if (t.seaSide) {
        const sN = xN + t.seaSide * wN * 2.6
        const sF = xF + t.seaSide * wF * 2.6
        if (t.seaSide > 0) quad(g, sN, yN, w, yN, w, yF, sF, yF, C.sea[fi])
        else quad(g, 0, yN, sN, yN, sF, yF, 0, yF, C.sea[fi])
      }
      // Kerbs in bends, a pale shoulder on straights.
      const rN = wN / 6
      const rF = wF / 6
      const edge = seg.kerb ? C.kerb[band][fi] : C.shoulder[band][fi]
      quad(g, xN - wN - rN, yN, xN - wN, yN, xF - wF, yF, xF - wF - rF, yF, edge)
      quad(g, xN + wN + rN, yN, xN + wN, yN, xF + wF, yF, xF + wF + rF, yF, edge)
      const isFinish = !merged && seg.index < 2
      quad(g, xN - wN, yN, xN + wN, yN, xF + wF, yF, xF - wF, yF, isFinish ? (seg.band ? '#f8fafc' : '#111827') : C.road[band][fi])
      const tall = yN - yF >= 1.5
      if (isFinish) {
        const cells = 8
        for (let c = 0; c < cells; c++) {
          if ((c + seg.index) % 2) continue
          const a = c / cells
          const b = (c + 1) / cells
          quad(g, xN - wN + 2 * wN * a, yN, xN - wN + 2 * wN * b, yN, xF - wF + 2 * wF * b, yF, xF - wF + 2 * wF * a, yF, seg.band ? '#111827' : '#f8fafc')
        }
      } else if (tall) {
        // Solid white edge lines, dashed lane lines, the odd tar joint.
        const eN = Math.max(0.6, wN / 38)
        const eF = Math.max(0.4, wF / 38)
        const ec = C.edge[fi]
        quad(g, xN - wN + eN * 0.4, yN, xN - wN + eN * 1.4, yN, xF - wF + eF * 1.4, yF, xF - wF + eF * 0.4, yF, ec)
        quad(g, xN + wN - eN * 1.4, yN, xN + wN - eN * 0.4, yN, xF + wF - eF * 0.4, yF, xF + wF - eF * 1.4, yF, ec)
        if (seg.band) {
          const lN = wN / 44
          const lF = wF / 44
          for (let lane = 1; lane < LANES; lane++) {
            const lxN = xN - wN + ((wN * 2) / LANES) * lane
            const lxF = xF - wF + ((wF * 2) / LANES) * lane
            quad(g, lxN - lN, yN, lxN + lN, yN, lxF + lF, yF, lxF - lF, yF, C.lane[fi])
          }
        }
        if (seg.index % 12 === 0 && yN - yF > 3) quad(g, xN - wN, yN, xN + wN, yN, xN + wN, yN - Math.max(1, (yN - yF) * 0.12), xN - wN, yN - Math.max(1, (yN - yF) * 0.12), C.joint[fi])
      }
      if (t.night && tall) {
        g.fillStyle = 'rgba(34,211,238,0.3)'
        g.fillRect(xN - wN - rN * 2, yF, rN, yN - yF)
        g.fillStyle = 'rgba(244,114,182,0.3)'
        g.fillRect(xN + wN + rN, yF, rN, yN - yF)
      }
      strips++
      far = k
    }
    return strips
  }

  // ----------------------------------------------------------- pass 2 helpers
  function blit(g: CanvasRenderingContext2D, w: number, art: SpriteArt, scale: number, destX: number, destY: number, alignX: number, clipY: number, sizeMul: number, alpha: number, trace: TraceFn | undefined, id: number, dist: number): boolean {
    const dw = art.worldW * scale * (w / 2) * sizeMul
    const dh = art.worldH * scale * (w / 2) * sizeMul
    const x = destX + dw * alignX
    const y = destY - dh
    if (dw < 1 || x > w || x + dw < 0 || !(dw < w * 40)) return false
    // Specks fade in with their size as well as their distance.
    alpha *= Math.min(1, (dw - 1) / 2)
    if (alpha < 0.02) return false
    const cut = Math.max(0, destY - clipY)
    if (cut >= dh) {
      // Hidden behind a hill crest in front of it (traced as height 0).
      if (trace) trace('sprite', id, x, y, dw, 0, dist)
      return false
    }
    g.globalAlpha = alpha
    const srcH = art.canvas.height * (1 - cut / dh)
    if (srcH > 0.5) g.drawImage(art.canvas, 0, 0, art.canvas.width, srcH, x, y, dw, dh - cut)
    g.globalAlpha = 1
    if (trace) trace('sprite', id, x, y, dw, dh, dist)
    return true
  }

  function drawWall(g: CanvasRenderingContext2D, w: number, k: number, it: Extract<StaticItem, { t: 'wall' }>, clipY: number, alpha: number, trace: TraceFn | undefined, id: number): boolean {
    const f = frame
    const sN = f.scale[k]
    const sF = f.scale[k + 1]
    const half = w / 2
    const xN = f.sx[k] + sN * it.offset * ROAD_WIDTH * half
    const xF = f.sx[k + 1] + sF * it.offset * ROAD_WIDTH * half
    // Only the side facing the road is visible -- from the road. (A car
    // out on the grass beyond the building would see its back instead.)
    if (camX * it.side >= Math.abs(it.offset)) return false
    if (Math.max(xN, xF) < 0 || Math.min(xN, xF) > w) return false
    const bN = Math.min(f.sy[k], clipY)
    const bF = Math.min(f.sy[k + 1], clipY)
    const tN = f.sy[k] - it.height * sN * half
    const tF = f.sy[k + 1] - it.height * sF * half
    if (tN >= bN && tF >= bF) {
      // Hidden behind a hill crest in front of it.
      if (trace) trace('wall', id, Math.min(xN, xF), Math.min(tN, tF), Math.abs(xN - xF), 0, f.cz[k])
      return false
    }
    const wall = it.art.wall!
    // Thin (edge-on or far) walls fade in with their width.
    alpha *= Math.min(1, Math.abs(xN - xF) / 1.5)
    if (alpha < 0.02) return false
    g.globalAlpha = alpha
    quad(g, xN, bN, xN, tN, xF, tF, xF, bF, wall.face)
    // Windows (one per floor, alternate segments) and the roof line give
    // it scale; a floor line where there is no window.
    if (wall.window && Math.abs(xN - xF) > 2) {
      const floors = Math.max(1, Math.min(10, Math.round(it.height / 700)))
      const glass = it.seg % 2 === 0
      for (let i = 1; i <= floors; i++) {
        const u = (i - 0.35) / floors
        const yN = f.sy[k] - it.height * sN * half * u
        const yF = f.sy[k + 1] - it.height * sF * half * u
        const th = it.height * sN * half * (glass ? 0.4 / floors : 0.03)
        if (yN > bN) continue
        // Inset from the segment's ends so windows read as separate panes.
        const ax = xN + (xF - xN) * 0.18
        const bx = xN + (xF - xN) * 0.82
        const ay = yN + (yF - yN) * 0.18
        const by = yN + (yF - yN) * 0.82
        const r = sF / sN
        quad(g, glass ? ax : xN, glass ? ay : yN, glass ? ax : xN, (glass ? ay : yN) - th, glass ? bx : xF, (glass ? by : yF) - th * (glass ? 0.5 + 0.5 * r : r), glass ? bx : xF, glass ? by : yF, glass ? wall.window : wall.trim)
      }
    }
    const roof = Math.max(1, it.height * sN * half * 0.03)
    quad(g, xN, tN, xN, tN + roof, xF, tF + roof * (sF / sN), xF, tF, wall.trim)
    if (it.first) {
      g.fillStyle = wall.trim
      g.fillRect(xN - Math.max(0.5, roof * 0.5), tN, Math.max(1, roof), bN - tN)
    }
    g.globalAlpha = 1
    if (trace) trace('wall', id, Math.min(xN, xF), Math.min(tN, tF), Math.abs(xN - xF), Math.max(bN, bF) - Math.min(tN, tF), f.cz[k])
    return true
  }

  function drawRail(g: CanvasRenderingContext2D, w: number, k: number, it: Extract<StaticItem, { t: 'rail' }>, clipY: number, fi: number, alpha: number, trace: TraceFn | undefined, id: number): boolean {
    const f = frame
    const half = w / 2
    const off = it.side * RAIL_OFFSET * ROAD_WIDTH
    const xN = f.sx[k] + f.scale[k] * off * half
    const xF = f.sx[k + 1] + f.scale[k + 1] * off * half
    if (Math.max(xN, xF) < 0 || Math.min(xN, xF) > w) return false
    const hN = RAIL_HEIGHT * f.scale[k] * half
    const hF = RAIL_HEIGHT * f.scale[k + 1] * half
    const yN = f.sy[k]
    const yF = f.sy[k + 1]
    if (yN - hN > clipY && yF - hF > clipY) {
      if (trace) trace('rail', id, Math.min(xN, xF), yN - hN, Math.abs(xN - xF), 0, f.cz[k])
      return false
    }
    const bN = Math.min(yN - hN * 0.25, clipY)
    const bF = Math.min(yF - hF * 0.25, clipY)
    g.globalAlpha = alpha
    quad(g, xN, bN, xN, yN - hN, xF, yF - hF, xF, bF, C.rail[fi])
    const band = Math.max(0.5, hN * 0.22)
    quad(g, xN, yN - hN * 0.55, xN, yN - hN * 0.55 - band, xF, yF - hF * 0.55 - band * (hF / hN), xF, yF - hF * 0.55, C.railBand[fi])
    if (it.post && hN > 2) {
      g.fillStyle = C.post[fi]
      g.fillRect(xN - hN * 0.06, yN - hN, hN * 0.12, Math.min(hN, clipY - (yN - hN)))
    }
    g.globalAlpha = 1
    if (trace) trace('rail', id, Math.min(xN, xF), yN - hN, Math.abs(xN - xF), hN, f.cz[k])
    return true
  }

  function carPose(art: CarArt, pose: number, braking: boolean): HTMLCanvasElement {
    const i = Math.max(0, Math.min(CAR_POSES - 1, Math.round(((pose + 1) / 2) * (CAR_POSES - 1))))
    return braking ? art.brake[i] : art.poses[i]
  }

  // --------------------------------------------------------- player's car
  function drawPlayerCar(g: CanvasRenderingContext2D, w: number, h: number, v: RenderView, relYaw: number) {
    let me: RenderCar | null = null
    for (const c of v.cars) if (c.isPlayer) me = c
    if (!me) return
    const art = cars.get(me.color)
    if (!art) return
    const img0 = art.poses[0]
    // Drawn exactly where (and as big as) the projection puts it, so it
    // sits on the road like every other car.
    const cr = rig('chase')
    const s = frame.depth / cr.offset
    const cw = CAR_W * s * (w / 2)
    const ch = (cw * img0.height) / img0.width
    const bounce = v.reduced ? 0 : v.offroad ? Math.sin(v.time * 40) * ch * 0.025 : Math.sin(v.time * 18) * ch * 0.005 * v.speedPct
    const shake = v.reduced ? 0 : v.crash * Math.sin(v.time * 70) * cw * 0.03
    const x = w / 2 - cw / 2 + shake
    const y = h / 2 + s * cr.height * (h / 2) - ch + bounce
    // Pose: mostly the steering, plus the heading against the view.
    const pose = Math.max(-1, Math.min(1, v.steer * 0.75 + relYaw * 2.5))
    const img = carPose(art, pose, !!v.braking)
    if (v.boost) {
      for (const side of [0.3, 0.7]) {
        const fx = x + cw * side
        const len = ch * (0.35 + (v.reduced ? 0 : 0.1 + 0.1 * Math.sin(v.time * 37 + side * 10)))
        g.fillStyle = '#f97316'
        g.beginPath()
        g.moveTo(fx - cw * 0.05, y + ch * 0.84)
        g.lineTo(fx + cw * 0.05, y + ch * 0.84)
        g.lineTo(fx, y + ch * 0.84 + len)
        g.fill()
        g.fillStyle = '#fde047'
        g.beginPath()
        g.moveTo(fx - cw * 0.025, y + ch * 0.84)
        g.lineTo(fx + cw * 0.025, y + ch * 0.84)
        g.lineTo(fx, y + ch * 0.84 + len * 0.55)
        g.fill()
      }
    }
    g.save()
    g.translate(x + cw / 2, y + ch)
    // A little body roll away from the turn.
    if (!v.reduced) g.rotate(-v.steer * 0.025 * Math.min(1, v.speedPct * 1.5))
    g.drawImage(img, -cw / 2, -ch, cw, ch)
    g.restore()
    if (v.shield) {
      g.strokeStyle = `rgba(56,189,248,${0.5 + 0.3 * Math.sin(v.time * 6)})`
      g.lineWidth = Math.max(2, cw * 0.02)
      g.beginPath()
      g.ellipse(x + cw / 2, y + ch * 0.55, cw * 0.62, ch * 0.75, 0, 0, Math.PI * 2)
      g.stroke()
    }
    if (v.offroad && !v.reduced && v.speedPct > 0.1) {
      g.fillStyle = 'rgba(214,211,209,0.55)'
      for (let i = 0; i < 6; i++) {
        const r = cw * (0.04 + (0.5 + 0.5 * Math.sin(v.time * 23 + i * 1.7)) * 0.05)
        g.beginPath()
        g.arc(x + cw * (i % 2 ? 0.05 : 0.95) + Math.sin(v.time * 31 + i) * cw * 0.08, y + ch * (0.88 + 0.08 * Math.sin(v.time * 17 + i)), r, 0, Math.PI * 2)
        g.fill()
      }
    }
  }

  function drawCockpit(g: CanvasRenderingContext2D, w: number, h: number, v: RenderView) {
    let color = '#eab308'
    for (const c of v.cars) if (c.isPlayer) color = c.color
    const shake = v.reduced ? 0 : v.crash * Math.sin(v.time * 70) * w * 0.006 + (v.offroad ? Math.sin(v.time * 40) * h * 0.004 : 0)
    g.fillStyle = color
    g.beginPath()
    g.moveTo(w * 0.12, h + 2)
    g.quadraticCurveTo(w * 0.5, h * 0.8 + shake, w * 0.88, h + 2)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.25)'
    g.fillRect(w * 0.49, h * 0.84 + shake, w * 0.02, h * 0.16)
    g.fillStyle = '#111827'
    g.fillRect(0, h * 0.9 + shake, w, h * 0.1)
    const r = Math.min(w, h) * 0.2
    g.save()
    g.translate(w / 2, h * 1.02 + shake)
    g.rotate(v.steer * 0.6)
    g.strokeStyle = '#1f2937'
    g.lineWidth = r * 0.16
    g.beginPath()
    g.arc(0, 0, r, Math.PI, Math.PI * 2)
    g.stroke()
    g.fillStyle = '#374151'
    g.fillRect(-r * 0.08, -r, r * 0.16, r)
    g.fillStyle = color
    g.beginPath()
    g.arc(0, -r * 0.05, r * 0.2, 0, Math.PI * 2)
    g.fill()
    g.restore()
    if (v.shield) {
      g.strokeStyle = 'rgba(56,189,248,0.6)'
      g.lineWidth = 8
      g.strokeRect(4, 4, w - 8, h - 8)
    }
  }

  function drawArch(g: CanvasRenderingContext2D, x: number, y: number, rw: number, label: string, colors: [string, string], clipY: number) {
    // rw: screen half-width of the road at the arch.
    if (rw < 1) return
    const pw = Math.max(2, rw * 0.06)
    const top = y - rw * 1.1
    if (top > clipY) return
    const bottom = Math.min(y, clipY)
    g.fillStyle = colors[0]
    g.fillRect(x - rw * 1.1 - pw, top, pw, bottom - top)
    g.fillRect(x + rw * 1.1, top, pw, bottom - top)
    g.fillRect(x - rw * 1.1 - pw, top, rw * 2.2 + pw * 2, rw * 0.22)
    if (rw > 8) {
      g.fillStyle = colors[1]
      g.font = `900 ${Math.max(6, rw * 0.16)}px "Noto Sans Tamil", sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(label, x, top + rw * 0.11)
    }
  }

  // ------------------------------------------------------------------ draw
  function draw(g: CanvasRenderingContext2D, w: number, h: number, v: RenderView) {
    const road = v.road
    if (itemsRoad !== road) buildItems(road)
    const L = road.lapLength
    const trace = v.trace
    const dt = lastTime === null ? 1 / 60 : Math.min(0.25, Math.max(0, v.time - lastTime))
    lastTime = v.time
    camX = v.camX

    // Camera.
    const playerYaw = v.yaw ?? 0
    updateCamera(cam, road, v.camZ, playerYaw, v.speedPct, v.boost, v.reduced, dt)
    const yaw = cameraYaw(cam)
    const r = rig(v.camera, cam.fov)
    const f = projectRoad(road, v.camZ, v.camX, yaw, r, w, h, frame)

    // Sky, and the ground beyond the last strip (fully fogged).
    const horizonY = h / 2
    drawSky(g, w, h, horizonY, yaw)
    g.fillStyle = C.grass[2][FOG_STEPS - 1]
    g.fillRect(0, horizonY, w, h - horizonY + 1)

    const strips = drawRoad(g, w, road)

    // Occlusion line for each point: the highest (smallest y) screen row
    // covered by road NEARER than it.
    let m = Infinity
    for (let k = 0; k < f.count; k++) {
      if (f.cz[k] > NEAR) m = Math.min(m, f.sy[k])
      minSy[k] = m
    }

    // Dynamic things (cars, coins, arches), sorted far to near.
    dynCount = 0
    const reach = f.cz[f.count - 1]
    const pushDyn = (d: number, kind: Dyn['kind'], index: number) => {
      if (d <= NEAR || d >= reach || dynCount >= dyn.length) return
      const e = dyn[dynCount++]
      e.d = d
      e.kind = kind
      e.index = index
    }
    const wrapD = (z: number) => ((((z - f.position) % L) + L) % L)
    for (let i = 0; i < v.cars.length; i++) if (!v.cars[i].isPlayer) pushDyn(wrapD(v.cars[i].z), 0, i)
    for (let i = 0; i < v.coins.length; i++) {
      const d = wrapD(v.coins[i].z)
      if (d <= NEAR || d >= reach) continue
      if (v.isCoinTaken(Math.floor((f.position + d) / L), i)) continue
      pushDyn(d, 1, i)
    }
    for (let i = 0; i < v.checkpoints.length; i++) pushDyn(v.checkpoints[i] - f.position, 2, i)
    pushDyn(wrapD(2 * SEGMENT_LENGTH), 3, 0)
    // Insertion sort (a handful of entries), farthest first.
    for (let i = 1; i < dynCount; i++) {
      const e = dyn[i]
      const d = e.d
      const kind = e.kind
      const index = e.index
      let j = i - 1
      while (j >= 0 && dyn[j].d < d) {
        dyn[j + 1].d = dyn[j].d
        dyn[j + 1].kind = dyn[j].kind
        dyn[j + 1].index = dyn[j].index
        j--
      }
      dyn[j + 1].d = d
      dyn[j + 1].kind = kind
      dyn[j + 1].index = index
    }
    let di = 0

    // Pass 2: things on the road, far to near.
    let items = 0
    const half = w / 2
    for (let k = f.count - 2; k >= 0; k--) {
      if (f.cz[k + 1] <= NEAR) break
      const clipY = minSy[k]
      const fi = fogIndex(k + 1)
      const fade = k >= SCENERY_DISTANCE ? 0 : k > SCENERY_FADE_FROM ? 1 - (k - SCENERY_FADE_FROM) / (SCENERY_DISTANCE - SCENERY_FADE_FROM) : 1
      const list = fade > 0 ? itemsFor[f.seg[k]] : NONE
      const absSeg = f.baseAbs + k
      for (let i = 0; i < list.length; i++) {
        const it = list[i]
        if (it.t === 'sprite') {
          const s = f.scale[k + 1]
          if (s <= 0) continue
          const destX = f.sx[k + 1] + s * it.sp.offset * ROAD_WIDTH * half
          if (blit(g, w, it.art, s, destX, f.sy[k + 1], it.sp.offset < 0 ? -1 : 0, clipY, it.sp.scale, fade, trace, (absSeg + 1) * 16 + (it.id % 16), f.cz[k + 1])) items++
        } else if (f.cz[k] > NEAR) {
          if (it.t === 'wall') {
            if (drawWall(g, w, k, it, clipY, fade, trace, absSeg * 32 + i)) items++
          } else if (drawRail(g, w, k, it, clipY, fi, fade, trace, absSeg)) items++
        }
      }
      // Dynamic things inside this segment.
      const lo = f.cz[k]
      while (di < dynCount && dyn[di].d >= lo) {
        const e = dyn[di++]
        const cl = Math.min(clipY, f.sy[k])
        if (e.kind === 0) {
          const car = v.cars[e.index]
          if (!placeAt(f, e.d, car.x, placed)) continue
          const art = cars.get(car.color)
          if (!art) continue
          const cw = placed.scale * half * CAR_W
          if (cw < 0.5) continue
          const img0 = art.poses[0]
          const chh = (cw * img0.height) / img0.width
          const cx = placed.x - cw / 2
          const cy = placed.y - chh
          if (placed.y - clipY > chh * 0.6) continue
          // Its pose: its own heading, plus the road's direction there,
          // against the camera's view.
          const kk = Math.min(f.count - 1, Math.max(0, Math.floor((e.d - f.cz[0]) / SEGMENT_LENGTH)))
          const pose = ((car.yaw ?? 0) + f.rt[kk] / SEGMENT_LENGTH - yaw) * 2.5
          const img = carPose(art, Math.max(-1, Math.min(1, pose)), false)
          const cut = Math.max(0, placed.y - cl)
          g.drawImage(img, 0, 0, img.width, img.height * (1 - cut / chh), cx, cy, cw, chh - cut)
          if (car.boosting) {
            g.fillStyle = 'rgba(249,115,22,0.85)'
            g.fillRect(cx + cw * 0.25, cy + chh * 0.84, cw * 0.1, chh * 0.25)
            g.fillRect(cx + cw * 0.65, cy + chh * 0.84, cw * 0.1, chh * 0.25)
          }
          if (car.label && cw > 30) {
            const fs = Math.max(10, Math.min(18, cw * 0.14))
            g.textAlign = 'center'
            g.textBaseline = 'bottom'
            const tw = labelWidth(g, car.label) * (fs / 100) + 10
            g.font = `800 ${fs}px "Noto Sans Tamil", sans-serif`
            g.fillStyle = 'rgba(15,23,42,0.75)'
            g.fillRect(cx + cw / 2 - tw / 2, cy - 22, tw, 20)
            g.fillStyle = '#fff'
            g.fillText(car.label, cx + cw / 2, cy - 4)
          }
          if (trace) trace('car', e.index, cx, cy, cw, chh, e.d)
          items++
        } else if (e.kind === 1) {
          const cn = v.coins[e.index]
          if (!placeAt(f, e.d, cn.x, placed)) continue
          const s = placed.scale * half * 260
          if (s < 0.5 || placed.y - s * 1.6 > cl) continue
          const bob = v.reduced ? 0 : Math.sin(v.time * 5 + e.index) * s * 0.1
          const spin = v.reduced ? 1 : Math.abs(Math.cos(v.time * 4 + e.index * 0.5)) * 0.8 + 0.2
          g.drawImage(coin, placed.x - (s * spin) / 2, placed.y - s * 1.6 + bob, s * spin, s)
          if (trace) trace('coin', e.index, placed.x - s / 2, placed.y - s * 1.6, s, s, e.d)
          items++
        } else {
          if (!placeAt(f, e.d, 0, placed)) continue
          const rw = placed.scale * ROAD_WIDTH * half
          if (e.kind === 2) drawArch(g, placed.x, placed.y, rw, 'தமிழ்ச் சாவடி', ['#0d9488', '#fef3c7'], cl)
          else {
            const toFinish = v.finishDistance - (f.position + e.d)
            drawArch(g, placed.x, placed.y, rw, Math.abs(toFinish) < L * 0.5 ? 'இலக்கு' : 'தமிழ்ப் பந்தயம்', ['#b45309', '#fff'], cl)
          }
          if (trace) trace('arch', e.kind, placed.x - rw * 1.1, placed.y - rw * 1.1, rw * 2.2, rw * 1.1, e.d)
          items++
        }
      }
    }

    // Speed lines at high speed.
    if (!v.reduced && v.speedPct > 0.85) {
      const kx = (v.speedPct - 0.85) * (v.boost ? 4 : 2.5)
      g.strokeStyle = `rgba(255,255,255,${Math.min(0.5, kx * 0.5)})`
      g.lineWidth = 2
      const cx = w / 2
      const cy = h * 0.45
      g.beginPath()
      for (const l of speedLines) {
        const r0 = Math.max(w, h) * (l.r + ((v.time * 1.8 + l.r) % 0.4))
        const r1 = r0 + Math.max(w, h) * 0.08 * kx
        g.moveTo(cx + Math.cos(l.a) * r0, cy + Math.sin(l.a) * r0)
        g.lineTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1)
      }
      g.stroke()
    }
    if (v.boost && !v.reduced) {
      const key = `${w}x${h}`
      if (!vignette || vignetteKey !== key) {
        vignette = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75)
        vignette.addColorStop(0, 'rgba(249,115,22,0)')
        vignette.addColorStop(1, 'rgba(249,115,22,0.24)')
        vignetteKey = key
      }
      g.fillStyle = vignette
      g.fillRect(0, 0, w, h)
    }

    // The player's car always on top: with flat cut-out cars, a rival just
    // behind would otherwise hide it completely.
    if (v.camera === 'cockpit') drawCockpit(g, w, h, v)
    else drawPlayerCar(g, w, h, v, playerYaw - yaw)
    lastStats.strips = strips
    lastStats.items = items
  }

  return {
    draw,
    stats: () => lastStats,
    dispose() {
      atlas.clear()
      cars.clear()
    },
  }
}
