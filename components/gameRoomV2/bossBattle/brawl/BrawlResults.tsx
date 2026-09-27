'use client'

import { useEffect, useMemo } from 'react'
import { FiStar, FiTarget, FiZap, FiAward, FiRepeat } from 'react-icons/fi'
import { GiCrown, GiCrossedSwords, GiScrollUnfurled } from 'react-icons/gi'
import { RewardReveal, type RevealItem } from '@/components/gameRoomV2/celebration/RewardReveal'
import { playSound } from '@/components/gameRoomV2/gameplay/playSound'
import { getAchievement } from '@/lib/gameRoomV2/progression'
import type { GameResult } from '@/lib/gameRoomV2/domain'
import { getUpgrade, TOTAL_WAVES, BOSS_STAGE, type BrawlState, type UpgradeId } from '@/lib/gameRoomV2/bossBattle/brawl'
import { UPGRADE_ICON, UPGRADE_TINT } from './icons'

// End of a Boss Battle run, over the dimmed arena: the run (waves,
// enemies, bosses, level, build) and then the learning rewards, which
// come only from the server's /complete result.
export function BrawlResults({
  victory,
  s,
  result,
  soundEnabled,
  reducedMotion,
  onPlayAgain,
  onNext,
  onBack,
}: {
  victory: boolean
  s: BrawlState
  result: GameResult | null
  soundEnabled: boolean
  reducedMotion: boolean
  onPlayAgain?: () => void
  onNext?: () => void
  onBack: () => void
}) {
  useEffect(() => {
    playSound(victory ? 'podium' : 'checkpoint', soundEnabled)
    // once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const items = useMemo<RevealItem[]>(() => {
    const out: RevealItem[] = []
    if (!result) return out
    out.push({ id: 'xp', label: 'XP earned', value: `+${result.xpEarned}`, tone: 'xp', icon: <FiStar className="w-4 h-4" aria-hidden /> })
    out.push({ id: 'acc', label: 'Tamil answers', value: `${result.accuracyPct}%`, tone: 'good', icon: <FiTarget className="w-4 h-4" aria-hidden /> })
    out.push({ id: 'correct', label: 'Correct answers', value: `${result.correctCount}/${result.totalQuestions}`, tone: 'good' })
    out.push({ id: 'streak', label: 'Best streak', value: `x${result.bestStreak}`, icon: <FiZap className="w-4 h-4" aria-hidden /> })
    out.push({ id: 'coins', label: 'Coins', value: `+${result.coinsEarned}`, tone: 'gold' })
    for (const id of result.newlyEarnedAchievementIds ?? []) {
      const a = getAchievement(id)
      if (a) out.push({ id: `ach-${id}`, label: 'Achievement unlocked', value: a.name, tone: 'record', icon: <FiAward className="w-4 h-4" aria-hidden /> })
    }
    return out
  }, [result])

  const st = s.stats
  const waves = victory ? TOTAL_WAVES : Math.min(TOTAL_WAVES, s.stage - 1)
  const mins = Math.floor(st.timeSeconds / 60)
  const secs = Math.floor(st.timeSeconds % 60)
  const build = (Object.entries(s.levels) as [UpgradeId, number][]).filter(([, lv]) => lv > 0)
  const stat = (label: string, value: string | number) => (
    <div className="rounded-2xl bg-stone-50 border border-stone-200 px-3 py-2 text-center">
      <p className="text-lg font-black text-stone-800 tabular-nums">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</p>
    </div>
  )

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-[2px]">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-white p-4 sm:p-6 animate-gamev2-pop-in">
          <div className="text-center">
            <span className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center ${victory ? 'bg-gold-100 text-gold-700' : 'bg-primary-50 text-primary-700'}`}>
              {victory ? <GiCrown className="w-10 h-10" aria-hidden /> : <GiCrossedSwords className="w-10 h-10" aria-hidden />}
            </span>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-terracotta-600">Boss Battle · {s.arena.name}</p>
            <h1 className={`text-4xl sm:text-5xl font-black ${victory ? 'text-gold-600' : 'text-primary-700'}`}>{victory ? 'VICTORY!' : 'DEFEATED'}</h1>
            <p className="mt-1 text-stone-600 font-medium">
              {victory
                ? 'The Irul King is defeated. The arena is safe again!'
                : s.stage >= BOSS_STAGE
                  ? 'So close -- you reached the Irul King. Try a new build and go again!'
                  : `You held out for ${waves} wave${waves === 1 ? '' : 's'} and defeated ${st.kills} enemies. Go again!`}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stat('Waves cleared', `${waves}/${TOTAL_WAVES}`)}
            {stat('Enemies defeated', st.kills)}
            {stat('Bosses defeated', `${st.bossesDefeated}/2`)}
            {stat('Level reached', st.bestLevel)}
            {stat('Time', `${mins}:${String(secs).padStart(2, '0')}`)}
            {stat('Damage dealt', st.damageDealt.toLocaleString())}
            {stat('Dashes', st.dashes)}
            {stat('Checkpoint answers', `${st.correct}/${st.answered}`)}
          </div>
          {build.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500 mb-1.5">Your build</p>
              <ul className="flex flex-wrap gap-1.5">
                {build.map(([id, lv]) => {
                  const Icon = UPGRADE_ICON[id]
                  return (
                    <li key={id} className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white pl-1 pr-2.5 py-1 text-xs font-bold text-stone-700">
                      <span className={`w-6 h-6 rounded-full ${UPGRADE_TINT[id]} text-white flex items-center justify-center`}>
                        <Icon className="w-3.5 h-3.5" aria-hidden />
                      </span>
                      {getUpgrade(id).name} {lv}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          <div className="mt-3 rounded-3xl border border-primary-100 bg-primary-50/40 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700 mb-2 flex items-center gap-1.5">
              <GiScrollUnfurled className="w-4 h-4" aria-hidden /> Your Tamil
            </p>
            {result ? <RewardReveal items={items} soundEnabled={soundEnabled} reducedMotion={reducedMotion} /> : <p className="text-sm text-stone-500 text-center py-3">Saving your XP...</p>}
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {onPlayAgain && (
              <button type="button" onClick={onPlayAgain} className="min-h-[52px] rounded-2xl bg-primary-700 hover:bg-primary-800 text-white font-extrabold text-lg shadow-teal inline-flex items-center justify-center gap-2">
                <FiRepeat className="w-5 h-5" aria-hidden /> {victory ? 'Play again' : 'Try again'}
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
      </div>
    </div>
  )
}
