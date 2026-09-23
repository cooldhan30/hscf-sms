'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { GameV2Card, GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { GameHUD, QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
import { MysterySetupPicker } from './MysterySetupPicker'
import { RoomView, ProgressTrail } from './RoomView'
import { ClueInventory } from './ClueInventory'
import { SetbackBanner } from './SetbackBanner'
import { MysteryResolvedScreen } from './MysteryResolvedScreen'
import {
  createInitialInvestigation,
  currentRoom,
  cluesFound,
  applyCorrectAnswer,
  applyWrongAnswer,
  getMysteryMansionDifficultySettings,
  type InvestigationState,
  type MysteryMansionDifficulty,
} from '@/lib/gameRoomV2/mysteryMansion'

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

// Mystery Mansion's top-level play screen -- composes around
// QuestionOverlay/GameHUD and the shared session lifecycle hook
// (useGameSessionState), the same pattern every custom-visual-layer V2
// engine establishes (Tower Defense, Racing, Boss Battle, Treasure
// Quest, Word Ninja, Space Mission, Kingdom Builder). The investigation
// state (which room, which clues, the generated mystery itself) is
// client-local ephemeral gameplay state, seeded from the session's own
// id (see lib/gameRoomV2/mysteryMansion/generator.ts) so it
// regenerates identically on a refresh but differs session to
// session -- only question-answering progress and the real score/XP/
// coins ledger persist server-side via the unmodified session
// framework, which is also what feeds
// progression/achievements/analytics/mastery tracking after this
// engine's session completes (sessions/[id]/complete/route.ts --
// unchanged, engine-agnostic).
export function MysteryMansionGame({ sessionId, onExit, onPlayAgain }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void }) {
  const [difficulty, setDifficulty] = useState<MysteryMansionDifficulty | null>(null)
  const [investigation, setInvestigation] = useState<InvestigationState | null>(null)
  const [showQuestion, setShowQuestion] = useState(false)
  const [inSetback, setInSetback] = useState(false)
  const [revealedClue, setRevealedClue] = useState<string | null>(null)
  const [showResolvedScreen, setShowResolvedScreen] = useState(false)
  const { soundEnabled, toggleSound } = useSoundPreference()
  const { state: sessionState, error, result, pausing, poll, togglePause, exit } = useGameSessionState<StatePayload>({
    sessionId,
    enabled: !!difficulty,
    soundEnabled,
  })

  useEffect(() => {
    if (investigation?.mysterySolved && !showResolvedScreen) {
      setShowResolvedScreen(true)
      playSound('victory', soundEnabled)
    }
  }, [investigation?.mysterySolved, showResolvedScreen, soundEnabled])

  // A fresh question opportunity opens whenever the session has one
  // ready and the investigation isn't mid-setback -- sourced
  // exclusively from sessionState.question (the session's linked
  // Question Set); Mystery Mansion never invents or embeds question
  // content itself.
  useEffect(() => {
    if (!investigation || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    if (investigation.mysterySolved || inSetback || showQuestion) return
    setShowQuestion(true)
  }, [investigation, sessionState, inSetback, showQuestion])

  function handleStart(chosenDifficulty: MysteryMansionDifficulty) {
    setDifficulty(chosenDifficulty)
    setInvestigation(createInitialInvestigation(sessionId, getMysteryMansionDifficultySettings(chosenDifficulty)))
  }

  function handleAnswerResult(res: { correct: boolean }) {
    // QuestionOverlay already played correct/incorrect the moment the
    // server responded, just before calling this callback.
    setShowQuestion(false)
    setRevealedClue(null)
    setInvestigation((prev) => {
      if (!prev || !difficulty) return prev
      const settings = getMysteryMansionDifficultySettings(difficulty)
      if (res.correct) {
        const solvedRoom = currentRoom(prev)
        setRevealedClue(prev.mystery.clueByRoomId[solvedRoom.id])
        return applyCorrectAnswer(prev)
      }
      setInSetback(true)
      return applyWrongAnswer(prev, settings)
    })
    poll()
  }

  function handleSetbackResolved() {
    setInSetback(false)
  }

  async function handleTogglePause() {
    await togglePause()
  }

  async function handleExit() {
    await exit(onExit)
  }

  if (!difficulty) {
    return <MysterySetupPicker onStart={handleStart} />
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState || !investigation) return <GameV2Loading label="Stepping through the front door..." />
  if (result) return <GameResultsScreen result={result} onPlayAgain={onPlayAgain} onExit={onExit} />

  if (showResolvedScreen) {
    return (
      <MysteryResolvedScreen
        mystery={investigation.mystery}
        bestStreak={investigation.bestStreak}
        onContinue={() => setShowResolvedScreen(false)}
      />
    )
  }

  const mysteryStillUnsolved = !investigation.mysterySolved
  if (sessionState.status === 'COMPLETED' && !mysteryStillUnsolved) return <GameV2Loading label="Calculating your results..." />

  const clues = cluesFound(investigation)

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4 px-4 py-6">
      <GameHUD
        currentIndex={sessionState.currentIndex}
        totalQuestions={sessionState.totalQuestions}
        remainingSeconds={sessionState.status === 'ACTIVE' ? sessionState.remainingSeconds : null}
        questionTimeLimitSeconds={sessionState.questionTimeLimitSeconds}
        currentStreak={sessionState.currentStreak}
        lives={investigation.leads}
        maxLives={3}
        xpEarned={sessionState.xpEarned}
        coinsEarned={sessionState.coinsEarned}
        paused={sessionState.status === 'PAUSED'}
        soundEnabled={soundEnabled}
        onTogglePause={handleTogglePause}
        onToggleSound={toggleSound}
        onExit={handleExit}
      />

      <ProgressTrail unlockedRoomIds={investigation.unlockedRoomIds} currentRoomId={currentRoom(investigation).id} />

      <RoomView room={currentRoom(investigation)} revealedClue={revealedClue} />

      <ClueInventory clues={clues} />

      {investigation.mysterySolved && !showResolvedScreen && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2mint-600 dark:text-gamev2mint-400">
            {'\u{1F50D}'} The case is solved! Finish any remaining questions to see your full results.
          </p>
        </GameV2Card>
      )}

      {sessionState.status === 'PAUSED' && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2ink-800 dark:text-white">Investigation Paused</p>
          <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-1">
            {pausing ? 'Resuming...' : "The mansion is quiet for now. Tap resume when you're ready."}
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
