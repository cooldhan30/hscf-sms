'use client'

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import {
  GRID_COLS,
  GRID_ROWS,
  pathCells,
  getTowerType,
  statsFor,
  STEP_MS,
  STRIKE_RADIUS,
  mulberry32,
  seedFromString,
  type TdState,
  type Enemy,
  type Tower,
  type TowerTypeId,
} from '@/lib/gameRoomV2/towerDefense'

// Canvas renderer for the Tower Defense battlefield. Reads the simulation
// state from a ref on every animation frame -- no React re-render per
// frame. Build spots are real <button>s layered over the canvas so they
// work with touch, mouse and keyboard, and are announced to screen readers.
//
// On narrow screens the field is drawn in portrait (the grid transposed:
// the enemy gate at the top, the fort at the bottom) so cells stay large
// enough to tap on a phone.

export interface Fx {
  kind: 'ring' | 'burst' | 'text' | 'strike' | 'sparkle'
  x: number
  y: number
  t0: number
  dur: number
  color: string
  r0?: number
  r1?: number
  text?: string
}

export interface StepClock {
  lastStepAt: number
  running: boolean
  speed: number
}

const GRASS_A = '#8fbf6e'
const GRASS_B = '#86b766'
const PATH_FILL = '#dcc08a'
const PATH_EDGE = '#b8955e'

function enemyStyle(e: Enemy) {
  switch (e.kind) {
    case 'scout':
      return { body: '#eab308', rim: '#a16207' }
    case 'swarm':
      return { body: '#84cc16', rim: '#4d7c0f' }
    case 'brute':
      return { body: '#b91c1c', rim: '#7f1d1d' }
    case 'armored':
      return { body: '#64748b', rim: '#1e293b' }
    case 'boss':
      return { body: e.enraged ? '#9d174d' : '#6d28d9', rim: '#2e1065' }
    default:
      return { body: '#57534e', rim: '#292524' }
  }
}

