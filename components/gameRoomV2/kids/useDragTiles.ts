'use client'

import { useCallback, useRef, useState } from 'react'

// Drag-or-tap for the Little Learners drag games (Missing Letter, Letter
// Parade). A tile follows the finger; releasing it calls onDrop with the
// point, and if it wasn't used it glides back. A plain tap (no real
// movement) calls onTap instead -- many 4-year-olds can't drag yet, so a
// tap always works too. Enter/Space on a focused tile also taps it.

const MOVE_THRESHOLD = 8

export interface DragState {
  key: string
  dx: number
  dy: number
}

export function useDragTiles({
  disabled,
  onTap,
  onDrop,
}: {
  disabled: boolean
  onTap: (key: string, el: HTMLElement) => void
  // Return true if the drop was used (the tile then doesn't glide back)
  onDrop: (key: string, point: { x: number; y: number }, el: HTMLElement) => boolean
}) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const start = useRef<{ key: string; x: number; y: number; moved: boolean; el: HTMLElement } | null>(null)

  const handlers = useCallback(
    (key: string) => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (disabled || e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { key, x: e.clientX, y: e.clientY, moved: false, el: e.currentTarget }
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        const s = start.current
        if (!s || s.key !== key) return
        const dx = e.clientX - s.x
        const dy = e.clientY - s.y
        if (!s.moved && Math.hypot(dx, dy) < MOVE_THRESHOLD) return
        s.moved = true
        setDrag({ key, dx, dy })
      },
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
        const s = start.current
        start.current = null
        if (!s || s.key !== key) return
        setDrag(null)
        if (disabled) return
        if (!s.moved) onTap(key, s.el)
        else onDrop(key, { x: e.clientX, y: e.clientY }, s.el)
      },
      onPointerCancel: () => {
        start.current = null
        setDrag(null)
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTap(key, e.currentTarget)
        }
      },
    }),
    [disabled, onTap, onDrop]
  )

  return { drag, handlers }
}

// Is a point inside an element (with a forgiving margin for small fingers)?
export function pointInside(el: Element | null, p: { x: number; y: number }, margin = 28): boolean {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return p.x >= r.left - margin && p.x <= r.right + margin && p.y >= r.top - margin && p.y <= r.bottom + margin
}
