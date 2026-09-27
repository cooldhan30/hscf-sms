'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiAward, FiZap, FiTarget, FiStar, FiClock, FiTrendingUp, FiRepeat } from 'react-icons/fi'
import { Confetti } from '@/components/gameRoomV2/celebration/Confetti'
import { Podium } from '@/components/gameRoomV2/celebration/Podium'
import { RewardReveal, type RevealItem } from '@/components/gameRoomV2/celebration/RewardReveal'
import { playSound } from '@/components/gameRoomV2/gameplay/playSound'
import { getAchievement } from '@/lib/gameRoomV2/progression'
import type { GameResult } from '@/lib/gameRoomV2/domain'

export interface RaceSummary {
  standings: { id: string; name: string; color: string; isPlayer: boolean; finishedAt: number | null }[]
  place: number
  time: number | null
  bestLap: number | null
  overtakes: number
  boostsUsed: number
  topSpeed: number
  bestStreak: number
  correct: number
  answered: number
  cleanLaps: number
  comeback: boolean
  records: string[]
}

export const fmtTime = (t: number | null) => {
  if (t === null) return '--'
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

const ORD = ['1st', '2nd', '3rd', '4th']

export function CarAvatar({ color, size = 56 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 100 62" aria-hidden>
      <ellipse cx="50" cy="56" rx="40" ry="5" fill="rgba(0,0,0,0.15)" />
      <rect x="14" y="40" width="16" height="14" rx="4" fill="#111827" />
      <rect x="70" y="40" width="16" height="14" rx="4" fill="#111827" />
      <path d="M8 44 C8 30 20 22 34 20 L58 18 C70 18 80 26 88 34 C94 38 94 46 90 48 L12 50 C9 50 8 47 8 44 Z" fill={color} />
      <path d="M36 22 L56 21 C64 21 70 26 74 32 L34 33 Z" fill="#bfdbfe" />
      <rect x="10" y="38" width="80" height="3" fill="rgba(255,255,255,0.85)" />
    </svg>
  )
}

export function RaceCelebration({
  summary,
  result,
  soundEnabled,
  reducedMotion,
  onRaceAgain,
  onNext,
  onBack,
}: {
  summary: RaceSummary
  result: GameResult | null
  soundEnabled: boolean
  reducedMotion: boolean
  onRaceAgain?: () => void
  onNext?: () => void
  onBack: () => void
}) {
  const { place } = summary
  const [stage, setStage] = useState<'title' | 'podium'>(reducedMotion ? 'podium' : 'title')

  useEffect(() => {
    playSound(place <= 3 ? 'podium' : 'checkpoint', soundEnabled)
    if (stage === 'title') {
      const t = window.setTimeout(() => setStage('podium'), 1300)
      return () => window.clearTimeout(t)
    }
    // Sound once per mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const headline = place === 1 ? '1st PLACE!' : place === 2 ? '2nd PLACE!' : place === 3 ? 'PODIUM FINISH!' : 'NICE TRY!'
  const sub =
    place === 1
      ? 'Tamil Grand Prix Champion'
      : place === 2
        ? 'Great race -- so close to the top step!'
        : place === 3
          ? 'You made the podium!'
          : `You finished 4th -- ${summary.overtakes > 0 ? `${summary.overtakes} overtake${summary.overtakes === 1 ? '' : 's'} on the way` : 'every lap makes you faster'}.`

  const podium = [0, 1, 2].map((i) => {
    const r = summary.standings[i]
    return r ? { name: r.isPlayer ? 'You' : r.name, avatar: <CarAvatar color={r.color} size={i === 0 ? 72 : 60} />, detail: r.finishedAt !== null ? fmtTime(r.finishedAt) : 'on the final lap', highlight: r.isPlayer } : undefined
  })

  const items = useMemo<RevealItem[]>(() => {
    const out: RevealItem[] = []
    if (result) out.push({ id: 'xp', label: 'XP earned', value: `+${result.xpEarned}`, tone: 'xp', icon: <FiStar className="w-4 h-4" aria-hidden /> })
    if (result) out.push({ id: 'coins', label: 'Coins', value: `+${result.coinsEarned}`, tone: 'gold' })
    out.push({ id: 'acc', label: 'Tamil answers', value: result ? `${result.accuracyPct}%` : `${summary.correct}/${summary.answered}`, tone: 'good', icon: <FiTarget className="w-4 h-4" aria-hidden /> })
    out.push({ id: 'streak', label: 'Best streak', value: `x${summary.bestStreak}`, tone: 'default', icon: <FiZap className="w-4 h-4" aria-hidden /> })
    out.push({ id: 'time', label: 'Race time', value: fmtTime(summary.time), icon: <FiClock className="w-4 h-4" aria-hidden /> })
    out.push({ id: 'lap', label: 'Best lap', value: fmtTime(summary.bestLap) })
    out.push({ id: 'ot', label: 'Overtakes', value: summary.overtakes, icon: <FiTrendingUp className="w-4 h-4" aria-hidden /> })
    out.push({ id: 'boost', label: 'Boosts used', value: summary.boostsUsed })
    out.push({ id: 'top', label: 'Top speed', value: `${summary.topSpeed} km/h` })
    for (const r of summary.records) out.push({ id: `rec-${r}`, label: 'Personal best', value: r, tone: 'record' })
    for (const id of result?.newlyEarnedAchievementIds ?? []) {
      const a = getAchievement(id)
      if (a) out.push({ id: `ach-${id}`, label: 'Achievement unlocked', value: a.name, tone: 'record', icon: <FiAward className="w-4 h-4" aria-hidden /> })
    }
    return out
  }, [result, summary])

  const confettiIntensity = place === 1 ? 1 : place <= 3 ? 0.45 : 0

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-gradient-to-b from-primary-50 via-white to-gold-50">
      {confettiIntensity > 0 && stage === 'podium' && <Confetti intensity={confettiIntensity} reducedMotion={reducedMotion} />}
      {stage === 'title' ? (
        <div className="min-h-full flex flex-col items-center justify-center px-6 text-center" role="status">
          <p className="text-5xl sm:text-7xl font-black text-primary-700 animate-gamev2-count" style={{ animationDuration: '1.3s' }}>
            {headline}
          </p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 flex flex-col items-center gap-5">
          <div className="text-center animate-gamev2-pop-in">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-terracotta-600">Tamil Grand Prix</p>
            <h1 className={`text-4xl sm:text-5xl font-black ${place === 1 ? 'text-gold-600' : 'text-primary-700'}`}>{headline}</h1>
            <p className="mt-1 text-stone-600 font-medium">{sub}</p>
            <p className="font-tamil leading-relaxed text-sm text-stone-500">தமிழ் பந்தயம்</p>
          </div>
          <Podium entries={podium} reducedMotion={reducedMotion} />
          {summary.standings[3] && (
            <p className="text-sm text-stone-500">
              4th: <span className="font-semibold text-stone-700">{summary.standings[3].isPlayer ? 'You' : summary.standings[3].name}</span>
              {summary.standings[3].finishedAt !== null && <span className="tabular-nums"> · {fmtTime(summary.standings[3].finishedAt)}</span>}
            </p>
          )}
          <div className="w-full rounded-3xl bg-white border border-stone-200 shadow-lg p-4 sm:p-5">
            {result ? (
              <RewardReveal items={items} soundEnabled={soundEnabled} reducedMotion={reducedMotion} />
            ) : (
              <p className="text-center text-sm text-stone-500 py-4" role="status">
                Saving your race and XP...
              </p>
            )}
          </div>
          <p className="text-xs text-stone-500 -mt-2">{ORD[place - 1]} of 4 on the track · finishing order comes from your driving; Tamil answers powered your boost.</p>
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2">
            {onRaceAgain && (
              <button type="button" onClick={onRaceAgain} className="min-h-[52px] rounded-2xl bg-primary-700 hover:bg-primary-800 text-white font-extrabold text-lg shadow-teal inline-flex items-center justify-center gap-2">
                <FiRepeat className="w-5 h-5" aria-hidden /> Race again
              </button>
            )}
            {onNext && (
              <button type="button" onClick={onNext} className="min-h-[52px] rounded-2xl border-2 border-primary-700 text-primary-800 font-bold bg-white hover:bg-primary-50">
                Next activity
              </button>
            )}
            <button type="button" onClick={onBack} className="min-h-[52px] rounded-2xl border border-stone-300 text-stone-700 font-semibold bg-white hover:bg-stone-50">
              Back to Game Room
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
