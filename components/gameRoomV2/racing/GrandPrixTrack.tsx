'use client'

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { LAP_LENGTH, STEP_MS_GP, type GpState } from '@/lib/gameRoomV2/racing/grandPrix'

// Canvas renderer for the Grand Prix: a stadium-shaped track seen from
// above, four lanes, the start/finish line, the player's upcoming
// checkpoint gates, and the cars. Reads the race state from a ref every
// animation frame; React never re-renders per frame.

export interface RaceClock {
  lastStepAt: number
  running: boolean
}

export function GrandPrixTrack({ stateRef, clockRef }: { stateRef: MutableRefObject<GpState | null>; clockRef: MutableRefObject<RaceClock> }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const height = width > 0 ? Math.round(width * (width < 560 ? 0.78 : 0.5)) : 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Stadium geometry: two straights joined by semicircles.
    const pad = Math.max(18, width * 0.05)
    const laneW = Math.max(9, Math.min(width, height) * 0.055)
    const trackW = laneW * 4
    const R = (height - pad * 2 - trackW) / 2
    const cx1 = pad + trackW / 2 + R
    const cx2 = width - pad - trackW / 2 - R
    const cy = height / 2
    const straight = cx2 - cx1
    const perimeter = 2 * straight + 2 * Math.PI * R

    // Point on the centre line + outward normal, for a lap fraction 0..1.
    // Starts at the middle of the bottom straight, running left-to-right.
    const at = (f: number) => {
      let d = (((f % 1) + 1) % 1) * perimeter
      const half = straight / 2
      if (d < half) return { x: (cx1 + cx2) / 2 + d, y: cy + R, nx: 0, ny: 1, a: 0 }
      d -= half
      if (d < Math.PI * R) {
        const t = d / R
        const ang = Math.PI / 2 - t
        return { x: cx2 + Math.cos(ang) * R, y: cy + Math.sin(ang) * R, nx: Math.cos(ang), ny: Math.sin(ang), a: -t }
      }
      d -= Math.PI * R
      if (d < straight) return { x: cx2 - d, y: cy - R, nx: 0, ny: -1, a: Math.PI }
      d -= straight
      if (d < Math.PI * R) {
        const t = d / R
        const ang = -Math.PI / 2 - t
        return { x: cx1 + Math.cos(ang) * R, y: cy + Math.sin(ang) * R, nx: Math.cos(ang), ny: Math.sin(ang), a: Math.PI - t }
      }
      d -= Math.PI * R
      return { x: cx1 + d, y: cy + R, nx: 0, ny: 1, a: 0 }
    }

    // Static background.
    const bg = document.createElement('canvas')
    bg.width = canvas.width
    bg.height = canvas.height
    const b = bg.getContext('2d')!
    b.scale(dpr, dpr)
    b.fillStyle = '#4d7c0f'
    b.fillRect(0, 0, width, height)
    for (let i = 0; i < 40; i++) {
      b.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'
      b.fillRect((i * width) / 40, 0, width / 40, height)
    }
    const stadium = (inset: number) => {
      b.beginPath()
      b.moveTo(cx1, cy - R - inset)
      b.lineTo(cx2, cy - R - inset)
      b.arc(cx2, cy, R + inset, -Math.PI / 2, Math.PI / 2)
      b.lineTo(cx1, cy + R + inset)
      b.arc(cx1, cy, R + inset, Math.PI / 2, (3 * Math.PI) / 2)
      b.closePath()
    }
    b.fillStyle = '#e11d48'
    stadium(trackW / 2 + 5)
    b.fill()
    b.fillStyle = '#ffffff'
    stadium(trackW / 2 + 2.5)
    b.fill()
    b.fillStyle = '#374151'
    stadium(trackW / 2)
    b.fill()
    b.fillStyle = '#65a30d'
    stadium(-trackW / 2)
    b.fill()
    b.strokeStyle = 'rgba(255,255,255,0.35)'
    b.setLineDash([10, 12])
    b.lineWidth = 1.5
    for (let l = 1; l < 4; l++) {
      stadium(-trackW / 2 + l * laneW)
      b.stroke()
    }
    b.setLineDash([])
    // Start/finish checkers.
    const s0 = at(0)
    const cells = 6
    for (let i = 0; i < cells; i++)
      for (let j = 0; j < 2; j++) {
        b.fillStyle = (i + j) % 2 ? '#111827' : '#f9fafb'
        b.fillRect(s0.x - 4 + j * 4, s0.y - trackW / 2 + (i * trackW) / cells, 4, trackW / cells)
      }
    // Infield label.
    b.fillStyle = 'rgba(255,255,255,0.18)'
    b.font = `700 ${Math.round(Math.min(width, height) * 0.09)}px Inter, system-ui, sans-serif`
    b.textAlign = 'center'
    b.textBaseline = 'middle'
    b.fillText('தமிழ் GP', width / 2, cy)

    let raf = 0
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const s = stateRef.current
      if (!s) return
      const now = performance.now()
      const clock = clockRef.current
      const alpha = clock.running ? Math.min(1, Math.max(0, (now - clock.lastStepAt) / STEP_MS_GP)) : 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.drawImage(bg, 0, 0, width, height)

      // Upcoming checkpoint gates for the player (this lap only).
      const me = s.racers[0]
      for (let i = s.checkpointsPassed; i < s.checkpoints.length && i < s.checkpointsPassed + 3; i++) {
        const cp = s.checkpoints[i]
        if (Math.floor(cp / LAP_LENGTH) !== Math.floor(me.dist / LAP_LENGTH) && cp - me.dist > LAP_LENGTH * 0.6) continue
        const p = at(cp / LAP_LENGTH)
        const x1 = p.x - p.nx * (trackW / 2)
        const y1 = p.y - p.ny * (trackW / 2)
        const x2 = p.x + p.nx * (trackW / 2)
        const y2 = p.y + p.ny * (trackW / 2)
        ctx.strokeStyle = i === s.checkpointsPassed ? '#facc15' : 'rgba(250, 204, 21, 0.45)'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        ctx.fillStyle = '#facc15'
        ctx.beginPath()
        ctx.arc(x1, y1, 3.5, 0, Math.PI * 2)
        ctx.arc(x2, y2, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // Cars, back to front so the leader draws on top.
      const cars = [...s.racers].sort((a, b) => a.dist - b.dist)
      for (const r of cars) {
        const d = r.prevDist + (r.dist - r.prevDist) * alpha
        const p = at(d / LAP_LENGTH)
        const laneOffset = -trackW / 2 + laneW * (r.lane + 0.5)
        const x = p.x + p.nx * laneOffset
        const y = p.y + p.ny * laneOffset
        const L = laneW * 1.7
        const Wc = laneW * 0.85
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(p.a)
        const boosting = r.isPlayer ? s.boosting : r.boostUntil > s.timeMs
        if (boosting && r.finishedAt === null) {
          ctx.fillStyle = 'rgba(249, 115, 22, 0.85)'
          ctx.beginPath()
          ctx.moveTo(-L / 2, -Wc * 0.3)
          ctx.lineTo(-L / 2 - L * (0.6 + Math.random() * 0.4), 0)
          ctx.lineTo(-L / 2, Wc * 0.3)
          ctx.fill()
        }
        if (r.isPlayer) {
          ctx.shadowColor = '#facc15'
          ctx.shadowBlur = 10
        }
        ctx.fillStyle = r.color
        ctx.beginPath()
        ctx.roundRect(-L / 2, -Wc / 2, L, Wc, Wc * 0.35)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)'
        ctx.fillRect(-L * 0.05, -Wc * 0.32, L * 0.28, Wc * 0.64)
        ctx.fillStyle = '#111827'
        ctx.fillRect(-L * 0.38, -Wc / 2 - 1.5, L * 0.18, 2.5)
        ctx.fillRect(-L * 0.38, Wc / 2 - 1, L * 0.18, 2.5)
        ctx.fillRect(L * 0.18, -Wc / 2 - 1.5, L * 0.18, 2.5)
        ctx.fillRect(L * 0.18, Wc / 2 - 1, L * 0.18, 2.5)
        ctx.restore()
        if (r.isPlayer) {
          ctx.fillStyle = r.isPlayer ? '#facc15' : 'rgba(255,255,255,0.85)'
          ctx.font = `700 ${Math.max(10, Math.round(laneW * 0.95))}px Inter, system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.fillText(r.name, x, y - Wc - 4)
        }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [width, height, stateRef, clockRef])

  return (
    <div ref={wrapRef} className="w-full" style={{ height: height || undefined }}>
      <canvas ref={canvasRef} className="w-full h-full rounded-2xl" style={{ width, height }} role="img" aria-label="Race track: four racers, three laps." />
    </div>
  )
}
