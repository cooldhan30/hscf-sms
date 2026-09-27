import { mulberry32, seedFromString, pathCells, GRID_COLS, GRID_ROWS, type TdMap, type TowerTypeId } from '@/lib/gameRoomV2/towerDefense'
import type { EnemyKind } from '@/lib/gameRoomV2/towerDefense/waves'
import { toScreen, type TdLayout } from './layout'

// Original illustrated artwork for Tower Defense, drawn with Canvas 2D in
// a slightly raised three-quarter view: towers and characters stand up
// from the ground with soft shadows. Every function draws at a screen
// position with `c` = one cell in pixels, so the same art is used on the
// battlefield and in the small previews (build menu, wave preview).

type Ctx = CanvasRenderingContext2D

function ellipse(g: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  g.fillStyle = fill
  g.beginPath()
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2)
  g.fill()
}

function poly(g: Ctx, pts: [number, number][], fill: string, stroke?: string, lw = 1) {
  g.beginPath()
  pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
  g.fillStyle = fill
  g.fill()
  if (stroke) {
    g.strokeStyle = stroke
    g.lineWidth = lw
    g.stroke()
  }
}

function shadow(g: Ctx, x: number, y: number, rx: number, ry: number, a = 0.22) {
  ellipse(g, x, y, rx, ry, `rgba(30,41,20,${a})`)
}

// ---------------------------------------------------------------------
// Towers

export interface TowerDrawOpts {
  angle: number // aim, screen radians
  recoil: number // 0..1 just fired
  time: number // ms, for idle animation
  build: number // 0..1 construction progress (1 = done)
  rally: boolean
  selected: boolean
}

const LEVEL_SCALE = [1, 1.1, 1.22]

function stoneBase(g: Ctx, x: number, y: number, w: number, h: number, top: string, face: string) {
  g.fillStyle = face
  g.beginPath()
  g.moveTo(x - w, y)
  g.lineTo(x - w, y + h)
  g.ellipse(x, y + h, w, w * 0.42, 0, Math.PI, 0, true)
  g.lineTo(x + w, y)
  g.closePath()
  g.fill()
  ellipse(g, x, y, w, w * 0.42, top)
}

