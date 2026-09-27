import { BOX_DEPTH, type SceneryKind, type TrackTheme } from '@/lib/gameRoomV2/racing3d'

// Procedural art for Tamil Grand Prix: every roadside piece and car is
// drawn ONCE into an offscreen canvas (an atlas entry), then the renderer
// only scales and blits it -- fast enough for hundreds of pieces a frame
// on a phone. Original shapes; no external images.
//
// Style: clean illustrated arcade -- flat colour with one shade and one
// highlight tone, a soft dark outline, no photographic texture.

export interface SpriteArt {
  canvas: HTMLCanvasElement
  // World size in road units (the road's half-width is 2000).
  worldW: number
  worldH: number
  // Solid blocks: the side wall facing the road -- its colours and its
  // height as a share of the sprite's (eaves, not the roof's peak).
  wall?: { face: string; trim: string; window: string | null; height: number }
}

const mk = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, g: c.getContext('2d') as CanvasRenderingContext2D }
}

// World sizes (width, height) of each kind.
const SIZE: Record<SceneryKind, [number, number]> = {
  palm: [900, 2700], tree: [1500, 2300], banyan: [2600, 2600], pine: [900, 2600], bamboo: [500, 2600], bush: [900, 600], rock: [1100, 800],
  building: [3400, 4200], tallBuilding: [2800, 7200], shop: [2400, 2200], streetlamp: [300, 2200], neon: [1600, 1300], billboard: [2200, 1900],
  hut: [2200, 1700], haystack: [1100, 1000], paddy: [2600, 350], gopuram: [3000, 6200], mandapam: [3000, 2400], flag: [300, 1900],
  lighthouse: [1200, 5200], boat: [2000, 1100], waveRock: [1500, 700], waterfall: [4200, 4800], fence: [2000, 500], crowd: [3000, 1100],
  lantern: [260, 1500], sign: [700, 1200], house: [2400, 2000], teaStall: [1800, 1500], busStop: [1600, 1300], chevron: [480, 700],
}

// Art variants per kind (the road picks one per piece).
const VARIANTS: Partial<Record<SceneryKind, number>> = {
  building: 4, tallBuilding: 4, shop: 4, house: 4, neon: 4, billboard: 4, flag: 3, sign: 4, chevron: 2, tree: 3, palm: 2, teaStall: 2, hut: 2, bush: 2,
}
export const variantsOf = (kind: SceneryKind) => VARIANTS[kind] ?? 1

const TAMIL_LETTERS = ['அ', 'ஆ', 'இ', 'க', 'த', 'ம', 'ழ', 'வ']
const INK = '#2b2a35'
const INK_NIGHT = '#05060d'

// Mix two #rrggbb colours (t = 0 -> a, 1 -> b).
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t)
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`
}
const darker = (c: string, t = 0.22) => mixHex(c, '#101018', t)
const lighter = (c: string, t = 0.3) => mixHex(c, '#ffffff', t)

interface Pen {
  g: CanvasRenderingContext2D
  W: number
  H: number
  night: boolean
  line: number
}

function rect(p: Pen, x: number, y: number, w: number, h: number, fill: string, stroke = true) {
  const { g } = p
  g.fillStyle = fill
  g.fillRect(x, y, w, h)
  if (stroke) {
    g.lineWidth = p.line
    g.strokeStyle = p.night ? INK_NIGHT : INK
    g.strokeRect(x, y, w, h)
  }
}

function blob(p: Pen, x: number, y: number, r: number, fill: string, stroke = false) {
  const { g } = p
  g.fillStyle = fill
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
  if (stroke) {
    g.lineWidth = p.line
    g.strokeStyle = p.night ? INK_NIGHT : INK
    g.stroke()
  }
}

function shape(p: Pen, pts: number[], fill: string, stroke = true) {
  const { g } = p
  g.fillStyle = fill
  g.beginPath()
  g.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
  g.closePath()
  g.fill()
  if (stroke) {
    g.lineWidth = p.line
    g.lineJoin = 'round'
    g.strokeStyle = p.night ? INK_NIGHT : INK
    g.stroke()
  }
}

function groundShadow(p: Pen, cx: number, rx: number) {
  const { g, H } = p
  g.fillStyle = 'rgba(0,0,0,0.22)'
  g.beginPath()
  g.ellipse(cx, H - 1, rx, Math.max(2, H * 0.025), 0, 0, Math.PI * 2)
  g.fill()
}

function text(p: Pen, s: string, x: number, y: number, size: number, color: string, weight = 900) {
  const { g } = p
  g.fillStyle = color
  g.font = `${weight} ${size}px "Noto Sans Tamil", sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(s, x, y)
}

// A window: frame, glass, and (by day) a glint; lit at night.
function windowPane(p: Pen, x: number, y: number, w: number, h: number, glass: string, lit: boolean, shutter?: string) {
  rect(p, x, y, w, h, p.night ? (lit ? '#fde68a' : '#1e293b') : glass)
  if (!p.night) {
    p.g.fillStyle = 'rgba(255,255,255,0.45)'
    p.g.beginPath()
    p.g.moveTo(x + w * 0.12, y + h * 0.85)
    p.g.lineTo(x + w * 0.45, y + h * 0.12)
    p.g.lineTo(x + w * 0.62, y + h * 0.12)
    p.g.lineTo(x + w * 0.29, y + h * 0.85)
    p.g.fill()
  }
  if (shutter) {
    rect(p, x - w * 0.34, y, w * 0.3, h, shutter)
    rect(p, x + w * 1.04, y, w * 0.3, h, shutter)
  }
}

const WALLS_DAY = ['#f6c89f', '#fde68a', '#bfdbfe', '#fbcfe8', '#bbf7d0', '#e9d5ff', '#fed7aa', '#a7f3d0']
const WALLS_NIGHT = ['#334155', '#3b3561', '#44403c', '#1e3a5f', '#3f3f46', '#4c1d95', '#374151', '#134e4a']
const SHOP_SIGNS = ['கடை', 'உணவகம்', 'பூக்கடை', 'மருந்தகம்']
const ACCENTS = ['#dc2626', '#0d9488', '#ea580c', '#7c3aed', '#2563eb', '#16a34a']

