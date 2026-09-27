import { ROAD_WIDTH, SEGMENT_LENGTH, LANES, heightAt, type Road, type TrackDef, type Coin } from '@/lib/gameRoomV2/racing3d'
import { buildAtlas, buildCar, buildCoin, type SpriteArt } from './sprites'

// Tamil Grand Prix pseudo-3D renderer (canvas 2D, no dependencies).
// Classic segment projection: each road segment ahead of the camera is
// projected to a trapezoid; curves shift the road sideways a little more
// each segment and hills move it up/down. Sprites are drawn back-to-front
// clipped against the hill crest in front of them.
//
// Everything expensive (scenery, cars, horizon silhouettes) is drawn ONCE
// into offscreen canvases per track; each frame only blits and fills.

export type CameraMode = 'chase' | 'cockpit'

export interface RenderCar {
  id: string
  z: number
  x: number
  color: string
  isPlayer: boolean
  boosting: boolean
  shielded: boolean
  label?: string
}

export interface RenderView {
  track: TrackDef
  road: Road
  camZ: number // player distance
  camX: number // player lateral position (road half-widths)
  speedPct: number // 0..1.3
  steer: number // -1..1 for car tilt / wheel
  cars: RenderCar[]
  coins: Coin[]
  isCoinTaken: (lap: number, index: number) => boolean
  checkpoints: number[] // absolute distances of UPCOMING checkpoints
  camera: CameraMode
  time: number
  boost: boolean
  shield: boolean
  offroad: boolean
  crash: number // 0..1 shake strength
  magnet: boolean
  reduced: boolean
  finishDistance: number // absolute distance of the finish line
}

export interface Renderer {
  draw(g: CanvasRenderingContext2D, w: number, h: number, v: RenderView): void
  dispose(): void
}

const FOV = 100
const DRAW_DISTANCE = 220

interface Proj {
  x: number
  y: number
  w: number
  scale: number
  cz: number
}

function project(worldX: number, worldY: number, worldZ: number, camX: number, camY: number, camZ: number, depth: number, w: number, h: number): Proj {
  const cx = worldX - camX
  const cy = worldY - camY
  const cz = worldZ - camZ
  const scale = depth / cz
  return { x: Math.round(w / 2 + (scale * cx * w) / 2), y: Math.round(h / 2 - (scale * cy * h) / 2), w: Math.round((scale * ROAD_WIDTH * w) / 2), scale, cz }
}

function poly(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: string) {
  g.fillStyle = color
  g.beginPath()
  g.moveTo(x1, y1)
  g.lineTo(x2, y2)
  g.lineTo(x3, y3)
  g.lineTo(x4, y4)
  g.closePath()
  g.fill()
}

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
  const ridge = (color: string, base: number, amp: number, freq: number, seed: number) => {
    g.fillStyle = color
    g.beginPath()
    g.moveTo(0, H)
    for (let x = 0; x <= W; x += 8) {
      const t = (x / W) * Math.PI * 2
      const y = base - amp * (0.5 + 0.3 * Math.sin(t * freq + seed) + 0.2 * Math.sin(t * freq * 2.7 + seed * 2))
      g.lineTo(x, y)
    }
    g.lineTo(W, H)
    g.fill()
  }
  const skyline = (color: string, base: number, maxH: number, lights: boolean) => {
    let x = 0
    let i = 0
    while (x < W) {
      const bw = 30 + rnd(i) * 70
      const bh = maxH * (0.3 + rnd(i + 99) * 0.7)
      g.fillStyle = color
      g.fillRect(x, base - bh, bw, H - base + bh)
      if (lights) {
        g.fillStyle = 'rgba(253,224,71,0.8)'
        for (let wy = base - bh + 6; wy < base - 4; wy += 9) for (let wx = x + 4; wx < x + bw - 4; wx += 8) if (rnd(wx * wy) > 0.62) g.fillRect(wx, wy, 3, 4)
      }
      // The odd gopuram in the skyline.
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
      for (let x = 30; x < W; x += 90 + rnd(x) * 120) {
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

// Label widths are measured once (at 100px) and scaled -- measureText every
// frame for every labelled car was the biggest JS cost in the draw.
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
 * ratio. Hysteresis keeps it from flickering between sizes.
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
      ema += (Math.min(100, frameMs) - ema) * 0.08
      if (ema > 21) { slow++; fast = 0 } else if (ema < 17.5) { fast++; slow = 0 } else { slow = 0; fast = 0 }
      if (slow > 45 && scale > 0.55) { scale = Math.max(0.55, scale * 0.85); slow = 0; ema = 16.7 }
      if (fast > 240 && scale < 1) { scale = Math.min(1, scale / 0.9); fast = 0 }
      return Math.max(0.5, max * scale)
    },
  }
}

