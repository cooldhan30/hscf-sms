import { WORLD_W, WORLD_H, type Arena, type Hazard } from '@/lib/gameRoomV2/bossBattle/brawl'
import { mulberry32, seedFromString } from '@/lib/gameRoomV2/gameplay/rng'

// The four Boss Battle environments, painted once per layout into an
// offscreen canvas (world units, with a scenery MARGIN around the
// playable arena so wide or tall screens reveal more world instead of
// stretching it), plus the cheap per-frame ambient layer: lamp flames,
// fireflies, flowing water, embers, hazards.

export const MARGIN = 420

type Ctx = CanvasRenderingContext2D

function ell(g: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  g.beginPath()
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2)
  g.fillStyle = fill
  g.fill()
}

function poly(g: Ctx, pts: [number, number][], fill: string, stroke?: string, lw = 2) {
  g.beginPath()
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
  g.fillStyle = fill
  g.fill()
  if (stroke) {
    g.strokeStyle = stroke
    g.lineWidth = lw
    g.stroke()
  }
}

function blob(g: Ctx, x: number, y: number, r: number, fill: string, rand: () => number, lobes = 7) {
  g.beginPath()
  for (let k = 0; k <= lobes; k++) {
    const a = (k / lobes) * Math.PI * 2
    const rr = r * (0.8 + rand() * 0.35)
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr * 0.85
    if (k === 0) g.moveTo(px, py)
    else g.quadraticCurveTo(x + Math.cos(a - 0.45) * rr * 1.15, y + Math.sin(a - 0.45) * rr, px, py)
  }
  g.closePath()
  g.fillStyle = fill
  g.fill()
}

function tree(g: Ctx, x: number, y: number, r: number, rand: () => number, dark = '#14532d', mid = '#166534', light = '#22c55e') {
  ell(g, x + r * 0.2, y + r * 0.35, r * 1.05, r * 0.5, 'rgba(0,0,0,0.25)')
  blob(g, x, y, r, dark, rand)
  blob(g, x - r * 0.15, y - r * 0.15, r * 0.78, mid, rand)
  blob(g, x - r * 0.3, y - r * 0.32, r * 0.42, light, rand, 5)
}

function palm(g: Ctx, x: number, y: number, r: number) {
  ell(g, x + r * 0.3, y + r * 0.4, r * 0.8, r * 0.3, 'rgba(0,0,0,0.22)')
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2
    g.strokeStyle = k % 2 ? '#15803d' : '#16a34a'
    g.lineWidth = r * 0.22
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(x, y)
    g.quadraticCurveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6 - r * 0.3, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8)
    g.stroke()
  }
  g.lineCap = 'butt'
  ell(g, x, y, r * 0.16, r * 0.16, '#78350f')
}

function rock(g: Ctx, x: number, y: number, r: number, base: string, top: string) {
  ell(g, x + r * 0.15, y + r * 0.35, r * 1.05, r * 0.45, 'rgba(0,0,0,0.25)')
  poly(g, [[x - r, y + r * 0.3], [x - r * 0.7, y - r * 0.6], [x + r * 0.1, y - r * 0.9], [x + r * 0.9, y - r * 0.4], [x + r, y + r * 0.35]], base, 'rgba(0,0,0,0.35)', 2)
  poly(g, [[x - r * 0.6, y - r * 0.5], [x + r * 0.1, y - r * 0.8], [x + r * 0.6, y - r * 0.4], [x, y - r * 0.2]], top)
}

export interface AmbientSpec {
  lamps: { x: number; y: number }[]
  water: { y0: number; y1: number } | null
  lavaVeins: [number, number][][]
}

