'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'
import { getTowerType, statsFor, STEP_MS, STRIKE_RADIUS, type TdState, type TowerTypeId } from '@/lib/gameRoomV2/towerDefense'
import type { EnemyKind } from '@/lib/gameRoomV2/towerDefense/waves'
import { drawTower, drawEnemy, drawPad, drawFort, drawGate, paintTerrain, gateAndFort } from './art'
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
  kind: 'dot' | 'smoke' | 'coin' | 'stone' | 'flake' | 'text' | 'orb' | 'spark'
  text?: string
  tx?: number
  ty?: number
  delay?: number
  land?: number // for falling stones: ground y
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
    paintTerrain(bgc, l, state0.map)
    const c = l.cell
    const { gate, fort, scale: fortScale } = gateAndFort(l, state0.map)

    const particles: Particle[] = []
    const ghosts: Ghost[] = []
    const craters: { x: number; y: number; t0: number }[] = []
    // Stone Rain impacts land a beat after the stones start falling.
    const impacts: { x: number; y: number; at: number }[] = []
    const towerSeen = new Map<number, { born: number; level: number; levelAt: number }>()
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
            break
          case 'upgrade':
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
          case 'frost':
            particles.push({ x: at!.sx, y: at!.sy, vx: 0, vy: 0, g: 0, life: 0.5, max: 0.5, size: (f.radius ?? 2) * c, color: 'rgba(125,211,252,0.8)', kind: 'orb' })
            break
          case 'kill': {
            ghosts.push({ kind: f.enemy, x: at!.sx, y: at!.sy, r: (f.enemy === 'boss' ? 0.55 : f.enemy === 'brute' ? 0.36 : f.enemy === 'swarm' ? 0.16 : 0.24) * c, t0: now, facing: 1 })
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
            break
          case 'enrage':
            burst(at!.sx, at!.sy, 30, '#fb7185', 1.6, 'spark')
            kick(6, 450)
            break
          case 'leak':
            burst(fort.sx, fort.sy - c * 0.2, 14, '#a8a29e', 1, 'smoke')
            kick(5, 300)
            break
          case 'ring':
            particles.push({ x: at!.sx, y: at!.sy, vx: 0, vy: 0, g: 0, life: f.dur / 1000, max: f.dur / 1000, size: f.r1 * c, color: f.color, kind: 'orb' })
            break
          case 'freeze':
            freezeFxUntil = now + 3500
            for (let i = 0; i < (reducedMotion ? 10 : 70); i++) particles.push({ x: Math.random() * l.width, y: -Math.random() * l.height * 0.5, vx: (Math.random() - 0.5) * c * 0.4, vy: c * (1.2 + Math.random()), g: 0, life: 3.2, max: 3.2, size: c * (0.04 + Math.random() * 0.05), color: '#ffffff', kind: 'flake' })
            break
          case 'rally':
            rallyPulseAt = now
            break
          case 'repair': {
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
          seen = { born: now, level: t.level, levelAt: 0 }
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
            drawTower(g, t.type, t.level, p.sx, p.sy, c, { angle: screenAngle(l, t.angle), recoil, time: now + t.id * 97, build, rally, selected: t.padId === sel })
            g.restore()
          },
        })
      }
      for (const t of Array.from(towerSeen.keys())) if (!s.towers.some((x) => x.id === t)) towerSeen.delete(t)
      const frozenAll = s.freezeUntil > s.timeMs
      for (const e of s.enemies) {
        const ix = e.prevX + (e.x - e.prevX) * alpha
        const iy = e.prevY + (e.y - e.prevY) * alpha
        const p = toScreen(l, ix, iy)
        const pp = toScreen(l, e.prevX, e.prevY)
        const cur = toScreen(l, e.x, e.y)
        const facing = cur.sx - pp.sx < -0.01 ? -1 : 1
        const r = e.radius * c
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
        drawFort(g, fort.sx, fort.sy, c, s.baseHp / s.maxBaseHp, now, out === 'victory', out === 'defeat')
        g.restore()
      } })
      actors.sort((a, b) => a.y - b.y)
      for (const a of actors) a.draw()

      // Defeated enemies: shrink, rise and fade.
      for (let i = ghosts.length - 1; i >= 0; i--) {
        const gh = ghosts[i]
        const k = (now - gh.t0) / 450
        if (k >= 1) {
          ghosts.splice(i, 1)
          continue
        }
        drawEnemy(g, gh.kind, gh.x, gh.y - gh.r * 0.35 - k * c * 0.4, gh.r, { time: now, id: 0, facing: gh.facing, flash: k < 0.2, frozen: false, slowed: false, enraged: false, alpha: 1 - k, scale: 1 - k * 0.6 })
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
          g.ellipse(p.sx, p.sy, c * (0.3 + beat * 0.5), c * (0.13 + beat * 0.22), 0, 0, Math.PI * 2)
          g.stroke()
        }
      }

      // Screen treatments.
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
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