function stars(g: Ctx, x: number, y: number, c: number, level: number) {
  for (let i = 0; i < level; i++) {
    const cx = x + (i - (level - 1) / 2) * c * 0.2
    g.fillStyle = '#facc15'
    g.strokeStyle = '#854d0e'
    g.lineWidth = Math.max(1, c * 0.015)
    g.beginPath()
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? c * 0.075 : c * 0.034
      const a = -Math.PI / 2 + (k * Math.PI) / 5
      g.lineTo(cx + Math.cos(a) * r, y + Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
    g.stroke()
  }
}

function drawVel(g: Ctx, x: number, y: number, c: number, level: number, o: TowerDrawOpts) {
  // Rapid: a slim teal watchtower with a spear thrower on top.
  const s = LEVEL_SCALE[level - 1]
  stoneBase(g, x, y, c * 0.3 * s, c * 0.12, '#d6d3d1', '#a8a29e')
  const h = c * 0.5 * s
  poly(g, [
    [x - c * 0.2 * s, y],
    [x + c * 0.2 * s, y],
    [x + c * 0.14 * s, y - h],
    [x - c * 0.14 * s, y - h],
  ], '#b45309', '#78350f', Math.max(1, c * 0.02))
  g.strokeStyle = 'rgba(120,53,15,0.55)'
  g.lineWidth = Math.max(1, c * 0.015)
  for (let k = 1; k < 4; k++) {
    g.beginPath()
    g.moveTo(x - c * 0.19 * s + k * 0.005 * c, y - (h * k) / 4)
    g.lineTo(x + c * 0.19 * s - k * 0.005 * c, y - (h * k) / 4)
    g.stroke()
  }
  // Platform.
  ellipse(g, x, y - h, c * 0.24 * s, c * 0.1 * s, '#0f766e')
  ellipse(g, x, y - h - c * 0.02, c * 0.2 * s, c * 0.08 * s, '#14b8a6')
  // Spear thrower (aims).
  g.save()
  g.translate(x, y - h - c * 0.05)
  g.rotate(o.angle)
  g.translate(-o.recoil * c * 0.06, 0)
  g.fillStyle = '#44403c'
  g.fillRect(-c * 0.06, -c * 0.03, c * 0.2, c * 0.06)
  g.strokeStyle = '#e7e5e4'
  g.lineWidth = Math.max(1.5, c * 0.025)
  g.beginPath()
  g.moveTo(-c * 0.02, 0)
  g.lineTo(c * 0.26, 0)
  g.stroke()
  poly(g, [
    [c * 0.26, -c * 0.035],
    [c * 0.34, 0],
    [c * 0.26, c * 0.035],
  ], '#cbd5e1')
  if (level >= 3) {
    g.strokeStyle = '#fde68a'
    g.beginPath()
    g.moveTo(-c * 0.02, -c * 0.07)
    g.lineTo(c * 0.2, -c * 0.07)
    g.stroke()
  }
  g.restore()
  // Roof.
  const rh = c * 0.26 * s
  poly(g, [
    [x - c * 0.22 * s, y - h - c * 0.1],
    [x + c * 0.22 * s, y - h - c * 0.1],
    [x, y - h - c * 0.1 - rh],
  ], level >= 3 ? '#eab308' : '#0d9488', level >= 3 ? '#a16207' : '#115e59', Math.max(1, c * 0.02))
  ellipse(g, x, y - h - c * 0.1 - rh, c * 0.03, c * 0.03, '#fde047')
  if (level >= 2) {
    // Pennant.
    const wave = Math.sin(o.time / 180) * c * 0.03
    g.strokeStyle = '#57534e'
    g.lineWidth = Math.max(1, c * 0.015)
    g.beginPath()
    g.moveTo(x, y - h - c * 0.1 - rh)
    g.lineTo(x, y - h - c * 0.1 - rh - c * 0.18)
    g.stroke()
    poly(g, [
      [x, y - h - c * 0.1 - rh - c * 0.18],
      [x + c * 0.16, y - h - c * 0.1 - rh - c * 0.14 + wave],
      [x, y - h - c * 0.1 - rh - c * 0.1],
    ], '#f97316')
  }
}

function drawYanai(g: Ctx, x: number, y: number, c: number, level: number, o: TowerDrawOpts) {
  // Area: a squat round stone bastion with a big bronze cannon.
  const s = LEVEL_SCALE[level - 1]
  const w = c * 0.36 * s
  const h = c * 0.3 * s
  stoneBase(g, x, y - h, w, h, '#78716c', '#a8a29e')
  // Brick courses.
  g.strokeStyle = 'rgba(87,83,78,0.45)'
  g.lineWidth = Math.max(1, c * 0.015)
  for (let k = 1; k < 3; k++) {
    g.beginPath()
    g.ellipse(x, y - h + (h * k) / 3, w, w * 0.42, 0, 0.15, Math.PI - 0.15)
    g.stroke()
  }
  if (level >= 2) {
    g.strokeStyle = '#44403c'
    g.lineWidth = Math.max(2, c * 0.035)
    g.beginPath()
    g.ellipse(x, y - h * 0.35, w, w * 0.42, 0, 0.1, Math.PI - 0.1)
    g.stroke()
  }
  if (level >= 3) {
    g.strokeStyle = '#eab308'
    g.lineWidth = Math.max(2, c * 0.03)
    g.beginPath()
    g.ellipse(x, y - h, w, w * 0.42, 0, 0, Math.PI * 2)
    g.stroke()
    // Tusks on the front.
    g.strokeStyle = '#fafaf9'
    g.lineWidth = Math.max(2, c * 0.04)
    g.lineCap = 'round'
    for (const side of [-1, 1]) {
      g.beginPath()
      g.moveTo(x + side * w * 0.45, y - h * 0.2)
      g.quadraticCurveTo(x + side * w * 0.75, y + h * 0.1, x + side * w * 0.5, y + h * 0.25)
      g.stroke()
    }
    g.lineCap = 'butt'
  }
  // Cannon on a turntable.
  ellipse(g, x, y - h, w * 0.55, w * 0.24, '#57534e')
  g.save()
  g.translate(x, y - h - c * 0.05)
  g.rotate(o.angle)
  g.translate(-o.recoil * c * 0.12, 0)
  g.fillStyle = '#92400e'
  g.beginPath()
  g.roundRect(-c * 0.1, -c * 0.1 * s, c * 0.42 * s, c * 0.2 * s, c * 0.05)
  g.fill()
  g.fillStyle = '#b45309'
  g.fillRect(c * 0.26 * s, -c * 0.12 * s, c * 0.08, c * 0.24 * s)
  g.fillStyle = '#1c1917'
  ellipse(g, c * 0.34 * s, 0, c * 0.03, c * 0.08 * s, '#1c1917')
  g.restore()
  ellipse(g, x, y - h - c * 0.05, c * 0.1, c * 0.07, '#78350f')
  if (o.recoil > 0.5) {
    // Muzzle smoke puff.
    const a = o.angle
    ellipse(g, x + Math.cos(a) * c * 0.5, y - h + Math.sin(a) * c * 0.4, c * 0.12 * o.recoil, c * 0.1 * o.recoil, `rgba(231,229,228,${0.7 * o.recoil})`)
  }
}

function drawPani(g: Ctx, x: number, y: number, c: number, level: number, o: TowerDrawOpts) {
  // Frost: a white shrine with a floating ice crystal and bell glow.
  const s = LEVEL_SCALE[level - 1]
  stoneBase(g, x, y, c * 0.32 * s, c * 0.1, '#f1f5f9', '#cbd5e1')
  // Pillars.
  g.fillStyle = '#e2e8f0'
  for (const px of [-0.2, 0.2]) g.fillRect(x + px * c * s - c * 0.035, y - c * 0.32 * s, c * 0.07, c * 0.32 * s)
  ellipse(g, x, y - c * 0.32 * s, c * 0.28 * s, c * 0.1 * s, '#bae6fd')
  const bob = Math.sin(o.time / 400) * c * 0.04
  const glow = 0.35 + 0.4 * o.recoil
  ellipse(g, x, y - c * 0.62 * s + bob, c * 0.22 * s, c * 0.22 * s, `rgba(125,211,252,${glow})`)
  const cy = y - c * 0.62 * s + bob
  const ch = c * 0.26 * s
  poly(g, [
    [x, cy - ch],
    [x + c * 0.11 * s, cy],
    [x, cy + ch * 0.6],
    [x - c * 0.11 * s, cy],
  ], '#7dd3fc', '#0369a1', Math.max(1, c * 0.02))
  poly(g, [
    [x, cy - ch],
    [x + c * 0.11 * s, cy],
    [x, cy + ch * 0.6],
  ], '#38bdf8')
  if (level >= 2) {
    for (const side of [-1, 1]) {
      poly(g, [
        [x + side * c * 0.22 * s, cy - ch * 0.2],
        [x + side * c * 0.28 * s, cy + ch * 0.2],
        [x + side * c * 0.22 * s, cy + ch * 0.5],
        [x + side * c * 0.16 * s, cy + ch * 0.2],
      ], '#bae6fd', '#0284c7', 1)
    }
  }
  if (level >= 3) {
    for (let k = 0; k < 3; k++) {
      const a = o.time / 600 + (k * Math.PI * 2) / 3
      ellipse(g, x + Math.cos(a) * c * 0.34, cy + Math.sin(a) * c * 0.12, c * 0.04, c * 0.04, '#e0f2fe')
    }
  }
}

function drawKuri(g: Ctx, x: number, y: number, c: number, level: number, o: TowerDrawOpts) {
  // Heavy: a stepped temple-spire (gopuram-inspired) with a war bow.
  const tiers = 2 + level
  const base = c * 0.34
  stoneBase(g, x, y, base, c * 0.1, '#e7e5e4', '#a8a29e')
  let top = y
  let w = base * 0.95
  const th = c * 0.13
  for (let k = 0; k < tiers; k++) {
    const nw = w * 0.8
    poly(g, [
      [x - w, top],
      [x + w, top],
      [x + nw, top - th],
      [x - nw, top - th],
    ], k % 2 === 0 ? '#7c3aed' : '#6d28d9', '#4c1d95', Math.max(1, c * 0.015))
    g.fillStyle = 'rgba(253,230,138,0.85)'
    for (let d = -1; d <= 1; d++) g.fillRect(x + d * w * 0.45 - c * 0.015, top - th * 0.7, c * 0.03, th * 0.45)
    top -= th
    w = nw
  }
  // Kalasam (gold finial).
  ellipse(g, x, top - c * 0.04, c * 0.06, c * 0.05, '#eab308')
  poly(g, [
    [x - c * 0.02, top - c * 0.07],
    [x + c * 0.02, top - c * 0.07],
    [x, top - c * 0.17],
  ], '#facc15')
  if (level >= 3) ellipse(g, x, top - c * 0.1, c * 0.12, c * 0.12, `rgba(250,204,21,${0.2 + 0.15 * Math.sin(o.time / 300)})`)
  // War bow on the second tier.
  const by = y - th * 1.3
  g.save()
  g.translate(x, by)
  g.rotate(o.angle)
  g.strokeStyle = '#3f2d1d'
  g.lineWidth = Math.max(2, c * 0.04)
  g.beginPath()
  g.arc(c * 0.08, 0, c * 0.2, -1.1, 1.1)
  g.stroke()
  g.strokeStyle = '#e7e5e4'
  g.lineWidth = Math.max(1, c * 0.012)
  const pull = (1 - o.recoil) * c * 0.06
  g.beginPath()
  g.moveTo(c * 0.08 + Math.cos(-1.1) * c * 0.2, Math.sin(-1.1) * c * 0.2)
  g.lineTo(-pull, 0)
  g.lineTo(c * 0.08 + Math.cos(1.1) * c * 0.2, Math.sin(1.1) * c * 0.2)
  g.stroke()
  if (o.recoil < 0.5) {
    g.strokeStyle = '#c084fc'
    g.lineWidth = Math.max(1.5, c * 0.02)
    g.beginPath()
    g.moveTo(-pull, 0)
    g.lineTo(c * 0.3, 0)
    g.stroke()
  }
  g.restore()
}

export function drawTower(g: Ctx, type: TowerTypeId, level: number, x: number, y: number, c: number, o: TowerDrawOpts) {
  const b = Math.max(0.001, o.build)
  shadow(g, x + c * 0.06, y + c * 0.12, c * 0.4, c * 0.16)
  if (o.rally) ellipse(g, x, y + c * 0.05, c * (0.45 + 0.05 * Math.sin(o.time / 90)), c * 0.2, 'rgba(249,115,22,0.35)')
  if (o.selected) {
    g.strokeStyle = '#facc15'
    g.lineWidth = Math.max(2, c * 0.04)
    g.beginPath()
    g.ellipse(x, y + c * 0.08, c * 0.44, c * 0.19, 0, 0, Math.PI * 2)
    g.stroke()
  }
  g.save()
  // Construction: rises from the foundation with a little overshoot.
  const pop = b < 1 ? b * (1 + 0.15 * Math.sin(b * Math.PI)) : 1
  g.translate(x, y)
  g.scale(1, pop)
  g.translate(-x, -y)
  if (type === 'vel') drawVel(g, x, y, c, level, o)
  else if (type === 'yanai') drawYanai(g, x, y, c, level, o)
  else if (type === 'pani') drawPani(g, x, y, c, level, o)
  else drawKuri(g, x, y, c, level, o)
  g.restore()
  if (b >= 1) stars(g, x, y + c * 0.33, c, level)
}

export function drawPad(g: Ctx, x: number, y: number, c: number, time: number, highlight: boolean, invite: boolean) {
  shadow(g, x + c * 0.03, y + c * 0.1, c * 0.34, c * 0.14, 0.18)
  stoneBase(g, x, y, c * 0.32, c * 0.07, '#d6d3d1', '#a8a29e')
  // Kolam-style dots on the foundation.
  g.fillStyle = 'rgba(255,255,255,0.8)'
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    ellipse(g, x + Math.cos(a) * c * 0.2, y + Math.sin(a) * c * 0.085, c * 0.018, c * 0.012, 'rgba(255,255,255,0.85)')
  }
  const pulse = invite ? 0.5 + 0.5 * Math.sin(time / 260) : 0
  if (highlight || invite) {
    g.strokeStyle = highlight ? '#facc15' : `rgba(255,255,255,${0.5 + pulse * 0.5})`
    g.lineWidth = Math.max(2, c * (highlight ? 0.05 : 0.03))
    g.beginPath()
    g.ellipse(x, y, c * (0.36 + pulse * 0.04), c * (0.155 + pulse * 0.02), 0, 0, Math.PI * 2)
    g.stroke()
  }
  // Plus sign.
  g.strokeStyle = highlight ? '#a16207' : 'rgba(87,83,78,0.75)'
  g.lineWidth = Math.max(2, c * 0.04)
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(x - c * 0.08, y)
  g.lineTo(x + c * 0.08, y)
  g.moveTo(x, y - c * 0.05)
  g.lineTo(x, y + c * 0.05)
  g.stroke()
  g.lineCap = 'butt'
}