// Paints the arena in world units into `g` (already translated so that
// world (0,0) is at (MARGIN, MARGIN)).
export function paintArena(g: Ctx, arena: Arena): AmbientSpec {
  const rand = mulberry32(seedFromString(`brawl:${arena.id}`))
  const b = arena.bounds
  const X0 = -MARGIN
  const Y0 = -MARGIN
  const FW = WORLD_W + MARGIN * 2
  const FH = WORLD_H + MARGIN * 2
  const spec: AmbientSpec = { lamps: [], water: null, lavaVeins: [] }

  if (arena.id === 'temple') {
    // Jungle beyond the walls.
    g.fillStyle = '#4d7c0f'
    g.fillRect(X0, Y0, FW, FH)
    for (let k = 0; k < 90; k++) {
      const x = X0 + rand() * FW
      const y = Y0 + rand() * FH
      if (x > b.x0 - 90 && x < b.x1 + 90 && y > b.y0 - 90 && y < b.y1 + 90) continue
      if (rand() < 0.3) palm(g, x, y, 40 + rand() * 30)
      else tree(g, x, y, 45 + rand() * 35, rand)
    }
    // Courtyard walls.
    g.fillStyle = '#b45309'
    g.fillRect(b.x0 - 60, b.y0 - 60, b.x1 - b.x0 + 120, b.y1 - b.y0 + 120)
    g.fillStyle = '#d97706'
    g.fillRect(b.x0 - 50, b.y0 - 50, b.x1 - b.x0 + 100, b.y1 - b.y0 + 100)
    // Paved floor.
    g.fillStyle = '#e7cfa0'
    g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)
    g.strokeStyle = 'rgba(146,98,48,0.28)'
    g.lineWidth = 2
    for (let y = b.y0; y < b.y1; y += 70) {
      for (let x = b.x0 + ((y / 70) % 2) * 45; x < b.x1; x += 90) {
        g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(120,72,28,0.05)'
        g.fillRect(x, y, 90, 70)
        g.strokeRect(x, y, 90, 70)
      }
    }
    // Great kolam at the centre.
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    g.strokeStyle = 'rgba(255,255,255,0.85)'
    g.lineWidth = 4
    for (let ring = 1; ring <= 3; ring++) {
      g.beginPath()
      for (let k = 0; k <= 16; k++) {
        const a = (k / 16) * Math.PI * 2
        const rr = ring * 55 * (k % 2 ? 0.78 : 1)
        const px = cx + Math.cos(a) * rr
        const py = cy + Math.sin(a) * rr
        if (k) g.lineTo(px, py)
        else g.moveTo(px, py)
      }
      g.stroke()
    }
    g.fillStyle = 'rgba(255,255,255,0.9)'
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2
      ell(g, cx + Math.cos(a) * 200, cy + Math.sin(a) * 200, 5, 5, 'rgba(255,255,255,0.85)')
    }
    for (const [dx, dy, col] of [[0, -40, '#f97316'], [40, 0, '#facc15'], [0, 40, '#ec4899'], [-40, 0, '#facc15']] as [number, number, string][]) ell(g, cx + dx, cy + dy, 14, 14, col)
    // Temple steps and a gopuram at the north.
    for (let k = 0; k < 4; k++) {
      g.fillStyle = k % 2 ? '#c28a4a' : '#d6a060'
      g.fillRect(cx - 170 + k * 14, b.y0 - 60 - k * 16, 340 - k * 28, 16)
    }
    let top = b.y0 - 124
    let w = 150
    for (let k = 0; k < 6; k++) {
      const nw = w * 0.84
      poly(g, [[cx - w, top], [cx + w, top], [cx + nw, top - 38], [cx - nw, top - 38]], k % 2 ? '#e8b86e' : '#d9a55b', '#9a6a2c', 2)
      for (let d = -2; d <= 2; d++) {
        g.fillStyle = 'rgba(154,106,44,0.6)'
        g.fillRect(cx + d * w * 0.35 - 5, top - 30, 10, 22)
      }
      top -= 38
      w = nw
    }
    poly(g, [[cx - w * 1.1, top], [cx + w * 1.1, top], [cx + w * 0.6, top - 20], [cx - w * 0.6, top - 20]], '#0f766e')
    ell(g, cx, top - 30, 12, 12, '#facc15')
    // Side gateways.
    for (const sp of arena.spawns) {
      if (Math.abs(sp.y - cy) < 30 || Math.abs(sp.x - cx) < 30) {
        const horiz = Math.abs(sp.y - cy) < 30
        g.fillStyle = '#7c2d12'
        if (horiz) g.fillRect(sp.x < cx ? b.x0 - 60 : b.x1, sp.y - 55, 60, 110)
        else if (sp.y > cy) g.fillRect(sp.x - 55, b.y1, 110, 60)
      }
    }
    // Pillars and brass lamp stands (the solid obstacles).
    for (const o of arena.obstacles) {
      ell(g, o.x + 10, o.y + 18, o.r * 1.1, o.r * 0.5, 'rgba(0,0,0,0.25)')
      if (o.kind === 'pillar') {
        g.fillStyle = '#c28a4a'
        g.fillRect(o.x - o.r, o.y - 10, o.r * 2, 26)
        g.fillStyle = '#e0b377'
        g.fillRect(o.x - o.r * 0.72, o.y - 110, o.r * 1.44, 104)
        g.strokeStyle = 'rgba(120,72,28,0.45)'
        g.lineWidth = 2
        for (let k = 1; k < 4; k++) {
          g.beginPath()
          g.moveTo(o.x - o.r * 0.72 + k * o.r * 0.36, o.y - 108)
          g.lineTo(o.x - o.r * 0.72 + k * o.r * 0.36, o.y - 8)
          g.stroke()
        }
        g.fillStyle = '#b45309'
        g.fillRect(o.x - o.r * 1.05, o.y - 128, o.r * 2.1, 22)
        ell(g, o.x, o.y - 138, o.r * 0.5, 10, '#facc15')
      } else {
        ell(g, o.x, o.y + 4, o.r, o.r * 0.45, '#92400e')
        g.fillStyle = '#d4a017'
        g.fillRect(o.x - 6, o.y - 80, 12, 84)
        ell(g, o.x, o.y - 82, 24, 9, '#eab308')
        spec.lamps.push({ x: o.x, y: o.y - 92 })
      }
    }
    // Wall-top lamps.
    for (let x = b.x0 + 60; x < b.x1; x += 240) {
      spec.lamps.push({ x, y: b.y1 + 22 })
      ell(g, x, b.y1 + 30, 10, 5, '#92400e')
    }
  } else if (arena.id === 'forest') {
    g.fillStyle = '#14532d'
    g.fillRect(X0, Y0, FW, FH)
    // Clearing floor: moss and earth.
    g.fillStyle = '#4d7c0f'
    blob(g, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.x1 - b.x0) * 0.62, '#4d7c0f', rand, 14)
    g.fillStyle = '#65a30d'
    g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)
    for (let k = 0; k < 70; k++) {
      const x = b.x0 + rand() * (b.x1 - b.x0)
      const y = b.y0 + rand() * (b.y1 - b.y0)
      blob(g, x, y, 30 + rand() * 60, rand() < 0.5 ? 'rgba(120,80,30,0.22)' : 'rgba(163,230,53,0.14)', rand, 6)
    }
    // Roots snaking over the ground.
    g.strokeStyle = 'rgba(92,52,20,0.55)'
    g.lineCap = 'round'
    for (let k = 0; k < 16; k++) {
      g.lineWidth = 6 + rand() * 8
      let x = b.x0 + rand() * (b.x1 - b.x0)
      let y = rand() < 0.5 ? b.y0 : b.y1
      g.beginPath()
      g.moveTo(x, y)
      for (let s = 0; s < 4; s++) {
        x += (rand() - 0.5) * 160
        y += (y < (b.y0 + b.y1) / 2 ? 1 : -1) * (30 + rand() * 50)
        g.lineTo(x, y)
      }
      g.stroke()
    }
    g.lineCap = 'butt'
    // Flowers, ferns.
    for (let k = 0; k < 60; k++) {
      const x = b.x0 + rand() * (b.x1 - b.x0)
      const y = b.y0 + rand() * (b.y1 - b.y0)
      if (rand() < 0.5) for (let q = 0; q < 3; q++) ell(g, x + (rand() - 0.5) * 16, y + (rand() - 0.5) * 12, 4, 4, ['#f472b6', '#fde047', '#ffffff'][q])
      else {
        g.strokeStyle = '#3f6212'
        g.lineWidth = 3
        for (let q = -2; q <= 2; q++) {
          g.beginPath()
          g.moveTo(x, y)
          g.quadraticCurveTo(x + q * 8, y - 14, x + q * 14, y - 6)
          g.stroke()
        }
      }
    }
    // A ruined stone archway at the north.
    const cx = (b.x0 + b.x1) / 2
    for (const s of [-1, 1]) {
      g.fillStyle = '#78716c'
      g.fillRect(cx + s * 120 - 26, b.y0 - 150, 52, 150)
      g.fillStyle = '#a8a29e'
      g.fillRect(cx + s * 120 - 22, b.y0 - 146, 44, 142)
    }
    poly(g, [[cx - 150, b.y0 - 150], [cx + 40, b.y0 - 150], [cx + 10, b.y0 - 185], [cx - 150, b.y0 - 185]], '#a8a29e', 'rgba(0,0,0,0.35)', 2)
    blob(g, cx + 110, b.y0 - 165, 26, '#4d7c0f', rand)
    // Dense forest walls.
    for (let k = 0; k < 170; k++) {
      const x = X0 + rand() * FW
      const y = Y0 + rand() * FH
      if (x > b.x0 - 40 && x < b.x1 + 40 && y > b.y0 - 40 && y < b.y1 + 40) continue
      const near = arena.spawns.some((sp) => Math.hypot(sp.x - x, sp.y - y) < 120)
      if (near) continue
      tree(g, x, y, 50 + rand() * 45, rand, '#052e16', '#14532d', '#15803d')
    }
    // Ruin blocks, trees and boulders (the obstacles).
    for (const o of arena.obstacles) {
      if (o.kind === 'tree') {
        ell(g, o.x + 14, o.y + 20, o.r * 1.6, o.r * 0.7, 'rgba(0,0,0,0.3)')
        ell(g, o.x, o.y, o.r, o.r * 0.8, '#78350f')
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2
          g.strokeStyle = '#78350f'
          g.lineWidth = 10
          g.beginPath()
          g.moveTo(o.x, o.y)
          g.lineTo(o.x + Math.cos(a) * o.r * 1.4, o.y + Math.sin(a) * o.r * 1.1)
          g.stroke()
        }
        tree(g, o.x - 6, o.y - o.r * 0.9, o.r * 1.35, rand)
      } else if (o.kind === 'ruin') {
        ell(g, o.x + 8, o.y + 16, o.r * 1.2, o.r * 0.5, 'rgba(0,0,0,0.3)')
        poly(g, [[o.x - o.r, o.y + o.r * 0.5], [o.x - o.r, o.y - o.r * 1.4], [o.x + o.r * 0.3, o.y - o.r * 1.7], [o.x + o.r, o.y - o.r * 1.2], [o.x + o.r, o.y + o.r * 0.5]], '#a8a29e', '#57534e', 2)
        blob(g, o.x - o.r * 0.3, o.y - o.r * 1.35, o.r * 0.45, '#65a30d', rand, 5)
      } else rock(g, o.x, o.y, o.r, '#78716c', '#a8a29e')
    }
  } else if (arena.id === 'river') {
    // Fields, the river to the north, the fort wall to the south.
    g.fillStyle = '#84cc16'
    g.fillRect(X0, Y0, FW, FH)
    const riverTop = -MARGIN
    const riverBot = b.y0 - 40
    spec.water = { y0: riverTop + 60, y1: riverBot }
    g.fillStyle = '#d6c28a'
    g.fillRect(X0, riverBot - 10, FW, 50)
    g.fillStyle = '#2563eb'
    g.fillRect(X0, riverTop, FW, riverBot - riverTop)
    const grad = g.createLinearGradient(0, riverTop, 0, riverBot)
    grad.addColorStop(0, '#1d4ed8')
    grad.addColorStop(1, '#38bdf8')
    g.fillStyle = grad
    g.fillRect(X0, riverTop, FW, riverBot - riverTop)
    // Far bank.
    g.fillStyle = '#65a30d'
    g.fillRect(X0, Y0, FW, 90)
    for (let x = X0; x < X0 + FW; x += 70 + rand() * 60) tree(g, x, Y0 + 40, 40 + rand() * 20, rand)
    // Bridges at the two spawn gates.
    for (const sp of arena.spawns.filter((s) => s.y < b.y0 + 40)) {
      const bw = 110
      g.fillStyle = 'rgba(0,0,0,0.25)'
      g.fillRect(sp.x - bw / 2 + 8, Y0 + 80, bw, riverBot - Y0 - 60)
      g.fillStyle = '#8b5a2b'
      g.fillRect(sp.x - bw / 2, Y0 + 70, bw, riverBot - Y0 - 40)
      g.fillStyle = '#a9723c'
      for (let y = Y0 + 72; y < riverBot + 30; y += 18) g.fillRect(sp.x - bw / 2 + 4, y, bw - 8, 12)
      g.fillStyle = '#6b4423'
      g.fillRect(sp.x - bw / 2 - 6, Y0 + 70, 10, riverBot - Y0 - 40)
      g.fillRect(sp.x + bw / 2 - 4, Y0 + 70, 10, riverBot - Y0 - 40)
    }
    // Reeds along the near bank.
    for (let x = X0; x < X0 + FW; x += 18 + rand() * 30) {
      if (arena.spawns.some((sp) => sp.y < b.y0 + 40 && Math.abs(sp.x - x) < 80)) continue
      g.strokeStyle = '#3f6212'
      g.lineWidth = 3
      for (let q = 0; q < 4; q++) {
        g.beginPath()
        g.moveTo(x + q * 5, riverBot + 12)
        g.lineTo(x + q * 5 + (q - 1.5) * 4, riverBot - 20 - rand() * 18)
        g.stroke()
      }
      if (rand() < 0.4) ell(g, x + 8, riverBot - 26, 3.5, 9, '#7c4a1e')
    }
    // The meadow floor inside the fort's outer yard.
    g.fillStyle = '#a3d65c'
    g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)
    for (let k = 0; k < 40; k++) blob(g, b.x0 + rand() * (b.x1 - b.x0), b.y0 + rand() * (b.y1 - b.y0), 30 + rand() * 50, 'rgba(255,255,255,0.07)', rand, 6)
    // Dirt paths from the bridges.
    g.strokeStyle = 'rgba(180,140,80,0.55)'
    g.lineWidth = 60
    g.lineCap = 'round'
    for (const sp of arena.spawns.filter((s) => s.y < b.y0 + 40)) {
      g.beginPath()
      g.moveTo(sp.x, b.y0)
      g.quadraticCurveTo(sp.x, 600, 800, 820)
      g.stroke()
    }
    g.lineCap = 'butt'
    // The fort: wall along the south with towers and a gate.
    const wy = b.y1 + 10
    g.fillStyle = '#92633a'
    g.fillRect(X0, wy, FW, 60)
    g.fillStyle = '#c69c6d'
    g.fillRect(X0, wy - 14, FW, 20)
    for (let x = X0; x < X0 + FW; x += 40) {
      g.fillStyle = '#b08255'
      g.fillRect(x, wy - 30, 22, 18)
    }
    for (const tx of [260, 800, 1340]) {
      g.fillStyle = '#a0703f'
      g.fillRect(tx - 60, wy - 70, 120, 110)
      g.fillStyle = '#c69c6d'
      g.fillRect(tx - 66, wy - 84, 132, 20)
      poly(g, [[tx - 50, wy - 84], [tx + 50, wy - 84], [tx, wy - 140]], '#b91c1c', '#7f1d1d', 2)
    }
    g.fillStyle = '#3f2d1d'
    g.beginPath()
    g.moveTo(760, wy + 50)
    g.lineTo(760, wy - 10)
    g.arc(800, wy - 10, 40, Math.PI, 0)
    g.lineTo(840, wy + 50)
    g.fill()
    g.fillStyle = '#65a30d'
    g.fillRect(X0, wy + 60, FW, FH)
    // Side gates.
    for (const sp of arena.spawns.filter((s) => s.y >= b.y0 + 40)) {
      g.fillStyle = '#78716c'
      g.fillRect(sp.x < 800 ? b.x0 - 50 : b.x1, sp.y - 60, 50, 120)
      g.fillStyle = '#3f2d1d'
      g.fillRect(sp.x < 800 ? b.x0 - 40 : b.x1 + 10, sp.y - 40, 30, 80)
    }
    for (const o of arena.obstacles) {
      if (o.kind === 'wall') {
        ell(g, o.x + 10, o.y + 16, o.r * 1.1, o.r * 0.5, 'rgba(0,0,0,0.25)')
        g.fillStyle = '#a0703f'
        g.fillRect(o.x - o.r, o.y - o.r * 1.4, o.r * 2, o.r * 1.9)
        g.fillStyle = '#c69c6d'
        g.fillRect(o.x - o.r - 4, o.y - o.r * 1.6, o.r * 2 + 8, 16)
      } else rock(g, o.x, o.y, o.r, '#a8a29e', '#d6d3d1')
    }
  } else {
    // Volcanic Citadel: black rock, lava beyond the edges.
    g.fillStyle = '#7c2d12'
    g.fillRect(X0, Y0, FW, FH)
    const lava = g.createRadialGradient(WORLD_W / 2, WORLD_H / 2, 400, WORLD_W / 2, WORLD_H / 2, 1300)
    lava.addColorStop(0, '#f97316')
    lava.addColorStop(1, '#b91c1c')
    g.fillStyle = lava
    g.fillRect(X0, Y0, FW, FH)
    // Cliffs around the plateau.
    for (let k = 0; k < 80; k++) {
      const x = X0 + rand() * FW
      const y = Y0 + rand() * FH
      if (x > b.x0 - 70 && x < b.x1 + 70 && y > b.y0 - 70 && y < b.y1 + 70) continue
      rock(g, x, y, 40 + rand() * 60, '#292524', '#44403c')
    }
    // The plateau.
    poly(g, [[b.x0 - 50, b.y0 - 30], [b.x1 + 40, b.y0 - 50], [b.x1 + 60, b.y1 + 40], [b.x0 - 40, b.y1 + 60]], '#1c1917')
    g.fillStyle = '#292524'
    g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)
    for (let k = 0; k < 60; k++) blob(g, b.x0 + rand() * (b.x1 - b.x0), b.y0 + rand() * (b.y1 - b.y0), 20 + rand() * 50, rand() < 0.5 ? 'rgba(68,64,60,0.6)' : 'rgba(12,10,9,0.35)', rand, 6)
    // Glowing veins.
    for (let k = 0; k < 11; k++) {
      const vein: [number, number][] = []
      let x = b.x0 + rand() * (b.x1 - b.x0)
      let y = b.y0 + rand() * (b.y1 - b.y0)
      for (let s = 0; s < 6; s++) {
        vein.push([x, y])
        x += (rand() - 0.5) * 140
        y += (rand() - 0.5) * 110
      }
      spec.lavaVeins.push(vein)
      g.strokeStyle = '#7c2d12'
      g.lineWidth = 7
      g.beginPath()
      vein.forEach(([vx, vy], i) => (i ? g.lineTo(vx, vy) : g.moveTo(vx, vy)))
      g.stroke()
    }
    // The citadel's spires at the north.
    const cx = (b.x0 + b.x1) / 2
    for (const [dx, h] of [[-220, 170], [-110, 230], [0, 300], [110, 230], [220, 170]] as [number, number][]) {
      poly(g, [[cx + dx - 45, b.y0 - 20], [cx + dx + 45, b.y0 - 20], [cx + dx + 18, b.y0 - 20 - h], [cx + dx, b.y0 - 40 - h], [cx + dx - 18, b.y0 - 20 - h]], '#1c1917', '#57534e', 2)
      ell(g, cx + dx, b.y0 - 40 - h * 0.6, 7, 11, '#f97316')
    }
    // Vents where enemies climb up.
    for (const sp of arena.spawns) {
      ell(g, sp.x, sp.y, 44, 22, '#0c0a09')
      ell(g, sp.x, sp.y, 30, 14, '#7c2d12')
    }
    for (const o of arena.obstacles) {
      ell(g, o.x + 10, o.y + 18, o.r * 1.1, o.r * 0.5, 'rgba(0,0,0,0.4)')
      poly(g, [[o.x - o.r, o.y + o.r * 0.4], [o.x - o.r * 0.55, o.y - o.r * 1.6], [o.x + o.r * 0.1, o.y - o.r * 2.3], [o.x + o.r * 0.6, o.y - o.r * 1.4], [o.x + o.r, o.y + o.r * 0.4]], '#0c0a09', '#6d28d9', 2)
      poly(g, [[o.x - o.r * 0.3, o.y - o.r * 1.3], [o.x + o.r * 0.1, o.y - o.r * 2.1], [o.x + o.r * 0.3, o.y - o.r * 1.2]], '#4c1d95')
    }
  }
  // A crisp edge on the playable area in every arena.
  g.strokeStyle = 'rgba(0,0,0,0.22)'
  g.lineWidth = 6
  g.strokeRect(b.x0 - 3, b.y0 - 3, b.x1 - b.x0 + 6, b.y1 - b.y0 + 6)
  return spec
}