export function Battlefield({
  stateRef,
  fxRef,
  clockRef,
  shakeUntilRef,
  version,
  selectedPadId,
  strikeMode,
  onPadClick,
  onFieldClick,
}: {
  stateRef: MutableRefObject<TdState | null>
  fxRef: MutableRefObject<Fx[]>
  clockRef: MutableRefObject<StepClock>
  shakeUntilRef: MutableRefObject<number>
  // Bumped by the parent when towers change, so pad buttons re-render.
  version: number
  selectedPadId: string | null
  strikeMode: boolean
  onPadClick: (padId: string) => void
  onFieldClick: (point: { x: number; y: number }) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bgRef = useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = useState({ width: 0, portrait: false })
  const selectedRef = useRef<string | null>(selectedPadId)
  const strikeRef = useRef(strikeMode)
  const hoverRef = useRef<{ x: number; y: number } | null>(null)
  selectedRef.current = selectedPadId
  strikeRef.current = strikeMode

  // Track container width.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width)
      setSize({ width: w, portrait: w < 560 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const map = stateRef.current?.map
  const cols = size.portrait ? GRID_ROWS : GRID_COLS
  const rows = size.portrait ? GRID_COLS : GRID_ROWS
  const cell = size.width > 0 ? size.width / cols : 0
  const height = cell * rows

  // Pre-render the static terrain (grass, scenery, path, gate, fort).
  useEffect(() => {
    if (!map || cell <= 0) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const bg = document.createElement('canvas')
    bg.width = Math.round(size.width * dpr)
    bg.height = Math.round(height * dpr)
    const ctx = bg.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    const P = (x: number, y: number) => (size.portrait ? { sx: y * cell, sy: x * cell } : { sx: x * cell, sy: y * cell })

    for (let gx = 0; gx < GRID_COLS; gx++)
      for (let gy = 0; gy < GRID_ROWS; gy++) {
        const { sx, sy } = P(gx, gy)
        ctx.fillStyle = (gx + gy) % 2 === 0 ? GRASS_A : GRASS_B
        ctx.fillRect(sx, sy, cell + 1, cell + 1)
      }

    // Scenery on free cells: trees, rocks, flowers -- seeded per map.
    const occupied = pathCells(map.path)
    map.pads.forEach((p) => occupied.add(`${Math.floor(p.x)},${Math.floor(p.y)}`))
    const rand = mulberry32(seedFromString(map.id))
    for (let gx = 0; gx < GRID_COLS; gx++)
      for (let gy = 0; gy < GRID_ROWS; gy++) {
        if (occupied.has(`${gx},${gy}`)) continue
        const r = rand()
        const { sx, sy } = P(gx + 0.5, gy + 0.5)
        if (r < 0.3) {
          ctx.fillStyle = 'rgba(0,0,0,0.12)'
          ctx.beginPath()
          ctx.ellipse(sx + cell * 0.05, sy + cell * 0.18, cell * 0.28, cell * 0.12, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#4d7c0f'
          ctx.beginPath()
          ctx.arc(sx, sy, cell * 0.28, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#65a30d'
          ctx.beginPath()
          ctx.arc(sx - cell * 0.07, sy - cell * 0.07, cell * 0.16, 0, Math.PI * 2)
          ctx.fill()
        } else if (r < 0.42) {
          ctx.fillStyle = '#a8a29e'
          ctx.beginPath()
          ctx.ellipse(sx, sy, cell * 0.16, cell * 0.11, 0.4, 0, Math.PI * 2)
          ctx.fill()
        } else if (r < 0.6) {
          const colors = ['#f472b6', '#fde047', '#ffffff']
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = colors[Math.floor(rand() * colors.length)]
            ctx.beginPath()
            ctx.arc(sx + (rand() - 0.5) * cell * 0.6, sy + (rand() - 0.5) * cell * 0.6, cell * 0.04, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

    // Path: edge then fill, round joins.
    const drawPath = (width: number, color: string) => {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      map.path.forEach((pt, i) => {
        const { sx, sy } = P(pt.x, pt.y)
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      })
      ctx.stroke()
    }
    drawPath(cell * 0.86, PATH_EDGE)
    drawPath(cell * 0.72, PATH_FILL)
    ctx.setLineDash([cell * 0.12, cell * 0.2])
    drawPath(cell * 0.05, 'rgba(120, 90, 50, 0.35)')
    ctx.setLineDash([])

    // Gate (enemy spawn) and fort (the base to defend).
    const start = map.path[0]
    const end = map.path[map.path.length - 1]
    const g = P(Math.max(0.35, start.x + 0.85), start.y)
    ctx.fillStyle = '#3b0764'
    ctx.beginPath()
    ctx.arc(g.sx, g.sy, cell * 0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#a855f7'
    ctx.lineWidth = cell * 0.06
    ctx.beginPath()
    ctx.arc(g.sx, g.sy, cell * 0.28, 0, Math.PI * 1.5)
    ctx.stroke()
    const f = P(Math.min(GRID_COLS - 0.45, end.x - 0.95), end.y)
    ctx.fillStyle = '#78716c'
    ctx.fillRect(f.sx - cell * 0.42, f.sy - cell * 0.36, cell * 0.84, cell * 0.72)
    ctx.fillStyle = '#a8a29e'
    for (let i = 0; i < 3; i++) ctx.fillRect(f.sx - cell * 0.42 + i * cell * 0.32, f.sy - cell * 0.5, cell * 0.2, cell * 0.16)
    ctx.fillStyle = '#44403c'
    ctx.fillRect(f.sx - cell * 0.12, f.sy + cell * 0.02, cell * 0.24, cell * 0.34)
    ctx.strokeStyle = '#292524'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(f.sx, f.sy - cell * 0.5)
    ctx.lineTo(f.sx, f.sy - cell * 0.9)
    ctx.stroke()
    ctx.fillStyle = '#ea580c'
    ctx.beginPath()
    ctx.moveTo(f.sx, f.sy - cell * 0.9)
    ctx.lineTo(f.sx + cell * 0.3, f.sy - cell * 0.8)
    ctx.lineTo(f.sx, f.sy - cell * 0.7)
    ctx.fill()

    bgRef.current = bg
  }, [map, cell, height, size.width, size.portrait])

  // Frame loop: draw only (the simulation runs in the parent).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || cell <= 0) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(size.width * dpr)
    canvas.height = Math.round(height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const P = (x: number, y: number) => (size.portrait ? { sx: y * cell, sy: x * cell } : { sx: x * cell, sy: y * cell })

    const drawTower = (t: Tower, now: number, state: TdState) => {
      const { sx, sy } = P(t.x, t.y)
      const def = getTowerType(t.type)
      const r = cell * 0.36
      // Base
      ctx.fillStyle = '#57534e'
      ctx.beginPath()
      ctx.arc(sx, sy + cell * 0.05, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#d6d3d1'
      ctx.beginPath()
      ctx.arc(sx, sy, r * 0.92, 0, Math.PI * 2)
      ctx.fill()
      const recoil = Math.max(0, 1 - (state.timeMs - t.firedAt) / 180)
      const angle = size.portrait ? Math.atan2(Math.cos(t.angle), Math.sin(t.angle)) : t.angle
      ctx.save()
      ctx.translate(sx, sy)
      if (t.type === 'pani') {
        const pulse = Math.max(0, 1 - (state.timeMs - t.firedAt) / 400)
        ctx.fillStyle = def.color
        ctx.beginPath()
        ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `rgba(186, 230, 253, ${0.5 + pulse * 0.5})`
        ctx.beginPath()
        ctx.arc(0, -r * 0.05, r * 0.32, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.rotate(angle)
        ctx.translate(-recoil * r * 0.18, 0)
        ctx.fillStyle = def.color
        if (t.type === 'vel') {
          ctx.fillRect(-r * 0.3, -r * 0.14, r * 1.05, r * 0.28)
          ctx.beginPath()
          ctx.moveTo(r * 0.75, -r * 0.3)
          ctx.lineTo(r * 1.15, 0)
          ctx.lineTo(r * 0.75, r * 0.3)
          ctx.fill()
        } else if (t.type === 'yanai') {
          ctx.fillRect(-r * 0.2, -r * 0.3, r * 1.1, r * 0.6)
          ctx.beginPath()
          ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.strokeStyle = def.color
          ctx.lineWidth = Math.max(2, r * 0.18)
          ctx.beginPath()
          ctx.arc(0, 0, r * 0.7, -Math.PI / 2.2, Math.PI / 2.2)
          ctx.stroke()
          ctx.strokeStyle = '#1c1917'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(-r * 0.2, 0)
          ctx.lineTo(r * 0.9, 0)
          ctx.stroke()
        }
      }
      ctx.restore()
      // Level pips
      for (let i = 0; i < t.level; i++) {
        ctx.fillStyle = '#facc15'
        ctx.beginPath()
        ctx.arc(sx - r * 0.5 + i * r * 0.5, sy + r * 0.95, Math.max(2, cell * 0.045), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const drawEnemy = (e: Enemy, alpha: number, now: number, state: TdState) => {
      const ix = e.prevX + (e.x - e.prevX) * alpha
      const iy = e.prevY + (e.y - e.prevY) * alpha
      const { sx, sy } = P(ix, iy)
      const r = e.radius * cell
      const st = enemyStyle(e)
      const bob = Math.sin(now / 120 + e.id) * cell * 0.02
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.beginPath()
      ctx.ellipse(sx, sy + r * 0.8, r * 0.9, r * 0.35, 0, 0, Math.PI * 2)
      ctx.fill()
      if (e.isBoss) {
        ctx.fillStyle = e.enraged ? 'rgba(244, 63, 94, 0.28)' : 'rgba(168, 85, 247, 0.25)'
        ctx.beginPath()
        ctx.arc(sx, sy + bob, r * (1.35 + Math.sin(now / 200) * 0.08), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = state.timeMs < e.hitFlashUntil ? '#ffffff' : st.body
      ctx.strokeStyle = st.rim
      ctx.lineWidth = e.kind === 'armored' ? Math.max(2, r * 0.3) : Math.max(1.5, r * 0.15)
      ctx.beginPath()
      ctx.arc(sx, sy + bob, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      if (e.kind === 'brute' || e.isBoss) {
        ctx.fillStyle = e.isBoss ? '#fde047' : '#fef3c7'
        ctx.beginPath()
        ctx.moveTo(sx - r * 0.7, sy + bob - r * 0.5)
        ctx.lineTo(sx - r * 0.45, sy + bob - r * 1.15)
        ctx.lineTo(sx - r * 0.2, sy + bob - r * 0.7)
        ctx.moveTo(sx + r * 0.7, sy + bob - r * 0.5)
        ctx.lineTo(sx + r * 0.45, sy + bob - r * 1.15)
        ctx.lineTo(sx + r * 0.2, sy + bob - r * 0.7)
        if (e.isBoss) {
          ctx.moveTo(sx - r * 0.12, sy + bob - r * 0.85)
          ctx.lineTo(sx, sy + bob - r * 1.35)
          ctx.lineTo(sx + r * 0.12, sy + bob - r * 0.85)
        }
        ctx.fill()
      }
      // eyes
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(sx - r * 0.32, sy + bob - r * 0.1, r * 0.2, 0, Math.PI * 2)
      ctx.arc(sx + r * 0.32, sy + bob - r * 0.1, r * 0.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#111827'
      ctx.beginPath()
      ctx.arc(sx - r * 0.28, sy + bob - r * 0.08, r * 0.09, 0, Math.PI * 2)
      ctx.arc(sx + r * 0.36, sy + bob - r * 0.08, r * 0.09, 0, Math.PI * 2)
      ctx.fill()
      if (e.slowFactor < 1 || state.freezeUntil > state.timeMs) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(sx, sy + bob, r + 3, 0, Math.PI * 2)
        ctx.stroke()
      }
      if (e.hp < e.maxHp) {
        const w = Math.max(cell * 0.5, r * 2.2)
        const hx = sx - w / 2
        const hy = sy + bob - r - cell * 0.16
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(hx - 1, hy - 1, w + 2, cell * 0.08 + 2)
        const pct = Math.max(0, e.hp / e.maxHp)
        ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#eab308' : '#ef4444'
        ctx.fillRect(hx, hy, w * pct, cell * 0.08)
      }
    }

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const state = stateRef.current
      if (!state) return
      const now = performance.now()
      const clock = clockRef.current
      const alpha = clock.running ? Math.min(1, Math.max(0, (now - clock.lastStepAt) / (STEP_MS / clock.speed))) : 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (shakeUntilRef.current > now) {
        const k = (shakeUntilRef.current - now) / 350
        ctx.translate((Math.random() - 0.5) * 8 * k, (Math.random() - 0.5) * 8 * k)
      }
      if (bgRef.current) ctx.drawImage(bgRef.current, 0, 0, size.width, height)

      // Build spots
      const sel = selectedRef.current
      for (const pad of state.map.pads) {
        const { sx, sy } = P(pad.x, pad.y)
        const built = state.towers.some((t) => t.padId === pad.id)
        if (!built) {
          ctx.fillStyle = 'rgba(120, 113, 108, 0.55)'
          ctx.beginPath()
          ctx.arc(sx, sy, cell * 0.34, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = pad.id === sel ? '#facc15' : 'rgba(255,255,255,0.75)'
          ctx.setLineDash([4, 4])
          ctx.lineWidth = pad.id === sel ? 3 : 1.5
          ctx.beginPath()
          ctx.arc(sx, sy, cell * 0.34, 0, Math.PI * 2)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.strokeStyle = 'rgba(255,255,255,0.85)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(sx - cell * 0.1, sy)
          ctx.lineTo(sx + cell * 0.1, sy)
          ctx.moveTo(sx, sy - cell * 0.1)
          ctx.lineTo(sx, sy + cell * 0.1)
          ctx.stroke()
        }
      }

      // Range of the selected tower
      const selTower = sel ? state.towers.find((t) => t.padId === sel) : undefined
      if (selTower) {
        const { sx, sy } = P(selTower.x, selTower.y)
        ctx.fillStyle = 'rgba(250, 204, 21, 0.12)'
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.8)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(sx, sy, statsFor(selTower.type, selTower.level).range * cell, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }

      for (const t of state.towers) drawTower(t, now, state)
      for (const e of state.enemies) drawEnemy(e, alpha, now, state)

      // Projectiles
      for (const pr of state.projectiles) {
        const ix = pr.prevX + (pr.x - pr.prevX) * alpha
        const iy = pr.prevY + (pr.y - pr.prevY) * alpha
        const { sx, sy } = P(ix, iy)
        const prev = P(pr.prevX, pr.prevY)
        if (pr.towerType === 'yanai') {
          ctx.fillStyle = '#292524'
          ctx.beginPath()
          ctx.arc(sx, sy, cell * 0.09, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.strokeStyle = pr.towerType === 'kuri' ? '#c084fc' : '#0f172a'
          ctx.lineWidth = pr.towerType === 'kuri' ? 3 : 2
          ctx.beginPath()
          ctx.moveTo(prev.sx, prev.sy)
          ctx.lineTo(sx, sy)
          ctx.stroke()
        }
      }

      // Effects
      const fx = fxRef.current
      let write = 0
      for (let i = 0; i < fx.length; i++) {
        const f = fx[i]
        const k = (now - f.t0) / f.dur
        if (k >= 1) continue
        fx[write++] = f
        const { sx, sy } = P(f.x, f.y)
        ctx.globalAlpha = 1 - k
        if (f.kind === 'ring' || f.kind === 'strike') {
          const rad = ((f.r0 ?? 0) + ((f.r1 ?? 1) - (f.r0 ?? 0)) * k) * cell
          ctx.strokeStyle = f.color
          ctx.lineWidth = f.kind === 'strike' ? 5 : 3
          ctx.beginPath()
          ctx.arc(sx, sy, rad, 0, Math.PI * 2)
          ctx.stroke()
          if (f.kind === 'strike') {
            ctx.fillStyle = f.color
            ctx.globalAlpha = (1 - k) * 0.3
            ctx.fill()
          }
        } else if (f.kind === 'burst' || f.kind === 'sparkle') {
          ctx.fillStyle = f.color
          const n = f.kind === 'burst' ? 8 : 6
          for (let j = 0; j < n; j++) {
            const a = (j / n) * Math.PI * 2 + f.t0
            const d = k * cell * (f.kind === 'burst' ? 0.55 : 0.45)
            ctx.beginPath()
            ctx.arc(sx + Math.cos(a) * d, sy + Math.sin(a) * d - (f.kind === 'sparkle' ? k * cell * 0.3 : 0), Math.max(1.5, cell * 0.05 * (1 - k)), 0, Math.PI * 2)
            ctx.fill()
          }
        } else if (f.kind === 'text' && f.text) {
          ctx.fillStyle = f.color
          ctx.font = `700 ${Math.max(11, Math.round(cell * 0.28))}px Inter, system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.strokeStyle = 'rgba(0,0,0,0.5)'
          ctx.lineWidth = 3
          ctx.strokeText(f.text, sx, sy - k * cell * 0.7)
          ctx.fillText(f.text, sx, sy - k * cell * 0.7)
        }
        ctx.globalAlpha = 1
      }
      fx.length = write

      // Global overlays
      if (state.freezeUntil > state.timeMs) {
        ctx.fillStyle = 'rgba(186, 230, 253, 0.22)'
        ctx.fillRect(0, 0, size.width, height)
      }
      if (state.rallyUntil > state.timeMs) {
        ctx.strokeStyle = 'rgba(234, 88, 12, 0.7)'
        ctx.lineWidth = 6
        ctx.strokeRect(3, 3, size.width - 6, height - 6)
      }
      if (strikeRef.current && hoverRef.current) {
        const { sx, sy } = P(hoverRef.current.x, hoverRef.current.y)
        ctx.strokeStyle = 'rgba(234, 88, 12, 0.9)'
        ctx.setLineDash([6, 6])
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(sx, sy, STRIKE_RADIUS * cell, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [cell, height, size.width, size.portrait, stateRef, fxRef, clockRef, shakeUntilRef])

  function toGrid(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const sx = (clientX - rect.left) / cell
    const sy = (clientY - rect.top) / cell
    return size.portrait ? { x: sy, y: sx } : { x: sx, y: sy }
  }

  const state = stateRef.current
  const padSize = Math.max(44, cell * 0.9)

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height: height || undefined, touchAction: 'manipulation' }}>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full rounded-2xl ${strikeMode ? 'cursor-crosshair' : ''}`}
        style={{ width: size.width, height }}
        role="img"
        aria-label={`Battlefield: ${state?.map.name ?? ''}. Enemies walk the path from the gate to your fort.`}
        onPointerMove={(e) => {
          if (strikeMode) hoverRef.current = toGrid(e.clientX, e.clientY)
        }}
        onPointerDown={(e) => {
          if (strikeMode) onFieldClick(toGrid(e.clientX, e.clientY))
        }}
      />
      {!strikeMode &&
        state?.map.pads.map((pad) => {
          const tower = state.towers.find((t) => t.padId === pad.id)
          const px = size.portrait ? pad.y * cell : pad.x * cell
          const py = size.portrait ? pad.x * cell : pad.y * cell
          return (
            <button
              key={`${pad.id}-${version}`}
              type="button"
              onClick={() => onPadClick(pad.id)}
              aria-pressed={selectedPadId === pad.id}
              aria-label={tower ? `${getTowerType(tower.type as TowerTypeId).name}, level ${tower.level}` : 'Empty build spot'}
              className="absolute rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
              style={{ left: px - padSize / 2, top: py - padSize / 2, width: padSize, height: padSize }}
            />
          )
        })}
    </div>
  )
}