function drawBuilding(p: Pen, kind: SceneryKind, variant: number): SpriteArt['wall'] {
  const { g, W, H, night } = p
  const wall = (night ? WALLS_NIGHT : WALLS_DAY)[(variant * 3 + (kind === 'tallBuilding' ? 1 : 0)) % 8]
  const trim = night ? '#0f172a' : '#fffaf0'
  const glass = variant % 2 ? '#7dd3fc' : '#60a5fa'
  const lit = (r: number, c: number) => (r * 7 + c * 3 + variant) % 3 === 0
  const shade = darker(wall, 0.18)
  if (kind === 'tallBuilding') {
    const top = H * 0.06
    // Stepped crown.
    rect(p, W * 0.18, H * 0.015, W * 0.64, top, shade)
    rect(p, W * 0.04, top, W * 0.92, H - top, variant === 0 ? (night ? '#1e3a5f' : '#93c5fd') : wall)
    if (variant === 2) rect(p, W * 0.48, 0, W * 0.04, H * 0.02, INK)
    const rows = 14
    const cols = variant === 0 ? 6 : 4
    for (let r = 0; r < rows; r++) {
      const y = top + H * 0.03 + r * ((H - top - H * 0.08) / rows)
      const rh = ((H - top - H * 0.08) / rows) * 0.62
      if (variant === 0) {
        // Curtain wall: one continuous glass band per floor.
        rect(p, W * 0.08, y, W * 0.84, rh, night ? (r % 3 ? '#1e293b' : '#fde68a') : r % 2 ? '#bae6fd' : '#7dd3fc')
        continue
      }
      for (let c = 0; c < cols; c++) {
        const cw = (W * 0.8) / cols
        windowPane(p, W * 0.1 + c * cw + cw * 0.15, y, cw * 0.7, rh, glass, lit(r, c))
      }
      if (variant === 1 && r % 2 === 0) rect(p, W * 0.06, y + rh, W * 0.88, rh * 0.18, trim)
      if (variant === 3 && r % 4 === 3) rect(p, W * 0.04, y + rh * 1.05, W * 0.92, rh * 0.3, ACCENTS[variant % ACCENTS.length])
    }
    rect(p, W * 0.38, H - H * 0.05, W * 0.24, H * 0.05, night ? '#fde68a' : '#334155')
    return { face: shade, trim: darker(wall, 0.3), window: night ? '#fde68a' : glass, height: 0.94 }
  }
  if (kind === 'shop') {
    const accent = ACCENTS[(variant * 2 + 1) % ACCENTS.length]
    rect(p, 0, H * 0.08, W, H * 0.92, wall)
    // Parapet with a little pediment.
    rect(p, 0, H * 0.04, W, H * 0.07, shade)
    shape(p, [W * 0.38, H * 0.04, W * 0.5, 0, W * 0.62, H * 0.04], shade)
    // Upper floor windows with sunshades.
    for (let c = 0; c < 3; c++) {
      const x = W * (0.1 + c * 0.3)
      windowPane(p, x, H * 0.18, W * 0.2, H * 0.16, glass, lit(0, c))
      rect(p, x - W * 0.02, H * 0.16, W * 0.24, H * 0.03, trim)
    }
    // Signboard.
    rect(p, W * 0.03, H * 0.38, W * 0.94, H * 0.14, accent)
    text(p, SHOP_SIGNS[variant % SHOP_SIGNS.length], W / 2, H * 0.455, H * 0.09, '#fff')
    // Striped awning.
    for (let i = 0; i < 8; i++) shape(p, [W * (i / 8), H * 0.52, W * ((i + 1) / 8), H * 0.52, W * ((i + 1) / 8) + W * 0.01, H * 0.6, W * (i / 8) + W * 0.01, H * 0.6], i % 2 ? '#fff' : accent, false)
    g.strokeStyle = night ? INK_NIGHT : INK
    g.lineWidth = p.line
    g.strokeRect(0, H * 0.52, W, H * 0.08)
    // Shopfront: display window, open door, goods.
    rect(p, W * 0.06, H * 0.64, W * 0.5, H * 0.26, night ? '#fef3c7' : '#e0f2fe')
    for (let i = 0; i < 5; i++) blob(p, W * (0.12 + i * 0.1), H * 0.84, W * 0.035, ACCENTS[(i + variant) % ACCENTS.length])
    rect(p, W * 0.64, H * 0.62, W * 0.26, H * 0.38, night ? '#fbbf24' : '#78350f')
    rect(p, W * 0.66, H * 0.64, W * 0.1, H * 0.36, night ? '#fde68a' : '#92400e', false)
    return { face: shade, trim: accent, window: night ? '#fde68a' : glass, height: 0.92 }
  }
  // building
  const floors = 4
  rect(p, 0, H * 0.1, W, H * 0.9, wall)
  // Roof: parapet, and the black water tank every Chennai roof has.
  rect(p, 0, H * 0.07, W, H * 0.04, shade)
  if (variant !== 2) {
    rect(p, W * (0.62 - (variant % 2) * 0.4), H * 0.015, W * 0.18, H * 0.055, night ? '#111827' : '#1f2937')
    rect(p, W * (0.64 - (variant % 2) * 0.4), H * 0.005, W * 0.14, H * 0.012, '#374151')
  } else {
    // Office: sign on the roof.
    rect(p, W * 0.2, H * 0.0, W * 0.6, H * 0.06, ACCENTS[variant])
    text(p, 'தமிழ் அகம்', W / 2, H * 0.032, H * 0.036, '#fff')
  }
  const fh = (H * 0.72) / floors
  for (let f = 0; f < floors; f++) {
    const y = H * 0.14 + f * fh
    if (variant === 2) {
      for (let c = 0; c < 5; c++) rect(p, W * (0.06 + c * 0.18), y, W * 0.16, fh * 0.7, night ? (lit(f, c) ? '#fde68a' : '#1e293b') : f % 2 ? '#bae6fd' : '#93c5fd')
      continue
    }
    for (let c = 0; c < 3; c++) {
      const x = W * (0.1 + c * 0.3)
      if (variant === 3) {
        // Arched colonial windows.
        const ww = W * 0.18
        g.fillStyle = night ? (lit(f, c) ? '#fde68a' : '#1e293b') : glass
        g.beginPath()
        g.moveTo(x, y + fh * 0.75)
        g.lineTo(x, y + fh * 0.3)
        g.arc(x + ww / 2, y + fh * 0.3, ww / 2, Math.PI, 0)
        g.lineTo(x + ww, y + fh * 0.75)
        g.closePath()
        g.fill()
        g.strokeStyle = night ? INK_NIGHT : INK
        g.lineWidth = p.line
        g.stroke()
      } else windowPane(p, x + W * 0.02, y + fh * 0.12, W * 0.16, fh * 0.52, glass, lit(f, c), variant === 1 ? ACCENTS[(c + f) % ACCENTS.length] : undefined)
    }
    if (variant === 0) {
      // Balcony slab and railing.
      rect(p, W * 0.04, y + fh * 0.7, W * 0.92, fh * 0.07, trim)
      g.fillStyle = night ? '#0f172a' : '#475569'
      for (let i = 0; i < 16; i++) g.fillRect(W * (0.06 + i * 0.056), y + fh * 0.52, Math.max(1, W * 0.008), fh * 0.18)
      g.fillRect(W * 0.05, y + fh * 0.5, W * 0.9, Math.max(1, fh * 0.03))
    } else {
      rect(p, 0, y + fh * 0.82, W, fh * 0.06, shade, false)
    }
  }
  // Ground floor: door, and a little shop sign on some.
  rect(p, W * 0.4, H * 0.86, W * 0.2, H * 0.14, night ? '#fbbf24' : '#7c2d12')
  if (variant === 1) {
    rect(p, W * 0.06, H * 0.87, W * 0.28, H * 0.06, ACCENTS[variant + 2])
    text(p, 'கடை', W * 0.2, H * 0.9, H * 0.035, '#fff')
  }
  return { face: shade, trim: darker(wall, 0.32), window: night ? '#fde68a' : glass, height: 0.9 }
}

