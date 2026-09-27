import type { SceneryKind, TrackTheme } from '@/lib/gameRoomV2/racing3d'

// Procedural art for Tamil Grand Prix: every roadside piece and car is
// drawn ONCE into an offscreen canvas (an atlas entry), then the renderer
// only scales and blits it -- fast enough for hundreds of pieces a frame
// on a phone. Original shapes; no external images.

export interface SpriteArt {
  canvas: HTMLCanvasElement
  // World size in road units (the road's half-width is 2000).
  worldW: number
  worldH: number
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
  lantern: [260, 1500], sign: [700, 1200],
}

const TAMIL_LETTERS = ['அ', 'ஆ', 'இ', 'க', 'த', 'ம', 'ழ', 'வ']

function draw(kind: SceneryKind, g: CanvasRenderingContext2D, W: number, H: number, theme: TrackTheme, variant: number) {
  const night = !!theme.night
  const shade = (c: string, dark: string) => (night ? dark : c)
  switch (kind) {
    case 'palm': {
      g.strokeStyle = shade('#8b5a2b', '#3b2a1a')
      g.lineWidth = W * 0.09
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(W * 0.5, H)
      g.quadraticCurveTo(W * 0.62, H * 0.55, W * 0.52, H * 0.18)
      g.stroke()
      g.fillStyle = shade('#16a34a', '#14532d')
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2
        g.beginPath()
        g.ellipse(W * 0.52 + Math.cos(a) * W * 0.28, H * 0.18 + Math.sin(a) * H * 0.05, W * 0.3, H * 0.035, a, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = shade('#a16207', '#422006')
      for (let i = 0; i < 3; i++) {
        g.beginPath()
        g.arc(W * (0.46 + i * 0.05), H * 0.21, W * 0.05, 0, Math.PI * 2)
        g.fill()
      }
      break
    }
    case 'tree':
    case 'banyan': {
      g.fillStyle = shade('#6b4423', '#2a1b0e')
      g.fillRect(W * 0.44, H * 0.5, W * 0.12, H * 0.5)
      if (kind === 'banyan') {
        g.strokeStyle = shade('#7c5a3a', '#2a1b0e')
        g.lineWidth = W * 0.012
        for (let i = 0; i < 9; i++) {
          const x = W * (0.15 + i * 0.09)
          g.beginPath()
          g.moveTo(x, H * 0.4)
          g.lineTo(x + W * 0.01, H)
          g.stroke()
        }
      }
      const greens = night ? ['#14532d', '#166534', '#15803d'] : ['#15803d', '#16a34a', '#22c55e']
      const blobs = kind === 'banyan' ? 9 : 6
      for (let i = 0; i < blobs; i++) {
        g.fillStyle = greens[i % 3]
        const bx = W * (0.2 + ((i * 37) % 60) / 100)
        const by = H * (0.18 + ((i * 23) % 30) / 100)
        g.beginPath()
        g.arc(bx, by, W * (kind === 'banyan' ? 0.2 : 0.24), 0, Math.PI * 2)
        g.fill()
      }
      break
    }
    case 'pine': {
      g.fillStyle = shade('#5b3a1e', '#24170b')
      g.fillRect(W * 0.45, H * 0.8, W * 0.1, H * 0.2)
      g.fillStyle = shade('#166534', '#0f3d22')
      for (let i = 0; i < 4; i++) {
        g.beginPath()
        g.moveTo(W * 0.5, H * (0.02 + i * 0.18))
        g.lineTo(W * (0.08 - i * 0.02 + 0.06), H * (0.35 + i * 0.16))
        g.lineTo(W * (0.92 + i * 0.02 - 0.06), H * (0.35 + i * 0.16))
        g.fill()
      }
      break
    }
    case 'bamboo': {
      for (let i = 0; i < 3; i++) {
        g.fillStyle = shade(i % 2 ? '#65a30d' : '#84cc16', '#365314')
        const x = W * (0.2 + i * 0.25)
        g.fillRect(x, H * (0.05 + i * 0.05), W * 0.12, H)
        g.fillStyle = shade('#3f6212', '#1a2e05')
        for (let k = 1; k < 8; k++) g.fillRect(x, H * (k / 8), W * 0.12, H * 0.01)
      }
      g.fillStyle = shade('#4d7c0f', '#1a2e05')
      for (let i = 0; i < 8; i++) {
        g.beginPath()
        g.ellipse(W * (0.1 + (i % 4) * 0.27), H * (0.1 + (i >> 2) * 0.2), W * 0.2, H * 0.02, (i - 3) * 0.4, 0, Math.PI * 2)
        g.fill()
      }
      break
    }
    case 'bush': {
      g.fillStyle = shade('#16a34a', '#14532d')
      for (let i = 0; i < 4; i++) {
        g.beginPath()
        g.arc(W * (0.22 + i * 0.19), H * 0.6, W * 0.2, 0, Math.PI * 2)
        g.fill()
      }
      g.fillRect(W * 0.05, H * 0.6, W * 0.9, H * 0.4)
      if (!night) {
        g.fillStyle = '#f472b6'
        for (let i = 0; i < 5; i++) g.fillRect(W * (0.15 + i * 0.16), H * (0.45 + (i % 2) * 0.12), W * 0.04, W * 0.04)
      }
      break
    }
    case 'rock':
    case 'waveRock': {
      g.fillStyle = shade('#78716c', '#292524')
      g.beginPath()
      g.moveTo(W * 0.05, H)
      g.lineTo(W * 0.2, H * 0.3)
      g.lineTo(W * 0.55, H * 0.05)
      g.lineTo(W * 0.85, H * 0.35)
      g.lineTo(W * 0.97, H)
      g.fill()
      g.fillStyle = shade('#a8a29e', '#44403c')
      g.beginPath()
      g.moveTo(W * 0.2, H * 0.3)
      g.lineTo(W * 0.55, H * 0.05)
      g.lineTo(W * 0.45, H * 0.6)
      g.fill()
      if (kind === 'waveRock') {
        g.fillStyle = 'rgba(255,255,255,0.85)'
        g.fillRect(0, H * 0.85, W, H * 0.15)
      }
      break
    }
    case 'building':
    case 'tallBuilding':
    case 'shop': {
      const palettes = night ? ['#1f2937', '#312e81', '#3f3f46', '#1e293b'] : ['#f5d0a9', '#fde68a', '#bfdbfe', '#fecaca', '#d9f99d', '#e9d5ff']
      g.fillStyle = palettes[variant % palettes.length]
      g.fillRect(0, 0, W, H)
      g.fillStyle = night ? '#0f172a' : 'rgba(0,0,0,0.12)'
      g.fillRect(0, 0, W, H * 0.04)
      const cols = kind === 'shop' ? 3 : 4
      const rows = kind === 'tallBuilding' ? 12 : kind === 'shop' ? 1 : 5
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lit = night ? ((r * 7 + c * 3 + variant) % 3 === 0 ? '#fde047' : '#1e293b') : '#38bdf8'
          g.fillStyle = lit
          g.fillRect(W * (0.08 + c * (0.84 / cols)), H * (0.08 + r * (0.8 / rows)), W * (0.84 / cols) * 0.6, H * (0.8 / rows) * 0.5)
        }
      }
      if (kind === 'shop') {
        g.fillStyle = ['#dc2626', '#0d9488', '#ea580c'][variant % 3]
        g.fillRect(0, H * 0.35, W, H * 0.12)
        g.fillStyle = '#fff'
        g.font = `bold ${H * 0.1}px "Noto Sans Tamil", sans-serif`
        g.textAlign = 'center'
        g.fillText(['கடை', 'உணவகம்', 'பூக்கடை'][variant % 3], W / 2, H * 0.445)
        g.fillStyle = night ? '#fde047' : '#78350f'
        g.fillRect(W * 0.3, H * 0.62, W * 0.4, H * 0.38)
      }
      break
    }
    case 'streetlamp':
    case 'lantern': {
      g.fillStyle = shade('#374151', '#111827')
      g.fillRect(W * 0.4, H * 0.1, W * 0.2, H * 0.9)
      g.fillRect(W * 0.1, H * 0.08, W * 0.8, H * 0.03)
      g.fillStyle = kind === 'lantern' ? '#f97316' : night ? '#fef08a' : '#e5e7eb'
      g.beginPath()
      g.arc(W * 0.5, H * 0.06, W * 0.45, 0, Math.PI * 2)
      g.fill()
      break
    }
    case 'neon':
    case 'billboard': {
      g.fillStyle = shade('#4b5563', '#111827')
      g.fillRect(W * 0.2, H * 0.55, W * 0.06, H * 0.45)
      g.fillRect(W * 0.74, H * 0.55, W * 0.06, H * 0.45)
      const neon = kind === 'neon'
      g.fillStyle = neon ? '#0f172a' : ['#0d9488', '#f97316', '#7c3aed', '#dc2626'][variant % 4]
      g.fillRect(0, 0, W, H * 0.6)
      if (neon) {
        g.strokeStyle = ['#f472b6', '#22d3ee', '#a3e635', '#facc15'][variant % 4]
        g.lineWidth = W * 0.03
        g.strokeRect(W * 0.04, H * 0.04, W * 0.92, H * 0.52)
      }
      g.fillStyle = neon ? ['#f472b6', '#22d3ee', '#a3e635', '#facc15'][variant % 4] : '#fff'
      g.font = `900 ${H * 0.38}px "Noto Sans Tamil", sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(TAMIL_LETTERS[variant % TAMIL_LETTERS.length], W / 2, H * 0.31)
      break
    }
    case 'hut': {
      g.fillStyle = shade('#d6a86b', '#57402a')
      g.fillRect(W * 0.1, H * 0.45, W * 0.8, H * 0.55)
      g.fillStyle = shade('#a16207', '#3f2a12')
      g.beginPath()
      g.moveTo(0, H * 0.5)
      g.lineTo(W * 0.5, 0)
      g.lineTo(W, H * 0.5)
      g.fill()
      g.fillStyle = shade('#5b3a1e', night ? '#fde047' : '#24170b')
      g.fillRect(W * 0.42, H * 0.65, W * 0.16, H * 0.35)
      g.fillStyle = '#fff'
      for (let i = 0; i < 5; i++) g.fillRect(W * (0.12 + i * 0.16), H * 0.95, W * 0.06, H * 0.02)
      break
    }
    case 'haystack': {
      g.fillStyle = shade('#eab308', '#713f12')
      g.beginPath()
      g.moveTo(W * 0.05, H)
      g.quadraticCurveTo(W * 0.5, -H * 0.3, W * 0.95, H)
      g.fill()
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
      // A tiered temple tower: stacked narrowing storeys, kalasam on top.
      const tiers = 7
      for (let i = 0; i < tiers; i++) {
        const t = i / tiers
        const bw = W * (0.9 - t * 0.62)
        const bh = H * (0.8 / tiers)
        const y = H - H * 0.12 - (i + 1) * bh
        g.fillStyle = shade(i % 2 ? '#fbbf24' : '#f59e0b', i % 2 ? '#78350f' : '#57300b')
        g.fillRect((W - bw) / 2, y, bw, bh)
        g.fillStyle = shade('#b45309', '#2a1605')
        for (let k = 0; k < 5; k++) g.fillRect((W - bw) / 2 + (bw / 5) * k + bw * 0.06, y + bh * 0.2, bw * 0.06, bh * 0.6)
      }
      g.fillStyle = shade('#d97706', '#451a03')
      g.fillRect(W * 0.05, H * 0.88, W * 0.9, H * 0.12)
      g.fillStyle = shade('#78350f', '#1c0a02')
      g.fillRect(W * 0.4, H * 0.9, W * 0.2, H * 0.1)
      g.fillStyle = '#facc15'
      g.beginPath()
      g.arc(W * 0.5, H * 0.07, W * 0.07, 0, Math.PI * 2)
      g.fill()
      g.fillRect(W * 0.48, H * 0.0, W * 0.04, H * 0.05)
      break
    }
    case 'mandapam': {
      g.fillStyle = shade('#d6d3d1', '#44403c')
      g.fillRect(0, H * 0.85, W, H * 0.15)
      g.fillRect(W * 0.02, H * 0.12, W * 0.96, H * 0.12)
      for (let i = 0; i < 6; i++) g.fillRect(W * (0.05 + i * 0.17), H * 0.24, W * 0.07, H * 0.61)
      g.fillStyle = shade('#a8a29e', '#292524')
      g.beginPath()
      g.moveTo(0, H * 0.12)
      g.lineTo(W * 0.5, 0)
      g.lineTo(W, H * 0.12)
      g.fill()
      break
    }
    case 'flag': {
      g.fillStyle = shade('#57534e', '#1c1917')
      g.fillRect(W * 0.45, 0, W * 0.1, H)
      g.fillStyle = ['#f97316', '#dc2626', '#facc15'][variant % 3]
      g.beginPath()
      g.moveTo(W * 0.55, H * 0.02)
      g.lineTo(W * 2, H * 0.1)
      g.lineTo(W * 0.55, H * 0.2)
      g.fill()
      break
    }
    case 'lighthouse': {
      g.fillStyle = '#f8fafc'
      g.beginPath()
      g.moveTo(W * 0.25, H)
      g.lineTo(W * 0.35, H * 0.2)
      g.lineTo(W * 0.65, H * 0.2)
      g.lineTo(W * 0.75, H)
      g.fill()
      g.fillStyle = '#dc2626'
      for (let i = 0; i < 4; i++) g.fillRect(W * 0.28 + i * 0.012 * W, H * (0.3 + i * 0.18), W * (0.44 - i * 0.024), H * 0.08)
      g.fillStyle = '#1f2937'
      g.fillRect(W * 0.3, H * 0.1, W * 0.4, H * 0.1)
      g.fillStyle = '#fde047'
      g.fillRect(W * 0.36, H * 0.12, W * 0.28, H * 0.06)
      g.fillStyle = '#dc2626'
      g.beginPath()
      g.moveTo(W * 0.28, H * 0.1)
      g.lineTo(W * 0.5, 0)
      g.lineTo(W * 0.72, H * 0.1)
      g.fill()
      break
    }
    case 'boat': {
      g.fillStyle = shade('#b45309', '#422006')
      g.beginPath()
      g.moveTo(0, H * 0.6)
      g.lineTo(W, H * 0.6)
      g.lineTo(W * 0.85, H)
      g.lineTo(W * 0.15, H)
      g.fill()
      g.fillStyle = '#f8fafc'
      g.beginPath()
      g.moveTo(W * 0.5, 0)
      g.lineTo(W * 0.5, H * 0.58)
      g.lineTo(W * 0.85, H * 0.58)
      g.fill()
      g.fillStyle = '#0f766e'
      g.fillRect(W * 0.48, 0, W * 0.03, H * 0.6)
      break
    }
    case 'waterfall': {
      g.fillStyle = shade('#57534e', '#1c1917')
      g.fillRect(0, 0, W * 0.3, H)
      g.fillRect(W * 0.7, 0, W * 0.3, H)
      const grd = g.createLinearGradient(0, 0, 0, H)
      grd.addColorStop(0, '#e0f2fe')
      grd.addColorStop(1, '#7dd3fc')
      g.fillStyle = grd
      g.fillRect(W * 0.3, 0, W * 0.4, H)
      g.strokeStyle = 'rgba(255,255,255,0.8)'
      g.lineWidth = W * 0.01
      for (let i = 0; i < 10; i++) {
        g.beginPath()
        g.moveTo(W * (0.32 + i * 0.04), 0)
        g.lineTo(W * (0.32 + i * 0.04), H)
        g.stroke()
      }
      g.fillStyle = 'rgba(255,255,255,0.9)'
      g.beginPath()
      g.ellipse(W * 0.5, H * 0.95, W * 0.35, H * 0.06, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = shade('#15803d', '#14532d')
      for (let i = 0; i < 6; i++) {
        g.beginPath()
        g.arc(W * (i < 3 ? 0.05 + i * 0.1 : 0.75 + (i - 3) * 0.1), H * 0.08, W * 0.1, 0, Math.PI * 2)
        g.fill()
      }
      break
    }
    case 'fence': {
      g.fillStyle = shade('#a16207', '#422006')
      for (let i = 0; i < 6; i++) g.fillRect(W * (i / 5) * 0.95, 0, W * 0.04, H)
      g.fillRect(0, H * 0.25, W, H * 0.1)
      g.fillRect(0, H * 0.6, W, H * 0.1)
      break
    }
    case 'crowd': {
      g.fillStyle = shade('#e7e5e4', '#1f2937')
      g.fillRect(0, H * 0.55, W, H * 0.45)
      const cols = ['#dc2626', '#f97316', '#0d9488', '#7c3aed', '#facc15', '#2563eb', '#16a34a']
      for (let i = 0; i < 18; i++) {
        const x = W * (0.03 + (i / 18) * 0.94)
        const y = H * (0.2 + (i % 3) * 0.1)
        g.fillStyle = cols[i % cols.length]
        g.fillRect(x - W * 0.018, y + H * 0.12, W * 0.036, H * 0.25)
        g.fillStyle = '#7c4a2d'
        g.beginPath()
        g.arc(x, y + H * 0.08, W * 0.017, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = '#0d9488'
      g.fillRect(W * 0.35, 0, W * 0.3, H * 0.18)
      g.fillStyle = '#fff'
      g.font = `bold ${H * 0.13}px "Noto Sans Tamil", sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('வா! வா!', W / 2, H * 0.095)
      break
    }
    case 'sign': {
      g.fillStyle = '#374151'
      g.fillRect(W * 0.45, H * 0.45, W * 0.1, H * 0.55)
      g.fillStyle = '#facc15'
      g.fillRect(W * 0.05, 0, W * 0.9, H * 0.5)
      g.strokeStyle = '#111827'
      g.lineWidth = W * 0.06
      g.strokeRect(W * 0.08, H * 0.03, W * 0.84, H * 0.44)
      g.fillStyle = '#111827'
      g.font = `900 ${H * 0.34}px sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(variant % 2 ? '›' : '‹', W / 2, H * 0.26)
      break
    }
  }
}

// Per-track atlas: a few variants per kind (building colours, letters...).
export function buildAtlas(theme: TrackTheme): Map<string, SpriteArt> {
  const atlas = new Map<string, SpriteArt>()
  const kinds = Object.keys(SIZE) as SceneryKind[]
  for (const kind of kinds) {
    const [ww, wh] = SIZE[kind]
    const variants = ['building', 'tallBuilding', 'shop', 'neon', 'billboard', 'flag'].includes(kind) ? 4 : kind === 'sign' ? 2 : 1
    for (let v = 0; v < variants; v++) {
      // Texture resolution: ~0.07 px per world unit, capped.
      const pxW = Math.max(24, Math.min(360, Math.round(ww * 0.08)))
      const pxH = Math.max(24, Math.min(420, Math.round(wh * 0.08)))
      const { c, g } = mk(pxW, pxH)
      draw(kind, g, pxW, pxH, theme, v)
      atlas.set(`${kind}:${v}`, { canvas: c, worldW: ww, worldH: wh })
    }
  }
  return atlas
}

// A car seen from behind (rivals ahead / the player in chase view).
export function buildCar(color: string): HTMLCanvasElement {
  const W = 220
  const H = 120
  const { c, g } = mk(W, H)
  g.fillStyle = 'rgba(0,0,0,0.3)'
  g.beginPath()
  g.ellipse(W / 2, H * 0.94, W * 0.48, H * 0.07, 0, 0, Math.PI * 2)
  g.fill()
  // Tyres.
  g.fillStyle = '#111827'
  g.fillRect(W * 0.04, H * 0.62, W * 0.16, H * 0.32)
  g.fillRect(W * 0.8, H * 0.62, W * 0.16, H * 0.32)
  // Body.
  g.fillStyle = color
  g.beginPath()
  g.moveTo(W * 0.08, H * 0.88)
  g.lineTo(W * 0.06, H * 0.5)
  g.quadraticCurveTo(W * 0.2, H * 0.42, W * 0.3, H * 0.4)
  g.lineTo(W * 0.38, H * 0.12)
  g.lineTo(W * 0.62, H * 0.12)
  g.lineTo(W * 0.7, H * 0.4)
  g.quadraticCurveTo(W * 0.8, H * 0.42, W * 0.94, H * 0.5)
  g.lineTo(W * 0.92, H * 0.88)
  g.closePath()
  g.fill()
  // Rear window.
  g.fillStyle = 'rgba(15,23,42,0.85)'
  g.beginPath()
  g.moveTo(W * 0.36, H * 0.38)
  g.lineTo(W * 0.41, H * 0.17)
  g.lineTo(W * 0.59, H * 0.17)
  g.lineTo(W * 0.64, H * 0.38)
  g.fill()
  // Spoiler.
  g.fillStyle = 'rgba(0,0,0,0.35)'
  g.fillRect(W * 0.1, H * 0.42, W * 0.8, H * 0.06)
  // Lights and plate.
  g.fillStyle = '#ef4444'
  g.fillRect(W * 0.1, H * 0.56, W * 0.16, H * 0.1)
  g.fillRect(W * 0.74, H * 0.56, W * 0.16, H * 0.1)
  g.fillStyle = '#fef3c7'
  g.fillRect(W * 0.4, H * 0.66, W * 0.2, H * 0.12)
  // Stripe.
  g.fillStyle = 'rgba(255,255,255,0.7)'
  g.fillRect(W * 0.47, H * 0.12, W * 0.06, H * 0.3)
  return c
}

export function buildCoin(): HTMLCanvasElement {
  const { c, g } = mk(64, 64)
  g.fillStyle = '#b45309'
  g.beginPath()
  g.arc(32, 32, 30, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#facc15'
  g.beginPath()
  g.arc(32, 32, 25, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#b45309'
  g.font = '900 30px "Noto Sans Tamil", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('அ', 32, 34)
  return c
}
