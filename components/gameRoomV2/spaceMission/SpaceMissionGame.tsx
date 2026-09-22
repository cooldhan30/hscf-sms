'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { GameV2Card, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { GameHUD, QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
import { MissionSetupPicker } from './MissionSetupPicker'
import { MissionPath } from './MissionPath'
import { MissionCompleteScreen } from './MissionCompleteScreen'
import { RecoveryBanner } from './RecoveryBanner'
import {
  createInitialFlight,
  applyCorrectAnswer,
  applyWrongAnswer,
  resolveRecovery,
  getSpaceMissionDifficultySettings,
  type FlightState,
  type SpaceMissionDifficulty,
} from '@/lib/gameRoomV2/spaceMission'

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

// Space Mission's top-level play screen -- composes around
// QuestionOverlay/GameHUD and the shared session lifecycle hook
// (useGameSessionState), the same pattern every custom-visual-layer V2
// engine establishes. The flight state (distance travelled, shields,
// mission streak, which planets have been reached) is client-local
// ephemeral gameplay state, exactly like Tower Defense's battlefield or
// Treasure Quest's room exploration -- only question-answering
// progress and the real score/XP/coins ledger persist server-side via
// the unmodified session framework, which is also what feeds
// progression/achievements/analytics/mastery tracking after this
// engine's session completes (see sessions/[id]/complete/route.ts --
// unchanged, engine-agnostic).
export function SpaceMissionGame({ sessionId, onExit, onPlayAgain }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void }) {
  const [difficulty, setDifficulty] = useState<SpaceMissionDifficulty | null>(null)
  const [flight, setFlight] = useState<FlightState | null>(null)
  const [showQuestion, setShowQuestion] = useState(false)
  const [showCompleteScreen, setShowCompleteScreen] = useState(false)
  const { soundEnabled, toggleSound } = useSoundPreference()
  const { state: sessionState, error, result, pausing, poll, togglePause, exit } = useGameSessionState<StatePayload>({
    sessionId,
    enabled: !!difficulty,
    soundEnabled,
  })

  useEffect(() => {
    if (flight?.missionComplete && !showCompleteScreen) {
      setShowCompleteScreen(true)
      playSound('complete', soundEnabled)
    }
  }, [flight?.missionComplete, showCompleteScreen, soundEnabled])

  // A fresh question opportunity opens whenever the session has one
  // ready and the ship isn't mid-recovery -- sourced exclusively from
  // sessionState.question (the session's linked Question Set); Space
  // Mission never invents or embeds question content itself.
  useEffect(() => {
    if (!flight || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    if (flight.missionComplete || flight.recovering || showQuestion) return
    setShowQuestion(true)
  }, [flight, sessionState, showQuestion])

  function handleStart(chosenDifficulty: SpaceMissionDifficulty) {
    setDifficulty(chosenDifficulty)
    setFlight(createInitialFlight(getSpaceMissionDifficultySettings(chosenDifficulty)))
  }

  function handleAnswerResult(res: { correct: boolean }) {
    setShowQuestion(false)
    setFlight((prev) => {
      if (!prev || !difficulty) return prev
      const settings = getSpaceMissionDifficultySettings(difficulty)
      playSound(res.correct ? 'correct' : 'incorrect', soundEnabled)
      return res.correct ? applyCorrectAnswer(prev, settings) : applyWrongAnswer(prev, settings)
    })
    poll()
  }

  function handleRecoveryResolved() {
    setFlight((prev) => (prev ? resolveRecovery(prev) : prev))
  }

  async function handleTogglePause() {
    await togglePause()
  }

  async function handleExit() {
    await exit(onExit)
  }

  if (!difficulty) {
    return <MissionSetupPicker onStart={handleStart} />
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState || !flight) return <GameV2Loading label="Preparing for launch..." />
  if (result) return <GameResultsScreen result={result} onPlayAgain={onPlayAgain} onExit={onExit} />

  if (showCompleteScreen) {
    return <MissionCompleteScreen bestStreak={flight.bestStreak} onContinue={() => setShowCompleteScreen(false)} />
  }

  const missionStillInFlight = !flight.missionComplete
  if (sessionState.status === 'COMPLETED' && !missionStillInFlight) return <GameV2Loading label="Calculating your results..." />

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

      <MissionPath state={flight} />

      {flight.missionComplete && !showCompleteScreen && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2mint-600 dark:text-gamev2mint-400">
            {'\u{1F30C}'} Docked at the home system! Finish any remaining questions to see your full results.
          </p>
        </GameV2Card>
      )}

      {sessionState.status === 'PAUSED' && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2ink-800 dark:text-white">Mission Paused</p>
          <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-1">
            {pausing ? 'Resuming...' : "Your ship is holding position. Tap resume when you're ready."}
          </p>
        </GameV2Card>
      )}

      <AnimatePresence mode="wait">
        {flight.recovering && <RecoveryBanner key="recovery" onResolved={handleRecoveryResolved} />}
      </AnimatePresence>

      {showQuestion && sessionState.question && sessionState.status === 'ACTIVE' && !flight.recovering && (
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