function drawHouse(p: Pen, variant: number): SpriteArt['wall'] {
  const { g, W, H, night } = p
  const wall = (night ? WALLS_NIGHT : ['#fef3c7', '#fde2e4', '#dcfce7', '#e0f2fe'])[variant % 4]
  const roof = night ? '#431407' : ['#c2410c', '#b91c1c', '#9a3412', '#a16207'][variant % 4]
  // Sloped tile roof with an overhang.
  shape(p, [0, H * 0.42, W * 0.14, H * 0.12, W * 0.86, H * 0.12, W, H * 0.42], roof)
  g.strokeStyle = darker(roof, 0.3)
  g.lineWidth = Math.max(1, p.line * 0.6)
  for (let i = 1; i < 6; i++) {
    g.beginPath()
    g.moveTo(W * 0.04, H * (0.12 + i * 0.05))
    g.lineTo(W * 0.96, H * (0.12 + i * 0.05))
    g.stroke()
  }
  rect(p, W * 0.06, H * 0.42, W * 0.88, H * 0.58, wall)
  // Veranda (thinnai) with pillars.
  rect(p, W * 0.06, H * 0.88, W * 0.88, H * 0.12, darker(wall, 0.12))
  for (let i = 0; i < 4; i++) rect(p, W * (0.1 + i * 0.26), H * 0.46, W * 0.04, H * 0.42, night ? '#78716c' : '#fafaf9')
  // Door and windows.
  rect(p, W * 0.42, H * 0.56, W * 0.16, H * 0.32, night ? '#fbbf24' : '#92400e')
  windowPane(p, W * 0.18, H * 0.58, W * 0.14, H * 0.14, '#7dd3fc', variant % 2 === 0, night ? undefined : '#0d9488')
  windowPane(p, W * 0.68, H * 0.58, W * 0.14, H * 0.14, '#7dd3fc', variant % 2 === 1, night ? undefined : '#0d9488')
  // Kolam at the door.
  if (!night) {
    g.strokeStyle = '#fff'
    g.lineWidth = Math.max(1, W * 0.006)
    g.beginPath()
    g.ellipse(W * 0.5, H * 0.96, W * 0.1, H * 0.018, 0, 0, Math.PI * 2)
    g.stroke()
  }
  return { face: darker(wall, 0.18), trim: roof, window: night ? '#fde68a' : '#7dd3fc', height: 0.56 }
}

function drawTree(p: Pen, kind: 'tree' | 'banyan', variant: number) {
  const { g, W, H, night } = p
  groundShadow(p, W * 0.5, W * 0.36)
  const bark = night ? '#2a1b0e' : '#7c4a26'
  const greens = night ? ['#14532d', '#166534', '#15803d'] : variant === 1 ? ['#15803d', '#22c55e', '#86efac'] : variant === 2 ? ['#3f6212', '#65a30d', '#a3e635'] : ['#166534', '#16a34a', '#4ade80']
  if (kind === 'banyan') {
    g.strokeStyle = night ? '#2a1b0e' : '#8b6a4a'
    g.lineWidth = Math.max(1, W * 0.012)
    for (let i = 0; i < 11; i++) {
      const x = W * (0.12 + i * 0.075)
      g.beginPath()
      g.moveTo(x, H * 0.36)
      g.quadraticCurveTo(x + W * 0.02, H * 0.7, x + W * 0.005, H)
      g.stroke()
    }
  }
  shape(p, [W * 0.44, H, W * 0.47, H * 0.45, W * 0.53, H * 0.45, W * 0.56, H], bark)
  const blobs = kind === 'banyan' ? [[0.22, 0.28, 0.2], [0.42, 0.18, 0.22], [0.62, 0.2, 0.22], [0.8, 0.3, 0.18], [0.32, 0.36, 0.2], [0.55, 0.34, 0.22], [0.72, 0.4, 0.16]] : [[0.3, 0.34, 0.24], [0.52, 0.2, 0.28], [0.7, 0.36, 0.24], [0.5, 0.42, 0.26]]
  // Outline pass, then shade and body, then highlights: a clean cartoon canopy.
  for (const [x, y, r] of blobs) blob(p, W * x, H * y, W * r + p.line, night ? INK_NIGHT : INK)
  for (const [x, y, r] of blobs) blob(p, W * x, H * y, W * r, greens[0])
  for (const [x, y, r] of blobs) blob(p, W * x - W * r * 0.12, H * y - W * r * 0.12, W * r * 0.82, greens[1])
  for (const [x, y, r] of blobs.slice(0, 3)) blob(p, W * x - W * r * 0.35, H * y - W * r * 0.35, W * r * 0.32, greens[2])
}

