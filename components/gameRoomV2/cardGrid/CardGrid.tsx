'use client'

import type { ReactNode } from 'react'
import { gridColumnsForCardCount } from '@/lib/gameRoomV2/cardGrid'

// Full literal class combinations -- Tailwind's scanner only picks up
// class names that appear as complete strings in source, so the
// base/sm pair must be written out per combination rather than built
// from template-string fragments (`grid-cols-${n}` would never be
// generated into the CSS output).
const GRID_CLASS: Record<string, string> = {
  '2-3': 'grid-cols-2 sm:grid-cols-3',
  '3-4': 'grid-cols-3 sm:grid-cols-4',
  '4-5': 'grid-cols-4 sm:grid-cols-5',
}

// The shared responsive grid wrapper both Matching and Memory lay
// their cards out in -- column count scales with card count (see
// gridColumnsForCardCount) so a small 6-card round and a denser
// 16-card round both stay legible at phone width through desktop.
export function CardGrid({ cardCount, children }: { cardCount: number; children: ReactNode }) {
  const cols = gridColumnsForCardCount(cardCount)
  const gridClass = GRID_CLASS[`${cols.base}-${cols.sm}`] ?? GRID_CLASS['3-4']
  return <div className={`w-full max-w-2xl mx-auto grid ${gridClass} gap-2 sm:gap-3`}>{children}</div>
}
