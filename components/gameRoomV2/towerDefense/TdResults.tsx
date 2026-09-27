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
import { Bi, ta } from '@/components/gameRoomV2/Bi'
import { TA } from '@/lib/gameRoomV2/i18n/ta'

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
    if (result) out.push({ id: 'xp', label: ta('xp', true), value: `+${result.xpEarned}`, tone: 'xp', icon: <FiStar className="w-4 h-4" aria-hidden /> })
    if (result) out.push({ id: 'acc', label: 'தமிழ் விடைகள் · Tamil answers', value: `${result.accuracyPct}%`, tone: 'good', icon: <FiTarget className="w-4 h-4" aria-hidden /> })
    if (result) out.push({ id: 'correct', label: ta('correctAnswers', true), value: `${result.correctCount}/${result.totalQuestions}`, tone: 'good' })
    if (result) out.push({ id: 'streak', label: ta('bestStreak', true), value: `x${result.bestStreak}`, icon: <FiZap className="w-4 h-4" aria-hidden /> })
    if (result) out.push({ id: 'coins', label: ta('coins', true), value: `+${result.coinsEarned}`, tone: 'gold' })
    for (const id of result?.newlyEarnedAchievementIds ?? []) {
      const a = getAchievement(id)
      if (a) out.push({ id: `ach-${id}`, label: 'புதிய சாதனை · Achievement', value: a.name, tone: 'record', icon: <FiAward className="w-4 h-4" aria-hidden /> })
    }
    return out
  }, [result])

  const stat = (label: string, value: string | number) => (
    <div className="rounded-2xl bg-stone-50 border border-stone-200 px-3 py-2 text-center">
      <p className="text-lg font-black text-stone-800 tabular-nums">{value}</p>
      <p className="font-tamil text-[11px] font-semibold tracking-wide text-stone-500">{label}</p>
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
            <p className="mt-2 text-sm font-bold text-terracotta-600 font-tamil">கோட்டை காப்போம் <span className="text-xs uppercase tracking-[0.2em] font-sans opacity-80">· Guard the Fort</span></p>
            <h1 className={`font-tamil leading-tight text-4xl sm:text-5xl font-black ${victory ? 'text-gold-600' : 'text-primary-700'}`}>{victory ? TA.victory.ta : 'கோட்டை வீழ்ந்தது'}</h1>
            <p className="mt-1 text-stone-600 font-medium font-tamil">
              {victory
                ? s.bossDefeated
                  ? 'இருள் அரசனை வென்று, எல்லா அலைகளையும் தாங்கினீர்கள்!'
                  : 'எல்லா அலைகளையும் தாங்கினீர்கள்!'
                : `தற்காப்பை மீண்டும் கட்டி முயலுங்கள் -- ${s.wavesCleared} அலைகளைத் தாங்கி, ${s.enemiesDefeated} எதிரிகளை வென்றீர்கள்.`}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stat('தாங்கிய அலைகள்', `${s.wavesCleared}/${td.totalWaves}`)}
            {stat('வென்ற எதிரிகள்', s.enemiesDefeated)}
            {stat('கோட்டை வலிமை', `${td.baseHp}/${td.maxBaseHp}`)}
            {stat(TA.boss.ta, s.bossDefeated ? 'வீழ்ந்தது' : 'நிற்கிறது')}
            {stat('கட்டிய கோபுரங்கள்', s.towersBuilt)}
            {stat('மேம்பாடுகள்', s.upgrades)}
            {stat('பயன்படுத்திய ஆற்றல்கள்', s.abilitiesUsed)}
            {stat('ஈட்டிய நாணயங்கள்', s.coinsEarned)}
          </div>
          <div className="mt-3 rounded-3xl border border-primary-100 bg-primary-50/40 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700 mb-2 flex items-center gap-1.5">
              <GiCrossedSwords className="w-4 h-4" aria-hidden /> <span className="font-tamil normal-case tracking-normal text-sm">உங்கள் தமிழ்</span> · Your Tamil
            </p>
            {result ? <RewardReveal items={items} soundEnabled={soundEnabled} reducedMotion={reducedMotion} /> : <p className="text-sm text-stone-500 text-center py-3 font-tamil">{ta('saving')}</p>}
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {onPlayAgain && (
              <button type="button" onClick={onPlayAgain} className="min-h-[52px] rounded-2xl bg-primary-700 hover:bg-primary-800 text-white font-extrabold text-lg shadow-teal inline-flex items-center justify-center gap-2">
                <FiRepeat className="w-5 h-5" aria-hidden /> {victory ? <Bi k="playAgain" inline /> : <Bi k="tryAgain" inline />}
              </button>
            )}
            {onNext && (
              <button type="button" onClick={onNext} className="min-h-[52px] rounded-2xl border-2 border-primary-700 text-primary-800 font-bold bg-white hover:bg-primary-50">
                <Bi k="nextActivity" inline />
              </button>
            )}
            <button type="button" onClick={onBack} className="min-h-[52px] rounded-2xl border border-stone-300 text-stone-700 font-semibold bg-white hover:bg-stone-50">
              <Bi k="backToGameRoom" inline />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
