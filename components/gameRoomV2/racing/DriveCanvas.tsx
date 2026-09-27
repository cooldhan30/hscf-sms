'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'
import { BOOST_MULT, player, type DriveState } from '@/lib/gameRoomV2/racing/drive'
import type { Track } from '@/lib/gameRoomV2/racing/track'

// Full-screen top-down renderer for the Tamil Grand Prix. The static
// world (grass, run-off, kerbs, asphalt, markings, start line, scenery)
// is painted ONCE into an offscreen canvas; each frame draws that image
// through a camera that follows the player, then the moving things on
// top: learning gates, boost pads, cars, boost flames, dust and speed
// lines. Reads the simulation ref directly -- no React state per frame.

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  kind: 'dust' | 'flame' | 'spark'
}

const GRASS = '#6fb34d'
const GRASS_DARK = '#63a544'
const RUNOFF = '#86c25f'
const WALL = '#f1f5f9'
const ASPHALT = '#4b5563'

function paintWorld(track: Track, scale: number): HTMLCanvasElement {
  const b = track.bounds
  const w = Math.ceil((b.maxX - b.minX) * scale)
  const h = Math.ceil((b.maxY - b.minY) * scale)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.scale(scale, scale)
  g.translate(-b.minX, -b.minY)
  // Grass with mown stripes.
  g.fillStyle = GRASS
  g.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY)
  g.fillStyle = GRASS_DARK
  for (let x = b.minX; x < b.maxX; x += 160) g.fillRect(x, b.minY, 80, b.maxY - b.minY)
  const path = new Path2D()
  track.samples.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)))
  path.closePath()
  g.lineJoin = 'round'
  g.lineCap = 'round'
  // Wall (tyre barrier), run-off grass, kerbs, asphalt, centre dashes.
  g.strokeStyle = '#94a3b8'
  g.lineWidth = track.barrier * 2 + 16
  g.stroke(path)
  g.strokeStyle = WALL
  g.lineWidth = track.barrier * 2 + 10
  g.stroke(path)
  g.strokeStyle = RUNOFF
  g.lineWidth = track.barrier * 2
  g.stroke(path)
  g.strokeStyle = '#ffffff'
  g.lineWidth = track.roadHalf * 2 + 16
  g.stroke(path)
  g.setLineDash([26, 26])
  g.strokeStyle = '#dc2626'
  g.stroke(path)
  g.setLineDash([])
  g.strokeStyle = ASPHALT
  g.lineWidth = track.roadHalf * 2
  g.stroke(path)
  g.setLineDash([36, 44])
  g.strokeStyle = 'rgba(255,255,255,0.55)'
  g.lineWidth = 4
  g.stroke(path)
  g.setLineDash([])
  // Start / finish chequers.
  const s0 = track.samples[0]
  g.save()
  g.translate(s0.x, s0.y)
  g.rotate(Math.atan2(s0.ty, s0.tx))
  const sq = 13
  for (let row = 0; row < 2; row++) {
    for (let k = -Math.floor(track.roadHalf / sq); k < Math.floor(track.roadHalf / sq); k++) {
      g.fillStyle = (k + row) % 2 === 0 ? '#ffffff' : '#111827'
      g.fillRect(-sq + row * sq, k * sq, sq, sq)
    }
  }
  g.restore()
  // Grid boxes behind the line.
  for (let slot = 0; slot < 4; slot++) {
    const back = 55 + slot * 48
    const smp = track.samples[Math.round(((track.length - back) / track.length) * track.samples.length) % track.samples.length]
    const side = slot % 2 === 0 ? 30 : -30
    g.save()
    g.translate(smp.x + smp.nx * side, smp.y + smp.ny * side)
    g.rotate(Math.atan2(smp.ty, smp.tx))
    g.strokeStyle = 'rgba(255,255,255,0.8)'
    g.lineWidth = 3
    g.strokeRect(-24, -15, 48, 30)
    g.restore()
  }
  // Scenery.
  for (const sc of track.scenery) {
    if (sc.kind === 'pond') {
      g.fillStyle = '#7dd3fc'
      g.beginPath()
      g.ellipse(sc.x, sc.y, sc.r, sc.r * 0.7, 0.3, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#38bdf8'
      g.lineWidth = 6
      g.stroke()
      g.fillStyle = '#e0f2fe'
      g.beginPath()
      g.ellipse(sc.x - sc.r * 0.3, sc.y - sc.r * 0.2, sc.r * 0.25, sc.r * 0.08, 0.3, 0, Math.PI * 2)
      g.fill()
    } else if (sc.kind === 'stand') {
      g.save()
      g.translate(sc.x, sc.y)
      g.rotate(sc.angle ?? 0)
      g.fillStyle = '#e7e5e4'
      g.fillRect(-sc.r, -22, sc.r * 2, 44)
      const crowd = ['#f97316', '#0ea5e9', '#eab308', '#ef4444', '#14b8a6', '#a855f7']
      for (let r = 0; r < 3; r++) {
        for (let k = 0; k < 12; k++) {
          g.fillStyle = crowd[(k * 7 + r * 3) % crowd.length]
          g.beginPath()
          g.arc(-sc.r + 8 + k * ((sc.r * 2 - 16) / 11), -12 + r * 12, 3.6, 0, Math.PI * 2)
          g.fill()
        }
      }
      g.fillStyle = '#0f766e'
      g.fillRect(-sc.r, 18, sc.r * 2, 6)
      g.restore()
    } else if (sc.kind === 'tree') {
      g.fillStyle = 'rgba(0,0,0,0.18)'
      g.beginPath()
      g.arc(sc.x + 6, sc.y + 8, sc.r, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#2f7d32'
      g.beginPath()
      g.arc(sc.x, sc.y, sc.r, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#43a047'
      g.beginPath()
      g.arc(sc.x - sc.r * 0.3, sc.y - sc.r * 0.3, sc.r * 0.55, 0, Math.PI * 2)
      g.fill()
    }
  }
  return c
}

function drawCar(g: CanvasRenderingContext2D, x: number, y: number, heading: number, color: string, isPlayer: boolean, boosting: boolean) {
  g.save()
  g.translate(x, y)
  g.rotate(heading)
  // Shadow.
  g.fillStyle = 'rgba(0,0,0,0.28)'
  g.beginPath()
  g.roundRect(-20, -9, 44, 24, 8)
  g.fill()
  // Wheels.
  g.fillStyle = '#111827'
  for (const [wx, wy] of [
    [-13, -12],
    [9, -12],
    [-13, 8],
    [9, 8],
  ])
    g.fillRect(wx, wy, 9, 4)
  // Body.
  g.fillStyle = color
  g.beginPath()
  g.roundRect(-21, -10, 42, 20, 7)
  g.fill()
  // Nose and stripe.
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.fillRect(-21, -2, 42, 4)
  g.fillStyle = 'rgba(0,0,0,0.18)'
  g.beginPath()
  g.roundRect(14, -8, 7, 16, 3)
  g.fill()
  // Cockpit.
  g.fillStyle = '#0f172a'
  g.beginPath()
  g.roundRect(-6, -6, 12, 12, 4)
  g.fill()
  g.fillStyle = '#93c5fd'
  g.beginPath()
  g.roundRect(2, -5, 4, 10, 2)
  g.fill()
  if (isPlayer) {
    g.strokeStyle = '#ffffff'
    g.lineWidth = 2.5
    g.beginPath()
    g.roundRect(-22, -11, 44, 22, 8)
    g.stroke()
  }
  if (boosting) {
    g.fillStyle = 'rgba(251,146,60,0.9)'
    g.beginPath()
    g.moveTo(-21, -6)
    g.lineTo(-38 - Math.random() * 10, 0)
    g.lineTo(-21, 6)
    g.fill()
  }
  g.restore()
}

export function DriveCanvas({ stateRef, reducedMotion }: { stateRef: MutableRefObject<DriveState | null>; reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return
    let raf = 0
    let world: HTMLCanvasElement | null = null
    let worldScale = 1
    let camX = 0
    let camY = 0
    let zoom = 1
    let camInit = false
    let lastT = performance.now()
    const particles: Particle[] = []
    let lastShake = 0

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const s = stateRef.current
      if (!s) return
      const dt = Math.min(0.05, (now - lastT) / 1000)
      lastT = now
      if (!world) {
        const small = Math.min(window.innerWidth, window.innerHeight) < 700
        worldScale = small ? 0.55 : 0.8
        world = paintWorld(s.track, worldScale)
      }
      const W = canvas.width
      const H = canvas.height
      const dpr = W / Math.max(1, canvas.clientWidth)
      const me = player(s)
      const speedFrac = Math.min(1.4, Math.abs(me.speed) / 430)

      // Camera: follows the car with a little look-ahead, zooms out with speed.
      const base = Math.max(0.7, Math.min(1.0, Math.sqrt(canvas.clientWidth * canvas.clientHeight) / 1100)) * dpr
      const targetZoom = base * (1 - 0.16 * Math.min(1, speedFrac)) * (s.started ? 1 : 1.12)
      const tx = me.x + me.vx * 0.28
      const ty = me.y + me.vy * 0.28
      if (!camInit) {
        camX = tx
        camY = ty
        zoom = targetZoom
        camInit = true
      }
      const k = 1 - Math.exp(-dt * 5)
      camX += (tx - camX) * k
      camY += (ty - camY) * k
      zoom += (targetZoom - zoom) * (1 - Math.exp(-dt * 2.5))
      let shakeX = 0
      let shakeY = 0
      if (!reducedMotion && s.stats.bumps !== lastShake) {
        lastShake = s.stats.bumps
        shakeX = (Math.random() - 0.5) * 6
        shakeY = (Math.random() - 0.5) * 6
      }

      g.setTransform(1, 0, 0, 1, 0, 0)
      g.fillStyle = GRASS
      g.fillRect(0, 0, W, H)
      g.setTransform(zoom, 0, 0, zoom, W / 2 - camX * zoom + shakeX, H / 2 - camY * zoom + shakeY)
      const b = s.track.bounds
      g.imageSmoothingEnabled = true
      g.drawImage(world, b.minX, b.minY, world.width / worldScale, world.height / worldScale)

      const track = s.track
      const pulse = 0.5 + 0.5 * Math.sin(now / 180)
      // Boost pads: glowing chevrons.
      for (const p of track.pads) {
        const smp = track.samples[Math.round((p.s / track.length) * track.samples.length) % track.samples.length]
        g.save()
        g.translate(smp.x + smp.nx * p.offset, smp.y + smp.ny * p.offset)
        g.rotate(Math.atan2(smp.ty, smp.tx))
        g.fillStyle = `rgba(250,204,21,${0.55 + 0.35 * pulse})`
        g.beginPath()
        g.roundRect(0, -p.halfWidth, p.length, p.halfWidth * 2, 8)
        g.fill()
        g.fillStyle = '#c2410c'
        for (let c = 0; c < 3; c++) {
          g.beginPath()
          g.moveTo(10 + c * 20, -14)
          g.lineTo(22 + c * 20, 0)
          g.lineTo(10 + c * 20, 14)
          g.lineTo(16 + c * 20, 0)
          g.closePath()
          g.fill()
        }
        g.restore()
      }
      // Upcoming learning gates: teal arches with a Tamil letter.
      const meLapBase = Math.max(0, me.lap) * track.length
      for (let gi = s.nextGate; gi < s.learningGates.length && gi < s.nextGate + 2; gi++) {
        const d = s.learningGates[gi] - meLapBase
        if (d < -200 || d > track.length * 1.2) continue
        const smp = track.samples[Math.round(((((s.learningGates[gi] % track.length) + track.length) % track.length) / track.length) * track.samples.length) % track.samples.length]
        g.save()
        g.translate(smp.x, smp.y)
        g.rotate(Math.atan2(smp.ty, smp.tx))
        g.fillStyle = `rgba(20,184,166,${0.18 + 0.12 * pulse})`
        g.fillRect(-10, -track.roadHalf, 20, track.roadHalf * 2)
        g.fillStyle = '#0f766e'
        g.fillRect(-6, -track.roadHalf - 14, 12, 14)
        g.fillRect(-6, track.roadHalf, 12, 14)
        g.fillStyle = '#115e59'
        g.fillRect(-4, -track.roadHalf - 6, 8, track.roadHalf * 2 + 12)
        g.restore()
        // Upright badge with a Tamil letter above the gate.
        g.fillStyle = '#0f766e'
        g.beginPath()
        g.arc(smp.x, smp.y, 22, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = '#fef08a'
        g.lineWidth = 3
        g.stroke()
        g.fillStyle = '#fef08a'
        g.font = 'bold 22px "Noto Sans Tamil", sans-serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('அ', smp.x, smp.y + 1)
      }

      // Particles: dust off-road, flames while boosting.
      const boosting = s.boosting || me.boostT > 0
      if (!reducedMotion) {
        for (const car of s.cars) {
          const carBoost = car.isPlayer ? boosting : car.boostT > 0
          if (car.offRoad && Math.abs(car.speed) > 60 && Math.random() < 0.6) {
            particles.push({ x: car.x - Math.cos(car.heading) * 18, y: car.y - Math.sin(car.heading) * 18, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 0.6, max: 0.6, kind: 'dust' })
          }
          if (carBoost && Math.random() < 0.9) {
            particles.push({ x: car.x - Math.cos(car.heading) * 24, y: car.y - Math.sin(car.heading) * 24, vx: -Math.cos(car.heading) * 80 + (Math.random() - 0.5) * 30, vy: -Math.sin(car.heading) * 80 + (Math.random() - 0.5) * 30, life: 0.35, max: 0.35, kind: 'flame' })
          }
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life -= dt
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        p.x += p.vx * dt
        p.y += p.vy * dt
        const a = p.life / p.max
        g.fillStyle = p.kind === 'dust' ? `rgba(161,128,86,${0.45 * a})` : `rgba(${250},${120 + 100 * a},40,${0.85 * a})`
        g.beginPath()
        g.arc(p.x, p.y, p.kind === 'dust' ? 9 * (1.4 - a) : 6 * a + 2, 0, Math.PI * 2)
        g.fill()
      }
      if (particles.length > 400) particles.splice(0, particles.length - 400)

      // Cars (player drawn last, on top).
      for (const car of s.cars) if (!car.isPlayer) drawCar(g, car.x, car.y, car.heading, car.color, false, car.boostT > 0)
      drawCar(g, me.x, me.y, me.heading, me.color, true, boosting)
      // Rival name tags.
      g.font = `bold ${Math.round(13 / Math.max(0.6, zoom / dpr))}px Inter, sans-serif`
      g.textAlign = 'center'
      for (const car of s.cars) {
        if (car.isPlayer) continue
        if (Math.hypot(car.x - me.x, car.y - me.y) > 700) continue
        g.fillStyle = 'rgba(15,23,42,0.75)'
        const label = car.name
        const tw = g.measureText(label).width + 10
        g.beginPath()
        g.roundRect(car.x - tw / 2, car.y - 42, tw, 18, 6)
        g.fill()
        g.fillStyle = '#ffffff'
        g.fillText(label, car.x, car.y - 29)
      }

      // Screen space: speed lines and boost vignette.
      g.setTransform(1, 0, 0, 1, 0, 0)
      if (!reducedMotion && (speedFrac > 0.85 || boosting)) {
        const n = boosting ? 26 : 12
        g.strokeStyle = boosting ? 'rgba(255,237,213,0.55)' : 'rgba(255,255,255,0.28)'
        g.lineWidth = 2 * dpr
        for (let i = 0; i < n; i++) {
          const ang = Math.random() * Math.PI * 2
          const r0 = Math.max(W, H) * (0.42 + Math.random() * 0.1)
          const len = (boosting ? 90 : 50) * dpr
          g.beginPath()
          g.moveTo(W / 2 + Math.cos(ang) * r0, H / 2 + Math.sin(ang) * r0)
          g.lineTo(W / 2 + Math.cos(ang) * (r0 + len), H / 2 + Math.sin(ang) * (r0 + len))
          g.stroke()
        }
      }
      if (boosting) {
        const grad = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)
        grad.addColorStop(0, 'rgba(251,146,60,0)')
        grad.addColorStop(1, `rgba(251,146,60,${0.16 * (BOOST_MULT - 1) * 2})`)
        g.fillStyle = grad
        g.fillRect(0, 0, W, H)
      }

      // Minimap (top-right, under the HUD).
      const mm = Math.round(Math.min(150, canvas.clientWidth * 0.26, canvas.clientHeight * 0.2) * dpr)
      const pad = 12 * dpr
      const mx = W - mm - pad
      const my = 64 * dpr
      const bw = b.maxX - b.minX
      const bh = b.maxY - b.minY
      const ms = mm / Math.max(bw, bh)
      g.fillStyle = '#f5f5f4'
      g.beginPath()
      g.roundRect(mx - 6 * dpr, my - 6 * dpr, mm + 12 * dpr, bh * ms + 12 * dpr, 12 * dpr)
      g.fill()
      g.strokeStyle = '#475569'
      g.lineWidth = 4 * dpr
      g.lineJoin = 'round'
      g.beginPath()
      track.samples.forEach((p, i) => {
        const px = mx + (p.x - b.minX) * ms
        const py = my + (p.y - b.minY) * ms
        if (i === 0) g.moveTo(px, py)
        else g.lineTo(px, py)
      })
      g.closePath()
      g.stroke()
      for (const car of [...s.cars.filter((c) => !c.isPlayer), me]) {
        g.fillStyle = car.color
        g.beginPath()
        g.arc(mx + (car.x - b.minX) * ms, my + (car.y - b.minY) * ms, (car.isPlayer ? 5 : 3.5) * dpr, 0, Math.PI * 2)
        g.fill()
        if (car.isPlayer) {
          g.strokeStyle = '#0f172a'
          g.lineWidth = 1.5 * dpr
          g.stroke()
        }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      particles.length = 0
      world = null
    }
  }, [stateRef, reducedMotion])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block touch-none" aria-label="Race track" role="img" />
}
