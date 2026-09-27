'use client'

import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'
import { FiPause, FiPlay, FiVolume2, FiVolumeX, FiLogOut } from 'react-icons/fi'
import { ta } from '@/components/gameRoomV2/Bi'

// A compact, readable in-game HUD shared by the arcade engines (Tower
// Defense first). It sits ABOVE the play area, never over it, and wraps
// onto two rows on a phone rather than shrinking text.
export interface HudStat {
  icon: IconType
  label: string
  value: ReactNode
  tone?: 'default' | 'gold' | 'good' | 'bad'
}

const TONE: Record<NonNullable<HudStat['tone']>, string> = {
  default: 'text-white',
  gold: 'text-yellow-300',
  good: 'text-emerald-300',
  bad: 'text-red-300',
}

export function ArenaHud({
  stats,
  health,
  paused,
  onTogglePause,
  soundEnabled,
  onToggleSound,
  onExit,
  extra,
}: {
  stats: HudStat[]
  health?: { value: number; max: number; label: string }
  paused?: boolean
  onTogglePause?: () => void
  soundEnabled: boolean
  onToggleSound: () => void
  onExit: () => void
  extra?: ReactNode
}) {
  const pct = health ? Math.max(0, Math.min(100, (health.value / health.max) * 100)) : 0
  return (
    <div className="sticky top-0 z-20 bg-stone-900/95 backdrop-blur border-b border-white/10">
      <div className="max-w-6xl mx-auto px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 flex-1 min-w-0">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5" title={s.label}>
              <s.icon className={`w-4 h-4 ${TONE[s.tone ?? 'default']}`} aria-hidden />
              <span className="sr-only">{s.label}:</span>
              <span className={`text-sm font-bold tabular-nums ${TONE[s.tone ?? 'default']}`}>{s.value}</span>
            </div>
          ))}
          {health && (
            <div className="flex items-center gap-2 min-w-[140px]" aria-label={`${health.label}: ${health.value} of ${health.max}`}>
              <span className="text-xs font-semibold text-stone-300 font-tamil">{health.label}</span>
              <div className="h-2.5 flex-1 min-w-[80px] rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${pct > 50 ? 'bg-emerald-400' : pct > 25 ? 'bg-yellow-400' : 'bg-red-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums text-white">
                {health.value}/{health.max}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {extra}
          {onTogglePause && (
            <button
              type="button"
              onClick={onTogglePause}
              aria-label={paused ? ta('resume', true) : ta('pause', true)}
              className="min-w-[44px] min-h-[44px] rounded-xl text-white hover:bg-white/10 flex items-center justify-center"
            >
              {paused ? <FiPlay className="w-5 h-5" /> : <FiPause className="w-5 h-5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? ta('muteSound', true) : ta('soundOn', true)}
            aria-pressed={soundEnabled}
            className="min-w-[44px] min-h-[44px] rounded-xl text-white hover:bg-white/10 flex items-center justify-center"
          >
            {soundEnabled ? <FiVolume2 className="w-5 h-5" /> : <FiVolumeX className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={onExit}
            aria-label={ta('exitGame', true)}
            className="min-w-[44px] min-h-[44px] rounded-xl text-stone-300 hover:text-white hover:bg-white/10 flex items-center justify-center"
          >
            <FiLogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
