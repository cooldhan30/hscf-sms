import type { EnemyKind } from '@/lib/gameRoomV2/bossBattle/brawl'

// Original canvas artwork for Boss Battle's characters: the hero, the
// five enemy types, the Stone Guardian and the Irul King. Drawn in world
// units at the origin of the current transform (the renderer translates
// to each character). Flat shapes with dark outlines -- the same
// illustrated language as Tower Defense.

type Ctx = CanvasRenderingContext2D

function ell(g: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke?: string, lw = 2) {
  g.beginPath()
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2)
  g.fillStyle = fill
  g.fill()
  if (stroke) {
    g.strokeStyle = stroke
    g.lineWidth = lw
    g.stroke()
  }
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

export function shadow(g: Ctx, x: number, y: number, rx: number, alpha = 0.25) {
  ell(g, x, y, rx, rx * 0.42, `rgba(10,10,20,${alpha})`)
}

const OUT = '#1c1917'

export interface HeroPose {
  time: number
  fx: number
  fy: number
  moving: boolean
  hurt: boolean // flashing after a hit
  dashing: boolean
  shield: boolean // invulnerable glow
}

// The hero: a young Tamil warrior -- teal tunic, saffron sash and
// headband, a short cape; faces the way they move.
export function drawHero(g: Ctx, o: HeroPose) {
  const t = o.time
  const bob = o.moving ? Math.abs(Math.sin(t * 12)) * 3 : Math.sin(t * 3) * 1
  const side = o.fx < -0.2 ? -1 : 1
  const back = o.fy < -0.5
  // A teal ground ring so the hero is easy to find in a crowd.
  g.strokeStyle = 'rgba(20,184,166,0.9)'
  g.lineWidth = 3
  g.beginPath()
  g.ellipse(0, 16, 26, 11, 0, 0, Math.PI * 2)
  g.stroke()
  shadow(g, 0, 18, 18)
  if (o.shield) {
    ell(g, 0, -6, 30, 30, 'rgba(125,211,252,0.18)', 'rgba(186,230,253,0.8)', 2.5)
  }
  if (o.hurt && Math.floor(t * 20) % 2 === 0) g.globalAlpha *= 0.45
  // Legs.
  const step = o.moving ? Math.sin(t * 12) * 5 : 0
  g.strokeStyle = '#44403c'
  g.lineWidth = 5
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(-5, 6 - bob)
  g.lineTo(-5 + step, 16)
  g.moveTo(5, 6 - bob)
  g.lineTo(5 - step, 16)
  g.stroke()
  // Cape (behind unless facing away).
  const capeSway = Math.sin(t * 6) * 3 - side * (o.moving ? 5 : 1)
  const cape = () => poly(g, [[-10, -12 - bob], [10, -12 - bob], [12 + capeSway, 10 - bob], [-12 + capeSway, 10 - bob]], '#c2410c', OUT, 2)
  if (!back) cape()
  // Body.
  ell(g, 0, -2 - bob, 13, 14, '#0f766e', OUT)
  poly(g, [[-13, -6 - bob], [13, 2 - bob], [13, 6 - bob], [-13, -2 - bob]], '#f59e0b')
  if (back) cape()
  // Head.
  ell(g, 0, -22 - bob, 11, 11, '#b8743f', OUT)
  // Hair and headband.
  poly(g, [[-11, -25 - bob], [11, -25 - bob], [9, -33 - bob], [-9, -33 - bob]], '#1c1917')
  g.fillStyle = '#f59e0b'
  g.fillRect(-11, -27 - bob, 22, 4)
  poly(g, [[-side * 10, -26 - bob], [-side * 18, -30 - bob + Math.sin(t * 8) * 2], [-side * 17, -22 - bob]], '#f59e0b')
  if (!back) {
    ell(g, side * 4 - 3, -21 - bob, 1.8, 2.4, OUT)
    ell(g, side * 4 + 3, -21 - bob, 1.8, 2.4, OUT)
    // Tilak.
    g.fillStyle = '#dc2626'
    g.fillRect(-1, -27 - bob, 2, 3)
  }
  // Staff hand toward facing.
  g.strokeStyle = '#78350f'
  g.lineWidth = 4
  g.beginPath()
  g.moveTo(o.fx * 8, -4 - bob)
  g.lineTo(o.fx * 22, -4 - bob + o.fy * 12)
  g.stroke()
  if (o.dashing) {
    g.globalAlpha *= 0.5
    ell(g, -o.fx * 20, -6 - o.fy * 20, 16, 16, 'rgba(186,230,253,0.6)')
  }
  g.lineCap = 'butt'
}

