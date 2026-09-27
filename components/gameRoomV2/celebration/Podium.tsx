'use client'

import type { ReactNode } from 'react'

// A three-step podium: 1st in the centre (tallest), 2nd on the left, 3rd
// on the right. Each entry supplies its own avatar (a car, an initial...)
// and an optional detail line (finish time, score). Steps rise in with a
// short stagger; with reduced motion they simply appear.
export interface PodiumEntry {
  name: string
  avatar: ReactNode
  detail?: string
  highlight?: boolean
}

const STEP = [
  { place: 2, height: 'h-20 sm:h-28', medal: 'bg-stone-300 text-stone-800', label: '2nd', delay: 250 },
  { place: 1, height: 'h-28 sm:h-40', medal: 'bg-gold-400 text-stone-900', label: '1st', delay: 550 },
  { place: 3, height: 'h-14 sm:h-20', medal: 'bg-terracotta-300 text-terracotta-900', label: '3rd', delay: 0 },
]

export function Podium({ entries, reducedMotion = false }: { entries: (PodiumEntry | undefined)[]; reducedMotion?: boolean }) {
  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4" role="list" aria-label="Podium">
      {STEP.map((step) => {
        const e = entries[step.place - 1]
        if (!e) return <div key={step.place} className="w-24 sm:w-32" />
        return (
          <div
            key={step.place}
            role="listitem"
            aria-label={`${step.label}: ${e.name}${e.detail ? `, ${e.detail}` : ''}`}
            className={`flex flex-col items-center w-24 sm:w-32 ${reducedMotion ? '' : 'animate-gamev2-podium-rise'}`}
            style={reducedMotion ? undefined : { animationDelay: `${step.delay}ms`, animationFillMode: 'both' }}
          >
            <div className={`mb-1 ${step.place === 1 ? 'scale-110' : ''}`}>{e.avatar}</div>
            <p className={`text-sm sm:text-base font-extrabold text-center leading-tight ${e.highlight ? 'text-primary-700' : 'text-stone-800'}`}>{e.name}</p>
            {e.detail && <p className="text-xs text-stone-500 tabular-nums">{e.detail}</p>}
            <div
              className={`mt-2 w-full ${step.height} rounded-t-2xl flex items-start justify-center pt-2 shadow-md ${
                step.place === 1 ? 'bg-gradient-to-b from-primary-500 to-primary-700' : 'bg-gradient-to-b from-primary-300 to-primary-500'
              } ${e.highlight ? 'ring-4 ring-gold-400' : ''}`}
            >
              <span className={`inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full font-black text-sm sm:text-base shadow ${step.medal}`}>{step.place}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