// ---------------------------------------------------------------------
// Enemies

export interface EnemyDrawOpts {
  time: number
  id: number
  facing: number // 1 right, -1 left
  flash: boolean
  frozen: boolean
  slowed: boolean
  enraged: boolean
  alpha?: number
  scale?: number
}

function eyes(g: Ctx, x: number, y: number, r: number, dir: number, color = '#ffffff', pupil = '#111827') {
  for (const ex of [-0.35, 0.35]) {
    ellipse(g, x + ex * r + dir * r * 0.12, y, r * 0.2, r * 0.23, color)
    ellipse(g, x + ex * r + dir * r * 0.2, y + r * 0.03, r * 0.09, r * 0.11, pupil)
  }
}

function legs(g: Ctx, x: number, y: number, r: number, phase: number, color: string, spread = 0.35, len = 0.35) {
  g.strokeStyle = color
  g.lineWidth = Math.max(2, r * 0.22)
  g.lineCap = 'round'
  for (const side of [-1, 1]) {
    const sw = Math.sin(phase + (side > 0 ? 0 : Math.PI)) * r * 0.2
    g.beginPath()
    g.moveTo(x + side * r * spread, y)
    g.lineTo(x + side * r * spread + sw, y + r * len)
    g.stroke()
  }
  g.lineCap = 'butt'
}