export interface EnemyPose {
  time: number
  id: number
  flash: boolean
  facing: number // -1 / 1
  winding: number // 0..1 telegraph (brute / spitter)
  alpha: number
  scale: number
}

export function drawEnemy(g: Ctx, kind: EnemyKind, r: number, o: EnemyPose) {
  const t = o.time + o.id * 0.37
  const d = o.facing
  const tint = (c: string) => (o.flash ? '#ffffff' : c)
  g.save()
  g.globalAlpha *= o.alpha
  g.scale(o.scale, o.scale)
  shadow(g, 0, r * 0.9, r * 0.95)
  if (kind === 'shade') {
    // A hunched shadow imp with glowing eyes.
    const bob = Math.abs(Math.sin(t * 8)) * r * 0.12
    poly(g, [[-r, r * 0.8], [r, r * 0.8], [r * 0.7, -r * 0.6 - bob], [0, -r * 1.05 - bob], [-r * 0.7, -r * 0.6 - bob]], tint('#4c1d95'), OUT, 2)
    for (let k = -2; k <= 2; k++) ell(g, k * r * 0.4, r * 0.8, r * 0.22, r * 0.14, tint('#4c1d95'))
    ell(g, d * r * 0.25 - r * 0.2, -r * 0.35 - bob, r * 0.14, r * 0.1, '#fde047')
    ell(g, d * r * 0.25 + r * 0.2, -r * 0.35 - bob, r * 0.14, r * 0.1, '#fde047')
  } else if (kind === 'darter') {
    // A quick bat-winged sprite.
    const flap = Math.sin(t * 22) * 0.8
    for (const s of [-1, 1]) poly(g, [[s * r * 0.3, -r * 0.3], [s * r * 1.6, -r * (0.9 + flap * 0.5)], [s * r * 1.2, r * 0.1], [s * r * 0.4, r * 0.2]], tint('#be185d'), OUT, 1.5)
    ell(g, 0, -r * 0.1, r * 0.6, r * 0.7, tint('#db2777'), OUT)
    ell(g, d * r * 0.2, -r * 0.25, r * 0.12, r * 0.12, '#fef08a')
  } else if (kind === 'swarm') {
    // Tiny armoured mites scuttling.
    const jit = Math.sin(t * 30) * r * 0.08
    g.strokeStyle = OUT
    g.lineWidth = 1.5
    for (let k = -1; k <= 1; k++) {
      g.beginPath()
      g.moveTo(-r * 0.9, k * r * 0.4 + jit)
      g.lineTo(r * 0.9, k * r * 0.4 - jit)
      g.stroke()
    }
    ell(g, 0, 0, r * 0.85, r * 0.7, tint('#65a30d'), OUT, 1.5)
    ell(g, d * r * 0.55, -r * 0.1, r * 0.35, r * 0.3, tint('#1a2e05'))
  } else if (kind === 'brute') {
    // A horned red ogre -- glows and crouches before charging.
    const stomp = Math.max(0, Math.sin(t * 5)) * r * 0.12
    const crouch = o.winding * r * 0.15
    if (o.winding > 0) ell(g, 0, -r * 0.1, r * (1.2 + o.winding * 0.3), r * (1.1 + o.winding * 0.3), `rgba(248,113,113,${0.25 + 0.35 * o.winding})`)
    ell(g, 0, -stomp + crouch, r, r * 0.9, tint('#b91c1c'), OUT, 2.5)
    ell(g, 0, r * 0.25 - stomp + crouch, r * 0.55, r * 0.35, tint('#fca5a5'))
    for (const s of [-1, 1]) poly(g, [[s * r * 0.45, -r * 0.6 - stomp + crouch], [s * r * 0.85, -r * 1.25 - stomp + crouch], [s * r * 0.2, -r * 0.8 - stomp + crouch]], '#fef3c7', OUT, 1.5)
    ell(g, d * r * 0.2 - r * 0.22, -r * 0.35 - stomp + crouch, r * 0.12, r * 0.1, '#fef9c3')
    ell(g, d * r * 0.2 + r * 0.22, -r * 0.35 - stomp + crouch, r * 0.12, r * 0.1, '#fef9c3')
  } else if (kind === 'spitter') {
    // A coiled green serpent-plant that spits orbs.
    const sway = Math.sin(t * 3) * r * 0.2
    ell(g, 0, r * 0.4, r, r * 0.55, tint('#15803d'), OUT)
    g.strokeStyle = tint('#16a34a')
    g.lineWidth = r * 0.5
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(0, r * 0.3)
    g.quadraticCurveTo(sway, -r * 0.3, d * r * 0.3, -r * 0.8)
    g.stroke()
    g.lineCap = 'butt'
    const mouth = o.winding
    ell(g, d * r * 0.35, -r * 0.9, r * 0.5, r * 0.42, tint('#22c55e'), OUT)
    ell(g, d * r * 0.65, -r * 0.9, r * 0.14 + mouth * r * 0.14, r * 0.1 + mouth * r * 0.14, mouth > 0 ? '#bef264' : OUT)
    ell(g, d * r * 0.25, -r * 1.05, r * 0.1, r * 0.1, '#fef08a')
  }
  g.restore()
}