function drawPalm(p: Pen, variant: number) {
  const { g, W, H, night } = p
  groundShadow(p, W * 0.5, W * 0.3)
  const lean = variant ? -0.1 : 0.12
  g.lineCap = 'round'
  g.strokeStyle = night ? INK_NIGHT : INK
  g.lineWidth = W * 0.11
  g.beginPath()
  g.moveTo(W * 0.5, H)
  g.quadraticCurveTo(W * (0.5 + lean * 1.4), H * 0.55, W * (0.5 + lean), H * 0.2)
  g.stroke()
  g.strokeStyle = night ? '#3b2a1a' : '#a16207'
  g.lineWidth = W * 0.08
  g.stroke()
  g.strokeStyle = night ? '#2a1b0e' : '#854d0e'
  g.lineWidth = Math.max(1, W * 0.012)
  for (let i = 1; i < 12; i++) {
    const t = i / 12
    const y = H - (H - H * 0.2) * t
    const x = W * 0.5 + (W * lean) * (1.4 * 2 * t * (1 - t) + t * t)
    g.beginPath()
    g.moveTo(x - W * 0.04, y)
    g.lineTo(x + W * 0.04, y)
    g.stroke()
  }
  const cx = W * (0.5 + lean)
  const cy = H * 0.2
  const leaf = night ? '#14532d' : '#16a34a'
  const leafLight = night ? '#166534' : '#4ade80'
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI + (i / 7) * Math.PI + (i % 2 ? 0.15 : -0.15)
    const len = W * (0.46 + (i % 3) * 0.04)
    const ex = cx + Math.cos(a) * len
    const ey = cy + Math.sin(a) * len * 0.5 + H * 0.06
    g.fillStyle = i % 2 ? leaf : leafLight
    g.strokeStyle = night ? INK_NIGHT : INK
    g.lineWidth = Math.max(1, p.line * 0.8)
    g.beginPath()
    g.moveTo(cx, cy)
    g.quadraticCurveTo((cx + ex) / 2 + Math.sin(a) * W * 0.08, (cy + ey) / 2 - H * 0.05, ex, ey)
    g.quadraticCurveTo((cx + ex) / 2, (cy + ey) / 2 + H * 0.01, cx, cy)
    g.fill()
    g.stroke()
  }
  for (let i = 0; i < 3; i++) blob(p, cx + W * (i - 1) * 0.06, cy + H * 0.02, W * 0.05, night ? '#422006' : '#92400e', true)
}

