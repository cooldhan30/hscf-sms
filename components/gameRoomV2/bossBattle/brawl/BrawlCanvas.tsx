'use client'

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { GiShield } from 'react-icons/gi'
import {
  WORLD_W,
  WORLD_H,
  STEP,
  stepBrawl,
  isPaused,
  silambuStaffs,
  boss as bossOf,
  playerStats,
  type BrawlState,
  type BrawlEvent,
  type Enemy,
} from '@/lib/gameRoomV2/bossBattle/brawl'
import { drawHero, drawEnemy, drawGolem, drawIrulKing } from './art'
import { paintArena, drawAmbient, drawHazards, createAmbient, MARGIN } from './scenery'

// The Boss Battle playfield: one full-viewport canvas. It owns the
// fixed-step game loop (60 Hz simulation steps on requestAnimationFrame,
// rendered with interpolation), the camera, all visual effects, and the
// controls (keyboard + multi-touch joystick and dash button). React only
// hears about gameplay through `onEvents` and a throttled `onTick` -- no
// setState per frame.

export interface Camera {
  scale: number
}

// Uniform scale (never stretched): a landscape screen always shows about
// the same ~1350 x 760 world units (nearly the whole arena, characters
// easy to read); a portrait screen follows the hero. Extra room shows the
// scenery around the arena rather than a bigger board.
export function cameraScale(vw: number, vh: number) {
  return Math.max(Math.min(vw, vh) / 760, 0.5)
}

// The camera frames the ARENA (plus a border of scenery), never drifts
// off into the scenery margin while part of the arena is cut off.
const CAM_PAD = 150

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  kind: 'dot' | 'smoke' | 'ring' | 'text' | 'spark' | 'gem'
  text?: string
}