export interface BossPose {
  time: number
  flash: boolean
  facing: number
  phase: 1 | 2
  casting: boolean
  charging: boolean
  alpha: number
  lift: number // 0 on the ground; >0 descending during the intro
  dying: number // 0..1
}

// The Stone Guardian: a temple golem with glowing kolam runes.
export function drawGolem(g: Ctx, r: number, o: BossPose) {
  const t = o.time
  const tint = (c: string) => (o.flash ? '#ffffff' : c)
  const stomp = Math.max(0, Math.sin(t * 4)) * r * 0.06
  g.save()
  g.globalAlpha *= o.alpha
  shadow(g, 0, r * 0.85, r * 1.05, 0.3)
  g.translate(0, -o.lift)
  if (o.casting) ell(g, 0, -r * 0.2, r * 1.35, r * 1.2, 'rgba(250,204,21,0.25)')
  // Legs.
  g.fillStyle = tint('#57534e')
  for (const s of [-1, 1]) g.fillRect(s * r * 0.35 - r * 0.2, r * 0.3 - stomp * (s > 0 ? 1 : 0), r * 0.4, r * 0.5)
  // Body.
  poly(g, [[-r * 0.85, r * 0.4], [r * 0.85, r * 0.4], [r * 0.95, -r * 0.5], [r * 0.5, -r * 0.9], [-r * 0.5, -r * 0.9], [-r * 0.95, -r * 0.5]], tint('#a8a29e'), OUT, 3)
  for (const s of [-1, 1]) ell(g, s * r * 1.05, -r * 0.2 - stomp, r * 0.3, r * 0.42, tint('#78716c'), OUT, 2.5)
  // Head.
  poly(g, [[-r * 0.35, -r * 0.85], [r * 0.35, -r * 0.85], [r * 0.3, -r * 1.3], [-r * 0.3, -r * 1.3]], tint('#d6d3d1'), OUT, 2.5)
  const glow = o.casting ? '#fde047' : '#f59e0b'
  ell(g, -r * 0.13, -r * 1.07, r * 0.07, r * 0.05, glow)
  ell(g, r * 0.13, -r * 1.07, r * 0.07, r * 0.05, glow)
  // Kolam rune on the chest.
  g.strokeStyle = glow
  g.lineWidth = 2.5
  g.beginPath()
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * Math.PI * 2
    const rr = r * (k % 2 ? 0.14 : 0.26)
    g.lineTo(Math.cos(a) * rr, -r * 0.25 + Math.sin(a) * rr)
  }
  g.stroke()
  g.restore()
}