// --- Per-frame ambient layer --------------------------------------------

export interface AmbientState {
  motes: { x: number; y: number; s: number; p: number }[]
}

export function createAmbient(arena: Arena, reduced: boolean): AmbientState {
  const rand = mulberry32(seedFromString(`amb:${arena.id}`))
  const n = reduced ? 0 : arena.id === 'forest' ? 26 : arena.id === 'volcano' ? 36 : 16
  return { motes: Array.from({ length: n }, () => ({ x: -MARGIN + rand() * (WORLD_W + MARGIN * 2), y: -MARGIN + rand() * (WORLD_H + MARGIN * 2), s: 0.5 + rand(), p: rand() * 10 })) }
}

export function drawHazards(g: Ctx, arena: Arena, hazards: Hazard[], t: number, reduced: boolean) {
  for (let i = 0; i < hazards.length; i++) {
    const h = hazards[i]
    const shadowPool = i >= arena.hazards.length
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3 + i)
    if (shadowPool) {
      ell(g, h.x, h.y, h.r * 1.15, h.r * 0.95, `rgba(76,5,25,${0.35 + 0.15 * pulse})`)
      ell(g, h.x, h.y, h.r, h.r * 0.82, '#3b0764')
      g.strokeStyle = `rgba(244,63,94,${0.55 + 0.35 * pulse})`
      g.lineWidth = 3
      for (let k = 0; k < 3; k++) {
        g.beginPath()
        g.ellipse(h.x, h.y, h.r * (0.3 + k * 0.25), h.r * (0.25 + k * 0.2), 0, t * (k % 2 ? -1.5 : 1.5) + k, t * (k % 2 ? -1.5 : 1.5) + k + Math.PI * 1.2)
        g.stroke()
      }
    } else {
      ell(g, h.x, h.y, h.r * 1.15, h.r * 0.95, `rgba(251,146,60,${0.3 + 0.2 * pulse})`)
      ell(g, h.x, h.y, h.r, h.r * 0.82, '#ea580c')
      ell(g, h.x - h.r * 0.2, h.y - h.r * 0.1, h.r * 0.6, h.r * 0.45, '#fb923c')
      if (!reduced) for (let k = 0; k < 3; k++) {
        const ph = (t * 0.8 + k / 3) % 1
        ell(g, h.x + Math.cos(k * 2.1) * h.r * 0.5, h.y + Math.sin(k * 2.1) * h.r * 0.35, 6 * (1 - ph) + 2, 6 * (1 - ph) + 2, `rgba(254,215,170,${1 - ph})`)
      }
    }
  }
}

