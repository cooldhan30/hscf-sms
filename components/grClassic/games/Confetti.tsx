'use client'

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const COLORS = ['#e11d48', '#f59e0b', '#0d9488', '#4f46e5', '#10b981', '#f97316']

// A short burst of confetti for a finished game. Skipped entirely when the
// device asks for reduced motion.
export function Confetti({ pieces = 36 }: { pieces?: number }) {
  const reduce = useReducedMotion()
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        x: (Math.random() - 0.5) * 700,
        y: 250 + Math.random() * 350,
        r: Math.random() * 540 - 270,
        delay: Math.random() * 0.25,
        color: COLORS[i % COLORS.length],
        w: 8 + Math.random() * 8,
      })),
    [pieces]
  )
  if (reduce) return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center overflow-visible">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute rounded-sm"
          style={{ width: b.w, height: b.w * 0.5, background: b.color }}
          initial={{ x: 0, y: -40, rotate: 0, opacity: 1 }}
          animate={{ x: b.x, y: b.y, rotate: b.r, opacity: 0 }}
          transition={{ duration: 1.6, delay: b.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}