function draw(kind: SceneryKind, g: CanvasRenderingContext2D, W: number, H: number, theme: TrackTheme, variant: number): SpriteArt['wall'] {
  const night = !!theme.night
  const p: Pen = { g, W, H, night, line: Math.max(1.5, Math.min(W, H) * 0.018) }
  const shade = (c: string, dark: string) => (night ? dark : c)
  g.lineJoin = 'round'
  switch (kind) {
    case 'palm':
      drawPalm(p, variant)
      break
    case 'tree':
    case 'banyan':
      drawTree(p, kind, variant)
      break
    case 'pine': {
      groundShadow(p, W * 0.5, W * 0.3)
      rect(p, W * 0.44, H * 0.8, W * 0.12, H * 0.2, shade('#5b3a1e', '#24170b'))
      for (let i = 0; i < 4; i++) {
        const y0 = H * (0.02 + i * 0.18)
        const spread = 0.2 + i * 0.08
        shape(p, [W * 0.5, y0, W * (0.5 - spread), H * (0.3 + i * 0.17), W * (0.5 + spread), H * (0.3 + i * 0.17)], shade(i % 2 ? '#15803d' : '#166534', '#0f3d22'))
        shape(p, [W * 0.5, y0 + H * 0.02, W * (0.5 - spread * 0.5), H * (0.27 + i * 0.17), W * 0.5, H * (0.27 + i * 0.17)], shade('#22c55e', '#14532d'), false)
      }
      break
    }
    case 'bamboo': {
      groundShadow(p, W * 0.5, W * 0.4)
      for (let i = 0; i < 3; i++) {
        const x = W * (0.16 + i * 0.26)
        rect(p, x, H * (0.05 + i * 0.05), W * 0.14, H, shade(i % 2 ? '#65a30d' : '#84cc16', '#365314'))
        g.fillStyle = shade('#3f6212', '#1a2e05')
        for (let k = 1; k < 8; k++) g.fillRect(x, H * (k / 8), W * 0.14, H * 0.012)
      }
      g.fillStyle = shade('#4d7c0f', '#1a2e05')
      for (let i = 0; i < 8; i++) {
        g.beginPath()
        g.ellipse(W * (0.1 + (i % 4) * 0.27), H * (0.1 + (i >> 2) * 0.2), W * 0.22, H * 0.022, (i - 3) * 0.4, 0, Math.PI * 2)
        g.fill()
      }
      break
    }
    case 'bush': {
      groundShadow(p, W * 0.5, W * 0.48)
      const base = shade(variant ? '#15803d' : '#16a34a', '#14532d')
      for (let i = 0; i < 4; i++) blob(p, W * (0.2 + i * 0.2), H * (0.55 - (i % 2) * 0.1), W * 0.2, base, true)
      rect(p, W * 0.04, H * 0.58, W * 0.92, H * 0.4, base, false)
      for (let i = 0; i < 4; i++) blob(p, W * (0.17 + i * 0.2), H * (0.48 - (i % 2) * 0.1), W * 0.08, shade('#4ade80', '#166534'))
      if (!night) for (let i = 0; i < 6; i++) blob(p, W * (0.12 + i * 0.15), H * (0.42 + (i % 3) * 0.12), W * 0.025, variant ? '#fde047' : '#f472b6')
      break
    }
    case 'rock':
    case 'waveRock': {
      groundShadow(p, W * 0.5, W * 0.46)
      shape(p, [W * 0.05, H, W * 0.18, H * 0.32, W * 0.52, H * 0.06, W * 0.86, H * 0.36, W * 0.97, H], shade('#78716c', '#292524'))
      shape(p, [W * 0.2, H * 0.34, W * 0.52, H * 0.08, W * 0.44, H * 0.6], shade('#a8a29e', '#44403c'), false)
      if (kind === 'waveRock') {
        g.fillStyle = 'rgba(255,255,255,0.9)'
        for (let i = 0; i < 6; i++) blob(p, W * (0.08 + i * 0.17), H * 0.92, W * 0.09, 'rgba(255,255,255,0.9)')
      }
      break
    }
    case 'building':
    case 'tallBuilding':
    case 'shop':
      return drawBuilding(p, kind, variant)
    case 'house':
      return drawHouse(p, variant)
    case 'teaStall': {
      groundShadow(p, W * 0.5, W * 0.48)
      const accent = variant ? '#0d9488' : '#dc2626'
      rect(p, W * 0.12, H * 0.42, W * 0.76, H * 0.58, shade('#fde68a', '#57534e'))
      for (let i = 0; i < 6; i++) shape(p, [W * (0.02 + i * 0.16), H * 0.26, W * (0.18 + i * 0.16), H * 0.26, W * (0.18 + i * 0.16), H * 0.42, W * (0.02 + i * 0.16), H * 0.42], i % 2 ? '#fff' : accent, false)
      g.strokeStyle = night ? INK_NIGHT : INK
      g.lineWidth = p.line
      g.strokeRect(W * 0.02, H * 0.26, W * 0.96, H * 0.16)
      rect(p, W * 0.24, H * 0.04, W * 0.52, H * 0.18, accent)
      text(p, variant ? 'காபி' : 'டீ', W / 2, H * 0.13, H * 0.11, '#fff')
      rect(p, W * 0.2, H * 0.62, W * 0.6, H * 0.08, night ? '#fbbf24' : '#92400e')
      for (let i = 0; i < 4; i++) blob(p, W * (0.3 + i * 0.13), H * 0.58, W * 0.04, ['#f8fafc', '#fbbf24', '#f8fafc', '#a3e635'][i], true)
      rect(p, W * 0.04, H * 0.82, W * 0.26, H * 0.05, shade('#78350f', '#292524'))
      break
    }
    case 'busStop': {
      groundShadow(p, W * 0.5, W * 0.48)
      rect(p, W * 0.04, H * 0.14, W * 0.92, H * 0.08, shade('#0f766e', '#134e4a'))
      rect(p, W * 0.08, H * 0.22, W * 0.03, H * 0.78, '#475569')
      rect(p, W * 0.89, H * 0.22, W * 0.03, H * 0.78, '#475569')
      rect(p, W * 0.14, H * 0.3, W * 0.72, H * 0.36, night ? 'rgba(125,211,252,0.35)' : 'rgba(186,230,253,0.7)')
      rect(p, W * 0.16, H * 0.74, W * 0.68, H * 0.06, shade('#b45309', '#422006'))
      rect(p, W * 0.42, 0, W * 0.16, H * 0.14, '#facc15')
      text(p, 'பஸ்', W / 2, H * 0.07, H * 0.07, INK)
      break
    }
    case 'streetlamp':
    case 'lantern': {
      groundShadow(p, W * 0.5, W * 0.4)
      rect(p, W * 0.42, H * 0.1, W * 0.16, H * 0.9, shade('#374151', '#111827'))
      rect(p, W * 0.34, H * 0.9, W * 0.32, H * 0.1, shade('#1f2937', '#0b0f19'))
      if (kind === 'streetlamp') rect(p, W * 0.1, H * 0.07, W * 0.8, H * 0.03, shade('#374151', '#111827'))
      blob(p, W * 0.5, H * 0.06, W * 0.4, kind === 'lantern' ? '#f97316' : night ? '#fef08a' : '#f1f5f9', true)
      break
    }
    case 'neon':
    case 'billboard': {
      rect(p, W * 0.2, H * 0.55, W * 0.06, H * 0.45, shade('#4b5563', '#111827'))
      rect(p, W * 0.74, H * 0.55, W * 0.06, H * 0.45, shade('#4b5563', '#111827'))
      const neon = kind === 'neon'
      const col = ['#f472b6', '#22d3ee', '#a3e635', '#facc15'][variant % 4]
      rect(p, W * 0.01, H * 0.01, W * 0.98, H * 0.58, neon ? '#0f172a' : ['#0d9488', '#f97316', '#7c3aed', '#dc2626'][variant % 4])
      if (neon) {
        g.strokeStyle = col
        g.lineWidth = W * 0.03
        g.strokeRect(W * 0.05, H * 0.05, W * 0.9, H * 0.5)
      } else {
        rect(p, W * 0.06, H * 0.06, W * 0.36, H * 0.48, lighter(['#0d9488', '#f97316', '#7c3aed', '#dc2626'][variant % 4], 0.35), false)
      }
      text(p, TAMIL_LETTERS[variant % TAMIL_LETTERS.length], neon ? W / 2 : W * 0.24, H * 0.3, H * 0.34, neon ? col : '#fff')
      if (!neon) text(p, ['படி!', 'விளையாடு!', 'வெல்!', 'ஓடு!'][variant % 4], W * 0.7, H * 0.3, H * 0.14, '#fff')
      break
    }
    case 'hut': {
      groundShadow(p, W * 0.5, W * 0.5)
      rect(p, W * 0.1, H * 0.45, W * 0.8, H * 0.55, shade(variant ? '#e7c28f' : '#d6a86b', '#57402a'))
      shape(p, [0, H * 0.52, W * 0.5, 0, W, H * 0.52], shade(variant ? '#ca8a04' : '#a16207', '#3f2a12'))
      g.strokeStyle = shade('#854d0e', '#24170b')
      g.lineWidth = Math.max(1, W * 0.006)
      for (let i = 1; i < 9; i++) {
        g.beginPath()
        g.moveTo(W * 0.5, H * 0.02)
        g.lineTo(W * (i / 9), H * 0.5)
        g.stroke()
      }
      rect(p, W * 0.42, H * 0.64, W * 0.16, H * 0.36, shade('#5b3a1e', '#fde047'))
      if (!night) {
        g.fillStyle = '#fff'
        for (let i = 0; i < 5; i++) g.fillRect(W * (0.12 + i * 0.16), H * 0.95, W * 0.06, H * 0.02)
      }
      return { face: shade('#b98a52', '#3f2e1e'), trim: shade('#a16207', '#3f2a12'), window: null, height: 0.5 }
    }
    case 'haystack': {
      groundShadow(p, W * 0.5, W * 0.46)
      g.fillStyle = shade('#eab308', '#713f12')
      g.strokeStyle = night ? INK_NIGHT : INK
      g.lineWidth = p.line
      g.beginPath()
      g.moveTo(W * 0.05, H)
      g.quadraticCurveTo(W * 0.5, -H * 0.3, W * 0.95, H)
      g.fill()
      g.stroke()
      g.strokeStyle = shade('#ca8a04', '#422006')
      g.lineWidth = W * 0.02
      for (let i = 0; i < 4; i++) {
        g.beginPath()
        g.moveTo(W * (0.2 + i * 0.2), H)
        g.lineTo(W * 0.5, H * 0.15)
        g.stroke()
      }
      break
    }
    case 'paddy': {
      g.fillStyle = shade('#65a30d', '#1a2e05')
      g.fillRect(0, H * 0.3, W, H * 0.7)
      g.strokeStyle = shade('#a3e635', '#365314')
      g.lineWidth = W * 0.006
      for (let i = 0; i < 40; i++) {
        const x = (i / 40) * W
        g.beginPath()
        g.moveTo(x, H)
        g.lineTo(x + W * 0.01, 0)
        g.stroke()
      }
      break
    }
    case 'gopuram': {
      const tiers = 7
      for (let i = 0; i < tiers; i++) {
        const t = i / tiers
        const bw = W * (0.9 - t * 0.62)
        const bh = H * (0.8 / tiers)
        const y = H - H * 0.12 - (i + 1) * bh
        rect(p, (W - bw) / 2, y, bw, bh, shade(i % 2 ? '#fbbf24' : '#f59e0b', i % 2 ? '#78350f' : '#57300b'))
        g.fillStyle = shade('#b45309', '#2a1605')
        for (let k = 0; k < 5; k++) g.fillRect((W - bw) / 2 + (bw / 5) * k + bw * 0.06, y + bh * 0.2, bw * 0.06, bh * 0.6)
        g.fillStyle = shade('#fde68a', '#92400e')
        g.fillRect((W - bw) / 2, y + bh * 0.02, bw, bh * 0.08)
      }
      rect(p, W * 0.05, H * 0.88, W * 0.9, H * 0.12, shade('#d97706', '#451a03'))
      rect(p, W * 0.4, H * 0.9, W * 0.2, H * 0.1, shade('#78350f', '#1c0a02'))
      blob(p, W * 0.5, H * 0.07, W * 0.07, '#facc15', true)
      g.fillStyle = '#facc15'
      g.fillRect(W * 0.48, 0, W * 0.04, H * 0.05)
      break
    }
    case 'mandapam': {
      groundShadow(p, W * 0.5, W * 0.5)
      rect(p, 0, H * 0.85, W, H * 0.15, shade('#d6d3d1', '#44403c'))
      rect(p, W * 0.02, H * 0.12, W * 0.96, H * 0.12, shade('#d6d3d1', '#44403c'))
      for (let i = 0; i < 6; i++) rect(p, W * (0.05 + i * 0.17), H * 0.24, W * 0.07, H * 0.61, shade('#e7e5e4', '#57534e'))
      shape(p, [0, H * 0.12, W * 0.5, 0, W, H * 0.12], shade('#a8a29e', '#292524'))
      return { face: shade('#b8b4ae', '#3a3633'), trim: shade('#a8a29e', '#292524'), window: null, height: 0.86 }
    }
    case 'flag': {
      rect(p, W * 0.44, 0, W * 0.12, H, shade('#57534e', '#1c1917'))
      shape(p, [W * 0.56, H * 0.02, W * 2, H * 0.1, W * 0.56, H * 0.2], ['#f97316', '#dc2626', '#facc15'][variant % 3])
      break
    }
    case 'lighthouse': {
      shape(p, [W * 0.25, H, W * 0.35, H * 0.2, W * 0.65, H * 0.2, W * 0.75, H], '#f8fafc')
      g.fillStyle = '#dc2626'
      for (let i = 0; i < 4; i++) g.fillRect(W * 0.28 + i * 0.012 * W, H * (0.3 + i * 0.18), W * (0.44 - i * 0.024), H * 0.08)
      rect(p, W * 0.3, H * 0.1, W * 0.4, H * 0.1, '#1f2937')
      rect(p, W * 0.36, H * 0.12, W * 0.28, H * 0.06, '#fde047', false)
      shape(p, [W * 0.28, H * 0.1, W * 0.5, 0, W * 0.72, H * 0.1], '#dc2626')
      break
    }
    case 'boat': {
      shape(p, [0, H * 0.6, W, H * 0.6, W * 0.85, H, W * 0.15, H], shade('#b45309', '#422006'))
      shape(p, [W * 0.5, 0, W * 0.5, H * 0.58, W * 0.85, H * 0.58], '#f8fafc')
      g.fillStyle = '#0f766e'
      g.fillRect(W * 0.48, 0, W * 0.03, H * 0.6)
      break
    }
    case 'waterfall': {
      rect(p, 0, 0, W * 0.3, H, shade('#57534e', '#1c1917'))
      rect(p, W * 0.7, 0, W * 0.3, H, shade('#57534e', '#1c1917'))
      g.fillStyle = '#bae6fd'
      g.fillRect(W * 0.3, 0, W * 0.4, H)
      g.strokeStyle = 'rgba(255,255,255,0.85)'
      g.lineWidth = W * 0.012
      for (let i = 0; i < 10; i++) {
        g.beginPath()
        g.moveTo(W * (0.32 + i * 0.04), 0)
        g.lineTo(W * (0.32 + i * 0.04), H)
        g.stroke()
      }
      g.fillStyle = 'rgba(255,255,255,0.92)'
      g.beginPath()
      g.ellipse(W * 0.5, H * 0.95, W * 0.35, H * 0.06, 0, 0, Math.PI * 2)
      g.fill()
      for (let i = 0; i < 6; i++) blob(p, W * (i < 3 ? 0.05 + i * 0.1 : 0.75 + (i - 3) * 0.1), H * 0.08, W * 0.1, shade('#15803d', '#14532d'), true)
      break
    }
    case 'fence': {
      const wood = shade('#a16207', '#422006')
      for (let i = 0; i < 6; i++) rect(p, W * (i / 5) * 0.95, 0, W * 0.04, H, wood)
      rect(p, 0, H * 0.25, W, H * 0.1, wood)
      rect(p, 0, H * 0.6, W, H * 0.1, wood)
      break
    }
    case 'crowd': {
      rect(p, 0, H * 0.55, W, H * 0.45, shade('#e7e5e4', '#1f2937'))
      const cols = ['#dc2626', '#f97316', '#0d9488', '#7c3aed', '#facc15', '#2563eb', '#16a34a']
      for (let i = 0; i < 18; i++) {
        const x = W * (0.03 + (i / 18) * 0.94)
        const y = H * (0.2 + (i % 3) * 0.1)
        g.fillStyle = cols[i % cols.length]
        g.fillRect(x - W * 0.018, y + H * 0.12, W * 0.036, H * 0.25)
        blob(p, x, y + H * 0.08, W * 0.017, '#7c4a2d')
        if (i % 4 === 0) {
          g.fillStyle = cols[(i + 3) % cols.length]
          g.fillRect(x + W * 0.012, y - H * 0.02, W * 0.008, H * 0.14)
        }
      }
      rect(p, W * 0.35, 0, W * 0.3, H * 0.18, '#0d9488')
      text(p, 'வா! வா!', W / 2, H * 0.095, H * 0.13, '#fff', 700)
      break
    }
    case 'sign': {
      // 0/1: bend warning (arrow shows the way the road goes); 2/3: info.
      rect(p, W * 0.45, H * 0.45, W * 0.1, H * 0.55, '#475569')
      if (variant < 2) {
        shape(p, [W * 0.5, 0, W * 0.98, H * 0.24, W * 0.5, H * 0.48, W * 0.02, H * 0.24], '#facc15')
        const d = variant === 1 ? 1 : -1
        g.strokeStyle = INK
        g.lineWidth = W * 0.08
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(W * 0.5 - d * W * 0.08, H * 0.38)
        g.lineTo(W * 0.5 - d * W * 0.08, H * 0.22)
        g.quadraticCurveTo(W * 0.5 - d * W * 0.08, H * 0.13, W * 0.5 + d * W * 0.08, H * 0.13)
        g.stroke()
        shape(p, [W * 0.5 + d * W * 0.26, H * 0.13, W * 0.5 + d * W * 0.06, H * 0.05, W * 0.5 + d * W * 0.06, H * 0.21], INK, false)
      } else {
        rect(p, W * 0.04, H * 0.04, W * 0.92, H * 0.42, variant === 2 ? '#0f766e' : '#1d4ed8')
        text(p, variant === 2 ? 'மெதுவாக' : 'பள்ளி', W / 2, H * 0.25, H * 0.12, '#fff', 800)
      }
      break
    }
    case 'chevron': {
      // Black and yellow bend marker; arrows point the way the road goes.
      rect(p, W * 0.12, H * 0.5, W * 0.08, H * 0.5, '#475569')
      rect(p, W * 0.8, H * 0.5, W * 0.08, H * 0.5, '#475569')
      rect(p, W * 0.02, H * 0.04, W * 0.96, H * 0.5, '#facc15')
      const d = variant === 1 ? 1 : -1
      for (let i = 0; i < 2; i++) {
        const cx = W * (0.5 + d * (i - 0.5) * 0.36)
        shape(p, [cx - d * W * 0.14, H * 0.1, cx + d * W * 0.08, H * 0.29, cx - d * W * 0.14, H * 0.48, cx - d * W * 0.03, H * 0.48, cx + d * W * 0.19, H * 0.29, cx - d * W * 0.03, H * 0.1], INK, false)
      }
      break
    }
  }
  return undefined
}

