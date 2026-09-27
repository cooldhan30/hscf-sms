'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { playSound } from '@/components/gameRoomV2/gameplay/playSound'

// Reveals a short list of rewards/stats one after another (quick, with a
// tick sound), instead of dumping every number at once. Tapping "Skip"
// (or reduced motion) shows everything immediately.
export interface RevealItem {
  id: string
  label: string
  value: ReactNode
  tone?: 'xp' | 'gold' | 'good' | 'default' | 'record'
  icon?: ReactNode
}

const TONE: Record<NonNullable<RevealItem['tone']>, string> = {
  xp: 'bg-primary-50 border-primary-200 text-primary-800',
  gold: 'bg-gold-50 border-gold-200 text-gold-800',
  good: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  default: 'bg-stone-50 border-stone-200 text-stone-800',
  record: 'bg-terracotta-50 border-terracotta-200 text-terracotta-800',
}

export function RewardReveal({ items, soundEnabled, reducedMotion = false, stepMs = 420 }: { items: RevealItem[]; soundEnabled: boolean; reducedMotion?: boolean; stepMs?: number }) {
  const [shown, setShown] = useState(reducedMotion ? items.length : 0)

  useEffect(() => {
    if (shown >= items.length) return
    const t = window.setTimeout(() => {
      setShown((n) => n + 1)
      playSound('coin', soundEnabled)
    }, shown === 0 ? 350 : stepMs)
    return () => window.clearTimeout(t)
  }, [shown, items.length, stepMs, soundEnabled])

  return (
    <div className="w-full">
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-live="polite">
        {items.slice(0, shown).map((it) => (
          <li key={it.id} className={`rounded-2xl border px-3 py-2.5 text-center animate-gamev2-pop-in ${TONE[it.tone ?? 'default']}`}>
            <p className="text-lg sm:text-xl font-black tabular-nums flex items-center justify-center gap-1.5">
              {it.icon}
              {it.value}
            </p>
            <p className="font-tamil text-[11px] sm:text-xs font-semibold tracking-wide opacity-80">{it.label}</p>
          </li>
        ))}
      </ul>
      {shown < items.length && (
        <div className="mt-2 text-center">
          <button type="button" onClick={() => setShown(items.length)} className="text-xs font-semibold text-stone-500 hover:text-stone-700 underline min-h-[36px] px-2">
            Skip
          </button>
        </div>
      )}
    </div>
  )
}
