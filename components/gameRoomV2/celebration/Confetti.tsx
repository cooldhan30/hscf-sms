'use client'

import { useEffect, useRef } from 'react'

// A short, self-cleaning confetti burst on a fixed full-screen canvas.
// `intensity` scales the particle count (1 = a winner's burst). Runs for
// `durationMs`, then stops its animation frame and clears itself. With
// reduced motion it paints a few static pieces once instead.
const COLORS = ['#0d9488', '#14b8a6', '#eab308', '#facc15', '#f97316', '#fb923c', '#ffffff', '#a855f7']

export function Confetti({ intensity = 1, durationMs = 3200, reducedMotion = false }: { intensity?: number; durationMs?: number; reducedMotion?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
    const W = canvas.width
    const H = canvas.height
    const count = Math.round((reducedMotion ? 40 : 170) * intensity)
    const parts = Array.from({ length: count }, () => {
      const fromLeft = Math.random() < 0.5
      return {
        x: reducedMotion ? Math.random() * W : fromLeft ? W * 0.15 : W * 0.85,
        y: reducedMotion ? Math.random() * H * 0.6 : H * 0.72,
        vx: (fromLeft ? 1 : -1) * (Math.random() * 7 + 2) * dpr,
        vy: -(Math.random() * 15 + 9) * dpr,
        w: (6 + Math.random() * 6) * dpr,
        h: (3 + Math.random() * 4) * dpr,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      }
    })
    const drawAll = () => {
      g.clearRect(0, 0, W, H)
      for (const p of parts) {
        g.save()
        g.translate(p.x, p.y)
        g.rotate(p.rot)
        g.fillStyle = p.color
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        g.restore()
      }
    }
    if (reducedMotion) {
      drawAll()
      const t = window.setTimeout(() => g.clearRect(0, 0, W, H), durationMs)
      return () => window.clearTimeout(t)
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      for (const p of parts) {
        p.vy += 0.42 * dpr
        p.vx *= 0.99
        p.vy = Math.min(p.vy, 6 * dpr)
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
      }
      g.globalAlpha = Math.max(0, Math.min(1, (durationMs - elapsed) / 600))
      drawAll()
      if (elapsed < durationMs) raf = requestAnimationFrame(tick)
      else g.clearRect(0, 0, W, H)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [intensity, durationMs, reducedMotion])

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50 w-full h-full" aria-hidden />
}
