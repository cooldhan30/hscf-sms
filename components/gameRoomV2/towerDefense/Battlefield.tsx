'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'
import { getTowerType, statsFor, STEP_MS, STRIKE_RADIUS, type TdState, type TowerTypeId } from '@/lib/gameRoomV2/towerDefense'
import type { EnemyKind } from '@/lib/gameRoomV2/towerDefense/waves'
import { drawTower, drawEnemy, drawPad, drawFort, drawGate, paintTerrain, gateAndFort, TILT } from './art'
import { toScreen, toWorld, screenAngle, type TdLayout } from './layout'

// The full-viewport battlefield. One canvas covers the whole screen: the
// terrain is painted once per layout, then every frame draws the living
// world on top -- pads, towers (with build and level-up animation),
// walking enemy characters, projectiles, particles, ability effects, the
// fort and the enemy gate. It reads the simulation from a ref each frame
// (no React re-render per frame). Build spots are real <button>s placed
// over the canvas for touch, mouse, keyboard and screen readers.

export type Fx =
  | { kind: 'ring'; x: number; y: number; color: string; r0: number; r1: number; dur: number }
  | { kind: 'kill'; x: number; y: number; enemy: EnemyKind; reward: number }
  | { kind: 'text'; x: number; y: number; text: string; color: string }
  | { kind: 'build' | 'upgrade' | 'sell' | 'hit' | 'splash' | 'frost' | 'summon' | 'enrage' | 'leak'; x: number; y: number; radius?: number }
  | { kind: 'freeze' | 'rally' | 'repair' | 'bossWarn' | 'victory' | 'waveClear' }
  | { kind: 'strike'; x: number; y: number }
  | { kind: 'coinsFromHud'; amount: number }

export interface StepClock {
  lastStepAt: number
  running: boolean
  speed: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  g: number
  life: number
  max: number
  size: number
  color: string
  kind: 'dot' | 'smoke' | 'coin' | 'stone' | 'flake' | 'text' | 'orb' | 'spark' | 'ice' | 'beam' | 'leaf'
  text?: string
  tx?: number
  ty?: number
  delay?: number
  land?: number // for falling stones: ground y
}

interface TowerGhost {
  type: TowerTypeId
  level: number
  x: number
  y: number
  t0: number
}

interface Ghost {
  kind: EnemyKind
  x: number
  y: number
  r: number
  t0: number
  facing: number
}

