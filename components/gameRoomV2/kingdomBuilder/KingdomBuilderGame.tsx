'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { GameV2Card, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { GameHUD, QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
import { KingdomSetupPicker } from './KingdomSetupPicker'
import { KingdomScene } from './KingdomScene'
import { ResourceBar } from './ResourceBar'
import { SetbackBanner } from './SetbackBanner'
import { KingdomCompleteScreen } from './KingdomCompleteScreen'
import {
  createInitialKingdom,
  applyCorrectAnswer,
  applyWrongAnswer,
  acknowledgeCompletion,
  streakUpgradeTier,
  kingdomComplete,
  getKingdomBuilderDifficultySettings,
  type KingdomState,
  type KingdomBuilderDifficulty,
} from '@/lib/gameRoomV2/kingdomBuilder'

interface StatePayload {
  status: 'CREATED' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
  currentIndex: number
  totalQuestions: number
  score: number
  currentStreak: number
  xpEarned: number
  coinsEarned: number
  remainingSeconds: number | null
  questionTimeLimitSeconds: number
  question: QuestionOverlayQuestion | null
}

// Kingdom Builder's top-level play screen -- composes around
// QuestionOverlay/GameHUD and the shared session lifecycle hook
// (useGameSessionState), the same pattern every custom-visual-layer V2
// engine establishes (Tower Defense, Racing, Boss Battle, Treasure
// Quest, Word Ninja, Space Mission). The kingdom state (resources
// earned, which buildings stand, streak-driven visual tier) is
// client-local ephemeral gameplay state, exactly like those engines'
// own battlefield/race/exploration state -- only question-answering
// progress and the real score/XP/coins ledger persist server-side via
// the unmodified session framework, which is also what feeds
// progression/achievements/analytics/mastery tracking after this
// engine's session completes (sessions/[id]/complete/route.ts --
// unchanged, engine-agnostic).
export function KingdomBuilderGame({ sessionId, onExit, onPlayAgain }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void }) {
  const [difficulty, setDifficulty] = useState<KingdomBuilderDifficulty | null>(null)
  const [kingdom, setKingdom] = useState<KingdomState | null>(null)
  const [showQuestion, setShowQuestion] = useState(false)
  const [inSetback, setInSetback] = useState(false)
  const [showCompleteScreen, setShowCompleteScreen] = useState(false)
  const { soundEnabled, toggleSound } = useSoundPreference()
  const { state: sessionState, error, result, pausing, poll, togglePause, exit } = useGameSessionState<StatePayload>({
    sessionId,
    enabled: !!difficulty,
    soundEnabled,
  })

  useEffect(() => {
    if (kingdom && kingdomComplete(kingdom) && !showCompleteScreen) {
      setShowCompleteScreen(true)
      playSound('complete', soundEnabled)
    }
  }, [kingdom, showCompleteScreen, soundEnabled])

  // A fresh question opportunity opens whenever the session has one
  // ready and the kingdom isn't mid-setback -- sourced exclusively from
  // sessionState.question (the session's linked Question Set); Kingdom
  // Builder never invents or embeds question content itself.
  useEffect(() => {
    if (!kingdom || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    if (kingdomComplete(kingdom) || inSetback || showQuestion) return
    setShowQuestion(true)
  }, [kingdom, sessionState, inSetback, showQuestion])

  // The "just completed" pop-in plays once (KingdomScene's spring
  // animation), then this acknowledges it after the animation window
  // -- clearing the flag so the same building doesn't re-celebrate on
  // the next unrelated state update.
  useEffect(() => {
    if (!kingdom?.justCompletedId) return
    const timeout = window.setTimeout(handleAcknowledgeBuilding, 900)
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kingdom?.justCompletedId])

  function handleStart(chosenDifficulty: KingdomBuilderDifficulty) {
    setDifficulty(chosenDifficulty)
    setKingdom(createInitialKingdom(getKingdomBuilderDifficultySettings(chosenDifficulty)))
  }

  function handleAnswerResult(res: { correct: boolean }) {
    setShowQuestion(false)
    setKingdom((prev) => {
      if (!prev || !difficulty) return prev
      const settings = getKingdomBuilderDifficultySettings(difficulty)
      playSound(res.correct ? 'correct' : 'incorrect', soundEnabled)
      if (res.correct) {
        const next = applyCorrectAnswer(prev, settings)
        if (next.justCompletedId) playSound('complete', soundEnabled)
        return next
      }
      setInSetback(true)
      return applyWrongAnswer(prev, settings)
    })
    poll()
  }

  function handleSetbackResolved() {
    setInSetback(false)
  }

  function handleAcknowledgeBuilding() {
    setKingdom((prev) => (prev ? acknowledgeCompletion(prev) : prev))
  }

  async function handleTogglePause() {
    await togglePause()
  }

  async function handleExit() {
    await exit(onExit)
  }

  if (!difficulty) {
    return <KingdomSetupPicker onStart={handleStart} />
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState || !kingdom) return <GameV2Loading label="Surveying the land..." />
  if (result) return <GameResultsScreen result={result} onPlayAgain={onPlayAgain} onExit={onExit} />

  if (showCompleteScreen) {
    return <KingdomCompleteScreen bestStreak={kingdom.bestStreak} onContinue={() => setShowCompleteScreen(false)} />
  }

  const kingdomStillGrowing = !kingdomComplete(kingdom)
  if (sessionState.status === 'COMPLETED' && !kingdomStillGrowing) return <GameV2Loading label="Calculating your results..." />

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4 px-4 py-6">
      <GameHUD
        currentIndex={sessionState.currentIndex}
        totalQuestions={sessionState.totalQuestions}
        remainingSeconds={sessionState.status === 'ACTIVE' ? sessionState.remainingSeconds : null}
        questionTimeLimitSeconds={sessionState.questionTimeLimitSeconds}
        currentStreak={sessionState.currentStreak}
        lives={0}
        maxLives={0}
        xpEarned={sessionState.xpEarned}
        coinsEarned={sessionState.coinsEarned}
        paused={sessionState.status === 'PAUSED'}
        soundEnabled={soundEnabled}
        onTogglePause={handleTogglePause}
        onToggleSound={toggleSound}
        onExit={handleExit}
      />

      <ResourceBar resources={kingdom.resources} />

      <KingdomScene state={kingdom} upgradeTier={streakUpgradeTier(kingdom.currentStreak)} />

      {kingdomComplete(kingdom) && !showCompleteScreen && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2mint-600 dark:text-gamev2mint-400">
            {'\u{1F3F0}'} Your kingdom is complete! Finish any remaining questions to see your full results.
          </p>
        </GameV2Card>
      )}

      {sessionState.status === 'PAUSED' && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2ink-800 dark:text-white">Kingdom Paused</p>
          <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-1">
            {pausing ? 'Resuming...' : "Building is on hold. Tap resume when you're ready."}
          </p>
        </GameV2Card>
      )}

      <AnimatePresence mode="wait">{inSetback && <SetbackBanner key="setback" onResolved={handleSetbackResolved} />}</AnimatePresence>

      {showQuestion && sessionState.question && sessionState.status === 'ACTIVE' && !inSetback && (
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