export function createRenderer(track: TrackDef, carColors: string[]): Renderer {
  const atlas = buildAtlas(track.theme)
  const cars = new Map<string, HTMLCanvasElement>()
  for (const col of carColors) cars.set(col, buildCar(col))
  const coin = buildCoin()
  const horizon = buildHorizon(track)
  let skyOffset = 0
  let lastZ: number | null = null
  const stars = Array.from({ length: 80 }, (_, i) => ({ x: Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1, y: Math.abs(Math.sin(i * 78.233) * 12345.6789) % 1 }))
  const speedLines = Array.from({ length: 28 }, (_, i) => ({ a: (i / 28) * Math.PI * 2 + (i % 3) * 0.1, r: 0.3 + ((i * 37) % 50) / 100 }))

  const artFor = (kind: string, variantSeed: number): SpriteArt | undefined => atlas.get(`${kind}:${variantSeed % 4}`) ?? atlas.get(`${kind}:0`)

  function drawSky(g: CanvasRenderingContext2D, w: number, h: number, v: RenderView, horizonY: number) {
    const t = v.track.theme
    const grd = g.createLinearGradient(0, 0, 0, horizonY)
    grd.addColorStop(0, t.sky[0])
    grd.addColorStop(1, t.sky[1])
    g.fillStyle = grd
    g.fillRect(0, 0, w, horizonY + 2)
    if (t.stars) {
      g.fillStyle = 'rgba(255,255,255,0.8)'
      for (const s of stars) g.fillRect(((s.x * w + skyOffset * 0.05) % w + w) % w, s.y * horizonY * 0.8, 2, 2)
    }
    if (t.sun) {
      const sx = ((w * 0.7 - skyOffset * 0.08) % (w * 1.5) + w * 1.5) % (w * 1.5) - w * 0.25
      const sy = horizonY * t.sun.y
      const glow = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.25)
      glow.addColorStop(0, t.sun.color)
      glow.addColorStop(0.2, t.sun.color)
      glow.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = glow
      g.fillRect(sx - h * 0.25, sy - h * 0.25, h * 0.5, h * 0.5)
    }
    if (t.moon) {
      const mx = ((w * 0.25 - skyOffset * 0.06) % (w * 1.5) + w * 1.5) % (w * 1.5) - w * 0.25
      g.fillStyle = '#fef9c3'
      g.beginPath()
      g.arc(mx, horizonY * 0.25, h * 0.045, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = t.sky[0]
      g.beginPath()
      g.arc(mx + h * 0.018, horizonY * 0.23, h * 0.04, 0, Math.PI * 2)
      g.fill()
    }
    // Horizon silhouettes, tiled and scrolled with the bends.
    const hh = Math.max(40, h * 0.22)
    const hw = (horizon.width / horizon.height) * hh
    let x0 = -(((skyOffset * 0.35) % hw) + hw) % hw
    for (; x0 < w; x0 += hw) g.drawImage(horizon, x0, horizonY - hh + 2, hw, hh)
    if (t.seaSide) {
      g.fillStyle = t.seaColor ?? '#0ea5e9'
      g.fillRect(t.seaSide > 0 ? w * 0.45 : 0, horizonY - 3, w * 0.55, 6)
    }
  }

  function drawSprite(g: CanvasRenderingContext2D, w: number, art: SpriteArt, scale: number, destX: number, destY: number, offsetX: number, clipY: number, sizeMul = 1, alpha = 1) {
    const dw = art.worldW * scale * (w / 2) * sizeMul
    const dh = art.worldH * scale * (w / 2) * sizeMul
    const x = destX + dw * offsetX
    const y = destY - dh
    if (dw < 1 || x > w || x + dw < 0) return
    const clipH = clipY ? Math.max(0, y + dh - clipY) : 0
    if (clipH >= dh) return
    g.globalAlpha = alpha
    g.drawImage(art.canvas, 0, 0, art.canvas.width, art.canvas.height - (art.canvas.height * clipH) / dh, x, y, dw, dh - clipH)
    g.globalAlpha = 1
  }

  function drawArch(g: CanvasRenderingContext2D, p: Proj, label: string, colors: [string, string], clipY: number) {
    const pw = Math.max(2, p.w * 0.06)
    const top = p.y - p.w * 1.1
    if (p.y < clipY - 1 && clipY) return
    g.fillStyle = colors[0]
    g.fillRect(p.x - p.w * 1.1 - pw, top, pw, p.y - top)
    g.fillRect(p.x + p.w * 1.1, top, pw, p.y - top)
    g.fillRect(p.x - p.w * 1.1 - pw, top, p.w * 2.2 + pw * 2, p.w * 0.22)
    g.fillStyle = colors[1]
    const fs = Math.max(6, p.w * 0.16)
    g.font = `900 ${fs}px "Noto Sans Tamil", sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(label, p.x, top + p.w * 0.11)
  }

  function drawPlayerCar(g: CanvasRenderingContext2D, w: number, h: number, v: RenderView) {
    const me = v.cars.find((c) => c.isPlayer)
    if (!me) return
    const img = cars.get(me.color)
    if (!img) return
    const cw = Math.min(w * 0.36, h * 0.62)
    const ch = (cw * img.height) / img.width
    const bounce = v.reduced ? 0 : v.offroad ? Math.sin(v.time * 40) * ch * 0.03 : Math.sin(v.time * 18) * ch * 0.006 * v.speedPct
    const shake = v.reduced ? 0 : v.crash * Math.sin(v.time * 70) * cw * 0.03
    const x = w / 2 - cw / 2 + shake
    const y = h - ch - h * 0.035 + bounce
    // Boost flames.
    if (v.boost) {
      for (const side of [0.3, 0.7]) {
        const fx = x + cw * side
        const len = ch * (0.35 + (v.reduced ? 0 : Math.random() * 0.2))
        const grd = g.createLinearGradient(fx, y + ch * 0.75, fx, y + ch * 0.75 + len)
        grd.addColorStop(0, '#fde047')
        grd.addColorStop(0.5, '#f97316')
        grd.addColorStop(1, 'rgba(239,68,68,0)')
        g.fillStyle = grd
        g.beginPath()
        g.moveTo(fx - cw * 0.05, y + ch * 0.75)
        g.lineTo(fx + cw * 0.05, y + ch * 0.75)
        g.lineTo(fx, y + ch * 0.75 + len)
        g.fill()
      }
    }
    g.save()
    g.translate(x + cw / 2, y + ch)
    g.rotate(v.steer * 0.05)
    g.drawImage(img, -cw / 2, -ch, cw, ch)
    g.restore()
    if (v.shield) {
      g.strokeStyle = `rgba(56,189,248,${0.5 + 0.3 * Math.sin(v.time * 6)})`
      g.lineWidth = Math.max(2, cw * 0.02)
      g.beginPath()
      g.ellipse(x + cw / 2, y + ch * 0.55, cw * 0.62, ch * 0.75, 0, 0, Math.PI * 2)
      g.stroke()
    }
    // Dust off-road.
    if (v.offroad && !v.reduced && v.speedPct > 0.1) {
      g.fillStyle = 'rgba(214,211,209,0.55)'
      for (let i = 0; i < 6; i++) {
        const r = cw * (0.04 + Math.random() * 0.06)
        g.beginPath()
        g.arc(x + cw * (i % 2 ? 0.05 : 0.95) + (Math.random() - 0.5) * cw * 0.2, y + ch * (0.85 + Math.random() * 0.2), r, 0, Math.PI * 2)
        g.fill()
      }
    }
  }

  function drawCockpit(g: CanvasRenderingContext2D, w: number, h: number, v: RenderView) {
    const me = v.cars.find((c) => c.isPlayer)
    const color = me?.color ?? '#eab308'
    const shake = v.reduced ? 0 : v.crash * Math.sin(v.time * 70) * w * 0.006 + (v.offroad ? Math.sin(v.time * 40) * h * 0.004 : 0)
    // Hood.
    g.fillStyle = color
    g.beginPath()
    g.moveTo(w * 0.12, h + 2)
    g.quadraticCurveTo(w * 0.5, h * 0.8 + shake, w * 0.88, h + 2)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.25)'
    g.fillRect(w * 0.49, h * 0.84 + shake, w * 0.02, h * 0.16)
    // Dashboard and wheel.
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

  function draw(g: CanvasRenderingContext2D, w: number, h: number, v: RenderView) {
    const road = v.road
    const segs = road.segments
    const n = segs.length
    const L = road.lapLength
    const cockpit = v.camera === 'cockpit'
    const depth = 1 / Math.tan(((FOV + (v.boost && !v.reduced ? 12 : 0)) / 2) * (Math.PI / 180))
    const camHeight = cockpit ? 520 : 1000
    const playerOffset = cockpit ? 60 : camHeight * depth
    const position = ((v.camZ - playerOffset) % L + L) % L
    const baseIndex = Math.floor(position / SEGMENT_LENGTH)
    const base = segs[baseIndex]
    const basePct = (position % SEGMENT_LENGTH) / SEGMENT_LENGTH
    const playerY = heightAt(road, v.camZ)
    const camY = playerY + camHeight
    const camX = v.camX * ROAD_WIDTH

    // Parallax scroll from bends.
    if (lastZ !== null) {
      const moved = v.camZ - lastZ
      if (moved > 0 && moved < SEGMENT_LENGTH * 20) skyOffset += base.curve * (moved / SEGMENT_LENGTH) * 6
    }
    lastZ = v.camZ

    // The camera looks level, so flat road meets the sky at mid-height;
    // hills simply draw over (or leave grass under) that line.
    g.fillStyle = v.track.theme.grass[0]
    g.fillRect(0, 0, w, h)
    drawSky(g, w, h, v, h / 2)

    let maxY = h
    let x = 0
    let dx = -(base.curve * basePct)
    const clips = new Float32Array(DRAW_DISTANCE + 1)
    const projs: (Proj | null)[] = new Array(DRAW_DISTANCE + 1).fill(null)
    const fogC = v.track.theme.fog
    const t = v.track.theme

    for (let k = 0; k < DRAW_DISTANCE; k++) {
      const seg = segs[(baseIndex + k) % n]
      const looped = baseIndex + k >= n
      const z1 = seg.index * SEGMENT_LENGTH + (looped ? L : 0)
      const p1 = project(-x, seg.y1, z1, camX, camY, position, depth, w, h)
      const p2 = project(-x - dx, seg.y2, z1 + SEGMENT_LENGTH, camX, camY, position, depth, w, h)
      x += dx
      dx += seg.curve
      clips[k] = maxY
      if (p1.cz <= depth || p2.y >= p1.y || p2.y >= maxY) continue
      projs[k] = p1

      const band = seg.band
      poly(g, 0, p2.y, w, p2.y, w, p1.y, 0, p1.y, t.grass[band])
      if (t.seaSide) {
        const s1 = p1.x + t.seaSide * p1.w * 2.6
        const s2 = p2.x + t.seaSide * p2.w * 2.6
        g.fillStyle = t.seaColor ?? '#0ea5e9'
        if (t.seaSide > 0) poly(g, s1, p1.y, w, p1.y, w, p2.y, s2, p2.y, t.seaColor ?? '#0ea5e9')
        else poly(g, 0, p1.y, s1, p1.y, s2, p2.y, 0, p2.y, t.seaColor ?? '#0ea5e9')
        if (band) {
          g.fillStyle = 'rgba(255,255,255,0.5)'
          const sx = t.seaSide > 0 ? s1 : s1 - Math.max(1, p1.w * 0.05)
          g.fillRect(sx, p2.y, Math.max(1, p1.w * 0.05), p1.y - p2.y)
        }
      }
      const r1 = p1.w / Math.max(6, 2 * LANES)
      const r2 = p2.w / Math.max(6, 2 * LANES)
      const rumble = t.rumble[band]
      poly(g, p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, rumble)
      poly(g, p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, rumble)
      const isFinish = seg.index < 2
      poly(g, p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, isFinish ? (band ? '#f8fafc' : '#111827') : t.road[band])
      if (isFinish) {
        // Chequered start/finish band.
        const cells = 8
        for (let c = 0; c < cells; c++) {
          if ((c + seg.index) % 2) continue
          const a = c / cells
          const b = (c + 1) / cells
          poly(g, p1.x - p1.w + 2 * p1.w * a, p1.y, p1.x - p1.w + 2 * p1.w * b, p1.y, p2.x - p2.w + 2 * p2.w * b, p2.y, p2.x - p2.w + 2 * p2.w * a, p2.y, band ? '#111827' : '#f8fafc')
        }
      } else if (band) {
        const l1 = p1.w / Math.max(32, 8 * LANES)
        const l2 = p2.w / Math.max(32, 8 * LANES)
        const lw1 = (p1.w * 2) / LANES
        const lw2 = (p2.w * 2) / LANES
        for (let lane = 1; lane < LANES; lane++) {
          const lx1 = p1.x - p1.w + lw1 * lane
          const lx2 = p2.x - p2.w + lw2 * lane
          poly(g, lx1 - l1 / 2, p1.y, lx1 + l1 / 2, p1.y, lx2 + l2 / 2, p2.y, lx2 - l2 / 2, p2.y, t.lane)
        }
      }
      if (t.night) {
        g.fillStyle = 'rgba(34,211,238,0.28)'
        g.fillRect(p1.x - p1.w - r1 * 2, p2.y, r1, p1.y - p2.y)
        g.fillStyle = 'rgba(244,114,182,0.28)'
        g.fillRect(p1.x + p1.w + r1, p2.y, r1, p1.y - p2.y)
      }
      // Distance fog.
      const fog = Math.min(0.85, Math.pow(k / DRAW_DISTANCE, 1.8) * 1.1)
      if (fog > 0.02) {
        g.globalAlpha = fog
        poly(g, 0, p2.y, w, p2.y, w, p1.y, 0, p1.y, fogC)
        g.globalAlpha = 1
      }
      maxY = p1.y
    }

    // Sprites and cars, back to front.
    const lapOfCam = Math.floor((v.camZ - playerOffset) / L)
    for (let k = DRAW_DISTANCE - 1; k > 0; k--) {
      const p = projs[k]
      if (!p) continue
      const segIndex = (baseIndex + k) % n
      const seg = segs[segIndex]
      const clipY = clips[k]
      const absLap = lapOfCam + (baseIndex + k >= n ? 1 : 0)
      const fade = k > DRAW_DISTANCE * 0.8 ? 1 - (k - DRAW_DISTANCE * 0.8) / (DRAW_DISTANCE * 0.2) : 1
      for (let i = 0; i < seg.sprites.length; i++) {
        const sp = seg.sprites[i]
        const art = artFor(sp.kind, segIndex + i)
        if (!art) continue
        const destX = p.x + (p.scale * sp.offset * ROAD_WIDTH * w) / 2
        drawSprite(g, w, art, p.scale, destX, p.y, sp.offset < 0 ? -1 : 0, clipY, sp.scale, fade)
      }
      // Checkpoint arches and the finish arch.
      const absStart = absLap * L + segIndex * SEGMENT_LENGTH
      for (const cz of v.checkpoints) {
        if (cz >= absStart && cz < absStart + SEGMENT_LENGTH) drawArch(g, p, 'தமிழ்ச் சாவடி', ['#0d9488', '#fef3c7'], clipY)
      }
      if (segIndex === 2) drawArch(g, p, v.finishDistance - absStart < L * 0.5 && v.finishDistance - absStart >= 0 ? 'இலக்கு' : 'தமிழ்ப் பந்தயம்', ['#b45309', '#fff'], clipY)
      // Coins.
      for (let i = 0; i < v.coins.length; i++) {
        const cz = v.coins[i].z
        if (cz < segIndex * SEGMENT_LENGTH || cz >= (segIndex + 1) * SEGMENT_LENGTH) continue
        if (v.isCoinTaken(absLap, i)) continue
        const s = p.scale * (w / 2) * 260
        const cx = p.x + (p.scale * v.coins[i].x * ROAD_WIDTH * w) / 2
        const bob = v.reduced ? 0 : Math.sin(v.time * 5 + i) * s * 0.1
        if (p.y - s * 1.6 > clipY) continue
        const spin = v.reduced ? 1 : Math.abs(Math.cos(v.time * 4 + i * 0.5)) * 0.8 + 0.2
        g.drawImage(coin, cx - (s * spin) / 2, p.y - s * 1.6 + bob, s * spin, s)
      }
      // Other cars in this segment.
      for (const car of v.cars) {
        if (car.isPlayer) continue
        const cz = ((car.z % L) + L) % L
        if (Math.floor(cz / SEGMENT_LENGTH) !== segIndex) continue
        const carLap = Math.floor(car.z / L)
        if (carLap !== absLap && !(k < 3)) continue
        const img = cars.get(car.color)
        if (!img) continue
        const cw = p.scale * (w / 2) * 820
        const chh = (cw * img.height) / img.width
        const cx = p.x + (p.scale * car.x * ROAD_WIDTH * w) / 2 - cw / 2
        const cy = p.y - chh
        if (cy + chh > clipY + chh * 0.6) continue
        g.drawImage(img, cx, cy, cw, chh)
        if (car.boosting) {
          g.fillStyle = 'rgba(249,115,22,0.8)'
          g.fillRect(cx + cw * 0.25, cy + chh * 0.8, cw * 0.1, chh * 0.25)
          g.fillRect(cx + cw * 0.65, cy + chh * 0.8, cw * 0.1, chh * 0.25)
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
      }
    }

    // Speed lines at high speed.
    if (!v.reduced && v.speedPct > 0.85) {
      const k = (v.speedPct - 0.85) * (v.boost ? 4 : 2.5)
      g.strokeStyle = `rgba(255,255,255,${Math.min(0.5, k * 0.5)})`
      g.lineWidth = 2
      const cx = w / 2
      const cy = h * 0.45
      for (const l of speedLines) {
        const r0 = Math.max(w, h) * (l.r + ((v.time * 1.8 + l.r) % 0.4))
        const r1 = r0 + Math.max(w, h) * 0.08 * k
        g.beginPath()
        g.moveTo(cx + Math.cos(l.a) * r0, cy + Math.sin(l.a) * r0)
        g.lineTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1)
        g.stroke()
      }
    }
    if (v.boost && !v.reduced) {
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75)
      vg.addColorStop(0, 'rgba(249,115,22,0)')
      vg.addColorStop(1, 'rgba(249,115,22,0.28)')
      g.fillStyle = vg
      g.fillRect(0, 0, w, h)
    }

    if (cockpit) drawCockpit(g, w, h, v)
    else drawPlayerCar(g, w, h, v)
  }

  return {
    draw,
    dispose() {
      atlas.clear()
      cars.clear()
    },
  }
}