// Per-track atlas: a few variants per kind (colours, shapes, letters...).
export function buildAtlas(theme: TrackTheme): Map<string, SpriteArt> {
  const atlas = new Map<string, SpriteArt>()
  const kinds = Object.keys(SIZE) as SceneryKind[]
  for (const kind of kinds) {
    const [ww, wh] = SIZE[kind]
    const variants = variantsOf(kind)
    for (let v = 0; v < variants; v++) {
      // Texture resolution: ~0.09 px per world unit, capped.
      const pxW = Math.max(28, Math.min(320, Math.round(ww * 0.09)))
      const pxH = Math.max(28, Math.min(520, Math.round(wh * 0.09)))
      const { c, g } = mk(pxW, pxH)
      const wall = draw(kind, g, pxW, pxH, theme, v)
      atlas.set(`${kind}:${v}`, { canvas: c, worldW: ww, worldH: wh, wall: BOX_DEPTH[kind] ? wall : undefined })
    }
  }
  return atlas
}

// ---------------------------------------------------------------------------
// Cars, seen from behind and a little above. POSES frames per car, from
// turning hard left (0) through straight (middle) to hard right: the body
// shifts and shows its flank, the front wheels peek out, the cabin leans.
// Each pose also has a braking frame with bright tail lights.

export const CAR_POSES = 7
export interface CarArt {
  poses: HTMLCanvasElement[]
  brake: HTMLCanvasElement[]
}