export function drawEnemy(g: Ctx, kind: EnemyKind, x: number, y: number, r: number, o: EnemyDrawOpts) {
  const t = o.time
  const sc = o.scale ?? 1
  const alpha = o.alpha ?? 1
  g.save()
  g.globalAlpha = alpha
  g.translate(x, y)
  g.scale(sc, sc)
  const d = o.facing
  shadow(g, 0, r * 0.95, r * 0.95, r * 0.32, 0.25)
  const tint = (base: string) => (o.flash ? '#ffffff' : o.frozen ? '#bfdbfe' : base)
  if (kind === 'grunt') {
    // A stubby stone imp with little horns and a club.
    const phase = t / 110 + o.id
    const bob = Math.abs(Math.sin(phase)) * r * 0.12
    legs(g, 0, r * 0.5 - bob, r, phase, '#44403c')
    ellipse(g, 0, -bob, r * 0.8, r * 0.85, tint('#78716c'))
    ellipse(g, 0, r * 0.22 - bob, r * 0.5, r * 0.42, tint('#a8a29e'))
    for (const side of [-1, 1]) poly(g, [[side * r * 0.45, -r * 0.6 - bob], [side * r * 0.7, -r * 1.05 - bob], [side * r * 0.2, -r * 0.72 - bob]], '#fef3c7')
    eyes(g, 0, -r * 0.2 - bob, r, d)
    g.strokeStyle = '#78350f'
    g.lineWidth = Math.max(2, r * 0.22)
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(d * r * 0.7, 0 - bob)
    g.lineTo(d * r * 1.1, -r * 0.5 - bob + Math.sin(phase) * r * 0.1)
    g.stroke()
    g.lineCap = 'butt'
  } else if (kind === 'scout') {
    // A quick yellow fox-runner: long body, pointy ears, bushy tail.
    const phase = t / 55 + o.id
    const bob = Math.abs(Math.sin(phase)) * r * 0.15
    legs(g, -r * 0.35, r * 0.35 - bob, r * 0.8, phase, '#a16207', 0.3, 0.55)
    legs(g, r * 0.35, r * 0.35 - bob, r * 0.8, phase + 1.6, '#a16207', 0.3, 0.55)
    ellipse(g, -d * r * 0.95, -r * 0.2 - bob, r * 0.5, r * 0.25, tint('#f59e0b'))
    ellipse(g, -d * r * 1.25, -r * 0.3 - bob, r * 0.2, r * 0.16, '#fffbeb')
    ellipse(g, 0, -bob, r * 0.9, r * 0.55, tint('#facc15'))
    ellipse(g, d * r * 0.75, -r * 0.35 - bob, r * 0.48, r * 0.42, tint('#fbbf24'))
    for (const k of [0.55, 0.95]) poly(g, [[d * r * k, -r * 0.65 - bob], [d * r * (k + 0.1), -r * 1.1 - bob], [d * r * (k + 0.22), -r * 0.62 - bob]], '#b45309')
    ellipse(g, d * r * 1.15, -r * 0.3 - bob, r * 0.09, r * 0.08, '#1c1917')
    ellipse(g, d * r * 0.85, -r * 0.45 - bob, r * 0.08, r * 0.1, '#111827')
  } else if (kind === 'swarm') {
    // Small green beetles scuttling in a hurry.
    const phase = t / 40 + o.id * 3
    const jit = Math.sin(phase * 1.7) * r * 0.06
    g.strokeStyle = '#365314'
    g.lineWidth = Math.max(1, r * 0.14)
    for (let k = -1; k <= 1; k++) {
      for (const side of [-1, 1]) {
        g.beginPath()
        g.moveTo(k * r * 0.4, 0)
        g.lineTo(k * r * 0.4 + Math.sin(phase + k) * r * 0.15, side * r * 0.75)
        g.stroke()
      }
    }
    ellipse(g, jit, 0, r * 0.95, r * 0.7, tint('#65a30d'))
    ellipse(g, jit, -r * 0.1, r * 0.8, r * 0.5, tint('#84cc16'))
    g.strokeStyle = '#3f6212'
    g.lineWidth = Math.max(1, r * 0.1)
    g.beginPath()
    g.moveTo(jit - r * 0.2, -r * 0.55)
    g.lineTo(jit - r * 0.2, r * 0.4)
    g.stroke()
    for (const [sx, sy] of [[-0.5, -0.2], [0.1, 0.05], [0.45, -0.25]]) ellipse(g, jit + sx * r, sy * r, r * 0.1, r * 0.08, '#365314')
    ellipse(g, jit + d * r * 0.85, -r * 0.05, r * 0.3, r * 0.28, '#1a2e05')
    ellipse(g, jit + d * r * 0.95, -r * 0.12, r * 0.08, r * 0.08, '#fef08a')
  } else if (kind === 'brute') {
    // A big red ogre with tusks, stomping heavily.
    const phase = t / 220 + o.id
    const stomp = Math.max(0, Math.sin(phase)) * r * 0.18
    legs(g, 0, r * 0.45 - stomp, r * 1.1, phase, '#7f1d1d', 0.4, 0.4)
    ellipse(g, 0, -stomp, r * 0.95, r * 0.8, tint('#b91c1c'))
    for (const side of [-1, 1]) ellipse(g, side * r * 0.85, -r * 0.3 - stomp, r * 0.35, r * 0.3, tint('#dc2626'))
    ellipse(g, 0, r * 0.2 - stomp, r * 0.55, r * 0.35, tint('#fca5a5'))
    ellipse(g, d * r * 0.1, -r * 0.62 - stomp, r * 0.45, r * 0.38, tint('#ef4444'))
    eyes(g, d * r * 0.1, -r * 0.7 - stomp, r * 0.6, d, '#fef2f2')
    for (const side of [-1, 1]) poly(g, [[d * r * 0.1 + side * r * 0.2, -r * 0.45 - stomp], [d * r * 0.1 + side * r * 0.28, -r * 0.72 - stomp], [d * r * 0.1 + side * r * 0.1, -r * 0.5 - stomp]], '#fffbeb')
  } else if (kind === 'armored') {
    // A slate beetle-knight: helmet with a visor slit and a round shield.
    const phase = t / 160 + o.id
    const bob = Math.abs(Math.sin(phase)) * r * 0.08
    legs(g, 0, r * 0.45 - bob, r, phase, '#1e293b', 0.35, 0.4)
    ellipse(g, 0, -bob, r * 0.85, r * 0.8, tint('#64748b'))
    g.strokeStyle = '#334155'
    g.lineWidth = Math.max(1.5, r * 0.1)
    for (let k = -1; k <= 1; k++) {
      g.beginPath()
      g.moveTo(-r * 0.7, k * r * 0.3 - bob)
      g.lineTo(r * 0.7, k * r * 0.3 - bob)
      g.stroke()
    }
    // Helmet.
    g.fillStyle = tint('#94a3b8')
    g.beginPath()
    g.arc(0, -r * 0.55 - bob, r * 0.55, Math.PI, 0)
    g.fill()
    g.fillStyle = '#0f172a'
    g.fillRect(-r * 0.35 + d * r * 0.1, -r * 0.62 - bob, r * 0.7, r * 0.12)
    ellipse(g, 0, -r * 1.1 - bob, r * 0.1, r * 0.1, '#e2e8f0')
    // Shield.
    ellipse(g, d * r * 0.75, r * 0.05 - bob, r * 0.42, r * 0.5, '#475569')
    ellipse(g, d * r * 0.75, r * 0.05 - bob, r * 0.28, r * 0.34, '#94a3b8')
    ellipse(g, d * r * 0.75, r * 0.05 - bob, r * 0.08, r * 0.08, '#e2e8f0')
  } else {
    // The Irul King: a cloaked shadow ruler with a gold crown.
    const phase = t / 260 + o.id
    const float = Math.sin(phase) * r * 0.08
    const cloak = o.enraged ? '#9f1239' : '#5b21b6'
    const cloakDark = o.enraged ? '#4c0519' : '#2e1065'
    if (o.enraged) {
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + t / 300
        const fr = r * (1.15 + 0.12 * Math.sin(t / 70 + k))
        ellipse(g, Math.cos(a) * fr * 0.8, -r * 0.1 + Math.sin(a) * fr * 0.55, r * 0.25, r * 0.35, `rgba(251,113,133,${0.35 + 0.2 * Math.sin(t / 60 + k)})`)
      }
    } else {
      ellipse(g, 0, -r * 0.1, r * 1.25, r * 1.0, `rgba(167,139,250,${0.18 + 0.08 * Math.sin(t / 200)})`)
    }
    poly(g, [
      [-r * 0.95, r * 0.75 + float],
      [r * 0.95, r * 0.75 + float],
      [r * 0.45, -r * 0.45 + float],
      [-r * 0.45, -r * 0.45 + float],
    ], o.flash ? '#ffffff' : cloak, cloakDark, Math.max(2, r * 0.06))
    // Cloak hem zigzag.
    g.fillStyle = cloakDark
    g.beginPath()
    for (let k = 0; k <= 8; k++) g.lineTo(-r * 0.95 + (k * r * 1.9) / 8, r * 0.75 + float + (k % 2 === 0 ? 0 : r * 0.12))
    g.lineTo(r * 0.95, r * 0.75 + float)
    g.fill()
    ellipse(g, 0, -r * 0.6 + float, r * 0.45, r * 0.42, o.flash ? '#ffffff' : '#1e1b4b')
    // Glowing eyes.
    for (const ex of [-0.17, 0.17]) ellipse(g, ex * r + d * r * 0.06, -r * 0.62 + float, r * 0.08, r * 0.06, o.enraged ? '#fecaca' : '#fde047')
    // Crown.
    poly(g, [
      [-r * 0.38, -r * 0.88 + float],
      [-r * 0.38, -r * 1.2 + float],
      [-r * 0.19, -r * 1.02 + float],
      [0, -r * 1.3 + float],
      [r * 0.19, -r * 1.02 + float],
      [r * 0.38, -r * 1.2 + float],
      [r * 0.38, -r * 0.88 + float],
    ], '#eab308', '#a16207', Math.max(1, r * 0.04))
    ellipse(g, 0, -r * 1.0 + float, r * 0.06, r * 0.06, '#dc2626')
    // Staff.
    g.strokeStyle = '#78350f'
    g.lineWidth = Math.max(2, r * 0.1)
    g.beginPath()
    g.moveTo(d * r * 0.7, r * 0.7 + float)
    g.lineTo(d * r * 0.85, -r * 0.9 + float)
    g.stroke()
    ellipse(g, d * r * 0.86, -r * 1.0 + float, r * 0.14, r * 0.14, o.enraged ? '#f43f5e' : '#a78bfa')
  }
  if (o.frozen) {
    g.fillStyle = 'rgba(224,242,254,0.55)'
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + o.id
      poly(g, [[Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.6], [Math.cos(a) * r * 1.2, Math.sin(a) * r * 0.8 - r * 0.2], [Math.cos(a) * r * 1.05, Math.sin(a) * r * 0.7]], 'rgba(186,230,253,0.9)')
    }
  } else if (o.slowed) {
    g.strokeStyle = 'rgba(56,189,248,0.8)'
    g.lineWidth = Math.max(1.5, r * 0.1)
    g.beginPath()
    g.ellipse(0, r * 0.9, r * 0.9, r * 0.3, 0, 0, Math.PI * 2)
    g.stroke()
  }
  g.restore()
}