// The Irul King: a cloaked shadow ruler with a gold crown and staff. In
// phase 2 the cloak burns crimson and a flame corona circles him.
export function drawIrulKing(g: Ctx, r: number, o: BossPose) {
  const t = o.time
  const float = Math.sin(t * 2.2) * r * 0.08
  const p2 = o.phase === 2
  const cloak = o.flash ? '#ffffff' : p2 ? '#9f1239' : '#5b21b6'
  const cloakDark = p2 ? '#4c0519' : '#2e1065'
  const d = o.facing
  g.save()
  g.globalAlpha *= o.alpha * (1 - o.dying * 0.6)
  shadow(g, 0, r * 0.95, r * 1.1, 0.35 * (1 - Math.min(1, o.lift / 200)))
  g.translate(0, -o.lift + float)
  if (o.dying > 0) g.rotate(Math.sin(t * 30) * 0.05 * o.dying)
  // Aura / corona.
  if (p2) {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + t * 1.6
      ell(g, Math.cos(a) * r * 1.05, -r * 0.1 + Math.sin(a) * r * 0.75, r * 0.2, r * 0.3, `rgba(251,113,133,${0.3 + 0.2 * Math.sin(t * 9 + k)})`)
    }
  } else ell(g, 0, -r * 0.1, r * 1.3, r * 1.1, `rgba(167,139,250,${0.18 + 0.08 * Math.sin(t * 3)})`)
  if (o.charging) ell(g, 0, -r * 0.1, r * 1.4, r * 1.2, 'rgba(244,63,94,0.35)')
  // Cloak.
  poly(g, [[-r, r * 0.8], [r, r * 0.8], [r * 0.5, -r * 0.45], [-r * 0.5, -r * 0.45]], cloak, cloakDark, 3)
  g.fillStyle = cloakDark
  g.beginPath()
  for (let k = 0; k <= 8; k++) g.lineTo(-r + (k * r * 2) / 8, r * 0.8 + (k % 2 ? r * 0.14 : 0) + Math.sin(t * 5 + k) * 2)
  g.lineTo(r, r * 0.8)
  g.fill()
  // Hood and face.
  ell(g, 0, -r * 0.62, r * 0.47, r * 0.44, o.flash ? '#ffffff' : '#1e1b4b', cloakDark, 3)
  for (const ex of [-0.17, 0.17]) ell(g, ex * r + d * r * 0.06, -r * 0.64, r * 0.08, r * 0.06, p2 ? '#fecaca' : '#fde047')
  // Crown.
  poly(g, [[-r * 0.38, -r * 0.9], [-r * 0.38, -r * 1.22], [-r * 0.19, -r * 1.04], [0, -r * 1.32], [r * 0.19, -r * 1.04], [r * 0.38, -r * 1.22], [r * 0.38, -r * 0.9]], '#eab308', '#a16207', 2)
  ell(g, 0, -r * 1.02, r * 0.06, r * 0.06, '#dc2626')
  // Staff with orb.
  g.strokeStyle = '#78350f'
  g.lineWidth = r * 0.1
  g.beginPath()
  g.moveTo(d * r * 0.7, r * 0.7)
  g.lineTo(d * r * 0.85, -r * 0.95)
  g.stroke()
  const orb = p2 ? '#f43f5e' : '#a78bfa'
  ell(g, d * r * 0.86, -r * 1.05, r * 0.15, r * 0.15, orb, OUT, 2)
  if (o.casting) {
    const pul = 0.5 + 0.5 * Math.sin(t * 16)
    ell(g, d * r * 0.86, -r * 1.05, r * (0.32 + 0.15 * pul), r * (0.32 + 0.15 * pul), p2 ? 'rgba(251,113,133,0.45)' : 'rgba(196,181,253,0.45)')
    g.strokeStyle = p2 ? 'rgba(254,205,211,0.9)' : 'rgba(221,214,254,0.9)'
    g.lineWidth = 2.5
    g.beginPath()
    g.arc(d * r * 0.86, -r * 1.05, r * (0.5 + 0.2 * pul), 0, Math.PI * 2)
    g.stroke()
  }
  g.restore()
}