export function Battlefield({
  stateRef,
  fxRef,
  clockRef,
  layout,
  version,
  selectedPadId,
  strikeMode,
  invitePadId,
  coinTargetRef,
  reducedMotion,
  outcome,
  onPadClick,
  onFieldClick,
  onEmptyClick,
}: {
  stateRef: MutableRefObject<TdState | null>
  fxRef: MutableRefObject<Fx[]>
  clockRef: MutableRefObject<StepClock>
  layout: TdLayout
  version: number
  selectedPadId: string | null
  strikeMode: boolean
  invitePadId: string | null
  coinTargetRef: MutableRefObject<HTMLElement | null>
  reducedMotion: boolean
  outcome: 'victory' | 'defeat' | null
  onPadClick: (padId: string) => void
  onFieldClick: (point: { x: number; y: number }) => void
  onEmptyClick: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const selectedRef = useRef(selectedPadId)
  const strikeRef = useRef(strikeMode)
  const inviteRef = useRef(invitePadId)
  const outcomeRef = useRef(outcome)
  const hoverRef = useRef<{ x: number; y: number } | null>(null)
  selectedRef.current = selectedPadId
  strikeRef.current = strikeMode
  inviteRef.current = invitePadId
  outcomeRef.current = outcome

  useEffect(() => {
    const canvas = canvasRef.current
    const state0 = stateRef.current
    if (!canvas || !state0) return
    const l = layout
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(l.width * dpr)
    canvas.height = Math.round(l.height * dpr)
    const g = canvas.getContext('2d')
    if (!g) return
    // Static terrain for this layout.
    const bg = document.createElement('canvas')
    bg.width = canvas.width
    bg.height = canvas.height
    const bgc = bg.getContext('2d')!
    bgc.scale(dpr, dpr)
    const ambient = paintTerrain(bgc, l, state0.map)
    const c = l.cell
    const { gate, fort, scale: fortScale } = gateAndFort(l, state0.map)

    const particles: Particle[] = []
    const ghosts: Ghost[] = []
    const craters: { x: number; y: number; t0: number }[] = []
    // Stone Rain impacts land a beat after the stones start falling.
    const impacts: { x: number; y: number; at: number }[] = []
    const towerSeen = new Map<number, { born: number; level: number; levelAt: number; type: TowerTypeId; x: number; y: number }>()
    const towerGhosts: TowerGhost[] = []
    const enemySeen = new Map<number, number>()
    let fortHitAt = 0
    let fortHealAt = 0
    let bossCastUntil = 0
    let flash: { until: number; color: string; dur: number } | null = null
    let freezeWaveAt = 0
    const rallyWaves: number[] = []
    let bossSeen = false
    const projStart = new Map<number, { x: number; y: number }>()
    let kickUntil = 0
    let kickMag = 0
    let freezeFxUntil = 0
    let rallyPulseAt = 0
    let bossWarnUntil = 0
    let victoryAt = 0
    let raf = 0

    const kick = (mag: number, ms: number) => {
      if (reducedMotion) return
      kickMag = Math.max(kickMag, mag)
      kickUntil = Math.max(kickUntil, performance.now() + ms)
    }
    const burst = (x: number, y: number, n: number, color: string, speed = 1, kind: Particle['kind'] = 'dot') => {
      if (reducedMotion) n = Math.min(n, 3)
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const v = (0.5 + Math.random()) * c * 2.2 * speed
        particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - c * 1.2, g: c * 5, life: 0.5, max: 0.5, size: c * (0.04 + Math.random() * 0.04), color, kind })
      }
    }
    const coinTarget = () => {
      const el = coinTargetRef.current
      if (!el) return { x: 60, y: 30 }
      const r = el.getBoundingClientRect()
      const cr = canvas.getBoundingClientRect()
      return { x: r.left - cr.left + 18, y: r.top - cr.top + r.height / 2 }
    }
    const coinFly = (x: number, y: number, n: number) => {
      const t = coinTarget()
      for (let i = 0; i < n; i++) {
        particles.push({ x: x + (Math.random() - 0.5) * c * 0.3, y: y + (Math.random() - 0.5) * c * 0.3, vx: 0, vy: 0, g: 0, life: 0.75, max: 0.75, size: c * 0.09, color: '#facc15', kind: 'coin', tx: t.x, ty: t.y, delay: i * 0.06 })
      }
    }

    const spawnFx = (now: number) => {
      const list = fxRef.current
      if (!list.length) return
      fxRef.current = []
      for (const f of list) {
        const at = 'x' in f ? toScreen(l, f.x, f.y) : null
        switch (f.kind) {
          case 'build':
            burst(at!.sx, at!.sy + c * 0.1, 14, '#d6c7a1', 0.8, 'smoke')
            particles.push({ x: at!.sx, y: at!.sy, vx: 0, vy: 0, g: 0, life: 0.45, max: 0.45, size: c * 0.6, color: 'rgba(250,204,21,0.9)', kind: 'orb' })
            break
          case 'upgrade':
            particles.push({ x: at!.sx, y: at!.sy, vx: 0, vy: 0, g: 0, life: 0.55, max: 0.55, size: c * 0.35, color: '#fde68a', kind: 'beam' })
            burst(at!.sx, at!.sy - c * 0.4, 16, '#34d399', 1, 'spark')
            burst(at!.sx, at!.sy - c * 0.4, 10, '#facc15', 1.2, 'spark')
            break
          case 'sell':
            burst(at!.sx, at!.sy, 10, '#d6d3d1', 0.8, 'smoke')
            coinFly(at!.sx, at!.sy, 5)
            break
          case 'hit':
            burst(at!.sx, at!.sy - c * 0.1, 3, '#fef3c7', 0.5)
            break
          case 'splash':
            burst(at!.sx, at!.sy, 12, '#a8a29e', 0.9, 'smoke')
            particles.push({ x: at!.sx, y: at!.sy, vx: 0, vy: 0, g: 0, life: 0.35, max: 0.35, size: (f.radius ?? 1) * c, color: 'rgba(251,146,60,0.9)', kind: 'orb' })
            break
          case 'frost': {
            particles.push({ x: at!.sx, y: at!.sy, vx: 0, vy: 0, g: 0, life: 0.5, max: 0.5, size: (f.radius ?? 2) * c, color: 'rgba(125,211,252,0.8)', kind: 'orb' })
            // Ice shards fly to every enemy caught in the pulse.
            const st = stateRef.current
            if (st && !reducedMotion) {
              for (const e of st.enemies) {
                if (Math.hypot(e.x - f.x, e.y - f.y) > (f.radius ?? 2)) continue
                const tp = toScreen(l, e.x, e.y)
                particles.push({ x: at!.sx, y: at!.sy - c * 0.6, vx: 0, vy: 0, g: 0, life: 0.28, max: 0.28, size: c * 0.06, color: '#e0f2fe', kind: 'ice', tx: tp.sx, ty: tp.sy - c * 0.2 })
              }
            }
            break
          }
          case 'kill': {
            ghosts.push({ kind: f.enemy, x: at!.sx, y: at!.sy, r: (f.enemy === 'boss' ? 0.55 : f.enemy === 'brute' ? 0.36 : f.enemy === 'swarm' ? 0.16 : 0.24) * c, t0: now, facing: 1 })
            if (f.enemy === 'boss') flash = { until: now + 260, color: '255,255,255', dur: 260 }
            burst(at!.sx, at!.sy, f.enemy === 'boss' ? 40 : 8, f.enemy === 'boss' ? '#c4b5fd' : '#e7e5e4', f.enemy === 'boss' ? 1.8 : 0.8, 'smoke')
            coinFly(at!.sx, at!.sy, f.enemy === 'boss' ? 10 : Math.min(4, 1 + Math.floor(f.reward / 8)))
            if (f.enemy === 'boss') kick(8, 600)
            break
          }
          case 'text':
            particles.push({ x: at!.sx, y: at!.sy, vx: 0, vy: -c * 0.9, g: 0, life: 1, max: 1, size: Math.max(12, c * 0.28), color: f.color, kind: 'text', text: f.text })
            break
          case 'summon':
            burst(at!.sx, at!.sy, 16, '#a78bfa', 1, 'spark')
            particles.push({ x: at!.sx, y: at!.sy, vx: 0, vy: 0, g: 0, life: 0.6, max: 0.6, size: c * 1.1, color: 'rgba(167,139,250,0.9)', kind: 'orb' })
            bossCastUntil = now + 650
            break
          case 'enrage':
            burst(at!.sx, at!.sy, 30, '#fb7185', 1.6, 'spark')
            particles.push({ x: at!.sx, y: at!.sy, vx: 0, vy: 0, g: 0, life: 0.8, max: 0.8, size: c * 3, color: 'rgba(244,63,94,0.9)', kind: 'orb' })
            flash = { until: now + 320, color: '244,63,94', dur: 320 }
            kick(6, 450)
            break
          case 'leak':
            burst(fort.sx, fort.sy - c * 0.2, 14, '#a8a29e', 1, 'smoke')
            burst(fort.sx, fort.sy - c * 0.4, 8, '#c9974f', 1.3, 'dot')
            fortHitAt = now
            kick(4, 260)
            break
          case 'ring':
            particles.push({ x: at!.sx, y: at!.sy, vx: 0, vy: 0, g: 0, life: f.dur / 1000, max: f.dur / 1000, size: f.r1 * c, color: f.color, kind: 'orb' })
            break
          case 'freeze':
            freezeFxUntil = now + 3500
            freezeWaveAt = now
            for (let i = 0; i < (reducedMotion ? 10 : 70); i++) particles.push({ x: Math.random() * l.width, y: -Math.random() * l.height * 0.5, vx: (Math.random() - 0.5) * c * 0.4, vy: c * (1.2 + Math.random()), g: 0, life: 3.2, max: 3.2, size: c * (0.04 + Math.random() * 0.05), color: '#ffffff', kind: 'flake' })
            break
          case 'rally':
            rallyPulseAt = now
            rallyWaves.push(now, now + 180, now + 360)
            break
          case 'repair': {
            fortHealAt = now
            for (let i = 0; i < 12; i++) particles.push({ x: l.width / 2 + (Math.random() - 0.5) * c, y: 40, vx: 0, vy: 0, g: 0, life: 0.9, max: 0.9, size: c * 0.1, color: '#4ade80', kind: 'orb', tx: fort.sx, ty: fort.sy - c * 0.4, delay: i * 0.05 })
            particles.push({ x: fort.sx, y: fort.sy - c * 0.9, vx: 0, vy: -c * 0.6, g: 0, life: 1.4, max: 1.4, size: Math.max(14, c * 0.34), color: '#16a34a', kind: 'text', text: '+5 fort' })
            break
          }
          case 'strike': {
            for (let i = 0; i < (reducedMotion ? 4 : 14); i++) {
              const a = Math.random() * Math.PI * 2
              const d = Math.random() * STRIKE_RADIUS * c * 0.85
              const lx = at!.sx + Math.cos(a) * d
              const ly = at!.sy + Math.sin(a) * d * 0.8
              particles.push({ x: lx, y: ly - l.height * 0.6, vx: 0, vy: 0, g: 0, life: 0.5, max: 0.5, size: c * (0.1 + Math.random() * 0.08), color: '#78716c', kind: 'stone', land: ly, delay: i * 0.03 })
            }
            craters.push({ x: at!.sx, y: at!.sy, t0: now + 450 })
            impacts.push({ x: at!.sx, y: at!.sy, at: now + (reducedMotion ? 0 : 450) })
            break
          }
          case 'bossWarn':
            bossWarnUntil = now + 2800
            kick(4, 700)
            break
          case 'victory':
            victoryAt = now
            break
          case 'waveClear':
            burst(fort.sx, fort.sy - c * 1.0, 18, '#facc15', 1.2, 'spark')
            break
          case 'coinsFromHud':
            coinFly(l.width / 2, l.height - Math.min(260, l.height * 0.35), Math.min(10, Math.max(3, Math.round(f.amount / 6))))
            break
        }
      }
    }

    // Ambient life: water, lamps, flags, chimney smoke, birds, butterflies,
    // leaves and (temple) light motes. Cheap and derived from time only.
    const motes = Array.from({ length: reducedMotion ? 0 : 14 }, (_, i) => ({ x: ((i * 0.618) % 1) * l.width, s: 0.4 + ((i * 0.37) % 1) }))
    const drawAmbient = (now: number) => {
      const t = now / 1000
      if (ambient.water) {
        g.strokeStyle = 'rgba(255,255,255,0.55)'
        g.lineWidth = Math.max(1, c * 0.03)
        g.setLineDash([c * 0.12, c * 0.5])
        g.lineDashOffset = reducedMotion ? 0 : -t * c * 0.8
        g.beginPath()
        ambient.water.forEach(([x, y], i) => (i === 0 ? g.moveTo(x - c * 0.12, y) : g.lineTo(x - c * 0.12, y)))
        g.stroke()
        g.lineDashOffset = reducedMotion ? 0 : -t * c * 0.55 + c * 0.3
        g.beginPath()
        ambient.water.forEach(([x, y], i) => (i === 0 ? g.moveTo(x + c * 0.14, y) : g.lineTo(x + c * 0.14, y)))
        g.stroke()
        g.setLineDash([])
        g.lineDashOffset = 0
      }
      for (const lp of ambient.lamps) {
        const fl = reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 13 + lp.x) + 0.08 * Math.sin(t * 29 + lp.y)
        g.fillStyle = `rgba(253,186,116,${0.25 * fl})`
        g.beginPath()
        g.arc(lp.x, lp.y, c * 0.28 * fl, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#f97316'
        g.beginPath()
        g.ellipse(lp.x, lp.y, c * 0.05, c * 0.09 * fl, 0, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#fde68a'
        g.beginPath()
        g.ellipse(lp.x, lp.y + c * 0.02, c * 0.025, c * 0.05 * fl, 0, 0, Math.PI * 2)
        g.fill()
      }
      for (const f of ambient.flags) {
        const sag = c * 0.35
        const mx = (f.x1 + f.x2) / 2
        const my = (f.y1 + f.y2) / 2 + sag
        g.strokeStyle = 'rgba(87,83,78,0.7)'
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(f.x1, f.y1)
        g.quadraticCurveTo(mx, my, f.x2, f.y2)
        g.stroke()
        const cols = ['#f97316', '#facc15', '#14b8a6', '#ef4444', '#ffffff']
        for (let k = 1; k < 10; k++) {
          const u = k / 10
          const x = (1 - u) * (1 - u) * f.x1 + 2 * (1 - u) * u * mx + u * u * f.x2
          const y = (1 - u) * (1 - u) * f.y1 + 2 * (1 - u) * u * my + u * u * f.y2
          const sw = reducedMotion ? 0 : Math.sin(t * 3 + k) * c * 0.04
          g.fillStyle = cols[k % cols.length]
          g.beginPath()
          g.moveTo(x - c * 0.06, y)
          g.lineTo(x + c * 0.06, y)
          g.lineTo(x + sw, y + c * 0.16)
          g.fill()
        }
      }
      if (reducedMotion) return
      for (const ch of ambient.chimneys) {
        for (let k = 0; k < 3; k++) {
          const ph = (t * 0.45 + k / 3 + ch.x * 0.001) % 1
          g.fillStyle = `rgba(231,229,228,${0.45 * (1 - ph)})`
          g.beginPath()
          g.arc(ch.x + Math.sin(ph * 3 + k) * c * 0.1 + ph * c * 0.2, ch.y - ph * c * 0.9, c * (0.06 + ph * 0.12), 0, Math.PI * 2)
          g.fill()
        }
      }
      if (ambient.theme === 'temple') {
        for (const m of motes) {
          const y = l.height - ((t * 18 * m.s + m.x) % (l.height + 40))
          g.fillStyle = `rgba(253,224,71,${0.35 + 0.25 * Math.sin(t * 2 + m.x)})`
          g.beginPath()
          g.arc(m.x + Math.sin(t + m.x) * c * 0.3, y, c * 0.025 * (1 + m.s), 0, Math.PI * 2)
          g.fill()
        }
      } else {
        for (let k = 0; k < 3; k++) {
          const bx = ((t * 0.02 * (k + 1) + k * 0.33) % 1) * l.width
          const by = l.height * (0.2 + 0.3 * k) + Math.sin(t * 1.3 + k) * c * 0.6
          const flap = Math.abs(Math.sin(t * 14 + k))
          g.fillStyle = k === 1 ? '#f472b6' : '#fde047'
          g.beginPath()
          g.ellipse(bx - c * 0.04, by, c * 0.05 * flap + 1, c * 0.04, -0.4, 0, Math.PI * 2)
          g.ellipse(bx + c * 0.04, by, c * 0.05 * flap + 1, c * 0.04, 0.4, 0, Math.PI * 2)
          g.fill()
        }
      }
      // A small flock of birds crossing now and then.
      const cyc = (t % 26) / 9
      if (cyc < 1) {
        const bx = -c + cyc * (l.width + 2 * c)
        const by = l.height * 0.18 + Math.sin(cyc * 3) * c * 0.4
        g.strokeStyle = 'rgba(41,37,36,0.65)'
        g.lineWidth = Math.max(1.2, c * 0.02)
        for (let k = 0; k < 4; k++) {
          const ox = bx - k * c * 0.3
          const oy = by + (k % 2) * c * 0.2 + k * c * 0.08
          const w = Math.sin(t * 12 + k) * c * 0.04
          g.beginPath()
          g.moveTo(ox - c * 0.1, oy - w)
          g.quadraticCurveTo(ox - c * 0.05, oy - c * 0.06, ox, oy)
          g.quadraticCurveTo(ox + c * 0.05, oy - c * 0.06, ox + c * 0.1, oy - w)
          g.stroke()
        }
      }
      // A few leaves drifting across.
      for (let k = 0; k < 4; k++) {
        const u = (t * 0.035 + k * 0.27) % 1
        const lx = u * (l.width + 2 * c) - c
        const ly = ((k * 0.29 + 0.1) % 1) * l.height + Math.sin(t * 1.7 + k) * c * 0.5 + u * c * 1.5
        g.save()
        g.translate(lx, ly)
        g.rotate(t * 2 + k)
        g.fillStyle = k % 2 ? 'rgba(101,163,13,0.8)' : 'rgba(202,138,4,0.75)'
        g.beginPath()
        g.ellipse(0, 0, c * 0.06, c * 0.03, 0, 0, Math.PI * 2)
        g.fill()
        g.restore()
      }
    }

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const s = stateRef.current
      if (!s) return
      const now = performance.now()
      const dt = 1 / 60
      spawnFx(now)
      for (let i = impacts.length - 1; i >= 0; i--) {
        if (impacts[i].at > now) continue
        burst(impacts[i].x, impacts[i].y, 26, '#a8a29e', 1.4, 'smoke')
        kick(7, 350)
        impacts.splice(i, 1)
      }
      const clock = clockRef.current
      const alpha = clock.running ? Math.min(1, Math.max(0, (now - clock.lastStepAt) / (STEP_MS / clock.speed))) : 1
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (kickUntil > now) {
        const k = (kickUntil - now) / 400
        g.translate((Math.random() - 0.5) * kickMag * k, (Math.random() - 0.5) * kickMag * k)
      } else kickMag = 0
      g.drawImage(bg, 0, 0, l.width, l.height)

      // Drifting cloud shadows (ambient).
      if (!reducedMotion) {
        for (let k = 0; k < 3; k++) {
          const u = ((now / 60000 + k * 0.37) % 1.4) - 0.2
          g.fillStyle = 'rgba(20,50,20,0.06)'
          g.beginPath()
          g.ellipse(u * l.width, l.height * (0.25 + k * 0.28), c * 3, c * 1.6, 0.2, 0, Math.PI * 2)
          g.fill()
        }
      }
      drawAmbient(now)
      // Stone Rain craters.
      for (let i = craters.length - 1; i >= 0; i--) {
        const cr = craters[i]
        const age = (now - cr.t0) / 2500
        if (age > 1) {
          craters.splice(i, 1)
          continue
        }
        if (age < 0) continue
        g.fillStyle = `rgba(87,64,40,${0.35 * (1 - age)})`
        g.beginPath()
        g.ellipse(cr.x, cr.y, STRIKE_RADIUS * c * 0.7, STRIKE_RADIUS * c * 0.45, 0, 0, Math.PI * 2)
        g.fill()
      }

      drawGate(g, gate.sx, gate.sy, c, now, s.phase === 'wave')

      // Pads and range ring.
      const sel = selectedRef.current
      const invite = inviteRef.current
      const builtPads = new Set(s.towers.map((t) => t.padId))
      for (const pad of s.map.pads) {
        if (builtPads.has(pad.id)) continue
        const p = toScreen(l, pad.x, pad.y)
        drawPad(g, p.sx, p.sy, c, now, pad.id === sel, pad.id === invite || (s.phase === 'prep' && s.towers.length === 0 && !reducedMotion))
      }
      const selTower = sel ? s.towers.find((t) => t.padId === sel) : undefined
      if (selTower) {
        const p = toScreen(l, selTower.x, selTower.y)
        const rr = statsFor(selTower.type, selTower.level).range * c
        g.fillStyle = 'rgba(250,204,21,0.12)'
        g.strokeStyle = 'rgba(234,179,8,0.9)'
        g.lineWidth = 2
        g.setLineDash([8, 6])
        g.beginPath()
        g.arc(p.sx, p.sy, rr, 0, Math.PI * 2)
        g.fill()
        g.stroke()
        g.setLineDash([])
      }

      // Depth-sorted actors: towers, enemies, fort.
      type Actor = { y: number; draw: () => void }
      const actors: Actor[] = []
      const rally = s.rallyUntil > s.timeMs
      for (const t of s.towers) {
        let seen = towerSeen.get(t.id)
        if (!seen) {
          seen = { born: now, level: t.level, levelAt: 0, type: t.type, x: t.x, y: t.y }
          towerSeen.set(t.id, seen)
        }
        if (seen.level !== t.level) {
          seen.level = t.level
          seen.levelAt = now
        }
        const p = toScreen(l, t.x, t.y)
        const build = reducedMotion ? 1 : Math.min(1, (now - seen.born) / 450)
        const upPop = seen.levelAt && !reducedMotion ? Math.max(0, 1 - (now - seen.levelAt) / 400) : 0
        const recoil = Math.max(0, 1 - (s.timeMs - t.firedAt) / 220)
        const interval = statsFor(t.type, t.level).fireIntervalMs
        const charge = Math.max(0, Math.min(1, 1 - t.cooldown / interval))
        actors.push({
          y: p.sy,
          draw: () => {
            g.save()
            if (upPop > 0) {
              const k = 1 + 0.18 * Math.sin(upPop * Math.PI)
              g.translate(p.sx, p.sy)
              g.scale(k, k)
              g.translate(-p.sx, -p.sy)
            }
            drawTower(g, t.type, t.level, p.sx, p.sy, c, { angle: screenAngle(l, t.angle), recoil, time: now + t.id * 97, build, rally, selected: t.padId === sel, charge: s.phase === 'wave' ? charge : 0 })
            g.restore()
          },
        })
      }
      for (const [id, info] of Array.from(towerSeen.entries())) {
        if (s.towers.some((x) => x.id === id)) continue
        // Sold: the tower sinks away.
        const gp = toScreen(l, info.x, info.y)
        towerGhosts.push({ type: info.type, level: info.level, x: gp.sx, y: gp.sy, t0: now })
        towerSeen.delete(id)
      }
      for (let i = towerGhosts.length - 1; i >= 0; i--) {
        const tg = towerGhosts[i]
        const k = (now - tg.t0) / 320
        if (k >= 1) {
          towerGhosts.splice(i, 1)
          continue
        }
        actors.push({
          y: tg.y,
          draw: () => {
            g.save()
            g.globalAlpha = 1 - k
            drawTower(g, tg.type, tg.level, tg.x, tg.y, c, { angle: 0, recoil: 0, time: now, build: 1 - k, rally: false, selected: false })
            g.restore()
          },
        })
      }
      const frozenAll = s.freezeUntil > s.timeMs
      for (const e of s.enemies) {
        const ix = e.prevX + (e.x - e.prevX) * alpha
        const iy = e.prevY + (e.y - e.prevY) * alpha
        const p = toScreen(l, ix, iy)
        const pp = toScreen(l, e.prevX, e.prevY)
        const cur = toScreen(l, e.x, e.y)
        const facing = cur.sx - pp.sx < -0.01 ? -1 : 1
        const r = e.radius * c
        let born = enemySeen.get(e.id)
        if (born === undefined) {
          born = now
          enemySeen.set(e.id, born)
          if (e.isBoss && !bossSeen && e.maxHp > 2500) {
            bossSeen = true
            burst(gate.sx, gate.sy, reducedMotion ? 3 : 40, '#c4b5fd', 1.8, 'spark')
            particles.push({ x: gate.sx, y: gate.sy, vx: 0, vy: 0, g: 0, life: 0.9, max: 0.9, size: c * 2.5, color: 'rgba(139,92,246,0.9)', kind: 'orb' })
          }
        }
        const spawnK = reducedMotion ? 1 : Math.min(1, (now - born) / (e.isBoss ? 700 : 260))
        const squash = s.timeMs < e.hitFlashUntil ? Math.max(0, (e.hitFlashUntil - s.timeMs) / 120) : 0
        actors.push({
          y: p.sy,
          draw: () => {
            drawEnemy(g, e.kind, p.sx, p.sy - r * 0.35, r, {
              time: now,
              id: e.id,
              facing,
              flash: s.timeMs < e.hitFlashUntil,
              frozen: frozenAll,
              slowed: e.slowFactor < 1,
              enraged: e.enraged,
              scale: spawnK < 1 ? 0.3 + 0.7 * spawnK : 1,
              alpha: spawnK < 1 ? spawnK : 1,
              squash: Math.min(1, squash),
              casting: e.isBoss && bossCastUntil > now,
            })
            // Health bar.
            if (e.hp < e.maxHp && !e.isBoss) {
              const w = Math.max(c * 0.5, r * 2)
              const hx = p.sx - w / 2
              const hy = p.sy - r * 1.75 - c * 0.1
              g.fillStyle = 'rgba(28,25,23,0.6)'
              g.beginPath()
              g.roundRect(hx - 1.5, hy - 1.5, w + 3, c * 0.075 + 3, 3)
              g.fill()
              const pct = Math.max(0, e.hp / e.maxHp)
              g.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#eab308' : '#ef4444'
              g.beginPath()
              g.roundRect(hx, hy, w * pct, c * 0.075, 2)
              g.fill()
            }
          },
        })
      }
      const out = outcomeRef.current
      actors.push({ y: fort.sy + c * 0.3, draw: () => {
        g.save()
        g.translate(fort.sx, fort.sy)
        g.scale(fortScale, fortScale)
        g.translate(-fort.sx, -fort.sy)
        if (fortHealAt && now - fortHealAt < 1200) {
          const k = (now - fortHealAt) / 1200
          g.fillStyle = `rgba(74,222,128,${0.35 * (1 - k)})`
          g.beginPath()
          g.ellipse(fort.sx, fort.sy - c * 0.3, c * 1.3, c * 1.1, 0, 0, Math.PI * 2)
          g.fill()
        }
        drawFort(g, fort.sx, fort.sy, c, s.baseHp / s.maxBaseHp, now, out === 'victory', out === 'defeat')
        if (fortHitAt && now - fortHitAt < 320) {
          const k = (now - fortHitAt) / 320
          g.fillStyle = `rgba(239,68,68,${0.4 * (1 - k)})`
          g.beginPath()
          g.ellipse(fort.sx, fort.sy - c * 0.4, c * 1.15, c * 1.0, 0, 0, Math.PI * 2)
          g.fill()
        }
        g.restore()
      } })
      if (enemySeen.size > s.enemies.length + 50) for (const id of Array.from(enemySeen.keys())) if (!s.enemies.some((e) => e.id === id)) enemySeen.delete(id)
      actors.sort((a, b) => a.y - b.y)
      for (const a of actors) a.draw()

      // Defeated enemies: shrink, rise and fade.
      for (let i = ghosts.length - 1; i >= 0; i--) {
        const gh = ghosts[i]
        const dur = gh.kind === 'boss' ? 1300 : 420
        const k = (now - gh.t0) / dur
        if (k >= 1) {
          ghosts.splice(i, 1)
          continue
        }
        const pop = k < 0.2 ? 1 + k * 1.2 : 1.24 - (k - 0.2) * 1.3
        drawEnemy(g, gh.kind, gh.x, gh.y - gh.r * 0.35 - k * c * 0.5, gh.r, { time: now, id: 0, facing: gh.facing, flash: k < 0.25, frozen: false, slowed: false, enraged: false, alpha: 1 - k * k, scale: Math.max(0.05, pop), spin: reducedMotion ? 0 : k * (gh.kind === 'boss' ? 2.5 : 4) })
      }

      // Projectiles.
      for (const pr of s.projectiles) {
        const ix = pr.prevX + (pr.x - pr.prevX) * alpha
        const iy = pr.prevY + (pr.y - pr.prevY) * alpha
        const p = toScreen(l, ix, iy)
        let st = projStart.get(pr.id)
        if (!st) {
          st = { x: pr.prevX, y: pr.prevY }
          projStart.set(pr.id, st)
        }
        const total = Math.hypot(pr.tx - st.x, pr.ty - st.y) || 1
        const done = Math.min(1, Math.hypot(ix - st.x, iy - st.y) / total)
        const prev = toScreen(l, pr.prevX, pr.prevY)
        const ang = Math.atan2(p.sy - prev.sy, p.sx - prev.sx)
        if (pr.towerType === 'yanai') {
          const lift = Math.sin(done * Math.PI) * c * 0.9
          if (!reducedMotion && Math.random() < 0.5) particles.push({ x: p.sx, y: p.sy - lift, vx: 0, vy: -c * 0.2, g: 0, life: 0.35, max: 0.35, size: c * 0.04, color: 'rgba(214,211,209,0.9)', kind: 'smoke' })
          g.fillStyle = 'rgba(0,0,0,0.2)'
          g.beginPath()
          g.ellipse(p.sx, p.sy, c * 0.08, c * 0.04, 0, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#44403c'
          g.beginPath()
          g.arc(p.sx, p.sy - lift, c * 0.1, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#a8a29e'
          g.beginPath()
          g.arc(p.sx - c * 0.03, p.sy - lift - c * 0.03, c * 0.035, 0, Math.PI * 2)
          g.fill()
        } else {
          const kuri = pr.towerType === 'kuri'
          const lift = c * 0.45 * (1 - done)
          g.save()
          g.translate(p.sx, p.sy - lift)
          g.rotate(ang)
          if (!kuri) {
            g.strokeStyle = 'rgba(255,255,255,0.45)'
            g.lineWidth = Math.max(1, c * 0.025)
            g.beginPath()
            g.moveTo(-c * 0.5, 0)
            g.lineTo(-c * 0.2, 0)
            g.stroke()
          }
          if (kuri) {
            g.strokeStyle = 'rgba(192,132,252,0.55)'
            g.lineWidth = c * 0.08
            g.beginPath()
            g.moveTo(-c * 0.45, 0)
            g.lineTo(0, 0)
            g.stroke()
          }
          g.strokeStyle = kuri ? '#f5f3ff' : '#78350f'
          g.lineWidth = Math.max(1.5, c * 0.03)
          g.beginPath()
          g.moveTo(-c * 0.22, 0)
          g.lineTo(c * 0.1, 0)
          g.stroke()
          g.fillStyle = kuri ? '#a855f7' : '#cbd5e1'
          g.beginPath()
          g.moveTo(c * 0.1, -c * 0.045)
          g.lineTo(c * 0.2, 0)
          g.lineTo(c * 0.1, c * 0.045)
          g.fill()
          g.restore()
        }
      }
      for (const id of Array.from(projStart.keys())) if (!s.projectiles.some((p) => p.id === id)) projStart.delete(id)

      // Particles.
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        if (p.delay && p.delay > 0) {
          p.delay -= dt
          continue
        }
        p.life -= dt
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        const k = 1 - p.life / p.max
        if (p.kind === 'beam') {
          const a2 = 1 - k
          const grad = g.createLinearGradient(p.x, p.y - c * 2.2, p.x, p.y)
          grad.addColorStop(0, 'rgba(253,230,138,0)')
          grad.addColorStop(1, `rgba(253,230,138,${0.75 * a2})`)
          g.fillStyle = grad
          g.fillRect(p.x - p.size * (0.6 + k * 0.4), p.y - c * 2.2, p.size * 2 * (0.6 + k * 0.4), c * 2.2)
          continue
        }
        if (p.kind === 'ice') {
          const e = Math.min(1, k * 1.1)
          const cx = p.x + (p.tx! - p.x) * e
          const cy = p.y + (p.ty! - p.y) * e
          g.strokeStyle = 'rgba(186,230,253,0.8)'
          g.lineWidth = Math.max(1.5, c * 0.03)
          g.beginPath()
          g.moveTo(p.x + (p.tx! - p.x) * Math.max(0, e - 0.3), p.y + (p.ty! - p.y) * Math.max(0, e - 0.3))
          g.lineTo(cx, cy)
          g.stroke()
          g.fillStyle = p.color
          g.beginPath()
          g.arc(cx, cy, p.size, 0, Math.PI * 2)
          g.fill()
          continue
        }
        if (p.kind === 'coin' || (p.kind === 'orb' && p.tx !== undefined)) {
          const e = k * k * (3 - 2 * k)
          const x0 = p.x
          const y0 = p.y
          const cx = x0 + (p.tx! - x0) * e
          const cy = y0 + (p.ty! - y0) * e - Math.sin(e * Math.PI) * c * 1.2
          g.fillStyle = p.color
          g.beginPath()
          g.arc(cx, cy, p.size, 0, Math.PI * 2)
          g.fill()
          if (p.kind === 'coin') {
            g.strokeStyle = '#a16207'
            g.lineWidth = Math.max(1, p.size * 0.3)
            g.stroke()
          }
          continue
        }
        if (p.kind === 'stone') {
          const fall = Math.min(1, k * 1.25)
          const y = p.y + (p.land! - p.y) * fall * fall
          g.fillStyle = `rgba(0,0,0,${0.25 * fall})`
          g.beginPath()
          g.ellipse(p.x, p.land!, p.size * fall, p.size * 0.5 * fall, 0, 0, Math.PI * 2)
          g.fill()
          if (fall < 1) {
            g.fillStyle = p.color
            g.beginPath()
            g.arc(p.x, y, p.size, 0, Math.PI * 2)
            g.fill()
          }
          continue
        }
        p.vy += p.g * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.kind === 'text') {
          g.globalAlpha = Math.min(1, p.life / p.max * 1.5)
          g.font = `800 ${Math.round(p.size)}px Inter, system-ui, sans-serif`
          g.textAlign = 'center'
          g.lineWidth = 4
          g.strokeStyle = 'rgba(255,255,255,0.9)'
          g.strokeText(p.text!, p.x, p.y)
          g.fillStyle = p.color
          g.fillText(p.text!, p.x, p.y)
          g.globalAlpha = 1
        } else if (p.kind === 'orb') {
          g.strokeStyle = p.color
          g.globalAlpha = 1 - k
          g.lineWidth = Math.max(2, c * 0.06)
          g.beginPath()
          g.arc(p.x, p.y, p.size * (0.3 + 0.7 * k), 0, Math.PI * 2)
          g.stroke()
          g.globalAlpha = 1
        } else if (p.kind === 'smoke') {
          g.fillStyle = p.color
          g.globalAlpha = 0.7 * (1 - k)
          g.beginPath()
          g.arc(p.x, p.y, p.size * (1.5 + k * 2.5), 0, Math.PI * 2)
          g.fill()
          g.globalAlpha = 1
        } else if (p.kind === 'flake') {
          g.fillStyle = 'rgba(255,255,255,0.9)'
          g.beginPath()
          g.arc(p.x + Math.sin(now / 300 + i) * c * 0.1, p.y, p.size, 0, Math.PI * 2)
          g.fill()
        } else {
          g.fillStyle = p.color
          g.globalAlpha = 1 - k
          g.beginPath()
          g.arc(p.x, p.y, p.size * (p.kind === 'spark' ? 1 - k * 0.5 : 1), 0, Math.PI * 2)
          g.fill()
          g.globalAlpha = 1
        }
      }
      if (particles.length > 700) particles.splice(0, particles.length - 700)

      // War Drum: rhythmic orange pulses from every tower.
      if (rally && !reducedMotion) {
        const beat = ((now - rallyPulseAt) % 600) / 600
        for (const t of s.towers) {
          const p = toScreen(l, t.x, t.y)
          g.strokeStyle = `rgba(249,115,22,${0.6 * (1 - beat)})`
          g.lineWidth = Math.max(2, c * 0.05)
          g.beginPath()
          g.ellipse(p.sx, p.sy, c * (0.3 + beat * 0.5), c * (0.3 + beat * 0.5) * TILT, 0, 0, Math.PI * 2)
          g.stroke()
        }
      }

      // Screen treatments.
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (freezeWaveAt && now - freezeWaveAt < 900) {
        const k = (now - freezeWaveAt) / 900
        const R = Math.hypot(l.width, l.height) * k
        g.strokeStyle = `rgba(224,242,254,${0.85 * (1 - k)})`
        g.lineWidth = c * 0.5 * (1 - k * 0.5)
        g.beginPath()
        g.arc(fort.sx, fort.sy, R, 0, Math.PI * 2)
        g.stroke()
        g.strokeStyle = `rgba(125,211,252,${0.6 * (1 - k)})`
        g.lineWidth = c * 0.15
        g.beginPath()
        g.arc(fort.sx, fort.sy, Math.max(0, R - c * 0.5), 0, Math.PI * 2)
        g.stroke()
      }
      for (let i = rallyWaves.length - 1; i >= 0; i--) {
        const k = (now - rallyWaves[i]) / 700
        if (k < 0) continue
        if (k >= 1) {
          rallyWaves.splice(i, 1)
          continue
        }
        g.strokeStyle = `rgba(249,115,22,${0.55 * (1 - k)})`
        g.lineWidth = c * 0.18
        g.beginPath()
        g.arc(l.ox + l.fieldW / 2, l.oy + l.fieldH / 2, Math.hypot(l.fieldW, l.fieldH) * 0.55 * k, 0, Math.PI * 2)
        g.stroke()
      }
      if (flash && flash.until > now) {
        g.fillStyle = `rgba(${flash.color},${0.35 * ((flash.until - now) / flash.dur)})`
        g.fillRect(0, 0, l.width, l.height)
      }
      if (s.baseHp / s.maxBaseHp <= 0.3 && s.baseHp > 0 && !reducedMotion) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 700)
        const grad = g.createRadialGradient(l.width / 2, l.height / 2, Math.min(l.width, l.height) * 0.4, l.width / 2, l.height / 2, Math.max(l.width, l.height) * 0.75)
        grad.addColorStop(0, 'rgba(220,38,38,0)')
        grad.addColorStop(1, `rgba(220,38,38,${0.12 * pulse})`)
        g.fillStyle = grad
        g.fillRect(0, 0, l.width, l.height)
      }
      if (s.freezeUntil > s.timeMs || freezeFxUntil > now) {
        const grad = g.createRadialGradient(l.width / 2, l.height / 2, Math.min(l.width, l.height) * 0.3, l.width / 2, l.height / 2, Math.max(l.width, l.height) * 0.7)
        grad.addColorStop(0, 'rgba(224,242,254,0)')
        grad.addColorStop(1, 'rgba(186,230,253,0.55)')
        g.fillStyle = grad
        g.fillRect(0, 0, l.width, l.height)
      }
      if (rally) {
        const grad = g.createRadialGradient(l.width / 2, l.height / 2, Math.min(l.width, l.height) * 0.35, l.width / 2, l.height / 2, Math.max(l.width, l.height) * 0.75)
        grad.addColorStop(0, 'rgba(251,146,60,0)')
        grad.addColorStop(1, 'rgba(251,146,60,0.18)')
        g.fillStyle = grad
        g.fillRect(0, 0, l.width, l.height)
      }
      if (bossWarnUntil > now) {
        const k = (bossWarnUntil - now) / 2800
        const pulse = 0.5 + 0.5 * Math.sin(now / 160)
        g.fillStyle = `rgba(30,10,50,${0.35 * Math.min(1, k * 2)})`
        g.fillRect(0, 0, l.width, l.height)
        const grad = g.createRadialGradient(l.width / 2, l.height / 2, Math.min(l.width, l.height) * 0.3, l.width / 2, l.height / 2, Math.max(l.width, l.height) * 0.7)
        grad.addColorStop(0, 'rgba(190,18,60,0)')
        grad.addColorStop(1, `rgba(190,18,60,${0.35 * pulse * k})`)
        g.fillStyle = grad
        g.fillRect(0, 0, l.width, l.height)
      }
      if (out === 'defeat') {
        g.fillStyle = 'rgba(28,25,23,0.3)'
        g.fillRect(0, 0, l.width, l.height)
      }
      // Victory fireworks over the fort.
      if (victoryAt && now - victoryAt < 4000 && !reducedMotion && Math.random() < 0.08) {
        const fx0 = fort.sx + (Math.random() - 0.5) * c * 3
        const fy0 = fort.sy - c * (1.5 + Math.random() * 1.5)
        const col = ['#facc15', '#14b8a6', '#f97316', '#ffffff', '#a855f7'][Math.floor(Math.random() * 5)]
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2
          particles.push({ x: fx0, y: fy0, vx: Math.cos(a) * c * 2.4, vy: Math.sin(a) * c * 2.4, g: c * 1.5, life: 0.9, max: 0.9, size: c * 0.05, color: col, kind: 'spark' })
        }
      }
      // Stone Rain target reticle.
      if (strikeRef.current && hoverRef.current) {
        const p = toScreen(l, hoverRef.current.x, hoverRef.current.y)
        const rr = STRIKE_RADIUS * c
        const spin = now / 400
        g.strokeStyle = 'rgba(234,88,12,0.95)'
        g.lineWidth = 3
        g.setLineDash([10, 8])
        g.lineDashOffset = -spin * 20
        g.beginPath()
        g.arc(p.sx, p.sy, rr, 0, Math.PI * 2)
        g.stroke()
        g.setLineDash([])
        g.fillStyle = 'rgba(234,88,12,0.12)'
        g.fill()
        g.beginPath()
        g.moveTo(p.sx - c * 0.25, p.sy)
        g.lineTo(p.sx + c * 0.25, p.sy)
        g.moveTo(p.sx, p.sy - c * 0.25)
        g.lineTo(p.sx, p.sy + c * 0.25)
        g.stroke()
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      particles.length = 0
      ghosts.length = 0
    }
  }, [layout, stateRef, fxRef, clockRef, coinTargetRef, reducedMotion])

  const state = stateRef.current
  const padSize = Math.max(44, layout.cell * 0.85)
  const worldPoint = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return toWorld(layout, e.clientX - r.left, e.clientY - r.top)
  }

  return (
    <div className="absolute inset-0 select-none" style={{ touchAction: 'manipulation' }}>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full ${strikeMode ? 'cursor-crosshair' : ''}`}
        role="img"
        aria-label={`Battlefield: ${state?.map.name ?? ''}. Enemies walk the road from the gate to your fort.`}
        onPointerMove={(e) => {
          if (strikeMode) hoverRef.current = worldPoint(e)
        }}
        onPointerDown={(e) => {
          if (strikeMode) {
            hoverRef.current = worldPoint(e)
            onFieldClick(worldPoint(e))
          } else onEmptyClick()
        }}
      />
      {!strikeMode &&
        state?.map.pads.map((pad) => {
          const tower = state.towers.find((t) => t.padId === pad.id)
          const p = toScreen(layout, pad.x, pad.y)
          return (
            <button
              key={`${pad.id}-${version}`}
              type="button"
              data-pad={pad.id}
              onClick={() => onPadClick(pad.id)}
              aria-pressed={selectedPadId === pad.id}
              aria-label={tower ? `${getTowerType(tower.type as TowerTypeId).name}, level ${tower.level}` : 'Empty build spot'}
              className="absolute rounded-full focus:outline-none focus-visible:outline-2 focus-visible:outline-dashed focus-visible:outline-white"
              style={{ left: p.sx - padSize / 2, top: p.sy - padSize / 2 - (tower ? layout.cell * 0.25 : 0), width: padSize, height: padSize + (tower ? layout.cell * 0.3 : 0) }}
            />
          )
        })}
    </div>
  )
}