export function drawAmbient(g: Ctx, arena: Arena, spec: AmbientSpec, amb: AmbientState, t: number, reduced: boolean) {
  // Lamp flames.
  for (const lp of spec.lamps) {
    const fl = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 13 + lp.x) + 0.08 * Math.sin(t * 29 + lp.y)
    ell(g, lp.x, lp.y, 36 * fl, 30 * fl, `rgba(253,186,116,${0.22 * fl})`)
    ell(g, lp.x, lp.y, 6, 11 * fl, '#f97316')
    ell(g, lp.x, lp.y + 2, 3, 6 * fl, '#fde68a')
  }
  // Flowing river.
  if (spec.water) {
    g.strokeStyle = 'rgba(255,255,255,0.45)'
    g.lineWidth = 3
    g.setLineDash([26, 60])
    for (let k = 0; k < 5; k++) {
      const y = spec.water.y0 + ((k + 0.5) / 5) * (spec.water.y1 - spec.water.y0)
      g.lineDashOffset = reduced ? 0 : -t * (60 + k * 12)
      g.beginPath()
      g.moveTo(-MARGIN, y)
      g.lineTo(WORLD_W + MARGIN, y + Math.sin(k) * 6)
      g.stroke()
    }
    g.setLineDash([])
    g.lineDashOffset = 0
  }
  // Glowing lava veins.
  if (spec.lavaVeins.length) {
    const pulse = reduced ? 0.7 : 0.6 + 0.4 * Math.sin(t * 2)
    g.strokeStyle = `rgba(249,115,22,${0.55 + 0.35 * pulse})`
    g.lineWidth = 3.5
    for (const v of spec.lavaVeins) {
      g.beginPath()
      v.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
      g.stroke()
    }
  }
  if (reduced) return
  for (const m of amb.motes) {
    if (arena.id === 'forest') {
      // Fireflies.
      const x = m.x + Math.sin(t * 0.7 * m.s + m.p) * 40
      const y = m.y + Math.cos(t * 0.9 * m.s + m.p) * 30
      const a = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2.5 * m.s + m.p))
      ell(g, x, y, 9, 9, `rgba(254,240,138,${0.18 * a})`)
      ell(g, x, y, 2.5, 2.5, `rgba(254,249,195,${a})`)
    } else if (arena.id === 'volcano') {
      // Rising embers.
      const span = WORLD_H + MARGIN * 2
      const y = ((m.y + MARGIN - t * 40 * m.s) % span + span) % span - MARGIN
      const x = m.x + Math.sin(t * 1.5 + m.p) * 20
      ell(g, x, y, 2.5 * m.s, 2.5 * m.s, `rgba(253,186,116,${0.5 + 0.4 * Math.sin(t * 6 + m.p)})`)
    } else {
      // Drifting petals / pollen.
      const span = WORLD_W + MARGIN * 2
      const x = ((m.x + MARGIN + t * 22 * m.s) % span + span) % span - MARGIN
      const y = m.y + Math.sin(t * 1.2 + m.p) * 26
      g.save()
      g.translate(x, y)
      g.rotate(t * m.s + m.p)
      ell(g, 0, 0, 5, 2.6, arena.id === 'temple' ? 'rgba(249,115,22,0.8)' : 'rgba(255,255,255,0.7)')
      g.restore()
    }
  }
}