function drawCar(g: CanvasRenderingContext2D, W: number, H: number, color: string, pose: number, braking: boolean, plate: string) {
  // pose: -1 (hard left) .. 1 (hard right)
  const body = color
  const bodyDark = darker(color, 0.28)
  const bodyLight = lighter(color, 0.35)
  const ink = INK
  const lw = Math.max(2, W * 0.012)
  const s = pose * W * 0.05 // cabin lean
  const flank = Math.abs(pose) * W * 0.09
  const side = Math.sign(pose)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  // Shadow.
  g.fillStyle = 'rgba(0,0,0,0.32)'
  g.beginPath()
  g.ellipse(W / 2 + s * 0.4, H * 0.93, W * 0.47, H * 0.075, 0, 0, Math.PI * 2)
  g.fill()
  // Rear tyres (and a front tyre peeking out on the turning side).
  const tyre = (x: number, w: number) => {
    g.fillStyle = '#111827'
    g.beginPath()
    g.roundRect(x, H * 0.64, w, H * 0.3, W * 0.03)
    g.fill()
    g.fillStyle = '#374151'
    g.fillRect(x + w * 0.2, H * 0.68, w * 0.6, H * 0.04)
  }
  if (pose !== 0) tyre(side > 0 ? W * 0.84 + flank * 0.2 : W * 0.02 - flank * 0.2, W * 0.13)
  tyre(W * 0.05, W * 0.15)
  tyre(W * 0.8, W * 0.15)
  // Flank (the side of the car shows when turning).
  if (pose !== 0) {
    g.fillStyle = bodyDark
    g.beginPath()
    if (side > 0) {
      g.moveTo(W * 0.92, H * 0.5)
      g.lineTo(W * 0.92 + flank, H * 0.52)
      g.lineTo(W * 0.92 + flank * 0.8, H * 0.84)
      g.lineTo(W * 0.9, H * 0.86)
    } else {
      g.moveTo(W * 0.08, H * 0.5)
      g.lineTo(W * 0.08 - flank, H * 0.52)
      g.lineTo(W * 0.08 - flank * 0.8, H * 0.84)
      g.lineTo(W * 0.1, H * 0.86)
    }
    g.closePath()
    g.fill()
    g.strokeStyle = ink
    g.lineWidth = lw
    g.stroke()
  }
  // Main body.
  g.fillStyle = body
  g.beginPath()
  g.moveTo(W * 0.1, H * 0.86)
  g.lineTo(W * 0.07, H * 0.56)
  g.quadraticCurveTo(W * 0.1, H * 0.45, W * 0.24 + s * 0.4, H * 0.42)
  g.lineTo(W * 0.76 + s * 0.4, H * 0.42)
  g.quadraticCurveTo(W * 0.9, H * 0.45, W * 0.93, H * 0.56)
  g.lineTo(W * 0.9, H * 0.86)
  g.closePath()
  g.fill()
  g.strokeStyle = ink
  g.lineWidth = lw
  g.stroke()
  // Cabin + rear window.
  g.fillStyle = bodyDark
  g.beginPath()
  g.moveTo(W * 0.27 + s * 0.6, H * 0.43)
  g.lineTo(W * 0.35 + s, H * 0.14)
  g.quadraticCurveTo(W * 0.5 + s, H * 0.09, W * 0.65 + s, H * 0.14)
  g.lineTo(W * 0.73 + s * 0.6, H * 0.43)
  g.closePath()
  g.fill()
  g.stroke()
  g.fillStyle = '#1e293b'
  g.beginPath()
  g.moveTo(W * 0.32 + s * 0.65, H * 0.4)
  g.lineTo(W * 0.38 + s, H * 0.18)
  g.quadraticCurveTo(W * 0.5 + s, H * 0.14, W * 0.62 + s, H * 0.18)
  g.lineTo(W * 0.68 + s * 0.65, H * 0.4)
  g.closePath()
  g.fill()
  // Glass reflection.
  g.fillStyle = 'rgba(255,255,255,0.28)'
  g.beginPath()
  g.moveTo(W * 0.4 + s, H * 0.19)
  g.lineTo(W * 0.47 + s, H * 0.17)
  g.lineTo(W * 0.4 + s * 0.8, H * 0.38)
  g.lineTo(W * 0.35 + s * 0.7, H * 0.38)
  g.closePath()
  g.fill()
  // Roof highlight and racing stripe.
  g.fillStyle = bodyLight
  g.fillRect(W * 0.4 + s, H * 0.11, W * 0.2, H * 0.025)
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.fillRect(W * 0.465 + s * 0.4, H * 0.44, W * 0.07, H * 0.4)
  // Spoiler.
  g.fillStyle = ink
  g.fillRect(W * 0.12 + s * 0.3, H * 0.4, W * 0.76, H * 0.045)
  g.fillRect(W * 0.2 + s * 0.3, H * 0.44, W * 0.03, H * 0.06)
  g.fillRect(W * 0.77 + s * 0.3, H * 0.44, W * 0.03, H * 0.06)
  // Tail lights, bright when braking.
  const tail = braking ? '#ff2d2d' : '#b91c1c'
  for (const x of [0.12, 0.73]) {
    g.fillStyle = tail
    g.beginPath()
    g.roundRect(W * x, H * 0.54, W * 0.15, H * 0.09, W * 0.02)
    g.fill()
    g.strokeStyle = ink
    g.lineWidth = lw * 0.7
    g.stroke()
    if (braking) {
      g.fillStyle = 'rgba(255,90,90,0.45)'
      g.beginPath()
      g.ellipse(W * (x + 0.075), H * 0.585, W * 0.12, H * 0.08, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#fee2e2'
      g.fillRect(W * (x + 0.03), H * 0.565, W * 0.09, H * 0.025)
    }
  }
  // Number plate, bumper, exhausts.
  g.fillStyle = '#fef9c3'
  g.fillRect(W * 0.41, H * 0.66, W * 0.18, H * 0.1)
  g.strokeStyle = ink
  g.lineWidth = lw * 0.6
  g.strokeRect(W * 0.41, H * 0.66, W * 0.18, H * 0.1)
  g.fillStyle = ink
  g.font = `900 ${H * 0.07}px "Noto Sans Tamil", sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(plate, W / 2, H * 0.715)
  g.fillStyle = bodyDark
  g.fillRect(W * 0.1, H * 0.8, W * 0.8, H * 0.06)
  g.fillStyle = '#6b7280'
  g.beginPath()
  g.ellipse(W * 0.3, H * 0.86, W * 0.025, H * 0.022, 0, 0, Math.PI * 2)
  g.ellipse(W * 0.7, H * 0.86, W * 0.025, H * 0.022, 0, 0, Math.PI * 2)
  g.fill()
}

export function buildCar(color: string, plate = 'த 1'): CarArt {
  const W = 260
  const H = 150
  const out: CarArt = { poses: [], brake: [] }
  for (let i = 0; i < CAR_POSES; i++) {
    const pose = (i - (CAR_POSES - 1) / 2) / ((CAR_POSES - 1) / 2)
    for (const braking of [false, true]) {
      const { c, g } = mk(W, H)
      drawCar(g, W, H, color, pose, braking, plate)
      ;(braking ? out.brake : out.poses).push(c)
    }
  }
  return out
}

export function buildCoin(): HTMLCanvasElement {
  const { c, g } = mk(64, 64)
  g.fillStyle = '#92400e'
  g.beginPath()
  g.arc(32, 32, 30, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#facc15'
  g.beginPath()
  g.arc(32, 32, 25, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#fef08a'
  g.beginPath()
  g.arc(27, 26, 10, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#92400e'
  g.font = '900 30px "Noto Sans Tamil", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('அ', 32, 34)
  return c
}
