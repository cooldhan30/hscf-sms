'use client'

import { useEffect, useRef } from 'react'
import type { TowerTypeId } from '@/lib/gameRoomV2/towerDefense'
import type { EnemyKind } from '@/lib/gameRoomV2/towerDefense/waves'
import { drawTower, drawEnemy } from './art'

// A small canvas that draws the SAME tower / enemy artwork used on the
// battlefield -- for the build menu, the inspector and the wave preview,
// so a child recognises a tower or enemy by its picture.
export function TowerPreview({ type, level = 1, size = 56, animate = false }: { type: TowerTypeId; level?: number; size?: number; animate?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = size * dpr
    canvas.height = size * dpr
    const g = canvas.getContext('2d')!
    let raf = 0
    const draw = (now: number) => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, size, size)
      const c = size * 0.78
      drawTower(g, type, level, size / 2, size * 0.7, c, { angle: -0.5, recoil: 0, time: now, build: 1, rally: false, selected: false })
      if (animate) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [type, level, size, animate])
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />
}

export function EnemyPreview({ kind, size = 36 }: { kind: EnemyKind; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = size * dpr
    canvas.height = size * dpr
    const g = canvas.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const r = size * (kind === 'boss' ? 0.3 : kind === 'swarm' ? 0.2 : 0.26)
    drawEnemy(g, kind, size / 2, size * 0.55, r, { time: 0, id: 1, facing: 1, flash: false, frozen: false, slowed: false, enraged: false })
  }, [kind, size])
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />
}
