'use client'

import { useEffect, useMemo } from 'react'
import { FiStar, FiTarget, FiZap, FiAward, FiRepeat } from 'react-icons/fi'
import { GiCastle, GiCrossedSwords, GiCrown } from 'react-icons/gi'
import { Confetti } from '@/components/gameRoomV2/celebration/Confetti'
import { RewardReveal, type RevealItem } from '@/components/gameRoomV2/celebration/RewardReveal'
import { playSound } from '@/components/gameRoomV2/gameplay/playSound'
import { getAchievement } from '@/lib/gameRoomV2/progression'
import type { GameResult } from '@/lib/gameRoomV2/domain'
import type { TdState } from '@/lib/gameRoomV2/towerDefense'

// End of battle, presented over the (dimmed) battlefield rather than
// jumping to a separate page: VICTORY with confetti, or a warm "the fort
// fell" that highlights what the student achieved. Game stats first, then
// the learning rewards revealed one by one (skippable).
export function TdResults({
  victory,
  td,
  result,
  soundEnabled,
  reducedMotion,
  onPlayAgain,
  onNext,
  onBack,
}: {
  victory: boolean
  td: TdState
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

  const s = td.stats
  const items = useMemo<RevealItem[]>(() => {
    const out: RevealItem[] = []
    if (result) out.push({ id: 'xp', label: 'XP earned', value: `+${result.xpEarned}`, tone: 'xp', icon: <FiStar className="w-4 h-4" aria-hidden /> })
    if (result) out.push({ id: 'acc', label: 'Tamil answers', value: `${result.accuracyPct}%`, tone: 'good', icon: <FiTarget className="w-4 h-4" aria-hidden /> })
    if (result) out.push({ id: 'correct', label: 'Correct answers', value: `${result.correctCount}/${result.totalQuestions}`, tone: 'good' })
    if (result) out.push({ id: 'streak', label: 'Best streak', value: `x${result.bestStreak}`, icon: <FiZap className="w-4 h-4" aria-hidden /> })
    if (result) out.push({ id: 'coins', label: 'Coins', value: `+${result.coinsEarned}`, tone: 'gold' })
    for (const id of result?.newlyEarnedAchievementIds ?? []) {
      const a = getAchievement(id)
      if (a) out.push({ id: `ach-${id}`, label: 'Achievement unlocked', value: a.name, tone: 'record', icon: <FiAward className="w-4 h-4" aria-hidden /> })
    }
    return out
  }, [result])

  const stat = (label: string, value: string | number) => (
    <div className="rounded-2xl bg-stone-50 border border-stone-200 px-3 py-2 text-center">
      <p className="text-lg font-black text-stone-800 tabular-nums">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</p>
    </div>
  )

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-stone-900/35 backdrop-blur-[2px]">
      {victory && <Confetti intensity={1} reducedMotion={reducedMotion} />}
      <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-white p-4 sm:p-6 animate-gamev2-pop-in">
          <div className="text-center">
            <span className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center ${victory ? 'bg-gold-100 text-gold-700' : 'bg-primary-50 text-primary-700'}`}>
              {victory ? <GiCrown className="w-10 h-10" aria-hidden /> : <GiCastle className="w-10 h-10" aria-hidden />}
            </span>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-terracotta-600">Guard the Fort</p>
            <h1 className={`text-4xl sm:text-5xl font-black ${victory ? 'text-gold-600' : 'text-primary-700'}`}>{victory ? 'VICTORY!' : 'THE FORT FELL'}</h1>
            <p className="mt-1 text-stone-600 font-medium">
              {victory
                ? s.bossDefeated
                  ? 'You defeated the Irul King and held every wave!'
                  : 'You held every wave!'
                : `Rebuild your defence and try again -- you survived ${s.wavesCleared} wave${s.wavesCleared === 1 ? '' : 's'} and defeated ${s.enemiesDefeated} enemies.`}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stat('Waves survived', `${s.wavesCleared}/${td.totalWaves}`)}
            {stat('Enemies defeated', s.enemiesDefeated)}
            {stat('Fort health', `${td.baseHp}/${td.maxBaseHp}`)}
            {stat('Boss', s.bossDefeated ? 'Defeated' : 'Standing')}
            {stat('Towers built', s.towersBuilt)}
            {stat('Upgrades', s.upgrades)}
            {stat('Abilities used', s.abilitiesUsed)}
            {stat('Coins earned', s.coinsEarned)}
          </div>
          <div className="mt-3 rounded-3xl border border-primary-100 bg-primary-50/40 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700 mb-2 flex items-center gap-1.5">
              <GiCrossedSwords className="w-4 h-4" aria-hidden /> Your Tamil
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