// ---------------------------------------------------------------------
// Fort (the thing you defend) and the enemy gate

export function drawFort(g: Ctx, x: number, y: number, c: number, hpPct: number, time: number, celebrate: boolean, fallen: boolean) {
  const W = c * 0.95
  shadow(g, x + c * 0.1, y + c * 0.45, W * 1.1, c * 0.25, 0.28)
  const stone = fallen ? '#a8a29e' : '#e8c48a'
  const stoneDark = fallen ? '#78716c' : '#c9974f'
  // Walls with crenellations.
  g.fillStyle = stoneDark
  g.fillRect(x - W, y - c * 0.1, W * 2, c * 0.5)
  g.fillStyle = stone
  g.fillRect(x - W, y - c * 0.16, W * 2, c * 0.48)
  const broken = hpPct < 0.4
  for (let k = 0; k < 7; k++) {
    if (broken && (k === 1 || k === 5)) continue
    g.fillStyle = stoneDark
    g.fillRect(x - W + k * ((W * 2) / 6.4), y - c * 0.28, c * 0.14, c * 0.13)
  }
  // Gopuram-style gate tower: tapering tiers with a gold kalasam.
  let top = y - c * 0.1
  let w = c * 0.45
  const tierColors = ['#d9a55b', '#e8b86e', '#d9a55b', '#e8b86e', '#d9a55b']
  for (let k = 0; k < 5; k++) {
    const nw = w * 0.82
    poly(g, [
      [x - w, top],
      [x + w, top],
      [x + nw, top - c * 0.19],
      [x - nw, top - c * 0.19],
    ], fallen ? '#a8a29e' : tierColors[k], fallen ? '#57534e' : '#9a6a2c', Math.max(1, c * 0.015))
    g.fillStyle = fallen ? '#57534e' : 'rgba(154,106,44,0.65)'
    for (let d = -1; d <= 1; d++) g.fillRect(x + d * w * 0.5 - c * 0.02, top - c * 0.15, c * 0.04, c * 0.1)
    top -= c * 0.19
    w = nw
  }
  poly(g, [
    [x - w * 1.1, top],
    [x + w * 1.1, top],
    [x + w * 0.7, top - c * 0.08],
    [x - w * 0.7, top - c * 0.08],
  ], '#0f766e')
  ellipse(g, x, top - c * 0.13, c * 0.06, c * 0.06, '#facc15')
  poly(g, [
    [x - c * 0.02, top - c * 0.17],
    [x + c * 0.02, top - c * 0.17],
    [x, top - c * 0.3],
  ], '#eab308')
  // Doorway.
  g.fillStyle = '#3f2d1d'
  g.beginPath()
  g.moveTo(x - c * 0.16, y + c * 0.32)
  g.lineTo(x - c * 0.16, y + c * 0.02)
  g.arc(x, y + c * 0.02, c * 0.16, Math.PI, 0)
  g.lineTo(x + c * 0.16, y + c * 0.32)
  g.fill()
  g.strokeStyle = '#facc15'
  g.lineWidth = Math.max(1, c * 0.025)
  g.beginPath()
  g.arc(x, y + c * 0.02, c * 0.19, Math.PI, 0)
  g.stroke()
  // Flags.
  const flap = Math.sin(time / (celebrate ? 90 : 220)) * c * (celebrate ? 0.07 : 0.035)
  for (const side of [-1, 1]) {
    const fx = x + side * W * 0.92
    const fy = y - c * 0.28
    const droop = hpPct < 0.4 && !celebrate ? c * 0.08 : 0
    g.strokeStyle = '#57534e'
    g.lineWidth = Math.max(1.5, c * 0.02)
    g.beginPath()
    g.moveTo(fx, fy)
    g.lineTo(fx, fy - c * 0.45)
    g.stroke()
    poly(g, [
      [fx, fy - c * 0.45 + droop],
      [fx + side * c * 0.26, fy - c * 0.39 + flap + droop * 1.5],
      [fx, fy - c * 0.31 + droop],
    ], side < 0 ? '#f97316' : '#0d9488')
  }
  // Damage: cracks and smoke as health falls.
  if (hpPct < 0.7) {
    g.strokeStyle = 'rgba(68,64,60,0.8)'
    g.lineWidth = Math.max(1, c * 0.018)
    const cracks = hpPct < 0.4 ? 5 : 2
    for (let k = 0; k < cracks; k++) {
      const cx = x - W * 0.8 + ((k * 0.37) % 1) * W * 1.6
      g.beginPath()
      g.moveTo(cx, y - c * 0.12)
      g.lineTo(cx + c * 0.05, y)
      g.lineTo(cx - c * 0.03, y + c * 0.1)
      g.lineTo(cx + c * 0.04, y + c * 0.2)
      g.stroke()
    }
  }
  if (hpPct < 0.7 && !celebrate) {
    const n = hpPct < 0.4 ? 3 : 1
    for (let k = 0; k < n; k++) {
      const ph = ((time / 1600 + k * 0.33) % 1)
      const sx = x - W * 0.5 + k * W * 0.5
      ellipse(g, sx + ph * c * 0.15, y - c * 0.3 - ph * c * 0.6, c * (0.08 + ph * 0.12), c * (0.07 + ph * 0.1), `rgba(120,113,108,${0.45 * (1 - ph)})`)
    }
  }
  if (fallen) {
    g.fillStyle = 'rgba(28,25,23,0.25)'
    g.fillRect(x - W, y - c * 1.2, W * 2, c * 1.55)
  }
}