export function BrawlCanvas({
  stateRef,
  runningRef,
  width,
  height,
  reducedMotion,
  controlsEnabled,
  onEvents,
  onTick,
}: {
  stateRef: MutableRefObject<BrawlState | null>
  runningRef: MutableRefObject<boolean>
  width: number
  height: number
  reducedMotion: boolean
  controlsEnabled: boolean
  onEvents: (ev: BrawlEvent[]) => void
  onTick: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const keys = useRef(new Set<string>())
  const stick = useRef<{ id: number; ox: number; oy: number; x: number; y: number } | null>(null)
  const dashQueued = useRef(false)
  const [stickView, setStickView] = useState<{ ox: number; oy: number; x: number; y: number } | null>(null)
  const [coarse, setCoarse] = useState(false)
  const [dashReady, setDashReady] = useState(1)
  const cbRef = useRef({ onEvents, onTick })
  cbRef.current = { onEvents, onTick }
  const enabledRef = useRef(controlsEnabled)
  enabledRef.current = controlsEnabled

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const set = () => setCoarse(mq.matches)
    set()
    mq.addEventListener('change', set)
    return () => mq.removeEventListener('change', set)
  }, [])

  // Controls released whenever they are disabled (question, upgrade,
  // pause) so nothing is ever left held down.
  useEffect(() => {
    if (controlsEnabled) return
    keys.current.clear()
    stick.current = null
    setStickView(null)
    dashQueued.current = false
  }, [controlsEnabled])

  // Keyboard.
  useEffect(() => {
    const MOVE = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!enabledRef.current) return
      if (MOVE.has(e.code)) {
        keys.current.add(e.code)
        e.preventDefault()
      } else if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (!e.repeat) dashQueued.current = true
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const release = () => {
      keys.current.clear()
      stick.current = null
      setStickView(null)
    }
    const onVis = () => document.visibilityState === 'hidden' && release()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const s0 = stateRef.current
    if (!canvas || !s0) return
    const g = canvas.getContext('2d')
    if (!g) return
    const arena = s0.arena
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const scale = cameraScale(width, height)
    // Static scenery, painted once per layout.
    const FW = WORLD_W + MARGIN * 2
    const FH = WORLD_H + MARGIN * 2
    const bs = Math.min(scale * dpr, Math.sqrt(7e6 / (FW * FH)))
    const bg = document.createElement('canvas')
    bg.width = Math.round(FW * bs)
    bg.height = Math.round(FH * bs)
    const bgc = bg.getContext('2d')!
    bgc.scale(bs, bs)
    bgc.translate(MARGIN, MARGIN)
    const spec = paintArena(bgc, arena)
    const amb = createAmbient(arena, reducedMotion)
    const edge = arena.id === 'volcano' ? '#7c2d12' : arena.id === 'forest' ? '#052e16' : arena.id === 'river' ? '#65a30d' : '#4d7c0f'

    const viewW = width / scale
    const viewH = height / scale
    const ab = arena.bounds
    const clampCam = (c: number, view: number, lo: number, hi: number) => {
      lo -= CAM_PAD
      hi += CAM_PAD
      return view >= hi - lo ? (lo + hi) / 2 : Math.max(lo + view / 2, Math.min(hi - view / 2, c))
    }
    let camX = clampCam(s0.player.x, viewW, ab.x0, ab.x1)
    let camY = clampCam(s0.player.y, viewH, ab.y0, ab.y1)

    const particles: Particle[] = []
    let shake = 0
    let flash: { color: string; until: number; dur: number } | null = null
    let hurtAt = -10
    let phaseAt = -10
    let victoryAt = 0
    let acc = 0
    let last = performance.now()
    let tickAcc = 0
    let raf = 0

    const kick = (mag: number) => {
      if (!reducedMotion) shake = Math.max(shake, mag)
    }
    const burst = (x: number, y: number, n: number, color: string, speed = 1, kind: Particle['kind'] = 'dot') => {
      if (reducedMotion) n = Math.min(n, 3)
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const v = (60 + Math.random() * 180) * speed
        particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5, max: 0.5, size: 3 + Math.random() * 3, color, kind })
      }
    }
    const text = (x: number, y: number, t: string, color: string, size = 18) => {
      if (particles.length > 520) return
      particles.push({ x: x + (Math.random() - 0.5) * 14, y, vx: 0, vy: -70, life: 0.75, max: 0.75, size, color, kind: 'text', text: t })
    }
    const ring = (x: number, y: number, r: number, color: string, life = 0.45) => particles.push({ x, y, vx: 0, vy: 0, life, max: life, size: r, color, kind: 'ring' })

    const handle = (ev: BrawlEvent[], now: number) => {
      for (const e of ev) {
        switch (e.type) {
          case 'hit':
            burst(e.x, e.y, e.crit ? 6 : 3, e.crit ? '#fde047' : '#fff7ed', 0.8)
            text(e.x, e.y - 24, String(e.dmg), e.crit ? '#f59e0b' : '#ffffff', e.crit ? 24 : 17)
            break
          case 'kill':
            burst(e.x, e.y, 10, e.kind === 'brute' ? '#fca5a5' : e.kind === 'swarm' ? '#bef264' : '#c4b5fd', 1.1, 'smoke')
            burst(e.x, e.y, 6, '#fde68a', 1.4, 'spark')
            break
          case 'hurt':
            hurtAt = now
            kick(9)
            burst(e.x, e.y, 8, '#ef4444', 1)
            text(e.x, e.y - 40, `-${e.dmg}`, '#ef4444', 22)
            break
          case 'dash':
            ring(e.x, e.y, 140, 'rgba(125,211,252,0.95)', 0.35)
            break
          case 'slam':
            ring(e.x, e.y, e.r, 'rgba(248,113,113,0.95)', 0.35)
            burst(e.x, e.y, 16, '#a8a29e', 1.3, 'smoke')
            kick(7)
            break
          case 'spawn':
            ring(e.x, e.y, 50, 'rgba(167,139,250,0.8)', 0.4)
            break
          case 'bossSpawn':
            ring(e.x, e.y, 220, 'rgba(139,92,246,0.9)', 0.9)
            kick(6)
            break
          case 'bossLanded':
            ring(e.x, e.y, 300, 'rgba(250,204,21,0.9)', 0.7)
            burst(e.x, e.y, 30, '#d6d3d1', 1.8, 'smoke')
            kick(14)
            break
          case 'bossPhase':
            phaseAt = now
            flash = { color: '244,63,94', until: now + 450, dur: 450 }
            ring(e.x, e.y, 420, 'rgba(244,63,94,0.9)', 1)
            kick(12)
            break
          case 'bossDefeated':
            flash = { color: '255,255,255', until: now + 500, dur: 500 }
            ring(e.x, e.y, 360, 'rgba(253,224,71,0.95)', 1.1)
            burst(e.x, e.y, 50, '#facc15', 2.2, 'spark')
            burst(e.x, e.y, 30, '#c4b5fd', 1.6, 'smoke')
            kick(16)
            break
          case 'levelUp': {
            const p = stateRef.current!.player
            ring(p.x, p.y, 110, 'rgba(250,204,21,0.95)', 0.6)
            burst(p.x, p.y, 20, '#fde047', 1.3, 'spark')
            break
          }
          case 'heal': {
            const p = stateRef.current!.player
            text(p.x, p.y - 50, `+${e.amount}`, '#22c55e', 24)
            burst(p.x, p.y, 12, '#86efac', 1, 'spark')
            break
          }
          case 'victory':
            victoryAt = now
            break
          case 'telegraph':
            if (e.kind === 'summon') ring(e.x, e.y, 160, 'rgba(167,139,250,0.9)', 0.9)
            break
        }
      }
      if (particles.length > 600) particles.splice(0, particles.length - 600)
      cbRef.current.onEvents(ev)
    }

    const input = () => {
      let mx = 0
      let my = 0
      const k = keys.current
      if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1
      if (k.has('KeyD') || k.has('ArrowRight')) mx += 1
      if (k.has('KeyW') || k.has('ArrowUp')) my -= 1
      if (k.has('KeyS') || k.has('ArrowDown')) my += 1
      const st = stick.current
      if (st) {
        const dx = st.x - st.ox
        const dy = st.y - st.oy
        const d = Math.hypot(dx, dy)
        if (d > 8) {
          const m = Math.min(1, d / 60)
          mx += (dx / d) * m
          my += (dy / d) * m
        }
      }
      const dash = dashQueued.current
      dashQueued.current = false
      return { mx, my, dash }
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const s = stateRef.current
      if (!s) return
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const live = runningRef.current && s.status === 'fighting' && !isPaused(s) && enabledRef.current
      if (live) {
        acc += dt
        while (acc >= STEP) {
          acc -= STEP
          const ev = stepBrawl(s, input())
          if (ev.length) handle(ev, now)
          if (s.status !== 'fighting' || isPaused(s)) {
            acc = 0
            break
          }
        }
      } else {
        acc = 0
        dashQueued.current = false
      }
      tickAcc += dt
      if (tickAcc > 0.12) {
        tickAcc = 0
        cbRef.current.onTick()
        const p = s.player
        setDashReady(p.dashCd <= 0 ? 1 : 1 - p.dashCd / playerStats(s).dashCd)
      }
      const alpha = live ? acc / STEP : 1
      const lerp = (a: number, b: number) => a + (b - a) * alpha
      const p = s.player
      const px = lerp(p.px, p.x)
      const py = lerp(p.py, p.y)
      const tt = now / 1000

      // Camera: follows the hero smoothly, never leaves the scenery.
      const follow = reducedMotion ? 1 : 1 - Math.pow(0.001, dt)
      camX += (clampCam(px, viewW, ab.x0, ab.x1) - camX) * follow
      camY += (clampCam(py, viewH, ab.y0, ab.y1) - camY) * follow
      let sx = 0
      let sy = 0
      if (shake > 0.2) {
        sx = (Math.random() - 0.5) * shake
        sy = (Math.random() - 0.5) * shake
        shake *= Math.pow(0.004, dt)
      } else shake = 0

      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = edge
      g.fillRect(0, 0, width, height)
      const k = scale * dpr
      g.setTransform(k, 0, 0, k, (width / 2 - (camX - sx) * scale) * dpr, (height / 2 - (camY - sy) * scale) * dpr)
      g.drawImage(bg, -MARGIN, -MARGIN, FW, FH)
      drawHazards(g, arena, s.hazards, tt, reducedMotion)
      drawAmbient(g, arena, spec, amb, tt, reducedMotion)

      // Telegraphs.
      for (const w of s.warnings) {
        const f = Math.min(1, w.t / w.dur)
        if (w.kind === 'circle') {
          g.fillStyle = `rgba(220,38,38,${0.22 + 0.2 * f})`
          g.beginPath()
          g.ellipse(w.x, w.y, w.r, w.r * 0.8, 0, 0, Math.PI * 2)
          g.fill()
          g.strokeStyle = '#b91c1c'
          g.lineWidth = 5
          g.stroke()
          g.strokeStyle = 'rgba(255,255,255,0.9)'
          g.lineWidth = 2
          g.stroke()
          g.fillStyle = `rgba(220,38,38,${0.35 + 0.2 * f})`
          g.beginPath()
          g.ellipse(w.x, w.y, w.r * f, w.r * 0.8 * f, 0, 0, Math.PI * 2)
          g.fill()
        } else {
          const ang = Math.atan2(w.y2 - w.y, w.x2 - w.x)
          const len = Math.hypot(w.x2 - w.x, w.y2 - w.y)
          g.save()
          g.translate(w.x, w.y)
          g.rotate(ang)
          g.fillStyle = `rgba(220,38,38,${0.24 + 0.2 * f})`
          g.fillRect(0, -w.r, len, w.r * 2)
          g.fillStyle = `rgba(220,38,38,${0.4})`
          g.fillRect(0, -w.r, len * f, w.r * 2)
          g.strokeStyle = '#b91c1c'
          g.lineWidth = 4
          g.strokeRect(0, -w.r, len, w.r * 2)
          g.restore()
        }
      }

      // Sparks (XP).
      for (const gm of s.gems) {
        const bob = Math.sin(tt * 5 + gm.id) * 3
        const r = gm.value >= 3 ? 8 : 6
        g.fillStyle = 'rgba(56,189,248,0.25)'
        g.beginPath()
        g.arc(gm.x, gm.y + bob, r * 2, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = gm.value >= 3 ? '#facc15' : '#38bdf8'
        g.beginPath()
        g.moveTo(gm.x, gm.y + bob - r * 1.3)
        g.lineTo(gm.x + r, gm.y + bob)
        g.lineTo(gm.x, gm.y + bob + r * 1.3)
        g.lineTo(gm.x - r, gm.y + bob)
        g.closePath()
        g.fill()
      }

      // Kural rings.
      for (const r of s.rings) {
        if (r.delay > 0) continue
        const f = Math.min(1, r.t / r.dur)
        g.strokeStyle = `rgba(250,204,21,${0.85 * (1 - f * 0.7)})`
        g.lineWidth = 8 * (1 - f) + 2
        g.beginPath()
        g.ellipse(px, py, r.r, r.r * 0.85, 0, 0, Math.PI * 2)
        g.stroke()
        g.strokeStyle = `rgba(255,255,255,${0.6 * (1 - f)})`
        g.lineWidth = 2
        g.beginPath()
        g.ellipse(px, py, r.r * 0.9, r.r * 0.76, 0, 0, Math.PI * 2)
        g.stroke()
      }

      // Characters, depth-sorted.
      type Actor = { y: number; draw: () => void }
      const actors: Actor[] = []
      const b = bossOf(s)
      for (const e of s.enemies) {
        const ex = lerp(e.px, e.x)
        const ey = lerp(e.py, e.y)
        actors.push({ y: ey, draw: () => drawOne(e, ex, ey) })
      }
      const drawOne = (e: Enemy, ex: number, ey: number) => {
        g.save()
        g.translate(ex, ey)
        const facing = p.x < e.x ? -1 : 1
        if (e.boss) {
          const pose = {
            time: tt,
            flash: e.flash > 0,
            facing,
            phase: e.boss.phase,
            casting: e.state === 'cast' || e.state === 'transition',
            charging: e.state === 'charge',
            alpha: 1,
            lift: e.state === 'intro' ? Math.pow(Math.max(0, e.timer - 0.3) / 2.1, 2) * 520 : 0,
            dying: e.state === 'dying' ? 1 - e.timer / (e.kind === 'irul' ? 2.2 : 1.1) : 0,
          }
          if (e.state === 'dying') {
            pose.alpha = 1 - pose.dying * 0.8
            if (!reducedMotion && Math.random() < 0.3) burst(ex + (Math.random() - 0.5) * e.r * 2, ey - Math.random() * e.r * 2, 3, '#facc15', 1.5, 'spark')
          }
          if (e.kind === 'golem') drawGolem(g, e.r, pose)
          else drawIrulKing(g, e.r, pose)
        } else {
          const winding = e.state === 'windup' ? 1 - e.timer / (e.kind === 'brute' ? 0.7 : 0.45) : 0
          drawEnemy(g, e.kind, e.r, {
            time: tt,
            id: e.id,
            flash: e.flash > 0,
            facing,
            winding,
            alpha: e.spawnT > 0 ? 1 - e.spawnT / 0.55 : 1,
            scale: e.spawnT > 0 ? 0.4 + 0.6 * (1 - e.spawnT / 0.55) : 1,
          })
          // Health bar once hurt.
          if (e.hp < e.maxHp && e.hp > 0) {
            const w = Math.max(26, e.r * 2)
            g.fillStyle = 'rgba(28,25,23,0.65)'
            g.fillRect(-w / 2 - 1, -e.r * 1.5 - 9, w + 2, 6)
            g.fillStyle = e.hp / e.maxHp > 0.5 ? '#22c55e' : '#f59e0b'
            g.fillRect(-w / 2, -e.r * 1.5 - 8, w * (e.hp / e.maxHp), 4)
          }
        }
        g.restore()
      }
      actors.push({
        y: py,
        draw: () => {
          g.save()
          g.translate(px, py)
          drawHero(g, { time: tt, fx: p.fx, fy: p.fy, moving: p.moving && live, hurt: p.invuln > 0 && p.dashT <= 0 && now - hurtAt < 800, dashing: p.dashT > 0, shield: p.dashT > 0 || (p.invuln > 0 && now - hurtAt >= 800) })
          g.restore()
        },
      })
      actors.sort((a, c) => a.y - c.y)
      for (const a of actors) a.draw()

      // Silambu staffs.
      for (const sf of silambuStaffs(s)) {
        g.save()
        g.translate(sf.x, sf.y)
        g.rotate(tt * 14)
        g.strokeStyle = '#92400e'
        g.lineWidth = 7
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(-sf.r, 0)
        g.lineTo(sf.r, 0)
        g.stroke()
        g.strokeStyle = '#facc15'
        g.lineWidth = 7
        g.beginPath()
        g.moveTo(sf.r * 0.7, 0)
        g.lineTo(sf.r, 0)
        g.moveTo(-sf.r * 0.7, 0)
        g.lineTo(-sf.r, 0)
        g.stroke()
        g.lineCap = 'butt'
        g.restore()
      }

      // Projectiles.
      for (const bo of s.bolts) {
        const bx = lerp(bo.px, bo.x)
        const by = lerp(bo.py, bo.y)
        const ang = Math.atan2(bo.vy, bo.vx)
        g.save()
        g.translate(bx, by)
        g.rotate(ang)
        if (bo.kind === 'flame') {
          g.fillStyle = 'rgba(251,146,60,0.35)'
          g.beginPath()
          g.ellipse(-12, 0, 22, 9, 0, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#f97316'
          g.beginPath()
          g.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#fde68a'
          g.beginPath()
          g.ellipse(2, 0, 5, 3.5, 0, 0, Math.PI * 2)
          g.fill()
        } else {
          g.strokeStyle = 'rgba(255,255,255,0.5)'
          g.lineWidth = 3
          g.beginPath()
          g.moveTo(-60, 0)
          g.lineTo(-20, 0)
          g.stroke()
          g.strokeStyle = '#78350f'
          g.lineWidth = 5
          g.beginPath()
          g.moveTo(-26, 0)
          g.lineTo(12, 0)
          g.stroke()
          g.fillStyle = '#e5e7eb'
          g.beginPath()
          g.moveTo(10, -8)
          g.lineTo(28, 0)
          g.lineTo(10, 8)
          g.closePath()
          g.fill()
          g.strokeStyle = '#1c1917'
          g.lineWidth = 1.5
          g.stroke()
        }
        g.restore()
      }
      for (const h of s.shots) {
        const hx = lerp(h.px, h.x)
        const hy = lerp(h.py, h.y)
        const bossShot = h.r >= 13
        g.fillStyle = bossShot ? 'rgba(244,63,94,0.35)' : 'rgba(163,230,53,0.35)'
        g.beginPath()
        g.arc(hx, hy, h.r * 1.8, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = bossShot ? '#be123c' : '#65a30d'
        g.beginPath()
        g.arc(hx, hy, h.r, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = bossShot ? '#fecdd3' : '#ecfccb'
        g.beginPath()
        g.arc(hx - h.r * 0.3, hy - h.r * 0.3, h.r * 0.4, 0, Math.PI * 2)
        g.fill()
      }

      // Particles.
      for (let i = particles.length - 1; i >= 0; i--) {
        const pa = particles[i]
        pa.life -= dt
        if (pa.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        const f = 1 - pa.life / pa.max
        pa.x += pa.vx * dt
        pa.y += pa.vy * dt
        if (pa.kind !== 'text' && pa.kind !== 'ring') pa.vy += 260 * dt
        if (pa.kind === 'ring') {
          g.strokeStyle = pa.color
          g.globalAlpha = 1 - f
          g.lineWidth = 6 * (1 - f) + 1
          g.beginPath()
          g.ellipse(pa.x, pa.y, pa.size * (0.2 + 0.8 * f), pa.size * 0.8 * (0.2 + 0.8 * f), 0, 0, Math.PI * 2)
          g.stroke()
        } else if (pa.kind === 'text') {
          g.globalAlpha = Math.min(1, (1 - f) * 2)
          g.font = `900 ${pa.size}px Inter, system-ui, sans-serif`
          g.textAlign = 'center'
          g.lineWidth = 4
          g.strokeStyle = 'rgba(28,25,23,0.85)'
          g.strokeText(pa.text!, pa.x, pa.y)
          g.fillStyle = pa.color
          g.fillText(pa.text!, pa.x, pa.y)
        } else {
          g.fillStyle = pa.color
          g.globalAlpha = pa.kind === 'smoke' ? 0.6 * (1 - f) : 1 - f
          g.beginPath()
          g.arc(pa.x, pa.y, pa.size * (pa.kind === 'smoke' ? 1 + f * 2.5 : 1 - f * 0.5), 0, Math.PI * 2)
          g.fill()
        }
        g.globalAlpha = 1
      }
      if (victoryAt && now - victoryAt < 3500 && !reducedMotion && Math.random() < 0.12) {
        const fx0 = camX + (Math.random() - 0.5) * viewW * 0.7
        const fy0 = camY - viewH * 0.2 + (Math.random() - 0.5) * viewH * 0.3
        const col = ['#facc15', '#14b8a6', '#f97316', '#ffffff', '#a855f7'][Math.floor(Math.random() * 5)]
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * Math.PI * 2
          particles.push({ x: fx0, y: fy0, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, life: 0.9, max: 0.9, size: 3.5, color: col, kind: 'spark' })
        }
      }

      // Screen treatments.
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const st = playerStats(s)
      const low = p.hp / st.maxHp
      if (now - hurtAt < 400 || (low < 0.3 && s.status === 'fighting')) {
        const k2 = now - hurtAt < 400 ? 1 - (now - hurtAt) / 400 : 0.35 + 0.25 * Math.sin(now / 250)
        const grad = g.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.72)
        grad.addColorStop(0, 'rgba(220,38,38,0)')
        grad.addColorStop(1, `rgba(220,38,38,${0.4 * k2})`)
        g.fillStyle = grad
        g.fillRect(0, 0, width, height)
      }
      if (b && b.boss?.phase === 2 && now - phaseAt > 0) {
        const grad = g.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.4, width / 2, height / 2, Math.max(width, height) * 0.75)
        grad.addColorStop(0, 'rgba(76,5,25,0)')
        grad.addColorStop(1, 'rgba(76,5,25,0.3)')
        g.fillStyle = grad
        g.fillRect(0, 0, width, height)
      }
      if (flash && flash.until > now) {
        g.fillStyle = `rgba(${flash.color},${0.45 * ((flash.until - now) / flash.dur)})`
        g.fillRect(0, 0, width, height)
      }
      if (s.status === 'defeat') {
        g.fillStyle = 'rgba(28,25,23,0.35)'
        g.fillRect(0, 0, width, height)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      particles.length = 0
    }
  }, [width, height, reducedMotion, stateRef, runningRef])

  // --- Touch: a floating joystick anywhere on the left side, a dash
  // button bottom-right. Each finger is tracked by pointerId, so moving
  // and dashing work at the same time.
  const onStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!controlsEnabled || stick.current) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    stick.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }
    setStickView({ ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY })
  }
  const onStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = stick.current
    if (!st || st.id !== e.pointerId) return
    st.x = e.clientX
    st.y = e.clientY
    const d = Math.hypot(st.x - st.ox, st.y - st.oy)
    if (d > 70) {
      // The base follows the thumb so direction changes stay quick.
      st.ox = st.x - ((st.x - st.ox) / d) * 70
      st.oy = st.y - ((st.y - st.oy) / d) * 70
    }
    setStickView({ ox: st.ox, oy: st.oy, x: st.x, y: st.y })
  }
  const onStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stick.current?.id !== e.pointerId) return
    stick.current = null
    setStickView(null)
  }

  return (
    <div className="absolute inset-0 select-none" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" role="img" aria-label="Boss Battle arena. Move with WASD or the arrow keys; Space to dash." />
      <div
        className="absolute inset-0"
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
        onLostPointerCapture={onStickUp}
        aria-hidden
      />
      {coarse && controlsEnabled && (
        <>
          {stickView ? (
            <div className="pointer-events-none absolute z-10" style={{ left: stickView.ox - 60, top: stickView.oy - 60 }} aria-hidden>
              <div className="w-[120px] h-[120px] rounded-full border-4 border-white/70 bg-white/15" />
              <div className="absolute w-14 h-14 rounded-full bg-white/85 shadow-lg border-2 border-primary-600" style={{ left: 60 - 28 + (stickView.x - stickView.ox), top: 60 - 28 + (stickView.y - stickView.oy) }} />
            </div>
          ) : (
            <div className="pointer-events-none absolute left-6 bottom-24 z-10 flex flex-col items-center gap-1 opacity-80" aria-hidden>
              <div className="w-[104px] h-[104px] rounded-full border-4 border-white/60 bg-white/10 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/70" />
              </div>
              <span className="rounded-full bg-stone-900/50 px-2 text-[11px] font-bold text-white">Drag to move</span>
            </div>
          )}
        </>
      )}
      {controlsEnabled && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation()
            dashQueued.current = true
          }}
          aria-label="Guardian Dash (Space)"
          className="absolute right-4 bottom-6 z-20 [margin-bottom:env(safe-area-inset-bottom)] w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-full border-4 border-white shadow-xl flex flex-col items-center justify-center text-white overflow-hidden bg-sky-600 active:scale-95 transition-transform focus-visible:outline focus-visible:outline-4 focus-visible:outline-gold-400"
        >
          {dashReady < 1 && <span className="absolute inset-0 bg-stone-900/55" style={{ clipPath: `inset(0 0 ${dashReady * 100}% 0)` }} aria-hidden />}
          <GiShield className="relative w-8 h-8" aria-hidden />
          <span className="relative text-[10px] font-black uppercase tracking-wide">{coarse ? 'Dash' : 'Space'}</span>
        </button>
      )}
    </div>
  )
}
