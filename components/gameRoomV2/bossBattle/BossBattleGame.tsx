'use client'

import { useCallback, useEffect, useState } from 'react'
import { GameV2Card, GameV2Button, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound } from '@/components/gameRoomV2/gameplay'
import { BossSetupPicker } from './BossSetupPicker'
import { BossArena } from './BossArena'
import { VictorySequence } from './VictorySequence'
import {
  createInitialBattle,
  applyCorrectAnswerDamage,
  applyWrongAnswerConsequence,
  activateAbility,
  tickBattle,
  getBossBattleDifficultySettings,
  PLAYER_ATTACKER_ID,
  type BattleState,
  type BossId,
  type BossBattleDifficulty,
  type AbilityId,
} from '@/lib/gameRoomV2/bossBattle'
import type { GameResult } from '@/lib/gameRoomV2/domain'

const POLL_INTERVAL_MS = 2000
const SIM_INTERVAL_MS = 100

interface StatePayload {
  status: 'CREATED' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
  currentIndex: number
  totalQuestions: number
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

// Boss Battle's top-level play screen -- composes around QuestionOverlay
// and the shared session API routes, the same pattern Tower Defense and
// Racing already establish, rather than mounting GameSessionRuntime
// directly. The battle simulation (boss/player health, phases,
// abilities, charge) is client-local ephemeral gameplay state; only
// question-answering progress and the real XP/coins ledger persist
// server-side via the unmodified session framework.
export function BossBattleGame({ sessionId, onExit, onPlayAgain }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void }) {
  const [bossId, setBossId] = useState<BossId | null>(null)
  const [difficulty, setDifficulty] = useState<BossBattleDifficulty | null>(null)
  const [battle, setBattle] = useState<BattleState | null>(null)
  const [sessionState, setSessionState] = useState<StatePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)
  const [showQuestion, setShowQuestion] = useState(false)
  const [lastHitBoss, setLastHitBoss] = useState(false)
  const [lastHitPlayer, setLastHitPlayer] = useState(false)
  const [showVictorySequence, setShowVictorySequence] = useState(false)
  const { soundEnabled } = useSoundPreference()

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/gameroom-v2/sessions/${sessionId}/state`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        setError(data?.error || 'Lost connection to the game')
        return
      }
      setError(null)
      setSessionState(data)
    } catch {
      setError('Lost connection -- retrying...')
    }
  }, [sessionId])

  useEffect(() => {
    if (!difficulty) return
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [poll, difficulty])

  // Local battle clock: the boss counterattacks on its own phase-driven
  // interval, entirely independent of the 2s session poll. Frozen while
  // a question is shown or the session is paused, and kept running once
  // the session's questions are exhausted so a shorter Question Set
  // than the fight needs doesn't strand an unfinished battle.
  useEffect(() => {
    if (!battle || !difficulty || showQuestion || sessionState?.status === 'PAUSED' || battle.battleOver) return

    const settings = getBossBattleDifficultySettings(difficulty)
    const interval = setInterval(() => {
      setBattle((prev) => {
        if (!prev) return prev
        const before = prev.attackers[0].health
        const next = tickBattle(prev, SIM_INTERVAL_MS, settings)
        if (next.attackers[0].health < before) {
          setLastHitPlayer(true)
          playSound('incorrect', soundEnabled)
          window.setTimeout(() => setLastHitPlayer(false), 350)
        }
        return next
      })
    }, SIM_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [battle, difficulty, showQuestion, sessionState?.status, soundEnabled])

  useEffect(() => {
    if (battle?.victory && !showVictorySequence) {
      setShowVictorySequence(true)
      playSound('complete', soundEnabled)
    }
  }, [battle?.victory, showVictorySequence, soundEnabled])

  useEffect(() => {
    if (!battle || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    if (battle.battleOver || showQuestion) return
    setShowQuestion(true)
  }, [battle, sessionState, showQuestion])

  useEffect(() => {
    if (sessionState?.status !== 'COMPLETED' || result) return
    fetch(`/api/gameroom-v2/sessions/${sessionId}/complete`, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          return
        }
        setResult({
          sessionId: data.sessionId,
          score: data.score,
          accuracyPct: data.accuracyPct,
          correctCount: data.correctCount,
          incorrectCount: data.incorrectCount,
          totalQuestions: data.totalQuestions,
          xpEarned: data.xpEarned,
          coinsEarned: data.coinsEarned,
          bestStreak: data.bestStreak,
          skillsPracticed: data.skillsPracticed,
          responses: [],
        })
      })
      .catch(() => setError('Failed to load your results'))
  }, [sessionState?.status, result, sessionId])

  function handleStart(chosenBossId: BossId, chosenDifficulty: BossBattleDifficulty) {
    setBossId(chosenBossId)
    setDifficulty(chosenDifficulty)
    setBattle(createInitialBattle(chosenBossId, getBossBattleDifficultySettings(chosenDifficulty)))
  }

  function handleAnswerResult(res: { correct: boolean }) {
    setShowQuestion(false)
    setBattle((prev) => {
      if (!prev || !difficulty) return prev
      const settings = getBossBattleDifficultySettings(difficulty)
      if (res.correct) {
        setLastHitBoss(true)
        playSound('correct', soundEnabled)
        window.setTimeout(() => setLastHitBoss(false), 350)
        return applyCorrectAnswerDamage(prev, PLAYER_ATTACKER_ID, settings)
      }
      setLastHitPlayer(true)
      window.setTimeout(() => setLastHitPlayer(false), 350)
      return applyWrongAnswerConsequence(prev, PLAYER_ATTACKER_ID, settings)
    })
    poll()
  }

  function handleUseAbility(abilityId: AbilityId) {
    setBattle((prev) => {
      if (!prev) return prev
      const next = activateAbility(prev, PLAYER_ATTACKER_ID, abilityId)
      if (next.bossHealth < prev.bossHealth) {
        setLastHitBoss(true)
        window.setTimeout(() => setLastHitBoss(false), 350)
      }
      return next
    })
  }

  async function handleTogglePause() {
    if (!sessionState) return
    const endpoint = sessionState.status === 'PAUSED' ? 'resume' : 'pause'
    await fetch(`/api/gameroom-v2/sessions/${sessionId}/${endpoint}`, { method: 'POST' })
    poll()
  }

  async function handleExit() {
    if (sessionState && sessionState.status !== 'COMPLETED' && sessionState.status !== 'ABANDONED') {
      await fetch(`/api/gameroom-v2/sessions/${sessionId}/abandon`, { method: 'POST' })
    }
    onExit()
  }

  function handleRestart() {
    setBossId(null)
    setDifficulty(null)
    setBattle(null)
    setResult(null)
    setShowVictorySequence(false)
  }

  if (!bossId || !difficulty) {
    return <BossSetupPicker onStart={handleStart} />
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState || !battle) return <GameV2Loading label="Entering the arena..." />
  if (result) return <GameResultsScreen result={result} onPlayAgain={onPlayAgain} onExit={onExit} />

  if (showVictorySequence) {
    return <VictorySequence boss={battle.boss} onContinue={() => setShowVictorySequence(false)} />
  }

  const battleStillInPlay = !battle.battleOver
  if (sessionState.status === 'COMPLETED' && !battleStillInPlay) return <GameV2Loading label="Calculating your results..." />

  if (battle.battleOver && !battle.victory) {
    return (
      <GameV2Card padding="lg" className="max-w-lg w-full mx-auto text-center">
        <div className="text-5xl mb-2" aria-hidden>
          {'\u{1F480}'}
        </div>
        <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Defeated...</h2>
        <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
          {battle.boss.name} proved too strong this time. Answer more questions correctly to land bigger hits next attempt.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <GameV2Button variant="spark" fullWidth onClick={handleRestart}>
            Try Again
          </GameV2Button>
          <GameV2Button variant="ghost" fullWidth onClick={handleExit}>
            Exit
          </GameV2Button>
        </div>
      </GameV2Card>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4 px-4 py-6">
      <div className="w-full flex items-center justify-between">
        <button onClick={handleExit} className="text-sm font-bold text-gamev2ink-400 hover:text-gamev2coral-500">
          Exit
        </button>
        <span className="text-sm font-extrabold text-gamev2ink-800 dark:text-white">
          Question {Math.min(sessionState.currentIndex + 1, sessionState.totalQuestions)} of {sessionState.totalQuestions}
        </span>
        <button onClick={handleTogglePause} className="text-sm font-bold text-gamev2ink-400 hover:text-gamev2ink-700 dark:hover:text-white">
          {sessionState.status === 'PAUSED' ? 'Resume' : 'Pause'}
        </button>
      </div>

      <BossArena state={battle} lastHitBoss={lastHitBoss} lastHitPlayer={lastHitPlayer} onUseAbility={handleUseAbility} />

      {battle.victory && !showVictorySequence && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2mint-600 dark:text-gamev2mint-400">
            {'\u{1F3C6}'} Boss defeated! Finish any remaining questions to see your full results.
          </p>
        </GameV2Card>
      )}

      {sessionState.status === 'PAUSED' && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2ink-800 dark:text-white">Battle Paused</p>
          <GameV2Button variant="spark" size="md" className="mt-3" onClick={handleTogglePause}>
            Resume
          </GameV2Button>
        </GameV2Card>
      )}

      {showQuestion && sessionState.question && sessionState.status === 'ACTIVE' && (
        <div className="w-full">
          <QuestionOverlay
            sessionId={sessionId}
            question={sessionState.question}
            questionIndex={sessionState.currentIndex}
            remainingSeconds={sessionState.remainingSeconds}
            onResult={handleAnswerResult}
          />
        </div>
      )}
    </div>
  )
}