export function drawGate(g: Ctx, x: number, y: number, c: number, time: number, active: boolean) {
  shadow(g, x + c * 0.05, y + c * 0.4, c * 0.6, c * 0.18, 0.3)
  // Rough stone arch.
  g.fillStyle = '#57534e'
  g.beginPath()
  g.moveTo(x - c * 0.5, y + c * 0.38)
  g.lineTo(x - c * 0.5, y - c * 0.1)
  g.arc(x, y - c * 0.1, c * 0.5, Math.PI, 0)
  g.lineTo(x + c * 0.5, y + c * 0.38)
  g.closePath()
  g.fill()
  g.fillStyle = '#44403c'
  for (let k = 0; k < 7; k++) {
    const a = Math.PI + (k / 6) * Math.PI
    ellipse(g, x + Math.cos(a) * c * 0.44, y - c * 0.1 + Math.sin(a) * c * 0.44, c * 0.08, c * 0.06, '#78716c')
  }
  // Swirling portal.
  g.save()
  g.beginPath()
  g.moveTo(x - c * 0.34, y + c * 0.38)
  g.lineTo(x - c * 0.34, y - c * 0.1)
  g.arc(x, y - c * 0.1, c * 0.34, Math.PI, 0)
  g.lineTo(x + c * 0.34, y + c * 0.38)
  g.closePath()
  g.clip()
  g.fillStyle = '#1e1b4b'
  g.fillRect(x - c * 0.4, y - c * 0.5, c * 0.8, c * 0.9)
  const spin = time / (active ? 350 : 900)
  for (let k = 0; k < 4; k++) {
    g.strokeStyle = `rgba(167,139,250,${0.3 + k * 0.12})`
    g.lineWidth = Math.max(1.5, c * 0.03)
    g.beginPath()
    g.arc(x, y, c * (0.08 + k * 0.08), spin + k, spin + k + Math.PI * 1.3)
    g.stroke()
  }
  g.restore()
}

// ---------------------------------------------------------------------
// Terrain: painted once per layout across the whole viewport.

export function paintTerrain(g: Ctx, l: TdLayout, map: TdMap) {
  const { width: W, height: H, cell: c } = l
  const rand = mulberry32(seedFromString(`${map.id}:${Math.round(W)}x${Math.round(H)}`))
  // Meadow base with soft light/dark patches.
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#8fd06b')
  grad.addColorStop(1, '#79bd57')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  for (let k = 0; k < 90; k++) {
    const x = rand() * W
    const y = rand() * H
    const r = c * (0.6 + rand() * 2.2)
    g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(21,83,45,0.07)'
    g.beginPath()
    g.ellipse(x, y, r, r * 0.6, rand() * Math.PI, 0, Math.PI * 2)
    g.fill()
  }
  // Grass tufts everywhere.
  g.strokeStyle = 'rgba(52,120,40,0.55)'
  g.lineWidth = Math.max(1, c * 0.02)
  for (let k = 0; k < (W * H) / (c * c) * 2.2; k++) {
    const x = rand() * W
    const y = rand() * H
    g.beginPath()
    g.moveTo(x - c * 0.04, y)
    g.lineTo(x - c * 0.06, y - c * 0.08)
    g.moveTo(x, y)
    g.lineTo(x, y - c * 0.1)
    g.moveTo(x + c * 0.04, y)
    g.lineTo(x + c * 0.06, y - c * 0.08)
    g.stroke()
  }

  const inField = (x: number, y: number, pad = 0) => x > l.ox - pad && x < l.ox + l.fieldW + pad && y > l.oy - pad && y < l.oy + l.fieldH + pad

  // A winding river beyond the field edge (decoration only).
  g.lineCap = 'round'
  g.lineJoin = 'round'
  const riverPts: [number, number][] = []
  const alongTop = l.oy > c * 1.2
  for (let k = 0; k <= 12; k++) {
    const u = k / 12
    if (alongTop) riverPts.push([u * W, l.oy * 0.45 + Math.sin(u * 6 + 1) * c * 0.35])
    else riverPts.push([l.ox * 0.45 + Math.sin(u * 6 + 1) * c * 0.35, u * H])
  }
  const riverVisible = alongTop ? l.oy > c * 1.2 : l.ox > c * 1.2
  if (riverVisible) {
    for (const [wd, col] of [[c * 0.95, '#c9b98a'], [c * 0.75, '#5bb8e0'], [c * 0.35, '#8fd3f0']] as [number, string][]) {
      g.strokeStyle = col
      g.lineWidth = wd
      g.beginPath()
      riverPts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
      g.stroke()
    }
    for (let k = 1; k < riverPts.length; k += 2) ellipse(g, riverPts[k][0] + c * 0.15, riverPts[k][1] + c * 0.05, c * 0.1, c * 0.06, '#4d7c0f')
  }

  // Trees and bushes: dense outside the field, sparse inside (never on the path or pads).
  const blocked = new Set<string>()
  pathCells(map.path).forEach((k) => blocked.add(k))
  map.pads.forEach((p) => blocked.add(`${Math.floor(p.x)},${Math.floor(p.y)}`))
  const onFreeCell = (sx: number, sy: number) => {
    const u = (sx - l.ox) / c
    const v = (sy - l.oy) / c
    const wx = l.portrait ? v : u
    const wy = l.portrait ? u : v
    if (wx < 0 || wy < 0 || wx >= GRID_COLS || wy >= GRID_ROWS) return true
    return !blocked.has(`${Math.floor(wx)},${Math.floor(wy)}`)
  }
  const tree = (x: number, y: number, r: number) => {
    shadow(g, x + r * 0.3, y + r * 0.55, r * 0.95, r * 0.4, 0.2)
    g.fillStyle = '#6b4423'
    g.fillRect(x - r * 0.12, y, r * 0.24, r * 0.55)
    ellipse(g, x, y - r * 0.2, r, r * 0.9, '#2f8a3a')
    ellipse(g, x - r * 0.3, y - r * 0.45, r * 0.55, r * 0.5, '#44a84b')
    ellipse(g, x + r * 0.35, y - r * 0.1, r * 0.35, r * 0.3, '#3a9a43')
  }
  const bush = (x: number, y: number, r: number) => {
    shadow(g, x + r * 0.2, y + r * 0.4, r, r * 0.35, 0.18)
    ellipse(g, x, y, r, r * 0.7, '#3f9d45')
    ellipse(g, x - r * 0.35, y - r * 0.2, r * 0.5, r * 0.4, '#58b85c')
    if (rand() < 0.5) for (let k = 0; k < 3; k++) ellipse(g, x + (rand() - 0.5) * r, y + (rand() - 0.5) * r * 0.5, r * 0.1, r * 0.1, rand() < 0.5 ? '#f472b6' : '#fde047')
  }
  const pts: { x: number; y: number; kind: 'tree' | 'bush' | 'rock' | 'flowers' }[] = []
  const tries = Math.round(((W * H) / (c * c)) * 0.9)
  for (let k = 0; k < tries; k++) {
    const x = rand() * W
    const y = rand() * H
    const inside = inField(x, y, c * 0.15)
    if (inside && (!onFreeCell(x, y) || rand() < 0.75)) continue
    if (!inside && y < 70 && x > W * 0.35 && x < W * 0.65) continue // keep the HUD centre calm
    const r = rand()
    pts.push({ x, y, kind: inside ? (r < 0.35 ? 'bush' : r < 0.55 ? 'rock' : 'flowers') : r < 0.5 ? 'tree' : r < 0.72 ? 'bush' : r < 0.85 ? 'rock' : 'flowers' })
  }
  pts.sort((a, b) => a.y - b.y)
  for (const p of pts) {
    if (p.kind === 'tree') tree(p.x, p.y, c * (0.32 + rand() * 0.22))
    else if (p.kind === 'bush') bush(p.x, p.y, c * (0.18 + rand() * 0.1))
    else if (p.kind === 'rock') {
      shadow(g, p.x + c * 0.04, p.y + c * 0.06, c * 0.14, c * 0.06, 0.2)
      ellipse(g, p.x, p.y, c * 0.13, c * 0.09, '#a8a29e')
      ellipse(g, p.x - c * 0.03, p.y - c * 0.03, c * 0.06, c * 0.04, '#d6d3d1')
    } else {
      for (let k = 0; k < 4; k++) ellipse(g, p.x + (rand() - 0.5) * c * 0.4, p.y + (rand() - 0.5) * c * 0.25, c * 0.035, c * 0.035, ['#f472b6', '#fde047', '#ffffff', '#fb923c'][k])
    }
  }

  // The road: extended to the screen edges at both ends.
  const path = map.path.map((p) => toScreen(l, p.x, p.y))
  const extend = (a: { sx: number; sy: number }, b: { sx: number; sy: number }) => {
    const dx = a.sx - b.sx
    const dy = a.sy - b.sy
    const len = Math.hypot(dx, dy) || 1
    return { sx: a.sx + (dx / len) * Math.max(W, H), sy: a.sy + (dy / len) * Math.max(W, H) }
  }
  // From off-screen at the gate end, through every corner, into the fort.
  const full = [extend(path[0], path[1]), ...path]
  const road = (wd: number, color: string, dash?: number[], off = 0) => {
    g.strokeStyle = color
    g.lineWidth = wd
    g.setLineDash(dash ?? [])
    g.beginPath()
    full.forEach((p, i) => (i === 0 ? g.moveTo(p.sx + off, p.sy + off) : g.lineTo(p.sx + off, p.sy + off)))
    g.stroke()
    g.setLineDash([])
  }
  road(c * 0.92, 'rgba(40,50,20,0.18)', undefined, c * 0.06)
  road(c * 0.92, '#a47e4f')
  road(c * 0.8, '#e2c48d')
  road(c * 0.42, '#ecd4a3')
  road(c * 0.05, 'rgba(164,126,79,0.45)', [c * 0.12, c * 0.22])
  // Edge stones.
  for (let i = 1; i < full.length; i++) {
    const a = full[i - 1]
    const b = full[i]
    const len = Math.hypot(b.sx - a.sx, b.sy - a.sy)
    const nx = -(b.sy - a.sy) / (len || 1)
    const ny = (b.sx - a.sx) / (len || 1)
    for (let d = 0; d < len; d += c * 0.3) {
      const t = d / len
      const px = a.sx + (b.sx - a.sx) * t
      const py = a.sy + (b.sy - a.sy) * t
      for (const side of [-1, 1]) {
        if (rand() < 0.35) continue
        ellipse(g, px + nx * side * c * 0.44, py + ny * side * c * 0.44, c * 0.05, c * 0.035, '#8b6b43')
      }
    }
  }
  g.lineCap = 'butt'
  // A kolam in front of the fort.
  const end = path[path.length - 2]
  const k0 = { sx: end.sx + (l.portrait ? c * 0.9 : 0), sy: end.sy + (l.portrait ? 0 : c * 0.9) }
  if (inField(k0.sx, k0.sy)) {
    g.strokeStyle = 'rgba(255,255,255,0.75)'
    g.lineWidth = Math.max(1, c * 0.02)
    for (let r = 1; r <= 2; r++) {
      g.beginPath()
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * Math.PI * 2
        const rr = c * 0.1 * r * (k % 2 === 0 ? 1 : 0.7)
        g.lineTo(k0.sx + Math.cos(a) * rr, k0.sy + Math.sin(a) * rr * 0.6)
      }
      g.stroke()
    }
  }
}

// Screen positions of the gate (enemy entrance) and the fort: just past
// the two ends of the playfield, where the road enters and leaves (the
// terrain continues there, so both are fully visible and never cover a
// build spot). `scale` shrinks the fort a little on a portrait phone.
export function gateAndFort(l: TdLayout, map: TdMap) {
  const p0 = map.path[0]
  const pn = map.path[map.path.length - 1]
  const gateW = { x: p0.x + 0.2, y: p0.y }
  const fortW = { x: pn.x - 0.1, y: pn.y }
  return { gate: toScreen(l, gateW.x, gateW.y), fort: toScreen(l, fortW.x, fortW.y), fortWorld: fortW, scale: l.portrait ? 0.78 : 1 }
}
